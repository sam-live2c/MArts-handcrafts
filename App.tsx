
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Footer from './components/Footer';
import ProductDetail from './pages/ProductDetail';
import AllProducts from './pages/AllProducts';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Account from './pages/Account';
import HelpCenter from './pages/HelpCenter';
import Contact from './pages/Contact';
import ProfileSubPages from './pages/ProfileSubPages';
import AddressPage from './pages/AddressPage';
import PolicyPage from './pages/PolicyPage';
import MyOrders from './pages/MyOrders';
import About from './pages/About';
import Wishlist from './pages/Wishlist';
import { CartItem, User, Order, Product } from './types';
import { Heart, X, ChevronRight, Check, ShoppingCart } from 'lucide-react';
import { PRODUCTS } from './constants';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  fetchUserProfile,
  fetchUserCart,
  syncUserCartToFirestore,
  fetchUserWishlist,
  syncUserWishlistToFirestore,
  fetchUserOrders,
  fetchProductsFromFirestore,
  saveOrderToFirestore
} from './services/dbService';

const ConditionalFooter = () => {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return <Footer />;
};

const GlobalToastNotification: React.FC<{
  notification: {
    show: boolean;
    message: string;
    type: 'cart' | 'wishlist';
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
      <div className="bg-[#202124] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.4)] border border-white/10 flex items-center gap-2.5 sm:gap-3 select-none">
        {notification.type === 'wishlist' ? (
          <Heart size={18} className="text-rose-400 fill-rose-400 shrink-0" />
        ) : (
          <ShoppingCart size={18} className="text-[#E07A5F] shrink-0" />
        )}

        <div className="text-xs sm:text-sm font-medium text-gray-200 truncate max-w-[220px] xs:max-w-[260px] sm:max-w-sm flex-1 min-w-0">
          {notification.message}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer shrink-0 -mr-1"
          aria-label="Dismiss"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

const InitialRedirectHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Make Home ('/') the first page when visiting the website, regardless of login state
    const sessionActive = sessionStorage.getItem('melody_session_active');
    if (!sessionActive) {
      sessionStorage.setItem('melody_session_active', 'true');
      if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    }
  }, [navigate, location.pathname]);

  return null;
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

  // Load products catalog on mount
  useEffect(() => {
    fetchProductsFromFirestore().catch(e => console.warn('Products fetch notice:', e));
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
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            const newProfile: User = {
              name: firebaseUser.displayName || 'User',
              phone: firebaseUser.phoneNumber || '',
              email: firebaseUser.email || '',
              address: '',
              orders: []
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            } catch (err) {
              console.warn('Notice: Firestore user doc creation skipped (offline mode):', err);
            }
            setUser(newProfile);
          }

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
                const updated: User = {
                  name: data.displayName || data.name || prev?.name || firebaseUser.displayName || 'User',
                  displayName: data.displayName || data.name || prev?.displayName || firebaseUser.displayName || 'User',
                  phone: data.phoneNumber || data.phone || prev?.phone || firebaseUser.phoneNumber || '',
                  phoneNumber: data.phoneNumber || data.phone || prev?.phoneNumber || firebaseUser.phoneNumber || '',
                  email: data.email || prev?.email || firebaseUser.email || '',
                  address: addressStr !== undefined && addressStr !== '' ? addressStr : (prev?.address || ''),
                  deliveryAddress: deliveryAddr,
                  shippingAddress: data.shippingAddress || deliveryAddr,
                  orders: data.orders || prev?.orders || []
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
            setUser(prev => prev ? { ...prev, orders: dbOrders } : null);
          }
        } catch (e) {
          console.warn('Notice: Firestore data sync operated in offline cache mode:', e);
        }
      } else {
        const cached = localStorage.getItem('melody_user_profile') || localStorage.getItem('marts_user_profile');
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch {}
        }
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

  const showToast = (message: string, type: 'cart' | 'wishlist' = 'cart', item?: CartItem | Product | null) => {
    setNotification({ show: true, message, type, item });
    setTimeout(() => setNotification(null), 3500);
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i);
      return [...prev, item];
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
    setUser(null);
    setCart([]);
    setWishlist([]);
  };

  const handleAddOrder = async (order: Order) => {
    const currentFirebaseUser = auth.currentUser;
    const uid = currentFirebaseUser ? currentFirebaseUser.uid : null;

    if (user) {
      const updatedOrders = [order, ...(user.orders || [])];
      setUser({ ...user, orders: updatedOrders });
    }

    await saveOrderToFirestore(uid, order, {
      name: order.customerName || user?.name || '',
      phone: order.customerPhone || user?.phone || '',
      email: order.customerEmail || user?.email || '',
      address: order.customerAddress || user?.address || ''
    });
  };

  const handleUpdateOrders = async (updatedOrders: Order[]) => {
    if (user) {
      setUser({ ...user, orders: updatedOrders });
      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser) {
        try {
          await updateDoc(doc(db, 'users', currentFirebaseUser.uid), {
            orders: updatedOrders
          });
        } catch (e) {
          console.warn('Notice: Firestore order update operated offline:', e);
        }
      }
    }
  };

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      const isRemoving = prev.includes(productId);
      if (!isRemoving) {
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) showToast(`${product.name} added to wishlist!`, 'wishlist', product);
      }
      return isRemoving ? prev.filter(id => id !== productId) : [...prev, productId];
    });
  };

  const cartTotalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Router>
      <InitialRedirectHandler />
      <div className="min-h-screen w-full flex flex-col bg-white">
        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Home user={user} onAddToCart={addToCart} wishlist={wishlist} onToggleWishlist={toggleWishlist} cartCount={cartTotalQuantity} />} />
            <Route path="/products" element={<AllProducts user={user} cartCount={cartTotalQuantity} onAddToCart={addToCart} wishlist={wishlist} onToggleWishlist={toggleWishlist} />} />
            <Route path="/product/:id" element={<ProductDetail user={user} cartCount={cartTotalQuantity} onAddToCart={addToCart} wishlist={wishlist} onToggleWishlist={toggleWishlist} />} />
            <Route path="/cart" element={<Cart cart={cart} setCart={setCart} user={user} />} />
            <Route
              path="/wishlist"
              element={
                <Wishlist
                  user={user}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  onRemoveFromWishlist={(id) => {
                    setWishlist(prev => prev.filter(item => item !== id));
                    const p = PRODUCTS.find(prod => prod.id === id);
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
                />
              }
            />
            <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} clearCart={clearCart} user={user} onOrderSuccess={handleAddOrder} />} />
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />} />
            <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup onSignup={setUser} />} />
            <Route path="/order-success" element={<Navigate to="/orders" replace />} />
            <Route path="/account" element={<Account user={user} onLogout={handleLogout} />} />
            <Route path="/orders" element={<MyOrders user={user} onUpdateOrders={handleUpdateOrders} />} />
            
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/support" element={<HelpCenter />} />
            <Route path="/contact" element={<HelpCenter />} />
            <Route path="/about" element={<About />} />
            <Route path="/location" element={<Navigate to="/" replace />} />
            
            <Route path="/addresses" element={<AddressPage cart={cart} user={user} onUpdateUser={setUser} />} />
            <Route path="/address" element={<AddressPage cart={cart} user={user} onUpdateUser={setUser} />} />
            <Route path="/add-address" element={<AddressPage cart={cart} user={user} onUpdateUser={setUser} />} />
            <Route path="/payments" element={<ProfileSubPages type="payments" user={user} onUpdateUser={setUser} />} />
            <Route path="/profile/edit" element={<ProfileSubPages type="edit" user={user} onUpdateUser={setUser} />} />
            <Route path="/privacy-policy" element={<PolicyPage type="privacy" />} />
            <Route path="/refund-policy" element={<PolicyPage type="refunds" />} />
            <Route path="/terms-and-conditions" element={<PolicyPage type="terms" />} />
            <Route path="/shipping-policy" element={<PolicyPage type="shipping" />} />
            
            {/* Fallback route: Always redirect unknown paths to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <ConditionalFooter />
        <GlobalToastNotification notification={notification} onClose={() => setNotification(null)} />
      </div>
    </Router>
  );
};

export default App;
