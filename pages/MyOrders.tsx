import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { 
  ArrowLeft, Search, MoreVertical, X, Package, 
  AlertCircle, Headphones, CheckCircle2, Download, HelpCircle, Check,
  ChevronRight, Truck, XCircle
} from 'lucide-react';
import { User, Order, CartItem } from '../types';
import { auth } from '../firebase';
import { updateOrderStatusInFirestore } from '../services/dbService';
import { OrderHistorySkeleton } from '../components/Skeleton';

interface MyOrdersProps {
  user: User | null;
  onUpdateOrders: (orders: Order[]) => void;
}

// In-memory cache for MyOrders page
let isOrdersLoadedCache = false;

const MyOrders: React.FC<MyOrdersProps> = ({ user, onUpdateOrders }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [toast, setToast] = useState<{
    type: 'success' | 'failed' | 'info';
    title: string;
    message?: string;
  } | null>(null);

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

    // Persist immediately in localStorage
    try {
      localStorage.setItem('melody_orders', JSON.stringify(updated));
      const currentUser = auth.currentUser;
      if (currentUser) {
        localStorage.setItem(`melody_orders_${currentUser.uid}`, JSON.stringify(updated));
      }
      const savedProfile = localStorage.getItem('melody_user_profile') || localStorage.getItem('marts_user_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        parsed.orders = updated;
        localStorage.setItem('melody_user_profile', JSON.stringify(parsed));
        localStorage.setItem('marts_user_profile', JSON.stringify(parsed));
      }
    } catch (e) {
      console.warn('Local order persistence notice:', e);
    }

    const currentUser = auth.currentUser;
    await updateOrderStatusInFirestore(currentUser ? currentUser.uid : null, orderId, 'Cancelled');
    showToast('Order Cancelled', 'You will get your refund after verification under 24 hours.', 'success', 5000);
  };


  const handleDownloadReceipt = (order: Order, specificItem?: CartItem) => {
    setActiveMenuOrderId(null);

    const isItemSpecific = !!specificItem;
    const items = isItemSpecific ? [specificItem] : order.items;

    const mrp = items.reduce((acc, item) => acc + ((item.oldPrice || item.price) * item.quantity), 0);
    const itemsTotal = isItemSpecific 
      ? (specificItem.price * specificItem.quantity) 
      : order.total;
    const discount = Math.max(0, mrp - itemsTotal);

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
      ? `TAX INVOICE / PRODUCT RECEIPT`
      : `TAX INVOICE & ORDER RECEIPT`;

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
        <div class="brand-title">MArts</div>
        <div class="brand-subtitle">Handcrafted Pottery & Statues • Heritage Atelier</div>
        <div class="brand-subtitle">GSTIN: 19AAECM9841B1Z3 • support@marts.crafts</div>
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
        <div class="totals-row">
          <span>GST (18%)</span>
          <span>Included</span>
        </div>
        <div class="totals-row bold">
          <span>Total Net Amount</span>
          <span>₹${itemsTotal.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>This is a computer-generated tax invoice and delivery receipt issued by MArts Handcrafts.</div>
      <div>Thank you for honoring traditional pottery kilns, stone carving ateliers, and heritage craft traditions!</div>
      <div style="margin-top: 6px; font-size: 11px; color: #999;">For replacement or damage claims, please contact support@marts.crafts within 48 hours of delivery.</div>
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

  // Filter logic
  const filteredOrders = currentOrders.filter(ord => {
    // Search query filter
    const matchesSearch = searchQuery.trim() === '' || 
      ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
    <div className="w-full bg-gray-50 min-h-screen font-sans relative">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-7xl mx-auto shadow-sm pb-24 md:pb-8">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 shadow-xs px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center justify-between sticky top-0 z-[100]">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => handleGoBack(navigate, '/account')} 
              className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">My Orders</h1>
          </div>
        </div>

        {/* Search bar */}
        <div className="w-full bg-transparent pt-4 sm:pt-5 pb-3 px-3 sm:px-8 lg:px-12">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center bg-transparent rounded-full border border-[#E5D7CA] focus-within:border-[#C85A32] focus-within:ring-2 focus-within:ring-[#C85A32]/20 shadow-xs hover:border-[#D5C2B2] transition-all">
              <Search
                size={18}
                className="absolute left-4 text-[#8C6D58] pointer-events-none shrink-0"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID or Product name..."
                className="w-full pl-11 pr-11 py-2.5 sm:py-3 bg-transparent rounded-full text-xs sm:text-sm text-[#2B221B] placeholder-[#8C6D58]/80 outline-none font-medium"
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
                      ? 'bg-[#C85A32] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List or OrderHistorySkeleton on load/refresh */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 pb-28 md:pb-8">
          {isLoading ? (
            <OrderHistorySkeleton />
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center my-2">
              <Package size={48} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No orders found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                {searchQuery ? `No orders matching "${searchQuery}"` : 'You have not placed any orders in this category yet.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-5 bg-[#C85A32] text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-[#A04724] active:bg-[#8C3F1E] transition-colors cursor-pointer shadow-sm"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((order, orderIdx) => {
                const statusLower = (order.status || 'processing').toLowerCase();
                const isDelivered = statusLower === 'delivered';
                const isCancelled = statusLower === 'cancelled';
                const isProcessing = statusLower === 'processing';
                const isShipped = statusLower === 'shipped';
                const isFailed = statusLower === 'failed';
                const isActiveOrder = isProcessing || isShipped;
                const isMenuOpen = activeMenuOrderId === order.id;

                const mrp = order.items.reduce((acc, item) => acc + ((item.oldPrice || (item.price + 10)) * item.quantity), 0);
                const discount = Math.max(0, mrp - order.total);

                const deliveryDateText = isDelivered
                  ? `Delivered on ${order.date}`
                  : isCancelled
                  ? `Cancelled on ${order.date}`
                  : isFailed
                  ? `Payment Failed on ${order.date}`
                  : isShipped
                  ? `Shipped on ${order.date}`
                  : `Delivery by ${order.date === 'Aug 09, 2026' ? 'Aug 12, Wed' : 'Aug 14, Fri'}`;

                return (
                  <div key={`${order.id}-${orderIdx}`} className="py-5 first:pt-1 last:pb-1 space-y-4">
                    {/* Order Subheader */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">Order #{order.id}</span>
                          {isDelivered && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[11px] font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Delivered
                            </span>
                          )}
                          {isProcessing && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              Processing
                            </span>
                          )}
                          {isShipped && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-300 text-[11px] font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <Truck size={12} /> Shipped
                            </span>
                          )}
                          {isCancelled && (
                            <span className="bg-red-50 text-red-700 border border-red-300 text-[11px] font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <XCircle size={12} strokeWidth={2.5} /> Cancelled
                            </span>
                          )}
                          {isFailed && (
                            <span className="bg-red-50 text-red-700 border border-red-300 text-[11px] font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <AlertCircle size={12} strokeWidth={2.5} /> Failed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Placed on {order.date}</p>
                      </div>

                      {/* Single Menu Button - Positioned on right side aligned with profile back button reference */}
                      <div className="relative shrink-0 -mr-1">
                        <button
                          type="button"
                          onClick={() => setActiveMenuOrderId(isMenuOpen ? null : order.id)}
                          className="p-1 hover:bg-gray-100 rounded-full text-gray-800 transition-colors cursor-pointer shrink-0"
                          aria-label="Order Options"
                        >
                          <MoreVertical size={20} />
                        </button>

                        {/* Dropdown Menu: strictly Download receipt & Cancel order */}
                        {isMenuOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActiveMenuOrderId(null)} 
                            />
                            <div className="absolute right-0 top-9 sm:top-10 z-50 w-[170px] bg-white border border-gray-200 rounded-lg py-1 shadow-lg animate-in fade-in duration-100">
                              <button
                                type="button"
                                onClick={() => handleDownloadReceipt(order)}
                                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
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
                                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-between gap-1.5 transition-colors cursor-pointer border-t border-gray-100"
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

                    {/* Products List - Clickable product card to view product details */}
                    <div className="divide-y divide-gray-100">
                      {order.items.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => navigate(item.id ? `/product/${item.id}` : '/')}
                          className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-gray-50/70 p-2 -mx-2 rounded-xl transition-colors group"
                          title="Click to view product details"
                        >
                          <div className="flex gap-3 sm:gap-4 items-start min-w-0 flex-1">
                            <div className="w-[76px] h-[76px] bg-white border border-gray-100 rounded-sm p-1.5 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-102 transition-transform">
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
                              <h4 className="text-[15px] font-medium text-gray-900 group-hover:text-[#C85A32] transition-colors line-clamp-1 leading-tight mb-1">
                                {item.name}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Qty: <strong className="text-gray-800">{item.quantity}</strong></span>
                                <span>•</span>
                                <span className="font-semibold text-gray-900">₹{(item.price * item.quantity).toLocaleString()}</span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                {isDelivered ? (
                                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 size={13} strokeWidth={2.5} />
                                    Delivered on {order.date}
                                  </span>
                                ) : isCancelled ? (
                                  <span className="font-semibold text-red-600 flex items-center gap-1">
                                    <XCircle size={13} strokeWidth={2.5} />
                                    Cancelled on {order.date}
                                  </span>
                                ) : isFailed ? (
                                  <span className="font-semibold text-red-600 flex items-center gap-1">
                                    <AlertCircle size={13} strokeWidth={2.5} />
                                    Payment Failed on {order.date}
                                  </span>
                                ) : isShipped ? (
                                  <span className="font-semibold text-blue-700 flex items-center gap-1">
                                    <Truck size={13} />
                                    Shipped • On the way
                                  </span>
                                ) : (
                                  <>
                                    Delivery by <span className="font-semibold text-gray-900">{deliveryDateText.replace('Delivery by ', '')}</span>
                                  </>
                                )}
                              </div>
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
                        <span className="text-[#8C3F1E] font-medium">
                          {discount > 0 ? `- ₹${discount.toLocaleString()}` : '- ₹0'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery</span>
                        <span className="text-[#8C3F1E] font-medium">Free</span>
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

