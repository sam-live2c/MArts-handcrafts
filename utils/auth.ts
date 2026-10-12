/**
 * Password hashing and identity linking utilities
 * Works with Firebase Authentication for unified identity
 */

import { 
  User as FirebaseUser, 
  GoogleAuthProvider, 
  EmailAuthProvider, 
  linkWithPopup, 
  linkWithCredential, 
  unlink,
  updatePassword
} from 'firebase/auth';

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

export interface LinkedProvidersInfo {
  hasPassword: boolean;
  hasGoogle: boolean;
  hasPhone: boolean;
  providers: string[];
  primaryEmail: string;
}

/**
 * Returns the list and status of authentication providers linked to a Firebase user.
 */
export function getLinkedProviders(firebaseUser: FirebaseUser | null): LinkedProvidersInfo {
  if (!firebaseUser) {
    return {
      hasPassword: false,
      hasGoogle: false,
      hasPhone: false,
      providers: [],
      primaryEmail: ''
    };
  }

  const providers = (firebaseUser.providerData || []).map(p => p.providerId);
  return {
    hasPassword: providers.includes('password'),
    hasGoogle: providers.includes('google.com'),
    hasPhone: providers.includes('phone'),
    providers,
    primaryEmail: firebaseUser.email || ''
  };
}

/**
 * Explicitly links Google Sign-In to the currently signed-in user account.
 */
export async function linkGoogleToAccount(currentUser: FirebaseUser): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await linkWithPopup(currentUser, provider);
    return { success: true };
  } catch (err: any) {
    console.warn('linkGoogleToAccount error:', err);
    if (err.code === 'auth/credential-already-in-use') {
      return { 
        success: false, 
        error: 'This Google account is already linked to another user. Please log in with that Google account directly.' 
      };
    }
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Linking was cancelled.' };
    }
    return { success: false, error: err.message || 'Failed to link Google account.' };
  }
}

/**
 * Links email and password authentication to the currently signed-in user account
 * (e.g. for a user who originally created their account with Google).
 */
export async function linkPasswordToAccount(
  currentUser: FirebaseUser, 
  password: string
): Promise<{ success: boolean; error?: string }> {
  const email = (currentUser.email || '').trim().toLowerCase();
  if (!email) {
    return { success: false, error: 'Current account does not have an associated email address.' };
  }

  try {
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(currentUser, credential);
    return { success: true };
  } catch (err: any) {
    // If provider is already linked, update the password instead
    if (err.code === 'auth/provider-already-linked') {
      try {
        await updatePassword(currentUser, password);
        return { success: true };
      } catch (pwErr: any) {
        return { success: false, error: pwErr.message || 'Failed to update account password.' };
      }
    }
    if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
      return {
        success: false,
        error: 'An account with this email/password already exists. Both identities have verified access.'
      };
    }
    return { success: false, error: err.message || 'Failed to set account password.' };
  }
}

/**
 * Securely unlinks an authentication provider from the user account,
 * preventing account lockout by requiring at least one provider to remain.
 */
export async function unlinkProviderFromAccount(
  currentUser: FirebaseUser,
  providerId: 'google.com' | 'password'
): Promise<{ success: boolean; error?: string }> {
  if (!currentUser.providerData || currentUser.providerData.length <= 1) {
    return { 
      success: false, 
      error: 'Cannot disconnect the only sign-in method. Add a password or Google account first.' 
    };
  }

  try {
    await unlink(currentUser, providerId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to disconnect provider.' };
  }
}
