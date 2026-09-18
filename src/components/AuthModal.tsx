import { useState } from "react";
import { X, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  onClose: () => void;
  initialMode?: "login" | "signup";
}

export function AuthModal({ onClose, initialMode = "login" }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      if (displayName.trim().length < 2) {
        setError("Please enter a display name (at least 2 characters).");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email.trim(), password, displayName.trim());
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      onClose();
    } else {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-1">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {mode === "signup"
            ? "Sign up to unlock unlimited calling and friend requests."
            : "Sign in to access your paid plan and friends."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Display Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(null); }}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
