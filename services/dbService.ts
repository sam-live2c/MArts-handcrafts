import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { CartItem, User, Order, Product, StoreDeliveryAddress } from '../types';
import { sanitizeProductRatings } from '../utils/productRating';

export type { StoreDeliveryAddress };

export interface AddressItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  pincode: string;
  houseNo: string;
  area: string;
  city: string;
  state: string;
  type: 'HOME' | 'WORK' | 'OTHER';
  isDefault?: boolean;
}

// Deduplicate a list of addresses by both unique ID and normalized location signature, enforcing strictly one default
export function deduplicateAddresses(addresses: AddressItem[]): AddressItem[] {
  if (!Array.isArray(addresses)) return [];
  const seenIds = new Set<string>();
  const seenLocations = new Set<string>();
  const result: AddressItem[] = [];

  // Sort so that addresses with real IDs ('addr_...') come before 'default', and items with real user names come before 'Customer'
  const sorted = [...addresses].filter(Boolean).sort((a, b) => {
    if (a.id === 'default' && b.id !== 'default') return 1;
    if (b.id === 'default' && a.id !== 'default') return -1;
    if (a.id === 'addr_default' && b.id !== 'addr_default') return 1;
    if (b.id === 'addr_default' && a.id !== 'addr_default') return -1;
    if (a.name?.toLowerCase() === 'customer' && b.name?.toLowerCase() !== 'customer') return 1;
    if (b.name?.toLowerCase() === 'customer' && a.name?.toLowerCase() !== 'customer') return -1;
    return 0;
  });

  for (const a of sorted) {
    if (!a || !a.id) continue;
    
    // Normalize content for duplicate signature
    const normPhone = (a.phone || '').replace(/\D/g, '').slice(-10);
    const normHouse = (a.houseNo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const normPin = (a.pincode || '').trim().toLowerCase().replace(/\s+/g, '');
    const normCity = (a.city || '').trim().toLowerCase();

    // Location key: if houseNo and pincode exist, that uniquely identifies the location!
    let locKey: string | null = null;
    if (normHouse && normPin) {
      locKey = `loc_${normHouse}_${normPin}`;
    } else if (normPhone && normHouse) {
      locKey = `loc_${normPhone}_${normHouse}`;
    } else if (normHouse && normCity) {
      locKey = `loc_${normHouse}_${normCity}`;
    } else if (normPhone && normPin) {
      locKey = `loc_${normPhone}_${normPin}`;
    }

    if (seenIds.has(a.id)) continue;
    if (locKey && seenLocations.has(locKey)) continue;

    seenIds.add(a.id);
    if (locKey) seenLocations.add(locKey);
    result.push(a);
  }

  // Strictly enforce at most ONE default address
  if (result.length > 0) {
    const defaultIdx = result.findIndex(a => a.isDefault);
    const chosenIdx = defaultIdx >= 0 ? defaultIdx : 0;
    for (let i = 0; i < result.length; i++) {
      result[i] = {
        ...result[i],
        isDefault: i === chosenIdx
      };
    }
  }

  return result;
}

// Convert an AddressItem or partial address object into the standard StoreDeliveryAddress schema
export function convertToStoreDeliveryAddress(
  addr: Partial<AddressItem & StoreDeliveryAddress> & { houseNo?: string; area?: string; pincode?: string }
): StoreDeliveryAddress {
  const pin = addr.postalCode || addr.pin || addr.pincode || '';
  const recipientName = addr.recipientName || addr.name || 'Customer';
  const phone = addr.phone || '';
  const street = addr.street || addr.houseNo || '';
  const apartment = addr.apartment || '';
  const landmark = addr.landmark || (addr.area && !apartment ? addr.area : undefined);
  const city = addr.city || '';
  const state = addr.state || '';
  const country = addr.country || 'India';

  return {
    recipientName,
    phone,
    street,
    apartment: apartment || undefined,
    landmark: landmark || undefined,
    postalCode: pin,
    pin: pin,
    city,
    state,
    country,
    isDefault: true,
    updatedAt: new Date().toISOString()
  };
}

// Standard synchronization for user details (Name, Phone, Delivery Address) with Melody App & Firestore
export async function saveCustomerDeliveryAddress(userId: string, address: StoreDeliveryAddress, email?: string): Promise<void> {
  const sanitized: StoreDeliveryAddress = {
    ...address,
    pin: address.postalCode || address.pin,
    postalCode: address.postalCode || address.pin,
    country: address.country || 'India',
    isDefault: true,
    updatedAt: new Date().toISOString()
  };

  const formattedStr = [
    sanitized.street,
    sanitized.apartment,
    sanitized.landmark,
    sanitized.city,
    sanitized.state,
    sanitized.postalCode
  ].filter(Boolean).join(', ');

  // Update localStorage immediately for instantaneous responsive UI
  const localDefaultAddr: AddressItem = {
    id: (address as any).id && (address as any).id !== 'default' ? (address as any).id : 'default',
    name: sanitized.recipientName,
    phone: sanitized.phone,
    email: email || '',
    pincode: sanitized.postalCode,
    houseNo: sanitized.street,
    area: [sanitized.apartment, sanitized.landmark].filter(Boolean).join(', '),
    city: sanitized.city,
    state: sanitized.state,
    type: 'HOME',
    isDefault: true
  };
  localStorage.setItem('marts_default_address', JSON.stringify(localDefaultAddr));
  localStorage.setItem('marts_user_address', formattedStr);
  localStorage.setItem('melody_default_address', JSON.stringify(localDefaultAddr));
  localStorage.setItem('melody_user_address', formattedStr);
  localStorage.setItem('agronic_default_address', JSON.stringify(localDefaultAddr));
  localStorage.setItem('agronic_user_address', formattedStr);

  try {
    // Clean up any legacy duplicate 'default' doc in subcollection to prevent clone entries
    try {
      await withTimeout(deleteDoc(doc(db, 'users', userId, 'addresses', 'default')), 1500);
    } catch (_) {}

    // Write to main user document: users/{uid} (merge into fields deliveryAddress and shippingAddress)
    const userRef = doc(db, 'users', userId);
    await withTimeout(setDoc(userRef, {
      displayName: sanitized.recipientName,
      name: sanitized.recipientName,
      phoneNumber: sanitized.phone,
      phone: sanitized.phone,
      deliveryAddress: sanitized,
      shippingAddress: sanitized,
      address: formattedStr,
      updatedAt: new Date().toISOString(),
      ...(email ? { email: email.toLowerCase() } : {})
    }, { merge: true }), 2500);
  } catch (err) {
    console.warn('Firestore delivery address save notice (offline fallback active):', err);
  }
}

export interface NotificationItem {
  id: string;
  type: 'order' | 'offer' | 'info';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  image?: string;
  createdAt?: number;
}

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: number;
}

