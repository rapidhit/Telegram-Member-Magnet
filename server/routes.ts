import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { telegramService } from "./services/telegram";
import { insertTelegramAccountSchema, insertMemberAdditionJobSchema, insertActivityLogSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Only .txt files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Send verification code
  app.post("/api/telegram/send-code", async (req, res) => {
    try {
      const { apiId, apiHash, phoneNumber } = req.body;
      
      if (!apiId || !apiHash || !phoneNumber) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await telegramService.sendVerificationCode(apiId, apiHash, phoneNumber);
      
      res.json({
        phoneCodeHash: result.phoneCodeHash,
        sessionString: result.sessionString,
        message: "Verification code sent to your phone"
      });
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      
      // Handle flood wait errors specifically
      if (error.message?.includes('FloodWaitError') || error.message?.includes('FLOOD')) {
        const waitMatch = error.message.match(/(\d+) seconds/);
        const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 0;
        const waitHours = Math.ceil(waitSeconds / 3600);
        
        return res.status(429).json({ 
          message: `Your account is rate limited by Telegram. Please wait ${waitHours} hours (${waitSeconds} seconds) before trying again.`,
          waitSeconds,
          waitHours,
          error: "RATE_LIMITED"
        });
      }
      
      res.status(500).json({ message: error.message || "Failed to send verification code" });
    }
  });

  // Verify code and connect account
  app.post("/api/telegram/verify", async (req, res) => {
    try {
      const { userId, apiId, apiHash, phoneNumber, code, phoneCodeHash, sessionString } = req.body;
      
      if (!userId || !apiId || !apiHash || !phoneNumber || !code || !phoneCodeHash || !sessionString) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { client, session } = await telegramService.verifyAndConnect(
        sessionString, apiId, apiHash, phoneNumber, code, phoneCodeHash
      );

      const userInfo = await telegramService.getUserInfo(client);

      const telegramAccount = await storage.createTelegramAccount({
        userId: parseInt(userId),
        telegramId: userInfo.id,
        phone: phoneNumber,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        username: userInfo.username,
        apiId,
        apiHash,
        sessionString: session,
      });

      await storage.createActivityLog({
        telegramAccountId: telegramAccount.id,
        action: "account_connected",
        details: `Connected Telegram account ${userInfo.username || userInfo.phone}`,
        status: "success",
      });

      res.json({ 
        message: "Telegram account connected successfully",
        telegramAccount, 
        userInfo 
      });
    } catch (error: any) {
      console.error("Error verifying and connecting:", error);
      res.status(500).json({ message: error.message || "Failed to verify and connect account" });
    }
  });

  // Get telegram account info
  app.get("/api/telegram/account/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const telegramAccount = await storage.getTelegramAccountByUserId(userId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      res.json(telegramAccount);
    } catch (error) {
      console.error("Error getting telegram account:", error);
      res.status(500).json({ message: "Failed to get telegram account" });
    }
  });

  // Get admin channels
  app.get("/api/telegram/channels/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const telegramAccount = await storage.getTelegramAccount(telegramAccountId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      // For existing accounts without stored API credentials, return empty channels
      if (!telegramAccount.apiId || !telegramAccount.apiHash) {
        return res.json([]);
      }

      const client = await telegramService.getClient(
        telegramAccountId,
        telegramAccount.sessionString,
        telegramAccount.apiId,
        telegramAccount.apiHash
      );

      const adminChannels = await telegramService.getAdminChannels(client);

      // Update channels in storage
      const existingChannels = await storage.getChannelsByTelegramAccountId(telegramAccountId);
      
      for (const channel of adminChannels) {
        const existing = existingChannels.find(c => c.channelId === channel.id);
        if (existing) {
          await storage.updateChannel(existing.id, {
            title: channel.title,
            username: channel.username,
            memberCount: channel.memberCount,
            isAdmin: channel.isAdmin,
          });
        } else {
          await storage.createChannel({
            telegramAccountId,
            channelId: channel.id,
            title: channel.title,
            username: channel.username,
            memberCount: channel.memberCount,
            isAdmin: channel.isAdmin,
          });
        }
      }

      res.json(adminChannels);
    } catch (error) {
      console.error("Error getting admin channels:", error);
      res.status(500).json({ message: "Failed to get admin channels" });
    }
  });

  // Upload member list file
  app.post("/api/members/upload", upload.single("memberFile"), async (req: Request & { file?: any }, res) => {
    try {
      console.log("File upload request received:", {
        hasFile: !!req.file,
        body: req.body,
        headers: req.headers["content-type"]
      });
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const userIds = fileContent
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => {
          if (!line) return false;
          // Accept numeric IDs, @usernames, or plain usernames
          return /^\d+$/.test(line) || line.startsWith("@") || /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(line);
        });

      if (userIds.length === 0) {
        return res.status(400).json({ message: "No valid user IDs found in file" });
      }

      if (userIds.length > 10000) {
        return res.status(400).json({ message: "Maximum 10,000 users per file" });
      }

      res.json({
        filename: req.file.originalname,
        userIds,
        count: userIds.length,
        note: "Note: Only users that have interacted with your account or are publicly accessible can be added to channels."
      });
    } catch (error: any) {
      console.error("Error processing member file:", error);
      res.status(500).json({ message: "Failed to process member file" });
    }
  });

  // Create member addition job
  app.post("/api/jobs/create", async (req, res) => {
    try {
      const jobData = insertMemberAdditionJobSchema.parse(req.body);
      const job = await storage.createMemberAdditionJob(jobData);

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        jobId: job.id,
        action: "job_created",
        details: `Created job to add ${job.totalMembers} members`,
        status: "info",
      });

      res.json(job);
    } catch (error) {
      console.error("Error creating member addition job:", error);
      res.status(500).json({ message: "Failed to create member addition job" });
    }
  });

  // Start member addition job
  app.post("/api/jobs/:jobId/start", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getMemberAdditionJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const telegramAccount = await storage.getTelegramAccount(job.telegramAccountId);
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      // Update job status to running
      await storage.updateMemberAdditionJob(jobId, {
        status: "running",
        startedAt: new Date(),
      });

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        jobId: job.id,
        action: "job_started",
        details: `Started adding members to channel`,
        status: "info",
      });

      // Start the member addition process in background
      processMemberAdditionJob(job, telegramAccount);

      res.json({ message: "Job started successfully" });
    } catch (error) {
      console.error("Error starting member addition job:", error);
      res.status(500).json({ message: "Failed to start member addition job" });
    }
  });

  // Get job status
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getMemberAdditionJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({ message: "Failed to get job status" });
    }
  });

  // Get jobs by telegram account
  app.get("/api/jobs/account/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const jobs = await storage.getMemberAdditionJobsByTelegramAccountId(telegramAccountId);
      res.json(jobs);
    } catch (error) {
      console.error("Error getting jobs:", error);
      res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  // Get activity logs
  app.get("/api/activity/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const logs = await storage.getActivityLogsByTelegramAccountId(telegramAccountId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting activity logs:", error);
      res.status(500).json({ message: "Failed to get activity logs" });
    }
  });

  // Disconnect telegram account
  app.post("/api/telegram/disconnect/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      
      // Mark account as inactive and clear session data
      await storage.updateTelegramAccount(telegramAccountId, {
        isActive: false,
        sessionString: "", // Clear session string for security
      });

      // Disconnect the client
      telegramService.disconnectClient(telegramAccountId);

      // Stop any running jobs for this account
      const runningJobs = await storage.getMemberAdditionJobsByTelegramAccountId(telegramAccountId);
      for (const job of runningJobs) {
        if (job.status === "running" || job.status === "pending") {
          await storage.updateMemberAdditionJob(job.id, {
            status: "cancelled",
            completedAt: new Date(),
          });
        }
      }

      await storage.createActivityLog({
        telegramAccountId,
        action: "account_disconnected",
        details: "Telegram account disconnected and all running jobs stopped",
        status: "info",
      });

      res.json({ message: "Account disconnected successfully" });
    } catch (error: any) {
      console.error("Error disconnecting account:", error);
      res.status(500).json({ message: "Failed to disconnect account" });
    }
  });

  // Get accessible contacts for testing
  app.get("/api/telegram/contacts/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const telegramAccount = await storage.getTelegramAccount(telegramAccountId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      if (!telegramAccount.apiId || !telegramAccount.apiHash) {
        return res.json({
          contacts: [],
          count: 0,
          message: "API credentials missing"
        });
      }

      try {
        const client = await telegramService.getClient(
          telegramAccountId,
          telegramAccount.sessionString,
          telegramAccount.apiId,
          telegramAccount.apiHash
        );

        const contacts = await telegramService.getAccessibleContacts(client);
        
        res.json({
          contacts,
          count: contacts.length,
          message: "These are user IDs that can potentially be added to your channels"
        });
      } catch (error: any) {
        console.error("Error getting contacts:", error);
        
        // Handle flood wait errors gracefully
        if (error.message?.includes('FloodWaitError') || error.message?.includes('FLOOD')) {
          const waitMatch = error.message.match(/(\d+) seconds/);
          const waitTime = waitMatch ? parseInt(waitMatch[1]) : 600;
          
          return res.status(429).json({ 
            message: `Rate limited by Telegram. Please wait ${Math.ceil(waitTime/60)} minutes before trying again.`,
            waitSeconds: waitTime,
            error: "RATE_LIMITED"
          });
        }
        
        res.status(500).json({ 
          message: "Failed to get contacts. Account may be rate limited or disconnected.",
          error: error.message || "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error in contacts endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Validate user IDs before creating job
  app.post("/api/telegram/validate-users/:telegramAccountId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const { userIds } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "Invalid user IDs array" });
      }

      const telegramAccount = await storage.getTelegramAccount(telegramAccountId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      if (!telegramAccount.apiId || !telegramAccount.apiHash) {
        return res.status(400).json({ message: "Account missing API credentials" });
      }

      const client = await telegramService.getClient(
        telegramAccountId,
        telegramAccount.sessionString,
        telegramAccount.apiId,
        telegramAccount.apiHash
      );

      console.log(`Validating ${userIds.length} user IDs...`);
      const validation = await telegramService.validateUserIds(client, userIds);
      
      res.json({
        ...validation,
        successRate: Math.round((validation.accessible.length / validation.total) * 100),
        message: `${validation.accessible.length} out of ${validation.total} users are accessible and can be added to channels`
      });
    } catch (error) {
      console.error("Error validating user IDs:", error);
      res.status(500).json({ message: "Failed to validate user IDs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background job processing
async function processMemberAdditionJob(job: any, telegramAccount: any) {
  try {
    const apiId = process.env.TELEGRAM_API_ID || process.env.API_ID || "";
    const apiHash = process.env.TELEGRAM_API_HASH || process.env.API_HASH || "";

    const client = await telegramService.getClient(
      telegramAccount.id,
      telegramAccount.sessionString,
      apiId,
      apiHash
    );

    const userIds = job.memberList as string[];
    const rateLimit = job.rateLimit || 4;
    const batchDelay = (job.batchDelay || 120) * 1000; // Convert to milliseconds
    const intervalDelay = (60 / rateLimit) * 1000; // Delay between individual additions

    let addedCount = job.addedMembers || 0;
    let failedCount = job.failedMembers || 0;

    for (let i = addedCount + failedCount; i < userIds.length; i++) {
      const currentJob = await storage.getMemberAdditionJob(job.id);
      if (currentJob?.status === "paused") {
        console.log(`Job ${job.id} paused at ${i}/${userIds.length}`);
        break;
      }

      const userId = userIds[i];
      console.log(`Processing user ${i + 1}/${userIds.length}: ${userId}`);

      try {
        const result = await telegramService.addMembersToChannel(
          client,
          job.channelId,
          [userId],
          (added, failed, current) => {
            // Real-time progress update
            console.log(`Live update: Added=${added}, Failed=${failed}, Current=${current}`);
          }
        );
        
        if (result.successful > 0) {
          addedCount++;
          console.log(`✓ Successfully added user ${userId} (${addedCount} total)`);
        } else {
          failedCount++;
          console.log(`✗ Failed to add user ${userId} (${failedCount} total failures)`);
        }
      } catch (error) {
        console.error(`Failed to add user ${userId}:`, error);
        failedCount++;
      }

      // Update job progress with exact counts
      const remaining = userIds.length - (addedCount + failedCount);
      await storage.updateMemberAdditionJob(job.id, {
        addedMembers: addedCount,
        failedMembers: failedCount,
      });
      
      console.log(`Progress: ${addedCount} added, ${failedCount} failed, ${remaining} remaining`);

      // Rate limiting delay
      if (i < userIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalDelay));
        
        // Batch delay after every rateLimit additions
        if ((i + 1) % rateLimit === 0) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
    }

    // Mark job as completed
    await storage.updateMemberAdditionJob(job.id, {
      status: "completed",
      completedAt: new Date(),
    });

    await storage.createActivityLog({
      telegramAccountId: job.telegramAccountId,
      jobId: job.id,
      action: "job_completed",
      details: `Successfully added ${addedCount} members, ${failedCount} failed`,
      status: "success",
    });

  } catch (error: any) {
    console.error("Error processing member addition job:", error);
    
    await storage.updateMemberAdditionJob(job.id, {
      status: "failed",
      completedAt: new Date(),
    });

    await storage.createActivityLog({
      telegramAccountId: job.telegramAccountId,
      jobId: job.id,
      action: "job_failed",
      details: `Job failed: ${error.message}`,
      status: "error",
    });
  }
}
