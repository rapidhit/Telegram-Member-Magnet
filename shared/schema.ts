import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const telegramAccounts = pgTable("telegram_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  telegramId: text("telegram_id").notNull().unique(),
  phone: text("phone").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  sessionString: text("session_string").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  telegramAccountId: integer("telegram_account_id").notNull(),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  username: text("username"),
  memberCount: integer("member_count").default(0),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberAdditionJobs = pgTable("member_addition_jobs", {
  id: serial("id").primaryKey(),
  telegramAccountId: integer("telegram_account_id").notNull(),
  channelId: text("channel_id").notNull(),
  totalMembers: integer("total_members").notNull(),
  addedMembers: integer("added_members").default(0),
  failedMembers: integer("failed_members").default(0),
  memberList: jsonb("member_list").notNull(), // Array of user IDs
  rateLimit: integer("rate_limit").default(4), // per minute
  batchDelay: integer("batch_delay").default(120), // seconds
  status: text("status").notNull().default("pending"), // pending, running, paused, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  telegramAccountId: integer("telegram_account_id").notNull(),
  jobId: integer("job_id"),
  action: text("action").notNull(),
  channelTitle: text("channel_title"),
  details: text("details"),
  status: text("status").notNull(), // success, error, info
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTelegramAccountSchema = createInsertSchema(telegramAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
});

export const insertMemberAdditionJobSchema = createInsertSchema(memberAdditionJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TelegramAccount = typeof telegramAccounts.$inferSelect;
export type InsertTelegramAccount = z.infer<typeof insertTelegramAccountSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type MemberAdditionJob = typeof memberAdditionJobs.$inferSelect;
export type InsertMemberAdditionJob = z.infer<typeof insertMemberAdditionJobSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
