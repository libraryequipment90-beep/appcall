import { X, Crown, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { isPlayBillingAvailable } from "@/lib/googlePlayBilling";

interface UpgradeModalProps {
  onClose: () => void;
  onUpgrade: () => Promise<string | null>;
  onRestore: () => Promise<string | null>;
  reason?: string;
}

const PERKS = [
  "Unlimited call duration — no 10-minute cap",
  "Direct calling — call friends anytime, not just random matching",
  "Priority matching in the queue",
];

export function UpgradeModal({ onClose, onUpgrade, onRestore, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billingAvailable = isPlayBillingAvailable();

  const run = async (action: () => Promise<string | null>, setBusy: (v: boolean) => void) => {
    setBusy(true);
    setError(null);
    const err = await action();
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20">
          <Crown className="w-7 h-7 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Upgrade to Premium</h2>
        <p className="text-slate-400 text-sm mb-5">
          {reason || "Unlock unlimited calling and direct friend calls."}
        </p>

        {/* Plan card */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-5 mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-white">₹115</span>
            <span className="text-slate-400 text-sm">one-time</span>
            <span className="ml-auto text-xs text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded-full">
              Lifetime access
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            One simple payment for unlimited English speaking practice.
          </p>
        </div>

        <ul className="space-y-2.5 mb-6">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-sm text-slate-300">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={() => void run(onUpgrade, setLoading)}
          disabled={loading || restoring || !billingAvailable}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening Google Play...
            </>
          ) : (
            <>
              <Crown className="w-4 h-4" />
              Buy Now — ₹115
            </>
          )}
        </button>

        {!billingAvailable && (
          <p className="text-slate-500 text-xs text-center mt-3">
            Google Play purchase is available in the Android app.
          </p>
        )}

        <button
          onClick={() => void run(onRestore, setRestoring)}
          disabled={loading || restoring || !billingAvailable}
          className="w-full mt-3 text-slate-400 hover:text-white text-sm underline underline-offset-4 disabled:opacity-50 transition-colors"
        >
          {restoring ? "Restoring purchases..." : "Restore purchase"}
        </button>

        <p className="text-slate-500 text-xs text-center mt-4">
          Secure payment via Google Play Billing.
        </p>
      </div>
    </div>
  );
}
