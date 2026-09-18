import { Globe, Headphones, Sparkles, Users, Crown, LogOut, UserCircle, Bell } from "lucide-react";
import type { AccountType, UserProfile } from "@/types";
import { isPaidPlanActive } from "@/lib/profiles";

interface LobbyProps {
  onFindPartner: () => void;
  serverConnected: boolean;
  profile: UserProfile | null;
  accountType: AccountType;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenFriends: () => void;
  pendingRequestCount: number;
  onOpenUpgrade: () => void;
}

const FEATURES = [
  {
    icon: Globe,
    title: "Practice globally",
    desc: "Connect with English learners from around the world, anytime.",
  },
  {
    icon: Users,
    title: "1-on-1 matching",
    desc: "Get instantly paired with a practice partner from the queue.",
  },
  {
    icon: Headphones,
    title: "Crystal-clear audio",
    desc: "Direct peer-to-peer voice with no server in the middle.",
  },
  {
    icon: Sparkles,
    title: "Always free to start",
    desc: "10 minutes free per call. Upgrade for unlimited practice.",
  },
];

export function Lobby({
  onFindPartner,
  serverConnected,
  profile,
  accountType,
  onOpenAuth,
  onSignOut,
  onOpenFriends,
  pendingRequestCount,
  onOpenUpgrade,
}: LobbyProps) {
  const isPaid = isPaidPlanActive(profile);
  const displayName = profile?.display_name || "Guest";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      {/* Top bar with user identity */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-20">
        {/* User badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white text-sm font-medium max-w-[120px] truncate">
              {displayName}
            </span>
            {isPaid ? (
              <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                <Crown className="w-3 h-3" />
                Pro
              </span>
            ) : (
              <span className="text-slate-400 text-xs">Free</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Friends button */}
          <button
            onClick={onOpenFriends}
            className="relative p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            aria-label="Friends"
          >
            <Users className="w-5 h-5 text-slate-300" />
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingRequestCount}
              </span>
            )}
          </button>

          {/* Upgrade button (only for free users) */}
          {!isPaid && (
            <button
              onClick={onOpenUpgrade}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:from-amber-500/30 hover:to-orange-500/30 transition-all"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">Upgrade</span>
            </button>
          )}

          {/* Auth / Sign out */}
          {accountType === "registered" ? (
            <button
              onClick={onSignOut}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 text-slate-300" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
            >
              <UserCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="text-center max-w-2xl mb-12 mt-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Free P2P Voice Practice
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-4">
          Speak<span className="text-emerald-400">Up</span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-lg mx-auto">
          Find a random partner and practice English speaking in real-time,
          1-on-1. {!isPaid && "10 minutes free per call. "}
          {isPaid && "Unlimited calling with your Pro plan. "}
          No cost to start.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onFindPartner}
        disabled={!serverConnected}
        className="group relative px-10 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-lg font-semibold transition-all duration-300 shadow-2xl shadow-emerald-500/30 hover:scale-105 active:scale-100 mb-2"
      >
        {serverConnected ? "Find a Partner" : "Connecting to server..."}
      </button>
      <p className="text-slate-500 text-sm mb-16">
        {serverConnected
          ? "You'll be matched with the next available learner."
          : "Establishing connection to the signaling server..."}
      </p>

      {/* Features grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl w-full">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors duration-200"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
