import "./polyfills.js";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 🛡️ Global crash guards: prevent unhandled exceptions or rejected promises from killing the server
process.on("uncaughtException", (err) => {
  console.error("[CRITICAL UNCAUGHT EXCEPTION]:", err?.stack || err);
});

process.on("unhandledRejection", (reason: any) => {
  console.error("[CRITICAL UNHANDLED REJECTION]:", reason?.stack || reason);
});
import { loadConfig, saveConfigToDisk } from "./config/index.js";
import { LoopConfig, MCPServerDef } from "./config/schema.js";
import { MCPClientManager } from "./mcp/client-manager.js";
import { LoopOrchestrator } from "./engine/loop-orchestrator.js";
import { LLMClient } from "./llm/client.js";
import {
  saveConversationLog,
  listConversationLogs,
  parseConversationLog,
  renameConversationLog,
  deleteConversationLog,
  cloneConversationTurn,
  saveConversationOrder,
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
} from "./logger/conversation-logger.js";
import { DocumentManager } from "./documents/document-manager.js";
import {
  getUsers,
  saveUsers,
  toSafeUser,
  hashPassword,
  verifyPassword,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  generatePreAuthToken,
  verifyPreAuthToken,
  createSession,
  getSessions,
  saveSessions,
  parseCookies,
  getAuthenticatedUserFromCookie,
  generateTotpSetup,
  generateQrCodeDataUrl,
  verifyTotpToken,
  hashRecoveryCode,
  getUserDirs,
  SESSION_MAX_AGE_SECONDS,
} from "./auth/user-manager.js";
import { SafeUser } from "./auth/types.js";
import { EMBEDDED_FRONTEND } from "./server-embedded-assets.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7009;

const app = express();

// 🛡️ 1. Security Headers & HSTS Middleware
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent Clickjacking (allow only sameorigin if embedded in trusted frame)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Cross-Site Scripting filter
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS: Enforce HTTPS when running on secure connection or behind an SSL-terminating reverse proxy
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
});

// 🛡️ 2. Controlled CORS policy & Preflight Handling
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., same-origin mobile apps, curl, server-side fetch)
      if (!origin) return callback(null, true);

      // Allow all origins (returning true dynamically reflects the requesting origin with credentials)
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Range", "Accept"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400, // 24 hours preflight cache
  })
);
app.options(/(.*)/, cors());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// 1. Serve static frontend files from disk if folder exists (development mode)
const clientDistPath = path.resolve(process.cwd(), "frontend/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(
    express.static(clientDistPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      },
    })
  );
}

// 2. Serve static files from embedded memory if available (standalone single binary fallback)
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const urlPath = req.path;
  const asset = EMBEDDED_FRONTEND[urlPath];
  if (asset && asset.content) {
    res.setHeader("Content-Type", asset.contentType);
    return res.send(asset.content);
  }
  next();
});

let config: LoopConfig = loadConfig();
let mcpManager = new MCPClientManager();
let isInitialized = false;

// Initialize default users and directories
getUsers();

