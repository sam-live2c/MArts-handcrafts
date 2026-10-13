import crypto from 'crypto';

export const RESEND_API_KEY = (process.env.RESEND_API_KEY || 're_5CqJrQpS_C8u5pQs5NHCWZynddoyubg4Y')
  .trim()
  .replace(/^["']|["']$/g, '');

export const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || 'MArts <auth@martsindia.in>')
  .trim()
  .replace(/^["']|["']$/g, '');

const OTP_SECRET = (process.env.OTP_SECRET || process.env.RESEND_API_KEY || 'marts_artisan_secret_key_2026')
  .trim()
  .replace(/^["']|["']$/g, '');

export interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  type: string;
}

// In-memory fallback store
export const otpStore = new Map<string, OtpRecord>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of otpStore.entries()) {
      if (record.expiresAt < now) {
        otpStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

/**
 * Generate 6-digit numeric OTP code
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate cryptographic HMAC verification token
 * format: ${expiresAt}.${hmac}
 */
export function generateOtpToken(email: string, otp: string, expiresAt: number): string {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = `${normalizedEmail}:${otp.trim()}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

/**
 * Verify cryptographic HMAC verification token
 */
export function verifyOtpToken(
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

/**
 * Generate MArts branded HTML email for OTP verification
 */
export function buildOtpEmailHtml(otp: string, type: string = 'login'): string {
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
                Uart &amp; MArts Handcrafted Guild • Vill. Asanbani, P.O. Chandra, P.S. Siyaljori, Dist. Bokaro, Jharkhand, India
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
