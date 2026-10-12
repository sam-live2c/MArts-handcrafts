import { Request, Response, NextFunction } from 'express';

// =========================================================================
// 1. IN-MEMORY RATE LIMITING STORES WITH AUTOMATIC TTL EXPIRY
// =========================================================================

interface RateLimitRecord {
  count: number;
  firstTimestamp: number;
  lastTimestamp: number;
  blockedUntil?: number;
}

const ipRequestStore = new Map<string, RateLimitRecord>();
const loginAttemptStore = new Map<string, { attempts: number; blockedUntil: number; lastAttempt: number }>();
const orderRateStore = new Map<string, { orderCount: number; windowStart: number; lastOrderTime: number }>();

// Periodic memory purge every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();

  // Clean IP store (older than 10 minutes)
  for (const [ip, rec] of ipRequestStore.entries()) {
    if (now - rec.lastTimestamp > 10 * 60 * 1000) {
      ipRequestStore.delete(ip);
    }
  }

  // Clean Login store (older than 30 minutes)
  for (const [key, rec] of loginAttemptStore.entries()) {
    if (now - rec.lastAttempt > 30 * 60 * 1000 && now > rec.blockedUntil) {
      loginAttemptStore.delete(key);
    }
  }

  // Clean Order store (older than 30 minutes)
  for (const [key, rec] of orderRateStore.entries()) {
    if (now - rec.lastOrderTime > 30 * 60 * 1000) {
      orderRateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Helper to get client IP from request headers or socket
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// =========================================================================
// 2. INJECTION & ATTACK PAYLOAD DETECTOR
// =========================================================================

const SUSPICIOUS_PATTERNS = [
  // SQL Injection patterns
  /(\b(UNION(\s+ALL)?\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b)/i,
  /('\s*OR\s*('1'='1'|1=1|''=''))/i,
  /(\bSLEEP\s*\(\s*\d+\s*\))/i,
  /(--|#|\/\*)/,

  // XSS & Script Injection patterns
  /<script\b[^>]*>([\s\S]*?)<\/script>/i,
  /javascript\s*:/i,
  /\bon\w+\s*=\s*["'][^"']*["']/i, // onload=, onerror=, etc.

  // Prototype Pollution
  /__proto__/i,
  /constructor\s*\.\s*prototype/i,

  // NoSQL injection tokens
  /("\$gt"|"\$ne"|"\$where"|"\$regex"|"\$or"|"\$nin")/i
];

/**
 * Recursively inspects values in body or queries for suspicious injection vectors
 */
export function containsMaliciousPayload(val: unknown, depth = 0): boolean {
  if (depth > 6) return false; // Prevent circular recursion

  if (typeof val === 'string') {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(val)) {
        return true;
      }
    }
    return false;
  }

  if (Array.isArray(val)) {
    for (const item of val) {
      if (containsMaliciousPayload(item, depth + 1)) return true;
    }
    return false;
  }

  if (val && typeof val === 'object') {
    // Check object keys for prototype pollution or NoSQL operators
    for (const key of Object.keys(val)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' || key.startsWith('$')) {
        return true;
      }
      if (containsMaliciousPayload((val as Record<string, unknown>)[key], depth + 1)) {
        return true;
      }
    }
  }

  return false;
}

// =========================================================================
// 3. EXPRESS SECURITY MIDDLEWARE
// =========================================================================

/**
 * Hardened HTTP Security Headers
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Guard against MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * Traffic Volumetric Rate Limiter (Protects server from DoS / crashing)
 * Max 150 requests per minute per IP for general traffic
 */
export function globalTrafficLimiter(req: Request, res: Response, next: NextFunction): void {
  // Skip static assets to conserve processing power
  if (req.path.startsWith('/media') || req.path.startsWith('/assets') || req.path.endsWith('.jpg') || req.path.endsWith('.png') || req.path.endsWith('.svg')) {
    return next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS = 180; // 180 requests per minute

  const record = ipRequestStore.get(ip) || { count: 0, firstTimestamp: now, lastTimestamp: now };

  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.status(429).json({
      success: false,
      error: `Traffic rate limit exceeded. Please wait ${retryAfterSeconds} seconds before retrying.`
    });
    return;
  }

  if (now - record.firstTimestamp > WINDOW_MS) {
    record.count = 1;
    record.firstTimestamp = now;
    record.lastTimestamp = now;
  } else {
    record.count += 1;
    record.lastTimestamp = now;
  }

  if (record.count > MAX_REQUESTS) {
    record.blockedUntil = now + 60 * 1000; // Block for 1 minute
    ipRequestStore.set(ip, record);
    res.status(429).json({
      success: false,
      error: 'Excessive requests detected. Your connection is temporarily throttled to protect server health.'
    });
    return;
  }

  ipRequestStore.set(ip, record);
  next();
}

/**
 * Injection Inspection Middleware
 */
export function injectionGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only inspect API endpoints
  if (!req.path.startsWith('/api')) {
    return next();
  }

  if (containsMaliciousPayload(req.body) || containsMaliciousPayload(req.query)) {
    console.warn(`[Security Alert] Malicious injection pattern blocked from IP: ${getClientIp(req)} on path: ${req.path}`);
    res.status(400).json({
      success: false,
      error: 'Invalid input. Request contains rejected characters or unsafe injection patterns.'
    });
    return;
  }

  next();
}

// =========================================================================
// 4. LOGIN BRUTE FORCE CONTROLS
// =========================================================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(email: string, ip: string): { allowed: boolean; remainingAttempts: number; retryAfterMinutes?: number } {
  const now = Date.now();
  const cleanEmail = email.trim().toLowerCase();
  const emailKey = `email:${cleanEmail}`;
  const ipKey = `ip:${ip}`;

  const emailRec = loginAttemptStore.get(emailKey);
  const ipRec = loginAttemptStore.get(ipKey);

  // Check email lockout
  if (emailRec && emailRec.blockedUntil > now) {
    const retryAfter = Math.ceil((emailRec.blockedUntil - now) / (60 * 1000));
    return { allowed: false, remainingAttempts: 0, retryAfterMinutes: retryAfter };
  }

  // Check IP lockout (prevent distributed dictionary attacks from same IP across multiple emails)
  if (ipRec && ipRec.blockedUntil > now) {
    const retryAfter = Math.ceil((ipRec.blockedUntil - now) / (60 * 1000));
    return { allowed: false, remainingAttempts: 0, retryAfterMinutes: retryAfter };
  }

  const currentAttempts = Math.max(emailRec?.attempts || 0, 0);
  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - currentAttempts);

  return { allowed: true, remainingAttempts: remaining };
}

