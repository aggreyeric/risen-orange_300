import { useState, useEffect } from "react";

/** Re-renders every second so countdown timers stay live. */
export function useCountdown(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return Math.floor(Date.now() / 1000);
}
