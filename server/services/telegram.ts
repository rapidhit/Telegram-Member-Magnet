import { TelegramClient, StringSession, NewMessage } from "../utils/telegramImports";
import type { TelegramAccount, Channel } from "@shared/schema";

export interface TelegramChannel {
  id: string;
  title: string;
  username?: string;
  memberCount: number;
  isAdmin: boolean;
}

export class TelegramService {
  private clients: Map<number, TelegramClient> = new Map();

  async sendVerificationCode(
    apiId: string,
    apiHash: string,
    phoneNumber: string
  ): Promise<{ phoneCodeHash: string; sessionString: string }> {
    const session = new StringSession("");
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    
    const result = await client.sendCode({
      apiId: parseInt(apiId),
      apiHash: apiHash,
    }, phoneNumber);

    const sessionString = (client.session.save() as any).toString();
    
    return {
      phoneCodeHash: result.phoneCodeHash,
      sessionString: sessionString
    };
  }

  async verifyAndConnect(
    sessionString: string,
    apiId: string,
    apiHash: string,
    phoneNumber: string,
    code: string,
    phoneCodeHash: string
  ): Promise<{ client: TelegramClient; session: string }> {
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    
    await client.signInUser({
      apiId: parseInt(apiId),
      apiHash: apiHash,
    }, {
      phoneNumber,
      phoneCode: async () => code,
      password: async () => "",
      onError: (err: any) => console.error("Telegram sign in error:", err),
    });

    const finalSessionStr = (client.session.save() as any).toString();
    return { client, session: finalSessionStr };
  }



  async getClient(telegramAccountId: number, sessionString: string, apiId: string, apiHash: string): Promise<TelegramClient> {
    if (this.clients.has(telegramAccountId)) {
      return this.clients.get(telegramAccountId)!;
    }

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    this.clients.set(telegramAccountId, client);
    return client;
  }

  async getAdminChannels(client: TelegramClient): Promise<TelegramChannel[]> {
    const dialogs = await client.getDialogs();
    const adminChannels: TelegramChannel[] = [];

    for (const dialog of dialogs) {
      if (dialog.isChannel && dialog.entity) {
        try {
          const entity = dialog.entity;
          const channelId = entity.id.toString();
          
          // Check if user is admin
          try {
            const participants = await client.getParticipants(entity, { 
              filter: { _: "channelParticipantsAdmins" } as any 
            });
            const me = await client.getMe();
            const isAdmin = participants.some((p: any) => p.id.equals(me.id));

            if (isAdmin) {
              adminChannels.push({
                id: channelId,
                title: (entity as any).title || "Unknown Channel",
                username: (entity as any).username,
                memberCount: (entity as any).participantsCount || 0,
                isAdmin: true,
              });
            }
          } catch (adminCheckError) {
            // If admin check fails, still include channel but mark as potentially non-admin
            adminChannels.push({
              id: channelId,
              title: (entity as any).title || "Unknown Channel",
              username: (entity as any).username,
              memberCount: (entity as any).participantsCount || 0,
              isAdmin: false,
            });
          }
        } catch (error) {
          console.error(`Error checking channel ${dialog.entity?.id}:`, error);
        }
      }
    }

    return adminChannels;
  }

  async getAllChannels(client: TelegramClient): Promise<TelegramChannel[]> {
    const dialogs = await client.getDialogs({ limit: 500 }); // Increased limit to get more channels
    const allChannels: TelegramChannel[] = [];

    console.log(`Found ${dialogs.length} total dialogs`);

    for (const dialog of dialogs) {
      if (dialog.isChannel && dialog.entity) {
        try {
          const entity = dialog.entity;
          const channelId = entity.id.toString();
          
          // Check if user is admin (optional check, doesn't exclude non-admin channels)
          let isAdmin = false;
          try {
            const participants = await client.getParticipants(entity, { 
              filter: { _: "channelParticipantsAdmins" } as any,
              limit: 50
            });
            const me = await client.getMe();
            isAdmin = participants.some((p: any) => p.id.equals(me.id));
          } catch (adminCheckError) {
            // Admin check failed, but we still include the channel
            console.log(`Admin check failed for channel ${channelId}, including anyway`);
          }

          // Include ALL channels, regardless of admin status
          allChannels.push({
            id: channelId,
            title: (entity as any).title || "Unknown Channel",
            username: (entity as any).username,
            memberCount: (entity as any).participantsCount || 0,
            isAdmin: isAdmin,
          });

        } catch (error) {
          console.error(`Error processing channel ${dialog.entity?.id}:`, error);
        }
      }
    }

    console.log(`Found ${allChannels.length} channels total (admin: ${allChannels.filter(c => c.isAdmin).length}, member: ${allChannels.filter(c => !c.isAdmin).length})`);
    return allChannels.sort((a, b) => b.memberCount - a.memberCount); // Sort by member count
  }