// Timeout helper to allow reliable Firestore queries while retaining graceful fallback
const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

// ================= USER PROFILE & ACCOUNT DETAILS =================
export const fetchUserProfile = async (uid: string): Promise<User | null> => {
  // First, check local cache for zero-latency instant startup
  let cachedUser: User | null = null;
  try {
    const cachedStr = localStorage.getItem('marts_user_profile') || localStorage.getItem('melody_user_profile');
    if (cachedStr) {
      cachedUser = JSON.parse(cachedStr);
    }
  } catch (_) {}

  try {
    const userDocSnap = await withTimeout(getDoc(doc(db, 'users', uid)), 2500);
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      const deliveryAddr = (data.deliveryAddress || data.shippingAddress) as StoreDeliveryAddress | undefined;
      let addressStr = data.address || '';
      
      // If user profile doc address is empty, check deliveryAddress / shippingAddress
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

      let initialOrders: Order[] = Array.isArray(data.orders) ? data.orders : [];
      try {
        const cachedOrdersStr = localStorage.getItem(`marts_orders_${uid}`) || localStorage.getItem('marts_orders') || localStorage.getItem('melody_orders');
        if (cachedOrdersStr) {
          const cachedParsed = JSON.parse(cachedOrdersStr);
          if (Array.isArray(cachedParsed) && cachedParsed.length > initialOrders.length) {
            initialOrders = cachedParsed;
          }
        }
      } catch (_) {}

      const userProfile: User = {
        name: data.displayName || data.name || cachedUser?.name || 'Customer',
        displayName: data.displayName || data.name || cachedUser?.displayName || 'Customer',
        businessName: data.businessName || '',
        phone: data.phoneNumber || data.phone || cachedUser?.phone || '',
        phoneNumber: data.phoneNumber || data.phone || cachedUser?.phoneNumber || '',
        email: data.email || cachedUser?.email || '',
        avatar: data.avatar || data.photoURL || cachedUser?.avatar || undefined,
        address: addressStr || cachedUser?.address || '',
        deliveryAddress: deliveryAddr || cachedUser?.deliveryAddress,
        shippingAddress: data.shippingAddress || deliveryAddr || cachedUser?.shippingAddress,
        orders: initialOrders,
        role: data.role || 'customer'
      };

      try {
        localStorage.setItem('marts_user_profile', JSON.stringify(userProfile));
        localStorage.setItem('melody_user_profile', JSON.stringify(userProfile));
      } catch (_) {}

      return userProfile;
    }

    return cachedUser;
  } catch (err) {
    console.warn('Firestore fetchUserProfile notice (using local profile cache):', err);
    return cachedUser;
  }
};

export const saveUserProfile = async (uid: string, profileData: Partial<User> & { gender?: string }): Promise<User> => {
  const cached = localStorage.getItem('melody_user_profile');
  let current: User = cached ? JSON.parse(cached) : { name: '', phone: '', email: '', address: '', orders: [] };
  const updated: User = { ...current, ...profileData };
  localStorage.setItem('melody_user_profile', JSON.stringify(updated));
  if (profileData.address) {
    localStorage.setItem('melody_user_address', profileData.address);
    localStorage.setItem('agronic_user_address', profileData.address);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: updated }));
  }

  try {
    const userRef = doc(db, 'users', uid);
    const firestoreData: Record<string, any> = {
      ...profileData,
      updatedAt: new Date().toISOString()
    };
    if (profileData.name) {
      firestoreData.name = profileData.name;
      firestoreData.displayName = profileData.name;
    }
    if (profileData.phone) {
      firestoreData.phone = profileData.phone;
      firestoreData.phoneNumber = profileData.phone;
    }

    await withTimeout(setDoc(userRef, firestoreData, { merge: true }), 2500);

    // If profileData contains deliveryAddress, sync it via saveCustomerDeliveryAddress
    if (profileData.deliveryAddress) {
      await saveCustomerDeliveryAddress(uid, profileData.deliveryAddress, profileData.email || current.email);
    }
  } catch (err) {
    console.warn('Firestore offline when saving user profile, updating local storage.');
  }

  return updated;
};

