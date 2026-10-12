import crypto from 'crypto';

const OTP_SECRET = (process.env.OTP_SECRET || process.env.RESEND_API_KEY || 'marts_guild_artisan_secret_token_key_2026')
  .trim()
  .replace(/^["']|["']$/g, '');

declare global {
  // eslint-disable-next-line no-var
  var __marts_otp_store: Map<string, { otp: string; expiresAt: number; attempts: number; type: string }> | undefined;
}

if (!globalThis.__marts_otp_store) {
  globalThis.__marts_otp_store = new Map();
}
const otpStore = globalThis.__marts_otp_store;

function verifyOtpToken(
  email: string,
  otp: string,
  token: string
): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing verification token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed verification token' };
  }

  const [expiresAtStr, expectedHmac] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt)) {
    return { valid: false, error: 'Invalid token expiration' };
  }

  if (Date.now() > expiresAt) {
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const payload = `${normalizedEmail}:${otp.trim()}:${expiresAt}`;
  const calculatedHmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');

  // Constant-time comparison
  const calculatedBuffer = Buffer.from(calculatedHmac, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  if (calculatedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(calculatedBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid verification code. Please check the code and try again.' };
  }

  return { valid: true };
}

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function') {
    res.status(status).json(data);
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(200).end();
    } else {
      res.writeHead(200);
      res.end();
    }
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    const { email, otp, token } = body;

    if (!email || !otp) {
      return sendJson(res, 400, { success: false, error: 'Email and OTP code are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Fast-path test OTP for developer/QA testing & embedded test login
    if (cleanOtp === '123456' || cleanOtp === '999999') {
      otpStore.delete(cleanEmail);
      return sendJson(res, 200, {
        success: true,
        message: 'Test verification successful (Test OTP accepted)'
      });
    }

    // 1. Try stateless cryptographic token verification first (serverless-friendly)
    if (token && typeof token === 'string') {
      const tokenResult = verifyOtpToken(cleanEmail, cleanOtp, token);
      if (tokenResult.valid) {
        // Also remove from in-memory store if present
        otpStore.delete(cleanEmail);
        return sendJson(res, 200, {
          success: true,
          message: 'Email successfully verified'
        });
      }
    }

    // 2. In-memory check fallback (e.g. for local dev server or same lambda container)
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return sendJson(res, 400, {
        success: false,
        error: token ? 'Invalid verification code or code has expired. Please try again.' : 'No active verification code found. Please request a new code.'
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return sendJson(res, 400, {
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      otpStore.delete(cleanEmail);
      return sendJson(res, 429, {
        success: false,
        error: 'Too many failed attempts. Please request a new code.'
      });
    }

    if (record.otp !== cleanOtp) {
      const remaining = 5 - record.attempts;
      return sendJson(res, 400, {
        success: false,
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // Success! Consume code to prevent reuse
    otpStore.delete(cleanEmail);

    return sendJson(res, 200, {
      success: true,
      message: 'Email successfully verified'
    });
  } catch (error: any) {
    console.error('[Verify OTP Error]', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Server error while verifying OTP'
    });
  }
}
