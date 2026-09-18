# SpeakUp — Base44 Dev Environment

## Overview
Vite + React + TypeScript frontend with a Node.js Socket.io signaling server for P2P voice calling. Uses Supabase for auth and friends.

## Architecture
- **web** (port 3000 → Vite dev server on 5173): Frontend, bind-mounted from repo, live reload.
- **signaling** (port 3001 → Socket.io server): Matchmaking + WebRTC signaling, runs `node --watch index.js`.

## Running
```bash
docker compose -f docker-compose.base44.yml up -d --build
```

## Environment / Secrets
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — required at boot. Development placeholders are generated automatically; replace with real Supabase credentials for auth/friends to work. Delivered via `/run/base44/app.env`.
- `VITE_SIGNALING_URL` — set in compose `environment:` to the public URL of the signaling server (`https://3001-$BASE44_PUBLIC_HOST_SUFFIX`).
- The app boots into **guest mode** without valid Supabase credentials — P2P calling works, but auth and friends features require real Supabase.

## Google Play Billing (Premium ₹115)
- Premium product ID: `premium_115` (override via `VITE_PLAY_PRODUCT_ID`) — must exist as a one-time in-app product in the Google Play Console.
- The Android wrapper must expose a `window.GooglePlayBilling` JS bridge (`launchPurchaseFlow`, `queryPurchases`) backed by the Google Play Billing Library.
- Purchase tokens are verified server-side by the `verify-play-purchase` Supabase Edge Function (`supabase/functions/verify-play-purchase`) against the Google Play Developer API, which then sets `profiles.is_premium = true` (plus `plan='paid'`).
- Edge function secrets live in Supabase (`supabase secrets set`), not the app env: `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY`, `GOOGLE_PLAY_PACKAGE_NAME`. Deploy: `supabase functions deploy verify-play-purchase`.
- Gating: friend requests are free for everyone; direct (friend-to-friend) calling requires `is_premium = true` — free users see the ₹115 upgrade modal instead. Random matchmaking stays free with the 10-minute limit.
- Cleanup policy: signaling/call state is in-memory only (cleared on disconnect) — nothing ever deletes profiles, friends, or friend_requests from the database.

## Notes
- Vite 5.4.8 — no `allowedHosts` config needed; `--host 0.0.0.0` is sufficient.
- The signaling server has CORS `origin: "*"` so cross-origin Socket.io from the preview works.
- `getUserMedia` (WebRTC) requires HTTPS or localhost; the preview is served over HTTPS so audio calls should work.
- Supabase migration: `supabase/migrations/20260918075323_001_create_profiles_friends_tables.sql` — apply in your Supabase project for friends/auth.
