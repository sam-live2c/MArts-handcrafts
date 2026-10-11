
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';
import { 
  MapPin, LogOut, User as UserIcon, 
  Headphones, ArrowLeft, ShieldCheck, RefreshCw, FileText, ChevronRight, Package, Sparkles, Truck, Heart
} from 'lucide-react';
import { User } from '../types';
import { auth } from '../firebase';
import { fetchUserAddresses } from '../services/dbService';
import CircleLoader from '../components/CircleLoader';

interface AccountProps {
  user: User | null;
  onLogout: () => void;
}

const Account: React.FC<AccountProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [displayAddress, setDisplayAddress] = useState<string>(() => {
    return localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || user?.address || '';
  });

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
          const addresses = await fetchUserAddresses(currentUser.uid);
          if (addresses.length > 0) {
            const def = addresses.find(a => a.isDefault) || addresses[0];
            const formatted = `${def.houseNo}, ${def.area ? def.area + ', ' : ''}${def.city}, ${def.state} ${def.pincode}`;
            setDisplayAddress(formatted);
            localStorage.setItem('melody_user_address', formatted);
            localStorage.setItem('agronic_user_address', formatted);
            return;
          }
        } catch (e) {
          console.error('Error loading addresses for profile header:', e);
        }
      }
      const local = localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address');
      if (local) {
        setDisplayAddress(local);
      } else if (user?.address) {
        setDisplayAddress(user.address);
      }
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

  if (!user) {
    return (
      <div className="w-full bg-white min-h-screen font-sans relative">
        <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto pb-24 md:pb-8">
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
            {/* Melody Store Logo & Sign in prompt banner */}
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
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto shadow-sm pb-24 md:pb-8">
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

      <div className="w-full space-y-4">
        {/* Addresses & Help Center (position unchanged) */}
        <div className="flex flex-col gap-4">
          {gridOptions.map(option => (
            <Link 
              key={option.id}
              to={option.path}
              className="bg-white flex items-center gap-3 transition-colors py-2 group"
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
              className="flex items-center justify-between py-4 hover:bg-gray-50 transition-colors -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
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
          
          {/* Logout button aligned exactly with options */}
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
    </div>
  );
};

export default Account;
