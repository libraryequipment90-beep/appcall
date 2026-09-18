import { supabase } from "@/lib/supabase";

/**
 * Google Play In-App Billing integration for the ₹115 Premium plan (one-time product).
 *
 * The Android wrapper exposes a JS bridge at `window.GooglePlayBilling` backed by the
 * Google Play Billing Library. After a successful purchase, the purchase token is sent
 * to the `verify-play-purchase` Supabase Edge Function, which validates it against the
 * Google Play Developer API before setting `profiles.is_premium = true`.
 */

/** Must match the in-app product ID configured in the Google Play Console. */
export const PREMIUM_PRODUCT_ID =
  (import.meta.env.VITE_PLAY_PRODUCT_ID as string | undefined) || "premium_115";

export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
  purchaseState: number; // 0 = PURCHASED, 1 = CANCELED, 2 = PENDING
}

interface PlayBillingBridge {
  /** Launches the Google Play purchase flow for the given product. */
  launchPurchaseFlow(productId: string): Promise<PlayPurchase>;
  /** Returns the user's existing purchases (for restore). */
  queryPurchases(productId?: string): Promise<PlayPurchase[]>;
}

declare global {
  interface Window {
    GooglePlayBilling?: PlayBillingBridge;
  }
}

export function isPlayBillingAvailable(): boolean {
  return typeof window !== "undefined" && !!window.GooglePlayBilling;
}

/** Sends the purchase token to the edge function for server-side Google Play verification. */
async function verifyPurchase(purchase: PlayPurchase): Promise<string | null> {
  const { error } = await supabase.functions.invoke("verify-play-purchase", {
    body: { productId: purchase.productId, purchaseToken: purchase.purchaseToken },
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? "";
    if (msg.includes("Not authenticated")) {
      return "Please sign in again, then retry the purchase.";
    }
    if (msg.includes("not verified")) {
      return "Purchase could not be verified with Google Play. If you were charged, tap Restore purchase.";
    }
    return "Purchase verification failed. Please try again.";
  }
  return null;
}

/** Launches the Google Play purchase flow for the ₹115 premium plan. */
export async function purchasePremium(): Promise<{ error: string | null }> {
  const bridge = window.GooglePlayBilling;
  if (!bridge) {
    return { error: "Google Play purchase is only available in the Android app." };
  }
  try {
    const purchase = await bridge.launchPurchaseFlow(PREMIUM_PRODUCT_ID);
    if (purchase.purchaseState !== 0) {
      return { error: "Purchase was not completed." };
    }
    return { error: await verifyPurchase(purchase) };
  } catch {
    return { error: "Purchase could not be completed. Please try again." };
  }
}

/** Re-verifies existing purchases (e.g. after reinstall or on a new device). */
export async function restorePurchases(): Promise<{ error: string | null }> {
  const bridge = window.GooglePlayBilling;
  if (!bridge) {
    return { error: "Google Play purchases can only be restored in the Android app." };
  }
  try {
    const purchases = await bridge.queryPurchases(PREMIUM_PRODUCT_ID);
    const premium = purchases.filter((p) => p.productId === PREMIUM_PRODUCT_ID);
    if (premium.length === 0) {
      return { error: "No previous purchase found on this Google account." };
    }
    for (const purchase of premium) {
      const error = await verifyPurchase(purchase);
      if (!error) return { error: null };
    }
    return { error: "Purchase could not be verified. Please try again." };
  } catch {
    return { error: "Could not restore purchases. Please try again." };
  }
}
