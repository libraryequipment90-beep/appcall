import { Crown, X } from "lucide-react";

interface LimitReachedModalProps {
  onClose: () => void;
  onUpgrade: () => void;
  onFindNext: () => void;
}

export function LimitReachedModal({ onClose, onUpgrade, onFindNext }: LimitReachedModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 mx-auto shadow-lg shadow-amber-500/20">
          <Crown className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Daily 10 min free limit reached
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          You can find a new partner and talk for another 10 minutes, or upgrade
          for unlimited calling.
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onUpgrade}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Buy 100 Plan for 5 Months Unlimited
          </button>
          <button
            onClick={onFindNext}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium rounded-xl transition-colors"
          >
            Find a New Partner (Free)
          </button>
        </div>
      </div>
    </div>
  );
}
