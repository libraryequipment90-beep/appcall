import { Loader2 } from "lucide-react";

interface SearchingScreenProps {
  isFriendCall?: boolean;
  friendName?: string;
}

export function SearchingScreen({ isFriendCall, friendName }: SearchingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/20 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
        </div>
        <span className="absolute -inset-1 rounded-full border-2 border-emerald-400/20 animate-ping" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">
        {isFriendCall ? `Calling ${friendName}...` : "Finding a partner..."}
      </h2>
      <p className="text-slate-400 text-center max-w-sm">
        {isFriendCall
          ? "Waiting for your friend to answer. This usually takes just a few seconds."
          : "Looking for another English learner to practice with. This usually takes just a few seconds."}
      </p>

      <div className="flex gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
