# SpeakUp Signaling Server

Lightweight Node.js + Socket.io server for WebRTC P2P voice calling.

## Run locally

```bash
cd server
npm install
npm start
```

Server listens on `http://localhost:3001`.

## Deploy (free tier)

### Render
1. Go to https://render.com and create a new **Web Service**.
2. Connect your repo, set the root directory to `server`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable `PORT` = `10000` (Render sets this automatically).

### Railway
1. Go to https://railway.app and create a new project from your repo.
2. Set the server directory as the source.
3. Railway auto-detects Node.js and runs `npm start`.

### Glitch
1. Go to https://glitch.com, create a new Node project.
2. Copy `index.js` and `package.json` into the editor.
3. The server starts automatically.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3001`  | HTTP port   |
