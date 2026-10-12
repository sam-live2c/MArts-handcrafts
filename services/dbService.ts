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

/**
 * Resolves all candidate document IDs associated with a given email address.
 * An email may be linked to:
 * 1. A Google Auth UID (document in users where data.email == cleanEmail)
 * 2. An email-prefixed doc ID ('marts_user_' + sanitizedEmail)
 * 3. A raw email doc ID (e.g. users/prople.org@gmail.com)
 * 4. The currently authenticated or active session UID
 * By aggregating all candidate IDs, data (orders, addresses, profile) is 100% unified
 * regardless of whether the user signed in with Google or Email/Password or Email OTP.
 */
export async function getAssociatedUserIdsForEmail(
  email?: string | null,
  currentUid?: string | null
): Promise<string[]> {
  const ids = new Set<string>();
  if (currentUid && currentUid !== 'guest') {
    ids.add(currentUid);
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return Array.from(ids);
  }

  // 1. Raw email doc ID
  ids.add(cleanEmail);

  // 2. Deterministic sanitized doc ID
  const sanitizedId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  ids.add(sanitizedId);

  // 3. Query users collection for any documents where email == cleanEmail (discovers Google Auth UID)
  try {
    const qSnap = await withTimeout(
      getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))),
      2500
    ).catch(() => null);

    if (qSnap && !qSnap.empty) {
      qSnap.forEach((docSnap) => {
        if (docSnap.id) ids.add(docSnap.id);
      });
    }
  } catch (_) {}

  // 4. Also check if local storage has stored linked or reconciled user IDs
  try {
    const cachedStr = safeStorage.getItem(`marts_user_profile_${currentUid}`) || safeStorage.getItem('marts_user_profile');
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (parsed.uid) ids.add(parsed.uid);
      if (parsed.reconciledFrom) ids.add(parsed.reconciledFrom);
      if (parsed.reconciledTo) ids.add(parsed.reconciledTo);
    }
  } catch (_) {}

  return Array.from(ids);
}

/**
 * Verifies whether a user account is disabled or blocked by an admin from the admin panel
 */
export const checkUserBlockedStatus = async (
  uid?: string | null,
  email?: string | null
): Promise<{ isBlocked: boolean; reason?: string }> => {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const candidateIds = new Set<string>();

    if (uid && uid !== 'guest') candidateIds.add(uid);
    if (cleanEmail) {
      candidateIds.add(cleanEmail);
      candidateIds.add('marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
    }

    // Check direct user documents in Firestore
    for (const candId of Array.from(candidateIds)) {
      try {
        const uSnap = await withTimeout(getDoc(doc(db, 'users', candId)), 2000).catch(() => null);
        if (uSnap && uSnap.exists()) {
          const d = uSnap.data();
          if (
            d.isBlocked === true || 
            d.blocked === true || 
            d.status === 'blocked' || 
            d.disabled === true || 
            d.isActive === false ||
            d.role === 'blocked' ||
            d.userStatus === 'blocked'
          ) {
            return {
              isBlocked: true,
              reason: d.blockReason || d.reason || 'Your account has been blocked by the admin. You cannot place orders.'
            };
          }
        }
      } catch (_) {}
    }

    // Check if query returns any blocked records for this email
    if (cleanEmail) {
      try {
        const qSnap = await withTimeout(
          getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))),
          2000
        ).catch(() => null);

        if (qSnap && !qSnap.empty) {
          for (const docSnap of qSnap.docs) {
            const d = docSnap.data();
            if (
              d.isBlocked === true || 
              d.blocked === true || 
              d.status === 'blocked' || 
              d.disabled === true || 
              d.isActive === false ||
              d.role === 'blocked' ||
              d.userStatus === 'blocked'
            ) {
              return {
                isBlocked: true,
                reason: d.blockReason || d.reason || 'Your account has been blocked by the admin. You cannot place orders.'
              };
            }
          }
        }
      } catch (_) {}
    }

    return { isBlocked: false };
  } catch (err) {
    console.warn('Block status verification notice:', err);
    return { isBlocked: false };
  }
};

/**
 * Enables a user who authenticated via Google or without a password to set an email password
 * so their account can be logged into via email and password!
 */