async function initMCP() {
  const servers: Record<string, MCPServerDef> = {};
  for (const [key, def] of Object.entries(config.mcpServers)) {
    if (def.args?.[0]?.endsWith(".js")) {
      const jsPath = path.resolve(process.cwd(), def.args[0]);
      const tsPath = def.args[0].replace(/^dist\//, "src/").replace(/\.js$/, ".ts");
      const fullTsPath = path.resolve(process.cwd(), tsPath);

      if (fs.existsSync(jsPath)) {
        // Built JS exists
        servers[key] = {
          ...def,
          command: "node",
          args: [jsPath],
        };
      } else if (fs.existsSync(fullTsPath)) {
        // Fall back to tsx in development mode
        servers[key] = {
          ...def,
          command: "npx",
          args: ["tsx", tsPath],
        };
      } else {
        // Standalone mode without dist/ folder: omit command so it activates in-process tools directly
        servers[key] = {
          ...def,
          command: "",
          args: [],
        };
      }
    } else {
      servers[key] = { ...def };
    }
  }
  await mcpManager.initialize(servers);
  isInitialized = true;
}

// Auth Helper Middleware
function getAuthContext(req: express.Request): { user: SafeUser | null; userNumber: string } {
  const user = getAuthenticatedUserFromCookie(req.headers.cookie);
  const userNumber = user?.userNumber || "00000";
  return { user, userNumber };
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const { user } = getAuthContext(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const { user } = getAuthContext(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

// ==========================================
// AUTHENTICATION & 2FA TOTP ENDPOINTS
// ==========================================

// 1. POST /api/auth/login (Step 1: Username & Password)
app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const rateCheck = checkRateLimit(cleanUsername);
    if (rateCheck.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${rateCheck.waitSeconds} seconds.`,
      });
    }

    const users = getUsers();
    const user = users.find((u) => u.username.toLowerCase() === cleanUsername && u.isActive);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailedAttempt(cleanUsername);
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }

    resetFailedAttempts(cleanUsername);

    // If TOTP is enabled on this account -> Return Step 2 Challenge
    if (user.totpEnabled && user.totpSecret) {
      const preAuthToken = generatePreAuthToken(user.id, user.passwordHash);
      return res.json({
        success: true,
        step: "totp_required",
        userId: user.id,
        preAuthToken,
      });
    }

    // Direct Login (TOTP not active)
    user.lastLoginAt = new Date().toISOString();
    saveUsers(users);

    const sessionId = createSession(user);
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.setHeader(
      "Set-Cookie",
      `loop_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${isSecure ? "; Secure" : ""}`
    );
    return res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/auth/2fa/challenge (Step 2: TOTP Code / Recovery Code verification)
app.post("/api/auth/2fa/challenge", (req, res) => {
  try {
    const { userId, code, preAuthToken } = req.body;
    if (!userId || !code || !preAuthToken) {
      return res.status(400).json({ success: false, error: "Missing 2FA verification parameters." });
    }

    const users = getUsers();
    const user = users.find((u) => u.id === Number(userId) && u.isActive);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(401).json({ success: false, error: "Invalid user or 2FA not configured." });
    }

    const isTokenValid = verifyPreAuthToken(preAuthToken, user.id, user.passwordHash);
    if (!isTokenValid) {
      return res.status(401).json({ success: false, error: "2FA session expired. Please log in again." });
    }

    const cleanCode = code.trim();
    let isVerified = false;

    // Check TOTP 6-digit code
    if (cleanCode.length === 6 && /^\d+$/.test(cleanCode)) {
      isVerified = verifyTotpToken(cleanCode, user.totpSecret);
    }

    // Check Emergency Recovery Code (e.g. "a1b2-c3d4")
    if (!isVerified && user.recoveryCodesHashed && user.recoveryCodesHashed.length > 0) {
      const codeHash = hashRecoveryCode(cleanCode);
      const codeIndex = user.recoveryCodesHashed.indexOf(codeHash);
      if (codeIndex !== -1) {
        // Consume one-time recovery code
        user.recoveryCodesHashed.splice(codeIndex, 1);
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(401).json({ success: false, error: "Invalid 2FA code or Recovery Code." });
    }

    user.lastLoginAt = new Date().toISOString();
    saveUsers(users);

    const sessionId = createSession(user);
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.setHeader(
      "Set-Cookie",
      `loop_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${isSecure ? "; Secure" : ""}`
    );
    return res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/auth/me (Check current session)
app.get("/api/auth/me", (req, res) => {
  const { user } = getAuthContext(req);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.json({ success: false, user: null });
  }
});

// 4. POST /api/auth/logout
app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies["loop_session"];
  if (sessionId) {
    const sessions = getSessions();
    delete sessions[sessionId];
    saveSessions(sessions);
  }
  res.setHeader("Set-Cookie", "loop_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ success: true, message: "Logged out successfully." });
});

// 5. POST /api/auth/change-password
app.post("/api/auth/change-password", requireAuth, (req, res) => {
  try {
    const { user: safeUser } = getAuthContext(req);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
    }

    const users = getUsers();
    const user = users.find((u) => u.id === safeUser!.id);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ success: false, error: "Current password is incorrect." });
    }

    user.passwordHash = hashPassword(newPassword);
    saveUsers(users);
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET /api/auth/2fa/status
app.get("/api/auth/2fa/status", requireAuth, (req, res) => {
  const { user: safeUser } = getAuthContext(req);
  const users = getUsers();
  const user = users.find((u) => u.id === safeUser!.id);
  res.json({
    success: true,
    enabled: !!user?.totpEnabled,
    remainingRecoveryCodes: user?.recoveryCodesHashed?.length || 0,
  });
});

// 7. POST /api/auth/2fa/setup (Generate secret, otpauth URL, QR code, and 10 recovery codes)
app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
  try {
    const { user: safeUser } = getAuthContext(req);
    const users = getUsers();
    const user = users.find((u) => u.id === safeUser!.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    const { secret, otpauthUrl, recoveryCodes } = generateTotpSetup(user.username);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);

    user.pendingTotpSecret = secret;
    user.pendingRecoveryCodesHashed = recoveryCodes.map((code) => hashRecoveryCode(code));
    saveUsers(users);

    res.json({
      success: true,
      secret,
      otpauthUrl,
      qrCode: qrCodeDataUrl,
      recoveryCodes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. POST /api/auth/2fa/verify (Activate 2FA after scanning)
app.post("/api/auth/2fa/verify", requireAuth, (req, res) => {
  try {
    const { user: safeUser } = getAuthContext(req);
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: "Verification code required." });

    const users = getUsers();
    const user = users.find((u) => u.id === safeUser!.id);
    if (!user || !user.pendingTotpSecret) {
      return res.status(400).json({ success: false, error: "No pending 2FA setup found." });
    }

    const isValid = verifyTotpToken(code, user.pendingTotpSecret);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid code. Please check your authenticator app." });
    }

    user.totpSecret = user.pendingTotpSecret;
    user.totpEnabled = true;
    user.recoveryCodesHashed = user.pendingRecoveryCodesHashed || [];
    delete user.pendingTotpSecret;
    delete user.pendingRecoveryCodesHashed;
    saveUsers(users);

    res.json({ success: true, message: "Two-factor authentication successfully enabled!" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/auth/2fa/disable
app.post("/api/auth/2fa/disable", requireAuth, (req, res) => {
  try {
    const { user: safeUser } = getAuthContext(req);
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: "2FA code required to disable." });

    const users = getUsers();
    const user = users.find((u) => u.id === safeUser!.id);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ success: false, error: "2FA is not enabled." });
    }

    const isValid = verifyTotpToken(code, user.totpSecret);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid 2FA code." });
    }

    user.totpEnabled = false;
    user.totpSecret = null;
    user.recoveryCodesHashed = [];
    saveUsers(users);

    res.json({ success: true, message: "Two-factor authentication disabled." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// USER MANAGEMENT ENDPOINTS (Admin Only)
// ==========================================

// 10. GET /api/users
app.get("/api/users", requireAdmin, (req, res) => {
  const users = getUsers().map(toSafeUser);
  res.json({ success: true, users });
});

// 11. POST /api/users (Create User with 5-digit userNumber)
app.post("/api/users", requireAdmin, (req, res) => {
  try {
    const { username, displayName, password, role } = req.body;
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ success: false, error: "Username and password (min 6 chars) required." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = getUsers();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ success: false, error: `Username "${cleanUsername}" already exists.` });
    }

    const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const assignedUserNumber = String(nextId - 1).padStart(5, "0");

    const newUser: any = {
      id: nextId,
      userNumber: assignedUserNumber,
      username: cleanUsername,
      displayName: displayName?.trim() || cleanUsername,
      passwordHash: hashPassword(password),
      role: role === "admin" ? "admin" : "user",
      isActive: true,
      totpSecret: null,
      totpEnabled: false,
      recoveryCodesHashed: [],
      usedTotpHashes: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    getUserDirs(assignedUserNumber);
    users.push(newUser);
    saveUsers(users);

    res.status(201).json({ success: true, user: toSafeUser(newUser) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. PATCH /api/users/:id
app.patch("/api/users/:id", requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { displayName, role, isActive } = req.body;

    const users = getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    if (user.id === 1 && isActive === false) {
      return res.status(400).json({ success: false, error: "Cannot deactivate primary admin." });
    }

    if (displayName !== undefined) user.displayName = displayName.trim();
    if (role !== undefined && ["admin", "user"].includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = !!isActive;

    saveUsers(users);
    res.json({ success: true, user: toSafeUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. POST /api/users/:id/reset-password
app.post("/api/users/:id/reset-password", requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
    }

    const users = getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    user.passwordHash = hashPassword(newPassword);
    saveUsers(users);
    res.json({ success: true, message: `Password reset successfully for ${user.username}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. POST /api/users/:id/reset-2fa
app.post("/api/users/:id/reset-2fa", requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const users = getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    user.totpEnabled = false;
    user.totpSecret = null;
    user.recoveryCodesHashed = [];
    delete user.pendingTotpSecret;
    delete user.pendingRecoveryCodesHashed;
    saveUsers(users);

    res.json({ success: true, message: `2FA reset for ${user.username}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. DELETE /api/users/:id (Delete User - Admin Only)
app.delete("/api/users/:id", requireAdmin, (req, res) => {
  try {
    const { user: authUser } = getAuthContext(req);
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) return res.status(400).json({ success: false, error: "Invalid user ID." });

    if (targetId === authUser?.id) {
      return res.status(400).json({ success: false, error: "Cannot delete your own admin account." });
    }

    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === targetId);
    if (userIndex === -1) return res.status(404).json({ success: false, error: "User not found." });

    const deletedUser = users.splice(userIndex, 1)[0];
    saveUsers(users);

    // Clean active sessions for this user
    const sessions = getSessions();
    for (const [sid, sess] of Object.entries(sessions)) {
      if (sess.userId === targetId) {
        delete sessions[sid];
      }
    }
    saveSessions(sessions);

    res.json({ success: true, message: `User @${deletedUser.username} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// CORE SYSTEM CONFIG & MCP ENDPOINTS
// ==========================================

// 1. Get Configuration & Status
app.get("/api/config", (req, res) => {
  config = loadConfig();
  const maskedKey = config.llm.apiKey
    ? (config.llm.apiKey.length > 8 ? `${config.llm.apiKey.slice(0, 6)}...****` : "****")
    : "";

  const maskedVoiceKey = config.voice?.apiKey
    ? (config.voice.apiKey.length > 8 ? `${config.voice.apiKey.slice(0, 6)}...****` : "****")
    : "";

  const safeConfig = {
    ...config,
    llm: {
      ...config.llm,
      apiKey: maskedKey,
    },
    voice: {
      baseUrl: config.voice?.baseUrl || "https://api.minimaxi.com/v1",
      apiKey: maskedVoiceKey,
      model: config.voice?.model || "speech-2.8-hd",
      voiceId: config.voice?.voiceId || "Cantonese_CuteGirl",
      speed: config.voice?.speed ?? 1.0,
      enabled: config.voice?.enabled ?? true,
    },
    tools: mcpManager.getOpenAITools(),
    discoveredTools: mcpManager.getDiscoveredTools(),
  };
  res.json(safeConfig);
});

// 2. Update Configuration, Persist to Disk, and Hot-Reload MCP Servers
app.post("/api/config", requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    if (updates.llm) {
      const isMasked = updates.llm.apiKey?.includes("...****") || updates.llm.apiKey === "****";
      const newApiKey = isMasked ? config.llm.apiKey : updates.llm.apiKey;

      config.llm = {
        ...config.llm,
        ...updates.llm,
        apiKey: newApiKey || config.llm.apiKey,
      };
    }
    if (updates.voice) {
      const isMasked = updates.voice.apiKey?.includes("...****") || updates.voice.apiKey === "****";
      const newVoiceKey = isMasked ? (config.voice?.apiKey || "") : updates.voice.apiKey;

      config.voice = {
        baseUrl: updates.voice.baseUrl || config.voice?.baseUrl || "https://api.minimaxi.com/v1",
        apiKey: newVoiceKey !== undefined ? newVoiceKey : (config.voice?.apiKey || ""),
        model: updates.voice.model || config.voice?.model || "speech-2.8-hd",
        voiceId: updates.voice.voiceId || config.voice?.voiceId || "Cantonese_CuteGirl",
        speed: updates.voice.speed ?? config.voice?.speed ?? 1.0,
        enabled: updates.voice.enabled ?? config.voice?.enabled ?? true,
      };
    }
    if (updates.prompts) {
      config.prompts = { ...config.prompts, ...updates.prompts };
    }
    if (updates.maxLoopIterations) {
      config.maxLoopIterations = updates.maxLoopIterations;
    }
    if (updates.mcpServers) {
      config.mcpServers = updates.mcpServers;
      await initMCP();
    }

    // Persist changes directly to minibot.config.json
    saveConfigToDisk(config);

    const maskedKey = config.llm.apiKey
      ? (config.llm.apiKey.length > 8 ? `${config.llm.apiKey.slice(0, 6)}...****` : "****")
      : "";

    const maskedVoiceKey = config.voice?.apiKey
      ? (config.voice.apiKey.length > 8 ? `${config.voice.apiKey.slice(0, 6)}...****` : "****")
      : "";

    res.json({
      success: true,
      config: {
        ...config,
        llm: {
          ...config.llm,
          apiKey: maskedKey,
        },
        voice: {
          ...config.voice,
          apiKey: maskedVoiceKey,
        },
        tools: mcpManager.getOpenAITools(),
        discoveredTools: mcpManager.getDiscoveredTools(),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. List Discovered MCP Tools
app.get("/api/tools", (req, res) => {
  const tools = mcpManager.getOpenAITools();
  const discoveredTools = mcpManager.getDiscoveredTools();
  res.json({ tools, discoveredTools });
});

// 3b. Server-side LLM Proxy & Health Test (Bypasses all client-side CORS and protects API keys)
app.post("/api/llm/completions", requireAuth, async (req, res) => {
  try {
    const { messages, tools, model, temperature, maxTokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const client = new LLMClient({
      ...config.llm,
      model: model || config.llm.model,
      temperature: temperature ?? config.llm.temperature,
      maxTokens: maxTokens ?? config.llm.maxTokens,
    });
    const completion = await client.createChatCompletion(messages, tools);
    res.json(completion);
  } catch (err: any) {
    console.error("[LLM Proxy Error]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/llm/test", requireAuth, async (req, res) => {
  try {
    const client = new LLMClient(config.llm);
    const result = await client.createChatCompletion([
      { role: "user", content: "Reply with 'LLM connection successful'" },
    ]);
    const message = result.choices[0]?.message?.content || "";
    res.json({ success: true, message, model: config.llm.model });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3c. Text-to-Speech (TTS) via MiniMax Speech-2.8-HD (Cantonese & multilingual neural voice)
app.post("/api/tts", requireAuth, async (req, res) => {
  try {
    const { text, voiceId = "Cantonese_CuteGirl", speed = 1.0, pitch = 0, vol = 1.0, timeout = 30 } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Text is required for TTS synthesis" });
    }

    // Dynamic timeout limit: between 3 and 120 seconds (default 30s)
    const timeoutSec = Math.max(3, Math.min(120, Number(timeout) || 30));

    // Use dedicated voice.apiKey if configured, otherwise fallback to llm.apiKey
    const apiKey = (config.voice?.apiKey && config.voice.apiKey.trim()) || config.llm.apiKey;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "MiniMax Voice API key not configured on server" });
    }

    const postData = JSON.stringify({
      model: "speech-2.8-hd",
      text: text.trim(),
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: Number(speed) || 1.0,
        vol: Number(vol) || 1.0,
        pitch: Math.round(Number(pitch)) || 0,
      },
      audio_setting: {
        sample_rate: 24000,
        bitrate: 64000,
        format: "mp3",
        channel: 1,
      },
    });

    const ttsReq = https.request(
      "https://api.minimaxi.com/v1/t2a_v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (ttsRes) => {
        let rawBody = "";
        ttsRes.on("data", (chunk) => {
          rawBody += chunk;
        });

        ttsRes.on("end", () => {
          try {
            const parsed = JSON.parse(rawBody);
            if (parsed.base_resp && parsed.base_resp.status_code !== 0) {
              return res.status(502).json({
                success: false,
                error: parsed.base_resp.status_msg || "MiniMax TTS failed",
              });
            }

            if (parsed.data && parsed.data.audio) {
              const audioBuffer = Buffer.from(parsed.data.audio, "hex");
              res.setHeader("Content-Type", "audio/mpeg");
              res.setHeader("Content-Length", audioBuffer.length);
              return res.send(audioBuffer);
            }

            return res.status(502).json({ success: false, error: "No audio data received from MiniMax" });
          } catch (parseErr: any) {
            return res.status(502).json({ success: false, error: `Invalid response from MiniMax: ${parseErr.message}` });
          }
        });
      }
    );

    ttsReq.on("error", (err) => {
      console.error("[TTS Request Error]:", err.message);
      res.status(502).json({ success: false, error: err.message });
    });

    ttsReq.setTimeout(timeoutSec * 1000, () => {
      ttsReq.destroy(new Error(`MiniMax Voice API request timed out after ${timeoutSec} seconds`));
    });

    ttsReq.write(postData);
    ttsReq.end();
  } catch (err: any) {
    console.error("[TTS Error]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for Document Manager instance per user
function getDocManager(req: express.Request): DocumentManager {
  const { userNumber } = getAuthContext(req);
  return new DocumentManager(undefined, userNumber);
}

// 4. Chat with Streaming Events (SSE) and Multi-Turn History, Document Attachment & Workspace Support
app.post("/api/chat", requireAuth, async (req, res) => {
  const { userNumber } = getAuthContext(req);
  const { message, history, attachedDocHashes, sessionFile, workspace, enableThinking = true } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: any) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const startTime = new Date();
  const sessionToolCalls: Array<{
    toolName: string;
    serverName?: string;
    args: any;
    result?: string;
    timestamp: number;
  }> = [];

  try {
    const currentConfig = loadConfig();
    const orchestrator = new LoopOrchestrator(currentConfig, mcpManager);
    const docManager = getDocManager(req);

    // Retrieve preprocessed document context if hashes provided
    const docContextResult = docManager.getPreprocessedContext(attachedDocHashes || []);
    const attachedContext = docContextResult.context;

    await orchestrator.run(
      message,
      {
        onStepStart: (iteration) => {
          sendEvent("step_start", { iteration });
        },
        onToolCall: (toolName, toolArgs, serverName) => {
          console.log(`[Loop Server] 🛠️ Tool invoked: "${toolName}" via MCP Server: [${serverName}]`);
          sessionToolCalls.push({
            toolName,
            serverName: serverName || "unknown",
            args: toolArgs,
            timestamp: Date.now(),
          });
          sendEvent("tool_call", {
            toolName,
            serverName: serverName || "unknown",
            args: toolArgs,
            timestamp: Date.now(),
          });
        },
        onToolResult: (toolName, result, serverName) => {
          console.log(`[Loop Server] ✅ Tool completed: "${toolName}" [${serverName}] (${result.length} chars)`);
          const existing = sessionToolCalls.find((t) => t.toolName === toolName && !t.result);
          if (existing) {
            existing.result = result;
            if (serverName) existing.serverName = serverName;
          }
          sendEvent("tool_result", {
            toolName,
            serverName: serverName || "unknown",
            result,
            timestamp: Date.now(),
          });
        },
        onComplete: (answer, iterations) => {
          let savedFile = sessionFile;
          try {
            savedFile = saveConversationLog(
              {
                sessionFile,
                workspace: workspace || "default",
                userNumber,
                userPrompt: message,
                model: config.llm.model,
                iterations,
                toolCalls: sessionToolCalls,
                finalAnswer: answer,
                startTime,
                endTime: new Date(),
                attachedDocHashes: attachedDocHashes || [],
              },
              "logs",
              userNumber
            );
          } catch (logErr: any) {
            console.error(`[Conversation Logger] Failed to save log: ${logErr.message}`);
          }

          sendEvent("complete", { answer, iterations, sessionFile: savedFile, workspace: workspace || "default" });
          if (!res.writableEnded) {
            res.write("event: end\ndata: {}\n\n");
            res.end();
          }
        },
        onError: (err) => {
          sendEvent("error", { message: err.message });
          if (!res.writableEnded) {
            res.end();
          }
        },
      },
      history,
      attachedContext,
      enableThinking
    );
  } catch (err: any) {
    sendEvent("error", { message: err.message });
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// 5. Document Attachments & Session Scoped Endpoints (Per-User Isolation)
app.post("/api/documents/upload", requireAuth, async (req, res) => {
  try {
    const { fileName, fileBase64 } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, error: "Missing fileName or fileBase64" });
    }
    const docManager = getDocManager(req);
    const result = await docManager.ingestDocument(fileName, fileBase64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/documents/by-hashes", requireAuth, (req, res) => {
  try {
    const { hashes } = req.body;
    const docManager = getDocManager(req);
    const documents = docManager.getDocumentsByHashes(hashes || []);
    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/documents", requireAuth, (req, res) => {
  try {
    const docManager = getDocManager(req);
    const documents = docManager.listDocuments();
    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/documents/context", requireAuth, (req, res) => {
  try {
    const { docHashes } = req.body;
    const docManager = getDocManager(req);
    const result = docManager.getPreprocessedContext(docHashes || []);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/documents/:hash", requireAuth, (req, res) => {
  try {
    const hash = String(req.params.hash);
    const docManager = getDocManager(req);
    const deleted = docManager.deleteDocument(hash);
    if (deleted) {
      res.json({ success: true, message: `Deleted document ${hash}` });
    } else {
      res.status(404).json({ success: false, error: "Document not found." });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Workspaces Management Endpoints (Scoped per User)
app.get("/api/workspaces", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const workspaces = listWorkspaces("logs", userNumber);
    res.json({ success: true, workspaces });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/workspaces", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Workspace name is required." });
    }
    const createdName = createWorkspace(name, "logs", userNumber);
    res.json({ success: true, name: createdName });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/workspaces/:name/rename", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const name = String(req.params.name);
    const { newName } = req.body;
    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return res.status(400).json({ success: false, error: "New workspace name is required." });
    }
    const renamedName = renameWorkspace(name, newName, "logs", userNumber);
    res.json({ success: true, name: renamedName });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/workspaces/:name", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const name = String(req.params.name);
    const deleted = deleteWorkspace(name, "logs", userNumber);
    if (deleted) {
      res.json({ success: true, message: `Deleted workspace ${name}` });
    } else {
      res.status(404).json({ success: false, error: "Workspace not found." });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. List Saved Conversation Logs within a Workspace (Scoped per User)
app.get("/api/logs", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const workspace = (req.query.workspace as string) || "default";
    const logs = listConversationLogs(workspace, "logs", userNumber);
    res.json({ logs, workspace });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7b. Reorder Saved Conversation Logs and Persist into session-order.json
app.post("/api/logs/reorder", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const { orderedFilenames, workspace } = req.body;
    if (!Array.isArray(orderedFilenames)) {
      return res.status(400).json({ success: false, error: "orderedFilenames array is required." });
    }
    const saved = saveConversationOrder(orderedFilenames, workspace || "default", "logs", userNumber);
    res.json({ success: saved, message: "Conversation order saved successfully." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get Parsed Conversation Log to Reload into UI
app.get("/api/logs/:filename", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const filename = String(req.params.filename);
    const workspace = (req.query.workspace as string) || "default";
    const session = parseConversationLog(filename, workspace, "logs", userNumber);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 9. Rename Conversation Session Title
app.post("/api/logs/:filename/rename", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const filename = String(req.params.filename);
    const { newTitle, workspace } = req.body;
    if (!newTitle || typeof newTitle !== "string" || !newTitle.trim()) {
      return res.status(400).json({ error: "newTitle is required." });
    }
    const renamed = renameConversationLog(filename, newTitle, workspace || "default", "logs", userNumber);
    if (renamed) {
      res.json({ success: true, message: `Renamed ${filename} to ${newTitle}` });
    } else {
      res.status(404).json({ error: "File not found." });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Clone a Specific Sub-Conversation (Turn) to a New Independent Session
app.post("/api/logs/:filename/clone-turn", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const filename = String(req.params.filename);
    const { turnIndex, mode, workspace, targetWorkspace, customDocHashes } = req.body;
    if (turnIndex === undefined || turnIndex === null) {
      return res.status(400).json({ error: "turnIndex is required." });
    }
    const result = cloneConversationTurn(
      filename,
      Number(turnIndex),
      mode || "up_to",
      workspace || "default",
      targetWorkspace,
      customDocHashes,
      "logs",
      userNumber
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Delete Conversation Log File
app.delete("/api/logs/:filename", requireAuth, (req, res) => {
  try {
    const { userNumber } = getAuthContext(req);
    const filename = String(req.params.filename);
    const workspace = (req.query.workspace as string) || "default";
    const deleted = deleteConversationLog(filename, workspace, "logs", userNumber);
    if (deleted) {
      res.json({ success: true, message: `Deleted ${filename}` });
    } else {
      res.status(404).json({ error: "File not found." });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// GIT CLI REPOSITORY SYNC ENDPOINTS
// ==========================================

// 12. GET /api/git/status - Query current branch, remote, and commit status
app.get("/api/git/status", requireAuth, async (req, res) => {
  try {
    const cwd = process.cwd();
    const branchRes = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, timeout: 15000 });
    const currentBranch = branchRes.stdout.trim() || "main";

    let remoteUrl = "";
    try {
      const remoteRes = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd, timeout: 10000 });
      remoteUrl = remoteRes.stdout.trim();
    } catch {}

    const statusRes = await execFileAsync("git", ["status", "--short"], { cwd, timeout: 15000 });
    const hasUncommitted = !!statusRes.stdout.trim();

    let lastCommit = "";
    try {
      const logRes = await execFileAsync("git", ["log", "-1", "--oneline"], { cwd, timeout: 10000 });
      lastCommit = logRes.stdout.trim();
    } catch {}

    res.json({
      success: true,
      branch: currentBranch,
      remoteUrl,
      hasUncommitted,
      lastCommit,
      statusShort: statusRes.stdout.trim(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.stderr?.trim() || err.message || "Failed to inspect git repository status.",
    });
  }
});

// 13. POST /api/git/sync - Execute external Git CLI update / synchronization
app.post("/api/git/sync", requireAuth, async (req, res) => {
  try {
    const cwd = process.cwd();
    const action = req.body.action || "pull"; // "pull" | "push" | "sync"

    let commandOutput = "";
    const logs: string[] = [];

    if (action === "pull" || action === "sync") {
      logs.push("▶ Executing: git pull --stat origin main");
      const pullRes = await execFileAsync("git", ["pull", "--stat"], {
        cwd,
        timeout: 45000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });
      const pullOut = (pullRes.stdout + (pullRes.stderr ? `\n${pullRes.stderr}` : "")).trim();
      logs.push(pullOut || "Already up to date.");
    }

    if (action === "push" || action === "sync") {
      // Stage changed files, commit if needed, and push
      const statusRes = await execFileAsync("git", ["status", "--porcelain"], { cwd, timeout: 15000 });
      const hasChanges = !!statusRes.stdout.trim();

      if (hasChanges) {
        const commitMsg = req.body.message?.trim() || `chore(sync): automated update ${new Date().toISOString()}`;
        logs.push(`▶ Staging changes and committing: "${commitMsg}"`);
        await execFileAsync("git", ["add", "-A"], { cwd, timeout: 15000 });
        await execFileAsync("git", ["commit", "-m", commitMsg], { cwd, timeout: 15000 });
      }

      logs.push("▶ Executing: git push");
      const pushRes = await execFileAsync("git", ["push"], {
        cwd,
        timeout: 60000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });
      const pushOut = (pushRes.stdout + (pushRes.stderr ? `\n${pushRes.stderr}` : "")).trim();
      logs.push(pushOut || "Push completed successfully.");
    }

    // Retrieve updated commit log
    let lastCommit = "";
    try {
      const logRes = await execFileAsync("git", ["log", "-1", "--oneline"], { cwd, timeout: 10000 });
      lastCommit = logRes.stdout.trim();
    } catch {}

    commandOutput = logs.join("\n\n");

    res.json({
      success: true,
      action,
      output: commandOutput,
      lastCommit,
    });
  } catch (err: any) {
    const errorMsg = (err.stderr || err.stdout || err.message || "Failed to execute git synchronization.").trim();
    res.status(500).json({
      success: false,
      error: errorMsg,
      code: err.code,
    });
  }
});

// Fallback to frontend SPA index.html or welcome banner
app.use((req, res) => {
  const indexPath = path.resolve(process.cwd(), "frontend/dist/index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.sendFile(indexPath);
  }
  const embeddedIndex = EMBEDDED_FRONTEND["/index.html"] || EMBEDDED_FRONTEND["/"];
  if (embeddedIndex) {
    res.setHeader("Content-Type", embeddedIndex.contentType);
    return res.send(embeddedIndex.content);
  }
  res.send(`
    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
      <h2>Mini Chat Bot API Server is running on port ${PORT}</h2>
      <p>Frontend is currently building or running via Vite.</p>
      <p>Try querying <code>/api/config</code> or <code>/api/tools</code>.</p>
    </div>
  `);
});

async function start() {
  await initMCP();
  // Bind to "::" to support both IPv6 (::1) and IPv4 (127.0.0.1 / 0.0.0.0) dual-stack on macOS and Linux
  const server = app.listen(PORT, "::", () => {
    console.log(`\n🚀 Server listening on http://localhost:${PORT} (dual-stack IPv4/IPv6)`);
    console.log(`⚡ Testing Port: ${PORT}`);
    console.log(`🔌 MCP Tools active: ${mcpManager.getOpenAITools().length}\n`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EAFNOSUPPORT") {
      // Fallback to IPv4 if IPv6 dual-stack is not supported
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n🚀 Server listening on http://localhost:${PORT} (IPv4 fallback)`);
      });
      return;
    }
    console.error(`[Server Error] Could not start server on port ${PORT}:`, err.message);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
