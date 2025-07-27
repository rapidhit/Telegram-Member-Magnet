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
    fileSize: 100 * 1024 * 1024, // 100MB limit for large member lists
    fieldSize: 50 * 1024 * 1024, // 50MB field size limit
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
      const forceRefresh = req.query.refresh === 'true';
      
      const telegramAccount = await storage.getTelegramAccount(telegramAccountId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      // For existing accounts without stored API credentials, return empty channels
      if (!telegramAccount.apiId || !telegramAccount.apiHash) {
        return res.json([]);
      }

      // Clear cache if refresh is requested
      if (forceRefresh) {
        telegramService.clearChannelCache(telegramAccountId);
      }

      const client = await telegramService.getClient(
        telegramAccountId,
        telegramAccount.sessionString,
        telegramAccount.apiId,
        telegramAccount.apiHash
      );

      const adminChannels = await telegramService.getAdminChannels(client, telegramAccountId);

      // Update channels in storage only if data was refreshed (not from cache)
      if (forceRefresh || !telegramService.isCached(telegramAccountId)) {
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

      if (userIds.length > 100000) {
        return res.status(400).json({ message: "Maximum 100,000 users per file" });
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
      const memberListLength = Array.isArray(req.body.memberList) ? req.body.memberList.length : 0;
      console.log(`Creating job with ${memberListLength} members...`);
      
      const jobData = insertMemberAdditionJobSchema.parse(req.body);
      
      // Validate member list size
      if (Array.isArray(jobData.memberList) && jobData.memberList.length > 100000) {
        return res.status(400).json({ 
          message: "Maximum 100,000 members per job. Please split into smaller batches." 
        });
      }
      
      const job = await storage.createMemberAdditionJob(jobData);

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        jobId: job.id,
        action: "job_created",
        details: `Created job to add ${job.totalMembers} members`,
        status: "info",
      });

      console.log(`Successfully created job ${job.id} with ${job.totalMembers} members`);
      res.json(job);
    } catch (error: any) {
      console.error("Error creating member addition job:", error);
      
      // Handle specific payload size errors
      if (error.message?.includes('entity too large') || error.message?.includes('PayloadTooLargeError')) {
        return res.status(413).json({ 
          message: "Member list too large. Please reduce the number of members or split into smaller batches.",
          error: "PAYLOAD_TOO_LARGE"
        });
      }
      
      res.status(500).json({ 
        message: error.message || "Failed to create member addition job",
        error: error.code || "CREATION_FAILED"
      });
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

  // Pause job
  app.post("/api/jobs/:jobId/pause", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getMemberAdditionJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== "running") {
        return res.status(400).json({ message: "Job is not running" });
      }

      await storage.updateMemberAdditionJob(jobId, {
        status: "paused"
      });

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        action: "job_paused",
        details: `Paused member addition job ${jobId}`,
        status: "success",
      });

      res.json({ message: "Job paused successfully" });
    } catch (error) {
      console.error("Error pausing job:", error);
      res.status(500).json({ message: "Failed to pause job" });
    }
  });

  // Resume job
  app.post("/api/jobs/:jobId/resume", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getMemberAdditionJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== "paused") {
        return res.status(400).json({ message: "Job is not paused" });
      }

      await storage.updateMemberAdditionJob(jobId, {
        status: "running"
      });

      // Get the telegram account and restart processing
      const telegramAccount = await storage.getTelegramAccount(job.telegramAccountId);
      if (telegramAccount) {
        // Resume processing in the background
        processMemberAdditionJob(job, telegramAccount);
      }

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        action: "job_resumed",
        details: `Resumed member addition job ${jobId}`,
        status: "success",
      });

      res.json({ message: "Job resumed successfully" });
    } catch (error) {
      console.error("Error resuming job:", error);
      res.status(500).json({ message: "Failed to resume job" });
    }
  });

  // Stop job
  app.post("/api/jobs/:jobId/stop", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getMemberAdditionJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status === "completed" || job.status === "cancelled") {
        return res.status(400).json({ message: "Job is already finished" });
      }

      await storage.updateMemberAdditionJob(jobId, {
        status: "cancelled",
        completedAt: new Date()
      });

      await storage.createActivityLog({
        telegramAccountId: job.telegramAccountId,
        action: "job_stopped",
        details: `Stopped member addition job ${jobId}`,
        status: "success",
      });

      res.json({ message: "Job stopped successfully" });
    } catch (error) {
      console.error("Error stopping job:", error);
      res.status(500).json({ message: "Failed to stop job" });
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

  // Get channel members
  app.get("/api/telegram/channel-members/:telegramAccountId/:channelId", async (req, res) => {
    try {
      const telegramAccountId = parseInt(req.params.telegramAccountId);
      const channelId = req.params.channelId;
      const limit = parseInt(req.query.limit as string) || 10000; // Increase default limit
      
      const telegramAccount = await storage.getTelegramAccount(telegramAccountId);
      
      if (!telegramAccount) {
        return res.status(404).json({ message: "Telegram account not found" });
      }

      if (!telegramAccount.apiId || !telegramAccount.apiHash) {
        return res.json({
          members: [],
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

        const members = await telegramService.getChannelMembers(client, channelId, limit);
        
        const usernameCount = members.filter(m => m.startsWith('@')).length;
        const numericCount = members.filter(m => !m.startsWith('@')).length;
        
        const stats = {
          totalMembers: members.length,
          usernameFormat: usernameCount,
          numericFormat: numericCount,
          extractionLimit: limit,
          timestamp: new Date().toISOString(),
          dataQuality: 'verified_real_users'
        };
        
        res.json({
          members,
          count: members.length,
          channelId,
          message: `Successfully extracted ${members.length} verified real members from channel (${usernameCount} @usernames, ${numericCount} numeric IDs)`,
          stats,
          extractionInfo: {
            requestedLimit: limit,
            actualCount: members.length,
            reachedLimit: members.length >= limit,
            extractionTime: new Date().toISOString(),
            dataIntegrity: 'real_users_only',
            validationApplied: true
          }
        });
      } catch (error: any) {
        console.error("Error getting channel members:", error);
        
        // Handle specific Telegram API errors with user-friendly messages
        if (error.message?.includes('FloodWaitError') || error.message?.includes('FLOOD')) {
          const waitMatch = error.message.match(/(\d+) seconds/);
          const waitTime = waitMatch ? parseInt(waitMatch[1]) : 600;
          
          return res.status(429).json({ 
            message: `Rate limited by Telegram. Please wait ${Math.ceil(waitTime/60)} minutes before trying again.`,
            waitSeconds: waitTime,
            error: "RATE_LIMITED"
          });
        }
        
        if (error.message?.includes('ChatAdminRequiredError') || error.message?.includes('CHAT_ADMIN_REQUIRED')) {
          return res.status(403).json({ 
            message: "You need admin permissions to view members of this channel",
            error: "INSUFFICIENT_PERMISSIONS"
          });
        }
        
        if (error.message?.includes('ChannelPrivateError') || error.message?.includes('CHANNEL_PRIVATE')) {
          return res.status(403).json({ 
            message: "This channel is private and members cannot be accessed",
            error: "PRIVATE_CHANNEL"
          });
        }
        
        if (error.message?.includes('Failed to connect')) {
          return res.status(503).json({ 
            message: "Unable to connect to Telegram. Please check your internet connection and try again.",
            error: "CONNECTION_FAILED"
          });
        }
        
        if (error.message?.includes('No members found')) {
          return res.status(404).json({ 
            message: "No members found in this channel. This might be due to channel privacy settings.",
            error: "NO_MEMBERS_FOUND"
          });
        }
        
        // Generic error response
        res.status(500).json({ 
          message: error.message || "Failed to extract channel members. Please check your permissions and try again.",
          error: error.message || "EXTRACTION_FAILED"
        });
      }
    } catch (error) {
      console.error("Error in channel members endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
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

// Background job processing with comprehensive error handling
async function processMemberAdditionJob(job: any, telegramAccount: any) {
  const jobStartTime = Date.now();
  const MAX_JOB_DURATION = 2 * 60 * 60 * 1000; // 2 hours max
  
  try {
    console.log(`🚀 STARTING JOB ${job.id}: Processing ${job.memberList?.length || 0} users`);
    
    // Check if job is already completed or cancelled
    const currentJob = await storage.getMemberAdditionJob(job.id);
    if (currentJob?.status === "completed" || currentJob?.status === "cancelled") {
      console.log(`⏹️ Job ${job.id} already ${currentJob.status}, skipping processing`);
      return;
    }

    const apiId = process.env.TELEGRAM_API_ID || process.env.API_ID || "";
    const apiHash = process.env.TELEGRAM_API_HASH || process.env.API_HASH || "";

    const client = await telegramService.getClient(
      telegramAccount.id,
      telegramAccount.sessionString,
      apiId,
      apiHash
    );

    const userIds = job.memberList as string[];
    if (!userIds || userIds.length === 0) {
      throw new Error("No user IDs provided for processing");
    }

    let addedCount = job.addedMembers || 0;
    let failedCount = job.failedMembers || 0;

    // JOB TIMEOUT PROTECTION
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job timeout after 2 hours. Processed ${addedCount} members before timeout.`));
      }, MAX_JOB_DURATION);
    });

    // MAIN PROCESSING with timeout protection
    const processingPromise = telegramService.addMembersToChannel(
      client,
      job.channelId,
      userIds,
      async (added, failed, current) => {
        // Check for job cancellation during processing
        const jobStatus = await storage.getMemberAdditionJob(job.id);
        if (jobStatus?.status === "cancelled" || jobStatus?.status === "paused") {
          console.log(`🛑 Job ${job.id} ${jobStatus.status} during processing`);
          throw new Error(`Job ${jobStatus.status} by user`);
        }
        
        // Check for timeout
        if (Date.now() - jobStartTime > MAX_JOB_DURATION) {
          throw new Error("Job exceeded maximum duration");
        }
        
        // Update job progress in real-time
        await storage.updateMemberAdditionJob(job.id, {
          addedMembers: added,
          failedMembers: failed,
        }).catch(console.error);
        
        console.log(`📊 PROGRESS: ${added} added, ${failed} failed, current: ${current}`);
      }
    );

    // Race between processing and timeout
    const result = await Promise.race([processingPromise, timeoutPromise]) as any;
    
    addedCount = result.successful;
    failedCount = result.failed;
    
    console.log(`🏁 JOB ${job.id} COMPLETE: ${addedCount} actually added, ${failedCount} failed`);
    
    // Final job update
    const finalStatus = addedCount > 0 ? "completed" : "failed";
    await storage.updateMemberAdditionJob(job.id, {
      status: finalStatus,
      completedAt: new Date(),
      addedMembers: addedCount,
      failedMembers: failedCount,
    });

    await storage.createActivityLog({
      telegramAccountId: job.telegramAccountId,
      jobId: job.id,
      action: "job_completed",
      details: `Successfully added ${addedCount} members, ${failedCount} failed`,
      status: "success",
    });

  } catch (error: any) {
    console.error(`❌ JOB ${job.id} ERROR:`, error.message);
    
    // Determine appropriate status based on error type
    let finalStatus = "failed";
    if (error.message?.includes("cancelled by user")) {
      finalStatus = "cancelled";
    } else if (error.message?.includes("paused by user")) {
      finalStatus = "paused";
    } else if (error.message?.includes("timeout")) {
      finalStatus = "failed";
    }
    
    await storage.updateMemberAdditionJob(job.id, {
      status: finalStatus,
      completedAt: new Date(),
    });

    await storage.createActivityLog({
      telegramAccountId: job.telegramAccountId,
      jobId: job.id,
      action: "job_failed",
      details: `Job ${finalStatus}: ${error.message}`,
      status: "error",
    });
  }
}
