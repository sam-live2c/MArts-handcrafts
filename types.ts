
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

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Failed';
  paymentId?: string;
  paymentMethod?: string;
}
