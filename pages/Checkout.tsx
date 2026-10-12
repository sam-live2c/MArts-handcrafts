import React, { useState, useEffect, useRef } from 'react';
import { CartItem, User, Order } from '../types';
import { Lock, ArrowLeft, Check, ChevronDown, ChevronUp, Star, CreditCard, Banknote, Calendar, Building, Gift, HelpCircle, ArrowDown, Plus, Minus, ShieldCheck, CheckCircle2, AlertCircle, Smartphone, X, Upload, FileText, Copy, Truck, Package, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  saveRazorpayPaymentToFirestore,
  fetchUserAddresses,
  AddressItem,
  uploadCustomizationMedia,
  saveCustomerDeliveryAddress,
  StoreDeliveryAddress,
  checkDailyOrderLimit,
  checkUserBlockedStatus
} from '../services/dbService';
import { openRazorpayCheckout } from '../utils/razorpay';
import { normalizeIndianPhone, isValidIndianPhone } from '../utils/phone';
import { FullScreenCircleLoader } from '../components/CircleLoader';
import { validateOrderRateLimit } from '../utils/authSecurity';
import { safeStorage, sanitizeCustomizationsForCache } from '../utils/storage';

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
  onOrderSuccess: (order: Order) => Promise<void> | void;
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
  const [step, setStep] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOrderPlacedLoading, setIsOrderPlacedLoading] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'razorpay' | 'cod'>('razorpay');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [customizationToast, setCustomizationToast] = useState<string | null>(null);
  const [ordersTodayCount, setOrdersTodayCount] = useState<number>(0);

  // Check today's order count on mount / user change
  useEffect(() => {
    const fetchTodayQuota = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const check = await checkDailyOrderLimit(currentUser.uid, user?.email || currentUser.email || undefined);
        setOrdersTodayCount(check.countToday);
      }
    };
    fetchTodayQuota();
  }, [user]);

  const isUserBlocked = Boolean(user?.isBlocked || user?.blocked || user?.status === 'blocked' || user?.disabled || user?.isActive === false || user?.role === 'blocked');
  const [dbBlocked, setDbBlocked] = useState<boolean>(isUserBlocked);
  const [blockReason, setBlockReason] = useState<string>(user?.blockReason || '');

  useEffect(() => {
    const uid = auth.currentUser?.uid || user?.uid;
    const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
    const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null;

    // 1. Initial live check
    checkUserBlockedStatus(uid, cleanEmail).then((res) => {
      if (res.isBlocked) {
        setDbBlocked(true);
        const reason = res.reason || 'Your account has been blocked by the admin. You cannot place orders.';
        setBlockReason(reason);
        setPaymentError(reason);
        window.dispatchEvent(new CustomEvent('marts_show_toast', {
          detail: { message: reason, type: 'blocked' }
        }));
      } else {
        setDbBlocked(isUserBlocked);
      }
    }).catch(() => {});

    // 2. Real-time snapshot listener on Firestore user document
    const unsubs: (() => void)[] = [];
    const handleSnap = (snap: any) => {
      if (snap.exists()) {
        const d = snap.data();
        const blocked = Boolean(
          d.isBlocked === true || 
          d.blocked === true || 
          d.status === 'blocked' || 
          d.disabled === true || 
          d.isActive === false ||
          d.role === 'blocked' ||
          d.userStatus === 'blocked'
        );
        if (blocked) {
          setDbBlocked(true);
          const reason = d.blockReason || d.reason || 'Your account has been blocked by the admin. You cannot place orders.';
          setBlockReason(reason);
          setPaymentError(reason);
          window.dispatchEvent(new CustomEvent('marts_show_toast', {
            detail: { message: reason, type: 'blocked' }
          }));
        } else {
          setDbBlocked(false);
        }
      }
    };

    if (uid && uid !== 'guest') {
      try { unsubs.push(onSnapshot(doc(db, 'users', uid), handleSnap, () => {})); } catch (_) {}
    }
    if (emailDocId && emailDocId !== uid) {
      try { unsubs.push(onSnapshot(doc(db, 'users', emailDocId), handleSnap, () => {})); } catch (_) {}
    }

    return () => {
      unsubs.forEach(u => {
        try { u(); } catch (_) {}
      });
    };
  }, [user?.email, user?.uid, isUserBlocked]);

  useEffect(() => {
    if (paymentError) {
      const timer = setTimeout(() => {
        setPaymentError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentError]);

  // Customization state
  const [customizations, setCustomizations] = useState<Record<string, ItemCustomization>>(() => {
    try {
      const saved = safeStorage.getItem('marts_customizations_cache');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    safeStorage.setItem('marts_customizations_cache', JSON.stringify(sanitizeCustomizationsForCache(customizations)));
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
    const userDelivery = user?.deliveryAddress || user?.shippingAddress;
    if (userDelivery) {
      return {
        name: userDelivery.recipientName || user?.name || user?.displayName || '',
        phone: userDelivery.phone || user?.phone || user?.phoneNumber || '',
        houseNo: userDelivery.street || user?.address || '',
        area: [userDelivery.apartment, userDelivery.landmark].filter(Boolean).join(', ') || '',
        city: userDelivery.city || '',
        state: userDelivery.state || '',
        pincode: userDelivery.postalCode || userDelivery.pin || '',
        type: 'HOME'
      };
    }
    return {
      name: user?.name || user?.displayName || '',
      phone: user?.phone || user?.phoneNumber || '',
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
        addresses = await fetchUserAddresses(currentUser.uid, user?.email || currentUser.email || undefined);
      }

      if (addresses.length > 0) {
        const active = addresses.find(a => a.isDefault) || addresses[0];
        setActiveAddress({
          name: active.name,
          phone: active.phone,
          houseNo: active.houseNo,
          area: active.area || '',
          city: active.city || '',
          state: active.state || '',
          pincode: active.pincode || '',
          type: active.type || 'HOME'
        });
      } else if (user?.deliveryAddress || user?.shippingAddress) {
        const dAddr = user.deliveryAddress || user.shippingAddress;
        if (dAddr) {
          setActiveAddress(prev => ({
            ...prev,
            name: dAddr.recipientName || prev.name,
            phone: dAddr.phone || prev.phone,
            houseNo: dAddr.street || prev.houseNo,
            area: [dAddr.apartment, dAddr.landmark].filter(Boolean).join(', ') || prev.area,
            city: dAddr.city || prev.city,
            state: dAddr.state || prev.state,
            pincode: dAddr.postalCode || dAddr.pin || prev.pincode
          }));
        }
      } else if (user?.address) {
        setActiveAddress(prev => ({
          ...prev,
          name: user.name || user.displayName || prev.name,
          phone: user.phone || user.phoneNumber || prev.phone,
          houseNo: user.address
        }));
      }
    };
    loadAddress();
  }, [user]);

  const baseTotal = (cart || []).reduce((sum, item) => sum + ((Number(item?.price) || 0) * (Number(item?.quantity) || 1)), 0);
  const customizedCount = (Object.values(customizations || {}) as ItemCustomization[]).filter(c => c && c.confirmed && Array.isArray(c.files) && c.files.length > 0).length;
  const customizationFee = customizedCount > 0 ? customizedCount * 5 : 0;
  const total = baseTotal + customizationFee;
  const originalTotal = (cart || []).reduce((sum, item) => sum + (((item?.oldPrice && Number(item.oldPrice) > Number(item.price)) ? Number(item.oldPrice) : Number(item?.price || 0)) * (Number(item?.quantity) || 1)), 0);
  const savings = Math.max(0, originalTotal - baseTotal);

  useEffect(() => {
    if (!user && !auth.currentUser) {
      const timer = setTimeout(() => {
        if (!user && !auth.currentUser) {
          navigate('/login?redirect=checkout');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    const savedAddr = safeStorage.getItem('marts_user_address') || user?.address || user?.deliveryAddress?.street;
    if ((!savedAddr || savedAddr.trim() === '') && (!activeAddress.houseNo || activeAddress.houseNo.trim() === '')) {
      setStep(1);
    }
  }, [user, activeAddress.houseNo, navigate]);

  useEffect(() => {
    // scroll to top on step change
    window.scrollTo(0, 0);
  }, [step]);

  const handlePlaceOrder = async () => {
    setPaymentError(null);
    setIsProcessing(true);
    const currentUser = auth.currentUser;
    const uid = currentUser ? currentUser.uid : 'guest';

    // Strict Admin Account Block Check: Show toast and reject
    if (isUserBlocked || dbBlocked) {
      const blockedMsg = blockReason || user?.blockReason || 'Your account has been blocked by the admin. You cannot place orders.';
      setPaymentError(blockedMsg);
      window.dispatchEvent(new CustomEvent('marts_show_toast', {
        detail: { message: blockedMsg, type: 'blocked' }
      }));
      setIsProcessing(false);
      return;
    }

    const liveBlockCheck = await checkUserBlockedStatus(uid, user?.email || undefined);
    if (liveBlockCheck.isBlocked) {
      setDbBlocked(true);
      if (liveBlockCheck.reason) setBlockReason(liveBlockCheck.reason);
      const blockedMsg = liveBlockCheck.reason || 'Your account has been blocked by the admin. You cannot place orders.';
      setPaymentError(blockedMsg);
      window.dispatchEvent(new CustomEvent('marts_show_toast', {
        detail: { message: blockedMsg, type: 'blocked' }
      }));
      setIsProcessing(false);
      return;
    }

    // Production delivery address validation with robust Indian phone normalization
    const customerName = (activeAddress.name || user?.name || user?.displayName || '').trim();
    const customerPhone = normalizeIndianPhone(activeAddress.phone || user?.phone || user?.phoneNumber || '');
    const customerHouse = (activeAddress.houseNo || user?.address || user?.deliveryAddress?.street || '').trim();
    let customerPincode = (activeAddress.pincode || user?.deliveryAddress?.postalCode || user?.deliveryAddress?.pin || '').replace(/\D/g, '');

    // Auto-extract pincode if contained in full address string
    if (!customerPincode && customerHouse) {
      const pinMatch = customerHouse.match(/\b\d{6}\b/);
      if (pinMatch) customerPincode = pinMatch[0];
    }

    if (!customerName || customerName.length < 2) {
      setPaymentError('Please enter recipient name in your delivery address.');
      setIsProcessing(false);
      return;
    }

    if (!customerPhone || customerPhone.length !== 10) {
      setPaymentError('Please enter a valid 10-digit mobile phone number for delivery.');
      setIsProcessing(false);
      return;
    }

    if (!customerHouse || customerHouse.length < 3) {
      setPaymentError('Please enter complete street or building delivery address.');
      setIsProcessing(false);
      return;
    }

    if (!customerPincode || customerPincode.length !== 6) {
      setPaymentError('Please enter a valid 6-digit delivery PIN code.');
      setIsProcessing(false);
      return;
    }

    // Synchronize shipping address to user profile & Firestore schema
    const storeDeliveryAddr: StoreDeliveryAddress = {
      recipientName: customerName,
      phone: customerPhone,
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

    if (currentUser) {
      saveCustomerDeliveryAddress(currentUser.uid, storeDeliveryAddr, user?.email || currentUser.email || undefined).catch(e => {
        console.warn('Checkout address sync notice:', e);
      });
    }

    const customerDeliveryAddr = [
      activeAddress.houseNo,
      activeAddress.area,
      activeAddress.city,
      activeAddress.state,
      activeAddress.pincode
    ].filter(Boolean).join(', ');

    const totalItemsCount = (cart || []).reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
    const pricingBreakdown = {
      mrp: originalTotal,
      subtotal: baseTotal,
      discount: Math.max(0, originalTotal - baseTotal),
      savings: Math.max(0, originalTotal - baseTotal),
      customizationFee: customizationFee,
      deliveryFee: 0,
      total: total
    };


    // Strict Daily Order Limit Verification: Maximum 3 orders per day
    const dailyLimitCheck = await checkDailyOrderLimit(uid, user?.email || undefined);
    if (!dailyLimitCheck.allowed) {
      setPaymentError(dailyLimitCheck.error || 'Daily order limit reached. You can only place up to 3 orders in a day.');
      setIsProcessing(false);
      return;
    }

    // Server-side daily order verification & payload sanity check
    const rateCheck = await validateOrderRateLimit({
      userId: uid,
      customerEmail: user?.email || undefined,
      customerPhone,
      customerName,
      items: cart,
      total
    });

    if (!rateCheck.allowed) {
      setPaymentError(rateCheck.error || 'Daily order limit reached. Maximum 3 orders allowed per day.');
      setIsProcessing(false);
      return;
    }

    if (paymentOption === 'razorpay') {
      try {
        const orderId = 'OD' + Date.now() + Math.floor(100 + Math.random() * 900);

        // Open genuine Razorpay Checkout Modal
        const razorpayRes = await openRazorpayCheckout({
          amount: total,
          orderId: orderId,
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: user?.email || 'customer@marts.crafts',
          description: `Order #${orderId} - MArts Handcrafted Pottery & Statues`
        });

        const paymentId = razorpayRes.razorpay_payment_id;

        // Save real payment transaction record in Firestore
        saveRazorpayPaymentToFirestore({
          paymentId: paymentId,
          orderId: orderId,
          userId: uid,
          amount: total,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'Online Payment (UPI/Cards)',
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: user?.email || '',
          createdAt: Date.now()
        }).catch(e => console.warn('Payment audit log notice:', e));

        const newOrder: Order = {
          id: orderId,
          userId: uid,
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: (cart || []).map(item => ({
            ...item,
            customization: customizations[item.id] ? {
              confirmed: customizations[item.id].confirmed,
              files: (customizations[item.id].files || []).map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                previewUrl: f.storageUrl || f.previewUrl || ''
              }))
            } : null
          })),
          total: total,
          mrp: originalTotal,
          subtotal: baseTotal,
          discount: pricingBreakdown.discount,
          savings: pricingBreakdown.savings,
          customizationFee: customizationFee,
          deliveryFee: 0,
          itemCount: totalItemsCount,
          pricing: pricingBreakdown,
          status: 'Processing',
          paymentId: paymentId,
          paymentMethod: 'Online Payment (UPI/Cards)',
          paymentStatus: 'PAID',
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: user?.email || '',
          customerAddress: customerDeliveryAddr,
          shippingAddress: storeDeliveryAddr,
          tracking: {
            currentStatus: 'Processing',
            updatedAt: Date.now(),
            steps: [
              { status: 'Placed', label: 'Order Placed & Authorized', completed: true, timestamp: Date.now() },
              { status: 'Processing', label: 'Artisan Packaging & Quality Inspection', completed: true, timestamp: Date.now() },
              { status: 'Shipped', label: 'Dispatched in Insured Timber Crate', completed: false, timestamp: null },
              { status: 'Delivered', label: 'Delivered to Doorstep', completed: false, timestamp: null }
            ]
          },
          statusHistory: [
            {
              status: 'Processing',
              timestamp: Date.now(),
              label: 'Payment Verified & In Fulfillment',
              note: `Payment reference #${paymentId} confirmed and settled via Razorpay.`
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        setIsOrderPlacedLoading(true);
        setIsProcessing(false);
        try {
          await onOrderSuccess(newOrder);
        } catch (e) {
          console.warn('Order success handler warning:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 1400));
        clearCart();
        navigate('/orders', { replace: true });
      } catch (err: unknown) {
        setIsOrderPlacedLoading(false);
        setIsProcessing(false);
        if (err instanceof Error && err.message === 'PAYMENT_CANCELLED') {
          setPaymentError('Payment window was closed or cancelled. You can retry or choose Cash on Delivery.');
        } else {
          setPaymentError(err instanceof Error ? err.message : 'Payment could not be completed.');
          console.error('Razorpay Error:', err);
        }
      }
    } else {
      // Production Cash on Delivery (COD) Authorization (no simulation)
      try {
        const orderId = 'OD' + Date.now() + Math.floor(100 + Math.random() * 900);

        const newOrder: Order = {
          id: orderId,
          userId: uid,
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: (cart || []).map(item => ({
            ...item,
            customization: customizations[item.id] ? {
              confirmed: customizations[item.id].confirmed,
              files: (customizations[item.id].files || []).map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                previewUrl: f.storageUrl || f.previewUrl || ''
              }))
            } : null
          })),
          total: total,
          mrp: originalTotal,
          subtotal: baseTotal,
          discount: pricingBreakdown.discount,
          savings: pricingBreakdown.savings,
          customizationFee: customizationFee,
          deliveryFee: 0,
          itemCount: totalItemsCount,
          pricing: pricingBreakdown,
          status: 'Processing',
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'PENDING',
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: user?.email || '',
          customerAddress: customerDeliveryAddr,
          shippingAddress: storeDeliveryAddr,
          tracking: {
            currentStatus: 'Processing',
            updatedAt: Date.now(),
            steps: [
              { status: 'Placed', label: 'Order Placed & Authorized', completed: true, timestamp: Date.now() },
              { status: 'Processing', label: 'Artisan Packaging & Quality Inspection', completed: true, timestamp: Date.now() },
              { status: 'Shipped', label: 'Dispatched in Insured Timber Crate', completed: false, timestamp: null },
              { status: 'Delivered', label: 'Delivered to Doorstep', completed: false, timestamp: null }
            ]
          },
          statusHistory: [
            {
              status: 'Processing',
              timestamp: Date.now(),
              label: 'Cash on Delivery Placed',
              note: `Pay ₹${total.toLocaleString()} on doorstep arrival.`
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        setIsOrderPlacedLoading(true);
        setIsProcessing(false);
        try {
          await onOrderSuccess(newOrder);
        } catch (e) {
          console.warn('Order success handler warning:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 1400));
        clearCart();
        navigate('/orders', { replace: true });
      } catch (err: unknown) {
        setIsOrderPlacedLoading(false);
        setIsProcessing(false);
        setPaymentError(err instanceof Error ? err.message : 'Could not authorize Cash on Delivery order.');
        console.error('COD Order Error:', err);
      }
    }
  };

  useEffect(() => {
    if (cart.length === 0 && !isProcessing) {
      const timer = setTimeout(() => {
        if (cart.length === 0 && !isProcessing) {
          navigate('/cart', { replace: true });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cart.length, navigate, isProcessing]);

  if (cart.length === 0) {
    return (
      <div className="w-full bg-[#FAF8F5] min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none">
        <Package size={52} className="text-[#C85A32]/40 mb-3" />
        <h2 className="text-lg font-bold text-[#2B221B]">Your Cart is Empty</h2>
        <p className="text-xs text-[#735A4C] mt-1 max-w-sm mx-auto mb-5 leading-relaxed">
          Looks like there are no artisan terracotta or bronze sculptures in your cart. Discover our collection to place an order.
        </p>
        <button 
          type="button"
          onClick={() => navigate('/products')}
          className="h-11 px-7 bg-[#C85A32] hover:bg-[#A04724] active:bg-[#8C3F1E] text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
        >
          <span>Explore Collections</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      {isOrderPlacedLoading && (
        <FullScreenCircleLoader overlay={true} bgClassName="bg-[#FAF8F5]/90 backdrop-blur-xs" />
      )}
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
                         <p className="text-xs text-gray-500 mt-0.5">Includes free delivery</p>
                       </div>
                       <span className="text-2xl font-extrabold text-[#C85A32]">₹{total.toLocaleString()}</span>
                    </div>

                    {/* Blocked Account Alert Banner */}
                    {(isUserBlocked || dbBlocked) && (
                      <div className="my-3 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 animate-in fade-in">
                        <ShieldAlert size={22} className="text-red-600 shrink-0" />
                        <div className="text-xs flex-1">
                          <p className="font-bold text-red-900 text-sm">Account Blocked by Administrator</p>
                          <p className="text-red-700 mt-0.5">{blockReason || user?.blockReason || 'Your account has been blocked from placing orders. Please contact customer support.'}</p>
                        </div>
                      </div>
                    )}

                    {/* Payment Options Section - flush, clean dividers */}
                    <div className="py-3 border-b border-gray-100 space-y-4">
                       <label 
                         onClick={() => setPaymentOption('razorpay')}
                         className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
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
                         className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
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
                             disabled={isProcessing || isUserBlocked || dbBlocked} 
                             className={`${
                               isUserBlocked || dbBlocked
                                 ? 'bg-gray-400 cursor-not-allowed opacity-80'
                                 : 'bg-[#C85A32] hover:bg-[#A04724] cursor-pointer'
                             } text-white font-bold px-8 h-12 rounded-xl text-[16px] w-[260px] shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-75`}
                           >
                              {isUserBlocked || dbBlocked ? (
                                <span className="flex items-center gap-2">
                                  <ShieldAlert size={16} />
                                  <span>Account Blocked</span>
                                </span>
                              ) : isProcessing ? (
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
                     disabled={isProcessing || isUserBlocked || dbBlocked} 
                     className={`${
                       isUserBlocked || dbBlocked
                         ? 'bg-gray-400 cursor-not-allowed opacity-80'
                         : 'bg-[#C85A32] hover:bg-[#A04724] cursor-pointer'
                     } text-white font-bold px-4 h-11 rounded-xl text-[14px] w-[180px] shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-75`}
                   >
                      {isUserBlocked || dbBlocked ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold">
                          <ShieldAlert size={15} />
                          <span>Account Blocked</span>
                        </span>
                      ) : isProcessing ? (
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