// Real-time listener for user profile updates from any platform/admin website
export const subscribeToUserProfile = (
  uid: string,
  onUpdate: (user: User) => void
): (() => void) => {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const deliveryAddr = (data.deliveryAddress || data.shippingAddress) as StoreDeliveryAddress | undefined;
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

      const updatedUser: User = {
        name: data.displayName || data.name || 'User',
        displayName: data.displayName || data.name || 'User',
        phone: data.phoneNumber || data.phone || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        email: data.email || '',
        address: addressStr,
        deliveryAddress: deliveryAddr,
        shippingAddress: (data.shippingAddress || deliveryAddr) as StoreDeliveryAddress | undefined,
        orders: data.orders || []
      };
      localStorage.setItem('melody_user_profile', JSON.stringify(updatedUser));
      if (updatedUser.address) {
        localStorage.setItem('melody_user_address', updatedUser.address);
        localStorage.setItem('agronic_user_address', updatedUser.address);
      }
      onUpdate(updatedUser);
    }
  }, (err) => {
    console.warn('User profile snapshot listener offline notice:', err);
  });
};

// ================= PRODUCTS (DYNAMIC CATALOG & CACHE) =================
export const fetchProductsFromFirestore = async (): Promise<Product[]> => {
  try {
    const prodCol = collection(db, 'products');
    const snap = await withTimeout(getDocs(prodCol), 3500);
    const firestoreProducts: Product[] = [];
    snap.forEach((d) => {
      const data = d.data() as Product;
      if (data && data.id) {
        firestoreProducts.push(data);
      }
    });

    const sanitized = sanitizeProductRatings(firestoreProducts);
    try {
      localStorage.setItem('marts_products', JSON.stringify(sanitized));
      localStorage.removeItem('melody_products');
    } catch (_) {}
    return sanitized;
  } catch (err) {
    console.warn('Firestore offline or products query timed out, using local cache:', err);
    try {
      const cached = localStorage.getItem('marts_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeProductRatings(parsed);
      }
    } catch (_) {}
    return [];
  }
};

/**
 * Real-time subscription to storefront products catalog
 */
export const subscribeToLiveProducts = (
  onUpdate: (products: Product[]) => void
): (() => void) => {
  const prodCol = collection(db, 'products');
  return onSnapshot(
    prodCol,
    (snap) => {
      const firestoreProducts: Product[] = [];
      snap.forEach((d) => {
        const data = d.data() as Product;
        if (data && data.id) {
          firestoreProducts.push(data);
        }
      });
      const sanitized = sanitizeProductRatings(firestoreProducts);
      try {
        localStorage.setItem('marts_products', JSON.stringify(sanitized));
        localStorage.removeItem('melody_products');
      } catch (_) {}
      onUpdate(sanitized);
    },
    (err) => {
      console.warn('Live products subscription notice (operating in local cache mode):', err);
    }
  );
};

// ================= CART ITEM LISTS =================
export const fetchUserCart = async (uid: string): Promise<CartItem[]> => {
  try {
    const cartColRef = collection(db, 'users', uid, 'cart');
    const snapshot = await withTimeout(getDocs(cartColRef));
    const items: CartItem[] = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data() as CartItem;
      if (item && item.id) {
        items.push(item);
      }
    });
    if (items.length > 0) {
      localStorage.setItem(`melody_cart_${uid}`, JSON.stringify(items));
    }
    return items;
  } catch (err) {
    console.warn('Firestore offline when fetching cart, using local cache.');
    const cached = localStorage.getItem(`melody_cart_${uid}`) || localStorage.getItem('melody_cart');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {}
    }
    return [];
  }
};

export const syncUserCartToFirestore = async (uid: string, cartItems: CartItem[]): Promise<void> => {
  localStorage.setItem(`melody_cart_${uid}`, JSON.stringify(cartItems));
  localStorage.setItem('melody_cart', JSON.stringify(cartItems));
  try {
    const cartColRef = collection(db, 'users', uid, 'cart');
    const snapshot = await withTimeout(getDocs(cartColRef), 2000);
    
    // Delete existing cart items in batch
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });

    // Write new items
    for (const item of cartItems) {
      const itemRef = doc(db, 'users', uid, 'cart', item.id);
      batch.set(itemRef, item);
    }
    await withTimeout(batch.commit(), 2000);
  } catch (err) {
    console.warn('Firestore offline when syncing cart, saved to local storage.');
  }
};

