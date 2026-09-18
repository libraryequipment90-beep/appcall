# SpeakUp — Free P2P English Speaking Practice

A zero-budget, peer-to-peer voice calling web app for 1-on-1 English speaking practice. Uses WebRTC for direct audio streaming and a lightweight Socket.io server for matchmaking and signaling.

## Architecture

```
┌──────────────┐    Socket.io (signaling)    ┌──────────────┐
│   Client A   │ ◄──────────────────────────► │   Client B   │
│  (Browser)   │                              │  (Browser)   │
└──────┬───────┘                              └──────┬───────┘
       │                                           │
       └──────── WebRTC (direct P2P audio) ────────┘
                     via Google STUN
```

- **Frontend**: React + Vite + Tailwind CSS
- **Signaling**: Node.js + Socket.io (queue-based matchmaking)
- **Media**: WebRTC with Google STUN servers (no media server needed)

## Project structure

```
├── server/                  # Signaling server (deploy separately)
│   ├── index.js             # Socket.io server: matchmaking + WebRTC signaling
│   ├── package.json
│   └── README.md            # Server deployment instructions
├── src/
│   ├── components/
│   │   ├── Lobby.tsx        # Landing screen with "Find Partner" button
│   │   ├── SearchingScreen  # Animated waiting state
│   │   └── CallScreen.tsx   # In-call UI: timer, mic toggle, end call
│   ├── hooks/
│   │   ├── useSignaling.ts  # Socket.io connection + event forwarding
│   │   ├── useWebRTC.ts     # RTCPeerConnection lifecycle + audio streams
│   │   └── useCallTimer.ts  # Call duration counter
│   ├── lib/
│   │   ├── signaling.ts     # Socket.io singleton
│   │   └── format.ts        # Duration formatting
│   ├── types.ts             # Shared types
│   ├── App.tsx              # Root component, screen routing
│   └── main.tsx
├── .env                     # VITE_SIGNALING_URL (server URL)
└── package.json
```

## Local development

### 1. Start the signaling server

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3001`.

### 2. Start the frontend

From the project root:

```bash
npm install
npm run dev
```

The frontend expects the signaling server at `http://localhost:3001` by default. To override, create a `.env` file:

```
VITE_SIGNALING_URL=https://your-server-url.com
```

### 3. Test calling

Open the app in two browser tabs (or two devices on the same network). Click "Find a Partner" in both — they'll be paired and connected via WebRTC.

> **Note**: `getUserMedia` requires HTTPS or `localhost`. For testing on other devices, use `ngrok` or deploy the frontend.

## Deployment (all free tier)

### Signaling Server

**Render** (recommended):
1. Create a new Web Service at https://render.com
2. Connect your repo, set Root Directory to `server`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Render auto-assigns the `PORT` env var

**Railway**:
1. Create a new project at https://railway.app
2. Deploy from repo, select the `server` folder
3. Railway auto-detects Node.js

### Frontend

**Vercel / Netlify / Render Static Site**:
1. Build command: `npm run build`
2. Output directory: `dist`
3. Set environment variable `VITE_SIGNALING_URL` to your deployed server URL

**Bolt**:
The app builds with `npm run build` and serves from `dist/`.

## How it works

1. **Matchmaking**: When a user clicks "Find Partner", the server adds them to a queue. The next user to join is paired with the first, forming a room.

2. **WebRTC signaling**:
   - The "caller" creates an SDP offer and sends it via the server
   - The "callee" responds with an SDP answer
   - Both exchange ICE candidates for NAT traversal via Google STUN

3. **Direct audio**: Once connected, audio flows directly between browsers — no media server, zero cost.

4. **Call control**: Either user can end the call; the other is notified instantly and returned to the lobby.
