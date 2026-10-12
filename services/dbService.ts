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
import { safeStorage, sanitizeUserForCache, broadcastUserUpdate } from '../utils/storage';

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

  // User-scoped cache only for offline resiliency (never leak globally across accounts)
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
  safeStorage.setItem(`marts_default_address_${userId}`, JSON.stringify(localDefaultAddr));
  safeStorage.setItem(`marts_user_address_${userId}`, formattedStr);

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
export const fetchUserProfile = async (uid: string, fallbackEmail?: string): Promise<User | null> => {
  // Strictly validate local cache belongs to this exact user email/uid
  let cachedUser: User | null = null;
  const cleanEmail = (fallbackEmail || '').trim().toLowerCase();
  try {
    const cachedStr = safeStorage.getItem(`marts_user_profile_${uid}`) || safeStorage.getItem('marts_user_profile');
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (parsed && (parsed.uid === uid || (cleanEmail && parsed.email?.toLowerCase() === cleanEmail))) {
        cachedUser = parsed;
      }
    }
  } catch (_) {}

  try {
    const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : '';

    // Fetch user doc and email doc from Cloud Firestore
    const fetchPromises: Promise<any>[] = [
      withTimeout(getDoc(doc(db, 'users', uid)), 2500).catch(() => null)
    ];
    if (emailDocId && emailDocId !== uid) {
      fetchPromises.push(withTimeout(getDoc(doc(db, 'users', emailDocId)), 2500).catch(() => null));
    }

    const [userDocSnap, emailSnap] = await Promise.all(fetchPromises);

    if (userDocSnap && userDocSnap.exists()) {
      const data = userDocSnap.data();
      const userEmail = (data.email || cleanEmail || '').trim().toLowerCase();
      const emailDocData = (emailSnap && emailSnap.exists()) ? emailSnap.data() : {};

      const deliveryAddr = (data.deliveryAddress || data.shippingAddress || emailDocData.deliveryAddress || emailDocData.shippingAddress) as StoreDeliveryAddress | undefined;
      let addressStr = (typeof data.address === 'string' ? data.address : '') || (typeof emailDocData.address === 'string' ? emailDocData.address : '') || '';
      
      if (!addressStr && deliveryAddr) {
        if (typeof deliveryAddr === 'string') {
          addressStr = deliveryAddr;
        } else if (typeof deliveryAddr === 'object') {
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

      // Check cached orders strictly scoped to this uid
      const cachedOrders = (Array.isArray(cachedUser?.orders) && cachedUser.orders.length > 0)
        ? cachedUser.orders
        : (() => {
            try {
              const o = safeStorage.getItem(`marts_orders_${uid}`);
              return o ? JSON.parse(o) : [];
            } catch { return []; }
          })();

      const initialOrders = Array.isArray(data.orders) && data.orders.length > 0
        ? data.orders
        : (Array.isArray(emailDocData.orders) && emailDocData.orders.length > 0
            ? emailDocData.orders
            : cachedOrders);

      // Refresh orders in background from Cloud Firebase
      fetchUserOrders(uid, userEmail).catch(() => {});

      const userProfile: User = {
        name: data.displayName || data.name || emailDocData.displayName || emailDocData.name || cachedUser?.name || 'Customer',
        displayName: data.displayName || data.name || emailDocData.displayName || emailDocData.name || cachedUser?.displayName || 'Customer',
        businessName: data.businessName || emailDocData.businessName || '',
        phone: String(data.phoneNumber || data.phone || emailDocData.phoneNumber || emailDocData.phone || cachedUser?.phone || ''),
        phoneNumber: String(data.phoneNumber || data.phone || emailDocData.phoneNumber || emailDocData.phone || cachedUser?.phoneNumber || ''),
        email: userEmail || data.email || cachedUser?.email || '',
        avatar: data.avatar || data.photoURL || emailDocData.avatar || cachedUser?.avatar || undefined,
        address: addressStr || '', // Never inherit from another user's cache
        deliveryAddress: deliveryAddr,
        shippingAddress: data.shippingAddress || deliveryAddr,
        orders: Array.isArray(initialOrders) ? initialOrders : [],
        role: data.role || emailDocData.role || 'customer'
      };

      safeStorage.setItem(`marts_user_profile_${uid}`, JSON.stringify(sanitizeUserForCache(userProfile)));
      safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(userProfile)));

      return userProfile;
    }

    // If users/{uid} does not exist, but we have cleanEmail, restore from existing email account!
    if (cleanEmail) {
      const restored = await restoreUserAccountByEmail(cleanEmail, undefined, undefined, uid);
      return restored.user;
    }

    return cachedUser;
  } catch (err) {
    console.warn('Firestore fetchUserProfile notice (using local profile cache):', err);
    return cachedUser;
  }
};

