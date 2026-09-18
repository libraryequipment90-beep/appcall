import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { SignalingEvent, UserProfile } from "@/types";
import { getSocket } from "@/lib/signaling";

type Handler = (event: SignalingEvent) => void;

/**
 * Manages the Socket.io lifecycle and forwards every signaling event to the
 * provided handler. Exposes actions for matchmaking, friend calls, and
 * WebRTC signaling exchange.
 */
export function useSignaling(handler: Handler) {
  const socketRef = useRef<Socket | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    socket.connect();

    const emit = (e: SignalingEvent) => handlerRef.current(e);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("searching", () => emit({ type: "searching" }));
    socket.on("matched", (payload: { roomId: string; role: "caller" | "callee"; peerId: string; peerProfile: UserProfile | null }) =>
      emit({ type: "matched", payload }),
    );
    socket.on("offer", (payload: { from: string; sdp: RTCSessionDescriptionInit }) =>
      emit({ type: "offer", payload }),
    );
    socket.on("answer", (payload: { from: string; sdp: RTCSessionDescriptionInit }) =>
      emit({ type: "answer", payload }),
    );
    socket.on("ice-candidate", (payload: { from: string; candidate: RTCIceCandidateInit }) =>
      emit({ type: "ice-candidate", payload }),
    );
    socket.on("peer-disconnected", () => emit({ type: "peer-disconnected" }));
    socket.on("end-call", () => emit({ type: "end-call" }));
    socket.on("friend-call-incoming", (payload: { from: string; fromProfile: UserProfile }) =>
      emit({ type: "friend-call-incoming", payload }),
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, []);

  const registerUser = useCallback((profile: UserProfile) => {
    socketRef.current?.emit("register-user", profile);
  }, []);

  const sendOffer = useCallback(
    (to: string, sdp: RTCSessionDescriptionInit) => {
      socketRef.current?.emit("offer", { to, sdp });
    },
    [],
  );

  const sendAnswer = useCallback(
    (to: string, sdp: RTCSessionDescriptionInit) => {
      socketRef.current?.emit("answer", { to, sdp });
    },
    [],
  );

  const sendIceCandidate = useCallback(
    (to: string, candidate: RTCIceCandidateInit) => {
      socketRef.current?.emit("ice-candidate", { to, candidate });
    },
    [],
  );

  const findPartner = useCallback(() => {
    socketRef.current?.emit("find-partner");
  }, []);

  const endCall = useCallback(() => {
    socketRef.current?.emit("end-call");
  }, []);

  const callFriend = useCallback((targetUserId: string, fromProfile: UserProfile) => {
    socketRef.current?.emit("call-friend", { targetUserId, fromProfile });
  }, []);

  const acceptFriendCall = useCallback((from: string) => {
    socketRef.current?.emit("accept-friend-call", { from });
  }, []);

  const declineFriendCall = useCallback((from: string) => {
    socketRef.current?.emit("decline-friend-call", { from });
  }, []);

  return {
    connected,
    registerUser,
    findPartner,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    callFriend,
    acceptFriendCall,
    declineFriendCall,
  };
}