export function recordFailedLogin(email: string, ip: string): { remainingAttempts: number; isLocked: boolean; lockoutMinutes?: number } {
  const now = Date.now();
  const cleanEmail = email.trim().toLowerCase();
  const emailKey = `email:${cleanEmail}`;
  const ipKey = `ip:${ip}`;

  // Update email record
  const emailRec = loginAttemptStore.get(emailKey) || { attempts: 0, blockedUntil: 0, lastAttempt: now };
  emailRec.attempts += 1;
  emailRec.lastAttempt = now;

  // Update IP record
  const ipRec = loginAttemptStore.get(ipKey) || { attempts: 0, blockedUntil: 0, lastAttempt: now };
  ipRec.attempts += 1;
  ipRec.lastAttempt = now;

  let isLocked = false;
  let lockoutMinutes = 0;

  if (emailRec.attempts >= MAX_LOGIN_ATTEMPTS) {
    emailRec.blockedUntil = now + LOGIN_LOCKOUT_MS;
    isLocked = true;
    lockoutMinutes = 15;
  }

  if (ipRec.attempts >= 10) {
    ipRec.blockedUntil = now + LOGIN_LOCKOUT_MS;
    isLocked = true;
    lockoutMinutes = 15;
  }

  loginAttemptStore.set(emailKey, emailRec);
  loginAttemptStore.set(ipKey, ipRec);

  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - emailRec.attempts);
  return { remainingAttempts: remaining, isLocked, lockoutMinutes: isLocked ? lockoutMinutes : undefined };
}

export function clearFailedLogins(email: string, ip: string): void {
  const cleanEmail = email.trim().toLowerCase();
  loginAttemptStore.delete(`email:${cleanEmail}`);
  // Don't fully clear IP to prevent cycle resetting, but decrement
  const ipRec = loginAttemptStore.get(`ip:${ip}`);
  if (ipRec && ipRec.attempts > 0) {
    ipRec.attempts = Math.max(0, ipRec.attempts - 1);
  }
}

// =========================================================================
// 5. ORDER FREQUENCY & DAILY ORDER LIMIT CONTROLS (MAX 3 ORDERS IN A DAY)
// =========================================================================

export const MAX_ORDERS_PER_DAY = 3; // Maximum 3 orders in a day
const ORDER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour rolling day window
const MIN_ORDER_INTERVAL_MS = 10 * 1000; // 10 seconds between consecutive submissions to prevent accidental double-click

export function checkAndRecordOrderRate(userId: string, email: string, ip: string): {
  allowed: boolean;
  error?: string;
  cooldownSeconds?: number;
  remainingToday?: number;
} {
  const now = Date.now();
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const targetKey = userId && userId !== 'guest' 
    ? `user:${userId}` 
    : cleanEmail 
      ? `email:${cleanEmail}` 
      : `ip:${ip}`;

  const record = orderRateStore.get(targetKey) || { orderCount: 0, windowStart: now, lastOrderTime: 0 };

  // 1. Anti-Spam double click cooldown (10 seconds)
  if (record.lastOrderTime > 0 && now - record.lastOrderTime < MIN_ORDER_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_ORDER_INTERVAL_MS - (now - record.lastOrderTime)) / 1000);
    return {
      allowed: false,
      error: `Please wait ${waitSeconds} seconds before placing another order.`,
      cooldownSeconds: waitSeconds,
      remainingToday: Math.max(0, MAX_ORDERS_PER_DAY - record.orderCount)
    };
  }

  // 2. Day window reset (after 24 hours)
  if (now - record.windowStart > ORDER_WINDOW_MS) {
    record.orderCount = 0;
    record.windowStart = now;
  }

  // 3. Max orders in a day check (Max 3 orders per day)
  if (record.orderCount >= MAX_ORDERS_PER_DAY) {
    const hoursLeft = Math.ceil((ORDER_WINDOW_MS - (now - record.windowStart)) / (60 * 60 * 1000));
    return {
      allowed: false,
      error: `Daily order limit reached. You can only place up to 3 orders per day. Please try again in ${hoursLeft} hour(s).`,
      cooldownSeconds: Math.ceil((ORDER_WINDOW_MS - (now - record.windowStart)) / 1000),
      remainingToday: 0
    };
  }

  // Record valid order attempt
  record.orderCount += 1;
  record.lastOrderTime = now;
  orderRateStore.set(targetKey, record);

  const remainingToday = Math.max(0, MAX_ORDERS_PER_DAY - record.orderCount);
  return { allowed: true, remainingToday };
}

