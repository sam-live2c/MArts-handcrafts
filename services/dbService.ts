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
import { PRODUCTS } from '../constants';

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
    id: 'default',
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
  localStorage.setItem('melody_default_address', JSON.stringify(localDefaultAddr));
  localStorage.setItem('melody_user_address', formattedStr);
  localStorage.setItem('agronic_default_address', JSON.stringify(localDefaultAddr));
  localStorage.setItem('agronic_user_address', formattedStr);

  try {
    // 1. Write to subcollection for default shipping address: users/{uid}/addresses/default
    const defaultAddrRef = doc(db, 'users', userId, 'addresses', 'default');
    await withTimeout(setDoc(defaultAddrRef, sanitized, { merge: true }), 2500);

    // 2. Write to main user document: users/{uid} (merge into fields deliveryAddress and shippingAddress)
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

  // 3. Fallback: Notify the Melody App sync API (CORS enabled)
  try {
    await fetch('https://melodyai.app/api/store/address-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, address: sanitized })
    });
  } catch (err) {
    // Non-blocking fallback
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

// Timeout helper to ensure instant local fallbacks if Firestore network is delayed or unreachable
const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> => {
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
  try {
    const userDocSnap = await withTimeout(getDoc(doc(db, 'users', uid)));
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

      // If still empty, check addresses subcollection
      if (!addressStr) {
        const addresses = await fetchUserAddresses(uid);
        if (addresses.length > 0) {
          const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
          addressStr = `${defaultAddr.houseNo}, ${defaultAddr.area ? defaultAddr.area + ', ' : ''}${defaultAddr.city}, ${defaultAddr.state} ${defaultAddr.pincode}`.trim();
          // Backfill profile doc
          try {
            await withTimeout(setDoc(doc(db, 'users', uid), { 
              address: addressStr,
              updatedAt: new Date().toISOString()
            }, { merge: true }), 1500);
          } catch (e) {}
        }
      }

      const profile: User = {
        name: data.displayName || data.name || '',
        displayName: data.displayName || data.name || '',
        phone: data.phoneNumber || data.phone || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        email: data.email || '',
        address: addressStr,
        deliveryAddress: deliveryAddr,
        shippingAddress: (data.shippingAddress || deliveryAddr) as StoreDeliveryAddress | undefined,
        orders: data.orders || []
      };
      localStorage.setItem('melody_user_profile', JSON.stringify(profile));
      if (addressStr) {
        localStorage.setItem('melody_user_address', addressStr);
        localStorage.setItem('agronic_user_address', addressStr);
      }
      return profile;
    }
    return null;
  } catch (err) {
    console.warn('Firestore offline or unreachable, using local storage fallback for user profile.');
    const cached = localStorage.getItem('melody_user_profile');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return {
      name: 'User',
      phone: '',
      email: '',
      address: localStorage.getItem('melody_user_address') || '',
      orders: []
    };
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
    localStorage.setItem('melody_products', JSON.stringify(PRODUCTS));
    localStorage.setItem('marts_products', JSON.stringify(PRODUCTS));
    return PRODUCTS;
  } catch (err) {
    return PRODUCTS;
  }
};

