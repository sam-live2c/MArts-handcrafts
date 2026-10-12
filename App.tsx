
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
import { Heart, X, ChevronRight, Check, ShoppingCart, CheckCircle2 } from 'lucide-react';
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
  saveOrderToFirestore
} from './services/dbService';
import { sanitizeProductRatings } from './utils/productRating';

const ConditionalFooter = () => {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return <Footer />;
};

const GlobalToastNotification: React.FC<{
  notification: {
    show: boolean;
    message: string;
    type: 'cart' | 'wishlist' | 'success';
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
      <div className="bg-white text-gray-900 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-200/90 flex items-center gap-2.5 sm:gap-3 select-none">
        {notification.type === 'wishlist' ? (
          <Heart size={18} className="text-rose-500 fill-rose-500 shrink-0" />
        ) : notification.type === 'success' ? (
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        ) : (
          <ShoppingCart size={18} className="text-[#C85A32] shrink-0" />
        )}

        <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[220px] xs:max-w-[260px] sm:max-w-sm flex-1 min-w-0">
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
      const saved = localStorage.getItem('melody_cart') || localStorage.getItem('marts_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('melody_user_profile') || localStorage.getItem('marts_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('melody_wishlist') || localStorage.getItem('marts_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'cart' | 'wishlist';
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
        // Immediate local cache resolution for zero latency
        try {
          const cachedRaw = localStorage.getItem('marts_user_profile') || localStorage.getItem('melody_user_profile');
          if (cachedRaw) {
            const cachedUser = JSON.parse(cachedRaw);
            if (cachedUser && (cachedUser.email === firebaseUser.email || cachedUser.name)) {
              setUser(cachedUser);
            }
          }
        } catch (_) {}

        const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();
        try {
          fetchUserProfile(firebaseUser.uid, cleanEmail).then((profile) => {
            if (profile) {
              setUser(profile);
            } else if (cleanEmail) {
              restoreUserAccountByEmail(cleanEmail, undefined, firebaseUser.displayName || undefined, firebaseUser.uid)
                .then(restored => setUser(restored.user))
                .catch(() => {});
            } else {
              const newProfile: User = {
                name: firebaseUser.displayName || 'User',
                phone: firebaseUser.phoneNumber || '',
                email: firebaseUser.email || '',
                address: '',
                orders: []
              };
              setDoc(doc(db, 'users', firebaseUser.uid), newProfile, { merge: true }).catch(() => {});
              setUser(newProfile);
            }
          }).catch(() => {});

          // Real-time listener for universal profile updates across websites/tabs
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          unsubSnapshot = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const deliveryAddr = data.deliveryAddress || data.shippingAddress;
              let addressStr = data.address || '';
              if (!addressStr && deliveryAddr) {
                if (typeof deliveryAddr === 'string') {
                  addressStr = deliveryAddr;
                } else {
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
                const currentOrders = prev?.orders && prev.orders.length > 0 ? prev.orders : [];
                const incomingOrders = Array.isArray(data.orders) ? data.orders : [];
                const bestOrders = incomingOrders.length > currentOrders.length ? incomingOrders : (currentOrders.length > 0 ? currentOrders : incomingOrders);

                const updated: User = {
                  name: data.displayName || data.name || prev?.name || firebaseUser.displayName || 'User',
                  displayName: data.displayName || data.name || prev?.displayName || firebaseUser.displayName || 'User',
                  phone: data.phoneNumber || data.phone || prev?.phone || firebaseUser.phoneNumber || '',
                  phoneNumber: data.phoneNumber || data.phone || prev?.phoneNumber || firebaseUser.phoneNumber || '',
                  email: data.email || prev?.email || firebaseUser.email || '',
                  address: addressStr !== undefined && addressStr !== '' ? addressStr : (prev?.address || ''),
                  deliveryAddress: deliveryAddr,
                  shippingAddress: data.shippingAddress || deliveryAddr,
                  orders: bestOrders
                };
                localStorage.setItem('melody_user_profile', JSON.stringify(updated));
                if (updated.address) {
                  localStorage.setItem('melody_user_address', updated.address);
                  localStorage.setItem('agronic_user_address', updated.address);
                }
                return updated;
              });
            }
          }, (err) => {
            console.warn('Realtime user profile snapshot notice:', err);
          });

          // Fetch Cart, Wishlist, Orders
          const [dbCart, dbWishlist, dbOrders] = await Promise.all([
            fetchUserCart(firebaseUser.uid),
            fetchUserWishlist(firebaseUser.uid),
            fetchUserOrders(firebaseUser.uid)
          ]);

          if (dbCart.length > 0) setCart(dbCart);
          if (dbWishlist.length > 0) setWishlist(dbWishlist);
          if (dbOrders.length > 0) {
            setUser(prev => {
              const base: User = prev || {
                name: firebaseUser.displayName || 'User',
                phone: firebaseUser.phoneNumber || '',
                email: firebaseUser.email || '',
                address: '',
                orders: []
              };
              const merged = [...dbOrders];
              (base.orders || []).forEach(o => {
                if (!merged.some(m => m.id === o.id)) {
                  merged.push(o);
                }
              });
              merged.sort((a, b) => {
                const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
                const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
                if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                return (b.id || '').localeCompare(a.id || '');
              });
              return { ...base, orders: merged };
            });
          }
        } catch (e) {
          console.warn('Notice: Firestore data sync operated in offline cache mode:', e);
        }
      } else {
        // User is explicitly signed out of Firebase Auth - do not resurrect cached profiles
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
      localStorage.setItem('melody_cart', JSON.stringify(cart));
      localStorage.setItem('marts_cart', JSON.stringify(cart));
    } catch {}
    const currentUser = auth.currentUser;
    if (currentUser && cart.length >= 0) {
      syncUserCartToFirestore(currentUser.uid, cart).catch(e => console.warn('Cart sync notice:', e));
    }
  }, [cart]);

  // Sync Wishlist with local cache & Firestore when updated
  useEffect(() => {
    try {
      localStorage.setItem('melody_wishlist', JSON.stringify(wishlist));
      localStorage.setItem('marts_wishlist', JSON.stringify(wishlist));
    } catch {}
    const currentUser = auth.currentUser;
    if (currentUser) {
      syncUserWishlistToFirestore(currentUser.uid, wishlist).catch(e => console.warn('Wishlist sync notice:', e));
    }
  }, [wishlist]);

  const showToast = (message: string, type: 'cart' | 'wishlist' | 'success' = 'cart', item?: CartItem | Product | null) => {
    setNotification({ show: true, message, type, item });
    setTimeout(() => setNotification(null), 3500);
  };

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
        localStorage.setItem('melody_user_profile', JSON.stringify(updatedUser));
        localStorage.setItem('marts_user_profile', JSON.stringify(updatedUser));
        if (uid) {
          localStorage.setItem(`marts_orders_${uid}`, JSON.stringify(updatedOrders));
          localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(updatedOrders));
        }
      } catch (_) {}

      await saveOrderToFirestore(uid, order, {
        name: order.customerName || updatedUser.name || '',
        phone: order.customerPhone || updatedUser.phone || '',
        email: order.customerEmail || updatedUser.email || '',
        address: order.customerAddress || updatedUser.address || ''
      }).catch(e => console.warn('saveOrderToFirestore notice:', e));

      if (uid && currentFirebaseUser) {
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
        localStorage.setItem('melody_user_profile', JSON.stringify(updatedUser));
        localStorage.setItem('marts_user_profile', JSON.stringify(updatedUser));
      } catch (_) {}

      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser) {
        try {
          localStorage.setItem(`marts_orders_${currentFirebaseUser.uid}`, JSON.stringify(updatedOrders));
          localStorage.setItem(`melody_orders_${currentFirebaseUser.uid}`, JSON.stringify(updatedOrders));
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
