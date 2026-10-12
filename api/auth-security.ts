import { Request, Response } from 'express';
import { getClientIp, checkLoginRateLimit, recordFailedLogin, clearFailedLogins } from './security';

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function') {
    res.status(status).json(data);
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return typeof res.status === 'function' ? res.status(200).end() : res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    const { action, email, success } = body;
    const ip = getClientIp(req as Request);

    if (!email || typeof email !== 'string') {
      return sendJson(res, 400, { success: false, error: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if user is locked out before login attempt
    if (action === 'check') {
      const status = checkLoginRateLimit(cleanEmail, ip);
      return sendJson(res, 200, {
        success: true,
        allowed: status.allowed,
        remainingAttempts: status.remainingAttempts,
        retryAfterMinutes: status.retryAfterMinutes
      });
    }

    // 2. Report attempt result (success or failure)
    if (action === 'report') {
      if (success === true) {
        clearFailedLogins(cleanEmail, ip);
        return sendJson(res, 200, { success: true, message: 'Login tracker cleared' });
      } else {
        const failureResult = recordFailedLogin(cleanEmail, ip);
        return sendJson(res, 200, {
          success: true,
          remainingAttempts: failureResult.remainingAttempts,
          isLocked: failureResult.isLocked,
          lockoutMinutes: failureResult.lockoutMinutes
        });
      }
    }

    return sendJson(res, 400, { success: false, error: 'Invalid action' });
  } catch (err: any) {
    return sendJson(res, 500, { success: false, error: err.message || 'Internal error' });
  }
}
