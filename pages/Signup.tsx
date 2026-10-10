import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Loader2, ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck
} from 'lucide-react';
import Logo from '../components/Logo';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
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

    const trimmedEmail = email.trim().toLowerCase();
    const newUser: User = {
      name: fullName.trim(),
      email: trimmedEmail,
      phone: '',
      address: '',
      orders: []
    };

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, {
        displayName: fullName.trim()
      });

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
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfile, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore profile save note:', firestoreErr);
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('marts_user_profile', JSON.stringify(userProfile));
      handlePostAuthRedirect(userProfile);
    } catch (err: any) {
      let errorMessage = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password sign-in is not enabled in the Firebase console yet.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setFieldErrors({ email: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

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

      try {
        await setDoc(doc(db, 'users', gUser.uid), newUser, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore Google user profile sync note:', firestoreErr);
      }

      localStorage.setItem('melody_user_profile', JSON.stringify(newUser));
      localStorage.setItem('marts_user_profile', JSON.stringify(newUser));
      handlePostAuthRedirect(newUser);
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
            Create an Account
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] mt-1">
            Enjoy bespoke artisan pottery, order tracking &amp; priority releases.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#C85A32] hover:bg-[#A04724] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-sm mt-3 disabled:opacity-75"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <span>Create MArts Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Divider: Single Line (Strictly NO line break) */}
        <div className="flex items-center my-5 w-full">
          <div className="flex-1 border-t border-[#EADBCC]"></div>
          <span className="px-3 text-xs text-[#8C6D58] font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
            Or continue with Google
          </span>
          <div className="flex-1 border-t border-[#EADBCC]"></div>
        </div>

        {/* Google Sign Up (Below) */}
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

        <div className="mt-6 pt-5 border-t border-[#F0E6DC] text-center text-xs text-[#735A4C]">
          <span>Already have an account? </span>
          <Link
            to={redirectTarget ? `/login?redirect=${redirectTarget}` : '/login'}
            className="font-bold text-[#C85A32] hover:underline"
          >
            Sign In
          </Link>
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
