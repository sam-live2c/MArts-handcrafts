import { auth, db, storage, firebaseConfig } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadString, 
  getDownloadURL 
} from 'firebase/storage';
import { Product, Order, User, CarouselBanner } from '../types';

/**
 * Backend Data Interfaces for Admin Pipeline
 */
export interface HeroBannerConfig {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  imageUrl?: string;
  active: boolean;
  shippingNote?: string;
  workspaceNote?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  role: 'admin';
  createdAt: number;
}

// Helper: Convert File, Blob, or base64 data URL into uploadable Blob/Bytes
const prepareUploadPayload = async (
  input: File | Blob | string
): Promise<{ data: Blob | Uint8Array; contentType: string }> => {
  if (typeof input === 'string') {
    // Check if base64 data URL
    if (input.startsWith('data:')) {
      const matches = input.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const byteCharacters = atob(matches[2]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return { data: byteArray, contentType };
      }
    }
    // Plain URL string or other text
    const response = await fetch(input);
    const blob = await response.blob();
    return { data: blob, contentType: blob.type || 'image/jpeg' };
  } else {
    const contentType = input.type || 'image/jpeg';
    return { data: input, contentType };
  }
};

// Clean file names to prevent injection or invalid characters
const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * ============================================================
 * 1. FIREBASE STORAGE PIPELINE (HERO & PRODUCT IMAGES)
 * ============================================================
 */

/**
 * Uploads a hero banner image to Firebase Storage and returns its public URL
 */
