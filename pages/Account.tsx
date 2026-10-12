import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';
import { 
  MapPin, LogOut, Headphones, ArrowLeft, ShieldCheck, RefreshCw, 
  FileText, ChevronRight, Package, Heart, Truck, Lock, Key, 
  CheckCircle2, AlertCircle, X, ShieldAlert, Loader2
} from 'lucide-react';
import { User } from '../types';
import { auth } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { fetchUserAddresses, setUserPassword } from '../services/dbService';
import { hashPassword } from '../utils/auth';

interface AccountProps {
  user: User | null;
  onLogout: () => void;
}

const Account: React.FC<AccountProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [displayAddress, setDisplayAddress] = useState<string>(() => {
    return user?.address || '';
  });

  // Set Password for Email Login Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [confirmPwdInput, setConfirmPwdInput] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isSavingPwd, setIsSavingPwd] = useState(false);

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
    };
    window.addEventListener('melody_user_updated', handleUpdate);
    return () => {
      window.removeEventListener('melody_user_updated', handleUpdate);
    };
  }, [user]);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!pwdInput) {
      setPwdError('Please enter a password');
      return;
    }
    if (pwdInput.length < 6) {
      setPwdError('Password must be at least 6 characters long');
      return;
    }
    if (pwdInput !== confirmPwdInput) {
      setPwdError('Passwords do not match');
      return;
    }

    setIsSavingPwd(true);
    try {
      const email = user?.email || auth.currentUser?.email || '';
      const uid = auth.currentUser?.uid || user?.uid || '';
      if (!email || !uid) {
        throw new Error('Unable to identify authenticated user account.');
      }

      const pwdHash = await hashPassword(pwdInput);
      await setUserPassword(uid, email, pwdHash);

      if (auth.currentUser) {
        await updatePassword(auth.currentUser, pwdInput).catch(() => {});
      }

      setPwdSuccess('Password saved! You can now log in using your email and password.');
      setPwdInput('');
      setConfirmPwdInput('');
      window.dispatchEvent(new CustomEvent('marts_show_toast', {
        detail: { message: 'Password set! You can now log in via email and password.', type: 'success' }
      }));
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPwdSuccess('');
      }, 1800);
    } catch (err: any) {
      setPwdError(err.message || 'Failed to save password. Please try again.');
    } finally {
      setIsSavingPwd(false);
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

          {/* Blocked User Notice */}
          {(user.isBlocked || user.blocked || user.status === 'blocked' || user.disabled) && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 animate-in fade-in">
              <ShieldAlert size={20} className="text-red-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-red-900">Account Blocked</p>
                <p className="text-red-700 mt-0.5">{user.blockReason || 'Your account has been blocked by the administrator. Ordering is currently disabled.'}</p>
              </div>
            </div>
          )}

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
              {/* Account Password for Email Login */}
              <button
                type="button"
                onClick={() => {
                  setPwdError('');
                  setPwdSuccess('');
                  setPwdInput('');
                  setConfirmPwdInput('');
                  setIsPasswordModalOpen(true);
                }}
                className="w-full text-left flex items-center justify-between py-4 hover:bg-gray-50 transition-colors -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-500 w-5 flex justify-center">
                    <Lock size={19} className="text-[#C85A32]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-800 group-hover:text-[#C85A32] transition-colors">
                      {user.hasPassword ? 'Change Password' : 'Set Password for Email Login'}
                    </span>
                    <p className="text-[11px] text-gray-400">
                      {user.hasPassword ? 'Update your password for email sign-in' : 'Enable email & password sign-in for this Google account'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>

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

      {/* Set Password Modal for Google Accounts or Password Updates */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-gray-100 relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#FAF0E6] flex items-center justify-center text-[#C85A32]">
                <Key size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {user.hasPassword ? 'Update Password' : 'Set Password for Email Login'}
              </h2>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {user.hasPassword
                ? 'Enter a new password for your account email.'
                : `Set a password for ${user.email || 'your account'} so you can also sign in directly using your email and password.`}
            </p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
                  New Password *
                </label>
                <input
                  type="password"
                  value={pwdInput}
                  onChange={(e) => setPwdInput(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[#C85A32] outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPwdInput}
                  onChange={(e) => setConfirmPwdInput(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[#C85A32] outline-none"
                />
              </div>

              {pwdError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPwd}
                  className="flex-1 py-2.5 bg-[#C85A32] hover:bg-[#A04724] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-75"
                >
                  {isSavingPwd ? (
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
