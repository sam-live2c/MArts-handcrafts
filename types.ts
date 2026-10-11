
export interface SpecificationGroup {
  title: string;
  specs: Record<string, string>;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userImage?: string;
  rating: number;
  comment: string;
  date: string;
  isVerified: boolean;
  helpfulCount: number;
  orderId?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  price: number;
  oldPrice?: number;
  discount?: string;
  rating: number;
  reviewsCount: number;
  image: string;
  images: string[];
  description: string;
  brand: string;
  brandLogo?: string;
  specGroups: SpecificationGroup[];
  highlights: string[];
  isAssured?: boolean;
  stock: number;
  sellerName: string;
  sellerRating: number;
  returnPolicy: string;
}

export interface CarouselBanner {
  id: string;
  image: string;
  fallbackImage?: string;
  title: string;
  subtitle: string;
  tag: string;
  link?: string;
  productId?: string;
  ctaText: string;
  order?: number;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface CustomizationFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image';
  previewUrl: string;
  storageUrl?: string;
  rawFile?: File;
}

export interface ItemCustomization {
  files: CustomizationFile[];
  confirmed: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  customization?: ItemCustomization | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  image: string;
}

export interface StoreDeliveryAddress {
  recipientName: string;   // Full customer / owner name
  phone: string;           // Phone number with or without +91
  street: string;          // Street / building address
  apartment?: string;      // Flat, floor, suite, or unit
  landmark?: string;       // Nearby landmark
  postalCode: string;      // 6-digit PIN code
  pin: string;             // Duplicate of postalCode for backwards compatibility
  city: string;            // City name
  state: string;           // State name
  country: string;         // Default: 'India'
  isDefault: boolean;      // true
  updatedAt: string;       // new Date().toISOString()
}

export interface User {
  uid?: string;
  id?: string;
  name: string;
  displayName?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  businessName?: string;
  avatar?: string;
  address: string;
  deliveryAddress?: StoreDeliveryAddress;
  shippingAddress?: StoreDeliveryAddress;
  orders: Order[];
  role?: 'customer' | 'admin' | string;
}

export interface OrderPricing {
  mrp: number;
  subtotal: number;
  discount: number;
  customizationFee: number;
  deliveryFee: number;
  total: number;
  savings?: number;
}

export interface OrderTrackingStep {
  status: string;
  label: string;
  completed: boolean;
  timestamp: number | null;
}

export interface OrderTracking {
  currentStatus: Order['status'];
  updatedAt: number;
  steps: OrderTrackingStep[];
}

export interface OrderStatusHistoryItem {
  status: Order['status'];
  timestamp: number;
  label?: string;
  note?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Failed';
  paymentId?: string;
  paymentMethod?: string;
  paymentStatus?: 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED' | string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  shippingAddress?: StoreDeliveryAddress | any;
  userId?: string;
  createdAt?: number;
  updatedAt?: number;
  cancelReason?: string;
  // Standardized order pricing calculations for tracking & admin panel
  mrp?: number;
  subtotal?: number;
  discount?: number;
  savings?: number;
  customizationFee?: number;
  deliveryFee?: number;
  itemCount?: number;
  pricing?: OrderPricing;
  // Standardized order status tracking for tracking & admin panel
  tracking?: OrderTracking;
  statusHistory?: OrderStatusHistoryItem[];
}
