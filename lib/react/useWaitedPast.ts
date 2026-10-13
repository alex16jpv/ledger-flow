"use client";

import { useEffect, useState } from "react";

export function useWaitedPast(waiting: boolean, patienceMs: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!waiting || past) return undefined;
    const timer = setTimeout(() => {
      setPast(true);
    }, patienceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting, past, patienceMs]);
  return past;
}