export const uploadHeroImage = async (
  fileOrBlob: File | Blob | string,
  customFileName?: string
): Promise<string> => {
  try {
    const { data, contentType } = await prepareUploadPayload(fileOrBlob);
    const fileName = customFileName 
      ? sanitizeFileName(customFileName) 
      : `hero_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
    
    const storageRef = ref(storage, `hero/${fileName}`);
    await uploadBytes(storageRef, data as any, {
      contentType,
      cacheControl: 'public, max-age=31536000'
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // Automatically update or merge the hero settings document with this new image URL
    await setDoc(doc(db, 'settings', 'hero'), {
      imageUrl: downloadUrl,
      updatedAt: Date.now()
    }, { merge: true });

    return downloadUrl;
  } catch (error: any) {
    console.error('Failed to upload hero image to Firebase Storage:', error);
    throw new Error(`Hero image upload failed: ${error.message || error}`);
  }
};

/**
 * Uploads a carousel banner slide image to Firebase Storage at banners/{bannerId}/{fileName}
 */
export const uploadBannerImage = async (
  bannerId: string,
  fileOrBlob: File | Blob | string,
  customFileName?: string
): Promise<string> => {
  try {
    const { data, contentType } = await prepareUploadPayload(fileOrBlob);
    const fileName = customFileName
      ? sanitizeFileName(customFileName)
      : `banner_${bannerId}_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;

    const storageRef = ref(storage, `banners/${bannerId}/${fileName}`);
    await uploadBytes(storageRef, data as any, {
      contentType,
      cacheControl: 'public, max-age=31536000'
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error: any) {
    console.error(`Failed to upload carousel banner image for ${bannerId}:`, error);
    throw new Error(`Banner image upload failed: ${error.message || error}`);
  }
};

/**
 * Uploads a product image to Firebase Storage at products/{productId}/{fileName}
 */
export const uploadProductImage = async (
  productId: string,
  fileOrBlob: File | Blob | string,
  customFileName?: string
): Promise<string> => {
  try {
    const { data, contentType } = await prepareUploadPayload(fileOrBlob);
    const fileName = customFileName
      ? sanitizeFileName(customFileName)
      : `prod_${productId}_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;

    const storageRef = ref(storage, `products/${productId}/${fileName}`);
    await uploadBytes(storageRef, data as any, {
      contentType,
      cacheControl: 'public, max-age=31536000'
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error: any) {
    console.error(`Failed to upload image for product ${productId}:`, error);
    throw new Error(`Product image upload failed: ${error.message || error}`);
  }
};

/**
 * Uploads an image and immediately updates the Product in Firestore
 */
export const addProductImageAndSave = async (
  productId: string,
  fileOrBlob: File | Blob | string,
  setAsPrimary: boolean = false
): Promise<string> => {
  const downloadUrl = await uploadProductImage(productId, fileOrBlob);
  const prodDocRef = doc(db, 'products', productId);
  const docSnap = await getDoc(prodDocRef);

  if (docSnap.exists()) {
    const prodData = docSnap.data() as Product;
    const currentImages = prodData.images || [];
    const updatedImages = currentImages.includes(downloadUrl) 
      ? currentImages 
      : [...currentImages, downloadUrl];

    await updateDoc(prodDocRef, {
      images: updatedImages,
      ...(setAsPrimary ? { image: downloadUrl } : {}),
      updatedAt: Date.now()
    });
  }
  return downloadUrl;
};

/**
 * Uploads a customer customization file (logo, QR, vector artwork) to Firebase Storage
 * under customizations/{itemId}/{fileName} and returns the permanent download URL.
 */
export const uploadCustomizationMedia = async (
  itemId: string,
  fileOrBlob: File | Blob | string,
  customFileName?: string
): Promise<string> => {
  try {
    const { data, contentType } = await prepareUploadPayload(fileOrBlob);
    const fileName = customFileName
      ? sanitizeFileName(customFileName)
      : `custom_${itemId}_${Date.now()}.${contentType.includes('pdf') ? 'pdf' : contentType.split('/')[1] || 'jpg'}`;

    const storageRef = ref(storage, `customizations/${itemId}/${fileName}`);
    await uploadBytes(storageRef, data as any, {
      contentType,
      cacheControl: 'public, max-age=31536000'
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error: any) {
    console.warn('Firebase Storage upload notice (falling back to data URL / local mode):', error);
    if (typeof fileOrBlob === 'string') return fileOrBlob;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrBlob as Blob);
    });
  }
};

/**
 * ============================================================
 * 2. HERO BANNER MANAGEMENT PIPELINE
 * ============================================================
 */

/**
 * Saves or updates the live homepage Hero Banner configuration
 */
export const saveHeroBanner = async (
  bannerConfig: Partial<HeroBannerConfig>
): Promise<void> => {
  try {
    const heroRef = doc(db, 'settings', 'hero');
    const payload = {
      ...bannerConfig,
      active: bannerConfig.active !== undefined ? bannerConfig.active : true,
      updatedAt: Date.now(),
      updatedBy: auth.currentUser?.email || 'admin'
    };
    await setDoc(heroRef, payload, { merge: true });
  } catch (error: any) {
    console.error('Failed to save hero banner in Firestore:', error);
    throw error;
  }
};

/**
 * Fetches the currently active Hero Banner configuration
 */
export const fetchHeroBanner = async (): Promise<HeroBannerConfig | null> => {
  try {
    const heroRef = doc(db, 'settings', 'hero');
    const snap = await getDoc(heroRef);
    if (snap.exists()) {
      return snap.data() as HeroBannerConfig;
    }
    return null;
  } catch (error) {
    console.warn('Hero banner fetch offline/fallback:', error);
    return null;
  }
};

/**
 * Real-time subscription to Hero Banner changes
 */
export const subscribeToHeroBanner = (
  onUpdate: (banner: HeroBannerConfig | null) => void
): (() => void) => {
  const heroRef = doc(db, 'settings', 'hero');
  return onSnapshot(
    heroRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as HeroBannerConfig);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Hero banner subscription error:', err);
    }
  );
};

/**
 * Saves or updates a carousel banner in Firestore /banners/{bannerId}
 */
export const saveCarouselBanner = async (banner: CarouselBanner): Promise<void> => {
  try {
    const bannerRef = doc(db, 'banners', banner.id);
    await setDoc(bannerRef, {
      ...banner,
      active: banner.active !== undefined ? banner.active : true,
      updatedAt: Date.now(),
      updatedBy: auth.currentUser?.email || 'admin'
    }, { merge: true });
  } catch (error: any) {
    console.error(`Failed to save carousel banner ${banner.id}:`, error);
    throw error;
  }
};

/**
 * Deletes a carousel banner from Firestore /banners/{bannerId}
 */
export const deleteCarouselBanner = async (bannerId: string): Promise<void> => {
  try {
    const bannerRef = doc(db, 'banners', bannerId);
    await deleteDoc(bannerRef);
  } catch (error: any) {
    console.error(`Failed to delete carousel banner ${bannerId}:`, error);
    throw error;
  }
};

/**
 * Fetches all carousel banners from Firestore
 */
export const fetchCarouselBanners = async (): Promise<CarouselBanner[]> => {
  try {
    const bannersCol = collection(db, 'banners');
    const snap = await getDocs(bannersCol);
    const list: CarouselBanner[] = [];
    snap.forEach((d) => list.push(d.data() as CarouselBanner));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.warn('Carousel banners fetch notice:', error);
    return [];
  }
};

/**
 * Real-time subscription to carousel banners in /banners
 */
export const subscribeToCarouselBanners = (
  onUpdate: (banners: CarouselBanner[]) => void
): (() => void) => {
  const bannersCol = collection(db, 'banners');
  return onSnapshot(
    bannersCol,
    (snap) => {
      const list: CarouselBanner[] = [];
      snap.forEach((d) => list.push(d.data() as CarouselBanner));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      onUpdate(list);
    },
    (err) => {
      console.warn('Carousel banners subscription notice:', err);
    }
  );
};

/**
 * ============================================================
 * 3. PRODUCT INVENTORY MANAGEMENT PIPELINE
 * ============================================================
 */

/**
 * Saves, creates, or updates a product in Firestore /products/{productId}
 */
export const saveProductToFirestore = async (product: Product): Promise<void> => {
  try {
    const prodRef = doc(db, 'products', product.id);
    await setDoc(prodRef, {
      ...product,
      updatedAt: Date.now(),
      updatedBy: auth.currentUser?.email || 'admin'
    }, { merge: true });
  } catch (error: any) {
    console.error('Failed to save product in Firestore:', error);
    throw error;
  }
};

/**
 * Deletes a product from Firestore /products/{productId}
 */
export const deleteProductFromFirestore = async (productId: string): Promise<void> => {
  try {
    const prodRef = doc(db, 'products', productId);
    await deleteDoc(prodRef);
  } catch (error: any) {
    console.error(`Failed to delete product ${productId}:`, error);
    throw error;
  }
};

/**
 * Fetches all products directly from Firestore
 */
export const fetchProductsAdmin = async (): Promise<Product[]> => {
  try {
    const prodCol = collection(db, 'products');
    const snap = await getDocs(prodCol);
    const list: Product[] = [];
    snap.forEach((d) => list.push(d.data() as Product));
    return list;
  } catch (error) {
    console.error('Failed to fetch admin products:', error);
    return [];
  }
};

/**
 * Real-time subscription to the entire products catalog
 */
export const subscribeToProductsAdmin = (
  onUpdate: (products: Product[]) => void
): (() => void) => {
  const prodCol = collection(db, 'products');
  return onSnapshot(
    prodCol,
    (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push(d.data() as Product));
      onUpdate(list);
    },
    (err) => {
      console.warn('Products subscription error:', err);
    }
  );
};

/**
 * ============================================================
 * 4. ADMIN ORDERS PIPELINE
 * ============================================================
 */

/**
 * Fetches all orders across all users for admin review and fulfillment
 */
export const fetchAllOrdersAdmin = async (): Promise<Order[]> => {
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const orders: Order[] = [];
    snap.forEach((d) => orders.push(d.data() as Order));
    return orders;
  } catch (error) {
    console.error('Failed to fetch all orders for admin:', error);
    return [];
  }
};

/**
 * Calculates or retrieves the standardized pricing breakdown for an order
 */
export const getOrderPricingBreakdown = (order: Order) => {
  if (order.pricing) {
    return order.pricing;
  }
  const safeItems = Array.isArray(order.items) ? order.items : [];
  const mrp = order.mrp !== undefined ? order.mrp : safeItems.reduce((acc, item) => {
    const itemMrp = item.oldPrice && Number(item.oldPrice) > Number(item.price) 
      ? Number(item.oldPrice) 
      : Number(item.price || 0);
    return acc + (itemMrp * (Number(item.quantity) || 1));
  }, 0);
  const subtotal = order.subtotal !== undefined ? order.subtotal : safeItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  const discount = order.discount !== undefined ? order.discount : Math.max(0, mrp - subtotal);
  const customizationFee = order.customizationFee !== undefined ? order.customizationFee : 0;
  const deliveryFee = order.deliveryFee !== undefined ? order.deliveryFee : 0;
  const total = order.total || (subtotal + customizationFee + deliveryFee);

  return {
    mrp,
    subtotal,
    discount,
    savings: discount,
    customizationFee,
    deliveryFee,
    total
  };
};

/**
 * Updates order fulfillment status (e.g. Processing -> Shipped -> Delivered)
 * Maintains exact status tracking timeline, status history audit trail, and pricing consistency.
 */
export const updateOrderStatusAdmin = async (
  orderId: string,
  userId: string,
  newStatus: Order['status'],
  note?: string
): Promise<void> => {
  try {
    const globalOrderRef = doc(db, 'orders', orderId);
    const snap = await getDoc(globalOrderRef);
    const existingOrder = snap.exists() ? (snap.data() as Order) : null;

    const now = Date.now();
    const isDelivered = newStatus === 'Delivered';
    const isShipped = newStatus === 'Shipped' || isDelivered;
    const isProcessing = newStatus !== 'Cancelled' && newStatus !== 'Failed';

    let updatedTracking = existingOrder?.tracking;
    if (updatedTracking && Array.isArray(updatedTracking.steps)) {
      updatedTracking = {
        currentStatus: newStatus,
        updatedAt: now,
        steps: updatedTracking.steps.map(step => {
          if (step.status === 'Placed') return { ...step, completed: true };
          if (step.status === 'Processing') return { ...step, completed: isProcessing };
          if (step.status === 'Shipped') {
            return {
              ...step,
              completed: isShipped,
              timestamp: isShipped ? (step.timestamp || now) : null
            };
          }
          if (step.status === 'Delivered') {
            return {
              ...step,
              completed: isDelivered,
              timestamp: isDelivered ? (step.timestamp || now) : null
            };
          }
          return step;
        })
      };
    } else {
      updatedTracking = {
        currentStatus: newStatus,
        updatedAt: now,
        steps: [
          { status: 'Placed', label: 'Order Confirmed', completed: true, timestamp: existingOrder?.createdAt || now },
          { status: 'Processing', label: 'Processing & Kiln Quality Check', completed: isProcessing, timestamp: existingOrder?.createdAt || now },
          { status: 'Shipped', label: 'Dispatched in Insured Timber Crate', completed: isShipped, timestamp: isShipped ? now : null },
          { status: 'Delivered', label: 'Delivered to Doorstep', completed: isDelivered, timestamp: isDelivered ? now : null }
        ]
      };
    }

    const existingHistory = Array.isArray(existingOrder?.statusHistory) ? existingOrder.statusHistory : [];
    const updatedHistory = [
      ...existingHistory,
      {
        status: newStatus,
        timestamp: now,
        label: `Order status set to ${newStatus}`,
        note: note || `Fulfillment milestone updated by admin: ${newStatus}.`
      }
    ];

    const updateFields: Partial<Order> = {
      status: newStatus,
      updatedAt: now,
      tracking: updatedTracking,
      statusHistory: updatedHistory
    };

    await setDoc(globalOrderRef, updateFields, { merge: true });

    let targetUid = userId || existingOrder?.userId;
    if (!targetUid) {
      targetUid = snap.data()?.userId;
    }

    if (targetUid && targetUid !== 'guest') {
      const userOrderRef = doc(db, 'users', targetUid, 'orders', orderId);
      await setDoc(userOrderRef, updateFields, { merge: true });

      try {
        const userDocRef = doc(db, 'users', targetUid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (Array.isArray(uData.orders)) {
            const updatedOrders = uData.orders.map((o: Order) => o.id === orderId ? { ...o, ...updateFields } : o);
            await setDoc(userDocRef, { orders: updatedOrders, updatedAt: new Date().toISOString() }, { merge: true });
          }
        }
      } catch (_) {}
    }
  } catch (error: any) {
    console.error(`Failed to update status for order ${orderId}:`, error);
    throw error;
  }
};

/**
 * Real-time subscription to incoming orders
 */
export const subscribeToOrdersAdmin = (
  onUpdate: (orders: Order[]) => void
): (() => void) => {
  const ordersCol = collection(db, 'orders');
  const q = query(ordersCol, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const orders: Order[] = [];
      snap.forEach((d) => orders.push(d.data() as Order));
      onUpdate(orders);
    },
    (err) => {
      console.warn('Orders subscription error:', err);
    }
  );
};

/**
 * ============================================================
 * 5. ADMIN AUTHENTICATION & ROLE VERIFICATION
 * ============================================================
 */

/**
 * Verifies if the specified user is an authorized admin
 */
export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  try {
    // Check admins collection
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    if (adminDoc.exists()) return true;

    // Check user profile role field
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists() && userDoc.data()?.role === 'admin') return true;

    // Bootstrap check for admin email
    const currentEmail = auth.currentUser?.email;
    if (
      currentEmail === 'sahanurmolla190@gmail.com' ||
      currentEmail === 'ventureforge.corp@gmail.com' ||
      currentEmail === 'xsophiya99@gmail.com' ||
      currentEmail === 'sahanurmolla3131@gmail.com' ||
      currentEmail === 'sahanurmolla2886@gmail.com' ||
      currentEmail === 'prople.org@gmail.com'
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Admin check error:', error);
    return false;
  }
};

/**
 * Grants admin role to a target user
 */
export const grantAdminRole = async (targetUid: string, email: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'admins', targetUid), {
      uid: targetUid,
      email,
      role: 'admin',
      createdAt: Date.now()
    });
    await setDoc(doc(db, 'users', targetUid), {
      role: 'admin',
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error: any) {
    console.error('Failed to grant admin role:', error);
    throw error;
  }
};

export { firebaseConfig };
