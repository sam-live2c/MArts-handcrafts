/**
 * Password hashing utility using Web Crypto API
 * Safe, zero-dependency, works in all modern browsers
 */
export async function hashPassword(plain: string): Promise<string> {
  const salted = plain + ':marts_guild_salt_2026';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder().encode(salted);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Node / fallback environment
  try {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(salted).digest('hex');
  } catch {
    return salted;
  }
}