/**
 * Find user account in Firestore by email address (deterministic ID)
 */
export const findUserAccountByEmail = async (email: string): Promise<{
  exists: boolean;
  docId: string;
  data?: any;
  user: User | null;
}> => {
  const cleanEmail = email.trim().toLowerCase();
  const docId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

  // Check local storage cached profile first for instant response
  try {
    const cachedStr = safeStorage.getItem('marts_user_profile');
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (parsed && parsed.email?.toLowerCase() === cleanEmail) {
        return {
          exists: true,
          docId,
          data: parsed,
          user: parsed
        };
      }
    }
  } catch (_) {}

  try {
    const snap = await withTimeout(getDoc(doc(db, 'users', docId)), 1500);
    if (snap.exists()) {
      const data = snap.data();
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

      const userProfile: User = {
        name: data.displayName || data.name || cleanEmail.split('@')[0],
        displayName: data.displayName || data.name || cleanEmail.split('@')[0],
        businessName: data.businessName || '',
        phone: data.phoneNumber || data.phone || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        email: cleanEmail,
        avatar: data.avatar || data.photoURL || undefined,
        address: addressStr,
        deliveryAddress: deliveryAddr,
        shippingAddress: data.shippingAddress || deliveryAddr,
        orders: Array.isArray(data.orders) ? data.orders : [],
        role: data.role || 'customer'
      };

      return {
        exists: true,
        docId,
        data,
        user: userProfile
      };
    }
  } catch (err) {
    console.warn('findUserAccountByEmail notice:', err);
  }

  return {
    exists: false,
    docId,
    user: null
  };
};

/**
 * Restore and unify an existing user's account by email.
 * Recovers genuine orders from Firestore across both user subcollections and global orders,
 * restores delivery addresses, synchronizes profiles between Google UID and Email ID,
 * updates password hash if a new password is provided,
 * and syncs to local storage so the user experiences zero disruption no matter the login method.
 * Runs in parallel with fast timeouts and background non-blocking persistence.
 */
