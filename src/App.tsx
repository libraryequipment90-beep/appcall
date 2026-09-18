import { useState, useCallback, useEffect } from "react";
import { Lobby } from "@/components/Lobby";
import { SearchingScreen } from "@/components/SearchingScreen";
import { CallScreen } from "@/components/CallScreen";
import { AuthModal } from "@/components/AuthModal";
import { FriendsPanel } from "@/components/FriendsPanel";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { LimitReachedModal } from "@/components/LimitReachedModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Toast, type ToastMessage } from "@/components/Toast";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { areFriends } from "@/lib/friends";
import { sendFriendRequest } from "@/lib/friends";
import { purchasePremium, restorePurchases } from "@/lib/googlePlayBilling";

function App() {
  const { profile, accountType, loading, signOut, refreshProfile } = useAuth();
  const {
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
  } = useWebRTC(profile);

  const { pendingRequests, friends, loading: friendsLoading, acceptRequest, declineRequest, sendRequestToUser, refresh: refreshFriends } =
    useFriends(accountType === "registered" ? profile?.id ?? null : null);

  // UI state
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false);
  const [isFriendCall, setIsFriendCall] = useState(false);
  const [friendCallName, setFriendCallName] = useState<string | undefined>(undefined);

  let toastId = 0;

  const showToast = useCallback((message: string, type: ToastMessage["type"] = "info") => {
    toastId += 1;
    setToast({ id: toastId, message, type });
  }, []);

  // Check if already friends with peer when call connects
  useEffect(() => {
    if (status === "connected" && peerProfile && profile) {
      setFriendRequestSent(false);
      void areFriends(profile.id, peerProfile.id).then(setIsAlreadyFriend);
    } else {
      setIsAlreadyFriend(false);
      setFriendRequestSent(false);
    }
  }, [status, peerProfile, profile]);

  // Show call friend error as toast
  useEffect(() => {
    if (callFriendError) {
      showToast(callFriendError, "error");
      clearCallFriendError();
    }
  }, [callFriendError, showToast, clearCallFriendError]);

  // Reset friend call flag when status changes from searching
  useEffect(() => {
    if (status !== "searching") {
      setIsFriendCall(false);
    }
  }, [status]);

  // Handle upgrade via Google Play In-App Billing (₹115 plan)
  const handleUpgrade = useCallback(async (): Promise<string | null> => {
    if (accountType === "guest") {
      setAuthMode("signup");
      setAuthOpen(true);
      showToast("Please create an account first to upgrade.", "info");
      return null;
    }

    const result = await purchasePremium();
    if (result.error) return result.error;

    await refreshProfile();
    await refreshFriends();
    showToast("Premium unlocked! You can now call your friends directly.", "success");
    return null;
  }, [accountType, refreshProfile, refreshFriends, showToast]);

  // Handle restoring a previous Google Play purchase
  const handleRestore = useCallback(async (): Promise<string | null> => {
    if (accountType === "guest") {
      setAuthMode("signup");
      setAuthOpen(true);
      showToast("Please sign in to restore purchases.", "info");
      return null;
    }

    const result = await restorePurchases();
    if (result.error) return result.error;

    await refreshProfile();
    showToast("Purchases restored — Premium is active!", "success");
    return null;
  }, [accountType, refreshProfile, showToast]);

  // Handle find partner
  const handleFindPartner = useCallback(() => {
    setIsFriendCall(false);
    startSearch();
  }, [startSearch]);

  // Handle find next after call ends
  const handleFindNext = useCallback(() => {
    setIsFriendCall(false);
    startSearch();
  }, [startSearch]);

  // Handle send friend request
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile || !peerProfile) return;
    if (accountType === "guest") {
      setAuthMode("signup");
      setAuthOpen(true);
      showToast("Create an account to send friend requests.", "info");
      return;
    }

    const result = await sendRequestToUser(peerProfile.id);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      setFriendRequestSent(true);
      showToast(`Friend request sent to ${peerProfile.display_name}!`, "success");
    }
  }, [profile, peerProfile, accountType, sendRequestToUser, showToast]);

  // Handle accept friend request from FriendsPanel
  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      const result = await acceptRequest(requestId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Friend request accepted!", "success");
        void refreshFriends();
      }
      return result;
    },
    [acceptRequest, showToast, refreshFriends],
  );

  // Handle call friend from FriendsPanel — direct calling requires Premium (₹115 plan)
  const handleCallFriend = useCallback(
    (friendId: string) => {
      if (!profile?.is_premium) {
        setFriendsOpen(false);
        setUpgradeReason("Direct calling is a Premium feature. Get the ₹115 plan to call your friends directly.");
        setUpgradeOpen(true);
        return;
      }
      const friend = friends.find((f) => f.friend_id === friendId);
      if (friend) {
        setFriendCallName(friend.friend_profile?.display_name);
        setIsFriendCall(true);
      }
      setFriendsOpen(false);
      startFriendCall(friendId);
    },
    [friends, startFriendCall, profile],
  );

  // Handle incoming friend call accept — Premium required to join a direct call
  const handleAcceptIncoming = useCallback(() => {
    if (!profile?.is_premium) {
      declineIncomingFriendCall();
      setUpgradeReason("Direct calling is a Premium feature. Get the ₹115 plan to receive calls from friends.");
      setUpgradeOpen(true);
      return;
    }
    acceptIncomingFriendCall();
  }, [profile, acceptIncomingFriendCall, declineIncomingFriendCall]);

  // Handle incoming friend call decline
  const handleDeclineIncoming = useCallback(() => {
    declineIncomingFriendCall();
  }, [declineIncomingFriendCall]);

  // Handle upgrade from limit reached modal
  const handleUpgradeFromLimit = useCallback(() => {
    setUpgradeReason("Your 10-minute free call limit was reached. Upgrade for unlimited calling.");
    setUpgradeOpen(true);
  }, []);

  // Refresh profile after auth modal closes (in case user signed up)
  const handleAuthClose = useCallback(() => {
    setAuthOpen(false);
    void refreshProfile();
    void refreshFriends();
  }, [refreshProfile, refreshFriends]);

  // Show loading screen while auth initializes
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {status === "idle" && (
          <Lobby
            onFindPartner={handleFindPartner}
            serverConnected={serverConnected}
            profile={profile}
            accountType={accountType}
            onOpenAuth={() => { setAuthMode("login"); setAuthOpen(true); }}
            onSignOut={() => void signOut()}
            onOpenFriends={() => setFriendsOpen(true)}
            pendingRequestCount={pendingRequests.length}
            onOpenUpgrade={() => { setUpgradeReason(undefined); setUpgradeOpen(true); }}
          />
        )}

        {status === "searching" && (
          <SearchingScreen isFriendCall={isFriendCall} friendName={friendCallName} />
        )}

        {(status === "connecting" || status === "connected" || status === "ended") && (
          <CallScreen
            status={status}
            micEnabled={micEnabled}
            audioRef={audioRef}
            onToggleMic={toggleMic}
            onHangUp={hangUp}
            onFindNext={handleFindNext}
            onSendFriendRequest={handleSendFriendRequest}
            friendRequestSent={friendRequestSent}
            isAlreadyFriend={isAlreadyFriend}
            peerProfile={peerProfile}
            callSeconds={callSeconds}
            isPaid={isPaid}
            timeWarning={timeWarning}
          />
        )}
      </div>

      {/* Modals */}
      {authOpen && <AuthModal onClose={handleAuthClose} initialMode={authMode} />}
      {friendsOpen && (
        <FriendsPanel
          pendingRequests={pendingRequests}
          friends={friends}
          loading={friendsLoading}
          onAccept={handleAcceptRequest}
          onDecline={(id) => void declineRequest(id)}
          onCallFriend={handleCallFriend}
          onClose={() => setFriendsOpen(false)}
        />
      )}
      {incomingFriendCall && (
        <IncomingCallModal
          fromProfile={incomingFriendCall.fromProfile}
          onAccept={handleAcceptIncoming}
          onDecline={handleDeclineIncoming}
        />
      )}
      {timeLimitReached && status === "ended" && (
        <LimitReachedModal
          onClose={() => {}}
          onUpgrade={handleUpgradeFromLimit}
          onFindNext={handleFindNext}
        />
      )}
      {upgradeOpen && (
        <UpgradeModal
          onClose={() => setUpgradeOpen(false)}
          onUpgrade={handleUpgrade}
          onRestore={handleRestore}
          reason={upgradeReason}
        />
      )}

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default App;
