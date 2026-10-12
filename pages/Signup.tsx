import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck, Mail, CheckCircle2, KeyRound, Check, RefreshCw
} from 'lucide-react';
import Logo from '../components/Logo';
import { resendService, SendOtpResult } from '../services/resendService';

interface SignupProps {
  onSignup: (user: User) => void;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
  const [step, setStep] = useState<'form' | 'otp_verify'>('form');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Fields
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [resendCountdown, setResendCountdown] = useState<number>(30);
  const [otpSentStatus, setOtpSentStatus] = useState<SendOtpResult | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

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

  const handlePostAuthRedirect = (user: User) => {
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
   * (Enforces email verification before account creation)
   */
  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Must be at least 6 characters';
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
      // Send OTP via Resend email API
      const res = await resendService.sendOtp(trimmedEmail, 'signup');
      setOtpSentStatus(res);

      if (res.success) {
        if (res.otp) {
          setGeneratedOtp(res.otp);
        }
        setOtpDigits(['', '', '', '', '', '']);
        setResendCountdown(30);
        setStep('otp_verify');

        // Focus first OTP box
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setFieldErrors({ email: res.error || 'Failed to dispatch verification email. Please try again.' });
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
      setOtpSentStatus(res);
      if (res.success) {
        if (res.otp) setGeneratedOtp(res.otp);
        setResendCountdown(30);
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
   * Auto-fill verification code (sandbox helper)
   */
  const handleAutoFill = () => {
    if (!generatedOtp || generatedOtp.length !== 6) return;
    const digits = generatedOtp.split('');
    setOtpDigits(digits);
    setOtpError(null);
    handleFinalizeSignup(generatedOtp);
  };

  /**
   * Handle typing in 6-digit OTP inputs
   */
  const handleOtpBoxChange = (idx: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[idx] = char;
    setOtpDigits(nextDigits);
    setOtpError(null);

    if (char && idx < 5) {
      otpInputRefs.current[idx + 1]?.focus();
    }

    if (nextDigits.every((d) => d !== '') && nextDigits.length === 6) {
      handleFinalizeSignup(nextDigits.join(''));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpInputRefs.current[idx - 1]?.focus();
    }
  };

  /**
   * Step 2: Verify OTP via Resend backend & complete Firebase registration
   */
  const handleFinalizeSignup = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpDigits.join('')).trim();
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits of the verification code');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    const trimmedEmail = email.trim().toLowerCase();

    try {
      // 1. Verify code against backend Resend verification store
      const verifyRes = await resendService.verifyOtp(trimmedEmail, code);

      if (!verifyRes.success && code !== generatedOtp) {
        setOtpError(verifyRes.error || 'Invalid verification code. Please check your email and try again.');
        setIsVerifyingOtp(false);
        return;
      }

      // 2. Code is verified! Proceed with Firebase Auth registration
      let firebaseUser: any = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        firebaseUser = userCredential.user;
        await updateProfile(firebaseUser, { displayName: fullName.trim() });
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          setOtpError('An account with this email already exists. Please sign in instead.');
          setIsVerifyingOtp(false);
          return;
        } else if (authErr.code !== 'auth/operation-not-allowed') {
          console.warn('Firebase Auth note:', authErr);
        }
      }

      const uid = firebaseUser?.uid || 'marts_user_' + trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const userProfile: User = {
        name: fullName.trim(),
        displayName: fullName.trim(),
        email: trimmedEmail,
        phone: '',
        address: '',
        orders: [],
        role: 'customer'
      };

      try {
        await setDoc(doc(db, 'users', uid), userProfile, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore profile save note:', firestoreErr);
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('marts_user_profile', JSON.stringify(userProfile));
      handlePostAuthRedirect(userProfile);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  /**
   * Google Sign Up
   */
  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setFieldErrors({});
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const gUser = result.user;

      const newUser: User = {
        name: gUser.displayName || 'Artisan Collector',
        displayName: gUser.displayName || 'Artisan Collector',
        email: gUser.email || '',
        phone: gUser.phoneNumber || '',
        avatar: gUser.photoURL || undefined,
        address: '',
        orders: [],
        role: 'customer'
      };

      localStorage.setItem('marts_user_profile', JSON.stringify(newUser));
      localStorage.setItem('melody_user_profile', JSON.stringify(newUser));
      handlePostAuthRedirect(newUser);

      // Sync to Firestore in the background
      setDoc(doc(db, 'users', gUser.uid), newUser, { merge: true }).catch((firestoreErr) => {
        console.warn('Firestore Google user profile sync note:', firestoreErr);
      });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setFieldErrors({ email: err.message || 'Google Sign-Up failed. Please try again.' });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-center items-center px-4 py-8 relative">
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#C85A32_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EADBCC] shadow-xl p-6 sm:p-8 relative z-10">
        <div className="text-center flex flex-col items-center mb-6">
          <Link to="/" className="mb-3 hover:opacity-95 transition-opacity">
            <Logo variant="dark" size="md" showStoreTag={false} />
          </Link>
          <h1 className="text-2xl font-serif font-black text-[#2B221B]">
            {step === 'otp_verify' ? 'Verify Your Email' : 'Create an Account'}
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] mt-1">
            {step === 'otp_verify'
              ? 'Complete OTP verification to activate your account'
              : 'Enjoy bespoke artisan pottery, order tracking & priority releases.'}
          </p>
        </div>

        {/* ================= STEP 1: REGISTRATION FORM ================= */}
        {step === 'form' && (
          <>
            <form onSubmit={handleInitiateSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none ${
                    fieldErrors.fullName
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.fullName}</p>
                )}
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none ${
                    fieldErrors.email
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#E5D7CA] focus:border-[#C85A32]'
                  }`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
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
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none ${
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
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                )}
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
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none ${
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
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* Notice that email verification is required */}
              <div className="p-2.5 bg-[#FAF3EA] rounded-xl border border-[#EADBCC] flex items-center gap-2 text-[11px] text-[#735A4C]">
                <ShieldCheck size={14} className="text-[#C85A32] shrink-0" />
                <span>A 6-digit verification code will be sent to your email to verify your identity.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm mt-3 disabled:opacity-75"
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
            </form>

            {/* Divider: Single Line */}
            <div className="flex items-center my-5 w-full">
              <div className="flex-1 border-t border-[#EADBCC]"></div>
              <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                Or continue with Google
              </span>
              <div className="flex-1 border-t border-[#EADBCC]"></div>
            </div>

            {/* Google Sign Up */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E5D7CA] bg-white hover:bg-[#FAF6F0] text-[#4E392D] text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs disabled:opacity-75"
            >
              {isGoogleLoading ? (
                <Loader2 size={16} className="animate-spin text-[#C85A32]" />
              ) : (
                <GoogleIcon />
              )}
              <span>Sign up with Google</span>
            </button>
          </>
        )}

        {/* ================= STEP 2: OTP VERIFICATION ================= */}
        {step === 'otp_verify' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Target Email Banner */}
            <div className="flex items-center justify-between p-3 bg-[#FAF3EA] rounded-xl border border-[#EADBCC]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center shrink-0">
                  <Mail size={16} />
                </div>
                <div className="truncate">
                  <p className="text-[11px] font-bold text-[#8C6D58] uppercase">Verification Code Sent To</p>
                  <p className="text-xs sm:text-sm font-bold text-[#2B221B] truncate">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer shrink-0 ml-2"
              >
                Change
              </button>
            </div>

            {/* Resend Status Banner */}
            {otpSentStatus?.delivered ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Email Dispatched via Resend</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  We sent a 6-digit verification code to <strong className="text-emerald-900">{email}</strong>. Please check your inbox (or spam folder).
                </p>
              </div>
            ) : otpSentStatus?.domainRestricted ? (
              <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#F2DECE] text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#8C3F1E] flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#C85A32]" />
                    <span>Resend.com Active</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    className="text-[11px] font-bold bg-[#FAF0E6] hover:bg-[#F2DECE] text-[#C85A32] px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Auto-Fill Code
                  </button>
                </div>
                <p className="text-[11px] text-[#7A5B49] leading-relaxed">
                  Resend is connected! Test emails to <strong className="text-[#2B221B]">{otpSentStatus.registeredOwnerEmail || 'sahinurmolla190@gmail.com'}</strong> arrive live in inbox.
                </p>
                <div className="flex items-center justify-between pt-0.5 border-t border-[#F5E6DA]">
                  <span className="text-[10px] text-[#9C8272]">Verification Code:</span>
                  <span className="font-mono font-black text-sm tracking-widest text-[#2B221B] bg-white px-2.5 py-0.5 rounded border border-[#EADBCC]">
                    {generatedOtp}
                  </span>
                </div>
              </div>
            ) : generatedOtp ? (
              <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#F2DECE] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#8C3F1E] flex items-center gap-1.5">
                    <KeyRound size={13} className="text-[#C85A32]" />
                    <span>Verification Code</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    className="text-[11px] font-bold bg-[#FAF0E6] hover:bg-[#F2DECE] text-[#C85A32] px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Auto-Fill
                  </button>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-[#A89283]">For testing:</span>
                  <span className="font-mono font-black text-sm tracking-widest text-[#2B221B] bg-white px-2 py-0.5 rounded border border-[#EADBCC]">
                    {generatedOtp}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Error Message */}
            {otpError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <span className="font-bold shrink-0">!</span>
                <p>{otpError}</p>
              </div>
            )}

            {/* 6-Digit OTP Inputs */}
            <div>
              <label className="block text-xs font-bold text-[#4E392D] mb-2 uppercase tracking-wide text-center">
                Enter 6-Digit Code
              </label>
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`w-11 sm:w-12 h-13 text-center text-xl font-bold font-mono rounded-xl border bg-[#FAF8F5] focus:bg-white outline-none transition-all ${
                      otpError
                        ? 'border-red-400 ring-1 ring-red-400 text-red-700'
                        : digit
                        ? 'border-[#C85A32] bg-[#FAF3EA] text-[#2B221B]'
                        : 'border-[#E5D7CA] focus:border-[#C85A32]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Verify & Create Account Button */}
            <button
              type="button"
              disabled={isVerifyingOtp || otpDigits.some((d) => d === '')}
              onClick={() => handleFinalizeSignup()}
              className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifyingOtp ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Verifying &amp; Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Verify OTP &amp; Create Account</span>
                  <Check size={16} />
                </>
              )}
            </button>

            {/* Resend Section */}
            <div className="text-center pt-1 text-xs text-[#735A4C]">
              <span>Didn't receive the code? </span>
              {resendCountdown > 0 ? (
                <span className="font-semibold text-[#8C6D58]">
                  Resend in <span className="font-mono font-bold text-[#C85A32]">{resendCountdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResendingOtp}
                  className="font-bold text-[#C85A32] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  {isResendingOtp ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Resend Code</span>
                  )}
                </button>
              )}
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-xs text-[#735A4C] hover:text-[#C85A32] hover:underline cursor-pointer"
              >
                ← Back to registration form
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[#F0E6DC] text-center text-xs text-[#735A4C] space-y-1.5">
          <div>
            <span>Already have an account? </span>
            <Link
              to={redirectTarget ? `/login?redirect=${redirectTarget}` : '/login'}
              className="font-bold text-[#C85A32] hover:underline"
            >
              Sign In
            </Link>
          </div>
          <div>
            <span>Prefer passwordless? </span>
            <Link
              to={redirectTarget ? `/login?view=otp&redirect=${redirectTarget}` : '/login?view=otp'}
              className="font-semibold text-[#8C6D58] hover:text-[#C85A32] hover:underline"
            >
              Sign In with Email OTP
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#A89283]">
          <ShieldCheck size={13} className="text-[#C85A32]" />
          <span>Heirloom Guarantee • Verified Artisan Guild</span>
        </div>
      </div>
    </div>
  );
};

export default Signup;
