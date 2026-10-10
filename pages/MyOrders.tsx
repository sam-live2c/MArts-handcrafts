import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { 
  ArrowLeft, Search, MoreVertical, X, Package, 
  AlertCircle, Headphones, CheckCircle2, Download, HelpCircle, Check
} from 'lucide-react';
import { User, Order } from '../types';
import { PRODUCTS } from '../constants';
import { OrderHistorySkeleton } from '../components/Skeleton';
import { auth } from '../firebase';
import { updateOrderStatusInFirestore } from '../services/dbService';

interface MyOrdersProps {
  user: User | null;
  onUpdateOrders: (orders: Order[]) => void;
}

const MyOrders: React.FC<MyOrdersProps> = ({ user, onUpdateOrders }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'failed' | 'info';
    title: string;
    message?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const state = location.state as {
      paymentStatus?: 'success' | 'failed';
      orderId?: string;
      paymentId?: string;
      paymentMethod?: string;
      message?: string;
      error?: string;
    } | null;

    if (state?.paymentStatus === 'success') {
      setToast({
        type: 'success',
        title: 'Payment Successful',
        message: state.orderId ? `Order #${state.orderId} placed successfully` : (state.message || 'Your order has been placed successfully'),
      });
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    } else if (state?.paymentStatus === 'failed') {
      setToast({
        type: 'failed',
        title: 'Payment Failed',
        message: state.error || state.message || 'Your payment could not be processed',
      });
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const currentOrders: Order[] = user?.orders || [];

  const showToast = (title: string, message?: string, type: 'success' | 'failed' | 'info' = 'success', duration = 4000) => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), duration);
  };

  const handleCancelOrder = async (orderId: string) => {
    const updated = currentOrders.map(ord => 
      ord.id === orderId ? { ...ord, status: 'Cancelled' as const } : ord
    );
    onUpdateOrders(updated);
    setActiveMenuOrderId(null);
    setCancellingOrderId(null);

    const currentUser = auth.currentUser;
    await updateOrderStatusInFirestore(currentUser ? currentUser.uid : null, orderId, 'Cancelled');
    showToast('Order Cancelled', 'You will get your refund after verification under 24 hours.', 'success', 5000);
  };


  const handleDownloadReceipt = (order: Order) => {
    setActiveMenuOrderId(null);
    const mrp = order.items.reduce((acc, item) => acc + ((item.oldPrice || (item.price + 10)) * item.quantity), 0);
    const discount = Math.max(0, mrp - order.total);

    const receiptText = `========================================
MArts ORDER RECEIPT - HANDCRAFTED POTTERY & STATUES
========================================
Order ID: #${order.id}
Date Placed: ${order.date}
Payment Method: ${order.paymentMethod || 'Online Payment (UPI/Cards)'}
Transaction Ref: ${order.paymentId || 'N/A'}
Payment Status: PAID

ITEMS PURCHASED:
${order.items.map(i => ` - ${i.name} (Qty: ${i.quantity}) - ₹${(i.price * i.quantity).toLocaleString()}`).join('\n')}

PRICE DETAILS:
 MRP: ₹${mrp.toLocaleString()}
 Discount: -₹${discount.toLocaleString()}
 Delivery Charge: Free
 18% GST: Included
----------------------------------------
TOTAL PRICE PAID: ₹${order.total.toLocaleString()}
========================================
Thank you for supporting master artisans at MArts!
`;

    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Receipt downloaded for Order #${order.id}`);
  };

  // Filter logic
  const filteredOrders = currentOrders.filter(ord => {
    // Search query filter
    const matchesSearch = searchQuery.trim() === '' || 
      ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Horizontal category filter
    if (activeFilter === 'delivered') {
      return ord.status === 'Delivered';
    } else if (activeFilter === 'cancelled') {
      return ord.status === 'Cancelled';
    }
    return true;
  });

  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-5xl mx-auto shadow-sm pb-24 md:pb-8">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 shadow-xs px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center sticky top-0 z-[100]">
          {showSearchInput ? (
            <div className="flex items-center gap-2 w-full h-full">
              <button
                onClick={() => {
                  setShowSearchInput(false);
                  setSearchQuery('');
                }}
                className="p-1 -ml-0.5 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer shrink-0 flex items-center justify-center"
                aria-label="Close search"
              >
                <ArrowLeft size={22} />
              </button>
              <input
                type="text"
                value={searchQuery}
                maxLength={100}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID or Product name..."
                autoFocus
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none px-1 h-full"
              />
              {searchQuery ? (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X size={20} />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full h-full">
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => handleGoBack(navigate, '/account')} 
                  className="p-1 -ml-0.5 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer flex items-center justify-center"
                  aria-label="Go back"
                >
                  <ArrowLeft size={22} />
                </button>
                <h1 className="text-lg font-bold text-gray-900">My Orders</h1>
              </div>
              <div className="flex items-center gap-1.5 relative">
                <button
                  type="button"
                  onClick={() => setShowSearchInput(true)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-700 transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Search orders"
                >
                  <Search size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-700 transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="More options"
                >
                  <MoreVertical size={22} />
                </button>

                {showHeaderMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowHeaderMenu(false)} 
                    />
                    <div className="absolute right-0 top-11 sm:top-12 z-50 w-[160px] bg-white border border-gray-200 rounded-lg py-1 shadow-md animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          navigate('/help');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Help & Support</span>
                        <HelpCircle size={16} className="text-[#2874f0] shrink-0" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Horizontal Filters */}
        <div className="bg-white px-4 sm:px-8 lg:px-12 py-2.5 border-b border-gray-100 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2874f0] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 pb-28 md:pb-8">
          {isLoading ? (
            <OrderHistorySkeleton count={3} />
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center my-2">
              <Package size={48} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No orders found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                {searchQuery ? `No orders matching "${searchQuery}"` : 'You have not placed any orders in this category yet.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-5 bg-blue-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer shadow-sm"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((order, orderIdx) => {
                const isActiveOrder = order.status === 'Processing' || order.status === 'Shipped';
                const isMenuOpen = activeMenuOrderId === order.id;

                const mrp = order.items.reduce((acc, item) => acc + ((item.oldPrice || (item.price + 10)) * item.quantity), 0);
                const discount = Math.max(0, mrp - order.total);

                const isCancelled = order.status === 'Cancelled';
                const isFailed = order.status === 'Failed';

                const deliveryDateText = order.status === 'Delivered'
                  ? `Delivered on ${order.date}`
                  : isCancelled
                  ? `Cancelled on ${order.date}`
                  : isFailed
                  ? `Payment Failed on ${order.date}`
                  : `Delivery by ${order.date === 'Aug 09, 2026' ? 'Aug 12, Wed' : 'Aug 14, Fri'}`;

                return (
                  <div key={`${order.id}-${orderIdx}`} className="py-5 first:pt-1 last:pb-1 space-y-4">
                    {/* Order Subheader */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">Order #{order.id}</span>
                          {order.status === 'Delivered' && (
                            <span className="bg-green-50 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Delivered
                            </span>
                          )}
                          {order.status === 'Processing' && (
                            <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              Processing
                            </span>
                          )}
                          {order.status === 'Shipped' && (
                            <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              Shipped
                            </span>
                          )}
                          {order.status === 'Cancelled' && (
                            <span className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              Cancelled
                            </span>
                          )}
                          {order.status === 'Failed' && (
                            <span className="bg-red-50 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                              Failed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Placed on {order.date}</p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(order)}
                          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Download size={13} />
                          <span>Receipt</span>
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuOrderId(isMenuOpen ? null : order.id)}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-600 transition-colors cursor-pointer"
                            aria-label="Order Options"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setActiveMenuOrderId(null)} 
                              />
                              <div className="absolute right-0 top-8 z-50 w-[155px] bg-white border border-gray-200 rounded-lg py-1 shadow-md animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadReceipt(order)}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                                >
                                  <span>Download Receipt</span>
                                  <Download size={14} className="text-blue-600 shrink-0" />
                                </button>
                                {isActiveOrder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuOrderId(null);
                                      setCancellingOrderId(order.id);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <span>Cancel Order</span>
                                    <X size={14} className="shrink-0" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Products List */}
                    <div className="divide-y divide-gray-100">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0 flex gap-4 items-start">
                          <div className="w-[76px] h-[76px] bg-white border border-gray-100 rounded-sm p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain" 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[15px] font-medium text-gray-900 line-clamp-1 leading-tight mb-1">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>Qty: <strong className="text-gray-800">{item.quantity}</strong></span>
                              <span>•</span>
                              <span className="font-semibold text-gray-900">₹{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                              {deliveryDateText.startsWith('Delivery by') ? (
                                <>
                                  Delivery by <span className="font-semibold text-gray-900">{deliveryDateText.replace('Delivery by ', '')}</span>
                                </>
                              ) : (
                                <span className="font-semibold text-gray-900">{deliveryDateText}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Price Details Breakdown - Clean dividers matching Checkout */}
                    <div className="pt-3 border-t border-gray-100 space-y-2 text-xs sm:text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500">MRP ({order.items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                        <span className="text-gray-800 font-medium">₹{mrp.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Discount</span>
                        <span className="text-blue-700 font-medium">
                          {discount > 0 ? `- ₹${discount.toLocaleString()}` : '- ₹0'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery</span>
                        <span className="text-blue-700 font-medium">Free</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">18% GST</span>
                        <span className="text-gray-700">Included</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                        <span className="text-gray-500">Payment Method</span>
                        <span className="text-gray-800 font-semibold">{order.paymentMethod || 'Razorpay Online'}</span>
                      </div>
                      {order.paymentId && (
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="text-gray-500">Razorpay Ref</span>
                          <span className="text-gray-700 font-semibold">{order.paymentId}</span>
                        </div>
                      )}

                      {/* Total price row */}
                      <div className="flex items-center justify-between font-bold text-gray-900 text-sm sm:text-base pt-2.5 mt-1 border-t border-gray-100">
                        <span>Total price</span>
                        <span className="text-base sm:text-lg font-bold text-gray-900">₹{order.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle size={28} />
              <h3 className="text-base font-bold text-gray-900">Cancel Order?</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to cancel Order #{cancellingOrderId}? You will get your refund after verification under 24 hours.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCancellingOrderId(null)}
                className="flex-1 bg-gray-100 text-gray-800 py-2.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={() => handleCancelOrder(cancellingOrderId)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

