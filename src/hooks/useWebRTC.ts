import { useCallback, useEffect, useRef, useState } from "react";

import { useSignaling } from "./useSignaling";
import { isPaidPlanActive } from "@/lib/profiles";
import type { CallStatus, SignalingEvent, UserProfile } from "@/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const FREE_CALL_LIMIT_SECONDS = 10 * 60; // 10 minutes
const WARNING_THRESHOLD_SECONDS = 9 * 60; // warn at 9 minutes

interface UseWebRTCReturn {
  status: CallStatus;
  micEnabled: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  startSearch: () => void;
  hangUp: () => void;
  toggleMic: () => void;
  serverConnected: boolean;
  peerProfile: UserProfile | null;
  callSeconds: number;
  timeLimitReached: boolean;
  timeWarning: boolean;
  isPaid: boolean;
  incomingFriendCall: { from: string; fromProfile: UserProfile } | null;
  acceptIncomingFriendCall: () => void;
  declineIncomingFriendCall: () => void;
  startFriendCall: (targetUserId: string) => void;
  callFriendError: string | null;
  clearCallFriendError: () => void;
}

/**
 * Orchestrates the full WebRTC lifecycle: negotiates the peer connection via the
 * signaling hook, attaches the remote audio stream to a ref, and tracks call status.
 * Includes 10-minute call time limit for free users and friend call support.
 */
