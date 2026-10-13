import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { 
  ArrowLeft, Search, MoreVertical, X, Package, 
  AlertCircle, Headphones, CheckCircle2, Download, HelpCircle, Check,
  ChevronRight, Truck, XCircle, MessageCircle, Phone
} from 'lucide-react';
import { User, Order, CartItem } from '../types';
import Header from '../components/Header';
import { auth, db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { fetchUserOrders, getAssociatedUserIdsForEmail } from '../services/dbService';
import { safeStorage } from '../utils/storage';
import { OrderHistorySkeleton } from '../components/Skeleton';

interface MyOrdersProps {
  user: User | null;
  onUpdateOrders: (orders: Order[]) => void;
  cartCount?: number;
  wishlistCount?: number;
}

const MyOrders: React.FC<MyOrdersProps> = ({ user, onUpdateOrders, cartCount, wishlistCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  // Helper to safely sort orders without crashing on numeric IDs or undefined dates
  const sortOrdersSafe = (list: Order[]): Order[] => {
    if (!Array.isArray(list)) return [];
    return [...list].filter(Boolean).sort((a, b) => {
      const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
      const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
  };

  // Helper to safely retrieve already existing orders immediately for instant rendering without skeleton splash
  const getInitialOrders = (): Order[] => {
    const ordersMap = new Map<string, Order>();
    if (Array.isArray(user?.orders) && user.orders.length > 0) {
      user.orders.forEach(o => { if (o && o.id) ordersMap.set(o.id, o); });
    }
    try {
      const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
      const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : '';
      const uid = auth.currentUser?.uid || user?.id || (user as any)?.uid || emailDocId;

      const keys = ['marts_orders'];
      if (uid) keys.push(`marts_orders_${uid}`);
      if (cleanEmail) keys.push(`marts_orders_${cleanEmail}`);
      if (emailDocId && emailDocId !== uid) keys.push(`marts_orders_${emailDocId}`);

      keys.forEach(k => {
        try {
          const raw = safeStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((o: Order) => {
                if (o && o.id && !ordersMap.has(o.id)) {
                  ordersMap.set(o.id, o);
                }
              });
            }
          }
        } catch (_) {}
      });
    } catch (_) {}
    return sortOrdersSafe(Array.from(ordersMap.values()));
  };

  const initialOrders = getInitialOrders();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  // Only show loading skeleton if we genuinely have no existing order list to display
  const [isLoading, setIsLoading] = useState<boolean>(() => initialOrders.length === 0);

  const [toast, setToast] = useState<{
    type: 'success' | 'failed' | 'info';
    title: string;
    message?: string;
  } | null>(null);

  // Sync when user prop updates
  useEffect(() => {
    if (Array.isArray(user?.orders) && user.orders.length > 0) {
      setOrders(prev => {
        const map = new Map<string, Order>();
        (prev || []).forEach(o => { if (o && o.id) map.set(String(o.id), o); });
        user.orders.forEach(o => { if (o && o.id) map.set(String(o.id), o); });
        return sortOrdersSafe(Array.from(map.values()));
      });
      setIsLoading(false);
    }
  }, [user?.orders]);

  // Live real-time subscription for orders (listening to both user subcollection & global orders collection for instant admin sync)
  useEffect(() => {
    let unsubUserOrders: (() => void) | null = null;
    let unsubGlobalOrders: (() => void) | null = null;
    let unsubEmailOrders: (() => void) | null = null;
    let unsubCanonicalOrders: (() => void) | null = null;

    // Safety timeout to prevent infinite skeleton if offline or network stalled
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    const setupListeners = (uid: string) => {
      // Single unified master orders map that accumulates and never deletes existing orders
      const masterOrdersMap = new Map<string, Order>();
      initialOrders.forEach(o => { if (o && o.id) masterOrdersMap.set(String(o.id), o); });
      if (Array.isArray(user?.orders)) {
        user.orders.forEach(o => { if (o && o.id) masterOrdersMap.set(String(o.id), o); });
      }

      const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();

      const syncAndDispatchOrders = () => {
        const liveOrders = sortOrdersSafe(Array.from(masterOrdersMap.values()));
        setOrders(liveOrders);
        safeStorage.setItem(`marts_orders_${uid}`, JSON.stringify(liveOrders));
        if (cleanEmail) {
          safeStorage.setItem(`marts_orders_${cleanEmail}`, JSON.stringify(liveOrders));
        }
        safeStorage.setItem('marts_orders', JSON.stringify(liveOrders));
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      };

      // Initial direct fetch from Firestore
      fetchUserOrders(uid, cleanEmail).then(fetched => {
        if (Array.isArray(fetched) && fetched.length > 0) {
          fetched.forEach(o => {
            if (o && o.id) {
              const existing = masterOrdersMap.get(String(o.id));
              if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
                masterOrdersMap.set(String(o.id), { ...existing, ...o });
              }
            }
          });
          syncAndDispatchOrders();
        }
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      }).catch((e) => {
        console.warn('Initial orders fetch notice:', e);
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      });

      // 1. Listen to real-time live updates from user's orders subcollection
      const userOrdersRef = collection(db, 'users', uid, 'orders');
      unsubUserOrders = onSnapshot(userOrdersRef, (snapshot) => {
        snapshot.forEach(docSnap => {
          const ord = docSnap.data() as Order;
          if (ord && ord.id) {
            const existing = masterOrdersMap.get(String(ord.id));
            if (!existing || (ord.updatedAt || 0) >= (existing.updatedAt || 0)) {
              masterOrdersMap.set(String(ord.id), { ...existing, ...ord });
            }
          }
        });
        syncAndDispatchOrders();
      }, (err) => {
        console.warn('User orders subcollection sync notice:', err);
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      });

      // 2. Listen to real-time live updates from top-level global orders collection by userId
      try {
        const globalOrdersQuery = query(collection(db, 'orders'), where('userId', '==', uid));
        unsubGlobalOrders = onSnapshot(globalOrdersQuery, (snapshot) => {
          snapshot.forEach(docSnap => {
            const ord = docSnap.data() as Order;
            if (ord && ord.id) {
              const existing = masterOrdersMap.get(String(ord.id));
              if (!existing || (ord.updatedAt || 0) >= (existing.updatedAt || 0)) {
                masterOrdersMap.set(String(ord.id), { ...existing, ...ord });
              }
            }
          });
          syncAndDispatchOrders();
        }, (err) => {
          console.warn('Global orders collection sync notice:', err);
          clearTimeout(fallbackTimer);
          setIsLoading(false);
        });
      } catch (err) {
        console.warn('Global orders query listener setup notice:', err);
      }

      // 3. Listen to real-time live updates from global orders collection by customerEmail
      if (cleanEmail) {
        try {
          const emailOrdersQuery = query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail));
          unsubEmailOrders = onSnapshot(emailOrdersQuery, (snapshot) => {
            snapshot.forEach(docSnap => {
              const ord = docSnap.data() as Order;
              if (ord && ord.id) {
                const existing = masterOrdersMap.get(String(ord.id));
                if (!existing || (ord.updatedAt || 0) >= (existing.updatedAt || 0)) {
                  masterOrdersMap.set(String(ord.id), { ...existing, ...ord });
                }
              }
            });
            syncAndDispatchOrders();
          }, (err) => {
            console.warn('Email orders query listener notice:', err);
          });
        } catch (err) {
          console.warn('Email orders query setup notice:', err);
        }

        // Also listen to canonical email document orders subcollection
        const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
        if (emailDocId !== uid) {
          try {
            const canonicalOrdersRef = collection(db, 'users', emailDocId, 'orders');
            unsubCanonicalOrders = onSnapshot(canonicalOrdersRef, (snapshot) => {
              snapshot.forEach(docSnap => {
                const ord = docSnap.data() as Order;
                if (ord && ord.id) {
                  const existing = masterOrdersMap.get(String(ord.id));
                  if (!existing || (ord.updatedAt || 0) >= (existing.updatedAt || 0)) {
                    masterOrdersMap.set(String(ord.id), { ...existing, ...ord });
                  }
                }
              });
              syncAndDispatchOrders();
            }, (err) => {
              console.warn('Canonical orders subcollection listener notice:', err);
            });
          } catch (err) {
            console.warn('Canonical orders setup notice:', err);
          }
        }

        // Also listen to all candidate user documents and subcollections for this email
        getAssociatedUserIdsForEmail(cleanEmail, uid).then(associatedUids => {
          for (const candId of associatedUids) {
            if (candId !== uid && candId !== emailDocId) {
              try {
                const candOrdersRef = collection(db, 'users', candId, 'orders');
                const unsub = onSnapshot(candOrdersRef, (snapshot) => {
                  snapshot.forEach(docSnap => {
                    const ord = docSnap.data() as Order;
                    if (ord && ord.id) {
                      const existing = masterOrdersMap.get(String(ord.id));
                      if (!existing || (ord.updatedAt || 0) >= (existing.updatedAt || 0)) {
                        masterOrdersMap.set(String(ord.id), { ...existing, ...ord });
                      }
                    }
                  });
                  syncAndDispatchOrders();
                }, () => {});
                activeCandidateUnsubs.push(unsub);
              } catch (_) {}
            }
          }
        }).catch(() => {});
      }
    };

    let activeCandidateUnsubs: (() => void)[] = [];

    const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
    const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : '';
    const effectiveUid = auth.currentUser?.uid 
      || (user as any)?.uid 
      || user?.id
      || emailDocId
      || user?.phone 
      || null;

    if (effectiveUid) {
      setupListeners(effectiveUid);
    } else {
      clearTimeout(fallbackTimer);
      setIsLoading(false);
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (unsubUserOrders) {
        unsubUserOrders();
        unsubUserOrders = null;
      }
      if (unsubGlobalOrders) {
        unsubGlobalOrders();
        unsubGlobalOrders = null;
      }
      if (unsubEmailOrders) {
        unsubEmailOrders();
        unsubEmailOrders = null;
      }
      if (unsubCanonicalOrders) {
        unsubCanonicalOrders();
        unsubCanonicalOrders = null;
      }
      activeCandidateUnsubs.forEach(u => u());
      activeCandidateUnsubs = [];

      const activeCleanEmail = (user?.email || currentUser?.email || '').trim().toLowerCase();
      const activeEmailDocId = activeCleanEmail ? 'marts_user_' + activeCleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : '';
      const newEffectiveUid = currentUser?.uid 
        || (user as any)?.uid 
        || user?.id
        || activeEmailDocId
        || user?.phone 
        || null;

      if (newEffectiveUid) {
        setupListeners(newEffectiveUid);
      } else {
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      if (unsubUserOrders) unsubUserOrders();
      if (unsubGlobalOrders) unsubGlobalOrders();
      if (unsubEmailOrders) unsubEmailOrders();
      if (unsubCanonicalOrders) unsubCanonicalOrders();
      activeCandidateUnsubs.forEach(u => u());
      activeCandidateUnsubs = [];
      unsubscribeAuth();
    };
  }, [user?.email, (user as any)?.uid]);

  const processedStateRef = React.useRef<string | null>(null);

  useEffect(() => {
    const state = location.state as {
      paymentStatus?: 'success' | 'failed';
      orderId?: string;
      paymentId?: string;
      paymentMethod?: string;
      message?: string;
      error?: string;
    } | null;

    if (!state?.paymentStatus) return;

    const stateKey = `${state.paymentStatus}_${state.orderId || ''}_${state.paymentId || ''}`;
    if (processedStateRef.current === stateKey) return;
    processedStateRef.current = stateKey;

    if (state.paymentStatus === 'success') {
      setToast({
        type: 'success',
        title: 'Order Placed Successfully',
        message: state.orderId ? `Order #${state.orderId} registered in fulfillment pipeline` : (state.message || 'Your order has been placed successfully'),
      });
      try {
        window.history.replaceState({}, document.title);
      } catch (_) {}
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    } else if (state.paymentStatus === 'failed') {
      setToast({
        type: 'failed',
        title: 'Payment Failed',
        message: state.error || state.message || 'Your payment could not be processed',
      });
      try {
        window.history.replaceState({}, document.title);
      } catch (_) {}
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const currentOrders: Order[] = React.useMemo(() => {
    return sortOrdersSafe(orders);
  }, [orders]);

  const showToast = (title: string, message?: string, type: 'success' | 'failed' | 'info' = 'success', duration = 4000) => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), duration);
  };



  const handleDownloadReceipt = (order: Order, specificItem?: CartItem) => {
    setActiveMenuOrderId(null);

    const isItemSpecific = !!specificItem;
    const items = isItemSpecific 
      ? [specificItem] 
      : (Array.isArray(order?.items) ? order.items.filter(Boolean) : []);

    const mrp = items.reduce((acc, item) => {
      const unitMrp = item?.oldPrice && Number(item.oldPrice) > Number(item.price) 
        ? Number(item.oldPrice) 
        : Number(item?.price || 0);
      return acc + (unitMrp * (Number(item?.quantity) || 1));
    }, 0);
    const itemsNet = items.reduce((acc, item) => acc + ((Number(item?.price) || 0) * (Number(item?.quantity) || 1)), 0);
    const itemsTotal = isItemSpecific 
      ? ((Number(specificItem?.price) || 0) * (Number(specificItem?.quantity) || 1)) 
      : Number(order?.total || itemsNet);
    const discount = Math.max(0, mrp - itemsNet);

    // Accurately determine payment method, status, transaction ref, and badge styling
    const isCod = Boolean(
      (order.paymentMethod && /cash|cod|pay on delivery/i.test(order.paymentMethod)) ||
      (!order.paymentMethod && !order.paymentId)
    );

    const txnRef = order.paymentId 
      ? order.paymentId 
      : isCod 
        ? `COD-${order.id}` 
        : `TXN-${order.id}`;

    let paymentStatusLabel = 'PAID';
    let paymentBadgeColor = '#15803d'; // Green
    let paymentBadgeBg = '#f0fdf4';
    let paymentDetail = 'Verified & Settled';

    if (order.status === 'Cancelled') {
      paymentStatusLabel = 'CANCELLED (Refund Processing)';
      paymentBadgeColor = '#b91c1c'; // Red
      paymentBadgeBg = '#fef2f2';
      paymentDetail = `Order cancelled by customer. Refund of ₹${itemsTotal.toLocaleString()} credited within 24 hours.`;
    } else if (order.status === 'Failed') {
      paymentStatusLabel = 'PAYMENT FAILED / UNPAID';
      paymentBadgeColor = '#b91c1c';
      paymentBadgeBg = '#fef2f2';
      paymentDetail = 'Transaction was declined by payment gateway or incomplete.';
    } else if (isCod) {
      if (order.status === 'Delivered') {
        paymentStatusLabel = 'PAID (Cash Collected on Delivery)';
        paymentBadgeColor = '#15803d';
        paymentBadgeBg = '#f0fdf4';
        paymentDetail = `Cash of ₹${itemsTotal.toLocaleString()} collected at doorstep upon delivery.`;
      } else {
        paymentStatusLabel = `PAYMENT PENDING (Pay ₹${itemsTotal.toLocaleString()} on Delivery)`;
        paymentBadgeColor = '#b45309'; // Amber
        paymentBadgeBg = '#fffbeb';
        paymentDetail = `Payment of ₹${itemsTotal.toLocaleString()} to be collected via Cash/UPI on package arrival.`;
      }
    } else {
      paymentStatusLabel = `PAID (${order.paymentMethod || 'Online UPI / Card'})`;
      paymentBadgeColor = '#15803d';
      paymentBadgeBg = '#f0fdf4';
      paymentDetail = `Online transaction verified. Reference: ${txnRef}`;
    }

    const customerName = order.customerName || user?.name || user?.displayName || 'Valued Customer';
    const customerPhone = order.customerPhone || user?.phone || user?.phoneNumber || 'N/A';
    const customerEmail = order.customerEmail || user?.email || 'N/A';
    
    let customerAddress = order.customerAddress || '';
    if (!customerAddress && order.shippingAddress) {
      const s = order.shippingAddress;
      customerAddress = [s.street || s.houseNo, s.apartment || s.area, s.landmark, s.city, s.state, s.postalCode || s.pincode || s.pin].filter(Boolean).join(', ');
    }
    if (!customerAddress && user?.address) {
      customerAddress = user.address;
    }
    if (!customerAddress && user?.deliveryAddress) {
      const d = user.deliveryAddress;
      customerAddress = [d.street, d.apartment, d.landmark, d.city, d.state, d.postalCode || d.pin].filter(Boolean).join(', ');
    }
    if (!customerAddress) {
      customerAddress = 'Registered Customer Delivery Address';
    }

    const receiptHeading = isItemSpecific 
      ? `ORDER & PRODUCT RECEIPT`
      : `ORDER & PURCHASE RECEIPT`;

    const formattedDate = order.date;
    const sanitizedItemName = isItemSpecific 
      ? specificItem.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) 
      : '';
    const downloadFileName = isItemSpecific
      ? `Receipt_Order_${order.id}_${sanitizedItemName}.html`
      : `Receipt_Order_${order.id}_Full.html`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MArts Receipt - #${order.id}${isItemSpecific ? ' - ' + specificItem.name : ''}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f7f7f7; color: #1a1a1a; padding: 24px; }
    .invoice-card { max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; box-shadow: 0 4px 18px rgba(0,0,0,0.06); padding: 36px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #C85A32; padding-bottom: 20px; margin-bottom: 24px; }
    .brand-title { font-size: 26px; font-weight: 800; color: #C85A32; letter-spacing: -0.5px; }
    .brand-subtitle { font-size: 13px; color: #666; margin-top: 3px; }
    .invoice-meta { text-align: right; }
    .invoice-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #C85A32; }
    .invoice-num { font-size: 16px; font-weight: 700; color: #111; margin-top: 4px; }
    .invoice-date { font-size: 12px; color: #666; margin-top: 2px; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .info-box { background: #fafafa; border: 1px solid #ebebeb; border-radius: 6px; padding: 14px 16px; }
    .info-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 8px; }
    .info-title { font-size: 14px; font-weight: 700; color: #222; margin-bottom: 4px; }
    .info-text { font-size: 13px; color: #444; line-height: 1.5; }
    
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; color: ${paymentBadgeColor}; background-color: ${paymentBadgeBg}; margin-top: 4px; border: 1px solid ${paymentBadgeColor}33; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #FAF0E6; color: #8C3F1E; text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #EADBCC; }
    td { padding: 14px; font-size: 13px; border-bottom: 1px solid #eee; vertical-align: top; }
    .item-name { font-weight: 600; color: #111; }
    .item-sub { font-size: 11px; color: #777; margin-top: 2px; }
    .text-right { text-align: right; }
    
    .totals-area { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals-table { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #555; }
    .totals-row.bold { border-top: 2px solid #222; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #111; }
    .savings { color: #15803d; font-weight: 600; }
    
    .footer { border-top: 1px dashed #ccc; padding-top: 20px; text-align: center; font-size: 12px; color: #777; line-height: 1.6; }
    .actions-bar { max-width: 780px; margin: 0 auto 16px auto; display: flex; justify-content: flex-end; gap: 10px; }
    .print-btn { background: #C85A32; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .print-btn:hover { background: #A04724; }

    @media print {
      body { background: white; padding: 0; }
      .actions-bar { display: none !important; }
      .invoice-card { box-shadow: none; border: none; padding: 0; width: 100%; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand-title">MArts &amp; Uart</div>
        <div class="brand-subtitle">Handcrafted Pottery &amp; Statues • Founder: Anant Kumbhakar</div>
        <div class="brand-subtitle">Vill. Asanbani, P.O. Chandra, P.S. Siyaljori, Dist. Bokaro, Jharkhand</div>
        <div class="brand-subtitle">📞 +91 70616 71820 • ✉️ martsindia3@gmail.com</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-tag">${receiptHeading}</div>
        <div class="invoice-num">#${order.id}${isItemSpecific ? ' • ' + specificItem.name : ''}</div>
        <div class="invoice-date">Placed: ${formattedDate}</div>
        <div class="invoice-date">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-box">
        <div class="info-label">Customer & Delivery Details</div>
        <div class="info-title">${customerName}</div>
        <div class="info-text">📞 ${customerPhone}</div>
        ${customerEmail && customerEmail !== 'N/A' ? `<div class="info-text">✉️ ${customerEmail}</div>` : ''}
        <div class="info-text" style="margin-top: 6px;">📍 ${customerAddress}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Order & Payment Status</div>
        <div class="info-title">Order Status: ${order.status}</div>
        <div class="info-text">Payment Method: ${order.paymentMethod || (isCod ? 'Cash on Delivery' : 'Online Payment')}</div>
        <div class="info-text">Ref / Transaction: ${txnRef}</div>
        <div>
          <span class="status-badge">${paymentStatusLabel}</span>
        </div>
        <div class="info-text" style="font-size: 11px; margin-top: 4px; color: #666;">${paymentDetail}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Artisan Product Item</th>
          <th class="text-right" style="width: 80px;">Qty</th>
          <th class="text-right" style="width: 110px;">Unit Price</th>
          <th class="text-right" style="width: 120px;">Net Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div class="item-name">${it.name}</div>
            <div class="item-sub">Category: ${it.category || it.subCategory || 'Handcrafted Pottery'} • SKU: ${it.id}</div>
          </td>
          <td class="text-right">${it.quantity}</td>
          <td class="text-right">₹${it.price.toLocaleString()}</td>
          <td class="text-right" style="font-weight: 600;">₹${(it.price * it.quantity).toLocaleString()}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-table">
        <div class="totals-row">
          <span>Items MRP Total</span>
          <span>₹${mrp.toLocaleString()}</span>
        </div>
        ${discount > 0 ? `
        <div class="totals-row">
          <span>Artisan Discount</span>
          <span class="savings">- ₹${discount.toLocaleString()}</span>
        </div>` : ''}
        <div class="totals-row">
          <span>Delivery / Shipping</span>
          <span class="savings">FREE (Insured Crate)</span>
        </div>
        <div class="totals-row bold">
          <span>Total Net Amount</span>
          <span>₹${itemsTotal.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>This is a computer-generated order receipt and delivery summary issued by MArts Handcrafts.</div>
      <div>Thank you for honoring traditional pottery kilns, stone carving ateliers, and heritage craft traditions!</div>
      <div style="margin-top: 6px; font-size: 11px; color: #999;">For replacement or damage claims, please contact martsindia3@gmail.com / +91 70616 71820 within 48 hours of delivery.</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      isItemSpecific ? 'Item Receipt Downloaded' : 'Order Receipt Downloaded',
      isItemSpecific ? `Receipt downloaded for ${specificItem.name}` : `Full receipt downloaded for Order #${order.id}`
    );
  };

  const handleRedirectToSupportWithReceipt = (order: Order, channel: 'whatsapp' | 'call' = 'whatsapp') => {
    // 1. Download official order receipt for customer
    handleDownloadReceipt(order);

    // 2. Prepare prefilled support message with receipt details
    const itemsList = (Array.isArray(order.items) ? order.items.filter(Boolean) : [])
      .map(it => `• ${it.name} (Qty: ${it.quantity || 1}, ₹${((Number(it.price) || 0) * (Number(it.quantity) || 1)).toLocaleString()})`)
      .join('\n');

    const customerName = order.customerName || user?.name || user?.displayName || 'Valued Customer';
    const customerPhone = order.customerPhone || user?.phone || user?.phoneNumber || 'N/A';
    const totalAmount = Number(order.total || 0).toLocaleString();

    const supportMsg = `Hello MArts Support,

I would like to cancel my order. Here are my order receipt details:
📦 Order ID: #${order.id}
📅 Order Date: ${order.date || 'Recent'}
🛍️ Products:
${itemsList || 'Handcrafted Pottery & Statues'}
💰 Total Amount: ₹${totalAmount}
👤 Customer: ${customerName}
📞 Phone: ${customerPhone}
💳 Payment Method: ${order.paymentMethod || 'Online'}

I have downloaded my order receipt. Please verify and process the cancellation manually.`;

    // 3. Close the modal
    setCancellingOrderId(null);

    // 4. Show confirmation toast noting admin will update manually
    showToast(
      'Receipt Downloaded',
      'Connecting to Support (+91 70616 71820). The admin will verify and update your order manually.',
      'success',
      6000
    );

    // 5. Redirect to Support Number
    if (channel === 'whatsapp') {
      const whatsappUrl = `https://wa.me/917061671820?text=${encodeURIComponent(supportMsg)}`;
      try {
        const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.href = whatsappUrl;
        }
      } catch (_) {
        window.location.href = whatsappUrl;
      }
    } else {
      window.location.href = 'tel:+917061671820';
    }
  };

  // Filter logic
  const filteredOrders = currentOrders.filter(ord => {
    if (!ord) return false;
    const ordId = ord.id ? String(ord.id).toLowerCase() : '';
    const ordItems = Array.isArray(ord.items) ? ord.items.filter(Boolean) : [];

    // Search query filter
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query === '' || 
      ordId.includes(query) ||
      ordItems.some(item => (item?.name ? String(item.name).toLowerCase() : '').includes(query));

    if (!matchesSearch) return false;

    // Horizontal category filter (case-insensitive)
    const st = (ord.status || '').toLowerCase();
    if (activeFilter === 'delivered') {
      return st === 'delivered';
    } else if (activeFilter === 'cancelled') {
      return st === 'cancelled';
    }
    return true;
  });

  return (
    <div className="w-full bg-[#FAF8F5] min-h-screen font-sans flex flex-col text-[#2B221B] selection:bg-[#EBDCCB]">
      {/* Universal Header with matching alignment, searchless mode and account back navigation */}
      <Header
        user={user}
        cartCount={cartCount || 0}
        wishlistCount={wishlistCount || 0}
        title="My Orders"
        showBack={true}
        backPath="/account"
        showSearch={false}
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 pt-3 sm:pt-5 pb-6 sm:pb-8 flex flex-col">
        {/* Search Bar & Horizontal Filters */}
        <div className="w-full mb-5 sm:mb-6 space-y-3 sm:space-y-3.5">
          <div className="max-w-xl">
            <div className="relative flex items-center bg-white rounded-full border border-[#E5D7CA] focus-within:border-[#C85A32] focus-within:ring-2 focus-within:ring-[#C85A32]/20 shadow-2xs hover:border-[#D5C2B2] transition-all">
              <Search
                size={18}
                className="absolute left-4 text-[#8C6D58] pointer-events-none shrink-0"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID or Product name..."
                className="w-full pl-11 pr-11 py-2.5 bg-transparent rounded-full text-xs sm:text-sm text-[#2B221B] placeholder-[#8C6D58]/80 outline-none font-medium"
                aria-label="Search orders"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-[#8C6D58] hover:text-[#2B221B] p-1 rounded-full cursor-pointer transition-colors"
                  aria-label="Clear search query"
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' }
            ].map(filter => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as any)}
                  className={`h-8 px-4 inline-flex items-center justify-center rounded-full text-xs font-semibold whitespace-nowrap select-none shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#C85A32] text-white shadow-xs'
                      : 'bg-transparent text-[#4E392D] hover:bg-[#F2E8DE]/60 border border-[#EADBCC]'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 pb-24 md:pb-12">
          {isLoading ? (
            <OrderHistorySkeleton />
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center my-4 bg-transparent border border-[#EADBCC] rounded-3xl p-8">
              <Package size={52} className="text-[#C85A32]/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#2B221B]">No orders found</h3>
              <p className="text-xs text-[#735A4C] mt-1 max-w-xs mx-auto">
                {searchQuery 
                  ? `No orders matching "${searchQuery}"` 
                  : (!auth.currentUser && !user) 
                    ? 'Please sign in to view your order history and live shipment tracking.' 
                    : 'You have not placed any orders in this category yet.'}
              </p>
              <button
                onClick={() => navigate((!auth.currentUser && !user) ? '/login' : '/products')}
                className="mt-5 bg-[#C85A32] text-white text-xs font-bold px-6 py-2.5 rounded-full hover:bg-[#A04724] active:bg-[#8C3F1E] transition-colors cursor-pointer shadow-xs"
              >
                {(!auth.currentUser && !user) ? 'Sign In to View Orders' : 'Start Shopping'}
              </button>
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {filteredOrders.map((order, orderIdx) => {
                const statusLower = (order.status || 'processing').toLowerCase();
                const isDelivered = statusLower === 'delivered';
                const isCancelled = statusLower === 'cancelled';
                const isConfirmed = statusLower === 'confirmed' || statusLower === 'placed';
                const isProcessing = statusLower === 'processing';
                const isShipped = statusLower === 'shipped';
                const isFailed = statusLower === 'failed';
                const isActiveOrder = isConfirmed || isProcessing || isShipped;
                const isMenuOpen = activeMenuOrderId === order.id;

                const safeItems = Array.isArray(order?.items) ? order.items.filter(Boolean) : [];
                const totalItemQty = order?.itemCount !== undefined 
                  ? order.itemCount 
                  : safeItems.reduce((s, i) => s + (Number(i?.quantity) || 1), 0);
                const itemsBaseTotal = order?.subtotal !== undefined 
                  ? order.subtotal 
                  : safeItems.reduce((acc, item) => acc + (Number(item?.price || 0) * (Number(item?.quantity) || 1)), 0);
                const mrp = order?.mrp !== undefined 
                  ? order.mrp 
                  : safeItems.reduce((acc, item) => {
                    const itemMrp = item?.oldPrice && Number(item.oldPrice) > Number(item?.price || 0) 
                      ? Number(item.oldPrice) 
                      : Number(item?.price || 0);
                    return acc + (itemMrp * (Number(item?.quantity) || 1));
                  }, 0);
                const discount = order?.discount !== undefined 
                  ? order.discount 
                  : Math.max(0, mrp - itemsBaseTotal);

                const safeOrderDate = order?.date || (order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently');
                const deliveryDateText = isDelivered
                  ? `Delivered on ${safeOrderDate}`
                  : isCancelled
                  ? `Cancelled on ${safeOrderDate}`
                  : isFailed
                  ? `Payment Failed on ${safeOrderDate}`
                  : isShipped
                  ? `Shipped on ${safeOrderDate}`
                  : 'Delivery by 3-5 Business Days (Insured Timber Crate)';

                return (
                  <div 
                    key={`${order.id}-${orderIdx}`} 
                    className="w-full bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border-0 shadow-2xs space-y-4 sm:space-y-5"
                  >
                    {/* Order Subheader */}
                    <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#EADBCC]/80">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-[#2B221B] tracking-tight">Order #{order.id}</span>
                          {isDelivered && (
                            <span className="bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Delivered
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Confirmed
                            </span>
                          )}
                          {isProcessing && (
                            <span className="bg-amber-50 text-amber-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Processing
                            </span>
                          )}
                          {isShipped && (
                            <span className="bg-blue-50 text-blue-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Truck size={12} /> Shipped
                            </span>
                          )}
                          {isCancelled && (
                            <span className="bg-rose-50 text-rose-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <XCircle size={12} strokeWidth={2.5} /> Cancelled
                            </span>
                          )}
                          {isFailed && (
                            <span className="bg-rose-50 text-rose-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle size={12} strokeWidth={2.5} /> Failed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#735A4C] mt-0.5">Placed on {order.date}</p>
                      </div>

                      {/* Menu & Receipt Actions */}
                      <div className="relative shrink-0 -mr-1 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(order)}
                          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#8C3F1E] hover:bg-[#F2E8DE]/60 border border-[#EADBCC] transition-colors cursor-pointer"
                          title="Download order receipt"
                        >
                          <Download size={13} />
                          <span>Receipt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveMenuOrderId(isMenuOpen ? null : order.id)}
                          className="p-1.5 hover:bg-[#F2E8DE]/60 rounded-full text-[#4E392D] transition-colors cursor-pointer shrink-0"
                          aria-label="Order Options"
                        >
                          <MoreVertical size={19} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActiveMenuOrderId(null)} 
                            />
                            <div className="absolute right-0 top-9 sm:top-10 z-50 w-[180px] bg-white rounded-2xl py-1 shadow-xl border border-[#EADBCC] animate-in fade-in duration-100">
                              <button
                                type="button"
                                onClick={() => handleDownloadReceipt(order)}
                                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-[#FAF4EE] flex items-center justify-between gap-1.5 transition-colors cursor-pointer rounded-t-xl"
                              >
                                <span>Download receipt</span>
                                <Download size={14} className="text-[#C85A32] shrink-0" />
                              </button>
                              {isActiveOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuOrderId(null);
                                    setCancellingOrderId(order.id);
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer rounded-b-xl"
                                >
                                  <span>Cancel order</span>
                                  <X size={14} className="shrink-0" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Order Body Grid: Products on Left, Price Breakdown on Right on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Products List */}
                      <div className="lg:col-span-7 xl:col-span-8 divide-y divide-[#EADBCC]/60">
                        {safeItems.map((item, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => navigate(item.id ? `/product/${item.id}` : '/')}
                            className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-[#F2E8DE]/40 p-2 -mx-2 rounded-2xl transition-colors group"
                            title="Click to view product details"
                          >
                            <div className="flex gap-3 sm:gap-4 items-start min-w-0 flex-1">
                              <div className="w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] bg-[#FAF5EF] border border-[#EADBCC]/60 rounded-2xl p-1.5 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-102 transition-transform">
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  loading="lazy" 
                                  decoding="async" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain" 
                                />
                              </div>
                              <div className="flex-1 min-w-0 pr-1">
                                <h4 className="text-[15px] font-medium text-[#2B221B] group-hover:text-[#C85A32] transition-colors line-clamp-1 leading-tight mb-1">
                                  {item.name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-[#735A4C]">
                                  <span>Qty: <strong className="text-[#2B221B]">{item.quantity || 1}</strong></span>
                                  <span>•</span>
                                  <span className="font-semibold text-[#2B221B]">₹{((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString()}</span>
                                </div>
                                <div className="mt-2 text-xs text-[#735A4C]">
                                  {isDelivered ? (
                                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                      <CheckCircle2 size={13} strokeWidth={2.5} />
                                      Delivered on {order.date}
                                    </span>
                                  ) : isCancelled ? (
                                    <span className="font-semibold text-rose-600 flex items-center gap-1">
                                      <XCircle size={13} strokeWidth={2.5} />
                                      Cancelled on {order.date}
                                    </span>
                                  ) : isFailed ? (
                                    <span className="font-semibold text-rose-600 flex items-center gap-1">
                                      <AlertCircle size={13} strokeWidth={2.5} />
                                      Payment Failed on {order.date}
                                    </span>
                                  ) : isShipped ? (
                                    <span className="font-semibold text-blue-700 flex items-center gap-1">
                                      <Truck size={13} />
                                      Shipped • Dispatched in Insured Crate
                                    </span>
                                  ) : (
                                    <>
                                      Delivery by <span className="font-semibold text-[#2B221B]">{deliveryDateText.replace('Delivery by ', '')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-[#8C6D58]/60 group-hover:text-[#C85A32] shrink-0 transition-colors" />
                          </div>
                        ))}
                      </div>

                      {/* Price Details Breakdown */}
                      <div className="lg:col-span-5 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-[#EADBCC]/80 pt-4 lg:pt-0 lg:pl-6 space-y-2 text-xs sm:text-sm text-[#4E392D]">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C3F1E] pb-1">
                          Price & Payment Details
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#735A4C]">MRP ({totalItemQty} {totalItemQty === 1 ? 'item' : 'items'})</span>
                          <span className="text-[#2B221B] font-medium">₹{mrp.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#735A4C]">Artisan Discount</span>
                          <span className="text-[#8C3F1E] font-medium">
                            {discount > 0 ? `- ₹${discount.toLocaleString()}` : '- ₹0'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#735A4C]">Insured Delivery</span>
                          <span className="text-emerald-700 font-medium">Free</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1.5 border-t border-[#EADBCC]/60">
                          <span className="text-[#735A4C]">Payment Method</span>
                          <span className="text-[#2B221B] font-semibold">{order.paymentMethod || 'Razorpay Online'}</span>
                        </div>
                        {order.paymentId && (
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-[#735A4C]">Transaction Ref</span>
                            <span className="text-[#4E392D] font-medium truncate max-w-[180px] text-right">{order.paymentId}</span>
                          </div>
                        )}

                        {/* Total price row */}
                        <div className="flex items-center justify-between font-bold text-[#2B221B] text-sm sm:text-base pt-2.5 mt-1 border-t border-[#EADBCC]">
                          <span>Total Amount</span>
                          <span className="text-base sm:text-lg font-bold text-[#C85A32]">₹{Number(order.total || itemsBaseTotal).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Support Redirect Modal */}
      {cancellingOrderId && (() => {
        const orderToCancel = currentOrders.find(o => String(o.id) === String(cancellingOrderId));
        if (!orderToCancel) return null;

        const itemsCount = (Array.isArray(orderToCancel.items) ? orderToCancel.items.filter(Boolean) : []).length;

        return (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border border-[#EADBCC]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center shrink-0 border border-[#EADBCC]">
                    <Headphones size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Cancel Order via Support</h3>
                    <p className="text-xs text-[#735A4C] mt-0.5">Order #{orderToCancel.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancellingOrderId(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-full transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order Brief Summary */}
              <div className="bg-[#FAF8F5] border border-[#EADBCC] rounded-2xl p-3.5 space-y-2 text-xs text-[#4E392D]">
                <div className="flex justify-between items-center">
                  <span className="text-[#735A4C]">Items in Order</span>
                  <span className="font-semibold text-[#2B221B]">{itemsCount} {itemsCount === 1 ? 'product' : 'products'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#735A4C]">Total Order Value</span>
                  <span className="font-bold text-[#C85A32]">₹{Number(orderToCancel.total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#735A4C]">Artisan Support Desk</span>
                  <span className="font-semibold text-[#2B221B]">+91 70616 71820</span>
                </div>
              </div>

              {/* Process Explanation */}
              <p className="text-xs text-gray-600 leading-relaxed">
                To cancel this order, your <strong>official order receipt will be downloaded automatically</strong> and you will be redirected to our support desk with your details. Our admin team will verify your receipt and update the cancellation in the system manually.
              </p>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleRedirectToSupportWithReceipt(orderToCancel, 'whatsapp')}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <MessageCircle size={18} />
                  <span>Connect on WhatsApp with Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRedirectToSupportWithReceipt(orderToCancel, 'call')}
                  className="w-full flex items-center justify-center gap-2 bg-[#FAF5EF] hover:bg-[#F2E8DE] text-[#2B221B] border border-[#EADBCC] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Phone size={16} className="text-[#C85A32]" />
                  <span>Call Support Desk (+91 70616 71820)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCancellingOrderId(null)}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-800 py-2 transition-colors cursor-pointer font-medium"
                >
                  Keep Order (Do Not Cancel)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Studio Style White Theme Square Corner Toast */}
      {toast && (
        <div 
          id="ai-studio-payment-toast"
          className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[250] bg-white text-gray-900 border border-gray-200 shadow-none px-3.5 py-2.5 rounded-none flex items-center gap-2.5 w-[90vw] max-w-md animate-in slide-in-from-top-3 fade-in duration-200 select-none"
        >
          {toast.type === 'success' ? (
            <Check size={18} className="text-[#0F9D58] shrink-0 self-center" strokeWidth={2.8} />
          ) : (
            <AlertCircle size={18} className="text-[#D93025] shrink-0 self-center" strokeWidth={2.2} />
          )}

          <div className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-gray-900 leading-snug">
            <span className="font-semibold text-gray-900">{toast.title}</span>
            {toast.message && (
              <span className="text-gray-600 block sm:inline sm:ml-1 text-[11px] sm:text-xs">
                {toast.message}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-none hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-1"
            aria-label="Dismiss notification"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
};

export default MyOrders;

