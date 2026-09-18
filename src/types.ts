export type CallStatus =
  | "idle"
  | "searching"
  | "connecting"
  | "connected"
  | "ended";

export type PlanType = "free" | "paid";

export type AccountType = "guest" | "registered";

export interface UserProfile {
  id: string;
  display_name: string;
  is_guest: boolean;
  guest_device_id: string | null;
  plan: PlanType;
  plan_expires_at: string | null;
}

export interface MatchedPayload {
  roomId: string;
  role: "caller" | "callee";
  peerId: string;
  peerProfile: UserProfile | null;
}

export type SignalingEvent =
  | { type: "searching" }
  | { type: "matched"; payload: MatchedPayload }
  | { type: "offer"; payload: { from: string; sdp: RTCSessionDescriptionInit } }
  | { type: "answer"; payload: { from: string; sdp: RTCSessionDescriptionInit } }
  | { type: "ice-candidate"; payload: { from: string; candidate: RTCIceCandidateInit } }
  | { type: "peer-disconnected" }
  | { type: "end-call" }
  | { type: "friend-call-incoming"; payload: { from: string; fromProfile: UserProfile } };

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  sender_profile?: UserProfile;
  receiver_profile?: UserProfile;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend_profile?: UserProfile;
}
