import { UserPlus, Check, X, Users, Loader2 } from "lucide-react";
import type { FriendRequest, Friendship } from "@/types";

interface FriendsPanelProps {
  pendingRequests: FriendRequest[];
  friends: Friendship[];
  loading: boolean;
  onAccept: (requestId: string) => Promise<{ error: string | null }>;
  onDecline: (requestId: string) => void;
  onCallFriend: (friendId: string) => void;
  onClose: () => void;
}

export function FriendsPanel({
  pendingRequests,
  friends,
  loading,
  onAccept,
  onDecline,
  onCallFriend,
  onClose,
}: FriendsPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Friends
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Pending Requests ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {req.sender_profile?.display_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {req.sender_profile?.display_name || "Unknown"}
                        </p>
                        <p className="text-slate-500 text-xs">wants to be your friend</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => void onAccept(req.id)}
                          className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                          aria-label="Accept"
                        >
                          <Check className="w-4 h-4 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => void onDecline(req.id)}
                          className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
                          aria-label="Decline"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Your Friends ({friends.length})
              </h3>
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    No friends yet. Send a request after your next call!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {friend.friend_profile?.display_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {friend.friend_profile?.display_name || "Unknown"}
                        </p>
                        {friend.friend_profile?.is_premium && (
                          <p className="text-amber-400 text-xs">Premium member</p>
                        )}
                      </div>
                      <button
                        onClick={() => onCallFriend(friend.friend_id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors flex-shrink-0"
                      >
                        Call
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