export const restoreUserAccountByEmail = async (
  email: string,
  newPasswordHash?: string,
  providedName?: string,
  firebaseUid?: string,
  extraData?: Partial<User>
): Promise<{ user: User; docId: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  const docId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const targetUid = firebaseUid || docId;

  // 1. Instantly gather local storage data (0ms latency base)
  let localData: any = {};
  try {
    const cachedProfile = safeStorage.getItem('marts_user_profile');
    if (cachedProfile) {
      const parsed = JSON.parse(cachedProfile);
      if (parsed && parsed.email && parsed.email.trim().toLowerCase() === cleanEmail) {
        localData = { ...parsed };
      }
    }
  } catch (_) {}

  // 2. Parallel fetch from Firestore with snappy timeout (1500ms max)
  let remoteData: any = {};
  const ordersMap = new Map<string, Order>();
  const addressesMap = new Map<string, AddressItem>();

  // Include cached orders immediately - only strictly user-scoped
  const localOrdersSources = [
    `marts_orders_${targetUid}`,
    `marts_orders_${docId}`
  ];
  for (const key of localOrdersSources) {
    try {
      const raw = safeStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((o: Order) => {
            if (o && o.id && (o.customerEmail?.toLowerCase() === cleanEmail || o.userId === targetUid || o.userId === docId)) {
              ordersMap.set(o.id, o);
            }
          });
        }
      }
    } catch (_) {}
  }

  // Include cached addresses immediately - strictly user-scoped keys only
  const localAddressSources = [
    `marts_addresses_${targetUid}`,
    `marts_addresses_${docId}`
  ];
  for (const key of localAddressSources) {
    try {
      const raw = safeStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((a: AddressItem) => {
            if (a && a.id) addressesMap.set(a.id, a);
          });
        } else if (parsed && parsed.id) {
          addressesMap.set(parsed.id, parsed);
        }
      }
    } catch (_) {}
  }

  // Fire parallel queries for Firestore
  const queries: Promise<any>[] = [
    // 0: deterministic email document
    getDoc(doc(db, 'users', docId)).catch(() => null),
    // 1: customer orders in global collection
    getDocs(query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail))).catch(() => null),
    // 2: addresses under docId
    getDocs(collection(db, 'users', docId, 'addresses')).catch(() => null),
    // 3: orders under docId
    getDocs(collection(db, 'users', docId, 'orders')).catch(() => null)
  ];

  if (firebaseUid && firebaseUid !== docId) {
    queries.push(
      // 4: firebaseUid user doc
      getDoc(doc(db, 'users', firebaseUid)).catch(() => null),
      // 5: global orders by userId == firebaseUid
      getDocs(query(collection(db, 'orders'), where('userId', '==', firebaseUid))).catch(() => null),
      // 6: addresses under firebaseUid
      getDocs(collection(db, 'users', firebaseUid, 'addresses')).catch(() => null),
      // 7: orders under firebaseUid
      getDocs(collection(db, 'users', firebaseUid, 'orders')).catch(() => null)
    );
  }

  try {
    const results = await withTimeout(Promise.allSettled(queries), 1500);

    // Process docId
    const res0 = results[0];
    if (res0.status === 'fulfilled' && res0.value && typeof res0.value.exists === 'function' && res0.value.exists()) {
      remoteData = { ...remoteData, ...res0.value.data() };
    }
    // Process global customer orders
    const res1 = results[1];
    if (res1.status === 'fulfilled' && res1.value && typeof res1.value.forEach === 'function') {
      res1.value.forEach((d: any) => {
        const o = d.data() as Order;
        if (o && o.id) {
          const prev = ordersMap.get(o.id);
          if (!prev || (o.updatedAt || 0) >= (prev.updatedAt || 0)) {
            ordersMap.set(o.id, { ...prev, ...o });
          }
        }
      });
    }
    // Process addresses subcollection under docId
    const res2 = results[2];
    if (res2.status === 'fulfilled' && res2.value && typeof res2.value.forEach === 'function') {
      res2.value.forEach((d: any) => {
        const data = d.data();
        if (d.id !== 'default') {
          const item: AddressItem = {
            id: data.id || d.id,
            name: data.recipientName || data.name || '',
            phone: data.phone || data.phoneNumber || '',
            email: cleanEmail,
            pincode: data.postalCode || data.pin || data.pincode || '',
            houseNo: data.street || data.houseNo || '',
            area: [data.apartment, data.landmark].filter(Boolean).join(', ') || data.area || '',
            city: data.city || '',
            state: data.state || '',
            type: data.type || 'HOME',
            isDefault: data.isDefault === true
          };
          addressesMap.set(item.id, item);
        }
      });
    }
    // Process orders subcollection under docId
    const res3 = results[3];
    if (res3.status === 'fulfilled' && res3.value && typeof res3.value.forEach === 'function') {
      res3.value.forEach((d: any) => {
        const o = d.data() as Order;
        if (o && o.id) ordersMap.set(o.id, o);
      });
    }

    if (firebaseUid && firebaseUid !== docId) {
      // Process firebaseUid user doc
      const res4 = results[4];
      if (res4 && res4.status === 'fulfilled' && res4.value && typeof res4.value.exists === 'function' && res4.value.exists()) {
        remoteData = { ...res4.value.data(), ...remoteData };
      }
      // Process firebaseUid global orders
      const res5 = results[5];
      if (res5 && res5.status === 'fulfilled' && res5.value && typeof res5.value.forEach === 'function') {
        res5.value.forEach((d: any) => {
          const o = d.data() as Order;
          if (o && o.id) {
            const prev = ordersMap.get(o.id);
            if (!prev || (o.updatedAt || 0) >= (prev.updatedAt || 0)) {
              ordersMap.set(o.id, { ...prev, ...o });
            }
          }
        });
      }
      // Process firebaseUid addresses
      const res6 = results[6];
      if (res6 && res6.status === 'fulfilled' && res6.value && typeof res6.value.forEach === 'function') {
        res6.value.forEach((d: any) => {
          const data = d.data();
          if (d.id !== 'default') {
            const item: AddressItem = {
              id: data.id || d.id,
              name: data.recipientName || data.name || '',
              phone: data.phone || data.phoneNumber || '',
              email: cleanEmail,
              pincode: data.postalCode || data.pin || data.pincode || '',
              houseNo: data.street || data.houseNo || '',
              area: [data.apartment, data.landmark].filter(Boolean).join(', ') || data.area || '',
              city: data.city || '',
              state: data.state || '',
              type: data.type || 'HOME',
              isDefault: data.isDefault === true
            };
            addressesMap.set(item.id, item);
          }
        });
      }
      // Process firebaseUid orders subcollection
      const res7 = results[7];
      if (res7 && res7.status === 'fulfilled' && res7.value && typeof res7.value.forEach === 'function') {
        res7.value.forEach((d: any) => {
          const o = d.data() as Order;
          if (o && o.id) ordersMap.set(o.id, o);
        });
      }
    }
  } catch (_) {
    // Timeout or network notice - local data is already loaded!
  }

  const existingData = { ...localData, ...remoteData, ...(extraData || {}) };

  // Orders in existingData.orders
  if (Array.isArray(existingData.orders)) {
    existingData.orders.forEach((o: Order) => {
      if (o && o.id && !ordersMap.has(o.id)) ordersMap.set(o.id, o);
    });
  }

  const restoredOrders = Array.from(ordersMap.values()).sort((a, b) => {
    const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

  const dedupedAddresses = deduplicateAddresses(Array.from(addressesMap.values()));
  const defaultAddressItem = dedupedAddresses.find(a => a.isDefault) || dedupedAddresses[0];

  const deliveryAddr = existingData.deliveryAddress || existingData.shippingAddress;
  let addressStr = existingData.address || '';
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
  if (!addressStr && defaultAddressItem) {
    addressStr = `${defaultAddressItem.houseNo}, ${defaultAddressItem.area ? defaultAddressItem.area + ', ' : ''}${defaultAddressItem.city}, ${defaultAddressItem.state} ${defaultAddressItem.pincode}`.trim();
  }

  const finalName = providedName?.trim() || existingData.displayName || existingData.name || cleanEmail.split('@')[0];

  const restoredProfile: User = {
    name: finalName,
    displayName: finalName,
    businessName: existingData.businessName || '',
    phone: existingData.phoneNumber || existingData.phone || '',
    phoneNumber: existingData.phoneNumber || existingData.phone || '',
    email: cleanEmail,
    avatar: existingData.avatar || existingData.photoURL || undefined,
    address: addressStr,
    deliveryAddress: deliveryAddr,
    shippingAddress: existingData.shippingAddress || deliveryAddr,
    orders: restoredOrders,
    role: existingData.role || 'customer'
  };

  // Strictly user-scoped lightweight cache only (Cloud Firestore holds full orders & details)
  try {
    safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(restoredProfile)));
    if (dedupedAddresses.length > 0 && defaultAddressItem) {
      safeStorage.setItem(`marts_default_address_${targetUid}`, JSON.stringify(defaultAddressItem));
    }
    if (addressStr) {
      safeStorage.setItem(`marts_user_address_${targetUid}`, addressStr);
    }
    broadcastUserUpdate(restoredProfile);
  } catch (_) {}

  // Background non-blocking writes to Firestore (never freezes the UI or delays login redirect)
  (async () => {
    try {
      const updatePayload: Record<string, any> = {
        ...restoredProfile,
        updatedAt: new Date().toISOString()
      };
      if (newPasswordHash) {
        updatePayload.passwordHash = newPasswordHash;
      } else if (existingData.passwordHash) {
        updatePayload.passwordHash = existingData.passwordHash;
      }

      const syncWrites: Promise<any>[] = [
        setDoc(doc(db, 'users', docId), updatePayload, { merge: true }).catch(() => {})
      ];
      if (firebaseUid && firebaseUid !== docId) {
        syncWrites.push(setDoc(doc(db, 'users', firebaseUid), updatePayload, { merge: true }).catch(() => {}));
      }

      // Replicate addresses in parallel
      for (const addr of dedupedAddresses) {
        syncWrites.push(setDoc(doc(db, 'users', docId, 'addresses', addr.id), addr, { merge: true }).catch(() => {}));
        if (firebaseUid && firebaseUid !== docId) {
          syncWrites.push(setDoc(doc(db, 'users', firebaseUid, 'addresses', addr.id), addr, { merge: true }).catch(() => {}));
        }
      }

      // Replicate top orders to user subcollections in parallel
      for (const ord of restoredOrders.slice(0, 15)) {
        syncWrites.push(setDoc(doc(db, 'users', docId, 'orders', ord.id), ord, { merge: true }).catch(() => {}));
        if (firebaseUid && firebaseUid !== docId) {
          syncWrites.push(setDoc(doc(db, 'users', firebaseUid, 'orders', ord.id), ord, { merge: true }).catch(() => {}));
        }
      }

      await Promise.allSettled(syncWrites);
    } catch (_) {}
  })();

  return { user: restoredProfile, docId: targetUid };
};

