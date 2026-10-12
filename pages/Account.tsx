import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';
import { 
  MapPin, LogOut, User as UserIcon, 
  Headphones, ArrowLeft, ShieldCheck, RefreshCw, FileText, ChevronRight, Package, 
  Heart, Truck, Key, Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Check, X
} from 'lucide-react';
import { User } from '../types';
import { auth } from '../firebase';
import { fetchUserAddresses } from '../services/dbService';
import { 
  getLinkedProviders, 
  linkGoogleToCurrentUser, 
  linkPasswordToCurrentUser, 
  LinkedProvidersStatus 
} from '../services/authLinkingService';
import CircleLoader from '../components/CircleLoader';

interface AccountProps {
  user: User | null;
  onLogout: () => void;
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

const Account: React.FC<AccountProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [displayAddress, setDisplayAddress] = useState<string>(() => {
    return user?.address || '';
  });

  // Linked Authentication Providers state
  const [providersStatus, setProvidersStatus] = useState<LinkedProvidersStatus>(() => {
    return getLinkedProviders(auth.currentUser);
  });
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const refreshProviders = () => {
    setProvidersStatus(getLinkedProviders(auth.currentUser));
  };

  const gridOptions = [
    { id: 'addresses', label: 'Addresses', icon: <MapPin className="text-[#C85A32]" size={22} />, path: '/address' },
    { id: 'orders', label: 'My Orders', icon: <Package className="text-[#C85A32]" size={22} />, path: '/orders' },
    { id: 'wishlist', label: 'My Wishlist', icon: <Heart className="text-[#C85A32]" size={22} />, path: '/wishlist' }
  ];

  const optionList = [
    { id: 'help', label: 'Help Center', icon: <Headphones className="text-gray-600" size={20} />, path: '/help' },
    { id: 'privacy', label: 'Privacy and Policy', icon: <ShieldCheck className="text-gray-600" size={20} />, path: '/privacy-policy' },
    { id: 'refunds', label: 'Refunds and replacement policy', icon: <RefreshCw className="text-gray-600" size={20} />, path: '/refund-policy' },
    { id: 'terms', label: 'Terms and conditions', icon: <FileText className="text-gray-600" size={20} />, path: '/terms-and-conditions' },
    { id: 'shipping', label: 'Shipping and delivery policy', icon: <Truck className="text-gray-600" size={20} />, path: '/shipping-policy' }
  ];

