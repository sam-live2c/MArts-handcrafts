import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { ArrowLeft, Plus, Check, Edit2, Trash2, MapPin, HelpCircle, CheckCircle, ShieldCheck, Mail, X } from 'lucide-react';
import { CartItem, User } from '../types';
import { auth } from '../firebase';
import {
  AddressItem,
  fetchUserAddresses,
  saveUserAddress,
  deleteUserAddress,
  deduplicateAddresses
} from '../services/dbService';

export type { AddressItem };

interface AddressPageProps {
  cart?: CartItem[];
  user?: User | null;
  onSelectAddress?: (addr: AddressItem) => void;
  onUpdateUser?: (updatedUser: User) => void;
}

// Google Brand Icon for verified Google login badge
const GoogleBrandIcon = () => (
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

// Helper to separate country code and phone number
const parsePhone = (rawPhone?: string) => {
  if (!rawPhone) return { countryCode: '+91', phone: '' };
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('+')) {
    const match = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { countryCode: match[1], phone: match[2].replace(/\D/g, '') };
    }
  }
  return { countryCode: '+91', phone: trimmed.replace(/\D/g, '') };
};

const AddressPage: React.FC<AddressPageProps> = ({ cart = [], user, onSelectAddress, onUpdateUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authenticated user email (retrieved regardless of whether signed in via Google or Email)
  const loggedInEmail = user?.email || auth.currentUser?.email || (() => {
    try {
      const cached = localStorage.getItem('melody_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.email || '';
      }
    } catch (e) {}
    return '';
  })();

  // Detect if user logged in via Google Auth provider
  const isGoogleAccount = Boolean(
    auth.currentUser?.providerData?.some(p => p.providerId === 'google.com') ||
    auth.currentUser?.photoURL?.includes('googleusercontent.com')
  );

  // Form State
  const [formData, setFormData] = useState(() => {
    const parsed = parsePhone(user?.phone);
    const emailVal = user?.email || auth.currentUser?.email || '';
    return {
      name: user?.name || '',
      countryCode: parsed.countryCode,
      phone: parsed.phone,
      email: emailVal,
      pincode: '',
      houseNo: user?.address || '',
      area: '',
      city: '',
      state: '',
      type: 'HOME' as 'HOME' | 'WORK' | 'OTHER',
      isDefault: true
    };
  });

  // Keep form data synced with active user profile if opening new address
  useEffect(() => {
    if (user && !editingId) {
      const parsed = parsePhone(user.phone);
      const emailVal = user.email || auth.currentUser?.email || '';
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        countryCode: prev.countryCode || parsed.countryCode,
        phone: prev.phone || parsed.phone,
        email: emailVal || prev.email,
        houseNo: prev.houseNo || user.address || ''
      }));
    }
  }, [user, editingId]);

  // Load user's addresses from Firestore or local storage on mount
  useEffect(() => {
    let isMounted = true;
    const loadAddresses = async () => {
      setIsLoading(true);
      const currentUser = auth.currentUser;
      let fetched: AddressItem[] = [];
      if (currentUser) {
        fetched = await fetchUserAddresses(currentUser.uid);
      }

      // Check localStorage if empty
      if (fetched.length === 0) {
        const localSaved = localStorage.getItem('melody_default_address') || localStorage.getItem('agronic_default_address');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            fetched = [parsed];
          } catch (e) {
            console.error(e);
          }
        }
      }

      const uniqueFetched = deduplicateAddresses(fetched);

      if (!isMounted) return;

      if (uniqueFetched.length > 0) {
        setAddresses(uniqueFetched);
        const defaultAddr = uniqueFetched.find(a => a.isDefault) || uniqueFetched[0];
        setSelectedId(defaultAddr.id);
        setShowForm(false);
      } else {
        setAddresses([]);
        setShowForm(true); // Open form automatically for users without an address
      }
      setIsLoading(false);
    };
    loadAddresses();
    return () => {
      isMounted = false;
    };
  }, [user?.phone, user?.email, auth.currentUser?.uid]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    const updated = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    setAddresses(updated);
    const selected = updated.find(a => a.id === id);
    if (selected) {
      const formattedStr = `${selected.houseNo}, ${selected.area ? selected.area + ', ' : ''}${selected.city}, ${selected.state} ${selected.pincode}`;
      localStorage.setItem('melody_default_address', JSON.stringify(selected));
      localStorage.setItem('melody_user_address', formattedStr);
      localStorage.setItem('agronic_default_address', JSON.stringify(selected));
      localStorage.setItem('agronic_user_address', formattedStr);
      const currentUser = auth.currentUser;
      if (currentUser) {
        const updatedUser = await saveUserAddress(currentUser.uid, selected);
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
      }

      if (onSelectAddress) {
        onSelectAddress(selected);
      }
      
      if (redirectTarget) {
        navigate(`/${redirectTarget}`);
      } else {
        navigate(-1);
      }
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    const parsed = parsePhone(user?.phone);
    setFormData({
      name: user?.name || '',
      countryCode: parsed.countryCode,
      phone: parsed.phone,
      email: loggedInEmail,
      pincode: '',
      houseNo: '',
      area: '',
      city: '',
      state: '',
      type: 'HOME',
      isDefault: addresses.length === 0
    });
    setShowForm(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, addr: AddressItem) => {
    e.stopPropagation();
    setEditingId(addr.id);
    const parsed = parsePhone(addr.phone);
    setFormData({
      name: addr.name,
      countryCode: parsed.countryCode,
      phone: parsed.phone,
      email: addr.email || loggedInEmail,
      pincode: addr.pincode,
      houseNo: addr.houseNo,
      area: addr.area,
      city: addr.city,
      state: addr.state,
      type: addr.type,
      isDefault: !!addr.isDefault
    });
    setShowForm(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (addresses.length <= 1) {
      showToast('You must keep at least one saved address');
      return;
    }
    const updated = addresses.filter(a => a.id !== id);
    setAddresses(updated);
    if (selectedId === id && updated.length > 0) {
      setSelectedId(updated[0].id);
    }
    const currentUser = auth.currentUser;
    if (currentUser) {
      await deleteUserAddress(currentUser.uid, id);
    }
    showToast('Address deleted');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.houseNo.trim()) {
      showToast('Please fill all required fields');
      return;
    }

    const currentUser = auth.currentUser;
    const targetId = editingId || ('addr_' + Date.now());

    const fullPhone = formData.countryCode
      ? `${formData.countryCode.trim()} ${formData.phone.trim()}`.trim()
      : formData.phone.trim();

    const addrToSave: AddressItem = {
      id: targetId,
      name: formData.name,
      phone: fullPhone,
      email: loggedInEmail || formData.email || user?.email || auth.currentUser?.email || '',
      pincode: formData.pincode,
      houseNo: formData.houseNo,
      area: formData.area,
      city: formData.city,
      state: formData.state,
      type: formData.type,
      isDefault: formData.isDefault || addresses.length === 0
    };

    const formattedStr = `${addrToSave.houseNo}, ${addrToSave.area ? addrToSave.area + ', ' : ''}${addrToSave.city}, ${addrToSave.state} ${addrToSave.pincode}`;

    if (addrToSave.isDefault || addresses.length === 0) {
      localStorage.setItem('melody_default_address', JSON.stringify(addrToSave));
      localStorage.setItem('melody_user_address', formattedStr);
      localStorage.setItem('agronic_default_address', JSON.stringify(addrToSave));
      localStorage.setItem('agronic_user_address', formattedStr);
    }

    let updatedProfile: User | null = null;
    if (currentUser) {
      updatedProfile = await saveUserAddress(currentUser.uid, addrToSave);
    } else {
      const cached = localStorage.getItem('melody_user_profile');
      let current: User = cached ? JSON.parse(cached) : { name: '', phone: '', email: '', address: '', orders: [] };
      updatedProfile = {
        ...current,
        name: addrToSave.name,
        phone: addrToSave.phone,
        address: formattedStr
      };
      localStorage.setItem('melody_user_profile', JSON.stringify(updatedProfile));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: updatedProfile }));
      }
    }

    if (onUpdateUser && updatedProfile) {
      onUpdateUser(updatedProfile);
    }

    if (editingId) {
      setAddresses(prev => {
        const withoutOld = prev.filter(item => item.id !== editingId && item.id !== addrToSave.id);
        const updated = formData.isDefault
          ? [addrToSave, ...withoutOld.map(a => ({ ...a, isDefault: false }))]
          : [...withoutOld, addrToSave];
        return deduplicateAddresses(updated);
      });
      showToast('Address and profile details updated successfully');
    } else {
      setAddresses(prev => {
        const withoutTarget = prev.filter(item => item.id !== addrToSave.id && item.id !== 'default');
        const updated = addrToSave.isDefault
          ? [addrToSave, ...withoutTarget.map(a => ({ ...a, isDefault: false }))]
          : [...withoutTarget, addrToSave];
        return deduplicateAddresses(updated);
      });
      setSelectedId(addrToSave.id);
      showToast('New default address set and profile updated');
    }

    setShowForm(false);
    setEditingId(null);

    if (redirectTarget) {
      setTimeout(() => {
        navigate(`/${redirectTarget}`);
      }, 500);
    }
  };

  const handleDeliverHere = async () => {
    const activeAddress = addresses.find(a => a.id === selectedId) || addresses[0];
    if (activeAddress) {
      const formattedStr = `${activeAddress.houseNo}, ${activeAddress.area ? activeAddress.area + ', ' : ''}${activeAddress.city}, ${activeAddress.state} ${activeAddress.pincode}`;
      localStorage.setItem('melody_default_address', JSON.stringify(activeAddress));
      localStorage.setItem('melody_user_address', formattedStr);
      localStorage.setItem('agronic_default_address', JSON.stringify(activeAddress));
      localStorage.setItem('agronic_user_address', formattedStr);

      const currentUser = auth.currentUser;
      if (currentUser) {
        const updatedUser = await saveUserAddress(currentUser.uid, { ...activeAddress, isDefault: true });
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
      }

      if (onSelectAddress) {
        onSelectAddress(activeAddress);
      }
    }

    if (redirectTarget) {
      navigate(`/${redirectTarget}`);
    } else if (cart.length > 0) {
      navigate('/checkout');
    } else {
      showToast('Delivery address saved successfully!');
      setTimeout(() => {
        handleGoBack(navigate, '/account');
      }, 1000);
    }
  };


  // Cart pricing calculation
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const oldTotalAmount = Math.round(totalAmount * 1.15);

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto shadow-sm">
        {/* Header - EXACT MATCH to prompt image without checkout steps */}
        <div className="bg-white py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] px-4 sm:px-8 lg:px-12 flex items-center gap-4 sticky top-0 z-30 border-b border-gray-100 shadow-xs">
          <button 
            type="button" 
            onClick={() => {
              if (showForm) {
                setShowForm(false);
              } else {
                handleGoBack(navigate, '/account');
              }
            }} 
            className="p-1 -ml-1 text-gray-800 hover:text-black rounded-full active:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft strokeWidth={2.5} size={22} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">Address</h1>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 pt-0 pb-4">

          {/* Form Modal / Inline View */}
          {showForm ? (
            <div className="pt-3 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  {editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                </h2>
              </div>

              <form id="address-form" onSubmit={handleSaveForm} className="space-y-4 pb-28 sm:pb-8">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                      {formData.name.length}/60
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name (e.g. Rahul Sharma)"
                      className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                    />
                    {formData.name.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, name: '' })}
                        className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        aria-label="Clear full name"
                        title="Clear"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                      {formData.phone.length}/10
                    </span>
                  </div>
                  <div className="flex rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-[#C85A32] focus-within:border-transparent transition-shadow bg-transparent overflow-hidden">
                    <input
                      type="text"
                      value={formData.countryCode}
                      onChange={e => {
                        let val = e.target.value.trim();
                        if (val === '') {
                          setFormData({ ...formData, countryCode: '' });
                        } else if (!val.startsWith('+')) {
                          setFormData({ ...formData, countryCode: '+' + val.replace(/[^\d]/g, '') });
                        } else {
                          setFormData({ ...formData, countryCode: '+' + val.slice(1).replace(/[^\d]/g, '') });
                        }
                      }}
                      onBlur={() => {
                        if (!formData.countryCode || formData.countryCode === '+') {
                          setFormData({ ...formData, countryCode: '+91' });
                        }
                      }}
                      maxLength={5}
                      placeholder="+91"
                      aria-label="Country Code"
                      className="w-16 sm:w-20 px-2 sm:px-3 py-2.5 text-sm font-semibold text-gray-800 bg-transparent border-r border-gray-300 outline-none text-center focus:text-[#C85A32] transition-colors"
                    />
                    <div className="relative flex-1 flex items-center min-w-0">
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10-digit mobile number"
                        className="w-full bg-transparent pl-3.5 pr-9 py-2.5 text-sm text-gray-900 outline-none"
                      />
                      {formData.phone.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, phone: '' })}
                          className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                          aria-label="Clear mobile number"
                          title="Clear"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Authenticated Email Field (Uneditable for Security Concerns) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <span>Email Address</span>
                      {isGoogleAccount ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C3F1E] bg-[#FAF0E6] border border-[#EADBCC] px-2 py-0.5 rounded-full">
                          <GoogleBrandIcon />
                          <span>Google Sign-In</span>
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-gray-500">(Verified Account)</span>
                      )}
                    </label>
                  </div>

                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none">
                      {isGoogleAccount ? (
                        <GoogleBrandIcon />
                      ) : (
                        <Mail size={16} className="text-gray-400 shrink-0" />
                      )}
                    </div>

                    <input
                      type="email"
                      readOnly
                      tabIndex={-1}
                      value={loggedInEmail || 'No account logged in'}
                      aria-readonly="true"
                      title="This email is linked to your authenticated login and cannot be edited for security concerns."
                      className="w-full bg-gray-100/90 border border-gray-300 rounded-md pl-10 pr-10 py-2.5 text-sm text-gray-800 font-medium cursor-not-allowed select-none outline-none focus:outline-none"
                    />

                    <div className="absolute right-3.5 flex items-center pointer-events-none text-emerald-600" title="Security Verified">
                      <ShieldCheck size={18} />
                    </div>
                  </div>

                  <p className="text-[11.5px] text-gray-500 mt-1.5 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                    <span>
                      {isGoogleAccount
                        ? 'Authenticated via Google. Uneditable for account security and order receipts.'
                        : 'Linked to your logged-in account. Uneditable for security concerns and order verification.'}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-gray-700">
                        Pincode <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                        {formData.pincode.length}/6
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={formData.pincode}
                        onChange={e => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="6-digit pincode (e.g. 560001)"
                        className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                      />
                      {formData.pincode.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, pincode: '' })}
                          className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                          aria-label="Clear pincode"
                          title="Clear"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-gray-700">
                        City / District <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                        {formData.city.length}/50
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City or District (e.g. Bengaluru)"
                        className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                      />
                      {formData.city.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, city: '' })}
                          className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                          aria-label="Clear city"
                          title="Clear"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Flat, House No., Building <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                      {formData.houseNo.length}/100
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={formData.houseNo}
                      onChange={e => setFormData({ ...formData, houseNo: e.target.value })}
                      placeholder="Flat, House no., Building name (e.g. 42A, Greenwood)"
                      className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                    />
                    {formData.houseNo.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, houseNo: '' })}
                        className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        aria-label="Clear house number"
                        title="Clear"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Area, Street, Locality <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                      {formData.area.length}/100
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={formData.area}
                      onChange={e => setFormData({ ...formData, area: e.target.value })}
                      placeholder="Area, Street, Sector, Landmark"
                      className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                    />
                    {formData.area.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, area: '' })}
                        className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        aria-label="Clear area"
                        title="Clear"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      State <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 font-medium">
                      {formData.state.length}/50
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      placeholder="State (e.g. Karnataka)"
                      className="w-full bg-transparent border border-gray-300 rounded-md pl-3.5 pr-9 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#C85A32] focus:border-transparent outline-none transition-shadow"
                    />
                    {formData.state.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, state: '' })}
                        className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        aria-label="Clear state"
                        title="Clear"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 pb-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-5 h-5 text-[#C85A32] border-gray-300 rounded focus:ring-2 focus:ring-[#C85A32] focus:ring-offset-1 transition-shadow cursor-pointer"
                  />
                  <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Make this my default delivery address
                  </label>
                </div>

                {/* Save and Cancel buttons: Fixed bottom buttons on mobile, compact & properly proportioned on tablet/desktop */}
                <div className="fixed sm:static bottom-0 left-0 right-0 z-40 bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t border-gray-200 sm:border-gray-100 px-4 sm:px-0 py-2.5 sm:py-0 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] sm:pb-0 sm:pt-6 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:shadow-none flex items-center gap-3 sm:justify-start">
                  <button
                    type="button"
                    id="address-cancel-btn"
                    onClick={() => setShowForm(false)}
                    className="flex-1 sm:flex-none sm:w-auto sm:min-w-[130px] h-12 sm:h-11 px-4 sm:px-6 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-bold text-[15px] sm:text-sm rounded-xl sm:rounded-lg transition-all flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="address-save-btn"
                    form="address-form"
                    className="flex-1 sm:flex-none sm:w-auto sm:min-w-[160px] h-12 sm:h-11 px-6 sm:px-8 bg-[#C85A32] hover:bg-[#A04724] active:bg-[#8C3F1E] text-white font-bold text-[15px] sm:text-sm rounded-xl sm:rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center cursor-pointer"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 -mt-[5px] w-full">
              
              {/* Address List Cards - Matching image layout strictly */}
              {addresses.map((addr, index) => {
                const isSelected = selectedId === addr.id;
                return (
                  <div
                    key={`${addr.id || 'addr'}-${index}`}
                    onClick={() => handleSelect(addr.id)}
                    className="py-5 relative items-start flex justify-between overflow-hidden cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Blue Accent Bar on left edge if selected */}
                    {isSelected && (
                      <div className="absolute top-0 -left-4 sm:-left-8 lg:-left-12 w-1 h-full bg-[#C85A32] hidden"></div>
                    )}

                    <div className="pr-4 flex-1">
                      {/* Name, Phone & Default Badge */}
                      <p className="text-base font-medium mb-1 text-gray-900 flex items-center gap-3 flex-wrap">
                        <span className="font-semibold">{addr.name}</span>
                        <span className="text-sm font-bold text-gray-800">{addr.phone}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-semibold text-[#C85A32] bg-[#FAF0E6] px-2 py-0.5 rounded-sm">
                            DEFAULT
                          </span>
                        )}
                      </p>

                      {/* Display verified account email */}
                      {(addr.email || loggedInEmail) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5 flex-wrap">
                          <span className="font-medium text-gray-700">{addr.email || loggedInEmail}</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                            <ShieldCheck size={11} className="text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        </div>
                      )}

                      {/* Full Address String */}
                      <p className="text-sm text-gray-600 leading-relaxed max-w-[290px] sm:max-w-xs">
                        {addr.houseNo}, {addr.area ? `${addr.area}, ` : ''}{addr.city}, {addr.state} {addr.pincode}
                      </p>

                      {/* Action buttons (Edit / Delete) */}
                      <div className="flex items-center gap-4 mt-4 pt-3">
                        <button
                          type="button"
                          onClick={e => handleOpenEdit(e, addr)}
                          className="text-sm font-semibold text-[#C85A32] flex items-center gap-1.5 hover:underline"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={e => handleDelete(e, addr.id)}
                          className="text-sm font-semibold text-gray-400 hover:text-red-500 flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>

                    {/* Radio selection check */}
                    <div className="pt-1">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-[#C85A32] bg-[#C85A32] text-white' : 'border-gray-300 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add a new address trigger */}
              <div className={`py-5 transition-colors ${addresses.length > 0 ? 'border-t border-gray-100' : 'flex flex-col items-center justify-center mt-10'}`}>
                {addresses.length === 0 && (
                  <div className="mb-4 bg-[#FAF0E6] p-4 rounded-full text-[#C85A32]">
                    <MapPin size={32} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className={`text-[#C85A32] font-bold text-sm flex items-center gap-2 cursor-pointer hover:underline ${addresses.length === 0 ? 'bg-[#FAF0E6] px-6 py-3 rounded-lg justify-center' : 'justify-start w-full'}`}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span>Add a new address</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Toast Notification - AI Studio White Theme, Square Corners, No Shadow, Single Line */}
      {toastMessage && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[250] bg-white text-gray-900 border border-gray-200 shadow-none px-4 py-2.5 rounded-none text-xs font-semibold flex items-center gap-2.5 whitespace-nowrap animate-in slide-in-from-top-3 fade-in duration-200 pointer-events-none select-none">
          <Check size={16} strokeWidth={2.8} className="text-[#0F9D58] shrink-0" />
          <span className="whitespace-nowrap">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default AddressPage;