/**
 * Unifies all user application data (profile, orders, addresses, cart, wishlist)
 * under the canonical authenticated Firebase User UID.
 * Reconciles legacy email-keyed records (marts_user_{email}) into users/{canonicalUid}
 * with zero data loss, atomic batches, and full idempotency.
 */
export const reconcileCanonicalUserData = async (
  canonicalUid: string,
  userEmail: string
): Promise<{ success: boolean; reconciledCount: number }> => {
  if (!canonicalUid || !userEmail) return { success: false, reconciledCount: 0 };
  const cleanEmail = userEmail.trim().toLowerCase();
  const legacyDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  if (legacyDocId === canonicalUid) return { success: true, reconciledCount: 0 };

  try {
    const legacyUserRef = doc(db, 'users', legacyDocId);
    const legacySnap = await getDoc(legacyUserRef).catch(() => null);

    // 1. Fetch any orders belonging to this email or legacyDocId
    const globalOrdersQuery = query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail));
    const globalOrdersSnap = await getDocs(globalOrdersQuery).catch(() => null);

    const legacyOrdersCol = collection(db, 'users', legacyDocId, 'orders');
    const legacyOrdersSnap = await getDocs(legacyOrdersCol).catch(() => null);

    const legacyAddrCol = collection(db, 'users', legacyDocId, 'addresses');
    const legacyAddrSnap = await getDocs(legacyAddrCol).catch(() => null);

    const batch = writeBatch(db);
    let operationCount = 0;

    // Migrate orders to canonical UID
    const seenOrderIds = new Set<string>();

    if (globalOrdersSnap && !globalOrdersSnap.empty) {
      globalOrdersSnap.forEach((docSnap) => {
        const orderData = docSnap.data() as Order;
        if (orderData && orderData.id && orderData.userId !== canonicalUid) {
          seenOrderIds.add(orderData.id);
          batch.update(docSnap.ref, { userId: canonicalUid, updatedAt: Date.now() });
          const userOrderRef = doc(db, 'users', canonicalUid, 'orders', orderData.id);
          batch.set(userOrderRef, { ...orderData, userId: canonicalUid }, { merge: true });
          operationCount += 2;
        }
      });
    }

    if (legacyOrdersSnap && !legacyOrdersSnap.empty) {
      legacyOrdersSnap.forEach((docSnap) => {
        const orderData = docSnap.data() as Order;
        if (orderData && orderData.id && !seenOrderIds.has(orderData.id)) {
          seenOrderIds.add(orderData.id);
          const userOrderRef = doc(db, 'users', canonicalUid, 'orders', orderData.id);
          batch.set(userOrderRef, { ...orderData, userId: canonicalUid }, { merge: true });
          operationCount += 1;
        }
      });
    }

    // Migrate addresses
    if (legacyAddrSnap && !legacyAddrSnap.empty) {
      legacyAddrSnap.forEach((docSnap) => {
        const addrData = docSnap.data();
        if (docSnap.id !== 'default') {
          const targetAddrRef = doc(db, 'users', canonicalUid, 'addresses', docSnap.id);
          batch.set(targetAddrRef, addrData, { merge: true });
          operationCount += 1;
        }
      });
    }

    // Migrate wishlist
    try {
      const legacyWishlistRef = doc(db, 'users', legacyDocId, 'wishlist', 'items');
      const legacyWishlistSnap = await getDoc(legacyWishlistRef).catch(() => null);
      if (legacyWishlistSnap && legacyWishlistSnap.exists()) {
        const canonicalWishlistRef = doc(db, 'users', canonicalUid, 'wishlist', 'items');
        const canonicalWishlistSnap = await getDoc(canonicalWishlistRef).catch(() => null);
        const legacyItems = legacyWishlistSnap.data().productIds || [];
        const canonicalItems = (canonicalWishlistSnap && canonicalWishlistSnap.exists()) ? (canonicalWishlistSnap.data().productIds || []) : [];
        const mergedWishlist = Array.from(new Set([...canonicalItems, ...legacyItems]));
        batch.set(canonicalWishlistRef, { productIds: mergedWishlist, updatedAt: Date.now() }, { merge: true });
        operationCount += 1;
      }
    } catch (_) {}

    // Migrate cart items
    try {
      const legacyCartSnap = await getDocs(collection(db, 'users', legacyDocId, 'cart')).catch(() => null);
      if (legacyCartSnap && !legacyCartSnap.empty) {
        legacyCartSnap.forEach(docSnap => {
          const itemData = docSnap.data();
          const targetCartRef = doc(db, 'users', canonicalUid, 'cart', docSnap.id);
          batch.set(targetCartRef, itemData, { merge: true });
          operationCount += 1;
        });
      }
    } catch (_) {}

    // Merge profile fields into canonical users/{canonicalUid}
    if (legacySnap && legacySnap.exists()) {
      const legacyData = legacySnap.data();
      const canonicalUserRef = doc(db, 'users', canonicalUid);
      const canonicalSnap = await getDoc(canonicalUserRef).catch(() => null);
      const existingCanonical = canonicalSnap?.exists() ? canonicalSnap.data() : {};

      const mergedProfile: Record<string, any> = {
        email: cleanEmail,
        uid: canonicalUid,
        name: existingCanonical?.name || legacyData?.name || existingCanonical?.displayName || legacyData?.displayName || 'Customer',
        displayName: existingCanonical?.displayName || legacyData?.displayName || existingCanonical?.name || legacyData?.name || 'Customer',
        phone: existingCanonical?.phone || legacyData?.phone || existingCanonical?.phoneNumber || legacyData?.phoneNumber || '',
        phoneNumber: existingCanonical?.phoneNumber || legacyData?.phoneNumber || existingCanonical?.phone || legacyData?.phone || '',
        deliveryAddress: existingCanonical?.deliveryAddress || legacyData?.deliveryAddress || null,
        shippingAddress: existingCanonical?.shippingAddress || legacyData?.shippingAddress || null,
        address: existingCanonical?.address || legacyData?.address || '',
        reconciledFrom: legacyDocId,
        reconciledAt: Date.now(),
        updatedAt: new Date().toISOString()
      };

      batch.set(canonicalUserRef, mergedProfile, { merge: true });
      batch.set(legacyUserRef, {
        reconciledTo: canonicalUid,
        reconciledAt: Date.now()
      }, { merge: true });
      operationCount += 2;
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    return { success: true, reconciledCount: operationCount };
  } catch (err) {
    console.warn('[Identity Reconciliation Notice]', err);
    return { success: false, reconciledCount: 0 };
  }
};

