
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { MapPin, Plus, CreditCard, Trash2, Edit2, ShieldCheck, User as UserIcon, Camera, Save, ArrowLeft, ChevronRight, Zap, Check, Lock, Mail, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { auth } from '../firebase';
import {
  saveUserProfile,
  fetchUserAddresses,
  saveUserAddress,
  saveCustomerDeliveryAddress,
  StoreDeliveryAddress,
  AddressItem,
  deduplicateAddresses
} from '../services/dbService';
import { safeStorage, sanitizeUserForCache, broadcastUserUpdate } from '../utils/storage';
import CircleLoader from '../components/CircleLoader';

interface ProfileSubPagesProps {
  type: 'addresses' | 'payments' | 'edit';
  user: User | null;
  onUpdateUser?: (updated: User) => void;
}

const ProfileSubPages: React.FC<ProfileSubPagesProps> = ({ type, user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState(user?.name || '');
  const [phoneNum, setPhoneNum] = useState(user?.phone || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [type]);
  
  // Detailed address state for Profile Details edit
  const [houseNo, setHouseNo] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  const [userAddresses, setUserAddresses] = useState<AddressItem[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setPhoneNum(user.phone || '');
      
      const currentUser = auth.currentUser;
      const loadAddrs = async () => {
        let fetched: AddressItem[] = [];
        if (currentUser) {
          fetched = await fetchUserAddresses(currentUser.uid, user?.email || currentUser.email || undefined);
        }

        const uniqueList = deduplicateAddresses(fetched);

        if (uniqueList.length > 0) {
          setUserAddresses(uniqueList);
          const defaultAddr = uniqueList.find(a => a.isDefault) || uniqueList[0];
          setHouseNo(defaultAddr.houseNo || '');
          setArea(defaultAddr.area || '');
          setCity(defaultAddr.city || '');
          setStateName(defaultAddr.state || '');
          setPincode(defaultAddr.pincode || '');
        } else if (user.address) {
          setHouseNo(user.address);
          setUserAddresses([]);
        }
      };

      loadAddrs();
    }
  }, [user?.phone, user?.email, auth.currentUser?.uid]);

  useEffect(() => {
    if (!user) {
      const cached = safeStorage.getItem('marts_user_profile') || safeStorage.getItem('melody_user_profile');
      if (!cached) {
        navigate('/login');
      }
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    const currentUser = auth.currentUser;

    const formattedAddressStr = houseNo 
      ? `${houseNo}, ${area ? area + ', ' : ''}${city}, ${stateName} ${pincode}`
      : user.address;

    if (currentUser) {
      let deliveryAddrObj: StoreDeliveryAddress | undefined = undefined;
      if (houseNo) {
        deliveryAddrObj = {
          recipientName: fullName || 'Customer',
          phone: phoneNum || '',
          street: houseNo,
          apartment: area || undefined,
          postalCode: pincode || '',
          pin: pincode || '',
          city,
          state: stateName,
          country: 'India',
          isDefault: true,
          updatedAt: new Date().toISOString()
        };
      }

      await saveUserProfile(currentUser.uid, {
        name: fullName,
        phone: phoneNum,
        address: formattedAddressStr,
        deliveryAddress: deliveryAddrObj
      });

      if (houseNo && deliveryAddrObj) {
        const defaultAddrItem: AddressItem = {
          id: userAddresses[0]?.id || 'default',
          name: fullName || 'Customer',
          phone: phoneNum || '',
          pincode: pincode || '',
          houseNo,
          area,
          city,
          state: stateName,
          type: 'HOME',
          isDefault: true
        };
        await saveUserAddress(currentUser.uid, defaultAddrItem);
        await saveCustomerDeliveryAddress(currentUser.uid, deliveryAddrObj, currentUser.email || user.email);
        safeStorage.setItem('marts_default_address', JSON.stringify(defaultAddrItem));
        safeStorage.setItem('marts_user_address', formattedAddressStr);
      }
    } else {
      if (houseNo) {
        const defaultAddrItem: AddressItem = {
          id: 'addr_local',
          name: fullName || 'Customer',
          phone: phoneNum || '',
          pincode: pincode || '',
          houseNo,
          area,
          city,
          state: stateName,
          type: 'HOME',
          isDefault: true
        };
        safeStorage.setItem('marts_default_address', JSON.stringify(defaultAddrItem));
        safeStorage.setItem('marts_user_address', formattedAddressStr);
      }
    }

    const updatedUser: User = {
      name: fullName || user?.name || 'Customer',
      phone: phoneNum || user?.phone || '',
      email: user?.email || '',
      address: formattedAddressStr || user?.address || '',
      orders: user?.orders || []
    };

    safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updatedUser)));
    broadcastUserUpdate(updatedUser);
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }

    setIsSaving(false);
    setSaveSuccessMsg('Profile & Address details updated successfully!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
  };

  const renderAddresses = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Saved Addresses</h1>
          <p className="text-xs text-gray-400 font-medium">Manage your universal delivery locations</p>
        </div>
        <button 
          onClick={() => navigate('/address')}
          className="flex items-center gap-2 bg-[#C85A32] hover:bg-[#A04724] text-white px-6 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <Plus size={16} /> Manage Addresses
        </button>
      </div>

      <div className="space-y-4">
        {userAddresses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-3">No addresses saved yet.</p>
            <button
              onClick={() => navigate('/address')}
              className="bg-[#C85A32] hover:bg-[#A04724] text-white px-5 py-2 rounded-lg text-xs font-bold"
            >
              Add New Address
            </button>
          </div>
        ) : (
          userAddresses.map((item, index) => (
            <div 
              key={`${item.id || 'addr'}-${index}`} 
              className="bg-white border rounded-xl p-6 transition-all relative overflow-hidden border-gray-200"
            >
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                   <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-gray-100 text-gray-500">
                     {item.type}
                   </span>
                   {item.isDefault && (
                     <span className="text-xs font-bold text-[#C85A32] bg-[#FAF0E6] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                       <Check size={12} /> Universal Default
                     </span>
                   )}
                 </div>
                 <button
                   onClick={() => navigate('/address')}
                   className="text-xs font-bold text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
                 >
                   <Edit2 size={13} /> Edit
                 </button>
              </div>
              <h3 className="font-bold text-gray-800 mb-1">{item.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{item.houseNo}, {item.area ? `${item.area}, ` : ''}{item.city}, {item.state} {item.pincode}</p>
              <p className="text-sm font-black text-gray-800">Phone: {item.phone.startsWith('+') ? item.phone : `+91 ${item.phone}`}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );


  const renderPayments = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">My Wallet & Cards</h1>
          <p className="text-xs text-gray-400 font-medium">Securely stored payment methods</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Visual */}
        <div className="bg-gradient-to-br from-[#2B221B] to-[#964328] text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden aspect-[1.6/1] flex flex-col justify-between">
           <div className="flex justify-between items-start">
              <CreditCard size={32} strokeWidth={1.5} />
              <span className="text-[10px] font-black tracking-[0.2em] italic opacity-60 uppercase">Platinum Swift</span>
           </div>
           <div>
              <p className="text-xl tracking-[0.3em] font-black mb-6">•••• •••• •••• 4242</p>
              <div className="flex justify-between items-end">
                 <div>
                    <p className="text-[8px] font-black text-amber-100 uppercase tracking-widest mb-1">Valid Thru</p>
                    <p className="text-xs font-bold uppercase">12 / 28</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-amber-100 uppercase tracking-widest mb-1">Card Holder</p>
                    <p className="text-xs font-bold uppercase truncate max-w-[120px]">{user.name}</p>
                 </div>
              </div>
           </div>
           <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        {/* UPI Shortcut */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[#C85A32] transition-colors">
           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="text-[#C85A32]" />
           </div>
           <h3 className="font-bold text-gray-800">Add New Card</h3>
           <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Visa, Mastercard, RuPay</p>
        </div>
      </div>

      <div className="bg-[#FAF0E6] rounded-2xl p-6 flex items-center gap-4">
         <ShieldCheck size={24} className="text-[#C85A32] shrink-0" />
         <div className="text-[10px] text-[#8C3F1E] font-bold uppercase leading-relaxed tracking-tight">
            MArts Payments is 100% PCI-DSS compliant. Your security is our highest priority.
         </div>
      </div>
    </div>
  );

  const renderEdit = () => (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Profile Details</h1>
        <p className="text-xs text-gray-400 font-medium">Keep your account info up to date</p>
      </div>
      
      <div className="flex items-center gap-8 mb-10">
         <div className="relative group cursor-pointer">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
               <UserIcon size={40} className="text-gray-300" />
            </div>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
               <Camera size={20} className="text-white" />
            </div>
         </div>
         <div>
           <button className="text-[#C85A32] font-bold text-sm hover:underline">Change Profile Picture</button>
           <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">JPG, PNG or GIF. Max 1MB.</p>
         </div>
      </div>

      <form className="space-y-6">
         <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
               <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                  <span className="text-[10px] font-mono text-gray-400 font-medium">{fullName.length}/60</span>
               </div>
               <div className="relative flex items-center">
                  <input 
                    type="text" 
                    maxLength={60}
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    placeholder="Enter your full name (e.g. Rahul Sharma)"
                    className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                  />
                  {fullName.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFullName('')}
                      className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                      aria-label="Clear full name"
                      title="Clear"
                    >
                      <X size={15} />
                    </button>
                  )}
               </div>
            </div>
            <div className="space-y-1.5">
               <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone Number</label>
                  <span className="text-[10px] font-mono text-gray-400 font-medium">{phoneNum.length}/10</span>
               </div>
               <div className="relative flex items-center">
                  <input 
                    type="text" 
                    maxLength={10}
                    value={phoneNum} 
                    onChange={e => setPhoneNum(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    placeholder="Enter 10-digit mobile number"
                    className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                  />
                  {phoneNum.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPhoneNum('')}
                      className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                      aria-label="Clear phone number"
                      title="Clear"
                    >
                      <X size={15} />
                    </button>
                  )}
               </div>
            </div>
         </div>

         {/* Logged in Email (Uneditable for Security) */}
         <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span>Account Email</span>
                  {auth.currentUser?.providerData?.some(p => p.providerId === 'google.com') && (
                     <span className="text-[9px] text-[#C85A32] bg-[#FAF0E6] px-1.5 py-0.5 rounded font-bold">
                        Google Verified
                     </span>
                  )}
               </label>
               <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock size={10} className="text-amber-600" /> Uneditable for Security
               </span>
            </div>
            <div className="relative flex items-center">
               <input 
                 type="email" 
                 readOnly
                 tabIndex={-1}
                 value={user?.email || auth.currentUser?.email || ''} 
                 aria-readonly="true"
                 title="Logged-in email is uneditable for security and verification reasons."
                 className="w-full h-12 px-4 bg-gray-100/90 border border-gray-200 rounded-xl outline-none font-medium text-sm text-gray-700 cursor-not-allowed select-none" 
               />
               <div className="absolute right-4 text-emerald-600 pointer-events-none" title="Verified">
                  <ShieldCheck size={18} />
               </div>
            </div>
            <p className="text-[11px] text-gray-500 ml-1">
               This email is authenticated via {auth.currentUser?.providerData?.some(p => p.providerId === 'google.com') ? 'Google Sign-In' : 'your account login'} and locked for security.
            </p>
         </div>

         {/* Delivery Address Section */}
         <div className="border-t border-gray-100 pt-6 space-y-4">
            <div className="flex items-center gap-2">
               <MapPin size={18} className="text-[#C85A32]" />
               <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Default Delivery Address</h3>
            </div>
            <div className="space-y-1.5">
               <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">House No. / Building Name / Street</label>
                  <span className="text-[10px] font-mono text-gray-400 font-medium">{houseNo.length}/100</span>
               </div>
               <div className="relative flex items-center">
                  <input 
                    type="text" 
                    maxLength={100}
                    value={houseNo} 
                    onChange={e => setHouseNo(e.target.value)} 
                    placeholder="Flat / House no., floor, building name"
                    className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                  />
                  {houseNo.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHouseNo('')}
                      className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                      aria-label="Clear house number"
                      title="Clear"
                    >
                      <X size={15} />
                    </button>
                  )}
               </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Area / Locality / Sector</label>
                     <span className="text-[10px] font-mono text-gray-400 font-medium">{area.length}/100</span>
                  </div>
                  <div className="relative flex items-center">
                     <input 
                       type="text" 
                       maxLength={100}
                       value={area} 
                       onChange={e => setArea(e.target.value)} 
                       placeholder="Area, street, sector, landmark"
                       className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                     />
                     {area.length > 0 && (
                       <button
                         type="button"
                         onClick={() => setArea('')}
                         className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                         aria-label="Clear area"
                         title="Clear"
                       >
                         <X size={15} />
                       </button>
                     )}
                  </div>
               </div>
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pincode</label>
                     <span className="text-[10px] font-mono text-gray-400 font-medium">{pincode.length}/6</span>
                  </div>
                  <div className="relative flex items-center">
                     <input 
                       type="text" 
                       value={pincode} 
                       onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                       maxLength={6}
                       placeholder="Enter 6-digit pincode (e.g. 560001)"
                       className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                     />
                     {pincode.length > 0 && (
                       <button
                         type="button"
                         onClick={() => setPincode('')}
                         className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                         aria-label="Clear pincode"
                         title="Clear"
                       >
                         <X size={15} />
                       </button>
                     )}
                  </div>
               </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">City</label>
                     <span className="text-[10px] font-mono text-gray-400 font-medium">{city.length}/50</span>
                  </div>
                  <div className="relative flex items-center">
                     <input 
                       type="text" 
                       maxLength={50}
                       value={city} 
                       onChange={e => setCity(e.target.value)} 
                       placeholder="City or District (e.g. Bengaluru)"
                       className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                     />
                     {city.length > 0 && (
                       <button
                         type="button"
                         onClick={() => setCity('')}
                         className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                         aria-label="Clear city"
                         title="Clear"
                       >
                         <X size={15} />
                       </button>
                     )}
                  </div>
               </div>
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">State</label>
                     <span className="text-[10px] font-mono text-gray-400 font-medium">{stateName.length}/50</span>
                  </div>
                  <div className="relative flex items-center">
                     <input 
                       type="text" 
                       maxLength={50}
                       value={stateName} 
                       onChange={e => setStateName(e.target.value)} 
                       placeholder="State (e.g. Karnataka)"
                       className="w-full h-12 pl-4 pr-10 bg-gray-50 border rounded-xl outline-none focus:border-[#C85A32] font-bold text-sm transition-colors" 
                     />
                     {stateName.length > 0 && (
                       <button
                         type="button"
                         onClick={() => setStateName('')}
                         className="absolute right-3 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
                         aria-label="Clear state"
                         title="Clear"
                       >
                         <X size={15} />
                       </button>
                     )}
                  </div>
               </div>
            </div>
         </div>

         <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gender</label>
            <div className="flex gap-4">
              {['Male', 'Female', 'Other'].map(g => (
                <label key={g} className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 peer-checked:bg-[#FAF0E6] transition-colors">
                  <input type="radio" name="gender" className="accent-[#C85A32]" defaultChecked={g === 'Male'} />
                  <span className="text-xs font-bold">{g}</span>
                </label>
              ))}
            </div>
         </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

         <div className="pt-6">
            <button 
              type="button" 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-[#fb641b] text-white h-14 rounded font-black text-sm uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {isSaving ? 'Processing...' : <><Save size={18} /> Save Changes</>}
            </button>
         </div>
      </form>
    </div>
  );

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-xs sticky top-0 z-[100]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center gap-4">
          <button 
            type="button"
            onClick={() => handleGoBack(navigate, '/account')} 
            className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer shrink-0"
            aria-label="Go back to Profile"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 leading-tight capitalize">{type === 'edit' ? 'Edit Profile' : type}</h1>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 pb-20">
        <div className="w-full bg-white min-h-[600px]">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center">
            <CircleLoader size="lg" label="Loading profile details..." />
          </div>
        ) : (
          <>
            {type === 'addresses' && renderAddresses()}
            {type === 'payments' && renderPayments()}
            {type === 'edit' && renderEdit()}
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSubPages;
