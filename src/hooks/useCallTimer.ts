import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

/** Counts up every second while `active` is true, resets to 0 when it goes false. */
export function useCallTimer(active: boolean): string {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return formatDuration(seconds);
}
