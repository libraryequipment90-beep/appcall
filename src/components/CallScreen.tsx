import { Mic, MicOff, PhoneOff, Radio, UserPlus, Clock, AlertTriangle } from "lucide-react";
import type { RefObject } from "react";
import type { CallStatus, UserProfile } from "@/types";
import { useCallTimer } from "@/hooks/useCallTimer";
import { formatDuration } from "@/lib/format";

interface CallScreenProps {
  status: CallStatus;
  micEnabled: boolean;
  audioRef: RefObject<HTMLAudioElement>;
  onToggleMic: () => void;
  onHangUp: () => void;
  onFindNext: () => void;
  onSendFriendRequest: () => void;
  friendRequestSent: boolean;
  isAlreadyFriend: boolean;
  peerProfile: UserProfile | null;
  callSeconds: number;
  isPaid: boolean;
  timeWarning: boolean;
}

const FREE_LIMIT = 10 * 60;

export function CallScreen({
  status,
  micEnabled,
  audioRef,
  onToggleMic,
  onHangUp,
  onFindNext,
  onSendFriendRequest,
  friendRequestSent,
  isAlreadyFriend,
  peerProfile,
  callSeconds,
  isPaid,
  timeWarning,
}: CallScreenProps) {
  const timer = useCallTimer(status === "connected");
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const statusLabel = isConnected
    ? "Connected"
    : isConnecting
      ? "Connecting..."
      : "Call ended";

  const remainingSeconds = Math.max(0, FREE_LIMIT - callSeconds);
  const showCountdown = isConnected && !isPaid;
  const showWarning = showCountdown && timeWarning;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      {/* Remote peer avatar */}
      <div className="relative mb-8">
        <div
          className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 ${
            isConnected
              ? showWarning
                ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-amber-500/30"
                : "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/30"
              : isConnecting
                ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-amber-500/30"
                : "bg-gradient-to-br from-slate-500 to-slate-600 shadow-xl"
          }`}
        >
          {peerProfile ? (
            <span className="text-5xl font-bold text-white">
              {peerProfile.display_name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <Radio
              className={`w-16 h-16 text-white ${isConnected ? "animate-pulse" : ""}`}
            />
          )}
        </div>
        {isConnected && (
          <span
            className={`absolute -inset-2 rounded-full border-2 animate-ping ${
              showWarning ? "border-amber-400/40" : "border-emerald-400/40"
            }`}
          />
        )}
      </div>

      {/* Peer name */}
      {peerProfile && (isConnected || isConnecting) && (
        <p className="text-white text-xl font-semibold mb-1">
          {peerProfile.display_name}
        </p>
      )}

      {/* Status + timer */}
      <div className="text-center mb-2">
        <p className="text-slate-300 text-sm font-medium tracking-wide uppercase">
          {statusLabel}
        </p>
        {isConnected && (
          <>
            {/* Free user: countdown timer */}
            {showCountdown ? (
              <div className="mt-2">
                <div className="flex items-center justify-center gap-2">
                  <Clock className={`w-5 h-5 ${showWarning ? "text-amber-400" : "text-emerald-400"}`} />
                  <span
                    className={`text-4xl font-bold tabular-nums ${
                      showWarning ? "text-amber-400" : "text-white"
                    }`}
                  >
                    {formatDuration(remainingSeconds)}
                  </span>
                </div>
                {showWarning && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>1 minute remaining — upgrade for unlimited time</span>
                  </div>
                )}
              </div>
            ) : (
              /* Paid user: count up timer */
              <p className="text-white text-4xl font-bold tabular-nums mt-2">
                {timer}
              </p>
            )}
          </>
        )}
        {isConnecting && (
          <p className="text-slate-400 text-sm mt-2 max-w-xs">
            Establishing direct peer connection...
          </p>
        )}
        {status === "ended" && (
          <p className="text-slate-400 text-sm mt-2">
            Your partner disconnected. Ready for someone new?
          </p>
        )}
      </div>

      {/* Hidden audio element for remote stream */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Controls */}
      <div className="flex items-center gap-4 mt-12 flex-wrap justify-center">
        {/* Mic toggle */}
        <button
          onClick={onToggleMic}
          disabled={!isConnected}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
            micEnabled
              ? "bg-white/10 hover:bg-white/20 backdrop-blur-sm"
              : "bg-red-500/80 hover:bg-red-500"
          }`}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {micEnabled ? (
            <Mic className="w-7 h-7 text-white" />
          ) : (
            <MicOff className="w-7 h-7 text-white" />
          )}
        </button>

        {/* End call */}
        <button
          onClick={onHangUp}
          className="px-6 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center gap-2 text-white font-semibold transition-all duration-200 shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95"
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
          <span>End</span>
        </button>

        {/* Friend request */}
        {isConnected && !isAlreadyFriend && (
          <button
            onClick={onSendFriendRequest}
            disabled={friendRequestSent}
            className={`px-5 h-16 rounded-full flex items-center gap-2 font-semibold transition-all duration-200 ${
              friendRequestSent
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm hover:scale-105 active:scale-95"
            }`}
            aria-label="Send friend request"
          >
            <UserPlus className="w-5 h-5" />
            <span className="text-sm">
              {friendRequestSent ? "Request Sent" : "Add Friend"}
            </span>
          </button>
        )}

        {isConnected && isAlreadyFriend && (
          <div className="px-5 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <UserPlus className="w-5 h-5" />
            <span>Friends</span>
          </div>
        )}

        {/* Find next (after call ends) */}
        {status === "ended" && (
          <button
            onClick={onFindNext}
            className="px-6 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center gap-2 text-white font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95"
          >
            <span>Find Next</span>
          </button>
        )}
      </div>

      {isConnected && !showCountdown && (
        <p className="text-slate-500 text-xs mt-10 max-w-sm text-center">
          Premium member — unlimited call time. Tip: Ask open-ended questions to
          keep the conversation flowing.
        </p>
      )}
    </div>
  );
}
