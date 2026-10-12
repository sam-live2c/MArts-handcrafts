import { Request, Response } from 'express';
import { getClientIp, checkAndRecordOrderRate, containsMaliciousPayload } from './security';

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

    const { userId, customerEmail, customerPhone, customerName, items, total } = body;
    const ip = getClientIp(req as Request);

    // 1. Check for malicious injection patterns in order data
    if (containsMaliciousPayload(body)) {
      return sendJson(res, 400, {
        success: false,
        error: 'Order payload rejected: Suspicious character sequence detected.'
      });
    }

    // 2. Validate Order Content Integrity
    if (!Array.isArray(items) || items.length === 0) {
      return sendJson(res, 400, {
        success: false,
        error: 'Order must contain at least one item.'
      });
    }

    if (items.length > 50) {
      return sendJson(res, 400, {
        success: false,
        error: 'Exceeded maximum permitted item quantity per order.'
      });
    }

    if (typeof total !== 'number' || total <= 0 || total > 5000000) {
      return sendJson(res, 400, {
        success: false,
        error: 'Invalid order amount.'
      });
    }

    // Validate phone number format (must be 10 digits Indian phone)
    const cleanPhone = String(customerPhone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return sendJson(res, 400, {
        success: false,
        error: 'A valid 10-digit mobile number is required.'
      });
    }

    // 3. Daily Order Limit Enforcement (Max 3 orders in a day)
    const rateCheck = checkAndRecordOrderRate(
      userId || 'guest',
      customerEmail || '',
      ip
    );

    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        success: false,
        error: rateCheck.error || 'Daily order limit reached. You can only place up to 3 orders per day.',
        cooldownSeconds: rateCheck.cooldownSeconds,
        remainingToday: rateCheck.remainingToday
      });
    }

    return sendJson(res, 200, {
      success: true,
      message: 'Order rate check passed.',
      remainingToday: rateCheck.remainingToday
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      success: false,
      error: err.message || 'Server error during order rate limit verification.'
    });
  }
}