export const saveUserProfile = async (uid: string, profileData: Partial<User> & { gender?: string }): Promise<User> => {
  const cached = safeStorage.getItem(`marts_user_profile_${uid}`) || safeStorage.getItem('marts_user_profile');
  let current: User = cached ? JSON.parse(cached) : { name: '', phone: '', email: '', address: '', orders: [] };
  const updated: User = { ...current, ...profileData };
  safeStorage.setItem(`marts_user_profile_${uid}`, JSON.stringify(sanitizeUserForCache(updated)));
  safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updated)));
  if (profileData.address) {
    safeStorage.setItem(`marts_user_address_${uid}`, profileData.address);
  }
  broadcastUserUpdate(updated);

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
      try {
        safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updatedUser)));
        if (updatedUser.address) {
          safeStorage.setItem(`marts_user_address_${uid}`, updatedUser.address);
        }
      } catch (_) {}
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
    safeStorage.setItem('marts_products', JSON.stringify(sanitized));
    return sanitized;
  } catch (err) {
    console.warn('Firestore offline or products query timed out, using local cache:', err);
    try {
      const cached = safeStorage.getItem('marts_products');
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
      safeStorage.setItem('marts_products', JSON.stringify(sanitized));
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
      safeStorage.setItem(`marts_cart_${uid}`, JSON.stringify(items));
    }
    return items;
  } catch (err) {
    console.warn('Firestore offline when fetching cart, using local cache.');
    const cached = safeStorage.getItem(`marts_cart_${uid}`) || safeStorage.getItem('marts_cart');
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
  safeStorage.setItem(`marts_cart_${uid}`, JSON.stringify(cartItems));
  safeStorage.setItem('marts_cart', JSON.stringify(cartItems));
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
export const fetchUserAddresses = async (uid: string, fallbackEmail?: string): Promise<AddressItem[]> => {
  try {
    const addrColRef = collection(db, 'users', uid, 'addresses');
    const snapshot = await withTimeout(getDocs(addrColRef), 3000);
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

    // If still empty, check canonical email document users/marts_user_{cleanEmail}
    const cleanEmail = (fallbackEmail || (() => {
      try {
        const cached = safeStorage.getItem('marts_user_profile');
        if (cached) return JSON.parse(cached).email;
      } catch (_) {}
      return '';
    })()).trim().toLowerCase();

    if (rawAddresses.length === 0 && cleanEmail) {
      const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      if (emailDocId !== uid) {
        try {
          const emailAddrSnap = await withTimeout(getDocs(collection(db, 'users', emailDocId, 'addresses')), 2500);
          emailAddrSnap.forEach(d => {
            const data = d.data();
            if (d.id !== 'default') {
              const item: AddressItem = {
                id: data.id || d.id,
                name: data.recipientName || data.name || '',
                phone: data.phone || data.phoneNumber || '',
                email: cleanEmail,
                pincode: data.postalCode || data.pin || data.pincode || '',
                houseNo: data.street || data.houseNo || '',
                area: [data.apartment, data.landmark].filter(Boolean).join(', ') || data.area || '',
                city: data.city || '',
                state: data.state || '',
                type: data.type || 'HOME',
                isDefault: data.isDefault === true
              };
              rawAddresses.push(item);
              // Clone to current uid addresses subcollection
              setDoc(doc(db, 'users', uid, 'addresses', item.id), item, { merge: true }).catch(() => {});
            }
          });
        } catch (_) {}
      }
    }

    // Clean up legacy 'default' or 'addr_default' doc if other real addresses exist
    if (hasLegacyDefaultDoc && rawAddresses.some(a => a.id !== 'default')) {
      try {
        deleteDoc(doc(db, 'users', uid, 'addresses', 'default')).catch(() => {});
      } catch (_) {}
    }

    const uniqueAddresses = deduplicateAddresses(rawAddresses);

    if (uniqueAddresses.length > 0) {
      safeStorage.setItem(`marts_addresses_${uid}`, JSON.stringify(uniqueAddresses));
      const def = uniqueAddresses.find(a => a.isDefault) || uniqueAddresses[0];
      safeStorage.setItem(`marts_default_address_${uid}`, JSON.stringify(def));
    }
    return uniqueAddresses;
  } catch (err) {
    console.warn('Firestore offline when fetching addresses, using local storage.');
    const cached = safeStorage.getItem(`marts_addresses_${uid}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateAddresses(parsed);
        }
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

  safeStorage.setItem(`marts_addresses_${uid}`, JSON.stringify(dedupedAddresses));

  // Format full address string
  const formattedStr = `${addressWithId.houseNo}, ${addressWithId.area ? addressWithId.area + ', ' : ''}${addressWithId.city}, ${addressWithId.state} ${addressWithId.pincode}`.trim();
  if (isDefaultAddress) {
    safeStorage.setItem(`marts_default_address_${uid}`, JSON.stringify(updatedAddressItem));
    safeStorage.setItem(`marts_user_address_${uid}`, formattedStr);
  }

  // Universal profile sync across the entire app
  const cached = safeStorage.getItem(`marts_user_profile_${uid}`) || safeStorage.getItem('marts_user_profile');
  let currentProfile: User = cached ? JSON.parse(cached) : { name: '', phone: '', email: '', address: '', orders: [] };
  const updatedProfile: User = {
    ...currentProfile,
    ...(addressWithId.name ? { name: addressWithId.name, displayName: addressWithId.name } : {}),
    ...(addressWithId.phone ? { phone: addressWithId.phone, phoneNumber: addressWithId.phone } : {}),
    ...(isDefaultAddress ? { address: formattedStr } : {})
  };
  safeStorage.setItem(`marts_user_profile_${uid}`, JSON.stringify(sanitizeUserForCache(updatedProfile)));
  safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(updatedProfile)));
  broadcastUserUpdate(updatedProfile);

  try {
    const addrRef = doc(db, 'users', uid, 'addresses', addressWithId.id);
    await withTimeout(setDoc(addrRef, updatedAddressItem, { merge: true }), 2500);

    // Also replicate to canonical email doc for seamless cross-login restoration
    const targetEmail = (addressWithId.email || currentProfile.email || '').trim().toLowerCase();
    if (targetEmail) {
      const emailDocId = 'marts_user_' + targetEmail.replace(/[^a-zA-Z0-9]/g, '_');
      if (emailDocId !== uid) {
        setDoc(doc(db, 'users', emailDocId, 'addresses', addressWithId.id), updatedAddressItem, { merge: true }).catch(() => {});
        setDoc(doc(db, 'users', emailDocId), {
          ...(isDefaultAddress ? { address: formattedStr } : {}),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    }

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
  safeStorage.setItem(`marts_addresses_${uid}`, JSON.stringify(deduped));
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
    safeStorage.setItem(`marts_notifications_${uid}`, JSON.stringify(sorted));
    return sorted;
  } catch (err) {
    console.warn('Firestore offline when fetching notifications, using local cache.');
    const cached = safeStorage.getItem(`marts_notifications_${uid}`);
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
  safeStorage.setItem(`marts_notifications_${uid}`, JSON.stringify(updated));

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
  safeStorage.setItem(`marts_notifications_${uid}`, JSON.stringify(updated));

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
  safeStorage.setItem(`marts_notifications_${uid}`, JSON.stringify(updated));

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
export const fetchUserOrders = async (uid: string, fallbackEmail?: string): Promise<Order[]> => {
  const ordersMap = new Map<string, Order>();
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  try {
    // 0. Include cached orders immediately for instant UI
    const cachedSources = [
      `marts_orders_${uid}`,
      'marts_orders'
    ];
    if (cleanEmail) {
      const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      cachedSources.push(`marts_orders_${emailDocId}`);
    }
    for (const key of cachedSources) {
      try {
        const raw = safeStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((o: Order) => {
              if (o && o.id && (o.customerEmail?.toLowerCase() === cleanEmail || o.userId === uid || !o.customerEmail)) {
                ordersMap.set(o.id, o);
              }
            });
          }
        }
      } catch (_) {}
    }

    // Run all Firestore order queries in parallel with snappy timeout
    const orderPromises: Promise<any>[] = [
      getDocs(collection(db, 'users', uid, 'orders')).catch(() => null),
      getDocs(query(collection(db, 'orders'), where('userId', '==', uid))).catch(() => null)
    ];

    const emailDocId = cleanEmail ? 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : '';
    if (cleanEmail) {
      orderPromises.push(
        getDocs(query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail))).catch(() => null)
      );
      if (emailDocId && emailDocId !== uid) {
        orderPromises.push(
          getDocs(collection(db, 'users', emailDocId, 'orders')).catch(() => null)
        );
      }
    }

    const settled = await withTimeout(Promise.allSettled(orderPromises), 1800);
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value && typeof res.value.forEach === 'function') {
        res.value.forEach((docSnap: any) => {
          const o = docSnap.data() as Order;
          if (o && o.id) {
            const existing = ordersMap.get(o.id);
            if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
              ordersMap.set(o.id, { ...existing, ...o });
            }
          }
        });
      }
    }

    const orders = Array.from(ordersMap.values());
    const sorted = orders.sort((a, b) => {
      const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });

    if (sorted.length > 0) {
      safeStorage.setItem(`marts_orders_${uid}`, JSON.stringify(sorted));
      return sorted;
    }

    // Check user-scoped cached fallback only if firestore returned empty
    const cached = safeStorage.getItem(`marts_orders_${uid}`) || safeStorage.getItem('marts_orders');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  } catch (err) {
    console.warn('Firestore offline when fetching orders, using user-scoped local storage.');
    const cached = safeStorage.getItem(`marts_orders_${uid}`) || safeStorage.getItem('marts_orders');
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
  // Input validation & Anti-flood cooldown check
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    console.warn('Rejected empty order payload');
    return;
  }

  const effectiveUserId = uid || order.userId || 'guest';
  try {
    const lastOrderPlacedKey = `marts_last_order_ts_${effectiveUserId}`;
    const lastPlaced = Number(safeStorage.getItem(lastOrderPlacedKey) || 0);
    const now = Date.now();
    if (now - lastPlaced < 5000) {
      console.warn('Order duplicate submission blocked within 5 seconds cooldown');
      return;
    }
    safeStorage.setItem(lastOrderPlacedKey, String(now));
  } catch (_) {}

  const finalAddress = customerInfo?.address || order.customerAddress || '';

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

  // Immediately cache in safeStorage without blowing quota (Cloud Firestore is authoritative)
  try {
    safeStorage.setItem('marts_last_order_id', orderData.id);
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
        const localCachedRaw = safeStorage.getItem('marts_orders') || '[]';
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

      // Also mirror into canonical email user document if email is present
      if (orderData.customerEmail) {
        const cleanEmail = orderData.customerEmail.trim().toLowerCase();
        const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
        if (uid !== emailDocId) {
          const emailOrderRef = doc(db, 'users', emailDocId, 'orders', order.id);
          await withTimeout(setDoc(emailOrderRef, orderData), 2500).catch(() => {});
          await withTimeout(setDoc(doc(db, 'users', emailDocId), {
            updatedAt: new Date().toISOString()
          }, { merge: true }), 2500).catch(() => {});
        }
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
      safeStorage.setItem(`marts_orders_${targetUid}`, JSON.stringify(updated));
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
      safeStorage.setItem(`marts_wishlist_${uid}`, JSON.stringify(list));
      return list;
    }
    return [];
  } catch (err) {
    console.warn('Firestore offline when fetching wishlist, using local cache.');
    const cached = safeStorage.getItem(`marts_wishlist_${uid}`) || safeStorage.getItem('marts_wishlist');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  }
};

export const syncUserWishlistToFirestore = async (uid: string, wishlist: string[]): Promise<void> => {
  safeStorage.setItem(`marts_wishlist_${uid}`, JSON.stringify(wishlist));
  safeStorage.setItem('marts_wishlist', JSON.stringify(wishlist));
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
