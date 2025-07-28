import { TelegramClient, StringSession, NewMessage, Api } from "../utils/telegramImports";
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
  private channelCache: Map<number, { channels: TelegramChannel[], lastUpdated: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

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

  async getAdminChannels(client: TelegramClient, telegramAccountId?: number): Promise<TelegramChannel[]> {
    // Check cache first if telegramAccountId is provided
    if (telegramAccountId) {
      const cached = this.channelCache.get(telegramAccountId);
      if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
        console.log(`Returning ${cached.channels.length} cached channels for account ${telegramAccountId}`);
        return cached.channels;
      }
    }

    console.log("Loading channels from Telegram API...");
    const dialogs = await client.getDialogs();
    const adminChannels: TelegramChannel[] = [];
    const me = await client.getMe();

    console.log(`Processing ${dialogs.length} dialogs for accessible channels...`);

    // Filter to channels and supergroups only - no need for API calls yet
    const channelDialogs = dialogs.filter(d => d.isChannel && d.entity);
    
    for (const dialog of channelDialogs) {
      try {
        const entity = dialog.entity;
        if (!entity) continue;
        
        const channelId = entity.id.toString();
        
        // Use available entity properties without making additional API calls
        let isAdmin = false;
        
        // Check basic admin indicators from entity properties
        if ((entity as any).adminRights || 
            (entity as any).creatorId?.equals?.(me.id) ||
            (entity as any).creator === true) {
          isAdmin = true;
        }

        // Include all channels user is part of - they can potentially extract members
        // Even without admin rights, users can still see channel members in many cases
        adminChannels.push({
          id: channelId,
          title: (entity as any).title || "Unknown Channel",
          username: (entity as any).username,
          memberCount: (entity as any).participantsCount || 0,
          isAdmin,
        });
        
      } catch (error) {
        console.error(`Error processing channel:`, error);
      }
    }

    console.log(`Found ${adminChannels.length} accessible channels out of ${channelDialogs.length} total channels`);
    
    // Cache the results if telegramAccountId is provided
    if (telegramAccountId) {
      this.channelCache.set(telegramAccountId, {
        channels: adminChannels,
        lastUpdated: Date.now()
      });
    }

    return adminChannels;
  }

  // Method to clear cache when needed
  clearChannelCache(telegramAccountId?: number): void {
    if (telegramAccountId) {
      this.channelCache.delete(telegramAccountId);
    } else {
      this.channelCache.clear();
    }
  }

  // Method to check if channels are cached
  isCached(telegramAccountId: number): boolean {
    const cached = this.channelCache.get(telegramAccountId);
    return cached !== undefined && Date.now() - cached.lastUpdated < this.CACHE_DURATION;
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
        await new Promise(resolve => setTimeout(resolve, 2000));
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
          
          // Enhanced user resolution with debugging
          userEntity = await this.resolveUserEntity(client, userId);
          
          if (!userEntity) {
            throw new Error(`Could not resolve user entity for ${userId}`);
          }
          
          // Add user to channel with multiple methods
          await this.inviteUserToChannel(client, channel, userEntity);
          
          // Success - user was added
          successful++;
          console.log(`✓ Added user ${userId} to channel`);
          onProgress?.(successful, failed, userId);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`✗ FAILED to add user ${userId}: ${errorMessage}`);
          
          // Handle severe rate limits - stop trying if wait time is too long
          if (errorMessage.includes('FloodWaitError') || errorMessage.includes('FLOOD_WAIT') || errorMessage.includes('A wait of')) {
            const waitMatch = errorMessage.match(/(\d+) seconds/);
            if (waitMatch) {
              const waitSeconds = parseInt(waitMatch[1]);
              
              // If rate limit is over 5 minutes, stop the process
              if (waitSeconds > 300) {
                console.log(`Rate limit too long: ${waitSeconds} seconds. Stopping.`);
                throw new Error(`Rate limit: ${waitSeconds} seconds wait required.`);
              }
              
              console.log(`Waiting ${waitSeconds} seconds for rate limit...`);
              await new Promise(resolve => setTimeout(resolve, (waitSeconds + 5) * 1000));
            }
          }
          
          failed++;
          onProgress?.(successful, failed, userId);
        }

        // Short delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      }
      
      console.log(`Processing complete: ${successful} added, ${failed} failed out of ${userIds.length} total`);
      
    } catch (error) {
      console.error("Critical error in addMembersToChannel:", error);
    }

    console.log(`Final result: ${successful} users added, ${failed} failed`);
    return { successful, failed };
  }

  private async resolveUserEntity(client: TelegramClient, userId: string) {
    const { Api } = await import("telegram/tl");
    
    try {
      let cleanUserId = userId.trim();
      
      // Remove @ if present
      if (cleanUserId.startsWith('@')) {
        cleanUserId = cleanUserId.substring(1);
      }
      
      // Strategy 1: Direct entity lookup
      try {
        return await client.getEntity(cleanUserId);
      } catch (error) {
        // Strategy 2: Try with @ prefix
        try {
          return await client.getEntity('@' + cleanUserId);
        } catch (error2) {
          // Strategy 3: For numeric IDs
          if (/^\d+$/.test(cleanUserId)) {
            try {
              return await client.getEntity(parseInt(cleanUserId));
            } catch (error3) {
              // Strategy 4: Try BigInt for large IDs
              try {
                return await client.getEntity(BigInt(cleanUserId));
              } catch (error4) {
                // Strategy 5: Search for user
                try {
                  const searchResult = await client.invoke(new Api.contacts.Search({
                    q: cleanUserId,
                    limit: 10,
                  }));
                  
                  if (searchResult.users && searchResult.users.length > 0) {
                    return searchResult.users[0];
                  }
                } catch (searchError) {
                  // All strategies failed
                  return null;
                }
              }
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async inviteUserToChannel(client: TelegramClient, channel: any, userEntity: any) {
    const { Api } = await import("telegram/tl");
    
    try {
      // Direct channel invitation - most reliable method
      await client.invoke(new Api.channels.InviteToChannel({
        channel: channel,
        users: [userEntity],
      }));
      return true;
    } catch (error) {
      // If that fails, the user couldn't be added for legitimate reasons
      throw error;
    }
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
    const memberUsernames = new Set<string>();
    
    try {
      // Ensure client is connected with retry logic
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!client.connected) {
          console.log(`Client connection attempt ${attempt + 1}...`);
          try {
            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          } catch (connectError) {
            console.log(`Connection attempt ${attempt + 1} failed:`, connectError);
            if (attempt === 2) throw new Error("Failed to connect to Telegram after 3 attempts");
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } else {
          break;
        }
      }

      console.log(`Getting members from channel ${channelId}...`);
      
      try {
        const channel = await client.getEntity(channelId);
        let allParticipants: any[] = [];
        
        // Method 1: Progressive pagination to get all members
        try {
          console.log(`Starting progressive member extraction for up to ${limit} members...`);
          const maxLimit = Math.min(limit, 100000); // Support up to 100k members
          let offset = 0;
          const batchSize = 200;
          let consecutiveFailures = 0;
          const maxConsecutiveFailures = 3;
          
          while (allParticipants.length < maxLimit && consecutiveFailures < maxConsecutiveFailures) {
            try {
              const participants = await client.getParticipants(channel, { 
                limit: batchSize, 
                offset: offset 
              });
              
              if (participants.length === 0) {
                console.log(`No more participants found at offset ${offset}`);
                break;
              }
              
              allParticipants.push(...participants);
              offset += participants.length;
              consecutiveFailures = 0; // Reset failure counter on success
              
              // Log progress every 1000 members for large extractions
              if (allParticipants.length % 1000 === 0 || participants.length < batchSize) {
                console.log(`Progress: ${allParticipants.length} members extracted (${Math.round((allParticipants.length / maxLimit) * 100)}% of target)`);
              }
              
              // If we got fewer than requested, we've reached the end
              if (participants.length < batchSize) {
                console.log("Reached end of member list");
                break;
              }
              
              // Dynamic rate limiting based on extraction size
              const delay = maxLimit > 10000 ? 800 : 1000; // Faster for large extractions
              await new Promise(resolve => setTimeout(resolve, delay));
              
            } catch (batchError: any) {
              consecutiveFailures++;
              console.log(`Batch at offset ${offset} failed (failure ${consecutiveFailures}/${maxConsecutiveFailures}):`, batchError.message);
              
              // Handle specific errors
              if (batchError.message?.includes('ChatAdminRequiredError') || batchError.message?.includes('CHAT_ADMIN_REQUIRED')) {
                throw new Error("You need admin permissions to view members of this channel");
              }
              
              if (batchError.message?.includes('ChannelPrivateError') || batchError.message?.includes('CHANNEL_PRIVATE')) {
                throw new Error("This channel is private and members cannot be accessed");
              }
              
              if (batchError.message?.includes('FloodWaitError') || batchError.message?.includes('FLOOD')) {
                const waitMatch = batchError.message.match(/(\d+) seconds/);
                const waitTime = waitMatch ? parseInt(waitMatch[1]) : 300;
                console.log(`Hit rate limit, waiting ${waitTime} seconds...`);
                
                if (waitTime > 600) {
                  console.log("Rate limit too long, stopping extraction");
                  break;
                }
                
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                consecutiveFailures = 0; // Reset after waiting
                continue;
              }
              
              // For other errors, advance offset and try to continue
              offset += batchSize;
              if (offset > maxLimit || consecutiveFailures >= maxConsecutiveFailures) break;
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          console.log(`Method 1: Found ${allParticipants.length} total participants`);
          
        } catch (error: any) {
          console.log("Method 1 failed:", error.message);
          
          // If permission error, provide helpful message
          if (error.message?.includes('ChatAdminRequiredError') || error.message?.includes('CHAT_ADMIN_REQUIRED')) {
            throw new Error("You need admin permissions to view members of this channel");
          }
          
          if (error.message?.includes('ChannelPrivateError') || error.message?.includes('CHANNEL_PRIVATE')) {
            throw new Error("This channel is private and members cannot be accessed");
          }
        }
        
        // Method 2: Fallback if pagination failed
        if (allParticipants.length === 0) {
          try {
            console.log("Trying fallback single request...");
            const participants = await client.getParticipants(channel, { limit: 1000 });
            allParticipants = [...participants];
            console.log(`Method 2: Found ${participants.length} participants via fallback`);
          } catch (error: any) {
            console.log("Method 2 failed:", error.message);
          }
        }
        
        if (allParticipants.length === 0) {
          throw new Error("No members found. This might be due to channel privacy settings or insufficient permissions.");
        }
        
        console.log(`Total participants found: ${allParticipants.length}`);
        
        // Extract REAL member identifiers with strict validation
        let usersWithUsernames = 0;
        let usersWithoutUsernames = 0;
        let skippedUsers = 0;
        
        allParticipants.forEach((user: any) => {
          // Strict validation to ensure we only add real users
          if (user && user.id && typeof user.id !== 'undefined') {
            // Skip bots and deleted accounts
            if (user.bot === true) {
              skippedUsers++;
              return;
            }
            
            // Skip users with invalid or missing data
            if (user.deleted === true || user.min === true) {
              skippedUsers++;
              return;
            }
            
            // Prefer username format for better success rates
            if (user.username && typeof user.username === 'string' && user.username.trim().length > 0) {
              usersWithUsernames++;
              memberUsernames.add(`@${user.username.trim()}`);
            } else if (user.id && !isNaN(user.id)) {
              usersWithoutUsernames++;
              // Only add numeric ID if it's a valid number and no username exists
              memberUsernames.add(user.id.toString());
            } else {
              skippedUsers++;
            }
          } else {
            skippedUsers++;
          }
        });
        
        console.log(`Real users extracted - Usernames: ${usersWithUsernames}, Numeric IDs: ${usersWithoutUsernames}, Skipped (bots/invalid): ${skippedUsers}`);
        
        // Final validation and deduplication
        const result = Array.from(memberUsernames).filter(member => {
          // Remove any empty or invalid entries
          if (!member || typeof member !== 'string' || member.trim().length === 0) {
            return false;
          }
          
          // Validate username format
          if (member.startsWith('@')) {
            return member.length > 1 && /^@[a-zA-Z0-9_]{1,32}$/.test(member);
          }
          
          // Validate numeric ID format
          return /^\d+$/.test(member) && parseInt(member) > 0;
        });
        
        console.log(`Final result: ${result.length} verified unique member identifiers from ${allParticipants.length} total participants`);
        console.log(`Accuracy: ${Math.round((result.length / allParticipants.length) * 100)}% valid members extracted`);
        return result;
        
      } catch (error) {
        console.error("Error getting channel participants:", error);
        throw new Error(`Cannot access members of this channel. You may not have sufficient permissions.`);
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
          hash: BigInt(0)
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
