// Supabase Edge Function: verify-play-purchase
//
// Validates a Google Play in-app purchase against the Google Play Developer API
// before granting premium. Only this function (running with the service role key)
// can set profiles.is_premium = true.
//
// Required secrets (set via `supabase secrets set`, NOT in the app's env):
//   GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL  — service account with Android Publisher API access
//   GOOGLE_PLAY_PRIVATE_KEY             — the service account's private key
//   GOOGLE_PLAY_PACKAGE_NAME            — Android app package name (e.g. com.example.speakup)
//
// Deploy with: supabase functions deploy verify-play-purchase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "https://esm.sh/googleapis@140";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  try {
    // Caller-scoped client: enforces the caller's own JWT (user must be signed in)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { productId, purchaseToken } = await req.json();
    if (!productId || !purchaseToken) {
      return json({ error: "Missing purchase details" }, 400);
    }

    const serviceEmail = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL");
    const privateKey = (Deno.env.get("GOOGLE_PLAY_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
    const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
    if (!serviceEmail || !privateKey || !packageName) {
      return json({ error: "Google Play verification is not configured" }, 500);
    }

    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const publisher = google.androidpublisher({ version: "v3", auth });

    // Verify the purchase with Google
    const { data: purchase } = await publisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });
    // purchaseState 0 = PURCHASED (1 = canceled, 2 = pending)
    if (!purchase || purchase.purchaseState !== 0) {
      return json({ error: "Purchase not verified with Google Play" }, 400);
    }

    // Grant premium: is_premium = true (plan kept in sync for call-time limits)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ is_premium: true, plan: "paid", plan_expires_at: null })
      .eq("id", user.id);
    if (updateErr) return json({ error: "Could not update your profile" }, 500);

    // Acknowledge within 3 days, or Google auto-refunds the purchase
    await publisher.purchases.products
      .acknowledge({ packageName, productId, token: purchaseToken })
      .catch(() => {});

    return json({ verified: true });
  } catch (_err) {
    return json({ error: "Purchase verification failed" }, 500);
  }
});
