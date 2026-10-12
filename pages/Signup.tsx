import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Mail, CheckCircle2, AlertCircle, X, RefreshCw
} from 'lucide-react';
import Logo from '../components/Logo';
import { resendService } from '../services/resendService';
import { hashPassword } from '../utils/auth';
import { findUserAccountByEmail, restoreUserAccountByEmail } from '../services/dbService';

interface SignupProps {
  onSignup: (user: User) => void;
}

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

const Signup: React.FC<SignupProps> = ({ onSignup }) => {
  // Step 1: Form details, Step 2: OTP verification
  const [step, setStep] = useState<'form' | 'otp_verify'>(() => {
    try {
      const saved = sessionStorage.getItem('marts_pending_signup_step');
      return saved === 'otp_verify' ? 'otp_verify' : 'form';
    } catch {
      return 'form';
    }
  });

  // Form Fields (Preserve through session storage for Gmail switching)
  const [fullName, setFullName] = useState(() => {
    try {
      return sessionStorage.getItem('marts_pending_signup_name') || '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('marts_pending_signup_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState(() => {
    try {
      return sessionStorage.getItem('marts_pending_signup_pass') || '';
    } catch {
      return '';
    }
  });
  const [confirmPassword, setConfirmPassword] = useState(() => {
    try {
      return sessionStorage.getItem('marts_pending_signup_pass') || '';
    } catch {
      return '';
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Single OTP Input Field
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState<number>(30);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Toast status notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Timer countdown for resending codes
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (step === 'otp_verify' && resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, resendCountdown]);

  const clearPendingStorage = () => {
    try {
      sessionStorage.removeItem('marts_pending_signup_step');
      sessionStorage.removeItem('marts_pending_signup_name');
      sessionStorage.removeItem('marts_pending_signup_email');
      sessionStorage.removeItem('marts_pending_signup_pass');
    } catch (_) {}
  };

  const handlePostAuthRedirect = (user: User) => {
    clearPendingStorage();
    onSignup(user);
    if (redirectTarget) {
      if (redirectTarget === 'checkout') {
        navigate('/address?redirect=checkout');
      } else {
        navigate(`/${redirectTarget.replace(/^\//, '')}`);
      }
    } else {
      navigate('/');
    }
  };

  /**
   * Step 1: Validate registration info and send OTP via Resend
   */
  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    const cleanName = fullName.trim();
    if (!cleanName) {
      newErrors.fullName = 'Full name is required';
    } else if (cleanName.length > 60 || /[<>{}[\]\\]/.test(cleanName)) {
      newErrors.fullName = 'Name contains invalid characters';
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (trimmedEmail.length > 100 || !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Must be at least 6 characters';
    } else if (password.length > 128) {
      newErrors.password = 'Password cannot exceed 128 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (password && confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setFieldErrors({});
    setOtpError(null);

    try {
      // Send OTP via Resend email API using martsindia.in domain
      const res = await resendService.sendOtp(trimmedEmail, 'signup');

      if (res.success) {
        setOtpCode('');
        setResendCountdown(30);
        setStep('otp_verify');

        // Preserve in sessionStorage so user can switch to Gmail and return safely
        try {
          sessionStorage.setItem('marts_pending_signup_step', 'otp_verify');
          sessionStorage.setItem('marts_pending_signup_name', fullName.trim());
          sessionStorage.setItem('marts_pending_signup_email', trimmedEmail);
          sessionStorage.setItem('marts_pending_signup_pass', password);
        } catch (_) {}

        showToast(`Verification code sent to ${trimmedEmail}`);
      } else {
        setFieldErrors({ email: res.error || 'Failed to send verification email. Please try again.' });
      }
    } catch (err: any) {
      setFieldErrors({ email: err.message || 'Error communicating with verification service.' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend OTP code to user's email
   */
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isResendingOtp) return;

    setIsResendingOtp(true);
    setOtpError(null);
    const trimmedEmail = email.trim().toLowerCase();

    try {
      const res = await resendService.sendOtp(trimmedEmail, 'signup');
      if (res.success) {
        setResendCountdown(30);
        showToast(`New verification code sent to ${trimmedEmail}`);
      } else {
        setOtpError(res.error || 'Failed to resend code');
      }
    } catch {
      setOtpError('Network error while resending verification code');
    } finally {
      setIsResendingOtp(false);
    }
  };

  /**
   * Step 2: Verify OTP via Resend backend & complete Firebase registration
   */
  const handleFinalizeSignup = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setOtpError('Please enter the complete 6-digit verification code');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    const trimmedEmail = email.trim().toLowerCase();

    try {
      // Verify code against backend Resend verification store
      const verifyRes = await resendService.verifyOtp(trimmedEmail, code);

      if (!verifyRes.success) {
        setOtpError(verifyRes.error || 'Invalid or expired verification code. Please check and try again.');
        setIsVerifyingOtp(false);
        return;
      }

      // Code is verified! Proceed with registration or seamless existing account recovery
      const cleanEmail = trimmedEmail.trim().toLowerCase();
      const pwdHash = await hashPassword(password);

      // Check if user already exists in Firestore or Firebase
      const existingCheck = await findUserAccountByEmail(cleanEmail);
      let isExistingAccount = existingCheck.exists;

      let firebaseUser: any = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUser = userCredential.user;
        await updateProfile(firebaseUser, { displayName: fullName.trim() }).catch(() => {});
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // User already has an account but is signing up accidentally.
          // Since they just verified the OTP code sent to their email, they own this account.
          // Let them log in with NO interference, restoring all their orders and profile data!
          isExistingAccount = true;
          try {
            const signInCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            firebaseUser = signInCred.user;
          } catch (_) {
            // Password might differ from their previous password.
            // Email is already verified via OTP, so we restore and update below.
          }
        } else if (authErr.code !== 'auth/operation-not-allowed') {
          console.warn('Firebase Auth note:', authErr);
        }
      }

      // Restore user account with all orders, phone, address, and apply new password hash
      const restored = await restoreUserAccountByEmail(cleanEmail, pwdHash, fullName.trim());

      // If firebase user exists, link to their UID document as well
      if (firebaseUser?.uid) {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          ...restored.user,
          passwordHash: pwdHash,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(restored.user));
      localStorage.setItem('marts_user_profile', JSON.stringify(restored.user));

      if (isExistingAccount) {
        showToast('Welcome back! Logged in to your existing account.');
      } else {
        showToast('Account created successfully!');
      }

      handlePostAuthRedirect(restored.user);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  /**
   * Google Sign Up with animated button loading and instant smooth transition
   */
  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setFieldErrors({});

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const cleanEmail = (fbUser.email || '').trim().toLowerCase();

      // Clear any legacy un-scoped address keys from previous browser sessions
      try {
        localStorage.removeItem('marts_default_address');
        localStorage.removeItem('melody_default_address');
        localStorage.removeItem('agronic_default_address');
        localStorage.removeItem('marts_user_address');
        localStorage.removeItem('melody_user_address');
        localStorage.removeItem('agronic_user_address');
        localStorage.removeItem('melody_addresses');
      } catch (_) {}

      // Fast initial profile to make navigation instantaneous with zero blank screen
      const immediateUser: User = {
        name: fbUser.displayName || cleanEmail.split('@')[0] || 'Customer',
        displayName: fbUser.displayName || cleanEmail.split('@')[0] || 'Customer',
        email: cleanEmail,
        avatar: fbUser.photoURL || undefined,
        phone: fbUser.phoneNumber || '',
        phoneNumber: fbUser.phoneNumber || '',
        address: '',
        orders: []
      };

      // Set user profile in state & localStorage right away
      localStorage.setItem('melody_user_profile', JSON.stringify(immediateUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(immediateUser));
      onSignup(immediateUser);

      // Seamlessly restore and unify existing account in parallel background
      restoreUserAccountByEmail(
        cleanEmail, 
        undefined, 
        fbUser.displayName || undefined, 
        fbUser.uid,
        {
          avatar: fbUser.photoURL || undefined,
          phone: fbUser.phoneNumber || undefined,
          phoneNumber: fbUser.phoneNumber || undefined
        }
      ).then(restored => {
        if (restored?.user) {
          localStorage.setItem('melody_user_profile', JSON.stringify(restored.user));
          localStorage.setItem('marts_user_profile', JSON.stringify(restored.user));
          onSignup(restored.user);
        }
      }).catch(err => {
        console.warn('Background restoreUserAccountByEmail notice:', err);
      });

      showToast('Welcome to MArts! Account ready.');
      clearPendingStorage();

      if (redirectTarget) {
        navigate(`/${redirectTarget.replace(/^\//, '')}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        const conflictEmail = (err.customData?.email || err.email || '').trim().toLowerCase();
        try {
          if (conflictEmail) sessionStorage.setItem('marts_conflict_email', conflictEmail);
        } catch (_) {}
        showToast('An account with this email already exists. Enter password or sign in with email code to link Google.', 'success');
        navigate(`/login?email=${encodeURIComponent(conflictEmail)}&mode=password`);
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast(err.message || 'Google sign-up failed. Please try again.', 'error');
      }
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
          {step === 'form' ? 'Create Your Account' : 'Verify Your Email'}
        </h1>
        <p className="mt-2 text-center text-xs sm:text-sm text-[#735A4C]">
          {step === 'form' ? (
            <>
              Already have an account?{' '}
              <Link
                to={redirectTarget ? `/login?redirect=${redirectTarget}` : '/login'}
                className="font-bold text-[#C85A32] hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            'Enter the 6-digit code sent to your email to activate your account.'
          )}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-5 sm:px-8 shadow-sm border border-[#EADBCC] rounded-3xl">
          {step === 'form' ? (
            <form onSubmit={handleInitiateSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maya Roy"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color] ${
                    fieldErrors.fullName
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                />
                <div className="min-h-[18px]">
                  {fieldErrors.fullName && (
                    <p className="text-xs text-red-600 mt-0.5">{fieldErrors.fullName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color] ${
                    fieldErrors.email
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                />
                <div className="min-h-[18px]">
                  {fieldErrors.email && (
                    <p className="text-xs text-red-600 mt-0.5">{fieldErrors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color] ${
                      fieldErrors.password
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E5D7CA] focus:border-[#C85A32]'
                    }`}
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
                <div className="min-h-[18px]">
                  {fieldErrors.password && (
                    <p className="text-xs text-red-600 mt-0.5">{fieldErrors.password}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 outline-none transition-[border-color,background-color] ${
                      fieldErrors.confirmPassword
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E5D7CA] focus:border-[#C85A32]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="min-h-[18px]">
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-0.5">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-[#FAF3EA] rounded-xl border border-[#EADBCC] flex items-center gap-2 text-[11px] text-[#735A4C]">
                <ShieldCheck size={14} className="text-[#C85A32] shrink-0" />
                <span>A 6-digit verification code will be sent to your email to verify your account.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm mt-3 disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email &amp; Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-center my-4 w-full">
                <div className="flex-1 border-t border-[#EADBCC]"></div>
                <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                  Or continue with Google
                </span>
                <div className="flex-1 border-t border-[#EADBCC]"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isGoogleLoading}
                className={`w-full border text-[#2B221B] font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm select-none ${
                  isGoogleLoading
                    ? 'bg-[#FAF3EC] border-[#C85A32] shadow-xs cursor-wait'
                    : 'bg-[#FAF8F5] hover:bg-[#F2ECE4] border-[#EADBCC]'
                }`}
              >
                {isGoogleLoading ? (
                  <Loader2 size={17} className="animate-spin text-[#C85A32] shrink-0" />
                ) : (
                  <GoogleIcon />
                )}
                <span className={isGoogleLoading ? 'text-[#8C3F1E] font-bold' : ''}>
                  {isGoogleLoading ? 'Setting up Google account...' : 'Sign up with Google'}
                </span>
              </button>
            </form>
          ) : (
            /* STEP 2: VERIFY OTP */
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
                  onClick={() => {
                    clearPendingStorage();
                    setStep('form');
                  }}
                  className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              {/* Single Clean OTP Input Section */}
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-2 uppercase tracking-wide text-center">
                  Enter 6-Digit Verification Code
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
                    setOtpError(null);
                    if (digits.length === 6) {
                      handleFinalizeSignup(digits);
                    }
                  }}
                  placeholder="••••••"
                  className={`w-full h-14 text-center text-2xl tracking-[0.45em] font-mono font-bold text-[#2B221B] bg-[#FAF8F5] focus:bg-white rounded-2xl outline-none transition-all placeholder:text-[#9C8272]/30 placeholder:tracking-[0.3em] ${
                    otpError
                      ? 'border-2 border-red-400 focus:border-red-500'
                      : 'border border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                  autoFocus
                />

                {/* Inline error area with fixed min-height for non-shifting layout */}
                <div className="min-h-[22px] flex items-center justify-center mt-1.5">
                  {otpError && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 animate-in fade-in duration-100">
                      <AlertCircle size={13} className="shrink-0 text-red-500" />
                      <span>{otpError}</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isVerifyingOtp || otpCode.length < 6}
                onClick={() => handleFinalizeSignup()}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify &amp; Create Account</span>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-[#735A4C]">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  disabled={resendCountdown > 0 || isResendingOtp}
                  onClick={handleResendOtp}
                  className="font-bold text-[#C85A32] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer flex items-center gap-1"
                >
                  {isResendingOtp ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span>
                    {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                  </span>
                </button>
              </div>
            </div>
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

export default Signup;