// ================= ADDRESSES =================
export const fetchUserAddresses = async (uid: string): Promise<AddressItem[]> => {
  try {
    const addrColRef = collection(db, 'users', uid, 'addresses');
    const snapshot = await withTimeout(getDocs(addrColRef));
    const rawAddresses: AddressItem[] = [];
    let hasLegacyDefaultDoc = false;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (docSnap.id === 'default') {
        hasLegacyDefaultDoc = true;
      }
      const item: AddressItem = {
        id: data.id || docSnap.id,
        name: data.recipientName || data.name || '',
        phone: data.phone || data.phoneNumber || '',
        email: data.email || '',
        pincode: data.postalCode || data.pin || data.pincode || '',
        houseNo: data.street || data.houseNo || '',
        area: [data.apartment, data.landmark].filter(Boolean).join(', ') || data.area || '',
        city: data.city || '',
        state: data.state || '',
        type: data.type || 'HOME',
        isDefault: data.isDefault === true || docSnap.id === 'default'
      };
      rawAddresses.push(item);
    });

    // If addresses subcollection was completely empty, check user doc for deliveryAddress/shippingAddress
    if (rawAddresses.length === 0) {
      try {
        const userDoc = await withTimeout(getDoc(doc(db, 'users', uid)), 1500);
        if (userDoc.exists()) {
          const uData = userDoc.data();
          const dAddr = (uData.deliveryAddress || uData.shippingAddress) as StoreDeliveryAddress | undefined;
          if (dAddr && typeof dAddr === 'object' && (dAddr.street || dAddr.postalCode)) {
            const defaultItem: AddressItem = {
              id: 'addr_default',
              name: dAddr.recipientName || uData.displayName || uData.name || 'Customer',
              phone: dAddr.phone || uData.phoneNumber || uData.phone || '',
              email: uData.email || '',
              pincode: dAddr.postalCode || dAddr.pin || '',
              houseNo: dAddr.street || '',
              area: [dAddr.apartment, dAddr.landmark].filter(Boolean).join(', '),
              city: dAddr.city || '',
              state: dAddr.state || '',
              type: 'HOME',
              isDefault: true
            };
            rawAddresses.push(defaultItem);
          }
        }
      } catch (e) {}
    }

    // Clean up legacy 'default' or 'addr_default' doc if other real addresses exist
    if (hasLegacyDefaultDoc && rawAddresses.some(a => a.id !== 'default')) {
      try {
        deleteDoc(doc(db, 'users', uid, 'addresses', 'default')).catch(() => {});
      } catch (_) {}
    }

    const uniqueAddresses = deduplicateAddresses(rawAddresses);

    if (uniqueAddresses.length > 0) {
      localStorage.setItem(`melody_addresses_${uid}`, JSON.stringify(uniqueAddresses));
      localStorage.setItem('melody_addresses', JSON.stringify(uniqueAddresses));
      const def = uniqueAddresses.find(a => a.isDefault) || uniqueAddresses[0];
      localStorage.setItem('melody_default_address', JSON.stringify(def));
    }
    return uniqueAddresses;
  } catch (err) {
    console.warn('Firestore offline when fetching addresses, using local storage.');
    const cached = localStorage.getItem(`melody_addresses_${uid}`) || localStorage.getItem('melody_addresses');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return deduplicateAddresses(parsed);
        }
      } catch (e) {}
    }
    const defaultAddr = localStorage.getItem('melody_default_address');
    if (defaultAddr) {
      try {
        const parsed = JSON.parse(defaultAddr);
        return deduplicateAddresses([parsed]);
      } catch (e) {}
    }
    return [];
  }
};