// ================= CART ITEM LISTS =================
export const fetchUserCart = async (uid: string): Promise<CartItem[]> => {
  try {
    const cartColRef = collection(db, 'users', uid, 'cart');
    const snapshot = await withTimeout(getDocs(cartColRef));
    const items: CartItem[] = [];
    snapshot.forEach(docSnap => {
      const item = docSnap.data() as CartItem;
      const baseProd = PRODUCTS.find(p => p.id === item.id);
      if (baseProd) {
        items.push({
          ...item,
          price: baseProd.price,
          oldPrice: baseProd.oldPrice,
          discount: baseProd.discount
        });
      } else {
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
          return parsed.map((item: CartItem) => {
            const baseProd = PRODUCTS.find(p => p.id === item.id);
            return baseProd ? { ...item, price: baseProd.price, oldPrice: baseProd.oldPrice, discount: baseProd.discount } : item;
          });
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
    const addresses: AddressItem[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const isDef = docSnap.id === 'default' || data.isDefault === true;
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
        isDefault: isDef
      };
      addresses.push(item);
    });

    // If addresses subcollection was empty, check user doc for deliveryAddress/shippingAddress
    if (addresses.length === 0) {
      try {
        const userDoc = await withTimeout(getDoc(doc(db, 'users', uid)), 1500);
        if (userDoc.exists()) {
          const uData = userDoc.data();
          const dAddr = (uData.deliveryAddress || uData.shippingAddress) as StoreDeliveryAddress | undefined;
          if (dAddr && typeof dAddr === 'object') {
            const defaultItem: AddressItem = {
              id: 'default',
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
            addresses.push(defaultItem);
          }
        }
      } catch (e) {}
    }

    // Deduplicate by item.id to ensure keys are strictly unique
    const seen = new Set<string>();
    const uniqueAddresses: AddressItem[] = [];
    for (const a of addresses) {
      if (a && a.id && !seen.has(a.id)) {
        seen.add(a.id);
        uniqueAddresses.push(a);
      }
    }

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
          const seen = new Set<string>();
          const uniqueList: AddressItem[] = [];
          for (const a of parsed) {
            if (a && a.id && !seen.has(a.id)) {
              seen.add(a.id);
              uniqueList.push(a);
            }
          }
          return uniqueList;
        }
      } catch (e) {}
    }
    const defaultAddr = localStorage.getItem('melody_default_address');
    if (defaultAddr) {
      try {
        const parsed = JSON.parse(defaultAddr);
        return [parsed];
      } catch (e) {}
    }
    return [];
  }
};

export const saveUserAddress = async (uid: string, address: AddressItem): Promise<User> => {
  // Update local storage first
  const existing = await fetchUserAddresses(uid);
  const isDefaultAddress = Boolean(address.isDefault || existing.length === 0);
  const updatedAddressItem: AddressItem = { ...address, isDefault: isDefaultAddress };

  // Remove any existing address with the same id to strictly prevent duplicates
  const withoutCurrent = existing.filter(a => a.id !== address.id);
  const updatedAddresses: AddressItem[] = isDefaultAddress 
    ? [updatedAddressItem, ...withoutCurrent.map(a => ({ ...a, isDefault: false }))]
    : [...withoutCurrent, updatedAddressItem];

  localStorage.setItem(`melody_addresses_${uid}`, JSON.stringify(updatedAddresses));
  localStorage.setItem('melody_addresses', JSON.stringify(updatedAddresses));

  // Format full address string
  const formattedStr = `${address.houseNo}, ${address.area ? address.area + ', ' : ''}${address.city}, ${address.state} ${address.pincode}`.trim();
  if (isDefaultAddress) {
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
    ...(address.name ? { name: address.name, displayName: address.name } : {}),
    ...(address.phone ? { phone: address.phone, phoneNumber: address.phone } : {}),
    ...(isDefaultAddress ? { address: formattedStr } : {})
  };
  localStorage.setItem('melody_user_profile', JSON.stringify(updatedProfile));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('melody_user_updated', { detail: updatedProfile }));
  }

  try {
    const addrRef = doc(db, 'users', uid, 'addresses', address.id);
    await withTimeout(setDoc(addrRef, updatedAddressItem, { merge: true }), 2500);

    const userDocUpdate: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (address.name) {
      userDocUpdate.name = address.name;
      userDocUpdate.displayName = address.name;
    }
    if (address.phone) {
      userDocUpdate.phone = address.phone;
      userDocUpdate.phoneNumber = address.phone;
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

    // If marked as default or only address, synchronize to users/{uid}/addresses/default and deliveryAddress/shippingAddress
    if (isDefaultAddress) {
      const storeDeliveryAddr = convertToStoreDeliveryAddress(address);
      await saveCustomerDeliveryAddress(uid, storeDeliveryAddr, address.email || currentProfile.email);
    }
  } catch (err) {
    console.warn('Firestore offline when saving address, saved locally.');
  }

  return updatedProfile;
};

