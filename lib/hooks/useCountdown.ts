"use client";

import { useEffect, useState } from "react";

export function useCountdown(seconds: number | null): number {
  const [remaining, setRemaining] = useState(() => seconds ?? 0);

  useEffect(() => {
    if (seconds === null) return;
    const endsAt = Date.now() + seconds * 1000;
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [seconds]);

  return seconds === null ? 0 : remaining;
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
