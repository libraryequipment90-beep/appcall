import { Phone, X } from "lucide-react";
import type { UserProfile } from "@/types";

interface IncomingCallModalProps {
  fromProfile: UserProfile;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ fromProfile, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
        <div className="relative inline-block mb-5">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-500/20">
            {fromProfile.display_name.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -inset-1 rounded-full border-2 border-emerald-400/40 animate-ping" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">{fromProfile.display_name}</h2>
        <p className="text-slate-400 text-sm mb-6">is calling you...</p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onDecline}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30"
            aria-label="Decline call"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={onAccept}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg shadow-emerald-500/30 animate-pulse"
            aria-label="Accept call"
          >
            <Phone className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
