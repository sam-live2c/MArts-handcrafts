/**
 * Resend OTP Service
 * Communicates with backend /api/send-otp and /api/verify-otp endpoints.
 */

export interface SendOtpResult {
  success: boolean;
  delivered?: boolean;
  resendId?: string;
  token?: string;
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

      let data: any;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[resendService.sendOtp non-JSON response]', response.status, text.slice(0, 150));
        let errorMsg = `Server error (Status ${response.status}). Please try again.`;
        if (response.status === 404) {
          errorMsg = 'Verification route not found (404). Please ensure latest deployment is live.';
        } else if (text && text.length < 120 && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
          errorMsg = text.trim();
        }
        return {
          success: false,
          error: errorMsg
        };
      }

      if (!response.ok && !data.domainRestricted) {
        return {
          success: false,
          error: data.error || 'Failed to send verification code. Please try again.'
        };
      }

      // Store verification token for stateless serverless verification
      if (data.token) {
        try {
          sessionStorage.setItem('marts_otp_token', data.token);
        } catch (_) {}
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
      let token: string | null = null;
      try {
        token = sessionStorage.getItem('marts_otp_token');
      } catch (_) {}

      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, otp, token })
      });

      let data: any;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[resendService.verifyOtp non-JSON response]', response.status, text.slice(0, 150));
        let errorMsg = `Server error (Status ${response.status}). Please try again.`;
        if (text && text.length < 120 && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
          errorMsg = text.trim();
        }
        return {
          success: false,
          error: errorMsg
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Invalid verification code.'
        };
      }

      // Clean up token after successful verification
      try {
        sessionStorage.removeItem('marts_otp_token');
      } catch (_) {}

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
      const text = await response.text();
      return JSON.parse(text);
    } catch {
      return { status: 'error', resendConfigured: false };
    }
  }
};