export const saveUserAddress = async (uid: string, address: AddressItem): Promise<User> => {
  // Ensure valid ID (never 'default' or 'addr_default')
  const targetId = (!address.id || address.id === 'default' || address.id === 'addr_default') ? ('addr_' + Date.now()) : address.id;
  const addressWithId: AddressItem = { ...address, id: targetId };

  // Fetch existing addresses and deduplicate
  const existing = await fetchUserAddresses(uid);
  const isDefaultAddress = Boolean(addressWithId.isDefault || existing.length === 0);
  const updatedAddressItem: AddressItem = { ...addressWithId, isDefault: isDefaultAddress };

  // Filter out any existing address with the same ID, legacy 'default'/'addr_default', OR identical normalized address signature
  const normPhone = (updatedAddressItem.phone || '').replace(/\D/g, '').slice(-10);
  const normHouse = (updatedAddressItem.houseNo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normPin = (updatedAddressItem.pincode || '').trim().toLowerCase().replace(/\s+/g, '');
  const normCity = (updatedAddressItem.city || '').trim().toLowerCase();

  const withoutCurrent = existing.filter(a => {
    if (!a || !a.id) return false;
    if (a.id === updatedAddressItem.id || a.id === 'default' || a.id === 'addr_default') return false;
    
    const aPhone = (a.phone || '').replace(/\D/g, '').slice(-10);
    const aHouse = (a.houseNo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const aPin = (a.pincode || '').trim().toLowerCase().replace(/\s+/g, '');
    const aCity = (a.city || '').trim().toLowerCase();

    // If existing address was a generic placeholder from profile creation, replace it
    if (a.name?.toLowerCase() === 'customer' && (!a.houseNo || aHouse === normHouse || aPin === normPin)) {
      return false;
    }

    // Matching location details
    if (normHouse && aHouse && normHouse === aHouse) {
      if (normPin && aPin && normPin === aPin) return false;
      if (normCity && aCity && normCity === aCity) return false;
      if (normPhone && aPhone && normPhone === aPhone) return false;
    }
    if (normPhone && aPhone && normPhone === aPhone && normPin && aPin && normPin === aPin) {
      return false;
    }

    return true;
  });

  const updatedAddresses: AddressItem[] = isDefaultAddress 
    ? [updatedAddressItem, ...withoutCurrent.map(a => ({ ...a, isDefault: false }))]
    : [...withoutCurrent, updatedAddressItem];

  const dedupedAddresses = deduplicateAddresses(updatedAddresses);

  localStorage.setItem(`melody_addresses_${uid}`, JSON.stringify(dedupedAddresses));
  localStorage.setItem('melody_addresses', JSON.stringify(dedupedAddresses));

  // Format full address string
  const formattedStr = `${addressWithId.houseNo}, ${addressWithId.area ? addressWithId.area + ', ' : ''}${addressWithId.city}, ${addressWithId.state} ${addressWithId.pincode}`.trim();
  if (isDefaultAddress) {
    localStorage.setItem('marts_default_address', JSON.stringify(updatedAddressItem));
    localStorage.setItem('marts_user_address', formattedStr);
    localStorage.setItem('melody_default_address', JSON.stringify(updatedAddressItem));
    localStorage.setItem('melody_user_address', formattedStr);
    localStorage.setItem('agronic_default_address', JSON.stringify(updatedAddressItem));
    localStorage.setItem('agronic_user_address', formattedStr);
  }

  // Universal profile sync across the entire app
  const cached = localStorage.getItem('melody_user_profile');
  let currentProfile: User = cached ? JSON.parse(cached) : { name: '', phone: '', email: '', address: '', orders: [] };
  const updatedProfile: User = {
    ...currentProfile,
    ...(addressWithId.name ? { name: addressWithId.name, displayName: addressWithId.name } : {}),
    ...(addressWithId.phone ? { phone: addressWithId.phone, phoneNumber: addressWithId.phone } : {}),
    ...(isDefaultAddress ? { address: formattedStr } : {})
  };
  localStorage.setItem('melody_user_profile', JSON.stringify(updatedProfile));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: updatedProfile }));
  }

  try {
    const addrRef = doc(db, 'users', uid, 'addresses', addressWithId.id);
    await withTimeout(setDoc(addrRef, updatedAddressItem, { merge: true }), 2500);

    // Clean up any legacy 'default' doc from the subcollection so it never duplicates
    try {
      await withTimeout(deleteDoc(doc(db, 'users', uid, 'addresses', 'default')), 1500);
    } catch (_) {}

    const userDocUpdate: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (addressWithId.name) {
      userDocUpdate.name = addressWithId.name;
      userDocUpdate.displayName = addressWithId.name;
    }
    if (addressWithId.phone) {
      userDocUpdate.phone = addressWithId.phone;
      userDocUpdate.phoneNumber = addressWithId.phone;
    }
    if (isDefaultAddress) {
      userDocUpdate.address = formattedStr;
    }

    const batch = writeBatch(db);
    if (isDefaultAddress) {
      for (const a of withoutCurrent) {
        if (a.isDefault) {
          batch.update(doc(db, 'users', uid, 'addresses', a.id), { isDefault: false });
        }
      }
    }
    batch.set(doc(db, 'users', uid), userDocUpdate, { merge: true });
    await withTimeout(batch.commit(), 2500);

    if (isDefaultAddress) {
      const storeDeliveryAddr = convertToStoreDeliveryAddress(addressWithId);
      await saveCustomerDeliveryAddress(uid, storeDeliveryAddr, addressWithId.email || currentProfile.email);
    }
  } catch (err) {
    console.warn('Firestore offline when saving address, saved locally.');
  }

  return updatedProfile;
};

export const deleteUserAddress = async (uid: string, addressId: string): Promise<void> => {
  const existing = await fetchUserAddresses(uid);
  const updated = existing.filter(a => a.id !== addressId && a.id !== 'default');
  const deduped = deduplicateAddresses(updated);
  localStorage.setItem(`melody_addresses_${uid}`, JSON.stringify(deduped));
  localStorage.setItem('melody_addresses', JSON.stringify(deduped));
  try {
    await withTimeout(deleteDoc(doc(db, 'users', uid, 'addresses', addressId)), 2000);
    if (addressId === 'default' || updated.length === 0) {
      await withTimeout(deleteDoc(doc(db, 'users', uid, 'addresses', 'default')), 2000).catch(() => {});
    }
  } catch (err) {
    console.warn('Firestore offline when deleting address.');
  }
};

