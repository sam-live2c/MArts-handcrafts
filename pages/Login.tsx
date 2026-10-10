import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, ArrowLeft, Mail, AlertCircle, 
  CheckCircle2, RefreshCw, KeyRound, Check, Lock, Eye, EyeOff, Sparkles
} from 'lucide-react';
import Logo from '../components/Logo';
import { fetchUserAddresses } from '../services/dbService';

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthView = 'password' | 'otp_request' | 'otp_verify' | 'forgot_email' | 'forgot_reset';

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

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('password');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP Fields
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [resendCountdown, setResendCountdown] = useState<number>(30);

  // Inline Feedback Status (No Toast Notifications)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  // Redirection Handler
  const handlePostAuthRedirect = async (uid: string, loggedInUser: User) => {
    const savedAddresses = await fetchUserAddresses(uid);
    const hasAddress =
      (loggedInUser.address && loggedInUser.address.trim().length > 0) ||
      savedAddresses.length > 0 ||
      !!localStorage.getItem('melody_user_address') ||
      !!localStorage.getItem('marts_user_address');

    onLogin(loggedInUser);

    if (redirectTarget) {
      if (!hasAddress && redirectTarget === 'checkout') {
        navigate('/address?redirect=checkout');
      } else {
        navigate(`/${redirectTarget.replace(/^\//, '')}`);
      }
    } else {
      navigate('/');
    }
  };

  // Generate 6-digit OTP code
  const generateNewOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    return code;
  };

  // Timer countdown for resending codes
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if ((view === 'otp_verify' || view === 'forgot_reset') && resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [view, resendCountdown]);

  // Auto focus first OTP input when arriving at verification screens
  useEffect(() => {
    if (view === 'otp_verify' || view === 'forgot_reset') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [view]);

  // Clear messages on view changes
  const switchView = (newView: AuthView) => {
    setView(newView);
    setErrorMessage(null);
    setSuccessMessage(null);
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
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fbUid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', fbUid);
      const userDocSnap = await getDoc(userDocRef);

      let loggedInUser: User;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        loggedInUser = {
          name: data.name || userCredential.user.displayName || cleanEmail.split('@')[0],
          displayName: data.displayName || data.name || cleanEmail.split('@')[0],
          businessName: data.businessName || '',
          phone: data.phone || data.phoneNumber || '',
          email: cleanEmail,
          address: data.address || '',
          orders: data.orders || [],
          role: data.role || 'customer'
        };
      } else {
        loggedInUser = {
          name: userCredential.user.displayName || cleanEmail.split('@')[0],
          displayName: userCredential.user.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: '',
          address: '',
          orders: [],
          role: 'customer'
        };
        await setDoc(userDocRef, loggedInUser, { merge: true }).catch(() => {});
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(loggedInUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(loggedInUser));
      await handlePostAuthRedirect(fbUid, loggedInUser);
    } catch (err: any) {
      let msg = 'Invalid email or password. Please try again.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Incorrect email or password. Please check your credentials or reset your password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a moment or reset your password.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 2. OTP FLOW =================
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. collector@marts.com)');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const code = generateNewOtp();
      setOtpDigits(['', '', '', '', '', '']);
      setResendCountdown(30);
      setIsLoading(false);
      setView('otp_verify');
    }, 350);
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter all 6 digits of the verification code');
      return;
    }
    if (code !== generatedOtp) {
      setErrorMessage('Invalid verification code. Please check and try again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const uid = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      const newUser: User = {
        name: cleanEmail.split('@')[0],
        displayName: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '',
        address: '',
        orders: []
      };
      localStorage.setItem('melody_user_profile', JSON.stringify(newUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(newUser));
      await handlePostAuthRedirect(uid, newUser);
    } catch {
      setErrorMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 3. FORGOT PASSWORD FLOW =================
  const handleRequestPasswordResetOtp = (e: React.FormEvent) => {
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
    // Send official password reset email link
    sendPasswordResetEmail(auth, cleanEmail)
      .then(() => {
        setSuccessMessage(`Password reset link sent to ${cleanEmail}. Check your inbox!`);
      })
      .catch((err) => {
        console.warn('Firebase password reset notice:', err);
      });

    setTimeout(() => {
      const code = generateNewOtp();
      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmNewPassword('');
      setResendCountdown(30);
      setIsLoading(false);
      setView('forgot_reset');
    }, 400);
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code');
      return;
    }
    if (enteredOtp !== generatedOtp) {
      setErrorMessage('Invalid verification code. Please check and try again.');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please create a new password');
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
    const uid = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    setTimeout(async () => {
      try {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, {
          email: cleanEmail,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});

        const updatedProfile: User = {
          name: cleanEmail.split('@')[0],
          displayName: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: '',
          address: '',
          orders: []
        };
        localStorage.setItem('melody_user_profile', JSON.stringify(updatedProfile));
        localStorage.setItem('marts_user_profile', JSON.stringify(updatedProfile));

        // Sign user in automatically with their newly reset password
        await handlePostAuthRedirect(uid, updatedProfile);
      } catch {
        setErrorMessage('Failed to update password. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  // OTP inputs handling
  const handleOtpBoxChange = (index: number, val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    const updated = [...otpDigits];

    if (num.length > 1) {
      const chars = num.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        updated[i] = chars[i] || '';
      }
      setOtpDigits(updated);
      otpInputRefs.current[Math.min(chars.length, 5)]?.focus();
      if (chars.length === 6 && view === 'otp_verify') {
        handleVerifyOtp(updated.join(''));
      }
      return;
    }

    updated[index] = num.slice(-1);
    setOtpDigits(updated);
    setErrorMessage(null);

    if (num && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    if (updated.every((d) => d !== '') && view === 'otp_verify') {
      handleVerifyOtp(updated.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFill = () => {
    if (!generatedOtp) return;
    const chars = generatedOtp.split('');
    setOtpDigits(chars);
    setErrorMessage(null);
    if (view === 'otp_verify') {
      setTimeout(() => handleVerifyOtp(generatedOtp), 150);
    }
  };

  // ================= 4. GOOGLE SIGN IN =================
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const gUser = result.user;
      const fbUid = gUser.uid;

      const userDocRef = doc(db, 'users', fbUid);
      const userDocSnap = await getDoc(userDocRef);

      let loggedInUser: User;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        loggedInUser = {
          name: data.name || gUser.displayName || 'Artisan Collector',
          displayName: data.displayName || gUser.displayName || 'Artisan Collector',
          businessName: data.businessName || '',
          phone: data.phone || data.phoneNumber || gUser.phoneNumber || '',
          email: gUser.email || '',
          avatar: gUser.photoURL || undefined,
          address: data.address || '',
          orders: data.orders || [],
          role: data.role || 'customer'
        };
      } else {
        loggedInUser = {
          name: gUser.displayName || 'Artisan Collector',
          displayName: gUser.displayName || 'Artisan Collector',
          email: gUser.email || '',
          phone: gUser.phoneNumber || '',
          avatar: gUser.photoURL || undefined,
          address: '',
          orders: [],
          role: 'customer'
        };
        await setDoc(userDocRef, loggedInUser, { merge: true }).catch(() => {});
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(loggedInUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(loggedInUser));
      await handlePostAuthRedirect(fbUid, loggedInUser);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setErrorMessage(err.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-center items-center px-4 py-8 relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#C85A32_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EADBCC] shadow-xl p-6 sm:p-8 relative z-10">
        {/* Header Branding */}
        <div className="text-center flex flex-col items-center mb-5">
          <Link to="/" className="mb-3 hover:opacity-95 transition-opacity">
            <Logo variant="dark" size="md" showStoreTag={false} />
          </Link>
          <h1 className="text-2xl font-serif font-black text-[#2B221B]">
            {view === 'password' && 'Welcome Back'}
            {view === 'otp_request' && 'Sign In with OTP'}
            {view === 'otp_verify' && 'Verify Email OTP'}
            {view === 'forgot_email' && 'Forgot Password'}
            {view === 'forgot_reset' && 'Create New Password'}
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] mt-1 max-w-xs">
            {view === 'password' && 'Sign in to access your collector wishlist, orders & artisan pieces.'}
            {view === 'otp_request' && 'Enter your email to receive a 6-digit one-time login verification code.'}
            {view === 'otp_verify' && `We sent a 6-digit verification code to ${email}`}
            {view === 'forgot_email' && 'Enter your email to receive a verification code and create a new password.'}
            {view === 'forgot_reset' && 'Enter the verification code and set your new account password.'}
          </p>
        </div>

        {/* Global Inline Error (Strictly NO toast used) */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span className="flex-1 leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Global Inline Success */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span className="flex-1 leading-snug">{successMessage}</span>
          </div>
        )}

        {/* ================= VIEW 1: EMAIL WITH PASSWORD (FIRST PRIORITY) ================= */}
        {view === 'password' && (
          <div>
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. collector@marts.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
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
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => switchView('forgot_email')}
                    className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Sign In Primary Action */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm mt-1 disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to MArts</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Switch to OTP Login Option */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchView('otp_request')}
                  className="text-xs font-semibold text-[#8C6D58] hover:text-[#C85A32] transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <KeyRound size={13} />
                  <span>Or sign in with One-Time Password (OTP)</span>
                </button>
              </div>
            </form>

            {/* Divider: Single Line (Strictly NO line break) */}
            <div className="flex items-center my-5 w-full">
              <div className="flex-1 border-t border-[#EADBCC]"></div>
              <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                Or continue with Google
              </span>
              <div className="flex-1 border-t border-[#EADBCC]"></div>
            </div>

            {/* Google Sign In (Below Email Login) */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E5D7CA] bg-white hover:bg-[#FAF6F0] text-[#4E392D] text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs disabled:opacity-75"
            >
              {isGoogleLoading ? (
                <Loader2 size={16} className="animate-spin text-[#C85A32]" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* ================= VIEW 2: OTP REQUEST ================= */}
        {view === 'otp_request' && (
          <div>
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. collector@marts.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
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

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="text-xs font-semibold text-[#8C6D58] hover:text-[#C85A32] transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <Lock size={13} />
                  <span>Sign in with Password instead</span>
                </button>
              </div>
            </form>

            {/* Divider: Single Line (Strictly NO line break) */}
            <div className="flex items-center my-5 w-full">
              <div className="flex-1 border-t border-[#EADBCC]"></div>
              <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                Or continue with Google
              </span>
              <div className="flex-1 border-t border-[#EADBCC]"></div>
            </div>

            {/* Google Sign In (Below) */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E5D7CA] bg-white hover:bg-[#FAF6F0] text-[#4E392D] text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs disabled:opacity-75"
            >
              {isGoogleLoading ? (
                <Loader2 size={16} className="animate-spin text-[#C85A32]" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* ================= VIEW 3: OTP VERIFY ================= */}
        {view === 'otp_verify' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Email Chip with Change Action */}
            <div className="flex items-center justify-between p-3 bg-[#FAF3EA] rounded-xl border border-[#EADBCC]">
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

            {/* Demo / Sandbox Code Helper */}
            {generatedOtp && (
              <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#F2DECE] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#8C3F1E] flex items-center gap-1.5">
                    <KeyRound size={13} className="text-[#C85A32]" />
                    <span>Demo Verification Code</span>
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
                  <span className="text-[10px] text-[#A89283]">For testing in AI Studio:</span>
                  <span className="font-mono font-black text-sm tracking-widest text-[#2B221B] bg-white px-2 py-0.5 rounded border border-[#EADBCC]">
                    {generatedOtp}
                  </span>
                </div>
              </div>
            )}

            {/* 6-Digit OTP Boxes */}
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
                      errorMessage
                        ? 'border-red-400 ring-1 ring-red-400 text-red-700'
                        : digit
                        ? 'border-[#C85A32] bg-[#FAF3EA] text-[#2B221B]'
                        : 'border-[#E5D7CA] focus:border-[#C85A32]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <button
              type="button"
              disabled={isLoading || otpDigits.some((d) => d === '')}
              onClick={() => handleVerifyOtp()}
              className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Sign In</span>
                  <Check size={16} />
                </>
              )}
            </button>

            {/* Resend Section */}
            <div className="text-center pt-1 text-xs text-[#735A4C]">
              <span>Didn't receive the code? </span>
              {resendCountdown > 0 ? (
                <span className="font-semibold text-[#8C6D58]">
                  Resend in {resendCountdown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const code = generateNewOtp();
                    setOtpDigits(['', '', '', '', '', '']);
                    setResendCountdown(30);
                  }}
                  className="font-bold text-[#C85A32] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  <span>Resend Code</span>
                </button>
              )}
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => switchView('password')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D58] hover:text-[#2B221B] transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Return to Password Login</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 4: FORGOT PASSWORD (EMAIL ENTRY) ================= */}
        {view === 'forgot_email' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <form onSubmit={handleRequestPasswordResetOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  Account Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75"
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D58] hover:text-[#2B221B] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= VIEW 5: FORGOT PASSWORD (VERIFY & CREATE NEW PASSWORD) ================= */}
        {view === 'forgot_reset' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Demo Code Helper */}
            {generatedOtp && (
              <div className="p-3 bg-[#FFF9F2] rounded-xl border border-[#F2DECE] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#8C3F1E] flex items-center gap-1.5">
                    <KeyRound size={13} className="text-[#C85A32]" />
                    <span>Reset Verification Code</span>
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
                  <span className="text-[10px] text-[#A89283]">For testing in AI Studio:</span>
                  <span className="font-mono font-black text-sm tracking-widest text-[#2B221B] bg-white px-2 py-0.5 rounded border border-[#EADBCC]">
                    {generatedOtp}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleCompletePasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  6-Digit Verification Code
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
                      className="w-11 sm:w-12 h-12 text-center text-lg font-bold font-mono rounded-xl border border-[#E5D7CA] focus:border-[#C85A32] bg-[#FAF8F5] focus:bg-white outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D58]">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5D7CA] text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white focus:border-[#C85A32] placeholder:text-[#9C8272]/70 placeholder:transition-none transition-[border-color,background-color] duration-150 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-75 mt-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save Password &amp; Sign In</span>
                    <Check size={16} />
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => switchView('password')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D58] hover:text-[#2B221B] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Cancel and Return to Sign In</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-6 pt-5 border-t border-[#F0E6DC] text-center text-xs text-[#735A4C]">
          <span>New to MArts Handcrafted Store? </span>
          <Link
            to={redirectTarget ? `/signup?redirect=${redirectTarget}` : '/signup'}
            className="font-bold text-[#C85A32] hover:underline"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
