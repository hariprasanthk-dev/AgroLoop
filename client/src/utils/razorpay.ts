/**
 * razorpay.ts — Dynamic Razorpay SDK loader
 *
 * Loads the Razorpay Checkout SDK on-demand (only when a payment begins)
 * instead of blocking the initial page load for every user.
 *
 * Key guarantees:
 *  - Only ONE <script> tag is ever injected (idempotent via #razorpay-sdk).
 *  - Concurrent callers share the same Promise (no duplicate requests).
 *  - Subsequent calls after the first success resolve immediately.
 */

const RAZORPAY_SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const SCRIPT_ID = 'razorpay-sdk';

let loadPromise: Promise<void> | null = null;

/**
 * Dynamically injects the Razorpay Checkout SDK script if not already loaded.
 * Safe to call multiple times — the script is injected at most once.
 *
 * @returns A Promise that resolves when `window.Razorpay` is available.
 * @throws  An Error if the script fails to load.
 */
export function loadRazorpaySdk(): Promise<void> {
  // Already loaded — resolve immediately
  if (typeof window !== 'undefined' && (window as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve();
  }

  // Script already injected but not yet resolved — share the same promise
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Prevent double injection (e.g. React Strict Mode double-effects)
    if (document.getElementById(SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = RAZORPAY_SDK_URL;
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => {
      // Allow retry on next call
      loadPromise = null;
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error('Failed to load Razorpay SDK. Please check your network connection.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