// ================= NOTIFICATIONS =================
export const fetchUserNotifications = async (uid: string): Promise<NotificationItem[]> => {
  try {
    const notifColRef = collection(db, 'users', uid, 'notifications');
    const snapshot = await withTimeout(getDocs(notifColRef));
    const notifications: NotificationItem[] = [];
    snapshot.forEach(docSnap => {
      notifications.push(docSnap.data() as NotificationItem);
    });
    const sorted = notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    localStorage.setItem(`melody_notifications_${uid}`, JSON.stringify(sorted));
    return sorted;
  } catch (err) {
    console.warn('Firestore offline when fetching notifications, using local cache.');
    const cached = localStorage.getItem(`melody_notifications_${uid}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  }
};

export const createNotificationInFirestore = async (
  uid: string, 
  notification: Omit<NotificationItem, 'id'> & { id?: string }
): Promise<void> => {
  const id = notification.id || 'notif_' + Date.now();
  const notifData: NotificationItem = {
    ...notification,
    id,
    createdAt: Date.now()
  };
  const existing = await fetchUserNotifications(uid);
  const updated = [notifData, ...existing];
  localStorage.setItem(`melody_notifications_${uid}`, JSON.stringify(updated));

  try {
    const notifRef = doc(db, 'users', uid, 'notifications', id);
    await withTimeout(setDoc(notifRef, notifData), 2000);
  } catch (err) {
    console.warn('Firestore offline when creating notification.');
  }
};

export const markNotificationsAsReadInFirestore = async (uid: string): Promise<void> => {
  const existing = await fetchUserNotifications(uid);
  const updated = existing.map(n => ({ ...n, isRead: true }));
  localStorage.setItem(`melody_notifications_${uid}`, JSON.stringify(updated));

  try {
    const batch = writeBatch(db);
    for (const n of existing) {
      if (!n.isRead) {
        batch.update(doc(db, 'users', uid, 'notifications', n.id), { isRead: true });
      }
    }
    await withTimeout(batch.commit(), 2000);
  } catch (err) {
    console.warn('Firestore offline when marking notifications read.');
  }
};

export const deleteNotificationFromFirestore = async (uid: string, notifId: string): Promise<void> => {
  const existing = await fetchUserNotifications(uid);
  const updated = existing.filter(n => n.id !== notifId);
  localStorage.setItem(`melody_notifications_${uid}`, JSON.stringify(updated));

  try {
    await withTimeout(deleteDoc(doc(db, 'users', uid, 'notifications', notifId)), 2000);
  } catch (err) {
    console.warn('Firestore offline when deleting notification.');
  }
};

// ================= ORDER PRICING & TRACKING HELPERS =================
export const calculateOrderPricing = (
  items: CartItem[], 
  customizationFee: number = 0, 
  deliveryFee: number = 0
): {
  mrp: number;
  subtotal: number;
  discount: number;
  savings: number;
  customizationFee: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
} => {
  const safeItems = Array.isArray(items) ? items : [];
  const itemCount = safeItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const mrp = safeItems.reduce((acc, item) => {
    const itemMrp = item.oldPrice && Number(item.oldPrice) > Number(item.price) 
      ? Number(item.oldPrice) 
      : Number(item.price || 0);
    return acc + (itemMrp * (Number(item.quantity) || 1));
  }, 0);
  const subtotal = safeItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  const discount = Math.max(0, mrp - subtotal);
  const total = subtotal + customizationFee + deliveryFee;

  return {
    mrp,
    subtotal,
    discount,
    savings: discount,
    customizationFee,
    deliveryFee,
    total,
    itemCount
  };
};

export const createOrderTracking = (
  status: Order['status'] = 'Processing', 
  createdAt: number = Date.now()
) => {
  const current = String(status);
  const isDelivered = current === 'Delivered';
  const isShipped = current === 'Shipped' || isDelivered;
  const isProcessing = current === 'Processing' || isShipped;
  const isConfirmed = current === 'Confirmed' || isProcessing || isShipped;

  return {
    currentStatus: status,
    updatedAt: Date.now(),
    steps: [
      { status: 'Placed', label: 'Order Confirmed & Authorized', completed: isConfirmed, timestamp: createdAt },
      { status: 'Processing', label: 'Artisan Packaging & Quality Inspection', completed: isProcessing, timestamp: isProcessing ? createdAt : null },
      { status: 'Shipped', label: 'Dispatched in Insured Timber Crate', completed: isShipped, timestamp: isShipped ? Date.now() : null },
      { status: 'Delivered', label: 'Delivered to Doorstep', completed: isDelivered, timestamp: isDelivered ? Date.now() : null }
    ]
  };
};

export const updateOrderTracking = (
  existingTracking: any, 
  newStatus: Order['status'], 
  createdAt?: number
) => {
  const base = existingTracking || createOrderTracking(newStatus, createdAt);
  const now = Date.now();
  const current = String(newStatus);
  const isDelivered = current === 'Delivered';
  const isShipped = current === 'Shipped' || isDelivered;
  const isProcessing = current === 'Processing' || isShipped;
  const isConfirmed = current === 'Confirmed' || isProcessing || isShipped;

  return {
    currentStatus: newStatus,
    updatedAt: now,
    steps: base.steps.map((step: any) => {
      if (step.status === 'Placed') return { ...step, completed: isConfirmed };
      if (step.status === 'Processing') return { ...step, completed: isProcessing, timestamp: isProcessing ? (step.timestamp || now) : null };
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
};

// ================= MY ORDERS =================
export const fetchUserOrders = async (uid: string): Promise<Order[]> => {
  const ordersMap = new Map<string, Order>();

  try {
    // 1. Fetch from user's personal orders subcollection
    try {
      const userOrdersRef = collection(db, 'users', uid, 'orders');
      const snapshot = await withTimeout(getDocs(userOrdersRef), 6000);
      snapshot.forEach(docSnap => {
        const o = docSnap.data() as Order;
        if (o && o.id) ordersMap.set(o.id, o);
      });
    } catch (e) {
      console.warn('Subcollection fetch note:', e);
    }

    // 2. Fetch from global orders collection where userId matches
    try {
      const q = query(collection(db, 'orders'), where('userId', '==', uid));
      const globalSnap = await withTimeout(getDocs(q), 6000);
      globalSnap.forEach(docSnap => {
        const o = docSnap.data() as Order;
        if (o && o.id) {
          const existing = ordersMap.get(o.id);
          if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
            ordersMap.set(o.id, { ...existing, ...o });
          }
        }
      });
    } catch (e) {
      console.warn('Global orders query fetch note:', e);
    }

    const orders = Array.from(ordersMap.values());
    const sorted = orders.sort((a, b) => {
      const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });

    if (sorted.length > 0) {
      try {
        localStorage.setItem(`marts_orders_${uid}`, JSON.stringify(sorted));
        localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(sorted));
      } catch (_) {}
      return sorted;
    }

    // Check user-scoped cached fallback only if firestore returned empty
    const cached = localStorage.getItem(`marts_orders_${uid}`) || localStorage.getItem(`melody_orders_${uid}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  } catch (err) {
    console.warn('Firestore offline when fetching orders, using user-scoped local storage.');
    const cached = localStorage.getItem(`marts_orders_${uid}`) || localStorage.getItem(`melody_orders_${uid}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  }
};

export const saveOrderToFirestore = async (
  uid: string | null, 
  order: Order, 
  customerInfo?: { name?: string; phone?: string; email?: string; address?: string }
): Promise<void> => {
  const finalAddress = customerInfo?.address || order.customerAddress || localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || '';

  const pricingCalculated = calculateOrderPricing(
    order.items, 
    order.customizationFee || order.pricing?.customizationFee || 0,
    order.deliveryFee || order.pricing?.deliveryFee || 0
  );

  const mrp = order.mrp !== undefined ? order.mrp : pricingCalculated.mrp;
  const subtotal = order.subtotal !== undefined ? order.subtotal : pricingCalculated.subtotal;
  const discount = order.discount !== undefined ? order.discount : pricingCalculated.discount;
  const savings = order.savings !== undefined ? order.savings : discount;
  const customizationFee = order.customizationFee !== undefined ? order.customizationFee : pricingCalculated.customizationFee;
  const deliveryFee = order.deliveryFee !== undefined ? order.deliveryFee : pricingCalculated.deliveryFee;
  const total = order.total || pricingCalculated.total;
  const itemCount = order.itemCount !== undefined ? order.itemCount : pricingCalculated.itemCount;

  const pricingData = order.pricing || {
    mrp,
    subtotal,
    discount,
    savings,
    customizationFee,
    deliveryFee,
    total
  };

  const trackingData = order.tracking || createOrderTracking(order.status || 'Processing', order.createdAt || Date.now());

  const statusHistory = Array.isArray(order.statusHistory) && order.statusHistory.length > 0 
    ? order.statusHistory 
    : [
        {
          status: order.status || 'Processing',
          timestamp: order.createdAt || Date.now(),
          label: `Order ${order.status || 'Processing'}`,
          note: order.paymentMethod ? `Placed with ${order.paymentMethod}` : 'Order registered in fulfillment pipeline'
        }
      ];

  const effectiveUserId = uid || order.userId || 'guest';

  const orderData: Order = {
    ...order,
    userId: effectiveUserId,
    customerName: customerInfo?.name || order.customerName || 'Customer',
    customerPhone: customerInfo?.phone || order.customerPhone || '',
    customerEmail: customerInfo?.email || order.customerEmail || '',
    customerAddress: finalAddress,
    shippingAddress: order.shippingAddress || null,
    total,
    mrp,
    subtotal,
    discount,
    savings,
    customizationFee,
    deliveryFee,
    itemCount,
    pricing: pricingData,
    status: order.status || 'Processing',
    tracking: trackingData,
    statusHistory,
    createdAt: order.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  // Always update local cache immediately so the user sees the order with 0 latency
  try {
    const localCachedRaw = localStorage.getItem('marts_orders') || localStorage.getItem('melody_orders') || '[]';
    const localCached: Order[] = JSON.parse(localCachedRaw);
    const updatedLocal = [orderData, ...localCached.filter(o => o.id !== orderData.id)];
    localStorage.setItem('marts_orders', JSON.stringify(updatedLocal));
    localStorage.setItem('melody_orders', JSON.stringify(updatedLocal));
    if (uid && uid !== 'guest') {
      localStorage.setItem(`marts_orders_${uid}`, JSON.stringify(updatedLocal));
      localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(updatedLocal));
    }

    const cachedProf = localStorage.getItem('marts_user_profile') || localStorage.getItem('melody_user_profile');
    if (cachedProf) {
      const parsed = JSON.parse(cachedProf);
      parsed.orders = updatedLocal;
      localStorage.setItem('marts_user_profile', JSON.stringify(parsed));
      localStorage.setItem('melody_user_profile', JSON.stringify(parsed));
    }
  } catch (_) {}

  if (uid && uid !== 'guest') {
    createNotificationInFirestore(uid, {
      type: 'order',
      title: 'Order Placed Successfully!',
      message: `Your order #${order.id} for ₹${Number(order.total || 0).toLocaleString()} has been received and is being processed.`,
      time: 'Just now',
      isRead: false
    }).catch(() => {});
  }

  // Persist asynchronously to Firestore without blocking the frontend response
  (async () => {
    try {
      const globalOrderRef = doc(db, 'orders', order.id);
      await withTimeout(setDoc(globalOrderRef, orderData), 3500).catch(e => {
        console.warn('Global order setDoc notice:', e);
      });

      if (uid && uid !== 'guest') {
        const userOrderRef = doc(db, 'users', uid, 'orders', order.id);
        await withTimeout(setDoc(userOrderRef, orderData), 3500).catch(e => {
          console.warn('User order subcollection setDoc notice:', e);
        });

        // Also sync orders array to the parent users document preserving all orders
        const localCachedRaw = localStorage.getItem('marts_orders') || localStorage.getItem('melody_orders') || '[]';
        let allOrdersToSync = [orderData];
        try {
          const parsed = JSON.parse(localCachedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) allOrdersToSync = parsed;
        } catch (_) {}

        await withTimeout(setDoc(doc(db, 'users', uid), {
          orders: allOrdersToSync,
          updatedAt: new Date().toISOString()
        }, { merge: true }), 3500).catch(() => {});
      }
    } catch (err) {
      console.warn('Firestore notice when saving order:', err);
    }
  })();
};

