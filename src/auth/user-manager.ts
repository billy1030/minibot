import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { User, SafeUser, Session, UserContext } from "./types.js";

const CONFIG_DIR = path.resolve(process.cwd(), "config");
const USERS_FILE = path.join(CONFIG_DIR, "users.json");
const SESSIONS_FILE = path.join(CONFIG_DIR, "sessions.json");
const LOGS_ROOT = path.resolve(process.cwd(), "logs");
const STORAGE_DOCS_ROOT = path.resolve(process.cwd(), "storage/documents");

const AUTH_SECRET = process.env.SESSION_SECRET || "loop-engg-enterprise-auth-jwt-cookie-hmac-secret-2026";
export const LOGIN_MAX_AGE_HOURS = process.env.LOGIN_MAX_AGE_HOURS
  ? parseFloat(process.env.LOGIN_MAX_AGE_HOURS)
  : 16;
export const SESSION_MAX_AGE_SECONDS = Math.floor(LOGIN_MAX_AGE_HOURS * 3600);
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
const failedAttemptsMap = new Map<string, { count: number; lastAttempt: number }>();

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(LOGS_ROOT)) {
  fs.mkdirSync(LOGS_ROOT, { recursive: true });
}
if (!fs.existsSync(STORAGE_DOCS_ROOT)) {
  fs.mkdirSync(STORAGE_DOCS_ROOT, { recursive: true });
}

// 1. Password Hashing & Verification (scrypt + timingSafeEqual)
export function hashPassword(password: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, s, 64).toString("hex");
  return `${s}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

// 2. Recovery Codes
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toLowerCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

// 3. User Storage & Default Admin
export function getUsers(): User[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const users: User[] = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
      let modified = false;
      users.forEach((u, idx) => {
        if (!u.userNumber) {
          u.userNumber = idx.toString().padStart(5, "0");
          modified = true;
        }
        if (!u.recoveryCodesHashed) {
          u.recoveryCodesHashed = [];
          modified = true;
        }
        // Ensure user directory exists
        getUserDirs(u.userNumber);
      });
      if (modified) saveUsers(users);
      return users;
    }
  } catch (e) {
    console.error("[Auth] Error reading users.json:", e);
  }

  // Default Admin provision: 00000 / admin / admin123
  const defaultAdmin: User = {
    id: 1,
    userNumber: "00000",
    username: "admin",
    displayName: "Admin",
    passwordHash: hashPassword(process.env.INITIAL_ADMIN_PASSWORD || "admin123"),
    role: "admin",
    isActive: true,
    totpSecret: null,
    totpEnabled: false,
    recoveryCodesHashed: [],
    usedTotpHashes: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  saveUsers([defaultAdmin]);
  getUserDirs(defaultAdmin.userNumber);
  return [defaultAdmin];
}

export function saveUsers(users: User[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    userNumber: user.userNumber || "00000",
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    totpEnabled: !!user.totpEnabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// 4. Per-User Directory Provisioning & Boundary Checking
export function getUserDirs(userNumber: string = "00000") {
  const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
  const userLogsDir = path.resolve(LOGS_ROOT, safeNumber);
  const userDocsDir = path.resolve(STORAGE_DOCS_ROOT, safeNumber);

  if (!fs.existsSync(userLogsDir)) {
    fs.mkdirSync(userLogsDir, { recursive: true });
  }
  if (!fs.existsSync(userDocsDir)) {
    fs.mkdirSync(userDocsDir, { recursive: true });
  }

  return { userLogsDir, userDocsDir, userNumber: safeNumber };
}

// 5. PreAuth Token (HMAC for 2FA Step 1 -> Step 2)
export function generatePreAuthToken(userId: number, passwordHash: string): string {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
  const payload = `${userId}:${expiresAt}:${passwordHash.slice(0, 16)}`;
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${userId}.${expiresAt}.${signature}`;
}

export function verifyPreAuthToken(token: string, userId: number, passwordHash: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUserIdStr, expiresAtStr, signature] = parts;
  const tokenUserId = parseInt(tokenUserIdStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(tokenUserId) || isNaN(expiresAt) || tokenUserId !== userId) return false;
  if (Date.now() > expiresAt) return false;

  const payload = `${userId}:${expiresAt}:${passwordHash.slice(0, 16)}`;
  const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return signature === expectedSignature;
}

// 6. Rate Limiting & Lockout
export function checkRateLimit(username: string): { locked: boolean; waitSeconds?: number } {
  const attempt = failedAttemptsMap.get(username);
  if (!attempt) return { locked: false };
  const now = Date.now();
  if (now - attempt.lastAttempt > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.delete(username);
    return { locked: false };
  }
  if (attempt.count >= LOCKOUT_MAX_ATTEMPTS) {
    const waitSeconds = Math.ceil((LOCKOUT_WINDOW_MS - (now - attempt.lastAttempt)) / 1000);
    return { locked: true, waitSeconds };
  }
  return { locked: false };
}

export function recordFailedAttempt(username: string): void {
  const now = Date.now();
  const attempt = failedAttemptsMap.get(username);
  if (!attempt || now - attempt.lastAttempt > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.set(username, { count: 1, lastAttempt: now });
  } else {
    attempt.count += 1;
    attempt.lastAttempt = now;
  }
}

export function resetFailedAttempts(username: string): void {
  failedAttemptsMap.delete(username);
}

// 7. Sessions Management
export function getSessions(): Record<string, Session> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[Auth] Error reading sessions.json:", e);
  }
  return {};
}

export function saveSessions(sessions: Record<string, Session>): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}

export function createSession(user: User): string {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const sessions = getSessions();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  sessions[sessionId] = {
    userId: user.id,
    userNumber: user.userNumber || "00000",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: now.toISOString(),
  };

  saveSessions(sessions);
  return sessionId;
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return list;
}

export function getAuthenticatedUserFromCookie(cookieHeader?: string): SafeUser | null {
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["loop_session"];
  if (!sessionId) return null;

  const sessions = getSessions();
  const session = sessions[sessionId];
  if (!session) return null;

  const now = Date.now();
  const expiresAtTime = new Date(session.expiresAt).getTime();
  const createdAtTime = new Date(session.createdAt).getTime();
  const loginMaxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;

  // 1. Sliding/regular expiry check
  // 2. Hard cap by login age from createdAt (prevent indefinitely active sessions)
  if (
    isNaN(createdAtTime) ||
    now - createdAtTime > loginMaxAgeMs ||
    isNaN(expiresAtTime) ||
    expiresAtTime < now
  ) {
    delete sessions[sessionId];
    saveSessions(sessions);
    return null;
  }

  const users = getUsers();
  const user = users.find((u) => u.id === session.userId && u.isActive);
  if (!user) return null;

  session.lastSeenAt = new Date().toISOString();
  saveSessions(sessions);

  return toSafeUser(user);
}

// 8. TOTP 2FA Helpers
export function generateTotpSetup(username: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: "LoopEngg",
    label: username,
    secret,
  });
  const recoveryCodes = generateRecoveryCodes(10);
  return { secret, otpauthUrl, recoveryCodes };
}

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return await QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const cleanToken = token.trim();
    const result: any = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 60, // ±60s clock skew tolerance
    });
    return typeof result === "boolean" ? result : Boolean(result?.valid);
  } catch {
    return false;
  }
}
