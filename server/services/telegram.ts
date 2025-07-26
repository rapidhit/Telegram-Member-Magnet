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

  async addMembersToChannel(
    client: TelegramClient,
    channelId: string,
    userIds: string[],
    onProgress?: (added: number, failed: number, current: string) => void
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    const channel = await client.getEntity(channelId);

    for (const userId of userIds) {
      try {
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
        
        failed++;
        onProgress?.(successful, failed, userId);
      }

      // Add delay to prevent rate limiting (1-2 seconds)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }

    return { successful, failed };
  }

  private async resolveUserEntity(client: TelegramClient, userId: string) {
    const strategies = [
      // Strategy 1: Direct entity resolution
      async () => {
        if (userId.startsWith('@')) {
          return await client.getEntity(userId);
        } else if (/^\d+$/.test(userId)) {
          return await client.getEntity(parseInt(userId));
        } else {
          return await client.getEntity(userId);
        }
      },
      
      // Strategy 2: Try with different formats
      async () => {
        if (userId.startsWith('@')) {
          const username = userId.substring(1);
          return await client.getEntity(username);
        } else if (/^\d+$/.test(userId)) {
          return await client.getEntity(userId);
        } else {
          return await client.getEntity(`@${userId}`);
        }
      },
      
      // Strategy 3: Search in contacts
      async () => {
        const { Api } = await import("telegram/tl");
        const contacts = await client.invoke(new Api.contacts.GetContacts({}));
        if ('users' in contacts) {
          const user = contacts.users.find((u: any) => 
            u.id.toString() === userId || 
            u.username === userId.replace('@', '') ||
            u.phone === userId
          );
          return user ? await client.getEntity(user.id) : null;
        }
        return null;
      },
      
      // Strategy 4: Search in dialogs/chats
      async () => {
        const dialogs = await client.getDialogs({ limit: 100 });
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
      }
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) return result;
      } catch (error) {
        // Try next strategy
        continue;
      }
    }
    
    return null;
  }

  private async inviteUserToChannel(client: TelegramClient, channel: any, userEntity: any) {
    const { Api } = await import("telegram/tl");
    
    // Try multiple invitation methods
    const methods = [
      // Method 1: Standard channel invitation
      async () => {
        return await client.invoke(new Api.channels.InviteToChannel({
          channel: channel,
          users: [userEntity],
        }));
      },
      
      // Method 2: Add chat user (for groups)
      async () => {
        return await client.invoke(new Api.messages.AddChatUser({
          chatId: channel.id,
          userId: userEntity,
          fwdLimit: 100,
        }));
      }
    ];

    let lastError;
    for (const method of methods) {
      try {
        await method();
        return; // Success
      } catch (error) {
        lastError = error;
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

  async getAccessibleContacts(client: TelegramClient): Promise<string[]> {
    try {
      const accessibleUsers = new Set<string>();
      const { Api } = await import("telegram/tl");
      
      // Method 1: Get direct contacts
      try {
        const contacts = await client.invoke(new Api.contacts.GetContacts({}));
        if ('users' in contacts) {
          contacts.users.forEach((user: any) => {
            accessibleUsers.add(user.id.toString());
            if (user.username) {
              accessibleUsers.add(`@${user.username}`);
            }
          });
        }
      } catch (error) {
        console.log("Could not get contacts:", error);
      }
      
      // Method 2: Get users from recent dialogs
      try {
        const dialogs = await client.getDialogs({ limit: 200 });
        for (const dialog of dialogs) {
          if (dialog.isUser && dialog.entity) {
            const entity = dialog.entity as any;
            accessibleUsers.add(entity.id.toString());
            if (entity.username) {
              accessibleUsers.add(`@${entity.username}`);
            }
          }
        }
      } catch (error) {
        console.log("Could not get dialogs:", error);
      }
      
      // Method 3: Get participants from groups (potential mutual contacts)
      try {
        const dialogs = await client.getDialogs({ limit: 50 });
        for (const dialog of dialogs) {
          if (dialog.isGroup || dialog.isChannel) {
            try {
              const participants = await client.getParticipants(dialog.entity, { limit: 100 });
              participants.forEach((user: any) => {
                accessibleUsers.add(user.id.toString());
                if (user.username) {
                  accessibleUsers.add(`@${user.username}`);
                }
              });
            } catch (error) {
              // Skip groups where we can't get participants
              continue;
            }
          }
        }
      } catch (error) {
        console.log("Could not get group participants:", error);
      }
      
      return Array.from(accessibleUsers);
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
