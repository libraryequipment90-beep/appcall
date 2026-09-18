import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/", (_req, res) => res.json({ status: "ok", service: "speakup-signaling" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ---------- Matchmaking state ----------
/** @type {string[]} sockets waiting to be paired */
const waitingQueue = [];
/** @type {Map<string, string>} socket.id -> partner socket.id */
const partners = new Map();
/** @type {Map<string, string>} socket.id -> room id */
const rooms = new Map();
/** @type {Map<string, object>} socket.id -> user profile { id, display_name, is_guest, plan } */
const userProfiles = new Map();
/** @type {Map<string, string>} user profile id -> socket.id (for friend calls) */
const userSocketMap = new Map();

let roomCounter = 0;

function pairUsers(socket) {
  if (waitingQueue.length === 0) {
    waitingQueue.push(socket.id);
    socket.emit("searching");
    return;
  }

  const partnerId = waitingQueue.shift();
  const partnerSocket = io.sockets.sockets.get(partnerId);

  // Partner disconnected while waiting
  if (!partnerSocket || partnerSocket.id === socket.id) {
    waitingQueue.push(socket.id);
    socket.emit("searching");
    return;
  }

  const roomId = `room-${++roomCounter}`;

  partners.set(socket.id, partnerSocket.id);
  partners.set(partnerSocket.id, socket.id);
  rooms.set(socket.id, roomId);
  rooms.set(partnerSocket.id, roomId);

  const callerProfile = userProfiles.get(partnerSocket.id) || null;
  const calleeProfile = userProfiles.get(socket.id) || null;

  // First user in queue becomes the caller (creates the offer)
  partnerSocket.emit("matched", {
    roomId, role: "caller", peerId: socket.id,
    peerProfile: calleeProfile,
  });
  socket.emit("matched", {
    roomId, role: "callee", peerId: partnerSocket.id,
    peerProfile: callerProfile,
  });
}

function cleanup(socketId) {
  const idx = waitingQueue.indexOf(socketId);
  if (idx !== -1) waitingQueue.splice(idx, 1);

  const partnerId = partners.get(socketId);
  if (partnerId) {
    partners.delete(partnerId);
    rooms.delete(partnerId);
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) partnerSocket.emit("peer-disconnected");
  }
  partners.delete(socketId);
  rooms.delete(socketId);

  const profile = userProfiles.get(socketId);
  if (profile) {
    // Only remove from userSocketMap if this socket is the current one
    if (userSocketMap.get(profile.id) === socketId) {
      userSocketMap.delete(profile.id);
    }
  }
  userProfiles.delete(socketId);
}

// ---------- Socket events ----------
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Client sends their profile on connect
  socket.on("register-user", (profile) => {
    userProfiles.set(socket.id, profile);
    if (profile && profile.id) {
      userSocketMap.set(profile.id, socket.id);
    }
  });

  socket.on("find-partner", () => pairUsers(socket));

  // Call a specific friend by their profile ID
  socket.on("call-friend", ({ targetUserId, fromProfile }) => {
    const targetSocketId = userSocketMap.get(targetUserId);
    if (!targetSocketId) {
      socket.emit("friend-unavailable");
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) {
      socket.emit("friend-unavailable");
      return;
    }

    // Check if target is already in a call
    if (partners.has(targetSocketId)) {
      socket.emit("friend-busy");
      return;
    }

    // Send incoming call notification to the friend
    targetSocket.emit("friend-call-incoming", {
      from: socket.id,
      fromProfile: fromProfile,
    });
  });

  // Accept an incoming friend call
  socket.on("accept-friend-call", ({ from }) => {
    const roomId = `room-${++roomCounter}`;

    partners.set(socket.id, from);
    partners.set(from, socket.id);
    rooms.set(socket.id, roomId);
    rooms.set(from, roomId);

    const calleeProfile = userProfiles.get(socket.id) || null;
    const callerProfile = userProfiles.get(from) || null;

    io.to(from).emit("matched", {
      roomId, role: "caller", peerId: socket.id,
      peerProfile: calleeProfile,
    });
    socket.emit("matched", {
      roomId, role: "callee", peerId: from,
      peerProfile: callerProfile,
    });
  });

  // Decline an incoming friend call
  socket.on("decline-friend-call", ({ from }) => {
    io.to(from).emit("friend-call-declined");
  });

  socket.on("offer", ({ to, sdp }) => {
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    io.to(to).emit("answer", { from: socket.id, sdp });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("end-call", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("end-call");
      cleanup(socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    cleanup(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on :${PORT}`);
});
