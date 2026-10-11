import React, { useState, useEffect } from 'react';
import { CartItem, User, CustomizationFile, ItemCustomization } from '../types';
import { X, Info, Plus, Minus, ArrowLeft, ArrowDown, Package, ShieldCheck, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { auth } from '../firebase';
import { fetchUserAddresses } from '../services/dbService';
import { CustomizationModal } from '../components/CustomizationModal';
import { FullScreenCircleLoader } from '../components/CircleLoader';

interface CartProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  user?: User | null;
}

// In-memory cache for Cart page
let isCartLoadedCache = false;

const Cart: React.FC<CartProps> = ({ cart, setCart, user }) => {
  const navigate = useNavigate();
  
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => !isCartLoadedCache);
  const [addressInfo, setAddressInfo] = useState<{ name?: string; phone?: string; formatted?: string }>({
    name: user?.name || '',
    phone: user?.phone || '',
    formatted: localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || user?.address || ''
  });

  // Customization state (synchronized with localStorage)
  const [customizations, setCustomizations] = useState<Record<string, ItemCustomization>>(() => {
    try {
      const saved = localStorage.getItem('melody_customizations_cache');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return {};
  });
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [activeCustomizationItemId, setActiveCustomizationItemId] = useState<string | null>(null);

  const openCustomizationModal = (itemId: string) => {
    setActiveCustomizationItemId(itemId);
    setIsCustomizationModalOpen(true);
  };

  const handleConfirmCustomization = (itemId: string, files: CustomizationFile[]) => {
    const updated: ItemCustomization = {
      files,
      confirmed: true
    };
    setCustomizations(prev => {
      const next = { ...prev, [itemId]: updated };
      try {
        localStorage.setItem('melody_customizations_cache', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          customization: updated
        };
      }
      return item;
    }));
  };

  useEffect(() => {
    if (!isCartLoadedCache) {
      const timer = setTimeout(() => {
        isCartLoadedCache = true;
        setIsLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const loadAddress = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const addresses = await fetchUserAddresses(currentUser.uid);
          if (addresses.length > 0) {
            const def = addresses.find(a => a.isDefault) || addresses[0];
            const formatted = `${def.houseNo}, ${def.area ? def.area + ', ' : ''}${def.city}, ${def.state} - ${def.pincode}`;
            setAddressInfo({
              name: def.name || user?.name || '',
              phone: def.phone || user?.phone || '',
              formatted
            });
            localStorage.setItem('melody_user_address', formatted);
            localStorage.setItem('agronic_user_address', formatted);
            return;
          }
        } catch (e) {
          console.error('Error loading address for cart:', e);
        }
      }
      const local = localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address');
      if (local) {
        setAddressInfo(prev => ({ ...prev, formatted: local }));
      } else if (user?.address) {
        setAddressInfo(prev => ({ ...prev, formatted: user.address }));
      }
    };
    loadAddress();
  }, [user]);

  const handlePlaceOrder = () => {
    if (!user) {
      navigate('/login?redirect=checkout');
      return;
    }
    const savedAddr = localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || user?.address;
    if (!savedAddr || savedAddr.trim() === '') {
      navigate('/address?redirect=checkout');
      return;
    }
    navigate('/checkout');
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setIsUpdating(id);
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
    setTimeout(() => setIsUpdating(null), 200);
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.oldPrice || item.price) * item.quantity, 0);
  const currentTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalSavings = subtotal - currentTotal;
  const delivery = 0;
  const finalAmount = currentTotal + delivery;

  if (isLoading) {
    return <FullScreenCircleLoader />;
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto shadow-sm pb-16 md:pb-6">
        
        {/* Page Header - Matches Profile styling */}
        <div className="bg-white py-3 sm:py-3.5 px-4 sm:px-8 lg:px-12 flex items-center gap-4 sticky top-0 z-[100] border-b border-gray-100 shadow-xs min-h-[56px] sm:min-h-[64px]">
          <button 
            type="button"
            onClick={() => handleGoBack(navigate, '/')} 
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-800 transition-colors cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">My Cart</h1>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 pb-20 md:pb-6">
          
          {/* Deliver to address subheader - Clean border divider like Profile & Checkout */}
          <div className="pb-4 mb-4 border-b border-gray-100 flex justify-between items-start">
             <div className="pr-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Deliver to:</p>
                <p className="text-base font-semibold text-gray-900">
                  {addressInfo.name || user?.name || user?.email || 'Delivery Address'}
                  {addressInfo.phone && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      {addressInfo.phone.startsWith('+') ? addressInfo.phone : `+91 ${addressInfo.phone}`}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed mt-0.5 max-w-xl">
                  {addressInfo.formatted || 'Select delivery location'}
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

          {cart.length === 0 ? (
             <div className="py-16 text-center my-4">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                 <Package size={28} className="text-gray-400" />
               </div>
               <h3 className="text-base font-bold text-gray-900">Your Cart is Empty</h3>
               <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                 Looks like you haven't added any items to your cart yet.
               </p>
               <button
                 type="button"
                 onClick={() => navigate('/')}
                 className="mt-5 bg-[#C85A32] hover:bg-[#A04724] text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer shadow-md inline-flex items-center justify-center"
               >
                 Start Shopping
               </button>
             </div>
           ) : (
            <div className="w-full">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Products List - clean divide-y without outer rounded card outline */}
                <div className="flex-1 w-full divide-y divide-gray-100">
                  {cart.map(item => (
                    <div key={item.id} className="py-5 sm:py-6 first:pt-0 last:pb-0 relative">
                       <div className={`flex gap-4 sm:gap-5 transition-opacity ${isUpdating === item.id ? 'opacity-50' : ''}`}>
                          {/* Left Image */}
                          <div className="w-[90px] sm:w-[100px] shrink-0 flex flex-col items-center">
                             <div className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] bg-[#FAF7F2] border border-[#EADBCC]/60 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                                <img 
                                  src={item.image} 
                                  referrerPolicy="no-referrer" 
                                  className="w-full h-full object-contain" 
                                  alt={item.name} 
                                />
                             </div>
                          </div>
                          
                          {/* Right Info */}
                          <div className="flex-1 relative pr-6">
                             <button 
                               type="button"
                               onClick={() => removeItem(item.id)}
                               className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                               title="Remove from cart"
                               aria-label="Remove item"
                             >
                               <X size={16} />
                             </button>

                             <h3 className="text-[16px] font-semibold text-gray-900 line-clamp-1 leading-tight mb-1">{item.name}</h3>
                             <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-1 truncate">{item.category}</p>
                             
                             <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                {item.oldPrice && item.oldPrice > item.price && (
                                  <>
                                    <span className="text-[#C85A32] font-bold text-[13px] flex items-center tracking-tight">
                                      <ArrowDown size={14} strokeWidth={2.5} />
                                      {Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)}%
                                    </span>
                                    <del className="text-gray-400 text-sm font-normal" aria-label="Maximum retail price">₹{(item.oldPrice * item.quantity).toLocaleString()}</del>
                                  </>
                                )}
                                <span className="text-[19px] font-semibold text-gray-900 leading-none">₹{(item.price * item.quantity).toLocaleString()}</span>
                             </div>

                             <div className="mt-2 text-[13px] text-gray-600">
                                Free delivery on this order
                             </div>

                             {/* Quantity Selector and Customise Button Strictly SIDE BY SIDE */}
                             <div className="mt-3 flex items-center gap-2 sm:gap-3 flex-nowrap">
                                {/* Quantity Selector */}
                                <div className="flex items-center rounded-lg bg-gray-100 overflow-hidden h-8 shrink-0">
                                   <button 
                                     type="button"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       updateQuantity(item.id, Math.max(1, item.quantity - 1));
                                     }}
                                     className="w-7 sm:w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 active:bg-gray-300 transition-colors cursor-pointer border-0 shrink-0"
                                     aria-label="Decrease quantity"
                                   >
                                     <Minus size={13} />
                                   </button>
                                   <span className="w-7 sm:w-8 text-center font-bold text-xs text-gray-800 shrink-0 select-none">{item.quantity}</span>
                                   <button 
                                     type="button"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       updateQuantity(item.id, item.quantity + 1);
                                     }}
                                     className="w-7 sm:w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 active:bg-gray-300 transition-colors cursor-pointer border-0 shrink-0"
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

                {/* Price Details - Clean layout with left border on desktop matching Checkout */}
                <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l lg:border-gray-100 pt-6 lg:pt-0 lg:pl-8 lg:sticky lg:top-[80px]">
                   <h3 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100">Price Details</h3>
                   <div className="space-y-3 pt-3 text-sm text-gray-700">
                     <div className="flex justify-between">
                       <span>MRP ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                       <span>₹{subtotal.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Discount</span>
                       <span className="text-[#C85A32] font-medium">
                         {totalSavings > 0 ? `- ₹${totalSavings.toLocaleString()}` : '- ₹0'}
                       </span>
                     </div>
                     <div className="flex justify-between">
                       <span>Delivery</span>
                       <span className="text-[#C85A32] font-medium">{delivery === 0 ? 'Free' : `₹${delivery}`}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>18% GST</span>
                       <span>Included</span>
                     </div>

                     <div className="flex justify-between font-bold text-gray-900 text-base pt-3 mt-1 border-t border-gray-100">
                       <span>Total price</span>
                       <span>₹{finalAmount.toLocaleString()}</span>
                     </div>
                   </div>
                </div>
              </div>

              {/* Desktop Bottom Action Row - Placed at the right matching payment page pay button */}
              <div className="hidden md:flex py-4 border-t border-gray-100 items-center justify-between gap-4 mt-6">
                 <div className="flex items-center gap-2 text-xs text-gray-500">
                    <ShieldCheck size={16} className="text-[#C85A32] shrink-0" />
                    <span>Safe and Secure Checkout • 100% Authentic Products</span>
                 </div>
                 <div>
                    <button 
                      type="button"
                      onClick={handlePlaceOrder} 
                      className="bg-[#C85A32] hover:bg-[#A04724] text-white font-bold px-8 h-12 rounded-xl text-[16px] w-[240px] shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                       Place Order
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Bar for Mobile cart to match styling */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 w-full bg-white px-4 sm:px-8 lg:px-12 h-[62px] flex items-center justify-between z-[100] md:hidden shadow-lg border-t border-gray-100">
             <div className="flex flex-col">
                {subtotal > finalAmount && (
                  <span className="text-[11px] text-gray-500 line-through leading-tight">₹{subtotal.toLocaleString()}</span>
                )}
                <div className="flex items-center gap-1 leading-none">
                   <span className="text-lg font-bold text-gray-900">₹{finalAmount.toLocaleString()}</span>
                   <Info size={13} className="text-gray-400 mb-0.5" />
                </div>
             </div>
             <button onClick={handlePlaceOrder} className="bg-[#C85A32] hover:bg-[#A04724] text-white px-6 h-11 w-[170px] rounded-xl font-bold text-[15px] flex items-center justify-center shadow-md cursor-pointer">
                Place Order
             </button>
          </div>
        )}

        {/* Customization Modal */}
        <CustomizationModal
          isOpen={isCustomizationModalOpen}
          itemId={activeCustomizationItemId}
          initialFiles={activeCustomizationItemId ? customizations[activeCustomizationItemId]?.files : []}
          onClose={() => setIsCustomizationModalOpen(false)}
          onConfirm={handleConfirmCustomization}
        />
      </div>
    </div>
  );
};

export default Cart;
