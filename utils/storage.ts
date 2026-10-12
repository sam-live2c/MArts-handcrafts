/**
 * Safe browser storage utility for MArts.
 * Guarantees that browser storage quota limits, private browsing restrictions,
 * or DOMExceptions NEVER crash or interrupt Cloud Firebase authentication,
 * order processing, or user navigation.
 * 
 * Cloud Firebase Firestore is always the authoritative cloud database.
 */

import { User } from '../types';

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // Storage quota exceeded or disabled. Purge legacy/bulk items and retry once.
      try {
        this.purgeLegacyAndBulkyKeys();
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        // Gracefully fail silently so Cloud Firebase operations are not blocked
        return false;
      }
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {}
  },

  purgeLegacyAndBulkyKeys(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        // Purge old melody/agronic keys and huge cached product/order blobs
        if (
          k.startsWith('melody_') || 
          k.startsWith('agronic_') || 
          k === 'marts_products' || 
          k.startsWith('marts_orders_')
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try { window.localStorage.removeItem(k); } catch {}
      });
    } catch {}
  }
};

// Run proactive cleanup of legacy keys on module import
if (typeof window !== 'undefined') {
  try {
    safeStorage.purgeLegacyAndBulkyKeys();
  } catch {}
}

/**
 * Strips unbounded heavy data (such as orders array with files, artwork previews, etc.)
 * before optional local caching so the cached user profile stays under 2KB.
 * Full orders, addresses, and details are always retrieved directly from Cloud Firestore.
 */
export function sanitizeUserForCache(user: User | null): User | null {
  if (!user) return null;
  return {
    ...user,
    orders: [] // Full orders are managed in Cloud Firestore database
  };
}
