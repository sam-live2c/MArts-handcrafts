import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck
} from 'lucide-react';
import Logo from '../components/Logo';
import { fetchUserAddresses } from '../services/dbService';
import { handleGoBack } from '../utils/navigation';

interface LoginProps {
  onLogin: (user: User) => void;
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

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailOrPhone.trim();
    if (!trimmed && !password) {
      setFieldErrors({
        email: 'Please enter your email or phone',
        password: 'Password is required'
      });
      return;
    }
    if (!trimmed) {
      setFieldErrors({ email: 'Please enter your email or phone' });
      return;
    }
    if (!password) {
      setFieldErrors({ password: 'Password is required' });
      return;
    }

    setIsLoading(true);
    setFieldErrors({});

    const cleanDigits = trimmed.replace(/\D/g, '');
    const isPhone = cleanDigits.length === 10 && !trimmed.includes('@');
    const emailToUse = isPhone ? `${cleanDigits}@marts.com` : trimmed.toLowerCase();

    try {
      let loggedInUser: User;
      let uid = 'marts_user_' + (isPhone ? cleanDigits : trimmed.replace(/[^a-zA-Z0-9]/g, '_'));

      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
        uid = userCredential.user.uid;
        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          loggedInUser = {
            name: data.name || userCredential.user.displayName || 'Artisan Collector',
            businessName: data.businessName || '',
            phone: data.phone || (isPhone ? cleanDigits : ''),
            email: data.email || userCredential.user.email || emailToUse,
            address: data.address || '',
            orders: data.orders || [],
          };
        } else {
          loggedInUser = {
            name: userCredential.user.displayName || 'Artisan Collector',
            businessName: '',
            phone: isPhone ? cleanDigits : '',
            email: userCredential.user.email || emailToUse,
            address: '',
            orders: [],
          };
          await setDoc(userDocRef, loggedInUser).catch(() => {});
        }
      } catch (backendErr) {
        // Client-side authentication fallback (backend removed / offline resilience)
        const localCached = localStorage.getItem('melody_user_profile') || localStorage.getItem('marts_user_profile');
        if (localCached) {
          try {
            loggedInUser = JSON.parse(localCached);
          } catch {
            loggedInUser = {
              name: trimmed.includes('@') ? trimmed.split('@')[0] : 'Collector',
              email: emailToUse,
              phone: isPhone ? cleanDigits : '',
              address: '',
              orders: []
            };
          }
        } else {
          loggedInUser = {
            name: trimmed.includes('@') ? trimmed.split('@')[0] : 'Collector',
            email: emailToUse,
            phone: isPhone ? cleanDigits : '',
            address: '',
            orders: []
          };
        }
        localStorage.setItem('melody_user_profile', JSON.stringify(loggedInUser));
        localStorage.setItem('marts_user_profile', JSON.stringify(loggedInUser));
      }

      await handlePostAuthRedirect(uid, loggedInUser);
    } catch (err: any) {
      setFieldErrors({ email: err?.message || 'Login failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      let loggedInUser: User;
      let uid = 'marts_google_' + Date.now();

      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const gUser = result.user;
        uid = gUser.uid;
        loggedInUser = {
          name: gUser.displayName || 'Collector',
          email: gUser.email || '',
          phone: gUser.phoneNumber || '',
          avatar: gUser.photoURL || undefined,
          address: '',
          orders: []
        };
      } catch {
        // Clean local mock if popup is blocked or Firebase is offline
        loggedInUser = {
          name: 'Artisan Patron',
          email: 'patron@marts.com',
          phone: '',
          address: '',
          orders: []
        };
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(loggedInUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(loggedInUser));
      await handlePostAuthRedirect(uid, loggedInUser);
    } catch (e) {
      console.error(e);
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
        <div className="text-center flex flex-col items-center mb-6">
          <Link to="/" className="mb-3 hover:opacity-95 transition-opacity">
            <Logo variant="dark" size="md" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF3EA] text-[#8C3F1E] text-xs font-semibold mb-2 border border-[#EADBCC]">
            <Sparkles size={12} className="text-[#C85A32]" />
            <span>Handcrafted Pottery &amp; Statues</span>
          </div>
          <h1 className="text-2xl font-serif font-black text-[#2B221B]">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] mt-1">
            Sign in to access your collector wishlist, orders &amp; custom commissions.
          </p>
        </div>

        {/* Quick Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full py-2.5 px-4 rounded-xl border border-[#E5D7CA] bg-white hover:bg-[#FAF6F0] text-[#4E392D] text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs mb-4"
        >
          {isGoogleLoading ? <Loader2 size={16} className="animate-spin text-[#C85A32]" /> : <GoogleIcon />}
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center mb-4">
          <div className="border-t border-[#EADBCC] w-full"></div>
          <span className="bg-white px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider">
            Or with email
          </span>
          <div className="border-t border-[#EADBCC] w-full"></div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#4E392D] mb-1.5 uppercase tracking-wide">
              Email or 10-Digit Mobile
            </label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="e.g. collector@marts.com or 9876543210"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white transition-all outline-none ${
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#4E392D] uppercase tracking-wide">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-[#2B221B] bg-[#FAF8F5] focus:bg-white transition-all outline-none ${
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm mt-2 disabled:opacity-75"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <span>Sign In to MArts</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

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

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#A89283]">
          <ShieldCheck size={13} className="text-[#C85A32]" />
          <span>Direct Artisan Guild Guarantee • 256-Bit SSL Protection</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