  useEffect(() => {
    refreshProviders();
    const loadAddress = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const addresses = await fetchUserAddresses(currentUser.uid, user?.email || currentUser.email || undefined);
          if (addresses.length > 0) {
            const def = addresses.find(a => a.isDefault) || addresses[0];
            const formatted = `${def.houseNo}, ${def.area ? def.area + ', ' : ''}${def.city}, ${def.state} ${def.pincode}`;
            setDisplayAddress(formatted);
            return;
          } else {
            setDisplayAddress('');
            return;
          }
        } catch (e) {
          console.error('Error loading addresses for profile header:', e);
        }
      }
      setDisplayAddress(user?.address || '');
    };
    loadAddress();

    const handleUpdate = (e: any) => {
      if (e.detail?.address) {
        setDisplayAddress(e.detail.address);
      }
      refreshProviders();
    };
    window.addEventListener('melody_user_updated', handleUpdate);
    return () => {
      window.removeEventListener('melody_user_updated', handleUpdate);
    };
  }, [user]);

  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    setActionNotice(null);
    try {
      const res = await linkGoogleToCurrentUser();
      if (res.success) {
        refreshProviders();
        setActionNotice({
          message: 'Google account linked successfully! Both Google and email/password can now access this account.',
          type: 'success'
        });
      } else {
        setActionNotice({
          message: res.error || 'Failed to link Google account',
          type: 'error'
        });
      }
    } catch (err: any) {
      setActionNotice({
        message: err.message || 'Error linking Google account',
        type: 'error'
      });
    } finally {
      setIsLinkingGoogle(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await linkPasswordToCurrentUser(newPassword);
      if (res.success) {
        refreshProviders();
        setPasswordSuccess('Password saved! You can now log in with either your password or Google.');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(null);
        }, 2500);
      } else {
        setPasswordError(res.error || 'Failed to set password.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="w-full bg-white min-h-screen font-sans relative">
        <div className="w-full bg-white min-h-screen relative flex flex-col max-w-7xl mx-auto pb-24 md:pb-8">
          {/* Page Header with Back Button */}
          <div className="bg-white py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] px-4 sm:px-8 lg:px-12 flex items-center gap-4 sticky top-0 z-[100] border-b border-gray-100 shadow-xs">
            <button 
              type="button"
              onClick={() => handleGoBack(navigate, '/')} 
              className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">My Profile</h1>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6">
            {/* Logo & Sign in prompt banner */}
            <div className="mb-6 pb-6 border-b border-gray-100">
              <div className="mb-3.5">
                <Logo variant="dark" size="sm" showCaption={false} />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Sign in to your account</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    Log in to view your orders, saved addresses, and enjoy faster checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto sm:min-w-[170px] bg-[#C85A32] hover:bg-[#A04724] text-white py-2.5 px-6 rounded-lg font-bold text-sm shadow-xs hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <span>Login / Signup</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="w-full space-y-4">
              {/* Addresses & My Orders */}
              <div className="flex flex-col gap-4">
                {gridOptions.map(option => (
                  <Link 
                    key={option.id}
                    to={option.path}
                    className="bg-white flex items-center gap-3 transition-colors py-2 group cursor-pointer"
                  >
                    <div className="flex-shrink-0 text-[#C85A32] w-6 flex justify-center">
                      {option.icon}
                    </div>
                    <span className="text-base font-medium text-gray-900 group-hover:text-[#C85A32] transition-colors">{option.label}</span>
                  </Link>
                ))}
              </div>

              {/* Options list */}
              <div className="pt-2 border-t border-gray-100 mt-2">
                {optionList.map(option => (
                  <Link
                    key={option.id}
                    to={option.path}
                    className="flex items-center justify-between py-4 hover:bg-gray-50 transition-colors -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-500 w-5 flex justify-center">
                        {option.icon}
                      </div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors">{option.label}</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-7xl mx-auto shadow-sm pb-24 md:pb-8">
        {/* Page Header with Back Button */}
        <div className="bg-white py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] px-4 sm:px-8 lg:px-12 flex items-center gap-4 sticky top-0 z-[100] border-b border-gray-100 shadow-xs">
          <button 
            type="button"
            onClick={() => handleGoBack(navigate, '/')} 
            className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer"
            aria-label="Go to Home"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">My Profile</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 sm:py-5">
          {/* Action Notice Alert */}
          {actionNotice && (
            <div className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              actionNotice.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {actionNotice.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
          )}

          {/* Profile Info Subheader */}
          <div className="mb-4 pb-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-gray-900">{user.name || user.email || 'MArts Collector'}</h2>
              {user.phone ? (
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  {user.phone.startsWith('+') ? user.phone : `+91 ${user.phone}`}
                </p>
              ) : user.email ? (
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{user.email}</p>
              ) : null}
              {displayAddress && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <span>{displayAddress}</span>
                </p>
              )}
            </div>
          </div>

          {/* ================= UNIFIED SIGN-IN & SECURITY SECTION ================= */}
          <div className="mb-5 p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADBCC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#C85A32]" />
                <h3 className="text-sm font-bold text-[#2B221B]">Unified Sign-in &amp; Security</h3>
              </div>
              <span className="text-[11px] font-semibold text-[#8C6D58] bg-[#F2ECE4] px-2 py-0.5 rounded-full">
                Single Identity
              </span>
            </div>
            <p className="text-xs text-[#735A4C] leading-relaxed">
              Access your exact same order history, addresses, and wishlist using either Google or your email and password.
            </p>

            <div className="space-y-2.5 pt-1">
              {/* 1. Google Provider Status */}
              <div className="bg-white p-3 rounded-xl border border-[#EADBCC]/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200">
                    <GoogleIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">Google Account</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {providersStatus.hasGoogle ? 'Connected to Google Sign-In' : 'Not linked yet'}
                    </p>
                  </div>
                </div>

                {providersStatus.hasGoogle ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                    <Check size={13} className="text-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGoogle}
                    disabled={isLinkingGoogle}
                    className="text-xs font-bold text-[#C85A32] bg-[#FBF3EB] hover:bg-[#F2E4D8] border border-[#EADBCC] px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isLinkingGoogle ? 'Connecting...' : 'Link Google'}
                  </button>
                )}
              </div>

              {/* 2. Password Provider Status */}
              <div className="bg-white p-3 rounded-xl border border-[#EADBCC]/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                    <Key size={15} className="text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">Email &amp; Password</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {providersStatus.hasPassword ? 'Password is configured' : 'No password set (Google sign-in only)'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    providersStatus.hasPassword
                      ? 'text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200'
                      : 'text-white bg-[#C85A32] hover:bg-[#A04724] shadow-xs'
                  }`}
                >
                  {providersStatus.hasPassword ? 'Change Password' : 'Set Password'}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full space-y-4">
            {/* Addresses & Orders & Wishlist */}
            <div className="flex flex-col gap-4">
              {gridOptions.map(option => (
                <Link 
                  key={option.id}
                  to={option.path}
                  className="bg-white flex items-center gap-3 transition-colors py-2 group cursor-pointer"
                >
                  <div className="flex-shrink-0 text-[#C85A32] w-6 flex justify-center">
                    {option.icon}
                  </div>
                  <span className="text-base font-medium text-gray-900 group-hover:text-[#C85A32] transition-colors">{option.label}</span>
                </Link>
              ))}
            </div>

            {/* Options list */}
            <div className="pt-2 border-t border-gray-100 mt-2">
              {optionList.map(option => (
                <Link
                  key={option.id}
                  to={option.path}
                  className="flex items-center justify-between py-4 hover:bg-gray-50 transition-colors -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-gray-500 w-5 flex justify-center">
                      {option.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{option.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              ))}
              
              {/* Logout button */}
              <button 
                onClick={onLogout}
                className="w-full text-left flex items-center py-4 hover:bg-gray-50 transition-colors -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-red-600 w-5 flex justify-center ml-[2px]">
                    <LogOut size={20} />
                  </div>
                  <span className="text-sm font-bold text-red-600">Logout</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PASSWORD MODAL ================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-[#C85A32]" />
                <h3 className="text-base font-bold text-gray-900">
                  {providersStatus.hasPassword ? 'Change Account Password' : 'Set Account Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Setting a password allows you to log in with <strong className="text-gray-800">{user.email || 'your email'}</strong> and this password at any time. Your existing orders, addresses, and data stay synchronized.
            </p>

            {passwordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  New Password (min 6 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInput ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength={6}
                    required
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:border-[#C85A32] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPasswordInput ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type={showPasswordInput ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  minLength={6}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[#C85A32] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#C85A32] hover:bg-[#A04724] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