export const setUserPassword = async (
  uid: string,
  email: string,
  passwordHash: string
): Promise<void> => {
  const cleanEmail = email.trim().toLowerCase();
  const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const now = Date.now();

  const updates = {
    passwordHash,
    hasPassword: true,
    updatedAt: now
  };

  const syncPromises: Promise<any>[] = [];
  if (uid && uid !== 'guest') {
    syncPromises.push(setDoc(doc(db, 'users', uid), updates, { merge: true }).catch(() => {}));
  }
  if (emailDocId) {
    syncPromises.push(setDoc(doc(db, 'users', emailDocId), updates, { merge: true }).catch(() => {}));
  }

  await Promise.all(syncPromises);

  // Update cached profile
  try {
    const cachedStr = safeStorage.getItem(`marts_user_profile_${uid}`) || safeStorage.getItem('marts_user_profile');
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      parsed.hasPassword = true;
      safeStorage.setItem(`marts_user_profile_${uid}`, JSON.stringify(parsed));
      safeStorage.setItem('marts_user_profile', JSON.stringify(parsed));
    }
  } catch (_) {}
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
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);

    // Fetch candidate user docs from Cloud Firestore
    const fetchPromises: Promise<any>[] = associatedUids.map(candId =>
      withTimeout(getDoc(doc(db, 'users', candId)), 2500).catch(() => null)
    );

    const docSnaps = await Promise.all(fetchPromises);
    const validSnaps = docSnaps.filter(s => s && s.exists());

    if (validSnaps.length > 0) {
      // Find the primary document (prefer uid doc if exists, else first existing doc)
      const primarySnap = validSnaps.find(s => s.id === uid) || validSnaps[0];
      const data = primarySnap.data();

      // Collect data merged from all candidate docs (e.g. Google doc might have avatar/name, email doc might have address)
      let mergedData: Record<string, any> = {};
      for (const s of validSnaps) {
        mergedData = { ...s.data(), ...mergedData };
      }
      mergedData = { ...mergedData, ...data }; // primary overrides

      const userEmail = (mergedData.email || cleanEmail || '').trim().toLowerCase();
      const deliveryAddr = (mergedData.deliveryAddress || mergedData.shippingAddress) as StoreDeliveryAddress | undefined;
      let addressStr = (typeof mergedData.address === 'string' ? mergedData.address : '') || '';

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

      // Check cached orders strictly scoped to candidate UIDs
      const ordMap = new Map<string, Order>();
      for (const candId of associatedUids) {
        try {
          const raw = safeStorage.getItem(`marts_orders_${candId}`);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) arr.forEach((o: Order) => { if (o && o.id) ordMap.set(String(o.id), o); });
          }
        } catch (_) {}
      }
      // Add orders stored in any candidate document's orders array
      for (const s of validSnaps) {
        const sData = s.data();
        if (Array.isArray(sData.orders)) {
          sData.orders.forEach((o: Order) => { if (o && o.id) ordMap.set(String(o.id), o); });
        }
      }

      // Refresh full unified orders in background from Cloud Firebase
      fetchUserOrders(uid, userEmail).catch(() => {});

      const userProfile: User = {
        name: mergedData.displayName || mergedData.name || cachedUser?.name || 'Customer',
        displayName: mergedData.displayName || mergedData.name || cachedUser?.displayName || 'Customer',
        businessName: mergedData.businessName || '',
        phone: String(mergedData.phoneNumber || mergedData.phone || cachedUser?.phone || ''),
        phoneNumber: String(mergedData.phoneNumber || mergedData.phone || cachedUser?.phoneNumber || ''),
        email: userEmail || cachedUser?.email || '',
        avatar: mergedData.avatar || mergedData.photoURL || cachedUser?.avatar || undefined,
        address: addressStr || '',
        deliveryAddress: deliveryAddr,
        shippingAddress: mergedData.shippingAddress || deliveryAddr,
        orders: Array.from(ordMap.values()).sort((a, b) => {
          const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
          const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
          if (timeA && timeB && timeA !== timeB) return timeB - timeA;
          return String(b?.id || '').localeCompare(String(a?.id || ''));
        }),
        role: mergedData.role || 'customer',
        isBlocked: Boolean(mergedData.isBlocked || mergedData.blocked || mergedData.status === 'blocked' || mergedData.disabled || mergedData.isActive === false),
        blocked: Boolean(mergedData.isBlocked || mergedData.blocked || mergedData.status === 'blocked' || mergedData.disabled || mergedData.isActive === false),
        status: mergedData.status || (mergedData.isBlocked || mergedData.blocked || mergedData.disabled ? 'blocked' : 'active'),
        disabled: Boolean(mergedData.disabled || mergedData.isBlocked || mergedData.blocked),
        blockReason: mergedData.blockReason || mergedData.reason || undefined,
        hasPassword: Boolean(mergedData.passwordHash),
        linkedProviders: mergedData.linkedProviders || []
      };

      safeStorage.setItem(`marts_user_profile_${uid}`, JSON.stringify(sanitizeUserForCache(userProfile)));
      safeStorage.setItem('marts_user_profile', JSON.stringify(sanitizeUserForCache(userProfile)));

      return userProfile;
    }

    // If no candidate user docs exist yet, but we have cleanEmail, restore from existing email account!
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

  try {
    // 1. Fetch deterministic email document and any user document registered with this email in parallel
    const [snapDoc, querySnap] = await withTimeout(Promise.all([
      getDoc(doc(db, 'users', docId)).catch(() => null),
      getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail))).catch(() => null)
    ]), 2500);

    let foundData: any = null;
    let foundDocId: string = docId;

    if (snapDoc && snapDoc.exists()) {
      foundData = snapDoc.data();
      foundDocId = snapDoc.id;
    }

    if (querySnap && !querySnap.empty) {
      // Pick document that has more details (like passwordHash or linkedProviders)
      querySnap.forEach((d) => {
        const qData = d.data();
        if (!foundData) {
          foundData = qData;
          foundDocId = d.id;
        } else if (qData.passwordHash && !foundData.passwordHash) {
          foundData = { ...foundData, ...qData, passwordHash: qData.passwordHash };
          foundDocId = d.id;
        } else {
          foundData = { ...foundData, ...qData };
        }
      });
    }

    if (foundData) {
      const data = foundData;
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
        role: data.role || 'customer',
        isBlocked: Boolean(data.isBlocked || data.blocked || data.status === 'blocked' || data.disabled || data.isActive === false || data.role === 'blocked'),
        blocked: Boolean(data.isBlocked || data.blocked || data.status === 'blocked' || data.disabled || data.isActive === false || data.role === 'blocked'),
        status: data.status || ((data.isBlocked || data.blocked || data.disabled || data.isActive === false) ? 'blocked' : 'active'),
        disabled: Boolean(data.disabled || data.isBlocked || data.blocked),
        blockReason: data.blockReason || data.reason || undefined,
        hasPassword: Boolean(data.passwordHash),
        linkedProviders: data.linkedProviders || []
      };

      return {
        exists: true,
        docId: foundDocId,
        data,
        user: userProfile
      };
    }
  } catch (err) {
    console.warn('findUserAccountByEmail Firestore query notice:', err);
  }

  // Fallback to local cache only if Firestore was completely offline/unreachable
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

  // 2. Resolve all associated candidate user IDs (Google UIDs, email doc IDs, etc.)
  const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, targetUid);

  let remoteData: any = {};
  const ordersMap = new Map<string, Order>();
  const addressesMap = new Map<string, AddressItem>();

  // Include cached orders immediately across all associated keys
  for (const candId of associatedUids) {
    const candidateKeys = [
      `marts_orders_${candId}`,
      'marts_orders',
      `marts_orders_${cleanEmail}`
    ];
    for (const key of candidateKeys) {
      try {
        const raw = safeStorage.getItem(key);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            arr.forEach((o: Order) => {
              if (o && o.id) {
                ordersMap.set(String(o.id), o);
              }
            });
          }
        }
      } catch (_) {}
    }
  }

  // Include cached addresses immediately across all candidate keys
  for (const candId of associatedUids) {
    const localAddressSources = [
      `marts_addresses_${candId}`,
      `marts_default_address_${candId}`
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
  }

  // Fire parallel queries for Firestore across all candidate UIDs
  const queries: Promise<any>[] = [
    // global customer orders by email
    getDocs(query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail))).catch(() => null)
  ];

  for (const candId of associatedUids) {
    queries.push(getDoc(doc(db, 'users', candId)).catch(() => null));
    queries.push(getDocs(collection(db, 'users', candId, 'addresses')).catch(() => null));
    queries.push(getDocs(collection(db, 'users', candId, 'orders')).catch(() => null));
    queries.push(getDocs(query(collection(db, 'orders'), where('userId', '==', candId))).catch(() => null));
  }

  try {
    const results = await withTimeout(Promise.allSettled(queries), 3500);

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        const val = res.value;
        if (typeof val.forEach === 'function') {
          val.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (!data) return;

            // Address doc
            if (data.pincode || data.postalCode || data.pin || data.houseNo || data.street) {
              if (docSnap.id !== 'default') {
                const item: AddressItem = {
                  id: data.id || docSnap.id,
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
            } else if (data.items || data.pricing || data.total !== undefined || docSnap.ref.parent.id === 'orders') {
              // Order doc
              const o = data as Order;
              const orderId = String(o.id || docSnap.id);
              if (orderId) {
                const prev = ordersMap.get(orderId);
                if (!prev || (o.updatedAt || 0) >= (prev.updatedAt || 0)) {
                  ordersMap.set(orderId, { ...prev, ...o, id: orderId });
                }
              }
            }
          });
        } else if (typeof val.data === 'function') {
          // User document snapshot
          const dData = val.data();
          if (dData) {
            remoteData = { ...dData, ...remoteData };
            if (Array.isArray(dData.orders)) {
              dData.orders.forEach((o: Order) => {
                if (o && o.id) {
                  const orderId = String(o.id);
                  const prev = ordersMap.get(orderId);
                  if (!prev || (o.updatedAt || 0) >= (prev.updatedAt || 0)) {
                    ordersMap.set(orderId, { ...prev, ...o });
                  }
                }
              });
            }
          }
        }
      }
    }
  } catch (_) {
    // Timeout or network notice - local data is already loaded!
  }

  const existingData = { ...localData, ...remoteData, ...(extraData || {}) };

  // Orders in existingData.orders
  if (Array.isArray(existingData.orders)) {
    existingData.orders.forEach((o: Order) => {
      if (o && o.id && !ordersMap.has(String(o.id))) ordersMap.set(String(o.id), o);
    });
  }

  const restoredOrders = Array.from(ordersMap.values()).sort((a, b) => {
    const timeA = a.createdAt || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.createdAt || (b.date ? new Date(b.date).getTime() : 0);
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    return String(b.id || '').localeCompare(String(a.id || ''));
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
    role: existingData.role || 'customer',
    isBlocked: Boolean(existingData.isBlocked || existingData.blocked || existingData.status === 'blocked' || existingData.disabled || existingData.isActive === false || existingData.role === 'blocked'),
    blocked: Boolean(existingData.isBlocked || existingData.blocked || existingData.status === 'blocked' || existingData.disabled || existingData.isActive === false || existingData.role === 'blocked'),
    status: existingData.status || ((existingData.isBlocked || existingData.blocked || existingData.disabled || existingData.isActive === false) ? 'blocked' : 'active'),
    disabled: Boolean(existingData.disabled || existingData.isBlocked || existingData.blocked),
    blockReason: existingData.blockReason || existingData.reason || undefined,
    hasPassword: Boolean(existingData.passwordHash || (newPasswordHash ? true : false)),
    linkedProviders: existingData.linkedProviders || []
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
      if (firebaseUid && firebaseUid !== docId) {
        await reconcileCanonicalUserData(firebaseUid, cleanEmail).catch(() => {});
      }
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
        passwordHash: existingCanonical?.passwordHash || legacyData?.passwordHash || null,
        linkedProviders: Array.from(new Set([...(existingCanonical?.linkedProviders || []), ...(legacyData?.linkedProviders || [])])),
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
        orders: data.orders || [],
        role: data.role || 'customer',
        isBlocked: Boolean(data.isBlocked || data.blocked || data.status === 'blocked' || data.disabled || data.isActive === false),
        blocked: Boolean(data.isBlocked || data.blocked || data.status === 'blocked' || data.disabled || data.isActive === false),
        status: data.status || (data.isBlocked || data.blocked || data.disabled ? 'blocked' : 'active'),
        disabled: Boolean(data.disabled || data.isBlocked || data.blocked),
        blockReason: data.blockReason || data.reason || undefined,
        hasPassword: Boolean(data.passwordHash),
        linkedProviders: data.linkedProviders || []
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
export const fetchUserCart = async (uid: string, fallbackEmail?: string): Promise<CartItem[]> => {
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  try {
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);
    const itemsMap = new Map<string, CartItem>();

    // 0. Check local caches for all associated UIDs
    for (const candId of associatedUids) {
      const cached = safeStorage.getItem(`marts_cart_${candId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: CartItem) => {
              if (item && item.id) itemsMap.set(item.id, item);
            });
          }
        } catch (_) {}
      }
    }

    // Query Firestore cart collections for all candidate UIDs
    const cartPromises = associatedUids.map(candId =>
      withTimeout(getDocs(collection(db, 'users', candId, 'cart')), 2500).catch(() => null)
    );

    const snapshots = await Promise.all(cartPromises);
    for (const snap of snapshots) {
      if (snap && typeof snap.forEach === 'function') {
        snap.forEach(docSnap => {
          const item = docSnap.data() as CartItem;
          if (item && item.id && !itemsMap.has(item.id)) {
            itemsMap.set(item.id, item);
          }
        });
      }
    }

    const items = Array.from(itemsMap.values());
    if (items.length > 0) {
      for (const candId of associatedUids) {
        safeStorage.setItem(`marts_cart_${candId}`, JSON.stringify(items));
      }
      safeStorage.setItem('marts_cart', JSON.stringify(items));
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

export const syncUserCartToFirestore = async (uid: string, cartItems: CartItem[], fallbackEmail?: string): Promise<void> => {
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  try {
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);
    for (const candId of associatedUids) {
      safeStorage.setItem(`marts_cart_${candId}`, JSON.stringify(cartItems));
    }
    safeStorage.setItem('marts_cart', JSON.stringify(cartItems));

    // Sync to all candidate user cart subcollections
    for (const candId of associatedUids) {
      if (!candId || candId === 'guest') continue;
      const cartColRef = collection(db, 'users', candId, 'cart');
      const snapshot = await withTimeout(getDocs(cartColRef), 2000).catch(() => null);

      const batch = writeBatch(db);
      if (snapshot) {
        snapshot.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
      }
      for (const item of cartItems) {
        const itemRef = doc(db, 'users', candId, 'cart', item.id);
        batch.set(itemRef, item);
      }
      await withTimeout(batch.commit(), 2000).catch(() => {});
    }
  } catch (err) {
    console.warn('Firestore offline when syncing cart, saved to local storage.');
  }
};

// ================= ADDRESSES =================
export const fetchUserAddresses = async (uid: string, fallbackEmail?: string): Promise<AddressItem[]> => {
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  try {
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);
    const rawAddresses: AddressItem[] = [];
    let hasLegacyDefaultDoc = false;

    // Check cached addresses across all associated UIDs
    for (const candId of associatedUids) {
      const cached = safeStorage.getItem(`marts_addresses_${candId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) rawAddresses.push(...parsed);
        } catch (_) {}
      }
    }

    // Query addresses subcollections across all candidate UIDs
    const addrPromises = associatedUids.map(candId =>
      withTimeout(getDocs(collection(db, 'users', candId, 'addresses')), 2500).catch(() => null)
    );
    // Also fetch user docs to check deliveryAddress/shippingAddress field
    const userDocPromises = associatedUids.map(candId =>
      withTimeout(getDoc(doc(db, 'users', candId)), 2000).catch(() => null)
    );

    const [addrSnaps, userDocSnaps] = await Promise.all([
      Promise.all(addrPromises),
      Promise.all(userDocPromises)
    ]);

    for (const snapshot of addrSnaps) {
      if (snapshot && typeof snapshot.forEach === 'function') {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (docSnap.id === 'default') {
            hasLegacyDefaultDoc = true;
          }
          const item: AddressItem = {
            id: data.id || docSnap.id,
            name: data.recipientName || data.name || '',
            phone: data.phone || data.phoneNumber || '',
            email: cleanEmail || data.email || '',
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
      }
    }

    // If addresses subcollections were empty, extract from user documents deliveryAddress
    for (const userDoc of userDocSnaps) {
      if (userDoc && userDoc.exists()) {
        const uData = userDoc.data();
        const dAddr = (uData.deliveryAddress || uData.shippingAddress) as StoreDeliveryAddress | undefined;
        if (dAddr && typeof dAddr === 'object' && (dAddr.street || dAddr.postalCode)) {
          const defaultItem: AddressItem = {
            id: 'addr_default',
            name: dAddr.recipientName || uData.displayName || uData.name || 'Customer',
            phone: dAddr.phone || uData.phoneNumber || uData.phone || '',
            email: cleanEmail || uData.email || '',
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
    }

    // Clean up legacy 'default' or 'addr_default' doc if other real addresses exist
    if (hasLegacyDefaultDoc && rawAddresses.some(a => a.id !== 'default')) {
      for (const candId of associatedUids) {
        try {
          deleteDoc(doc(db, 'users', candId, 'addresses', 'default')).catch(() => {});
        } catch (_) {}
      }
    }

    const uniqueAddresses = deduplicateAddresses(rawAddresses);

    if (uniqueAddresses.length > 0) {
      for (const candId of associatedUids) {
        safeStorage.setItem(`marts_addresses_${candId}`, JSON.stringify(uniqueAddresses));
        const def = uniqueAddresses.find(a => a.isDefault) || uniqueAddresses[0];
        safeStorage.setItem(`marts_default_address_${candId}`, JSON.stringify(def));
      }
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
    // Resolve all candidate document IDs associated with this email
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);

    // 0. Include all cached orders immediately across all possible associated candidate scopes
    for (const candId of associatedUids) {
      const candidateKeys = [
        `marts_orders_${candId}`,
        'marts_orders',
        `marts_orders_${cleanEmail}`
      ];
      for (const key of candidateKeys) {
        try {
          const raw = safeStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((o: Order) => {
                if (o && o.id) {
                  ordersMap.set(String(o.id), o);
                }
              });
            }
          }
        } catch (_) {}
      }
    }

    // Run parallel queries across all candidate user documents, subcollections, and global orders
    const orderPromises: Promise<any>[] = [];

    // Query subcollections, user docs, and global orders by userId for every candidate ID
    for (const candId of associatedUids) {
      orderPromises.push(getDocs(collection(db, 'users', candId, 'orders')).catch(() => null));
      orderPromises.push(getDoc(doc(db, 'users', candId)).catch(() => null));
      orderPromises.push(getDocs(query(collection(db, 'orders'), where('userId', '==', candId))).catch(() => null));
    }

    // Also query global orders by customerEmail
    if (cleanEmail) {
      orderPromises.push(
        getDocs(query(collection(db, 'orders'), where('customerEmail', '==', cleanEmail))).catch(() => null)
      );
    }

    const settled = await withTimeout(Promise.allSettled(orderPromises), 8000);
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value) {
        const val = res.value;
        // Check if query snapshot or collection snapshot
        if (typeof val.forEach === 'function') {
          val.forEach((docSnap: any) => {
            const o = docSnap.data() as Order;
            const orderId = String(o?.id || docSnap.id);
            if (orderId && o && (o.items || o.pricing || o.total !== undefined || docSnap.ref.parent.id === 'orders')) {
              const existing = ordersMap.get(orderId);
              if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
                ordersMap.set(orderId, { ...existing, ...o, id: orderId });
              }
            }
          });
        } else if (typeof val.data === 'function') {
          // Document snapshot (users/{candId})
          const dData = val.data();
          if (dData && Array.isArray(dData.orders)) {
            dData.orders.forEach((o: Order) => {
              if (o && o.id) {
                const orderId = String(o.id);
                const existing = ordersMap.get(orderId);
                if (!existing || (o.updatedAt || 0) >= (existing.updatedAt || 0)) {
                  ordersMap.set(orderId, { ...existing, ...o });
                }
              }
            });
          }
        }
      }
    }

    const orders = Array.from(ordersMap.values());
    const sorted = orders.sort((a, b) => {
      const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
      const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

    if (sorted.length > 0) {
      // Replicate across all candidate caches
      for (const candId of associatedUids) {
        safeStorage.setItem(`marts_orders_${candId}`, JSON.stringify(sorted));
      }
      safeStorage.setItem('marts_orders', JSON.stringify(sorted));
      if (cleanEmail) {
        safeStorage.setItem(`marts_orders_${cleanEmail}`, JSON.stringify(sorted));
      }

      // Background non-blocking sync: propagate orders to candidate user subcollections & global orders
      (async () => {
        try {
          const primaryUid = uid && uid !== 'guest' ? uid : associatedUids[0];
          for (const ord of sorted) {
            if (primaryUid) {
              setDoc(doc(db, 'users', primaryUid, 'orders', ord.id), ord, { merge: true }).catch(() => {});
            }
            if (cleanEmail) {
              const emailDocId = 'marts_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
              setDoc(doc(db, 'users', emailDocId, 'orders', ord.id), ord, { merge: true }).catch(() => {});
            }
            setDoc(doc(db, 'orders', ord.id), {
              ...ord,
              customerEmail: ord.customerEmail || cleanEmail
            }, { merge: true }).catch(() => {});
          }
          if (primaryUid) {
            setDoc(doc(db, 'users', primaryUid), { orders: sorted, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
          }
        } catch (_) {}
      })();

      return sorted;
    }

    // Return current orders in map even if Firestore returned 0 docs
    return sorted;
  } catch (err) {
    console.warn('Notice when fetching orders, using cached order store:', err);
    return Array.from(ordersMap.values()).sort((a, b) => {
      const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
      const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
  }
};

/**
 * Helper to count orders placed by the user within the current day (last 24 hours / today)
 * Enforces the strict rule: "Order in a day is only 3"
 */
export const countOrdersToday = (orders: Order[]): number => {
  if (!Array.isArray(orders) || orders.length === 0) return 0;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  // Consider whichever is more restrictive (calendar day or 24-hour window)
  const cutoff = Math.min(startOfDay, twentyFourHoursAgo);

  return orders.filter(o => {
    if (!o) return false;
    // Exclude cancelled or failed attempts
    if (o.status === 'Cancelled') return false;
    const orderTime = o.createdAt || (o.date ? new Date(o.date).getTime() : 0);
    return orderTime >= cutoff;
  }).length;
};

/**
 * Checks if the current customer has exceeded the limit of 3 orders in a day
 */
export const checkDailyOrderLimit = async (
  uid: string | null,
  email?: string
): Promise<{ allowed: boolean; countToday: number; remaining: number; error?: string }> => {
  const MAX_PER_DAY = 3;
  try {
    const orders = uid && uid !== 'guest' ? await fetchUserOrders(uid, email) : [];
    const count = countOrdersToday(orders);
    const remaining = Math.max(0, MAX_PER_DAY - count);

    if (count >= MAX_PER_DAY) {
      return {
        allowed: false,
        countToday: count,
        remaining: 0,
        error: `Daily order limit reached. You can only place up to ${MAX_PER_DAY} orders per day. Please try again tomorrow.`
      };
    }

    return {
      allowed: true,
      countToday: count,
      remaining
    };
  } catch {
    return { allowed: true, countToday: 0, remaining: MAX_PER_DAY };
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
  const effectiveEmail = customerInfo?.email || order.customerEmail;

  // Verify user is not blocked by admin from placing orders
  const blockedCheck = await checkUserBlockedStatus(effectiveUserId, effectiveEmail);
  if (blockedCheck.isBlocked) {
    const blockMsg = blockedCheck.reason || 'Your account has been blocked by the admin. You cannot place orders.';
    console.warn(`[Security Guard] Order placement blocked for user ${effectiveUserId} (${effectiveEmail}): ${blockMsg}`);
    throw new Error(blockMsg);
  }

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
      const cleanEmail = (orderData.customerEmail || customerInfo?.email || '').trim().toLowerCase();
      const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, effectiveUserId);

      // 1. Write to global orders collection
      const globalOrderRef = doc(db, 'orders', order.id);
      await withTimeout(setDoc(globalOrderRef, { ...orderData, customerEmail: cleanEmail || orderData.customerEmail }), 3500).catch(e => {
        console.warn('Global order setDoc notice:', e);
      });

      // 2. Gather all existing orders across candidate caches and merge with orderData
      const existingMap = new Map<string, Order>();
      existingMap.set(orderData.id, orderData);

      const candidateKeys = ['marts_orders'];
      if (cleanEmail) {
        candidateKeys.push(`marts_orders_${cleanEmail}`);
      }
      for (const candId of associatedUids) {
        candidateKeys.push(`marts_orders_${candId}`);
      }

      for (const k of candidateKeys) {
        try {
          const raw = safeStorage.getItem(k);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((o: Order) => {
                if (o && o.id && !existingMap.has(String(o.id))) {
                  existingMap.set(String(o.id), o);
                }
              });
            }
          }
        } catch (_) {}
      }

      // Check candidate user docs to preserve any other orders
      for (const candId of associatedUids) {
        try {
          const uDocSnap = await getDoc(doc(db, 'users', candId)).catch(() => null);
          if (uDocSnap && uDocSnap.exists()) {
            const uData = uDocSnap.data();
            if (Array.isArray(uData.orders)) {
              uData.orders.forEach((o: Order) => {
                if (o && o.id && !existingMap.has(String(o.id))) {
                  existingMap.set(String(o.id), o);
                }
              });
            }
          }
        } catch (_) {}
      }

      const allOrdersToSync = Array.from(existingMap.values()).sort((a, b) => {
        const timeA = Number(a?.createdAt) || (a?.date ? new Date(a.date).getTime() : 0) || 0;
        const timeB = Number(b?.createdAt) || (b?.date ? new Date(b.date).getTime() : 0) || 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
      });

      // Cache across all candidate keys
      for (const k of candidateKeys) {
        try { safeStorage.setItem(k, JSON.stringify(allOrdersToSync)); } catch (_) {}
      }

      // Sync order to subcollections and user docs for all associated UIDs
      for (const candId of associatedUids) {
        if (candId && candId !== 'guest') {
          // Write to subcollection
          const userOrderRef = doc(db, 'users', candId, 'orders', order.id);
          setDoc(userOrderRef, orderData, { merge: true }).catch(() => {});
          // Update user doc orders array
          setDoc(doc(db, 'users', candId), {
            orders: allOrdersToSync,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
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
export const fetchUserWishlist = async (uid: string, fallbackEmail?: string): Promise<string[]> => {
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  const itemsSet = new Set<string>();

  try {
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);

    // 0. Check local caches for all associated candidate IDs
    for (const candId of associatedUids) {
      const cached = safeStorage.getItem(`marts_wishlist_${candId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) parsed.forEach((id: string) => itemsSet.add(id));
        } catch (_) {}
      }
    }
    const globalCached = safeStorage.getItem('marts_wishlist');
    if (globalCached) {
      try {
        const parsed = JSON.parse(globalCached);
        if (Array.isArray(parsed)) parsed.forEach((id: string) => itemsSet.add(id));
      } catch (_) {}
    }

    const promises = associatedUids.map(candId =>
      withTimeout(getDoc(doc(db, 'users', candId, 'wishlist', 'items')), 2500).catch(() => null)
    );
    const docSnaps = await Promise.all(promises);
    for (const snap of docSnaps) {
      if (snap && snap.exists()) {
        const list = snap.data().productIds || [];
        if (Array.isArray(list)) {
          list.forEach((id: string) => itemsSet.add(id));
        }
      }
    }

    const result = Array.from(itemsSet);
    if (result.length > 0) {
      for (const candId of associatedUids) {
        safeStorage.setItem(`marts_wishlist_${candId}`, JSON.stringify(result));
      }
      safeStorage.setItem('marts_wishlist', JSON.stringify(result));
    }
    return result;
  } catch (err) {
    console.warn('Firestore offline when fetching wishlist, using local cache.');
    const cached = safeStorage.getItem(`marts_wishlist_${uid}`) || safeStorage.getItem('marts_wishlist');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return Array.from(itemsSet);
  }
};

export const syncUserWishlistToFirestore = async (uid: string, wishlist: string[], fallbackEmail?: string): Promise<void> => {
  const cleanEmail = (fallbackEmail || (() => {
    try {
      const cached = safeStorage.getItem('marts_user_profile');
      if (cached) return JSON.parse(cached).email;
    } catch (_) {}
    return '';
  })()).trim().toLowerCase();

  safeStorage.setItem(`marts_wishlist_${uid}`, JSON.stringify(wishlist));
  safeStorage.setItem('marts_wishlist', JSON.stringify(wishlist));

  try {
    const associatedUids = await getAssociatedUserIdsForEmail(cleanEmail, uid);
    for (const candId of associatedUids) {
      safeStorage.setItem(`marts_wishlist_${candId}`, JSON.stringify(wishlist));
    }

    const promises = associatedUids.map(candId =>
      withTimeout(setDoc(doc(db, 'users', candId, 'wishlist', 'items'), {
        productIds: wishlist,
        updatedAt: Date.now()
      }, { merge: true }), 2000).catch(() => {})
    );
    await Promise.allSettled(promises);
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
