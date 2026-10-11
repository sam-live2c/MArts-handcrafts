import React, { useState, useEffect, useRef } from 'react';
import { CartItem, User, Order } from '../types';
import { Lock, ArrowLeft, Check, ChevronDown, ChevronUp, Star, CreditCard, Banknote, Calendar, Building, Gift, HelpCircle, ArrowDown, Plus, Minus, ShieldCheck, CheckCircle2, AlertCircle, Smartphone, X, Upload, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { auth } from '../firebase';
import {
  saveRazorpayPaymentToFirestore,
  fetchUserAddresses,
  AddressItem,
  uploadCustomizationMedia,
  saveCustomerDeliveryAddress,
  StoreDeliveryAddress
} from '../services/dbService';
import { openRazorpayCheckout } from '../utils/razorpay';

const upiLogoIcon = 'https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg';

interface CustomizationFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image';
  previewUrl: string;
  storageUrl?: string;
  rawFile?: File;
}

interface ItemCustomization {
  files: CustomizationFile[];
  confirmed: boolean;
}

interface CheckoutProps {
  cart: CartItem[];
  setCart?: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
  user: User | null;
  onOrderSuccess: (order: Order) => void;
}

const Checkout: React.FC<CheckoutProps> = ({ cart, setCart, clearCart, user, onOrderSuccess }) => {
  const navigate = useNavigate();

  const updateQuantity = (id: string, delta: number) => {
    if (!setCart) return;
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };
  // 1: Address, 2: Summary, 3: Payment
  const [step, setStep] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'razorpay' | 'cod'>('razorpay');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [customizationToast, setCustomizationToast] = useState<string | null>(null);

  // Customization state
  const [customizations, setCustomizations] = useState<Record<string, ItemCustomization>>(() => {
    try {
      const saved = localStorage.getItem('melody_customizations_cache');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('melody_customizations_cache', JSON.stringify(customizations));
    } catch (e) {}
  }, [customizations]);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [activeCustomizationItemId, setActiveCustomizationItemId] = useState<string | null>(null);
  const [modalFiles, setModalFiles] = useState<CustomizationFile[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openCustomizationModal = (itemId: string) => {
    setActiveCustomizationItemId(itemId);
    const existing = customizations[itemId];
    if (existing && existing.confirmed) {
      setModalFiles([...existing.files]);
      setTermsAccepted(true);
    } else {
      setModalFiles([]);
      setTermsAccepted(false);
    }
    setIsCustomizationModalOpen(true);
  };

  const handleFiles = (files: FileList | File[]) => {
    const remainingSlots = 3 - modalFiles.length;
    if (remainingSlots <= 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length && i < remainingSlots; i++) {
      const f = files[i];
      if (f) fileList.push(f);
    }

    fileList.forEach((file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg)$/i.test(file.name);

      if (!isPdf && !isImage) {
        setPaymentError('Only PDF, JPG, or PNG files are supported.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        const formattedSize = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`;

        setModalFiles(prev => {
          if (prev.length >= 3) return prev;
          return [
            ...prev,
            {
              id: 'file_' + Math.random().toString(36).substr(2, 9),
              name: file.name,
              size: formattedSize,
              type: isPdf ? 'pdf' : 'image',
              previewUrl: dataUrl,
              rawFile: file
            }
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setModalFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmCustomization = async () => {
    if (modalFiles.length < 1 || !termsAccepted || !activeCustomizationItemId) return;
    const currentItemId = activeCustomizationItemId;

    // Immediately save locally with preview URLs for zero latency
    setCustomizations(prev => ({
      ...prev,
      [currentItemId]: {
        files: [...modalFiles],
        confirmed: true
      }
    }));

    setIsCustomizationModalOpen(false);
    setCustomizationToast('Customization confirmed successfully!');
    setTimeout(() => {
      setCustomizationToast(null);
    }, 4000);

    // Asynchronously upload to Firebase Storage
    try {
      const filesToUpload = [...modalFiles];
      const updatedFiles = await Promise.all(
        filesToUpload.map(async (f) => {
          if (f.rawFile) {
            try {
              const downloadUrl = await uploadCustomizationMedia(currentItemId, f.rawFile, f.name);
              return {
                ...f,
                storageUrl: downloadUrl || f.previewUrl
              };
            } catch (err) {
              console.warn('Storage upload note:', err);
              return f;
            }
          }
          return f;
        })
      );

      setCustomizations(prev => ({
        ...prev,
        [currentItemId]: {
          files: updatedFiles,
          confirmed: true
        }
      }));
    } catch (e) {
      console.warn('Customization media background upload notice:', e);
    }
  };

  const [activeAddress, setActiveAddress] = useState(() => {
    const localSaved = localStorage.getItem('melody_default_address') || localStorage.getItem('agronic_default_address');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        return {
          name: parsed.name || user?.name || '',
          phone: parsed.phone || user?.phone || '',
          houseNo: parsed.houseNo || user?.address || '',
          area: parsed.area || '',
          city: parsed.city || '',
          state: parsed.state || '',
          pincode: parsed.pincode || '',
          type: parsed.type || 'HOME'
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      name: user?.name || '',
      phone: user?.phone || '',
      houseNo: user?.address || '',
      area: '',
      city: '',
      state: '',
      pincode: '',
      type: 'HOME'
    };
  });

  useEffect(() => {
    const loadAddress = async () => {
      const currentUser = auth.currentUser;
      let addresses: AddressItem[] = [];
      if (currentUser) {
        addresses = await fetchUserAddresses(currentUser.uid);
      }

      if (addresses.length === 0) {
        const localSaved = localStorage.getItem('melody_default_address') || localStorage.getItem('agronic_default_address');
        if (localSaved) {
          try {
            addresses = [JSON.parse(localSaved)];
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (addresses.length > 0) {
        const active = addresses.find(a => a.isDefault) || addresses[0];
        setActiveAddress({
          name: active.name,
          phone: active.phone,
          houseNo: active.houseNo,
          area: active.area,
          city: active.city,
          state: active.state,
          pincode: active.pincode,
          type: active.type
        });
      } else if (user?.address) {
        setActiveAddress(prev => ({
          ...prev,
          name: user.name || prev.name,
          phone: user.phone || prev.phone,
          houseNo: user.address
        }));
      }
    };
    loadAddress();
  }, [user]);

  const baseTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const customizedCount = (Object.values(customizations) as ItemCustomization[]).filter(c => c.confirmed && c.files.length > 0).length;
  const customizationFee = customizedCount > 0 ? customizedCount * 5 : 0;
  const total = baseTotal + customizationFee;
  const originalTotal = cart.reduce((sum, item) => sum + ((item.oldPrice || item.price) * item.quantity), 0);
  const savings = originalTotal - baseTotal;

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=checkout');
      return;
    }
    const savedAddr = localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || user.address;
    if ((!savedAddr || savedAddr.trim() === '') && (!activeAddress.houseNo || activeAddress.houseNo.trim() === '')) {
      navigate('/address?redirect=checkout');
    }
  }, [user, activeAddress, navigate]);

  useEffect(() => {
    // scroll to top on step change
    window.scrollTo(0, 0);
  }, [step]);

  const handlePlaceOrder = async () => {
    setPaymentError(null);
    setIsProcessing(true);
    const currentUser = auth.currentUser;
    const uid = currentUser ? currentUser.uid : 'guest';

    // Synchronize shipping address to Melody App & Firestore schema
    if (currentUser && activeAddress.houseNo) {
      const storeDeliveryAddr: StoreDeliveryAddress = {
        recipientName: activeAddress.name || user?.name || 'Customer',
        phone: activeAddress.phone || user?.phone || '',
        street: activeAddress.houseNo,
        apartment: activeAddress.area || undefined,
        postalCode: activeAddress.pincode,
        pin: activeAddress.pincode,
        city: activeAddress.city,
        state: activeAddress.state,
        country: 'India',
        isDefault: true,
        updatedAt: new Date().toISOString()
      };
      saveCustomerDeliveryAddress(currentUser.uid, storeDeliveryAddr, user?.email || currentUser.email || undefined).catch(e => {
        console.warn('Checkout address sync notice:', e);
      });
    }

    if (paymentOption === 'razorpay') {
      try {
        const orderId = 'OD' + Math.floor(Math.random() * 1000000000000);

        // Open client-side verified payment flow
        const razorpayRes = await openRazorpayCheckout({
          amount: total,
          orderId: orderId,
          customerName: activeAddress.name || user?.name || 'Customer',
          customerPhone: activeAddress.phone || user?.phone || '',
          customerEmail: user?.email || 'customer@marts.com',
          description: `Order #${orderId} - MArts Handcrafted Pottery & Statues`
        });

        const paymentId = razorpayRes.razorpay_payment_id;

        await saveRazorpayPaymentToFirestore({
          paymentId: paymentId,
          orderId: orderId,
          userId: uid,
          amount: total,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'Online Payment (UPI/Cards)',
          customerName: activeAddress.name,
          customerPhone: activeAddress.phone,
          customerEmail: user?.email || 'customer@marts.com',
          createdAt: Date.now()
        });

        const customerDeliveryAddr = [
          activeAddress.houseNo,
          activeAddress.area,
          activeAddress.city,
          activeAddress.state,
          activeAddress.pincode
        ].filter(Boolean).join(', ') || user?.address || 'Customer Delivery Address';

        const newOrder: Order = {
          id: orderId,
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: cart.map(item => ({
            ...item,
            customization: customizations[item.id] || null
          })),
          total: total,
          status: 'Processing',
          paymentId: paymentId,
          paymentMethod: 'Online Payment (UPI/Cards)',
          paymentStatus: 'PAID',
          customerName: activeAddress.name || user?.name || 'Customer',
          customerPhone: activeAddress.phone || user?.phone || '',
          customerEmail: user?.email || '',
          customerAddress: customerDeliveryAddr,
          createdAt: Date.now()
        };

        setIsOrderPlaced(true);
        onOrderSuccess(newOrder);
        clearCart();
        navigate('/orders', { 
          replace: true,
          state: {
            paymentStatus: 'success',
            orderId: orderId,
            paymentId: paymentId,
            paymentMethod: 'Online Payment (UPI/Cards)',
            amount: total
          }
        });
      } catch (err: unknown) {
        setIsProcessing(false);
        if (err instanceof Error && err.message === 'PAYMENT_CANCELLED') {
          setPaymentError('Payment cancelled. Please try again.');
        } else {
          setPaymentError(err instanceof Error ? err.message : 'Payment could not be processed. Please try again.');
          console.error('Payment Error:', err);
        }
        setTimeout(() => {
          setPaymentError(null);
        }, 6000);
      }
    } else {
      // Cash on Delivery
      setTimeout(async () => {
        const orderId = 'OD' + Math.floor(Math.random() * 1000000000000);
        const customerDeliveryAddr = [
          activeAddress.houseNo,
          activeAddress.area,
          activeAddress.city,
          activeAddress.state,
          activeAddress.pincode
        ].filter(Boolean).join(', ') || user?.address || 'Customer Delivery Address';

        const newOrder: Order = {
          id: orderId,
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: cart.map(item => ({
            ...item,
            customization: customizations[item.id] || null
          })),
          total: total,
          status: 'Processing',
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'PENDING',
          customerName: activeAddress.name || user?.name || 'Customer',
          customerPhone: activeAddress.phone || user?.phone || '',
          customerEmail: user?.email || '',
          customerAddress: customerDeliveryAddr,
          createdAt: Date.now()
        };

        setIsOrderPlaced(true);
        onOrderSuccess(newOrder);
        clearCart();
        navigate('/orders', { 
          replace: true,
          state: {
            paymentStatus: 'success',
            orderId: orderId,
            paymentMethod: 'Cash on Delivery',
            amount: total
          }
        });
      }, 1000);
    }
  };


  useEffect(() => {
    if (cart.length === 0 && !isOrderPlaced) {
      navigate('/cart', { replace: true });
    }
  }, [cart.length, navigate, isOrderPlaced]);

  if (cart.length === 0 && !isOrderPlaced) {
    return null;
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto shadow-sm pb-16 md:pb-6">
          {/* Header */}
          {step === 3 ? (
             <div className="bg-white border-b border-gray-100 shadow-xs px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center justify-between sticky top-0 z-[100]">
                <div className="flex gap-4 items-center">
                   <button 
                     type="button"
                     onClick={() => setStep(2)} 
                     className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-800 cursor-pointer shrink-0"
                     aria-label="Go back to order summary"
                   >
                     <ArrowLeft size={20} />
                   </button>
                   <div className="leading-tight">
                     <p className="text-[11px] text-gray-500 font-medium mb-0.5">Step 3 of 3</p>
                     <h1 className="text-lg font-bold text-gray-900 leading-tight">Payments</h1>
                   </div>
                </div>
                <div className="text-[11px] flex items-center gap-1.5 text-[#C85A32] font-extrabold italic">
                   <svg className="w-4 h-4 shrink-0" viewBox="0 0 100 100">
                      <path d="M50 8 C68 18 82 18 88 23 C88 53 75 78 50 95 C25 78 12 53 12 23 C18 18 32 18 50 8 Z" fill="currentColor" />
                      <path d="M36 48 L46 58 L66 36" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                   </svg>
                   100% Secure Payment
                </div>
             </div>
          ) : (
             <div className="bg-white border-b border-gray-100 shadow-xs px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center gap-4 sticky top-0 z-[100]">
                <button 
                  type="button"
                  onClick={() => {
                    if (step === 1) {
                      setStep(2);
                    } else {
                      handleGoBack(navigate, '/cart');
                    }
                  }} 
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-800 cursor-pointer shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-gray-900">{step === 1 ? 'Address' : 'Order Summary'}</h1>
             </div>
          )}

          {/* Stepper only on Step 1 and 2 */}
          {step < 3 && (
            <div className="bg-white px-4 sm:px-8 lg:px-12 py-3.5 sm:py-4 flex items-center justify-between relative z-1 border-b border-gray-100">
               <div className="flex flex-col items-center">
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step > 1 ? 'bg-[#C85A32] text-white border border-[#C85A32]' : 'border border-[#C85A32] text-[#C85A32] bg-[#FAF0E6]'}`}>
                   {step > 1 ? <Check size={12} strokeWidth={3} /> : '1'}
                 </div>
                 <span className={`text-[10px] mt-1 font-medium ${step >= 1 ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>Address</span>
               </div>
               <div className={`flex-1 h-[1.5px] mx-2 -mt-3 ${step > 1 ? 'bg-[#C85A32]' : 'bg-gray-200'}`}></div>
               <div className="flex flex-col items-center">
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-[#C85A32] text-white' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                   2
                 </div>
                 <span className={`text-[10px] mt-1 whitespace-nowrap font-medium ${step >= 2 ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>Order Summary</span>
               </div>
               <div className="flex-1 h-[1.5px] mx-2 -mt-3 bg-gray-200"></div>
               <div className="flex flex-col items-center">
                 <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-100 text-gray-400 border border-gray-200">
                   3
                 </div>
                 <span className="text-[10px] mt-1 font-medium text-gray-400">Payment</span>
               </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6 pb-20 md:pb-8 min-h-[calc(100vh-140px)]">
             {/* STEP 1: ADDRESS */}
             {step === 1 && (
               <div className="w-full space-y-4">
                  {/* Delivery Address Subheader */}
                  <div className="mb-[11px] pb-[11px] flex items-center justify-between border-b border-gray-100">
                     <div className="flex flex-col pr-2">
                        <h2 className="text-base font-bold text-gray-900">Select Delivery Address</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Your items will be shipped to this address</p>
                     </div>
                     <button 
                       type="button"
                       onClick={() => navigate('/address')} 
                       className="text-sm font-semibold text-[#C85A32] hover:text-[#A04724] transition-colors px-3 py-1.5 hover:bg-[#FAF0E6] rounded shrink-0 cursor-pointer text-right"
                     >
                       + Add new address
                     </button>
                  </div>

                  {/* Active Address Card - flush without box outlines */}
                  <div className="py-4 border-b border-gray-100 flex items-start justify-between">
                     <div className="pr-4">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide">
                              {activeAddress.type || 'HOME'}
                           </span>
                           <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                              <Check size={13} strokeWidth={2.5} /> Selected for delivery
                           </span>
                        </div>
                        <p className="text-base font-semibold mb-1 text-gray-900 flex items-center gap-3">
                           <span>{activeAddress.name}</span> <span className="text-sm font-bold text-gray-800">{activeAddress.phone}</span>
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed max-w-xl">
                           {activeAddress.houseNo}{activeAddress.area ? `, ${activeAddress.area}` : ''}, {activeAddress.city}, {activeAddress.state} - {activeAddress.pincode}
                        </p>
                     </div>
                     <button 
                       type="button"
                       onClick={() => navigate('/address')} 
                       className="text-sm font-semibold text-[#C85A32] hover:text-[#A04724] transition-colors px-3 py-1.5 hover:bg-[#FAF0E6] rounded shrink-0 cursor-pointer"
                     >
                        Change
                     </button>
                  </div>

                  <div className="hidden md:flex justify-end pt-4">
                     <button 
                       type="button"
                       onClick={() => setStep(2)} 
                       className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-8 h-12 rounded-xl text-[16px] min-w-[200px] shadow-sm transition-colors flex items-center justify-center cursor-pointer"
                     >
                        Deliver Here
                     </button>
                  </div>
               </div>
             )}

             {/* STEP 2: SUMMARY */}
             {step === 2 && (
               <div className="w-full">
                 <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full space-y-6">
                      {/* Deliver to address row - clean border divider like Profile */}
                      <div className="pb-5 border-b border-gray-100 flex justify-between items-start">
                         <div className="pr-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Deliver to:</p>
                            <p className="text-base font-semibold text-gray-900">{activeAddress.name} <span className="text-sm font-normal text-gray-600 ml-2">{activeAddress.phone}</span></p>
                            <p className="text-sm text-gray-600 leading-relaxed mt-0.5 max-w-xl">
                               {activeAddress.houseNo}{activeAddress.area ? `, ${activeAddress.area}` : ''}, {activeAddress.city}, {activeAddress.state} - {activeAddress.pincode}
                            </p>
                         </div>
                         <button 
                           type="button"
                           onClick={() => navigate('/address')} 
                           className="text-sm font-semibold text-[#C85A32] hover:text-[#A04724] px-3 py-1 hover:bg-[#FAF0E6] rounded transition-colors shrink-0 cursor-pointer"
                         >
                            Change
                         </button>
                      </div>

                      {/* Products List - clean divide-y without outer rounded card outline */}
                      <div className="divide-y divide-gray-100">
                        {cart.map((item, idx) => (
                          <div key={idx} className="py-5 sm:py-6 first:pt-0 last:pb-0">
                             <div className="flex gap-4 sm:gap-5">
                                <div className="w-[90px] sm:w-[100px] shrink-0 flex flex-col items-center">
                                   <div className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] bg-[#FAF7F2] border border-[#EADBCC]/60 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                                     <img src={item.image} referrerPolicy="no-referrer" className="w-full h-full object-contain" alt={item.name} />
                                   </div>
                                </div>
                                <div className="flex-1 relative">
                                   <p className="text-[16px] font-semibold text-gray-900 line-clamp-1 leading-tight mb-1">{item.name}</p>
                                   <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-1 truncate">{item.category}</p>
                                   <div className="flex flex-wrap items-center gap-2 mt-2">
                                      {item.oldPrice && item.oldPrice > item.price && (
                                        <>
                                          <span className="text-[#C85A32] font-bold text-[13px] flex items-center tracking-tight"><ArrowDown size={14} strokeWidth={2.5} />{Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)}%</span>
                                          <del className="text-gray-400 text-sm font-normal" aria-label="Maximum retail price">₹{(item.oldPrice * item.quantity).toLocaleString()}</del>
                                        </>
                                      )}
                                      <span className="text-[19px] font-semibold text-gray-900 leading-none">₹{(item.price * item.quantity).toLocaleString()}</span>
                                   </div>
                                   <div className="mt-2 text-[13px] text-gray-600">
                                      Delivery by <span className="font-semibold text-gray-900">Jun 11, Thu</span>
                                   </div>

                                   {/* Quantity Selector and Customise Button Strictly SIDE BY SIDE */}
                                   <div className="mt-3 flex items-center gap-2 sm:gap-3 flex-nowrap">
                                      {/* Quantity Selector */}
                                      <div className="flex items-center rounded-lg bg-gray-100 overflow-hidden h-8">
                                         <button 
                                           type="button"
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             updateQuantity(item.id, -1);
                                           }}
                                           className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 active:bg-gray-300 transition-colors cursor-pointer border-0"
                                           aria-label="Decrease quantity"
                                         >
                                           <Minus size={13} />
                                         </button>
                                         <span className="w-8 text-center font-bold text-xs text-gray-800">{item.quantity}</span>
                                         <button 
                                           type="button"
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             updateQuantity(item.id, 1);
                                           }}
                                           className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 active:bg-gray-300 transition-colors cursor-pointer border-0"
                                           aria-label="Increase quantity"
                                         >
                                           <Plus size={13} />
                                         </button>
                                      </div>

                                   </div>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Product Price Summary - Clean layout, no card outline */}
                    <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l lg:border-gray-100 pt-6 lg:pt-0 lg:pl-8 lg:sticky lg:top-[80px]">
                       <h3 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100">Price Details</h3>
                       <div className="space-y-3 pt-3 text-sm text-gray-700">
                          <div className="flex justify-between">
                             <span>MRP ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                             <span>₹{originalTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                             <span>Discount</span>
                             <span className="text-[#C85A32] font-medium">
                               {savings > 0 ? `- ₹${savings.toLocaleString()}` : '- ₹0'}
                             </span>
                          </div>
                          {customizationFee > 0 && (
                            <div className="flex justify-between text-gray-800">
                               <span>Customization Fee</span>
                               <span className="font-medium text-gray-900">+ ₹{customizationFee.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                             <span>Delivery</span>
                             <span className="text-[#C85A32] font-medium">Free</span>
                          </div>
                          <div className="flex justify-between">
                             <span>18% GST</span>
                             <span>Included</span>
                          </div>
                          <div className="flex justify-between font-bold text-gray-900 text-base pt-3 mt-1 border-t border-gray-100">
                             <span>Total price</span>
                             <span>₹{total.toLocaleString()}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Desktop Bottom Action Row - Placed at the right matching payment page pay button */}
                 <div className="hidden md:flex py-4 border-t border-gray-100 items-center justify-between gap-4 mt-6">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                       <ShieldCheck size={16} className="text-[#C85A32] shrink-0" />
                       <span>100% Authentic Products • Verified MArts Artisan Partner</span>
                    </div>
                    <div>
                       <button 
                         type="button"
                         onClick={() => setStep(3)} 
                         className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-8 h-12 rounded-xl text-[16px] w-[240px] shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                       >
                          Continue
                       </button>
                    </div>
                 </div>
               </div>
             )}

             {/* STEP 3: PAYMENTS */}
             {step === 3 && (
                <div className="w-full space-y-6">
                    {/* Amount Payable Subheader - clean border divider like Profile */}
                    <div className="mb-[11px] pb-[11px] flex items-center justify-between border-b border-gray-100">
                       <div>
                         <h2 className="text-base font-bold text-gray-900">Total Amount Payable</h2>
                         <p className="text-xs text-gray-500 mt-0.5">Includes all taxes and free delivery</p>
                       </div>
                       <span className="text-2xl font-extrabold text-[#C85A32]">₹{total.toLocaleString()}</span>
                    </div>

                    {/* Payment Options Section - flush, clean dividers */}
                    <div className="py-3 border-b border-gray-100 space-y-4">
                       <label 
                         onClick={() => setPaymentOption('razorpay')}
                         className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                           paymentOption === 'razorpay' 
                             ? 'border-[#C85A32] bg-[#FAF6F2]' 
                             : 'border-gray-200 hover:border-gray-300'
                         }`}
                       >
                          <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            paymentOption === 'razorpay' ? 'border-[#C85A32]' : 'border-gray-300'
                          }`}>
                             {paymentOption === 'razorpay' && <div className="w-2.5 h-2.5 rounded-full bg-[#C85A32]"></div>}
                          </div>
                          <div className="flex-1">
                             <div className="flex items-center justify-between">
                               <h3 className="font-bold text-gray-900 text-sm sm:text-base">Instant Online Payment</h3>
                             </div>
                             <p className="text-xs text-gray-600 mt-1">
                                Instant checkout with UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards &amp; NetBanking
                             </p>

                             {/* Supported App Logos */}
                             <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex items-center flex-wrap gap-2.5">
                                <div className="h-6 px-2 bg-white border border-gray-200 rounded flex items-center justify-center shadow-2xs">
                                  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="UPI" className="h-3.5 object-contain" referrerPolicy="no-referrer" />
                                </div>
                                <div className="h-6 px-2 bg-white border border-gray-200 rounded flex items-center justify-center shadow-2xs">
                                  <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="GPay" className="h-3.5 object-contain" referrerPolicy="no-referrer" />
                                </div>
                                <div className="h-6 px-2 bg-white border border-gray-200 rounded flex items-center justify-center shadow-2xs">
                                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" alt="PhonePe" className="h-3.5 object-contain" referrerPolicy="no-referrer" />
                                </div>
                                <div className="h-6 px-2 bg-white border border-gray-200 rounded flex items-center justify-center shadow-2xs">
                                  <img src="https://upload.wikimedia.org/wikipedia/commons/4/42/Paytm_logo.png" alt="Paytm" className="h-3 object-contain" referrerPolicy="no-referrer" />
                                </div>
                                <span className="text-[11px] font-semibold text-gray-500">+ Cards &amp; NetBanking</span>
                             </div>
                          </div>
                       </label>

                       <label 
                         onClick={() => setPaymentOption('cod')}
                         className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                           paymentOption === 'cod' 
                             ? 'border-[#C85A32] bg-[#FAF6F2]' 
                             : 'border-gray-200 hover:border-gray-300'
                         }`}
                       >
                          <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            paymentOption === 'cod' ? 'border-[#C85A32]' : 'border-gray-300'
                          }`}>
                             {paymentOption === 'cod' && <div className="w-2.5 h-2.5 rounded-full bg-[#C85A32]"></div>}
                          </div>
                          <div className="flex-1">
                             <h3 className="font-bold text-gray-900 text-sm sm:text-base">Cash on Delivery (Pay on Arrival)</h3>
                             <p className="text-xs text-gray-600 mt-1">
                                Pay securely in cash or UPI QR code when your artisan pottery or statue is delivered to your doorstep.
                             </p>
                          </div>
                       </label>
                    </div>

                    {/* Delivery summary reminder */}
                    <div className="py-3 border-b border-gray-100 flex items-center justify-between">
                       <div className="text-sm">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Delivering to</span>
                          <span className="font-medium text-gray-900">{activeAddress.name}</span>
                          <span className="text-gray-500 text-xs ml-2">({activeAddress.pincode})</span>
                       </div>
                       <button 
                         type="button"
                         onClick={() => setStep(1)} 
                         className="text-xs font-semibold text-[#C85A32] hover:text-[#9C4320] cursor-pointer"
                       >
                          Change Address
                       </button>
                    </div>

                    {/* Official partner & security */}
                    <div className="py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                           <ShieldCheck size={16} className="text-[#C85A32] shrink-0" />
                           <span>256-bit SSL Encrypted • MArts Direct Artisan Protection</span>
                        </div>
                        <div className="hidden md:block">
                           <button 
                             type="button"
                             onClick={handlePlaceOrder} 
                             disabled={isProcessing} 
                             className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-8 h-12 rounded-xl text-[16px] w-[240px] shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                           >
                              {isProcessing ? (
                                <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                                  <svg className="animate-spin h-4 w-4 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Confirming Order...</span>
                                </span>
                              ) : (
                                `Place Order • ₹${total.toLocaleString()}`
                              )}
                           </button>
                        </div>
                    </div>
                </div>
             )}
          </div>

          {/* Sticky Bottom Bar for Checkout */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 w-full z-[100] flex justify-center pointer-events-none">
             <div className="w-full max-w-5xl bg-white border-t border-gray-100 h-[62px] px-4 sm:px-8 lg:px-12 flex items-center justify-between pointer-events-auto">
                 <div>
                   {originalTotal > total && (
                     <p className="text-gray-400 line-through text-[11px] font-medium leading-tight mb-0.5">₹{originalTotal.toLocaleString()}</p>
                   )}
                   <p className="text-lg font-bold flex items-center gap-1 text-gray-900 leading-none">₹{total.toLocaleString()} <HelpCircle size={12} className="text-gray-400 mb-0.5" strokeWidth={2.5}/></p>
                 </div>
                 {step === 1 && (
                   <button onClick={() => setStep(2)} className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-6 h-11 rounded-xl text-[15px] w-[170px] shadow-md transition-colors flex items-center justify-center cursor-pointer">
                      Deliver Here
                   </button>
                 )}
                 {step === 2 && (
                   <button onClick={() => setStep(3)} className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-6 h-11 rounded-xl text-[15px] w-[170px] shadow-md transition-colors flex items-center justify-center cursor-pointer">
                      Continue
                   </button>
                 )}
                 {step === 3 && (
                   <button 
                     onClick={handlePlaceOrder} 
                     disabled={isProcessing} 
                     className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-4 h-11 rounded-xl text-[15px] w-[170px] shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                   >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <svg className="animate-spin h-4 w-4 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{paymentOption === 'razorpay' ? 'Connecting...' : 'Processing...'}</span>
                        </span>
                      ) : (
                        paymentOption === 'razorpay' ? `Pay ₹${total.toLocaleString()}` : `Place Order (COD)`
                      )}
                   </button>
                 )}
             </div>
          </div>

          {/* Customization Popup Page / Modal */}
          {isCustomizationModalOpen && (
            <div 
              id="customization-modal-overlay"
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsCustomizationModalOpen(false);
              }}
            >
              <div 
                id="customization-modal-container"
                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header: Specifically dedicated for Upload and Customization */}
                <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-white">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 p-1.5 shadow-2xs">
                      {/* Website Melody 'm' Logo Icon */}
                      <svg
                        viewBox="0 0 86 70"
                        className="h-full w-auto aspect-[86/70]"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-label="Website 'm' logo"
                      >
                        <g strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round">
                          {/* Blue: Lower Left Stem */}
                          <path d="M 16 56 L 16 34" stroke="#4285F4" />
                          {/* Yellow: Top-Left Arch */}
                          <path d="M 16 34 C 16 16, 43 16, 43 34" stroke="#FBBC05" />
                          {/* Red: Center Stem & Top-Right Arch */}
                          <path d="M 43 56 L 43 34 C 43 16, 70 16, 70 34" stroke="#EA4335" />
                          {/* Green: Lower Right Stem */}
                          <path d="M 70 34 L 70 56" stroke="#34A853" />
                        </g>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                        Upload & Customization
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-normal">
                        Upload your business logo, custom QR code, or vector artwork for customized storefront hardware fabrication
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomizationModalOpen(false)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 -mr-1"
                    aria-label="Close popup"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body: Pure white page */}
                <div className="p-5 sm:p-6 bg-white overflow-y-auto max-h-[75vh]">
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    multiple
                    className="hidden"
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleFileUpload}
                  />

                  {/* 3 Upload Slots placed side-by-side in the middle */}
                  <div 
                    className="grid grid-cols-3 gap-3 sm:gap-4 my-2"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFiles(e.dataTransfer.files);
                      }
                    }}
                  >
                    {[0, 1, 2].map((slotIdx) => {
                      const file = modalFiles[slotIdx];
                      const isNextUploadSlot = slotIdx === modalFiles.length && modalFiles.length < 3;

                      if (file) {
                        return (
                          <div
                            key={file.id}
                            className="relative aspect-square rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-2 overflow-hidden shadow-2xs group"
                          >
                            {file.type === 'image' ? (
                              <img
                                src={file.previewUrl}
                                alt={file.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                                <FileText size={28} className="text-red-500 mb-1" />
                                <span className="text-[10px] font-bold text-red-600 tracking-wider">PDF</span>
                                <span className="text-[11px] font-medium text-gray-800 line-clamp-1 truncate w-full px-0.5 mt-0.5">
                                  {file.name}
                                </span>
                                <span className="text-[9px] text-gray-400 mt-0.5">{file.size}</span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeFile(slotIdx);
                              }}
                              className="absolute top-1.5 right-1.5 w-6 h-6 bg-gray-900/85 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer"
                              title="Remove file"
                              aria-label="Remove file"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      }

                      if (isNextUploadSlot) {
                        return (
                          <button
                            key={`slot-${slotIdx}`}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                handleFiles(e.dataTransfer.files);
                              }
                            }}
                            className="aspect-square rounded-xl border-2 border-dashed border-[#C85A32]/50 hover:border-[#C85A32] bg-[#FAF0E6]/50 hover:bg-[#FAF0E6] flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group"
                          >
                            <Upload size={24} className="text-[#C85A32] group-hover:scale-110 transition-transform mb-1.5" />
                            <span className="text-xs font-bold text-[#8C3F1E] leading-tight">Upload</span>
                            <span className="text-[10px] text-gray-500 mt-0.5">PDF or JPG</span>
                          </button>
                        );
                      }

                      return (
                        <div
                          key={`slot-${slotIdx}`}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center p-2 text-center text-gray-300"
                        >
                          <Upload size={20} className="text-gray-300 mb-1" />
                          <span className="text-[11px] font-medium text-gray-400">Slot {slotIdx + 1}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-gray-400 text-center mb-4">
                    Maximum 3 files side by side • Minimum 1 file required
                  </p>

                  {/* Bullet Points Instructions */}
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-4">
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-[#C85A32] font-bold">•</span>
                        <span>Upload your business logo, custom QR code, or vector artwork in PDF or JPG format.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#C85A32] font-bold">•</span>
                        <span>Minimum 1 file required to proceed with personalized stand fabrication.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#C85A32] font-bold">•</span>
                        <span>Our design specialists will optimize your artwork for ultra-durable UV printing.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#C85A32] font-bold">•</span>
                        <span>We will contact you on WhatsApp to confirm your design preview before printing.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Privacy Policy & Terms and Conditions Checkbox */}
                  <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer select-none mb-5">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#C85A32] focus:ring-[#C85A32] cursor-pointer"
                    />
                    <span className="leading-snug">
                      I agree to the{' '}
                      <a
                        href="#/terms-and-conditions"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1A73E8] hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms &amp; Conditions
                      </a>{' '}
                      and{' '}
                      <a
                        href="#/privacy-policy"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1A73E8] hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>{' '}
                      for customized hardware fabrication and UV printing.
                    </span>
                  </label>

                  {/* Bottom Right Confirm Button */}
                  <div className="flex justify-end pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={modalFiles.length < 1 || !termsAccepted}
                      onClick={handleConfirmCustomization}
                      className="bg-[#C85A32] hover:bg-[#A04724] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold px-6 h-10 rounded-xl text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
                    >
                      Confirm Customization
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Studio Style White Theme Square Corner Toast for Customization Success */}
          {customizationToast && (
            <div 
              id="ai-studio-customization-notice-toast"
              className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[350] bg-white text-gray-900 border border-gray-200 shadow-none px-3.5 py-2.5 rounded-none flex items-center gap-2.5 w-[90vw] max-w-sm animate-in slide-in-from-top-3 fade-in duration-200 select-none"
            >
              <CheckCircle2 size={18} className="text-[#34A853] shrink-0 self-center" strokeWidth={2.2} />

              <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 leading-snug">
                {customizationToast}
              </span>

              <button
                type="button"
                onClick={() => setCustomizationToast(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-none hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-1"
                aria-label="Dismiss notice"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          {/* AI Studio Style White Theme Square Corner Toast for Payment Notice */}
          {paymentError && (
            <div 
              id="ai-studio-payment-notice-toast"
              className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[250] bg-white text-gray-900 border border-gray-200 shadow-none px-3.5 py-2.5 rounded-none flex items-center gap-2.5 w-[90vw] max-w-sm animate-in slide-in-from-top-3 fade-in duration-200 select-none"
            >
              <AlertCircle size={18} className="text-[#D93025] shrink-0 self-center" strokeWidth={2.2} />

              <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 leading-snug">
                {paymentError}
              </span>

              <button
                type="button"
                onClick={() => setPaymentError(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-none hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-1"
                aria-label="Dismiss notice"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default Checkout;
