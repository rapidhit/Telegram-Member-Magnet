import {
  users,
  telegramAccounts,
  channels,
  memberAdditionJobs,
  activityLogs,
  type User,
  type InsertUser,
  type TelegramAccount,
  type InsertTelegramAccount,
  type Channel,
  type InsertChannel,
  type MemberAdditionJob,
  type InsertMemberAdditionJob,
  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Telegram account operations
  getTelegramAccount(id: number): Promise<TelegramAccount | undefined>;
  getTelegramAccountByUserId(userId: number): Promise<TelegramAccount | undefined>;
  createTelegramAccount(account: InsertTelegramAccount): Promise<TelegramAccount>;
  updateTelegramAccount(id: number, updates: Partial<TelegramAccount>): Promise<TelegramAccount | undefined>;

  // Channel operations
  getChannelsByTelegramAccountId(telegramAccountId: number): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, updates: Partial<Channel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<boolean>;

  // Member addition job operations
  createMemberAdditionJob(job: InsertMemberAdditionJob): Promise<MemberAdditionJob>;
  getMemberAdditionJob(id: number): Promise<MemberAdditionJob | undefined>;
  updateMemberAdditionJob(id: number, updates: Partial<MemberAdditionJob>): Promise<MemberAdditionJob | undefined>;
  getActiveMemberAdditionJobs(): Promise<MemberAdditionJob[]>;
  getMemberAdditionJobsByTelegramAccountId(telegramAccountId: number): Promise<MemberAdditionJob[]>;

  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByTelegramAccountId(telegramAccountId: number, limit?: number): Promise<ActivityLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private telegramAccounts: Map<number, TelegramAccount>;
  private channels: Map<number, Channel>;
  private memberAdditionJobs: Map<number, MemberAdditionJob>;
  private activityLogs: Map<number, ActivityLog>;
  private currentUserId: number;
  private currentTelegramAccountId: number;
  private currentChannelId: number;
  private currentJobId: number;
  private currentLogId: number;

  constructor() {
    this.users = new Map();
    this.telegramAccounts = new Map();
    this.channels = new Map();
    this.memberAdditionJobs = new Map();
    this.activityLogs = new Map();
    this.currentUserId = 1;
    this.currentTelegramAccountId = 1;
    this.currentChannelId = 1;
    this.currentJobId = 1;
    this.currentLogId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getTelegramAccount(id: number): Promise<TelegramAccount | undefined> {
    return this.telegramAccounts.get(id);
  }

  async getTelegramAccountByUserId(userId: number): Promise<TelegramAccount | undefined> {
    return Array.from(this.telegramAccounts.values()).find(account => account.userId === userId);
  }

  async createTelegramAccount(insertAccount: InsertTelegramAccount): Promise<TelegramAccount> {
    const id = this.currentTelegramAccountId++;
    const account: TelegramAccount = {
      ...insertAccount,
      id,
      firstName: insertAccount.firstName ?? null,
      lastName: insertAccount.lastName ?? null,
      username: insertAccount.username ?? null,
      isActive: insertAccount.isActive ?? true,
      createdAt: new Date(),
    };
    this.telegramAccounts.set(id, account);
    return account;
  }

  async updateTelegramAccount(id: number, updates: Partial<TelegramAccount>): Promise<TelegramAccount | undefined> {
    const account = this.telegramAccounts.get(id);
    if (!account) return undefined;
    
    const updatedAccount = { ...account, ...updates };
    this.telegramAccounts.set(id, updatedAccount);
    return updatedAccount;
  }

  async getChannelsByTelegramAccountId(telegramAccountId: number): Promise<Channel[]> {
    return Array.from(this.channels.values()).filter(channel => channel.telegramAccountId === telegramAccountId);
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const id = this.currentChannelId++;
    const channel: Channel = {
      ...insertChannel,
      id,
      username: insertChannel.username ?? null,
      memberCount: insertChannel.memberCount ?? 0,
      isAdmin: insertChannel.isAdmin ?? false,
      createdAt: new Date(),
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: number, updates: Partial<Channel>): Promise<Channel | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    
    const updatedChannel = { ...channel, ...updates };
    this.channels.set(id, updatedChannel);
    return updatedChannel;
  }

  async deleteChannel(id: number): Promise<boolean> {
    return this.channels.delete(id);
  }

  async createMemberAdditionJob(insertJob: InsertMemberAdditionJob): Promise<MemberAdditionJob> {
    const id = this.currentJobId++;
    const job: MemberAdditionJob = {
      ...insertJob,
      id,
      addedMembers: insertJob.addedMembers ?? 0,
      failedMembers: insertJob.failedMembers ?? 0,
      rateLimit: insertJob.rateLimit ?? 4,
      batchDelay: insertJob.batchDelay ?? 120,
      status: insertJob.status ?? "pending",
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    };
    this.memberAdditionJobs.set(id, job);
    return job;
  }

  async getMemberAdditionJob(id: number): Promise<MemberAdditionJob | undefined> {
    return this.memberAdditionJobs.get(id);
  }

  async updateMemberAdditionJob(id: number, updates: Partial<MemberAdditionJob>): Promise<MemberAdditionJob | undefined> {
    const job = this.memberAdditionJobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.memberAdditionJobs.set(id, updatedJob);
    return updatedJob;
  }

  async getActiveMemberAdditionJobs(): Promise<MemberAdditionJob[]> {
    return Array.from(this.memberAdditionJobs.values()).filter(job => 
      job.status === "running" || job.status === "pending"
    );
  }

  async getMemberAdditionJobsByTelegramAccountId(telegramAccountId: number): Promise<MemberAdditionJob[]> {
    return Array.from(this.memberAdditionJobs.values()).filter(job => job.telegramAccountId === telegramAccountId);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = this.currentLogId++;
    const log: ActivityLog = {
      ...insertLog,
      id,
      details: insertLog.details ?? null,
      jobId: insertLog.jobId ?? null,
      channelTitle: insertLog.channelTitle ?? null,
      createdAt: new Date(),
    };
    this.activityLogs.set(id, log);
    return log;
  }

  async getActivityLogsByTelegramAccountId(telegramAccountId: number, limit = 10): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.telegramAccountId === telegramAccountId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
