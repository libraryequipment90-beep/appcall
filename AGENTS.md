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

## Notes
- Vite 5.4.8 — no `allowedHosts` config needed; `--host 0.0.0.0` is sufficient.
- The signaling server has CORS `origin: "*"` so cross-origin Socket.io from the preview works.
- `getUserMedia` (WebRTC) requires HTTPS or localhost; the preview is served over HTTPS so audio calls should work.
- Supabase migration: `supabase/migrations/20260918075323_001_create_profiles_friends_tables.sql` — apply in your Supabase project for friends/auth.
