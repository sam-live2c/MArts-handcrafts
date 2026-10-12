/**
 * Universal Indian Mobile Phone Number Utility
 * Handles '+91', country code prefixes, spaces, hyphens, and leading zeroes.
 */

export function normalizeIndianPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function isValidIndianPhone(raw?: string | null): boolean {
  const normalized = normalizeIndianPhone(raw);
  return normalized.length === 10 && /^[6-9]\d{9}$/.test(normalized);
}

export function formatIndianPhoneDisplay(raw?: string | null): string {
  const normalized = normalizeIndianPhone(raw);
  if (normalized.length === 10) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return raw || '';
}
