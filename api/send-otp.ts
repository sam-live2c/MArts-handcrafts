import {
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  otpStore,
  generateOtp,
  generateOtpToken,
  buildOtpEmailHtml
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

    const { email, type = 'login' } = body;

    if (!email || typeof email !== 'string') {
      return sendJson(res, 400, { success: false, error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return sendJson(res, 400, { success: false, error: 'Invalid email address format' });
    }

    const now = Date.now();
    const existing = otpStore.get(cleanEmail);
    // Rate limit: 15 seconds cooldown
    if (existing && existing.expiresAt - now > (10 * 60 * 1000 - 15 * 1000)) {
      return sendJson(res, 429, {
        success: false,
        error: 'Please wait a moment before requesting another code'
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

    // Generate cryptographic HMAC token so verification works across stateless serverless instances
    const token = generateOtpToken(cleanEmail, otp, expiresAt);

    const isReset = type === 'reset';
    const isSignup = type === 'signup';
    const emailSubject = isReset
      ? `${otp} is your MArts password reset code`
      : isSignup
      ? `${otp} is your MArts signup verification code`
      : `${otp} is your MArts email verification code`;
    const emailHtml = buildOtpEmailHtml(otp, type);

    if (!RESEND_API_KEY) {
      return sendJson(res, 500, {
        success: false,
        error: 'Email verification service is temporarily unconfigured.'
      });
    }

    // Call Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
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

    const resendData: any = await resendResponse.json().catch(() => ({}));

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
