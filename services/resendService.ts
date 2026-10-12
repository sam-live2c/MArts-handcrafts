/**
 * Resend OTP Service
 * Communicates with backend /api/send-otp and /api/verify-otp endpoints.
 */

export interface SendOtpResult {
  success: boolean;
  delivered?: boolean;
  resendId?: string;
  domainRestricted?: boolean;
  registeredOwnerEmail?: string;
  otp?: string;
  message?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const resendService = {
  /**
   * Request OTP delivery to user's email via Resend
   */
  async sendOtp(email: string, type: 'login' | 'signup' | 'reset' = 'login'): Promise<SendOtpResult> {
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, type })
      });

      const data = await response.json();

      if (!response.ok && !data.domainRestricted) {
        return {
          success: false,
          error: data.error || 'Failed to send verification code. Please try again.'
        };
      }

      return data;
    } catch (err: any) {
      console.error('[resendService.sendOtp error]', err);
      return {
        success: false,
        error: err.message || 'Network error while contacting verification server.'
      };
    }
  },

  /**
   * Verify entered 6-digit OTP code against server
   */
  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Invalid verification code.'
        };
      }

      return {
        success: true,
        message: data.message || 'Code verified successfully.'
      };
    } catch (err: any) {
      console.error('[resendService.verifyOtp error]', err);
      return {
        success: false,
        error: err.message || 'Network error while verifying code.'
      };
    }
  },

  /**
   * Check Resend setup configuration status
   */
  async checkStatus(): Promise<{ status: string; resendConfigured: boolean; fromEmail?: string }> {
    try {
      const response = await fetch('/api/resend-status');
      return await response.json();
    } catch {
      return { status: 'error', resendConfigured: false };
    }
  }
};