export const updateOrderStatusInFirestore = async (
  uid: string | null, 
  orderId: string, 
  status: Order['status'],
  note?: string
): Promise<void> => {
  const now = Date.now();
  let targetUid = uid;
  let existingOrder: Order | null = null;

  try {
    const snap = await withTimeout(getDoc(doc(db, 'orders', orderId)), 2000);
    if (snap.exists()) {
      existingOrder = snap.data() as Order;
      if (!targetUid) {
        targetUid = existingOrder.userId;
      }
    }
  } catch (_) {}

  const updatedTracking = updateOrderTracking(existingOrder?.tracking, status, existingOrder?.createdAt);

  const existingHistory = Array.isArray(existingOrder?.statusHistory) ? existingOrder.statusHistory : [];
  const updatedHistory = [
    ...existingHistory,
    {
      status,
      timestamp: now,
      label: `Order ${status}`,
      note: note || (status === 'Cancelled' ? 'Order cancelled by customer.' : `Order status marked as ${status}.`)
    }
  ];

  const updateFields: Partial<Order> = {
    status,
    updatedAt: now,
    tracking: updatedTracking,
    statusHistory: updatedHistory
  };

  if (targetUid && targetUid !== 'guest') {
    try {
      const existing = await fetchUserOrders(targetUid);
      const updated = existing.map(o => o.id === orderId ? { ...o, ...updateFields } : o);
      localStorage.setItem(`melody_orders_${targetUid}`, JSON.stringify(updated));
      localStorage.setItem('melody_orders', JSON.stringify(updated));
    } catch (_) {}
  }

  try {
    // 1. Update the top-level global order document
    await withTimeout(setDoc(doc(db, 'orders', orderId), updateFields, { merge: true }), 3000);

    // 2. Update the user-specific order subcollection & parent profile
    if (targetUid && targetUid !== 'guest') {
      await withTimeout(setDoc(doc(db, 'users', targetUid, 'orders', orderId), updateFields, { merge: true }), 3000);

      try {
        const userDocRef = doc(db, 'users', targetUid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (Array.isArray(uData.orders)) {
            const updatedOrders = uData.orders.map((o: Order) => o.id === orderId ? { ...o, ...updateFields } : o);
            await setDoc(userDocRef, { 
              orders: updatedOrders, 
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Firestore notice when updating order status:', err);
  }
};

// ================= RAZORPAY PAYMENTS =================
export const saveRazorpayPaymentToFirestore = async (paymentRecord: PaymentRecord): Promise<void> => {
  try {
    const paymentRef = doc(db, 'payments', paymentRecord.paymentId);
    await withTimeout(setDoc(paymentRef, {
      ...paymentRecord,
      createdAt: Date.now()
    }), 2000);
  } catch (err) {
    console.warn('Firestore offline when saving payment record.');
  }
};

// ================= WISHLIST =================
export const fetchUserWishlist = async (uid: string): Promise<string[]> => {
  try {
    const wishlistDocSnap = await withTimeout(getDoc(doc(db, 'users', uid, 'wishlist', 'items')));
    if (wishlistDocSnap.exists()) {
      const list = wishlistDocSnap.data().productIds || [];
      localStorage.setItem(`melody_wishlist_${uid}`, JSON.stringify(list));
      return list;
    }
    return [];
  } catch (err) {
    console.warn('Firestore offline when fetching wishlist, using local cache.');
    const cached = localStorage.getItem(`melody_wishlist_${uid}`) || localStorage.getItem('melody_wishlist');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  }
};

export const syncUserWishlistToFirestore = async (uid: string, wishlist: string[]): Promise<void> => {
  localStorage.setItem(`melody_wishlist_${uid}`, JSON.stringify(wishlist));
  localStorage.setItem('melody_wishlist', JSON.stringify(wishlist));
  try {
    await withTimeout(setDoc(doc(db, 'users', uid, 'wishlist', 'items'), {
      productIds: wishlist,
      updatedAt: Date.now()
    }), 2000);
  } catch (err) {
    console.warn('Firestore offline when syncing wishlist to local storage.');
  }
};

// ================= ADMIN PIPELINE & STORAGE RE-EXPORTS =================
export {
  uploadHeroImage,
  uploadBannerImage,
  uploadProductImage,
  addProductImageAndSave,
  uploadCustomizationMedia,
  saveHeroBanner,
  fetchHeroBanner,
  subscribeToHeroBanner,
  saveCarouselBanner,
  deleteCarouselBanner,
  fetchCarouselBanners,
  subscribeToCarouselBanners,
  saveProductToFirestore,
  deleteProductFromFirestore,
  fetchProductsAdmin,
  subscribeToProductsAdmin,
  fetchAllOrdersAdmin,
  updateOrderStatusAdmin,
  subscribeToOrdersAdmin,
  getOrderPricingBreakdown,
  checkIsAdmin,
  grantAdminRole,
  type HeroBannerConfig
} from './adminBackendService';
