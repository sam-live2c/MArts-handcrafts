import { 
  AuthCredential, 
  GoogleAuthProvider, 
  EmailAuthProvider, 
  linkWithCredential, 
  linkWithPopup, 
  unlink, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  updatePassword, 
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface LinkedProvidersStatus {
  email: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  providers: string[];
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
    
    // Update canonical profile record
    await setDoc(doc(db, 'users', currentUser.uid), {
      linkedProviders: (currentUser.providerData || []).map(p => p.providerId),
      updatedAt: new Date().toISOString()
    }, { merge: true });

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
 * (e.g. user created account with Google and now wants to enable email/password sign-in)
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
    const credential = EmailAuthProvider.credential(currentUser.email, password);
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

    // Keep Firestore profile linkedProviders in sync
    await setDoc(doc(db, 'users', currentUser.uid), {
      linkedProviders: (currentUser.providerData || []).map(p => p.providerId),
      updatedAt: new Date().toISOString()
    }, { merge: true });

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
 * Completes linking a pending credential (from an account-exists-with-different-credential error)
 * after the user successfully reauthenticates with their existing password.
 */
export async function linkPendingCredential(
  authenticatedUser: FirebaseUser,
  pendingCredential: AuthCredential
): Promise<{ success: boolean; error?: string }> {
  try {
    await linkWithCredential(authenticatedUser, pendingCredential);
    
    await setDoc(doc(db, 'users', authenticatedUser.uid), {
      linkedProviders: (authenticatedUser.providerData || []).map(p => p.providerId),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (err: any) {
    if (err.code === 'auth/provider-already-linked') {
      return { success: true };
    }
    return { success: false, error: err.message || 'Failed to link accounts.' };
  }
}