export const deleteUserAddress = async (uid: string, addressId: string): Promise<void> => {
  const existing = await fetchUserAddresses(uid);
  const updated = existing.filter(a => a.id !== addressId);
  localStorage.setItem(`melody_addresses_${uid}`, JSON.stringify(updated));
  localStorage.setItem('melody_addresses', JSON.stringify(updated));
  try {
    await withTimeout(deleteDoc(doc(db, 'users', uid, 'addresses', addressId)), 2000);
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

// ================= MY ORDERS =================
export const fetchUserOrders = async (uid: string): Promise<Order[]> => {
  try {
    const userOrdersRef = collection(db, 'users', uid, 'orders');
    const snapshot = await withTimeout(getDocs(userOrdersRef));
    const orders: Order[] = [];
    snapshot.forEach(docSnap => {
      orders.push(docSnap.data() as Order);
    });
    const sorted = orders.sort((a, b) => b.id.localeCompare(a.id));
    localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(sorted));
    return sorted;
  } catch (err) {
    console.warn('Firestore offline when fetching orders, using local storage.');
    const cached = localStorage.getItem(`melody_orders_${uid}`) || localStorage.getItem('melody_orders');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  }
};

export const saveOrderToFirestore = async (uid: string | null, order: Order, customerInfo?: { name: string; phone: string; email: string; address?: string }): Promise<void> => {
  const finalAddress = customerInfo?.address || localStorage.getItem('melody_user_address') || localStorage.getItem('agronic_user_address') || '';
  const orderData = {
    ...order,
    userId: uid || 'guest',
    customerName: customerInfo?.name || '',
    customerPhone: customerInfo?.phone || '',
    customerEmail: customerInfo?.email || '',
    customerAddress: finalAddress,
    createdAt: Date.now()
  };

  if (uid) {
    const existing = await fetchUserOrders(uid);
    const updated = [orderData, ...existing];
    localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(updated));
    localStorage.setItem('melody_orders', JSON.stringify(updated));

    await createNotificationInFirestore(uid, {
      type: 'order',
      title: 'Order Placed Successfully!',
      message: `Your order #${order.id} for ₹${order.total.toLocaleString()} has been received and is being processed.`,
      time: 'Just now',
      isRead: false
    });
  }

  try {
    const globalOrderRef = doc(db, 'orders', order.id);
    await withTimeout(setDoc(globalOrderRef, orderData), 2000);

    if (uid) {
      const userOrderRef = doc(db, 'users', uid, 'orders', order.id);
      await withTimeout(setDoc(userOrderRef, orderData), 2000);
    }
  } catch (err) {
    console.warn('Firestore offline when saving order, stored locally.');
  }
};

export const updateOrderStatusInFirestore = async (uid: string | null, orderId: string, status: Order['status']): Promise<void> => {
  if (uid) {
    const existing = await fetchUserOrders(uid);
    const updated = existing.map(o => o.id === orderId ? { ...o, status } : o);
    localStorage.setItem(`melody_orders_${uid}`, JSON.stringify(updated));
  }
  try {
    await withTimeout(updateDoc(doc(db, 'orders', orderId), { status, updatedAt: Date.now() }), 2000);
    if (uid) {
      await withTimeout(updateDoc(doc(db, 'users', uid, 'orders', orderId), { status, updatedAt: Date.now() }), 2000);
    }
  } catch (err) {
    console.warn('Firestore offline when updating order status.');
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
  uploadProductImage,
  addProductImageAndSave,
  uploadCustomizationMedia,
  saveHeroBanner,
  fetchHeroBanner,
  subscribeToHeroBanner,
  saveProductToFirestore,
  deleteProductFromFirestore,
  fetchProductsAdmin,
  subscribeToProductsAdmin,
  fetchAllOrdersAdmin,
  updateOrderStatusAdmin,
  subscribeToOrdersAdmin,
  checkIsAdmin,
  grantAdminRole,
  type HeroBannerConfig
} from './adminBackendService';