export function useWebRTC(profile: UserProfile | null): UseWebRTCReturn {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const [serverConnected, setServerConnected] = useState(false);
  const [peerProfile, setPeerProfile] = useState<UserProfile | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);
  const [incomingFriendCall, setIncomingFriendCall] = useState<{ from: string; fromProfile: UserProfile } | null>(null);
  const [callFriendError, setCallFriendError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const roleRef = useRef<"caller" | "callee" | null>(null);
  const profileRef = useRef<UserProfile | null>(profile);
  profileRef.current = profile;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPaid = isPaidPlanActive(profile);

  // ------- Signaling handler -------
  const handleEvent = useCallback((event: SignalingEvent) => {
    switch (event.type) {
      case "searching":
        setStatus("searching");
        break;

      case "matched": {
        const { role, peerId, peerProfile: pp } = event.payload;
        roleRef.current = role;
        peerIdRef.current = peerId;
        setPeerProfile(pp);
        setStatus("connecting");
        void initConnection(role, peerId);
        break;
      }

      case "offer":
        void handleOffer(event.payload.sdp, event.payload.from);
        break;

      case "answer":
        void handleAnswer(event.payload.sdp);
        break;

      case "ice-candidate":
        void handleRemoteIce(event.payload.candidate);
        break;

      case "peer-disconnected":
      case "end-call":
        teardown();
        setStatus("ended");
        break;

      case "friend-call-incoming":
        setIncomingFriendCall(event.payload);
        break;
    }
  }, []);

  const {
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
  } = useSignaling(handleEvent);

  // Register user profile with server on connect
  useEffect(() => {
    if (connected && profileRef.current) {
      registerUser(profileRef.current);
    }
  }, [connected, registerUser]);

  useEffect(() => {
    setServerConnected(connected);
  }, [connected]);

  // ------- Call timer -------
  const startTimer = useCallback(() => {
    setCallSeconds(0);
    setTimeLimitReached(false);
    setTimeWarning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallSeconds((s) => {
        const next = s + 1;
        if (!isPaidPlanActive(profileRef.current)) {
          if (next >= FREE_CALL_LIMIT_SECONDS) {
            setTimeLimitReached(true);
          } else if (next >= WARNING_THRESHOLD_SECONDS) {
            setTimeWarning(true);
          }
        }
        return next;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-disconnect when time limit reached
  useEffect(() => {
    if (timeLimitReached && status === "connected") {
      endCall();
      teardown();
      setStatus("ended");
    }
  }, [timeLimitReached, status, endCall]);

  // Start/stop timer based on connection status
  useEffect(() => {
    if (status === "connected") {
      startTimer();
    } else {
      stopTimer();
    }
  }, [status, startTimer, stopTimer]);

  // ------- WebRTC helpers -------

  async function initConnection(role: "caller" | "callee", peerId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      setMicEnabled(true);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          void audioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && peerIdRef.current) {
          sendIceCandidate(peerIdRef.current, e.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") setStatus("connected");
        else if (state === "disconnected" || state === "failed") {
          teardown();
          setStatus("ended");
        }
      };

      if (role === "caller") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer(peerId, offer);
      }
    } catch (err) {
      console.error("Failed to access microphone or init connection:", err);
      setStatus("idle");
    }
  }

  async function handleOffer(sdp: RTCSessionDescriptionInit, from: string) {
    const pc = pcRef.current;
    if (!pc) {
      peerIdRef.current = from;
      roleRef.current = "callee";
      await initConnection("callee", from);
    }
    const conn = pcRef.current;
    if (!conn) return;
    await conn.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    sendAnswer(from, answer);
  }

  async function handleAnswer(sdp: RTCSessionDescriptionInit) {
    const pc = pcRef.current;
    if (!pc) return;
    if (pc.signalingState === "stable") return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async function handleRemoteIce(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("Failed to add ICE candidate:", err);
    }
  }

  function teardown() {
    stopTimer();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    peerIdRef.current = null;
    roleRef.current = null;
    setPeerProfile(null);
    setTimeLimitReached(false);
    setTimeWarning(false);
  }

  // ------- Public actions -------

  const startSearch = useCallback(() => {
    teardown();
    setPeerProfile(null);
    setStatus("searching");
    findPartner();
  }, [findPartner]);

  const hangUp = useCallback(() => {
    endCall();
    teardown();
    setStatus("idle");
  }, [endCall]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const next = !audioTrack.enabled;
    audioTrack.enabled = next;
    setMicEnabled(next);
  }, []);

  const startFriendCall = useCallback(
    (targetUserId: string) => {
      if (!profileRef.current) return;
      teardown();
      setCallFriendError(null);
      setStatus("searching");
      callFriend(targetUserId, profileRef.current);
    },
    [callFriend],
  );

  const acceptIncomingFriendCall = useCallback(() => {
    if (!incomingFriendCall) return;
    acceptFriendCall(incomingFriendCall.from);
    setIncomingFriendCall(null);
  }, [incomingFriendCall, acceptFriendCall]);

  const declineIncomingFriendCall = useCallback(() => {
    if (!incomingFriendCall) return;
    declineFriendCall(incomingFriendCall.from);
    setIncomingFriendCall(null);
    setStatus("idle");
  }, [incomingFriendCall, declineFriendCall]);

  const clearCallFriendError = useCallback(() => setCallFriendError(null), []);

  // Listen for friend-call errors (friend-unavailable, friend-busy, friend-call-declined)
  useEffect(() => {
    const socket = getSocketForListener();
    if (!socket) return;

    const onUnavailable = () => {
      setCallFriendError("Your friend is not online right now.");
      setStatus("idle");
    };
    const onBusy = () => {
      setCallFriendError("Your friend is currently in another call.");
      setStatus("idle");
    };
    const onDeclined = () => {
      setCallFriendError("Your friend declined the call.");
      setStatus("idle");
    };

    socket.on("friend-unavailable", onUnavailable);
    socket.on("friend-busy", onBusy);
    socket.on("friend-call-declined", onDeclined);

    return () => {
      socket.off("friend-unavailable", onUnavailable);
      socket.off("friend-busy", onBusy);
      socket.off("friend-call-declined", onDeclined);
    };
  }, [connected]);

  // Clean up on unmount
  useEffect(() => {
    return () => teardown();
  }, []);

  return {
    status,
    micEnabled,
    audioRef,
    startSearch,
    hangUp,
    toggleMic,
    serverConnected,
    peerProfile,
    callSeconds,
    timeLimitReached,
    timeWarning,
    isPaid,
    incomingFriendCall,
    acceptIncomingFriendCall,
    declineIncomingFriendCall,
    startFriendCall,
    callFriendError,
    clearCallFriendError,
  };
}

// Helper to get the socket for additional event listeners
import { getSocket } from "@/lib/signaling";
function getSocketForListener() {
  return getSocket();
}
