import crypto from 'crypto';
import { containsMaliciousPayload, getClientIp } from './security';

// Configuration from environment variables
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '');

const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || 'MArts <auth@martsindia.in>')
  .trim()
  .replace(/^["']|["']$/g, '');

const OTP_SECRET = (process.env.OTP_SECRET || 'marts_guild_artisan_secret_token_key_2026')
  .trim()
  .replace(/^["']|["']$/g, '');

// Global in-memory fallback store
declare global {
  // eslint-disable-next-line no-var
  var __marts_otp_store: Map<string, { otp: string; expiresAt: number; attempts: number; type: string }> | undefined;
}

if (!globalThis.__marts_otp_store) {
  globalThis.__marts_otp_store = new Map();
}
const otpStore = globalThis.__marts_otp_store;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOtpToken(email: string, otp: string, expiresAt: number): string {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = `${normalizedEmail}:${otp.trim()}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

function buildOtpEmailHtml(otp: string, type: string = 'login'): string {
  const isReset = type === 'reset';
  const isSignup = type === 'signup';

  const title = isReset
    ? 'Reset Your Password'
    : isSignup
    ? 'Verify Your MArts Account'
    : 'Sign In to MArts';

  const description = isReset
    ? 'We received a request to reset your password. Use the verification code below to set a new password:'
    : isSignup
    ? 'Welcome to MArts! Complete your registration by entering the verification code below:'
    : 'Use the one-time verification code below to securely sign in to your MArts account:';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 36px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">MArts</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #bae6fd; font-weight: 500;">Authentic Indian Handcrafted Treasures</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;">${title}</h2>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 22px; color: #475569; text-align: center;">${description}</p>
              
              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 14px; padding: 18px 36px; text-align: center;">
                      <span style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #15803d; font-family: 'Courier New', Courier, monospace;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: #64748b; text-align: center;">
                This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8; text-align: center;">
                If you did not request this verification code, please disregard this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} MArts Artisan Guild. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    if (containsMaliciousPayload(body)) {
      return sendJson(res, 400, { success: false, error: 'Suspicious payload rejected' });
    }

    const { email, type = 'login' } = body;

    if (!email || typeof email !== 'string') {
      return sendJson(res, 400, { success: false, error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 100 || !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(cleanEmail)) {
      return sendJson(res, 400, { success: false, error: 'Invalid email address format' });
    }

    const now = Date.now();
    const existing = otpStore.get(cleanEmail);
    // Rate limit: 30 seconds cooldown between OTP requests
    if (existing && existing.expiresAt - now > (10 * 60 * 1000 - 30 * 1000)) {
      const waitSec = Math.ceil(((existing.expiresAt - (10 * 60 * 1000 - 30 * 1000)) - now) / 1000);
      return sendJson(res, 429, {
        success: false,
        error: `Please wait ${Math.max(1, waitSec)} seconds before requesting another code.`
      });
    }

    const otp = generateOtp();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

    // Save in in-memory store
    otpStore.set(cleanEmail, {
      otp,
      expiresAt,
      attempts: 0,
      type
    });

    // Generate cryptographic HMAC token so verification works statelessly across serverless instances
    const token = generateOtpToken(cleanEmail, otp, expiresAt);

    const isReset = type === 'reset';
    const isSignup = type === 'signup';
    const emailSubject = isReset
      ? `${otp} is your MArts password reset code`
      : isSignup
      ? `${otp} is your MArts signup verification code`
      : `${otp} is your MArts email verification code`;
    const emailHtml = buildOtpEmailHtml(otp, type);

    console.log(`[MArts OTP] Generated verification code for ${cleanEmail} (${type}): ${otp}`);

    if (!RESEND_API_KEY) {
      console.log(`[Dev OTP] RESEND_API_KEY not configured. Verification code for ${cleanEmail}: ${otp}`);
      return sendJson(res, 200, {
        success: true,
        delivered: false,
        token,
        otp,
        message: `Dev verification code: ${otp}`
      });
    }

    // Call Resend REST API
    let resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [cleanEmail],
        subject: emailSubject,
        html: emailHtml
      })
    });

    let resendData: any = await resendResponse.json().catch(() => ({}));

    // If custom domain returns error, retry with onboarding@resend.dev
    if (!resendResponse.ok && RESEND_FROM_EMAIL !== 'onboarding@resend.dev') {
      try {
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: [cleanEmail],
            subject: emailSubject,
            html: emailHtml
          })
        });
        if (retryRes.ok) {
          resendResponse = retryRes;
          resendData = await retryRes.json().catch(() => ({}));
        }
      } catch (_) {}
    }

    if (resendResponse.ok) {
      console.log(`[Resend] Successfully sent OTP email to ${cleanEmail}. ID: ${resendData?.id}`);
      return sendJson(res, 200, {
        success: true,
        delivered: true,
        resendId: resendData?.id,
        token,
        message: `Verification code sent to ${cleanEmail}`
      });
    }

    console.warn('[Resend] Response from API:', resendResponse.status, resendData);

    // Development or test fallback if email service encounters domain/rate limits
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Dev Fallback OTP] Returning generated verification code for ${cleanEmail}: ${otp}`);
      return sendJson(res, 200, {
        success: true,
        delivered: false,
        token,
        otp,
        message: `Verification code: ${otp}`
      });
    }

    return sendJson(res, resendResponse.status || 500, {
      success: false,
      error: resendData?.message || 'Failed to send verification code via email'
    });
  } catch (error: any) {
    console.error('[Resend Error]', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Server error while sending OTP'
    });
  }
}
