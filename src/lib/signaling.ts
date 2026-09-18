import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Returns the singleton Socket.io connection. The server URL is read from
 * VITE_SIGNALING_URL at build time, falling back to localhost during development.
 */
export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_SIGNALING_URL || "http://localhost:3001";
    socket = io(url, { autoConnect: false, transports: ["websocket"] });
  }
  return socket;
}
