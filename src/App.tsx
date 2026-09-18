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

  // Handle upgrade action
  const handleUpgrade = useCallback(() => {
    if (accountType === "guest") {
      setUpgradeOpen(false);
      setAuthMode("signup");
      setAuthOpen(true);
      showToast("Please create an account first to upgrade.", "info");
      return;
    }

    // Stripe is not yet configured — direct user to set it up
    setUpgradeOpen(false);
    showToast(
      "Stripe payment is not yet configured. Please connect Stripe in your project settings to enable upgrades.",
      "error",
    );
  }, [accountType, showToast]);

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
        if (result.needsUpgrade) {
          setUpgradeReason(result.error);
          setUpgradeOpen(true);
        } else {
          showToast(result.error, "error");
        }
      } else {
        showToast("Friend request accepted!", "success");
        void refreshFriends();
      }
      return result;
    },
    [acceptRequest, showToast, refreshFriends],
  );

  // Handle call friend from FriendsPanel
  const handleCallFriend = useCallback(
    (friendId: string) => {
      const friend = friends.find((f) => f.friend_id === friendId);
      if (friend) {
        setFriendCallName(friend.friend_profile?.display_name);
        setIsFriendCall(true);
      }
      setFriendsOpen(false);
      startFriendCall(friendId);
    },
    [friends, startFriendCall],
  );

  // Handle incoming friend call accept
  const handleAcceptIncoming = useCallback(() => {
    acceptIncomingFriendCall();
  }, [acceptIncomingFriendCall]);

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
          reason={upgradeReason}
        />
      )}

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default App;