  async addMembersToChannel(
    client: TelegramClient,
    channelId: string,
    userIds: string[],
    onProgress?: (added: number, failed: number, current: string) => void
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    try {
      // Ensure client is connected
      if (!client.connected) {
        console.log("Client disconnected, attempting to reconnect...");
        await client.connect();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for connection
      }

      const channel = await client.getEntity(channelId);

      for (const userId of userIds) {
        try {
          // Check connection before each operation
          if (!client.connected) {
            console.log("Client disconnected during operation, attempting to reconnect...");
            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          let userEntity;
          
          // Enhanced entity resolution with multiple fallback strategies
          userEntity = await this.resolveUserEntity(client, userId);
          
          if (!userEntity) {
            throw new Error(`Could not resolve user entity for ${userId} - user may not be accessible`);
          }
          
          // Enhanced invitation method with fallback strategies
          await this.inviteUserToChannel(client, channel, userEntity);
          
          successful++;
          console.log(`Successfully added user ${userId} to channel`);
          onProgress?.(successful, failed, userId);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Failed to add user ${userId}: ${errorMessage}`);
          
          // Handle flood wait errors specifically
          if (errorMessage.includes('FloodWaitError') || errorMessage.includes('FLOOD_WAIT')) {
            const waitMatch = errorMessage.match(/(\d+) seconds/);
            if (waitMatch) {
              const waitSeconds = parseInt(waitMatch[1]);
              console.log(`Flood wait detected, pausing for ${waitSeconds} seconds...`);
              await new Promise(resolve => setTimeout(resolve, (waitSeconds + 5) * 1000));
            }
          }
          
          failed++;
          onProgress?.(successful, failed, userId);
        }

        // Increased delay to prevent rate limiting (3-5 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      }
    } catch (error) {
      console.error("Critical error in addMembersToChannel:", error);
    }

    return { successful, failed };
  }

  private async resolveUserEntity(client: TelegramClient, userId: string) {
    const { Api } = await import("telegram/tl");
    
    // Multiple strategies to resolve user entity with improved numeric ID handling
    const strategies = [
      // Strategy 1: Direct ID lookup with proper conversion
      async () => {
        if (/^\d+$/.test(userId)) {
          try {
            // Try as string first
            return await client.getEntity(userId);
          } catch (error1) {
            try {
              // Try as integer
              return await client.getEntity(parseInt(userId));
            } catch (error2) {
              try {
                // Try via InputUser for numeric IDs
                const { Api } = await import("telegram/tl");
                const users = await client.invoke(new Api.users.GetUsers({
                  id: [userId]
                }));
                return Array.isArray(users) ? users[0] : users;
              } catch (error3) {
                return null;
              }
            }
          }
        }
        return null;
      },
      
      // Strategy 2: Username lookup
      async () => {
        if (userId.startsWith('@') || /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(userId)) {
          const username = userId.startsWith('@') ? userId.slice(1) : userId;
          return await client.getEntity(`@${username}`);
        }
        return null;
      },
      
      // Strategy 3: Search in contacts
      async () => {
        const contacts = await client.invoke(new Api.contacts.GetContacts({}));
        if ('users' in contacts) {
          const user = contacts.users.find((u: any) => 
            u.id.toString() === userId || 
            u.username === userId.replace('@', '') ||
            u.phone === userId
          );
          if (user) {
            return await client.getEntity(user.id);
          }
        }
        return null;
      },
      
      // Strategy 4: Search in dialogs/chats
      async () => {
        const dialogs = await client.getDialogs({ limit: 200 });
        for (const dialog of dialogs) {
          if (dialog.isUser && dialog.entity) {
            const entity = dialog.entity as any;
            if (entity.id.toString() === userId || 
                entity.username === userId.replace('@', '') ||
                entity.phone === userId) {
              return entity;
            }
          }
        }
        return null;
      },
      
      // Strategy 5: Try resolving through peer resolution
      async () => {
        if (/^\d+$/.test(userId)) {
          try {
            const users = await client.invoke(new Api.users.GetUsers({
              id: [userId]
            }));
            return Array.isArray(users) ? users[0] : users;
          } catch (error) {
            return null;
          }
        }
        return null;
      }
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        if (result) {
          console.log(`User entity found using strategy ${i + 1} for ${userId}`);
          return Array.isArray(result) ? result[0] : result;
        }
      } catch (error: any) {
        console.log(`Strategy ${i + 1} failed for ${userId}:`, error.message);
        continue;
      }
    }
    
    console.log(`All strategies failed for user: ${userId}`);
    return null;
  }

  private async inviteUserToChannel(client: TelegramClient, channel: any, userEntity: any) {
    const { Api } = await import("telegram/tl");
    
    // Get the channel entity to determine its type
    const channelEntity = await client.getEntity(channel.id || channel);
    
    // Try multiple invitation methods with improved numeric ID handling
    const methods = [
      // Method 1: Standard channel invitation (for channels/supergroups)
      async () => {
        return await client.invoke(new Api.channels.InviteToChannel({
          channel: channelEntity,
          users: [userEntity],
        }));
      },
      
      // Method 2: Add chat user with proper channel ID handling
      async () => {
        // For numeric IDs, ensure proper conversion
        let chatId = channelEntity.id;
        if (typeof chatId === 'object' && chatId.toString) {
          chatId = chatId.toString();
        }
        
        return await client.invoke(new Api.messages.AddChatUser({
          chatId: parseInt(chatId.toString()),
          userId: userEntity,
          fwdLimit: 100,
        }));
      },
      
      // Method 3: Edit chat admin for adding users with permissions
      async () => {
        return await client.invoke(new Api.channels.EditBanned({
          channel: channelEntity,
          participant: userEntity,
          bannedRights: new Api.ChatBannedRights({
            viewMessages: false,
            sendMessages: false,
            sendMedia: false,
            sendStickers: false,
            sendGifs: false,
            sendGames: false,
            sendInline: false,
            embedLinks: false,
            untilDate: 0,
          }),
        }));
      }
    ];

    let lastError;
    for (let i = 0; i < methods.length; i++) {
      try {
        await methods[i]();
        return; // Success
      } catch (error: any) {
        lastError = error;
        console.log(`Invitation method ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    throw lastError || new Error('All invitation methods failed');
  }

  async getUserInfo(client: TelegramClient) {
    const me = await client.getMe();
    return {
      id: me.id.toString(),
      firstName: me.firstName,
      lastName: me.lastName,
      username: me.username,
      phone: me.phone,
    };
  }

  async getChannelMembers(client: TelegramClient, channelId: string, limit: number = 2000): Promise<string[]> {
    try {
      // Ensure client is connected
      if (!client.connected) {
        console.log("Client not connected, attempting to connect...");
        await client.connect();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const memberUsernames = new Set<string>();
      
      console.log(`Getting members from channel ${channelId} with limit ${limit}...`);
      
      try {
        const channel = await client.getEntity(channelId);
        let allParticipants: any[] = [];
        
        // Strategy 1: Try to get all participants in chunks to avoid API limits
        try {
          const chunkSize = 200; // Telegram's safe limit per request
          const totalChunks = Math.ceil(limit / chunkSize);
          
          for (let i = 0; i < totalChunks; i++) {
            const offset = i * chunkSize;
            const currentLimit = Math.min(chunkSize, limit - offset);
            
            console.log(`Fetching chunk ${i + 1}/${totalChunks} (offset: ${offset}, limit: ${currentLimit})`);
            
            try {
              const participants = await client.getParticipants(channel, { 
                limit: currentLimit,
                offset: offset
              });
              
              if (participants.length === 0) {
                console.log("No more participants found, stopping");
                break;
              }
              
              allParticipants.push(...participants);
              console.log(`Chunk ${i + 1}: Found ${participants.length} participants (total: ${allParticipants.length})`);
              
              // If we got fewer participants than requested, we've reached the end
              if (participants.length < currentLimit) {
                console.log("Reached end of participant list");
                break;
              }
              
              // Add delay between chunks to avoid rate limiting
              if (i < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
              
            } catch (chunkError: any) {
              console.log(`Chunk ${i + 1} failed:`, chunkError.message);
              // If this chunk fails, try to continue with what we have
              break;
            }
          }
          
        } catch (error: any) {
          console.log("Chunked approach failed, trying single request:", error.message);
          
          // Fallback: Try single request with smaller limit
          const participants = await client.getParticipants(channel, { 
            limit: Math.min(limit, 200)
          });
          allParticipants = participants;
        }
        
        console.log(`Total participants retrieved: ${allParticipants.length}`);
        
        if (allParticipants.length === 0) {
          throw new Error("No participants found in this channel");
        }
        
        // Count users with usernames vs without
        let usersWithUsernames = 0;
        let usersWithoutUsernames = 0;
        
        allParticipants.forEach((user: any) => {
          if (user.username) {
            usersWithUsernames++;
          } else {
            usersWithoutUsernames++;
          }
        });
        
        console.log(`Users with usernames: ${usersWithUsernames}, Users without usernames: ${usersWithoutUsernames}`);
        
        // Extract member identifiers
        allParticipants.forEach((user: any) => {
          if (user.id) {
            // Prefer username format for better success rates, fallback to numeric ID
            if (user.username) {
              memberUsernames.add(`@${user.username}`);
            } else {
              // Only add numeric ID if no username exists
              memberUsernames.add(user.id.toString());
            }
          }
        });
        
        const result = Array.from(memberUsernames);
        console.log(`Extracted ${result.length} unique member identifiers from channel`);
        return result;
        
      } catch (error: any) {
        console.error("Error getting channel participants:", error);
        
        // Handle specific error types with helpful messages
        if (error.message?.includes('CHAT_ADMIN_REQUIRED')) {
          throw new Error(`Admin permissions required to view members of this channel. You need to be an admin to extract members from this channel.`);
        } else if (error.message?.includes('CHANNEL_PRIVATE')) {
          throw new Error(`This is a private channel. You may not have access to view its members.`);
        } else if (error.message?.includes('CHAT_ID_INVALID')) {
          throw new Error(`Invalid channel ID. Please make sure you selected a valid channel.`);
        } else {
          throw new Error(`Cannot access members of this channel. You may not have sufficient permissions or the channel may be restricted.`);
        }
      }
      
    } catch (error) {
      console.error("Error getting channel members:", error);
      throw error;
    }
  }

  async getAccessibleContacts(client: TelegramClient): Promise<string[]> {
    try {
      // Ensure client is connected
      if (!client.connected) {
        console.log("Client not connected, attempting to connect...");
        await client.connect();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const accessibleUsers = new Set<string>();
      const { Api } = await import("telegram/tl");
      
      console.log("Starting to collect accessible contacts...");
      
      // Method 1: Get direct contacts
      try {
        console.log("Getting direct contacts...");
        const contacts = await client.invoke(new Api.contacts.GetContacts({
          hash: 0
        }));
        
        if ('users' in contacts && Array.isArray(contacts.users)) {
          contacts.users.forEach((user: any) => {
            if (user.id) {
              accessibleUsers.add(user.id.toString());
              if (user.username) {
                accessibleUsers.add(`@${user.username}`);
              }
            }
          });
          console.log(`Found ${contacts.users.length} direct contacts`);
        }
      } catch (error) {
        console.log("Could not get contacts:", error);
      }
      
      // Method 2: Get users from recent dialogs
      try {
        console.log("Getting users from dialogs...");
        const dialogs = await client.getDialogs({ limit: 100 });
        let dialogUsers = 0;
        
        for (const dialog of dialogs) {
          if (dialog.isUser && dialog.entity) {
            const entity = dialog.entity as any;
            if (entity.id) {
              accessibleUsers.add(entity.id.toString());
              if (entity.username) {
                accessibleUsers.add(`@${entity.username}`);
              }
              dialogUsers++;
            }
          }
        }
        console.log(`Found ${dialogUsers} users from dialogs`);
      } catch (error) {
        console.log("Could not get dialogs:", error);
      }
      
      // Method 3: Get participants from a few groups (limited to prevent timeouts)
      try {
        console.log("Getting users from group participants...");
        const dialogs = await client.getDialogs({ limit: 10 }); // Reduced limit
        let groupUsers = 0;
        
        for (const dialog of dialogs) {
          if ((dialog.isGroup || dialog.isChannel) && dialog.entity) {
            try {
              const participants = await client.getParticipants(dialog.entity!, { limit: 50 }); // Reduced limit
              participants.forEach((user: any) => {
                if (user.id) {
                  accessibleUsers.add(user.id.toString());
                  if (user.username) {
                    accessibleUsers.add(`@${user.username}`);
                  }
                  groupUsers++;
                }
              });
            } catch (error) {
              // Skip groups where we can't get participants
              continue;
            }
          }
        }
        console.log(`Found ${groupUsers} users from groups`);
      } catch (error) {
        console.log("Could not get group participants:", error);
      }
      
      const result = Array.from(accessibleUsers);
      console.log(`Total accessible contacts collected: ${result.length}`);
      return result;
      
    } catch (error) {
      console.error("Error getting accessible contacts:", error);
      return [];
    }
  }

  async validateUserIds(client: TelegramClient, userIds: string[]): Promise<{
    accessible: string[];
    inaccessible: string[];
    total: number;
  }> {
    const accessible: string[] = [];
    const inaccessible: string[] = [];
    
    for (const userId of userIds) {
      try {
        const entity = await this.resolveUserEntity(client, userId);
        if (entity) {
          accessible.push(userId);
        } else {
          inaccessible.push(userId);
        }
      } catch (error) {
        inaccessible.push(userId);
      }
    }
    
    return {
      accessible,
      inaccessible,
      total: userIds.length
    };
  }

  disconnectClient(telegramAccountId: number) {
    const client = this.clients.get(telegramAccountId);
    if (client) {
      client.disconnect();
      this.clients.delete(telegramAccountId);
    }
  }
}

export const telegramService = new TelegramService();
