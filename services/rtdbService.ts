import { rtdb, auth } from '../firebase';
import { 
  ref, 
  set, 
  get, 
  update, 
  remove, 
  push, 
  onValue, 
  off, 
  serverTimestamp 
} from 'firebase/database';

export interface RealtimeAnnouncement {
  id?: string;
  message: string;
  type: 'info' | 'sale' | 'alert';
  active: boolean;
  createdAt: number;
}

export interface LiveOrderTracking {
  orderId: string;
  userId: string;
  status: 'Processing' | 'Handcrafted' | 'Packed' | 'Shipped' | 'Out for Delivery' | 'Delivered';
  location?: string;
  eta?: string;
  updatedAt: number;
}

/**
 * Update user's live presence status
 */
export async function setUserPresence(uid: string, isOnline: boolean = true): Promise<void> {
  try {
    const userStatusRef = ref(rtdb, `status/${uid}`);
    await set(userStatusRef, {
      state: isOnline ? 'online' : 'offline',
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.warn('Realtime Database presence notice:', error);
  }
}

/**
 * Subscribe to live order tracking status
 */
export function subscribeToOrderTracking(
  orderId: string, 
  onUpdate: (tracking: LiveOrderTracking | null) => void
): () => void {
  const orderRef = ref(rtdb, `live_orders/${orderId}`);
  const callback = (snapshot: any) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val());
    } else {
      onUpdate(null);
    }
  };

  onValue(orderRef, callback);
  return () => off(orderRef, 'value', callback);
}

/**
 * Publish live order update to Realtime Database
 */
export async function publishLiveOrderUpdate(tracking: LiveOrderTracking): Promise<void> {
  try {
    const orderRef = ref(rtdb, `live_orders/${tracking.orderId}`);
    await set(orderRef, {
      ...tracking,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.warn('Realtime Database order update notice:', error);
  }
}

/**
 * Subscribe to live store announcements banner
 */
export function subscribeToStoreAnnouncement(
  onUpdate: (announcement: RealtimeAnnouncement | null) => void
): () => void {
  const announcementRef = ref(rtdb, 'announcements/current');
  const callback = (snapshot: any) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val());
    } else {
      onUpdate(null);
    }
  };

  onValue(announcementRef, callback);
  return () => off(announcementRef, 'value', callback);
}

/**
 * Write a store announcement to Realtime Database
 */
export async function setStoreAnnouncement(announcement: Omit<RealtimeAnnouncement, 'createdAt'>): Promise<void> {
  try {
    const announcementRef = ref(rtdb, 'announcements/current');
    await set(announcementRef, {
      ...announcement,
      createdAt: Date.now()
    });
  } catch (error) {
    console.warn('Realtime Database announcement notice:', error);
  }
}
