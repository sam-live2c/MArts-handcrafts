import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, ArrowLeft, Mail, AlertCircle, 
  CheckCircle2, RefreshCw, Eye, EyeOff, X
} from 'lucide-react';
import Logo from '../components/Logo';
import { 
  fetchUserAddresses, 
  fetchUserOrders, 
  findUserAccountByEmail, 
  restoreUserAccountByEmail 
} from '../services/dbService';
import { resendService } from '../services/resendService';
import { hashPassword } from '../utils/auth';
import { checkLoginAttemptAllowed, reportLoginAttempt } from '../utils/authSecurity';

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthView = 'password' | 'otp_request' | 'otp_verify' | 'forgot_email' | 'forgot_otp_verify' | 'forgot_new_password' | 'forgot_reset';

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');
  const navigate = useNavigate();

  // Restore preserved pending state (when switching to Gmail app and returning)
  const [view, setView] = useState<AuthView>(() => {
    try {
      const mode = searchParams.get('mode') || searchParams.get('view');
      if (mode === 'otp') return 'otp_request';
      const saved = sessionStorage.getItem('marts_pending_login_view');
      if (saved === 'otp_verify' || saved === 'forgot_otp_verify' || saved === 'forgot_new_password') {
        return saved as AuthView;
      }
      if (saved === 'forgot_reset') {
        return 'forgot_otp_verify';
      }
    } catch (_) {}
    return 'password';
  });

  // Form Fields
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('marts_pending_login_email') || '';
    } catch (_) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Single OTP Input Code
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState<number>(30);

  // Inline Feedback (Stable Fixed-Height Container)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Toast status notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const clearPendingStorage = () => {
    try {
      sessionStorage.removeItem('marts_pending_login_view');
      sessionStorage.removeItem('marts_pending_login_email');
    } catch (_) {}
  };

  // Redirection Handler (Instant Navigation)
  const handlePostAuthRedirect = (uid: string, loggedInUser: User) => {
    clearPendingStorage();
    onLogin(loggedInUser);

    const hasAddress =
      (loggedInUser.address && loggedInUser.address.trim().length > 0) ||
      !!localStorage.getItem('marts_user_address') ||
      !!localStorage.getItem('marts_default_address') ||
      !!localStorage.getItem('melody_user_address');

    if (redirectTarget) {
      if (!hasAddress && redirectTarget === 'checkout') {
        navigate('/address?redirect=checkout');
      } else {
        navigate(`/${redirectTarget.replace(/^\//, '')}`);
      }
    } else {
      navigate('/');
    }

    // Load addresses in background non-blockingly
    fetchUserAddresses(uid).catch(() => {});
  };

  // Timer countdown for resending codes
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if ((view === 'otp_verify' || view === 'forgot_otp_verify' || view === 'forgot_reset') && resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [view, resendCountdown]);

  const switchView = (newView: AuthView) => {
    setView(newView);
    setErrorMessage(null);
    setOtpCode('');
    if (newView === 'password' || newView === 'otp_request' || newView === 'forgot_email') {
      clearPendingStorage();
    }
  };

  // ================= 1. PASSWORD SIGN IN =================
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (cleanEmail.length > 100 || !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }
    if (password.length > 128) {
      setErrorMessage('Password must not exceed 128 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Check brute force lockout before executing database query
      const securityStatus = await checkLoginAttemptAllowed(cleanEmail);
      if (!securityStatus.allowed) {
        const lockoutMsg = `Too many failed attempts. For security, your account is locked for ${securityStatus.retryAfterMinutes || 15} minutes.`;
        setErrorMessage(lockoutMsg);
        showToast(lockoutMsg, 'error');
        setIsLoading(false);
        return;
      }

      const pwdHash = await hashPassword(password);
      const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

      let firebaseUser: any = null;
      let fbUid: string | null = null;
      let authSuccess = false;

      // 1. Attempt Firebase Auth sign-in
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUser = userCredential.user;
        fbUid = firebaseUser.uid;
        authSuccess = true;
      } catch (authErr: any) {
        // Firebase Auth direct attempt failed or operation not allowed
      }

      if (authSuccess && firebaseUser && fbUid) {
        // Clear failed attempts counter on authenticated success
        await reportLoginAttempt(cleanEmail, true);

        // Retrieve full profile from Firestore
        const userDocRef = doc(db, 'users', fbUid);
        const emailDocRef = doc(db, 'users', emailDocId);
        const [userDocSnap, emailDocSnap] = await Promise.all([
          getDoc(userDocRef).catch(() => null),
          getDoc(emailDocRef).catch(() => null)
        ]);

        const data = (userDocSnap && userDocSnap.exists() ? userDocSnap.data() : null) || 
                     (emailDocSnap && emailDocSnap.exists() ? emailDocSnap.data() : null) || {};

        const orders = await fetchUserOrders(fbUid).catch(() => []);

        const loggedInUser: User = {
          name: data.name || data.displayName || firebaseUser.displayName || cleanEmail.split('@')[0],
          displayName: data.displayName || data.name || firebaseUser.displayName || cleanEmail.split('@')[0],
          businessName: data.businessName || '',
          phone: data.phone || data.phoneNumber || '',
          phoneNumber: data.phoneNumber || data.phone || '',
          email: cleanEmail,
          address: data.address || '',
          deliveryAddress: data.deliveryAddress,
          shippingAddress: data.shippingAddress,
          orders: orders.length > 0 ? orders : (Array.isArray(data.orders) ? data.orders : []),
          role: data.role || 'customer'
        };

        // Sync password hash in Firestore
        await setDoc(userDocRef, { ...loggedInUser, passwordHash: pwdHash, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        await setDoc(emailDocRef, { ...loggedInUser, passwordHash: pwdHash, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

        localStorage.setItem('melody_user_profile', JSON.stringify(loggedInUser));
        localStorage.setItem('marts_user_profile', JSON.stringify(loggedInUser));
        await handlePostAuthRedirect(fbUid, loggedInUser);
        return;
      }

      // 2. Check Firestore account for email and verify password hash
      const accountCheck = await findUserAccountByEmail(cleanEmail);
      if (accountCheck.exists && accountCheck.data) {
        const storedHash = accountCheck.data.passwordHash;

        if (storedHash) {
          if (storedHash === pwdHash) {
            // Password matches verified hash!
            await reportLoginAttempt(cleanEmail, true);

            // Sync with Firebase Auth in background if possible
            createUserWithEmailAndPassword(auth, cleanEmail, password)
              .catch(() => signInWithEmailAndPassword(auth, cleanEmail, password).catch(() => {}));

            const restored = await restoreUserAccountByEmail(cleanEmail, pwdHash);
            localStorage.setItem('melody_user_profile', JSON.stringify(restored.user));
            localStorage.setItem('marts_user_profile', JSON.stringify(restored.user));
            await handlePostAuthRedirect(restored.docId, restored.user);
            return;
          } else {
            // Record failed attempt
            const failure = await reportLoginAttempt(cleanEmail, false);
            if (failure.isLocked) {
              const msg = 'Too many failed login attempts. Account temporarily locked for 15 minutes.';
              setErrorMessage(msg);
              showToast(msg, 'error');
            } else if (failure.remainingAttempts !== undefined && failure.remainingAttempts <= 3) {
              setErrorMessage(`Incorrect password. ${failure.remainingAttempts} attempt(s) remaining before temporary lockout.`);
            } else {
              setErrorMessage('Incorrect password. Please try again or click "Forgot password?" to reset.');
            }
            return;
          }
        } else {
          setErrorMessage('No password has been set for this account yet. Please sign in with email verification code below or reset your password.');
          return;
        }
      }

      // Unknown account failure count
      const failure = await reportLoginAttempt(cleanEmail, false);
      if (failure.isLocked) {
        const msg = 'Too many failed attempts. Temporarily locked for 15 minutes.';
        setErrorMessage(msg);
        showToast(msg, 'error');
      } else {
        setErrorMessage('No account found with this email. Please check your credentials or sign up.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  // ================= 2. OTP FLOW (POWERED BY RESEND) =================
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const res = await resendService.sendOtp(cleanEmail, 'login');

      if (res.success) {
        setOtpCode('');
        setResendCountdown(30);
        setView('otp_verify');

        try {
          sessionStorage.setItem('marts_pending_login_view', 'otp_verify');
          sessionStorage.setItem('marts_pending_login_email', cleanEmail);
        } catch (_) {}

        showToast(`Verification code sent to ${cleanEmail}`);
      } else {
        setErrorMessage(res.error || 'Failed to send verification email. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with verification service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const verifyRes = await resendService.verifyOtp(cleanEmail, code);

      if (!verifyRes.success) {
        setErrorMessage(verifyRes.error || 'Invalid or expired code. Please check and try again.');
        setIsLoading(false);
        return;
      }

      // Restore full authentic profile, orders, and saved addresses
      const restored = await restoreUserAccountByEmail(cleanEmail);
      localStorage.setItem('melody_user_profile', JSON.stringify(restored.user));
      localStorage.setItem('marts_user_profile', JSON.stringify(restored.user));
      await handlePostAuthRedirect(restored.docId, restored.user);
    } catch {
      setErrorMessage('An error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 3. FORGOT PASSWORD FLOW (POWERED BY RESEND) =================
  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    // Send Firebase reset link in parallel
    sendPasswordResetEmail(auth, cleanEmail).catch(() => {});

    try {
      const res = await resendService.sendOtp(cleanEmail, 'reset');

      if (res.success) {
        setOtpCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setResendCountdown(30);
        setView('forgot_otp_verify');

        try {
          sessionStorage.setItem('marts_pending_login_view', 'forgot_otp_verify');
          sessionStorage.setItem('marts_pending_login_email', cleanEmail);
        } catch (_) {}

        showToast(`Reset code sent to ${cleanEmail}`);
      } else {
        setErrorMessage(res.error || 'Failed to send password reset code. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error sending reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const verifyRes = await resendService.verifyOtp(cleanEmail, code);

      if (!verifyRes.success) {
        setErrorMessage(verifyRes.error || 'Invalid or expired code. Please check and try again.');
        setIsLoading(false);
        return;
      }

      // Step 1 verified! Move to Step 2: New password section
      setView('forgot_new_password');
      setOtpCode('');
      setErrorMessage(null);

      try {
        sessionStorage.setItem('marts_pending_login_view', 'forgot_new_password');
        sessionStorage.setItem('marts_pending_login_email', cleanEmail);
      } catch (_) {}

      showToast('Code verified! Please create your new password.');
    } catch {
      setErrorMessage('An error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const newPwdHash = await hashPassword(newPassword);
      const restored = await restoreUserAccountByEmail(cleanEmail, newPwdHash);

      // Attempt to update Firebase Auth if active, or register credential
      if (auth.currentUser) {
        updatePassword(auth.currentUser, newPassword).catch(() => {});
      } else {
        createUserWithEmailAndPassword(auth, cleanEmail, newPassword)
          .catch(() => signInWithEmailAndPassword(auth, cleanEmail, newPassword).catch(() => {}));
      }

      showToast('Password reset successfully!');
      await handlePostAuthRedirect(restored.docId, restored.user);
    } catch {
      setErrorMessage('Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfile: User;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        userProfile = {
          name: data.name || fbUser.displayName || 'Customer',
          displayName: data.displayName || fbUser.displayName || 'Customer',
          phone: data.phone || data.phoneNumber || '',
          email: fbUser.email || '',
          address: data.address || '',
          orders: data.orders || [],
          role: data.role || 'customer'
        };
      } else {
        userProfile = {
          name: fbUser.displayName || 'Customer',
          displayName: fbUser.displayName || 'Customer',
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '',
          address: '',
          orders: [],
          role: 'customer'
        };
        await setDoc(userDocRef, userProfile, { merge: true }).catch(() => {});
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('marts_user_profile', JSON.stringify(userProfile));
      await handlePostAuthRedirect(fbUser.uid, userProfile);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast(err.message || 'Google sign-in failed. Please try again.', 'error');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#F2E4D8] selection:text-[#2B221B] relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <Logo size="lg" />
          </Link>
        </div>

        <h1 className="text-center text-2xl sm:text-3xl font-serif font-bold text-[#2B221B] tracking-tight">
          {view === 'password' && 'Welcome Back'}
          {view === 'otp_request' && 'Sign In with OTP'}
          {view === 'otp_verify' && 'Verify Your Email'}
          {view === 'forgot_email' && 'Reset Your Password'}
          {(view === 'forgot_otp_verify' || view === 'forgot_reset') && 'Verify Reset Code'}
          {view === 'forgot_new_password' && 'Create New Password'}
        </h1>
        <p className="mt-2 text-center text-xs sm:text-sm text-[#735A4C]">
          {view === 'password' && (
            <>
              Don&apos;t have an account?{' '}
              <Link
                to={redirectTarget ? `/signup?redirect=${redirectTarget}` : '/signup'}
                className="font-bold text-[#C85A32] hover:underline"
              >
                Sign up
              </Link>
            </>
          )}
          {view === 'otp_request' && 'Receive a one-time code on your registered email address.'}
          {view === 'otp_verify' && 'Enter the 6-digit code sent to your email.'}
          {view === 'forgot_email' && 'Enter your email to receive password reset instructions.'}
          {(view === 'forgot_otp_verify' || view === 'forgot_reset') && 'Enter the 6-digit code sent to your registered email.'}
          {view === 'forgot_new_password' && 'Enter and confirm your new password below.'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-5 sm:px-8 shadow-sm border border-[#EADBCC] rounded-3xl">

          {/* VIEW 1: PASSWORD LOGIN */}
          {view === 'password' && (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. collector@marts.crafts"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#4E392D] uppercase tracking-wide">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => switchView('forgot_email')}
                    className="text-xs text-[#C85A32] hover:underline font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Stable inline error container */}
              <div className="min-h-[22px] flex items-center">
                {errorMessage && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                    <AlertCircle size={13} className="shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchView('otp_request')}
                  className="text-xs font-semibold text-[#8C3F1E] hover:text-[#C85A32] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Mail size={13} />
                  <span>Or sign in with email verification code</span>
                </button>
              </div>

              <div className="flex items-center my-4 w-full">
                <div className="flex-1 border-t border-[#EADBCC]"></div>
                <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                  Or continue with Google
                </span>
                <div className="flex-1 border-t border-[#EADBCC]"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#EADBCC] text-[#2B221B] font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
              >
                {isGoogleLoading ? (
                  <Loader2 size={16} className="animate-spin text-[#C85A32]" />
                ) : (
                  <GoogleIcon />
                )}
                <span>Sign in with Google</span>
              </button>
            </form>
          )}

          {/* VIEW 2: OTP REQUEST */}
          {view === 'otp_request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                />
              </div>

              <div className="min-h-[22px] flex items-center">
                {errorMessage && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                    <AlertCircle size={13} className="shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="text-xs font-semibold text-[#735A4C] hover:text-[#2B221B] cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} />
                  <span>Back to password login</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: OTP VERIFICATION (SINGLE INPUT FIELD) */}
          {view === 'otp_verify' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-3 bg-[#FAF3EA] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-[#8C6D58] uppercase">Code Sent To</p>
                    <p className="text-xs sm:text-sm font-bold text-[#2B221B] truncate">{email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => switchView('otp_request')}
                  className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              {/* Single Clean OTP Input */}
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-2 uppercase tracking-wide text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]*"
                  value={otpCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(digits);
                    setErrorMessage(null);
                    if (digits.length === 6) {
                      handleVerifyOtp(digits);
                    }
                  }}
                  placeholder="••••••"
                  className={`w-full h-14 text-center text-2xl tracking-[0.45em] font-mono font-bold text-[#2B221B] bg-[#FAF8F5] focus:bg-white rounded-2xl outline-none transition-all placeholder:text-[#9C8272]/30 placeholder:tracking-[0.3em] ${
                    errorMessage
                      ? 'border-2 border-red-400 focus:border-red-500'
                      : 'border border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                  autoFocus
                />

                <div className="min-h-[22px] flex items-center justify-center mt-1.5">
                  {errorMessage && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                      <AlertCircle size={13} className="shrink-0 text-red-500" />
                      <span>{errorMessage}</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isLoading || otpCode.length < 6}
                onClick={() => handleVerifyOtp()}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify Code &amp; Sign In</span>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-[#735A4C]">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="hover:text-[#2B221B] cursor-pointer"
                >
                  Password Login
                </button>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || isLoading}
                  onClick={handleRequestOtp}
                  className="font-bold text-[#C85A32] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={13} />
                  <span>
                    {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: FORGOT PASSWORD EMAIL */}
          {view === 'forgot_email' && (
            <form onSubmit={handleRequestPasswordResetOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                />
              </div>

              <div className="min-h-[22px] flex items-center">
                {errorMessage && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                    <AlertCircle size={13} className="shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Sending Reset Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Reset Code</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="text-xs font-semibold text-[#735A4C] hover:text-[#2B221B] cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} />
                  <span>Back to sign in</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 5: FORGOT PASSWORD - STEP 1: SINGLE OTP VERIFICATION */}
          {(view === 'forgot_otp_verify' || view === 'forgot_reset') && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-[#FAF3EA] rounded-2xl flex items-center justify-between">
                <div className="truncate">
                  <p className="text-[11px] font-bold text-[#8C6D58] uppercase">Reset Code Sent To</p>
                  <p className="text-xs sm:text-sm font-bold text-[#2B221B] truncate">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchView('forgot_email')}
                  className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              {/* Single OTP Input */}
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide text-center">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]*"
                  value={otpCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(digits);
                    setErrorMessage(null);
                    if (digits.length === 6) {
                      handleVerifyResetOtp(digits);
                    }
                  }}
                  placeholder="••••••"
                  className="w-full h-12 text-center text-xl tracking-[0.4em] font-mono font-bold text-[#2B221B] bg-[#FAF8F5] focus:bg-white border border-[#E5D7CA] focus:border-[#C85A32] rounded-xl outline-none transition-all placeholder:text-[#9C8272]/30"
                  autoFocus
                />
              </div>

              {/* Stable inline error container */}
              <div className="min-h-[22px] flex items-center justify-center">
                {errorMessage && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                    <AlertCircle size={13} className="shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={isLoading || otpCode.length < 6}
                onClick={() => handleVerifyResetOtp()}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-[#735A4C]">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="hover:text-[#2B221B] cursor-pointer"
                >
                  Back to Sign In
                </button>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || isLoading}
                  onClick={handleRequestPasswordResetOtp}
                  className="font-bold text-[#C85A32] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={13} />
                  <span>
                    {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 6: FORGOT PASSWORD - STEP 2: NEW PASSWORD SECTION */}
          {view === 'forgot_new_password' && (
            <form onSubmit={handleCompletePasswordReset} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-[#16A34A] shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-[#15803D] uppercase">Identity Verified</p>
                  <p className="text-xs font-semibold text-[#166534] truncate">{email}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color]"
                />
              </div>

              {/* Stable inline error container */}
              <div className="min-h-[22px] flex items-center">
                {errorMessage && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                    <AlertCircle size={13} className="shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Saving New Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save Password &amp; Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="text-xs font-semibold text-[#735A4C] hover:text-[#2B221B] cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Existing Style Floating Toast Notification */}
      {toast && (
        <div 
          id="ai-studio-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] w-auto max-w-[94vw] sm:max-w-md pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 select-none"
        >
          <div className="bg-white text-gray-900 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-200/90 flex items-center gap-2.5 sm:gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-red-500 shrink-0" />
            )}
            <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[240px] sm:max-w-xs flex-1 min-w-0">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer shrink-0 -mr-1"
              aria-label="Dismiss"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
