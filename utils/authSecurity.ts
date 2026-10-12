/**
 * Client-Side Auth and Order Security Service
 * Integrates with /api/auth-security and /api/order-security
 */

export interface LoginSecurityCheck {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMinutes?: number;
}

export interface LoginReportResult {
  remainingAttempts?: number;
  isLocked?: boolean;
  lockoutMinutes?: number;
}

export interface OrderSecurityCheck {
  allowed: boolean;
  error?: string;
  cooldownSeconds?: number;
  remainingToday?: number;
}

/**
 * Checks if target email or client is currently locked out before attempting password or credentials login
 */
export async function checkLoginAttemptAllowed(email: string): Promise<LoginSecurityCheck> {
  try {
    const res = await fetch('/api/auth-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', email })
    });
    if (!res.ok) {
      return { allowed: true, remainingAttempts: 5 };
    }
    const data = await res.json();
    return {
      allowed: data.allowed !== false,
      remainingAttempts: typeof data.remainingAttempts === 'number' ? data.remainingAttempts : 5,
      retryAfterMinutes: data.retryAfterMinutes
    };
  } catch {
    // Fail-open for client network glitches so legit users aren't stranded
    return { allowed: true, remainingAttempts: 5 };
  }
}

/**
 * Reports login result to backend to update rate limit counters and block brute-force attackers
 */
export async function reportLoginAttempt(email: string, success: boolean): Promise<LoginReportResult> {
  try {
    const res = await fetch('/api/auth-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', email, success })
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Validates order rate limits and data sanity before order submission
 */
export async function validateOrderRateLimit(orderPayload: {
  userId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  items: any[];
  total: number;
}): Promise<OrderSecurityCheck> {
  try {
    const lightweightItems = (orderPayload.items || []).map(item => ({
      id: item?.id,
      title: item?.title || item?.name,
      quantity: Number(item?.quantity) || 1,
      price: Number(item?.price) || 0
    }));

    const res = await fetch('/api/order-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderPayload,
        items: lightweightItems
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      return {
        allowed: false,
        error: data.error || 'Daily order limit reached. You can only place up to 3 orders per day.',
        cooldownSeconds: data.cooldownSeconds,
        remainingToday: data.remainingToday !== undefined ? data.remainingToday : 0
      };
    }

    return { 
      allowed: true,
      remainingToday: data.remainingToday 
    };
  } catch {
    return { allowed: true };
  }
}
