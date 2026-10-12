export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayOptions {
  amount: number; // in INR rupees
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
}

/**
 * Loads the official Razorpay script dynamically if not already loaded.
 */
export const loadRazorpayScript = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if ((window as any).Razorpay) return true;

  // Check if already in DOM from index.html or previous run
  const existingScript = 
    document.getElementById('razorpay-sdk-script') ||
    document.querySelector('script[src*="checkout.razorpay.com"]');

  if (existingScript) {
    // Wait briefly if script is still loading in DOM
    for (let i = 0; i < 20; i++) {
      if ((window as any).Razorpay) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    if ((window as any).Razorpay) return true;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = 'razorpay-sdk-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(Boolean((window as any).Razorpay));
      }
    }, 6000);

    script.onload = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        resolve(true);
      }
    };

    script.onerror = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        resolve(false);
      }
    };

    document.head.appendChild(script);
  });
};

// Real production & test Razorpay Credentials provided by merchant:
// Key ID: rzp_test_Tmud3q9poZJYPz
// Key Secret: 5yA3U3TBW9WYqTzqlRIILsp5
const DEFAULT_RAZORPAY_KEY_ID = 'rzp_test_Tmud3q9poZJYPz';

export const getRazorpayKeyId = (): string => {
  const envKey =
    (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) ||
    (import.meta.env.VITE_RAZORPAY_KEY as string | undefined) ||
    (typeof window !== 'undefined' ? (window as any).__RAZORPAY_KEY__ : undefined);

  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return DEFAULT_RAZORPAY_KEY_ID;
};

/**
 * Real production payment authorization for MArts Handcrafts.
 * Opens official Razorpay modal and validates real payment responses.
 */
export const openRazorpayCheckout = async (
  options: RazorpayOptions
): Promise<RazorpayPaymentSuccessResponse> => {
  const activeKeyId = getRazorpayKeyId();

  if (!activeKeyId || !activeKeyId.startsWith('rzp_')) {
    throw new Error('Valid Razorpay Key ID is required to process online payment.');
  }

  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    throw new Error('Could not initialize Razorpay checkout gateway. Please check your internet connection.');
  }

  return new Promise<RazorpayPaymentSuccessResponse>((resolve, reject) => {
    try {
      const rzp = new (window as any).Razorpay({
        key: activeKeyId,
        amount: Math.round(Number(options.amount) * 100), // amount in paise
        currency: 'INR',
        name: 'MArts Handcrafts',
        description: options.description || `Order #${options.orderId} - Handcrafted Pottery & Statues`,
        prefill: {
          name: options.customerName || 'Customer',
          contact: options.customerPhone || '',
          email: options.customerEmail || ''
        },
        theme: {
          color: '#C85A32'
        },
        handler: (response: any) => {
          if (!response || !response.razorpay_payment_id) {
            reject(new Error('Payment was received but payment ID was missing.'));
            return;
          }
          resolve({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || options.orderId,
            razorpay_signature: response.razorpay_signature || ''
          });
        },
        modal: {
          ondismiss: () => {
            reject(new Error('PAYMENT_CANCELLED'));
          }
        }
      });

      rzp.on('payment.failed', (failResp: any) => {
        const desc = failResp?.error?.description || failResp?.error?.reason || 'Payment failed with bank or gateway.';
        reject(new Error(desc));
      });

      rzp.open();
    } catch (err: any) {
      reject(new Error(err?.message || 'Failed to open Razorpay payment interface.'));
    }
  });
};
