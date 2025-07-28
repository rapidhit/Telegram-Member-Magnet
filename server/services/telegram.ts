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
          
          // Skip admin check entirely for speed - assume not admin unless proven otherwise
          // Include ALL channels, regardless of admin status
          allChannels.push({
            id: channelId,
            title: (entity as any).title || "Unknown Channel",
            username: (entity as any).username,
            memberCount: (entity as any).participantsCount || 0,
            isAdmin: false, // Set to false for speed, admin check can be done later if needed
          });

        } catch (error) {
          console.error(`Error processing channel ${dialog.entity?.id}:`, error);
        }
      }
    }

    console.log(`Found ${allChannels.length} channels total`);
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
    
    // Enhanced strategies prioritizing high-success methods
    const strategies = [
      // Strategy 1: Username resolution (highest success rate)
      async () => {
        if (userId.startsWith('@') || /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(userId)) {
          const username = userId.startsWith('@') ? userId.slice(1) : userId;
          try {
            const entity = await client.getEntity(`@${username}`);
            console.log(`✓ Username resolution success for @${username}`);
            return entity;
          } catch (error) {
            // Try without @ prefix
            try {
              const entity = await client.getEntity(username);
              console.log(`✓ Username resolution success for ${username} (no @)`);
              return entity;
            } catch (error2) {
              return null;
            }
          }
        }
        return null;
      },
      
      // Strategy 2: Contact lookup (very reliable for mutual contacts)
      async () => {
        try {
          const contacts = await client.invoke(new Api.contacts.GetContacts({ hash: 0 }));
          if ('users' in contacts && Array.isArray(contacts.users)) {
            const user = contacts.users.find((u: any) => {
              const cleanUserId = userId.replace('@', '');
              return u.id.toString() === cleanUserId || 
                     u.username === cleanUserId ||
                     u.phone === cleanUserId ||
                     `@${u.username}` === userId;
            });
            if (user) {
              console.log(`✓ Contact resolution success for ${userId}`);
              return user;
            }
          }
        } catch (error) {
          console.log(`Contact lookup failed for ${userId}:`, error);
        }
        return null;
      },

      // Strategy 3: Recent dialog search (for users you've messaged)
      async () => {
        try {
          const dialogs = await client.getDialogs({ limit: 100 });
          for (const dialog of dialogs) {
            if (dialog.isUser && dialog.entity) {
              const entity = dialog.entity as any;
              const cleanUserId = userId.replace('@', '');
              if (entity.id.toString() === cleanUserId || 
                  entity.username === cleanUserId ||
                  entity.phone === cleanUserId) {
                console.log(`✓ Dialog search success for ${userId}`);
                return entity;
              }
            }
          }
        } catch (error) {
          console.log(`Dialog search failed for ${userId}:`, error);
        }
        return null;
      },

      // Strategy 4: Enhanced numeric ID resolution
      async () => {
        if (/^\d+$/.test(userId)) {
          const approaches = [
            // Try direct entity lookup
            async () => await client.getEntity(parseInt(userId)),
            async () => await client.getEntity(userId),
            
            // Try InputUser approach
            async () => {
              const users = await client.invoke(new Api.users.GetUsers({
                id: [userId]
              }));
              return Array.isArray(users) ? users[0] : users;
            },
            
            // Try PeerUser approach
            async () => await client.getEntity(new Api.PeerUser({ userId: userId })),
            
            // Try through GetFullUser
            async () => {
              const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
              }));
              return fullUser.users?.[0];
            }
          ];
          
          for (let i = 0; i < approaches.length; i++) {
            try {
              const result = await approaches[i]();
              if (result) {
                console.log(`✓ Numeric ID resolution success for ${userId} (approach ${i + 1})`);
                return result;
              }
            } catch (error) {
              continue;
            }
          }
        }
        return null;
      },

      // Strategy 5: Channel participant search (for users in shared channels)
      async () => {
        try {
          const dialogs = await client.getDialogs({ limit: 20 });
          for (const dialog of dialogs) {
            if ((dialog.isChannel || dialog.isGroup) && dialog.entity) {
              try {
                const participants = await client.getParticipants(dialog.entity, { limit: 100 });
                const user = participants.find((p: any) => {
                  const cleanUserId = userId.replace('@', '');
                  return p.id.toString() === cleanUserId || 
                         p.username === cleanUserId ||
                         `@${p.username}` === userId;
                });
                if (user) {
                  console.log(`✓ Channel participant resolution success for ${userId} in ${dialog.title}`);
                  return user;
                }
              } catch (error) {
                continue;
              }
            }
          }
        } catch (error) {
          console.log(`Channel participant search failed for ${userId}:`, error);
        }
        return null;
      }
    ];

    // Try each strategy with better error handling
    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        if (result) {
          const finalResult = Array.isArray(result) ? result[0] : result;
          console.log(`✓ Successfully resolved ${userId} using strategy ${i + 1}`);
          return finalResult;
        }
        // Small delay between strategies to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error: any) {
        console.log(`Strategy ${i + 1} failed for ${userId}:`, error.message);
        continue;
      }
    }
    
    console.log(`✗ All resolution strategies failed for user: ${userId}`);
    return null;
  }

  private async inviteUserToChannel(client: TelegramClient, channel: any, userEntity: any) {
    const { Api } = await import("telegram/tl");
    
    // Get the channel entity to determine its type
    const channelEntity = await client.getEntity(channel.id || channel);
    
    // Enhanced invitation methods prioritizing success rate
    const methods = [
      // Method 1: Standard channel invitation (highest success for supergroups/channels)
      async () => {
        try {
          const result = await client.invoke(new Api.channels.InviteToChannel({
            channel: channelEntity,
            users: [userEntity],
          }));
          console.log(`✓ Standard channel invitation successful`);
          return result;
        } catch (error: any) {
          console.log(`Standard invitation failed: ${error.message}`);
          throw error;
        }
      },
      
      // Method 2: Username-based invitation (if user has username) 
      async () => {
        if (userEntity.username) {
          try {
            const usernameEntity = await client.getEntity(`@${userEntity.username}`);
            const result = await client.invoke(new Api.channels.InviteToChannel({
              channel: channelEntity,
              users: [usernameEntity],
            }));
            console.log(`✓ Username-based invitation successful for @${userEntity.username}`);
            return result;
          } catch (error: any) {
            console.log(`Username invitation failed: ${error.message}`);
            throw error;
          }
        } else {
          throw new Error("User has no username");
        }
      },
      
      // Method 3: Contact-based invitation (for mutual contacts)
      async () => {
        try {
          // First check if user is in contacts
          const contacts = await client.invoke(new Api.contacts.GetContacts({ hash: 0 }));
          let contactUser = null;
          
          if ('users' in contacts && Array.isArray(contacts.users)) {
            contactUser = contacts.users.find((u: any) => 
              u.id.toString() === userEntity.id.toString() ||
              u.username === userEntity.username
            );
          }
          
          if (contactUser) {
            const result = await client.invoke(new Api.channels.InviteToChannel({
              channel: channelEntity,
              users: [contactUser],
            }));
            console.log(`✓ Contact-based invitation successful`);
            return result;
          } else {
            throw new Error("User not in contacts");
          }
        } catch (error: any) {
          console.log(`Contact invitation failed: ${error.message}`);
          throw error;
        }
      },
      
      // Method 4: Enhanced direct user invitation with fresh entity
      async () => {
        try {
          // Re-resolve the user entity to ensure fresh data
          let freshUserEntity = userEntity;
          if (userEntity.username) {
            freshUserEntity = await client.getEntity(`@${userEntity.username}`);
          } else if (userEntity.id) {
            freshUserEntity = await client.getEntity(userEntity.id);
          }
          
          const result = await client.invoke(new Api.channels.InviteToChannel({
            channel: channelEntity,
            users: [freshUserEntity],
          }));
          console.log(`✓ Fresh entity invitation successful`);
          return result;
        } catch (error: any) {
          console.log(`Fresh entity invitation failed: ${error.message}`);
          throw error;
        }
      }
    ];

    let lastError = null;
    
    // Try each method with proper error handling
    for (let i = 0; i < methods.length; i++) {
      try {
        const result = await methods[i]();
        console.log(`✓ Successfully invited user using method ${i + 1}`);
        return result;
      } catch (error: any) {
        lastError = error;
        console.log(`Method ${i + 1} failed: ${error.message}`);
        
        // Skip remaining methods for certain unrecoverable errors
        if (error.message.includes('USER_PRIVACY_RESTRICTED') || 
            error.message.includes('USER_BLOCKED') ||
            error.message.includes('USER_DEACTIVATED') ||
            error.message.includes('USER_BOT')) {
          console.log(`Unrecoverable error for user, stopping attempts`);
          throw error;
        }
        
        // Add small delay between methods to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
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

  async getChannelMembers(client: TelegramClient, channelId: string, limit: number = 1000): Promise<string[]> {
    try {
      // Ensure client is connected
      if (!client.connected) {
        console.log("Client not connected, attempting to connect...");
        await client.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const memberUsernames = new Set<string>();
      
      console.log(`Getting members from channel ${channelId} with limit ${limit}...`);
      
      try {
        const channel = await client.getEntity(channelId);
        let allParticipants: any[] = [];
        
        // Optimized strategy: Use larger chunks and minimal delays for speed
        try {
          const chunkSize = Math.min(500, limit); // Larger chunks for speed
          const maxChunks = Math.ceil(Math.min(limit, 5000) / chunkSize); // Cap total requests
          
          for (let i = 0; i < maxChunks; i++) {
            const offset = i * chunkSize;
            const currentLimit = Math.min(chunkSize, limit - offset);
            
            console.log(`Fetching chunk ${i + 1}/${maxChunks} (offset: ${offset}, limit: ${currentLimit})`);
            
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
              
              // Minimal delay for speed - only 500ms between chunks
              if (i < maxChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
            } catch (chunkError: any) {
              console.log(`Chunk ${i + 1} failed:`, chunkError.message);
              // If this chunk fails, try to continue with what we have
              break;
            }
          }
          
        } catch (error: any) {
          console.log("Chunked approach failed, trying single request:", error.message);
          
          // Fallback: Try single request with reasonable limit
          const participants = await client.getParticipants(channel, { 
            limit: Math.min(limit, 500)
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
