import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
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
        await client.invoke(
          new (await import("telegram/tl")).Api.channels.InviteToChannel({
            channel: channel,
            users: [userId],
          })
        );
        successful++;
        onProgress?.(successful, failed, userId);
      } catch (error) {
        console.error(`Failed to add user ${userId}:`, error);
        failed++;
        onProgress?.(successful, failed, userId);
      }

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { successful, failed };
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

  disconnectClient(telegramAccountId: number) {
    const client = this.clients.get(telegramAccountId);
    if (client) {
      client.disconnect();
      this.clients.delete(telegramAccountId);
    }
  }
}

export const telegramService = new TelegramService();
