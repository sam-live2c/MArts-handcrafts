/**
 * Safe browser storage utility for MArts.
 * Guarantees that browser storage quota limits, private browsing restrictions,
 * or DOMExceptions NEVER crash or interrupt Cloud Firebase authentication,
 * order processing, or user navigation.
 * 
 * Cloud Firebase Firestore is always the authoritative cloud database.
 */

import { User, CartItem, ItemCustomization } from '../types';

const inMemoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return inMemoryStore.get(key) ?? null;
      }
      return window.localStorage.getItem(key);
    } catch {
      return inMemoryStore.get(key) ?? null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        inMemoryStore.set(key, value);
        return true;
      }
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // Storage quota exceeded or disabled. Purge legacy/bulk items and retry once.
      try {
        this.purgeLegacyAndBulkyKeys();
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        inMemoryStore.set(key, value);
        return true;
      }
    }
  },

  removeItem(key: string): void {
    try {
      inMemoryStore.delete(key);
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {}
  },

  clear(): void {
    try {
      inMemoryStore.clear();
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.clear();
    } catch {}
  },

  /**
   * Safely serializes and caches an object with optional sanitizer.
   * If value is too bulky or quota is exceeded, gracefully falls back without throwing.
   */
  setJson<T>(key: string, value: T, sanitizer?: (val: T) => any): boolean {
    try {
      const payload = sanitizer ? sanitizer(value) : value;
      const serialized = JSON.stringify(payload);
      return this.setItem(key, serialized);
    } catch {
      return false;
    }
  },

  /**
   * Safely retrieves and parses JSON from storage.
   */
  getJson<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  purgeLegacyAndBulkyKeys(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        // Purge old melody/agronic keys and huge cached product/order/customization blobs
        if (
          k.startsWith('melody_') || 
          k.startsWith('agronic_') || 
          k === 'marts_products' || 
          k.startsWith('marts_orders') ||
          k.includes('customizations_cache')
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

/**
 * Strips heavy data URLs (e.g. base64 image strings > 2KB) from customization caches.
 */
export function sanitizeCustomizationsForCache(
  customizations: Record<string, ItemCustomization> | null | undefined
): Record<string, ItemCustomization> {
  if (!customizations || typeof customizations !== 'object') return {};
  const sanitized: Record<string, ItemCustomization> = {};
  for (const [key, val] of Object.entries(customizations)) {
    if (val && typeof val === 'object') {
      const files = Array.isArray(val.files) ? val.files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        // Strip out large data: URLs from local storage cache
        previewUrl: (typeof f.previewUrl === 'string' && f.previewUrl.startsWith('data:') && f.previewUrl.length > 1024)
          ? ''
          : f.previewUrl,
        storageUrl: f.storageUrl
      })) : [];
      sanitized[key] = {
        confirmed: Boolean(val.confirmed),
        files
      };
    }
  }
  return sanitized;
}

/**
 * Strips heavy preview data URLs from cart items before caching.
 */
export function sanitizeCartForCache(items: CartItem[]): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (!item.customization || !Array.isArray(item.customization.files)) return item;
    return {
      ...item,
      customization: {
        ...item.customization,
        files: item.customization.files.map(f => ({
          ...f,
          previewUrl: (typeof f.previewUrl === 'string' && f.previewUrl.startsWith('data:') && f.previewUrl.length > 1024)
            ? ''
            : f.previewUrl
        }))
      }
    };
  });
}

/**
 * Dispatches a universal user profile update event to keep all active tabs & components in sync.
 */
export function broadcastUserUpdate(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('marts_user_updated', { detail: user }));
    // Alias for backwards compatibility
    window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: user }));
  } catch {}
}
