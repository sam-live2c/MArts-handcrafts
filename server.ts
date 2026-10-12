import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// In-memory OTP Store: email -> { otp, expiresAt, attempts, type }
interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  type: string;
}

const otpStore = new Map<string, OtpRecord>();

// Clean up expired OTPs periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_5CqJrQpS_C8u5pQs5NHCWZynddoyubg4Y';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'MArts India <onboarding@resend.dev>';

/**
 * Generate MArts branded HTML email for OTP verification
 */
function buildOtpEmailHtml(otp: string, type: string = 'login'): string {
  const isReset = type === 'reset';
  const isSignup = type === 'signup';
  const actionText = isReset ? 'password reset' : isSignup ? 'account registration' : 'one-time login';
  const actionTitle = isReset ? 'Reset Your Password' : isSignup ? 'Verify Your Account' : 'Verify Your Email';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MArts Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2B221B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAF7F2; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #EADBCC; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #C85A32 0%, #A04724 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: 1px; font-family: Georgia, serif;">MArts</h1>
              <p style="margin: 6px 0 0; color: #F5DAC9; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Handcrafted Pottery &amp; Artisanal Guild</p>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 36px 32px 24px;">
              <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #2B221B; text-align: center;">${actionTitle}</h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6E5343; text-align: center;">
                Use the verification code below to complete your ${actionText} on MArts India.
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center">
                    <div style="background-color: #FAF4EE; border: 2px dashed #C85A32; border-radius: 14px; padding: 18px 24px; display: inline-block;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #C85A32; display: block;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #F8F6F2; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; border: 1px solid #EAE2D8;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7A6253;">
                  <strong style="color: #2B221B;">Security Reminder:</strong> This code is valid for <strong>10 minutes</strong>. Never share this code with anyone. MArts personnel will never ask for your verification code.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9C8272; text-align: center;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8F5; padding: 20px 30px; text-align: center; border-top: 1px solid #EFE8DF;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #8A7263; font-weight: 600;">
                MArts Handcrafted Guild • North 24 Parganas, West Bengal, India
              </p>
              <p style="margin: 0; font-size: 10px; color: #B09B8E;">
                Authentic Terracotta, Ceramic Vases &amp; Heritage Sculptures
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

// ================= API ROUTES =================

/**
 * Health & Resend status check
 */
app.get('/api/resend-status', (_req: Request, res: Response) => {
  const hasKey = Boolean(RESEND_API_KEY && RESEND_API_KEY.startsWith('re_'));
  res.json({
    status: 'ok',
    resendConfigured: hasKey,
    fromEmail: RESEND_FROM_EMAIL,
    keyPrefix: hasKey ? RESEND_API_KEY.slice(0, 7) + '...' : 'none'
  });
});

/**
 * Send OTP via Resend email API
 */
app.post('/api/send-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, type = 'login' } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email address is required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ success: false, error: 'Invalid email address format' });
      return;
    }

    // Rate limiting check (min 15 seconds between requests for same email)
    const existing = otpStore.get(cleanEmail);
    const now = Date.now();
    if (existing && existing.expiresAt - now > (10 * 60 * 1000 - 15 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'Please wait a moment before requesting another code'
      });
      return;
    }

    // Generate fresh 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

    // Save in store
    otpStore.set(cleanEmail, {
      otp,
      expiresAt,
      attempts: 0,
      type
    });

    const isReset = type === 'reset';
    const isSignup = type === 'signup';
    const emailSubject = isReset
      ? `${otp} is your MArts password reset code`
      : isSignup
      ? `${otp} is your MArts signup verification code`
      : `${otp} is your MArts email verification code`;
    const emailHtml = buildOtpEmailHtml(otp, type);

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

    const resendData: any = await resendResponse.json();

    if (resendResponse.ok) {
      console.log(`[Resend] Successfully sent OTP email to ${cleanEmail}. Resend ID: ${resendData.id}`);
      res.json({
        success: true,
        delivered: true,
        resendId: resendData.id,
        message: `Verification code sent to ${cleanEmail}`
      });
      return;
    }

    console.warn('[Resend] Response from API:', resendResponse.status, resendData);

    // Handle Resend free tier unverified domain restriction gracefully
    // (Resend free account allows sending only to owner's registered email when from onboarding@resend.dev)
    if (
      resendResponse.status === 403 ||
      resendResponse.status === 422 ||
      (resendData.message && (
        resendData.message.includes('verify a domain') ||
        resendData.message.includes('testing email') ||
        resendData.message.includes('only send testing emails') ||
        resendData.name === 'validation_error'
      ))
    ) {
      console.info(`[Resend Notice] Recipient ${cleanEmail} outside verified domain. Providing test OTP fallback.`);
      res.json({
        success: true,
        delivered: false,
        domainRestricted: true,
        otp, // Return OTP so developer/user in test environment is never blocked
        registeredOwnerEmail: 'sahinurmolla190@gmail.com',
        message: 'Verification code generated. (Emails to your Resend account sahinurmolla190@gmail.com are delivered directly; to send to other recipients, verify a custom domain at resend.com/domains).'
      });
      return;
    }

    // Generic Resend error
    res.status(resendResponse.status || 500).json({
      success: false,
      error: resendData.message || 'Failed to send email via Resend'
    });
  } catch (error: any) {
    console.error('[Resend Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while sending OTP'
    });
  }
});

/**
 * Verify OTP
 */
app.post('/api/verify-otp', (req: Request, res: Response): void => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ success: false, error: 'Email and OTP code are required' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const record = otpStore.get(cleanEmail);

    if (!record) {
      res.status(400).json({
        success: false,
        error: 'No active verification code found for this email. Please request a new code.'
      });
      return;
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
      return;
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      otpStore.delete(cleanEmail);
      res.status(400).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.'
      });
      return;
    }

    if (record.otp !== cleanOtp) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please check the code and try again.'
      });
      return;
    }

    // Successfully verified! Clear OTP to prevent replay attacks
    otpStore.delete(cleanEmail);

    res.json({
      success: true,
      message: 'Email successfully verified'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while verifying OTP'
    });
  }
});

// ================= FRONTEND MOUNTING =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite dev server middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] MArts Express + Vite running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Failed to start server:', err);
  process.exit(1);
});
