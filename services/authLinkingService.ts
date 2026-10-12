import { 
  AuthCredential, 
  GoogleAuthProvider, 
  EmailAuthProvider, 
  linkWithCredential, 
  linkWithPopup, 
  unlink, 
  updatePassword, 
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { hashPassword } from '../utils/auth';

export interface LinkedProvidersStatus {
  email: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  providers: string[];
}

let memoryPendingCredential: AuthCredential | null = null;

export function setPendingGoogleCredential(cred: AuthCredential | null) {
  memoryPendingCredential = cred;
}

export function getPendingGoogleCredential(): AuthCredential | null {
  return memoryPendingCredential;
}

/**
 * Returns the active authentication providers linked to the current Firebase user
 */
export function getLinkedProviders(user: FirebaseUser | null = auth.currentUser): LinkedProvidersStatus {
  if (!user) {
    return {
      email: null,
      hasPassword: false,
      hasGoogle: false,
      providers: []
    };
  }

  const providerIds = (user.providerData || []).map(p => p.providerId);
  return {
    email: user.email,
    hasPassword: providerIds.includes('password'),
    hasGoogle: providerIds.includes('google.com'),
    providers: providerIds
  };
}

/**
 * Link Google provider to the currently authenticated user
 */
export async function linkGoogleToCurrentUser(): Promise<{ success: boolean; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, error: 'No authenticated user found. Please sign in first.' };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await linkWithPopup(currentUser, provider);
    
    const providerIds = (currentUser.providerData || []).map(p => p.providerId);
    const cleanEmail = (currentUser.email || '').trim().toLowerCase();
    const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Update canonical profile record
    const updates: Record<string, any> = {
      linkedProviders: providerIds,
      emailVerified: currentUser.emailVerified,
      updatedAt: new Date().toISOString()
    };
    if (currentUser.photoURL) updates.avatar = currentUser.photoURL;

    await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    if (emailDocId !== currentUser.uid) {
      await setDoc(doc(db, 'users', emailDocId), updates, { merge: true }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    if (err.code === 'auth/credential-already-in-use') {
      return { 
        success: false, 
        error: 'This Google account is already linked to another registered profile. Please use that account or disconnect it first.' 
      };
    }
    if (err.code === 'auth/provider-already-linked') {
      return { success: true };
    }
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Sign-in popup was closed before linking completed.' };
    }
    return { success: false, error: err.message || 'Failed to link Google account.' };
  }
}

/**
 * Set or link an email/password credential to the currently authenticated user
 * (e.g. user created account with Google and now wants to enable email/password sign-in,
 * or change their password)
 */
export async function linkPasswordToCurrentUser(password: string): Promise<{ success: boolean; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    return { success: false, error: 'User must be signed in with a valid email address.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  try {
    const cleanEmail = currentUser.email.trim().toLowerCase();
    const credential = EmailAuthProvider.credential(cleanEmail, password);
    try {
      await linkWithCredential(currentUser, credential);
    } catch (linkErr: any) {
      if (linkErr.code === 'auth/provider-already-linked') {
        // Already has password provider, simply update the password
        await updatePassword(currentUser, password);
      } else {
        throw linkErr;
      }
    }

    // Keep Firestore profile linkedProviders and passwordHash in sync
    const pwdHash = await hashPassword(password);
    const providerIds = (currentUser.providerData || []).map(p => p.providerId);
    if (!providerIds.includes('password')) providerIds.push('password');

    const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const updatePayload = {
      passwordHash: pwdHash,
      linkedProviders: providerIds,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', currentUser.uid), updatePayload, { merge: true });
    if (emailDocId !== currentUser.uid) {
      await setDoc(doc(db, 'users', emailDocId), updatePayload, { merge: true }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    if (err.code === 'auth/requires-recent-login') {
      return { 
        success: false, 
        error: 'For security, please sign out and sign back in before setting a new password.' 
      };
    }
    return { success: false, error: err.message || 'Failed to set password.' };
  }
}

/**
 * Unlink a provider from current user account (preserving at least 1 sign-in method)
 */
export async function unlinkProviderFromCurrentUser(providerId: 'google.com' | 'password'): Promise<{ success: boolean; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) return { success: false, error: 'Not signed in.' };

  const providerIds = (currentUser.providerData || []).map(p => p.providerId);
  if (providerIds.length <= 1) {
    return { 
      success: false, 
      error: 'Cannot disconnect your only sign-in method. Please set a password or connect another method first.' 
    };
  }

  try {
    await unlink(currentUser, providerId);
    const remainingProviders = (currentUser.providerData || []).map(p => p.providerId).filter(p => p !== providerId);

    const cleanEmail = (currentUser.email || '').trim().toLowerCase();
    const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    const updates: Record<string, any> = {
      linkedProviders: remainingProviders,
      updatedAt: new Date().toISOString()
    };
    if (providerId === 'password') {
      updates.passwordHash = null;
    }

    await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    if (emailDocId !== currentUser.uid) {
      await setDoc(doc(db, 'users', emailDocId), updates, { merge: true }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unlink provider.' };
  }
}

/**
 * Completes linking a pending credential (from an account-exists-with-different-credential error)
 * after the user successfully reauthenticates with their existing password.
 */
export async function linkPendingCredential(
  authenticatedUser: FirebaseUser,
  pendingCredential: AuthCredential
): Promise<{ success: boolean; error?: string }> {
  try {
    await linkWithCredential(authenticatedUser, pendingCredential);
    
    const providerIds = (authenticatedUser.providerData || []).map(p => p.providerId);
    const cleanEmail = (authenticatedUser.email || '').trim().toLowerCase();
    const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    const updates: Record<string, any> = {
      linkedProviders: providerIds,
      emailVerified: authenticatedUser.emailVerified,
      updatedAt: new Date().toISOString()
    };
    if (authenticatedUser.photoURL) updates.avatar = authenticatedUser.photoURL;

    await setDoc(doc(db, 'users', authenticatedUser.uid), updates, { merge: true });
    if (emailDocId !== authenticatedUser.uid) {
      await setDoc(doc(db, 'users', emailDocId), updates, { merge: true }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    if (err.code === 'auth/provider-already-linked') {
      return { success: true };
    }
    return { success: false, error: err.message || 'Failed to link accounts.' };
  }
}
