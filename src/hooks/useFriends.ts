import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingRequests,
  fetchFriends,
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest as sendRequest,
} from "@/lib/friends";
import type { FriendRequest, Friendship } from "@/types";

/**
 * Manages friend requests and friendships for the current user.
 * Polls for pending requests periodically and exposes actions.
 */
export function useFriends(userId: string | null) {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [reqs, frs] = await Promise.all([
      fetchPendingRequests(userId),
      fetchFriends(userId),
    ]);
    setPendingRequests(reqs);
    setFriends(frs);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
    // Poll every 15 seconds for new requests
    const interval = setInterval(() => void refresh(), 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const sendRequestToUser = useCallback(
    async (receiverId: string): Promise<{ error: string | null; alreadySent?: boolean }> => {
      if (!userId) return { error: "Not signed in." };
      return sendRequest(userId, receiverId);
    },
    [userId],
  );

  const acceptRequest = useCallback(
    async (requestId: string): Promise<{ error: string | null }> => {
      const result = await acceptFriendRequest(requestId);
      if (!result.error) void refresh();
      return result;
    },
    [refresh],
  );

  const declineRequest = useCallback(
    async (requestId: string) => {
      await declineFriendRequest(requestId);
      void refresh();
    },
    [refresh],
  );

  return {
    pendingRequests,
    friends,
    loading,
    refresh,
    sendRequestToUser,
    acceptRequest,
    declineRequest,
  };
}
