
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Footer from './components/Footer';
import { FullScreenCircleLoader } from './components/CircleLoader';
import { AddressPageSkeleton, PolicyPageSkeleton } from './components/Skeleton';
import ErrorBoundary from './components/ErrorBoundary';

import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import AllProducts from './pages/AllProducts';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Account from './pages/Account';
import MyOrders from './pages/MyOrders';
import Wishlist from './pages/Wishlist';

const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Contact = lazy(() => import('./pages/Contact'));
const ProfileSubPages = lazy(() => import('./pages/ProfileSubPages'));
const AddressPage = lazy(() => import('./pages/AddressPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));
const About = lazy(() => import('./pages/About'));
import { CartItem, User, Order, Product, CarouselBanner } from './types';
import { Heart, X, ChevronRight, Check, ShoppingCart, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  fetchUserProfile,
  restoreUserAccountByEmail,
  fetchUserCart,
  syncUserCartToFirestore,
  fetchUserWishlist,
  syncUserWishlistToFirestore,
  fetchUserOrders,
  fetchProductsFromFirestore,
  subscribeToLiveProducts,
  subscribeToCarouselBanners,
  saveOrderToFirestore,
  reconcileCanonicalUserData,
  checkUserBlockedStatus
} from './services/dbService';
import { sanitizeProductRatings } from './utils/productRating';
import { safeStorage, sanitizeUserForCache } from './utils/storage';

const ConditionalFooter = () => {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return <Footer />;
};

const GlobalToastNotification: React.FC<{
  notification: {
    show: boolean;
    message: string;
    type: 'cart' | 'wishlist' | 'success' | 'error' | 'blocked';
    item?: CartItem | Product | null;
  } | null;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const location = useLocation();
  if (!notification) return null;

  const isProductPage = location.pathname.startsWith('/product');

  return (
    <div 
      id="ai-studio-toast"
      className={`fixed ${
        isProductPage ? 'bottom-20 sm:bottom-8' : 'bottom-6 sm:bottom-8'
      } left-1/2 -translate-x-1/2 z-[250] w-auto max-w-[94vw] sm:max-w-md pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200`}
    >
      <div className={`bg-white text-gray-900 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border ${notification.type === 'blocked' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200/90'} flex items-center gap-2.5 sm:gap-3 select-none`}>
        {notification.type === 'wishlist' ? (
          <Heart size={18} className="text-rose-500 fill-rose-500 shrink-0" />
        ) : notification.type === 'success' ? (
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        ) : notification.type === 'blocked' ? (
          <ShieldAlert size={19} className="text-red-600 shrink-0" />
        ) : notification.type === 'error' ? (
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
        ) : (
          <ShoppingCart size={18} className="text-[#C85A32] shrink-0" />
        )}

        <div className={`text-xs sm:text-sm font-semibold ${notification.type === 'blocked' ? 'text-red-900 line-clamp-2 leading-snug' : 'text-gray-800 truncate'} max-w-[240px] xs:max-w-[280px] sm:max-w-sm flex-1 min-w-0`}>
          {notification.message}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors cursor-pointer shrink-0 -mr-1"
          aria-label="Dismiss"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = safeStorage.getItem('marts_cart') || safeStorage.getItem('melody_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = safeStorage.getItem('marts_user_profile') || safeStorage.getItem('melody_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = safeStorage.getItem('marts_wishlist') || safeStorage.getItem('melody_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'cart' | 'wishlist' | 'success' | 'error' | 'blocked';
    item?: CartItem | Product | null;
  } | null>(null);

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('marts_products');
      return saved ? sanitizeProductRatings(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('marts_products');
      const parsed = saved ? JSON.parse(saved) : [];
      return !Array.isArray(parsed) || parsed.length === 0;
    } catch {
      return true;
    }
  });

  const [banners, setBanners] = useState<CarouselBanner[]>([]);

  // Load products catalog and carousel banners on mount with real-time sync
  useEffect(() => {
    // Initial fetch
    fetchProductsFromFirestore()
      .then((prods) => {
        setProducts(prods);
        setIsProductsLoading(false);
      })
      .catch((e) => {
        console.warn('Products initial fetch notice:', e);
        setIsProductsLoading(false);
      });

    // Real-time live listener for products
    const unsubProducts = subscribeToLiveProducts((liveProds) => {
      setProducts(liveProds);
      setIsProductsLoading(false);
    });

    // Real-time live listener for carousel banners
    const unsubBanners = subscribeToCarouselBanners((liveBanners) => {
      if (liveBanners && liveBanners.length > 0) {
        setBanners(liveBanners);
      }
    });

    return () => {
      unsubProducts();
      unsubBanners();
    };
  }, []);

  // Sync Auth & Realtime Firestore User Data
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (firebaseUser) {
        const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();

        // Immediately purge all legacy un-scoped address keys so preset addresses never leak across accounts
        try {
          const keysToPurge = [
            'marts_default_address',
            'melody_default_address',
            'agronic_default_address',
            'marts_user_address',
            'melody_user_address',
            'agronic_user_address',
            'melody_addresses'
          ];
          keysToPurge.forEach(k => localStorage.removeItem(k));
        } catch (_) {}

        // Immediate user-scoped cache resolution strictly matching this exact user
        try {
          const cachedRaw = localStorage.getItem(`marts_user_profile_${firebaseUser.uid}`) || localStorage.getItem('marts_user_profile');
          if (cachedRaw) {
            const cachedUser = JSON.parse(cachedRaw);
            if (cachedUser && (cachedUser.uid === firebaseUser.uid || (cleanEmail && cachedUser.email?.toLowerCase() === cleanEmail))) {
              setUser(cachedUser);
            }
          }
        } catch (_) {}

        try {
          if (cleanEmail) {
            reconcileCanonicalUserData(firebaseUser.uid, cleanEmail).catch(() => {});
          }
          fetchUserProfile(firebaseUser.uid, cleanEmail).then((profile) => {
            if (profile) {
              setUser(profile);
              if (profile.isBlocked) {
                setNotification({
                  show: true,
                  message: profile.blockReason || 'Your account has been blocked by the admin. You cannot place orders.',
                  type: 'blocked'
                });
              }
            } else {
              const newProfile: User = {
                name: firebaseUser.displayName || 'Customer',
                displayName: firebaseUser.displayName || 'Customer',
                phone: String(firebaseUser.phoneNumber || ''),
                phoneNumber: String(firebaseUser.phoneNumber || ''),
                email: firebaseUser.email || '',
                avatar: firebaseUser.photoURL || undefined,
                address: '',
                orders: []
              };
              setDoc(doc(db, 'users', firebaseUser.uid), newProfile, { merge: true }).catch(() => {});
              setUser(newProfile);
            }
          }).catch(() => {});

          // Real-time listener for universal profile updates & admin block status
          const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : null;
          const unsubs: (() => void)[] = [];

          const handleUserDataSnapshot = (snap: any) => {
            if (snap.exists()) {
              const data = snap.data();
              const deliveryAddr = data.deliveryAddress || data.shippingAddress;
              let addressStr = typeof data.address === 'string' ? data.address : '';
              if (!addressStr && deliveryAddr) {
                if (typeof deliveryAddr === 'string') {
                  addressStr = deliveryAddr;
                } else if (typeof deliveryAddr === 'object') {
                  addressStr = [
                    deliveryAddr.street,
                    deliveryAddr.apartment,
                    deliveryAddr.landmark,
                    deliveryAddr.city,
                    deliveryAddr.state,
                    deliveryAddr.postalCode || deliveryAddr.pin
                  ].filter(Boolean).join(', ');
                }
              }

              setUser(prev => {
                const currentOrders = Array.isArray(prev?.orders) ? prev.orders : [];
                const incomingOrders = Array.isArray(data.orders) ? data.orders : [];
                
                // Merge orders strictly by unique ID so orders never disappear or flicker
                const ordMap = new Map<string, Order>();
                incomingOrders.forEach(o => { if (o && o.id) ordMap.set(o.id, o); });
                currentOrders.forEach(o => {
                  if (o && o.id) {
                    const existing = ordMap.get(o.id);
                    if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
                      ordMap.set(o.id, { ...existing, ...o });
                    }
                  }
                });

                const bestOrders = Array.from(ordMap.values()).sort((a, b) => {
                  const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
                  const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
                  if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                  return String(b?.id || '').localeCompare(String(a?.id || ''));
                });

                const isBlocked = Boolean(
                  data.isBlocked === true || 
                  data.blocked === true || 
                  data.status === 'blocked' || 
                  data.disabled === true || 
                  data.isActive === false ||
                  data.role === 'blocked' ||
                  data.userStatus === 'blocked'
                );
                const updated: User = {
                  name: data.displayName || data.name || prev?.name || firebaseUser.displayName || 'Customer',
                  displayName: data.displayName || data.name || prev?.displayName || firebaseUser.displayName || 'Customer',
                  phone: String(data.phoneNumber || data.phone || prev?.phone || firebaseUser.phoneNumber || ''),
                  phoneNumber: String(data.phoneNumber || data.phone || prev?.phoneNumber || firebaseUser.phoneNumber || ''),
                  email: data.email || prev?.email || firebaseUser.email || '',
                  avatar: data.avatar || data.photoURL || prev?.avatar || firebaseUser.photoURL || undefined,
                  address: typeof addressStr === 'string' ? addressStr : '',
                  deliveryAddress: deliveryAddr,
                  shippingAddress: data.shippingAddress || deliveryAddr,
                  orders: bestOrders,
                  role: data.role || prev?.role || 'customer',
                  isBlocked,
                  blocked: isBlocked,
                  status: data.status || (isBlocked ? 'blocked' : 'active'),
                  disabled: isBlocked,
                  blockReason: data.blockReason || data.reason || undefined,
                  hasPassword: Boolean(data.passwordHash),
                  linkedProviders: data.linkedProviders || []
                };
                if (isBlocked && (!prev?.isBlocked || prev?.status !== 'blocked')) {
                  const blockMsg = data.blockReason || 'Your account has been blocked by the admin. You cannot place orders.';
                  setNotification({
                    show: true,
                    message: blockMsg,
                    type: 'blocked'
                  });
                }
                try {
                  safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updated)));
                  if (updated.address) {
                    safeStorage.setItem(`marts_user_address_${firebaseUser.uid}`, updated.address);
                  }
                } catch (_) {}
                return updated;
              });
            }
          };

          unsubs.push(onSnapshot(doc(db, 'users', firebaseUser.uid), handleUserDataSnapshot, (err) => console.warn('User UID snapshot notice:', err)));
          if (emailDocId && emailDocId !== firebaseUser.uid) {
            unsubs.push(onSnapshot(doc(db, 'users', emailDocId), handleUserDataSnapshot, (err) => console.warn('User email doc snapshot notice:', err)));
          }

          unsubSnapshot = () => {
            unsubs.forEach(u => {
              try { u(); } catch (_) {}
            });
          };

          // Fetch Cart, Wishlist, Orders directly from Cloud Firestore
          const [dbCart, dbWishlist, dbOrders] = await Promise.all([
            fetchUserCart(firebaseUser.uid, cleanEmail),
            fetchUserWishlist(firebaseUser.uid, cleanEmail),
            fetchUserOrders(firebaseUser.uid, cleanEmail)
          ]);

          if (Array.isArray(dbCart) && dbCart.length > 0) setCart(dbCart);
          if (Array.isArray(dbWishlist) && dbWishlist.length > 0) setWishlist(dbWishlist);
          if (Array.isArray(dbOrders) && dbOrders.length > 0) {
            setUser(prev => {
              const base: User = prev || {
                name: firebaseUser.displayName || 'Customer',
                phone: String(firebaseUser.phoneNumber || ''),
                email: firebaseUser.email || '',
                address: '',
                orders: []
              };
              const ordMap = new Map<string, Order>();
              (base.orders || []).forEach(o => { if (o && o.id) ordMap.set(o.id, o); });
              dbOrders.forEach(o => { if (o && o.id) ordMap.set(o.id, o); });

              const merged = Array.from(ordMap.values()).sort((a, b) => {
                const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
                const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
                if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                return String(b?.id || '').localeCompare(String(a?.id || ''));
              });
              return { ...base, orders: merged };
            });
          }
        } catch (e) {
          console.warn('Notice: Firestore data sync operated in offline cache mode:', e);
        }
      } else {
        // Firebase Auth is not signed in or resolving.
        // Check if user is authenticated via verified email OTP, custom credentials, or active cache session
        const cachedRaw = safeStorage.getItem('marts_user_profile') || safeStorage.getItem('melody_user_profile');
        if (cachedRaw) {
          try {
            const cachedUser = JSON.parse(cachedRaw);
            if (cachedUser && (cachedUser.email || cachedUser.phone || cachedUser.name)) {
              // Active local user session exists! DO NOT LOG OUT!
              setUser(prev => prev || cachedUser);
              const cleanCachedEmail = (cachedUser.email || '').trim().toLowerCase();
              const cachedUid = cachedUser.uid || (cleanCachedEmail ? 'marts_user_' + cleanCachedEmail.replace(/[^a-zA-Z0-9]/g, '_') : null);

              if (cachedUid) {
                // Attach real-time snapshot listener on Firestore document for cached session
                const emailDocId = cleanCachedEmail ? 'marts_user_' + cleanCachedEmail.replace(/[^a-zA-Z0-9]/g, '_') : null;
                const unsubs: (() => void)[] = [];

                const handleCachedUserSnapshot = (snap: any) => {
                  if (snap.exists()) {
                    const data = snap.data();
                    const isBlocked = Boolean(
                      data.isBlocked === true || 
                      data.blocked === true || 
                      data.status === 'blocked' || 
                      data.disabled === true || 
                      data.isActive === false ||
                      data.role === 'blocked' ||
                      data.userStatus === 'blocked'
                    );
                    setUser(prev => {
                      if (!prev) return prev;
                      const updated: User = {
                        ...prev,
                        isBlocked,
                        blocked: isBlocked,
                        status: data.status || (isBlocked ? 'blocked' : 'active'),
                        disabled: isBlocked,
                        blockReason: data.blockReason || data.reason || prev.blockReason,
                        hasPassword: Boolean(data.passwordHash || prev.hasPassword)
                      };
                      if (isBlocked && (!prev.isBlocked || prev.status !== 'blocked')) {
                        const blockMsg = data.blockReason || 'Your account has been blocked by the admin. You cannot place orders.';
                        setNotification({
                          show: true,
                          message: blockMsg,
                          type: 'blocked'
                        });
                      }
                      try {
                        safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updated)));
                      } catch (_) {}
                      return updated;
                    });
                  }
                };

                if (cachedUid && cachedUid !== 'guest') {
                  unsubs.push(onSnapshot(doc(db, 'users', cachedUid), handleCachedUserSnapshot, (err) => console.warn('Cached user UID snapshot notice:', err)));
                }
                if (emailDocId && emailDocId !== cachedUid) {
                  unsubs.push(onSnapshot(doc(db, 'users', emailDocId), handleCachedUserSnapshot, (err) => console.warn('Cached user email snapshot notice:', err)));
                }

                unsubSnapshot = () => {
                  unsubs.forEach(u => {
                    try { u(); } catch (_) {}
                  });
                };

                // Fetch cart, wishlist, orders for this authenticated user in background
                Promise.all([
                  fetchUserCart(cachedUid, cleanCachedEmail),
                  fetchUserWishlist(cachedUid, cleanCachedEmail),
                  fetchUserOrders(cachedUid, cleanCachedEmail)
                ]).then(([dbCart, dbWishlist, dbOrders]) => {
                  if (Array.isArray(dbCart) && dbCart.length > 0) setCart(dbCart);
                  if (Array.isArray(dbWishlist) && dbWishlist.length > 0) setWishlist(dbWishlist);
                  if (Array.isArray(dbOrders) && dbOrders.length > 0) {
                    setUser(prev => {
                      if (!prev) return prev;
                      const ordMap = new Map<string, Order>();
                      (prev.orders || []).forEach(o => { if (o && o.id) ordMap.set(o.id, o); });
                      dbOrders.forEach(o => { if (o && o.id) ordMap.set(o.id, o); });
                      return {
                        ...prev,
                        orders: Array.from(ordMap.values()).sort((a, b) => {
                          const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
                          const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
                          if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                          return String(b?.id || '').localeCompare(String(a?.id || ''));
                        })
                      };
                    });
                  }
                }).catch(() => {});
              }
              return;
            }
          } catch (_) {}
        }
        // ONLY if no user is found anywhere (e.g. after explicit user logout)
        setUser(null);
      }
    });

    // Custom event listener for instant local updates across components
    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setUser(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };
    window.addEventListener('melody_user_updated', handleUserUpdate);

    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
      window.removeEventListener('melody_user_updated', handleUserUpdate);
    };
  }, []);

  // Sync Cart with local cache & Firestore when updated
  useEffect(() => {
    try {
      safeStorage.setItem('marts_cart', JSON.stringify(cart));
    } catch {}
    const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
    const currentUid = auth.currentUser?.uid || user?.uid || (cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'guest');
    if (currentUid && currentUid !== 'guest' && cart.length >= 0) {
      syncUserCartToFirestore(currentUid, cart, cleanEmail).catch(e => console.warn('Cart sync notice:', e));
    }
  }, [cart, user?.email]);

  // Sync Wishlist with local cache & Firestore when updated
  useEffect(() => {
    try {
      safeStorage.setItem('marts_wishlist', JSON.stringify(wishlist));
    } catch {}
    const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
    const currentUid = auth.currentUser?.uid || user?.uid || (cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'guest');
    if (currentUid && currentUid !== 'guest') {
      syncUserWishlistToFirestore(currentUid, wishlist, cleanEmail).catch(e => console.warn('Wishlist sync notice:', e));
    }
  }, [wishlist, user?.email]);

  const showToast = (message: string, type: 'cart' | 'wishlist' | 'success' | 'error' | 'blocked' = 'cart', item?: CartItem | Product | null) => {
    setNotification({ show: true, message, type, item });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const handleCustomToast = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, e.detail.type || 'success', e.detail.item);
      }
    };
    window.addEventListener('marts_show_toast', handleCustomToast);
    return () => window.removeEventListener('marts_show_toast', handleCustomToast);
  }, []);

  const addToCart = (item: CartItem, silent?: boolean) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i);
      return [...prev, item];
    });
    if (!silent) {
      showToast(`${item.name} added to cart!`, 'cart', item);
    }
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity <= 0) {
        return prev.filter(item => item.id !== productId);
      }
      return prev.map(item => item.id === productId ? { ...item, quantity } : item);
    });
  };

  const clearCart = () => {
    setCart([]);
    const currentUser = auth.currentUser;
    if (currentUser) {
      syncUserCartToFirestore(currentUser.uid, []).catch(e => console.warn('Cart clear notice:', e));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Signout warning:', e);
    }

    // Complete purge of all user identity cache keys across prefixes
    try {
      localStorage.removeItem('marts_user_profile');
      localStorage.removeItem('melody_user_profile');
      localStorage.removeItem('agronic_user_profile');
      localStorage.removeItem('marts_user_address');
      localStorage.removeItem('melody_user_address');
      localStorage.removeItem('agronic_user_address');
      localStorage.removeItem('marts_default_address');
      localStorage.removeItem('melody_default_address');
      localStorage.removeItem('agronic_default_address');
      localStorage.removeItem('marts_cart');
      localStorage.removeItem('melody_cart');
      localStorage.removeItem('marts_wishlist');
      localStorage.removeItem('melody_wishlist');
      sessionStorage.removeItem('marts_pending_login_view');
      sessionStorage.removeItem('marts_pending_login_email');
      sessionStorage.removeItem('marts_pending_signup_step');
      sessionStorage.removeItem('marts_pending_signup_name');
      sessionStorage.removeItem('marts_pending_signup_email');
      sessionStorage.removeItem('marts_pending_signup_pass');
      sessionStorage.removeItem('marts_otp_token');
    } catch (_) {}

    setUser(null);
    setCart([]);
    setWishlist([]);

    // Broadcast user sign-out event so other components update synchronously
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: null }));
    }

    setNotification({
      show: true,
      message: 'Logged out successfully',
      type: 'success'
    });
  };

  const handleAddOrder = async (order: Order) => {
    try {
      const currentFirebaseUser = auth.currentUser;
      const uid = currentFirebaseUser 
        ? currentFirebaseUser.uid 
        : (order.userId && order.userId !== 'guest' ? order.userId : ((user as any)?.uid || user?.phone || user?.email || null));

      if (!order.userId && uid) {
        order.userId = uid;
      }

      const currentOrders = user?.orders || [];
      const updatedOrders = [order, ...currentOrders.filter(o => o.id !== order.id)];

      const updatedUser: User = user 
        ? { ...user, orders: updatedOrders } 
        : {
            name: order.customerName || 'Customer',
            phone: order.customerPhone || '',
            email: order.customerEmail || '',
            address: order.customerAddress || '',
            orders: updatedOrders
          };

      setUser(updatedUser);
      try {
        safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updatedUser)));
        if (uid) {
          safeStorage.setItem(`marts_orders_${uid}`, JSON.stringify(updatedOrders));
        }
        if (updatedUser.email) {
          safeStorage.setItem(`marts_orders_${updatedUser.email.toLowerCase().trim()}`, JSON.stringify(updatedOrders));
        }
        safeStorage.setItem('marts_orders', JSON.stringify(updatedOrders));
      } catch (_) {}

      await saveOrderToFirestore(uid, order, {
        name: order.customerName || updatedUser.name || '',
        phone: order.customerPhone || updatedUser.phone || '',
        email: order.customerEmail || updatedUser.email || '',
        address: order.customerAddress || updatedUser.address || ''
      }).catch(e => console.warn('saveOrderToFirestore notice:', e));

      if (uid && uid !== 'guest') {
        setDoc(doc(db, 'users', uid), {
          orders: updatedOrders,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(e => {
          console.warn('Notice: user doc orders update offline:', e);
        });
      }

      showToast('Order placed successfully!', 'success');
    } catch (err) {
      console.warn('Error in handleAddOrder:', err);
    }
  };

  const handleUpdateOrders = async (updatedOrders: Order[]) => {
    try {
      const updatedUser: User = user 
        ? { ...user, orders: updatedOrders } 
        : {
            name: 'Customer',
            address: '',
            orders: updatedOrders
          };
      setUser(updatedUser);
      try {
        safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updatedUser)));
      } catch (_) {}

      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser) {
        try {
          await setDoc(doc(db, 'users', currentFirebaseUser.uid), {
            orders: updatedOrders,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn('Notice: Firestore order update operated offline:', e);
        }
      }
    } catch (err) {
      console.warn('Error in handleUpdateOrders:', err);
    }
  };

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      const isRemoving = prev.includes(productId);
      if (!isRemoving) {
        const product = products.find(p => p.id === productId);
        if (product) showToast(`${product.name} added to wishlist!`, 'wishlist', product);
      }
      return isRemoving ? prev.filter(id => id !== productId) : [...prev, productId];
    });
  };

  const cartTotalQuantity = (cart || []).reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);

  return (
    <Router>
      <div className="min-h-screen w-full flex flex-col bg-white">
        <main className="flex-1 w-full">
          <ErrorBoundary>
            <Routes>
            <Route 
              path="/" 
              element={
                <Home
                  user={user}
                  onAddToCart={addToCart}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  cartCount={cartTotalQuantity}
                  products={products}
                  banners={banners}
                  isProductsLoading={isProductsLoading}
                />
              } 
            />
            <Route 
              path="/products" 
              element={
                <AllProducts
                  user={user}
                  cartCount={cartTotalQuantity}
                  onAddToCart={addToCart}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  products={products}
                  isProductsLoading={isProductsLoading}
                />
              } 
            />
            <Route 
              path="/product/:id" 
              element={
                <ProductDetail
                  user={user}
                  cart={cart}
                  cartCount={cartTotalQuantity}
                  onAddToCart={addToCart}
                  onUpdateCartQuantity={updateCartQuantity}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  products={products}
                />
              } 
            />
            <Route 
              path="/cart" 
              element={
                <Cart cart={cart} setCart={setCart} user={user} />
              } 
            />
            <Route
              path="/wishlist"
              element={
                <Wishlist
                  user={user}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  onRemoveFromWishlist={(id) => {
                    setWishlist(prev => prev.filter(item => item !== id));
                    const p = products.find(prod => prod.id === id);
                    showToast(p ? `${p.name} removed from wishlist` : 'Removed from wishlist', 'wishlist');
                  }}
                  onMoveToCart={(product) => {
                    addToCart({ ...product, quantity: 1 });
                    setWishlist(prev => prev.filter(id => id !== product.id));
                    showToast(`${product.name} moved to cart!`, 'cart', product);
                  }}
                  onMoveAllToCart={(products) => {
                    products.forEach(p => addToCart({ ...p, quantity: 1 }));
                    const movedIds = new Set(products.map(p => p.id));
                    setWishlist(prev => prev.filter(id => !movedIds.has(id)));
                    showToast(`Moved ${products.length} items to your cart!`, 'cart');
                  }}
                  onClearWishlist={() => {
                    setWishlist([]);
                    showToast('Wishlist cleared', 'wishlist');
                  }}
                  cartCount={cartTotalQuantity}
                  products={products}
                />
              }
            />
            <Route 
              path="/checkout" 
              element={
                <Checkout cart={cart} setCart={setCart} clearCart={clearCart} user={user} onOrderSuccess={handleAddOrder} />
              } 
            />
            <Route 
              path="/login" 
              element={
                user ? <Navigate to="/" /> : (
                  <Login onLogin={setUser} />
                )
              } 
            />
            <Route 
              path="/signup" 
              element={
                user ? <Navigate to="/" /> : (
                  <Signup onSignup={setUser} />
                )
              } 
            />
            <Route path="/order-success" element={<Navigate to="/orders" replace />} />
            <Route 
              path="/account" 
              element={
                <Account user={user} onLogout={handleLogout} />
              } 
            />
            <Route 
              path="/orders" 
              element={
                <MyOrders 
                  user={user} 
                  onUpdateOrders={handleUpdateOrders} 
                  cartCount={cartTotalQuantity}
                  wishlistCount={wishlist.length}
                />
              } 
            />
            
            <Route 
              path="/help" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <HelpCenter />
                </Suspense>
              } 
            />
            <Route 
              path="/support" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <HelpCenter />
                </Suspense>
              } 
            />
            <Route 
              path="/contact" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <HelpCenter />
                </Suspense>
              } 
            />
            <Route 
              path="/about" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <About />
                </Suspense>
              } 
            />
            <Route path="/location" element={<Navigate to="/" replace />} />
            
            <Route 
              path="/addresses" 
              element={
                <Suspense fallback={<AddressPageSkeleton />}>
                  <AddressPage cart={cart} user={user} onUpdateUser={setUser} />
                </Suspense>
              } 
            />
            <Route 
              path="/address" 
              element={
                <Suspense fallback={<AddressPageSkeleton />}>
                  <AddressPage cart={cart} user={user} onUpdateUser={setUser} />
                </Suspense>
              } 
            />
            <Route 
              path="/add-address" 
              element={
                <Suspense fallback={<AddressPageSkeleton />}>
                  <AddressPage cart={cart} user={user} onUpdateUser={setUser} />
                </Suspense>
              } 
            />
            <Route 
              path="/payments" 
              element={
                <Suspense fallback={<FullScreenCircleLoader />}>
                  <ProfileSubPages type="payments" user={user} onUpdateUser={setUser} />
                </Suspense>
              } 
            />
            <Route 
              path="/profile/edit" 
              element={
                <Suspense fallback={<FullScreenCircleLoader />}>
                  <ProfileSubPages type="edit" user={user} onUpdateUser={setUser} />
                </Suspense>
              } 
            />
            <Route 
              path="/privacy-policy" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <PolicyPage type="privacy" />
                </Suspense>
              } 
            />
            <Route 
              path="/refund-policy" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <PolicyPage type="refunds" />
                </Suspense>
              } 
            />
            <Route 
              path="/terms-and-conditions" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <PolicyPage type="terms" />
                </Suspense>
              } 
            />
            <Route 
              path="/shipping-policy" 
              element={
                <Suspense fallback={<PolicyPageSkeleton />}>
                  <PolicyPage type="shipping" />
                </Suspense>
              } 
            />
            
            {/* Fallback route: Always redirect unknown paths to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
        <ConditionalFooter />
        <GlobalToastNotification notification={notification} onClose={() => setNotification(null)} />
      </div>
    </Router>
  );
};

export default App;
