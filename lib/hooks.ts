"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/store";

/**
 * Ready once the persisted demo data has loaded and a short simulated
 * latency has passed, so loading skeletons are visible on every page load.
 */
export function useReady(min = 320) {
  const hydrated = useHydrated();
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), min + Math.floor(Math.random() * 160));
    return () => clearTimeout(t);
  }, [min]);
  return hydrated && elapsed;
}

/** Re-render on an interval so relative times ("3 minutes ago") stay fresh. */
export function useNowTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}
