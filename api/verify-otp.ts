import {
  otpStore,
  verifyOtpToken
} from '../utils/otp';

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
      } else {
        return sendJson(res, 400, {
          success: false,
          error: tokenResult.error || 'Invalid verification code'
        });
      }
    }

    // 2. Fallback to in-memory store check
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return sendJson(res, 400, {
        success: false,
        error: 'No active verification code found for this email. Please request a new code.'
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
      return sendJson(res, 400, {
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.'
      });
    }

    if (record.otp !== cleanOtp) {
      return sendJson(res, 400, {
        success: false,
        error: 'Invalid verification code. Please check the code and try again.'
      });
    }

    // Successfully verified! Clear OTP to prevent replay attacks
    otpStore.delete(cleanEmail);

    return sendJson(res, 200, {
      success: true,
      message: 'Email successfully verified'
    });
  } catch (error: any) {
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Server error while verifying OTP'
    });
  }
}
