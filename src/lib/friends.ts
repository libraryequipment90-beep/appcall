import { supabase } from "@/lib/supabase";
import type { FriendRequest, Friendship, UserProfile } from "@/types";

/**
 * Sends a friend request from the current user to a target user.
 * Returns an error message if the request could not be sent.
 */
export async function sendFriendRequest(
  senderId: string,
  receiverId: string,
): Promise<{ error: string | null; alreadySent?: boolean }> {
  // Check if a request already exists in either direction
  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id, status")
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") {
      return { error: "You are already friends with this person.", alreadySent: true };
    }
    if (existing.status === "pending") {
      return { error: "A friend request is already pending.", alreadySent: true };
    }
    // If declined, allow re-sending by deleting the old one
    await supabase.from("friend_requests").delete().eq("id", existing.id);
  }

  // Check if already friends
  const { data: friendCheck } = await supabase
    .from("friends")
    .select("id")
    .eq("user_id", senderId)
    .eq("friend_id", receiverId)
    .maybeSingle();

  if (friendCheck) {
    return { error: "You are already friends with this person.", alreadySent: true };
  }

  const { error } = await supabase
    .from("friend_requests")
    .insert({ sender_id: senderId, receiver_id: receiverId });

  if (error) return { error: "Could not send friend request. Please try again." };
  return { error: null };
}

/**
 * Accepts a friend request. Uses the SECURITY DEFINER function which checks
 * that at least one party has an active paid plan.
 */
export async function acceptFriendRequest(
  requestId: string,
): Promise<{ error: string | null; needsUpgrade?: boolean }> {
  const { error } = await supabase.rpc("accept_friend_request", {
    p_request_id: requestId,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("paid plan")) {
      return {
        error: "Upgrade to a Paid Plan to accept Friend Requests and Talk Anytime.",
        needsUpgrade: true,
      };
    }
    return { error: "Could not accept this request. Please try again." };
  }
  return { error: null };
}

/**
 * Declines a friend request.
 */
export async function declineFriendRequest(requestId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: "Could not decline this request. Please try again." };
  return { error: null };
}

/**
 * Fetches all pending friend requests received by the current user.
 * Includes the sender's profile.
 */
export async function fetchPendingRequests(
  userId: string,
): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      id, sender_id, receiver_id, status, created_at,
      sender_profile:profiles!friend_requests_sender_id_fkey(id, display_name, is_guest, guest_device_id, plan, plan_expires_at)
    `)
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    sender_id: r.sender_id,
    receiver_id: r.receiver_id,
    status: r.status,
    created_at: r.created_at,
    sender_profile: r.sender_profile as unknown as UserProfile,
  }));
}

/**
 * Fetches all friends for the current user. Includes the friend's profile.
 */
export async function fetchFriends(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friends")
    .select(`
      id, user_id, friend_id, created_at,
      friend_profile:profiles!friends_friend_id_fkey(id, display_name, is_guest, guest_device_id, plan, plan_expires_at)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((f) => ({
    id: f.id,
    user_id: f.user_id,
    friend_id: f.friend_id,
    created_at: f.created_at,
    friend_profile: f.friend_profile as unknown as UserProfile,
  }));
}

/**
 * Checks if two users are already friends.
 */
export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from("friends")
    .select("id")
    .eq("user_id", userId)
    .eq("friend_id", otherId)
    .maybeSingle();

  return !!data;
}
