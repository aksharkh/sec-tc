"use client";

import { create } from "zustand";
import { useSyncExternalStore } from "react";

/** Transient UI state shared between the shell, the command palette and pages. Not persisted. */
type UiState = {
  paletteOpen: boolean;
  uploadOpen: boolean;
  mobileNavOpen: boolean;
  set: (p: Partial<Omit<UiState, "set">>) => void;
};

export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  uploadOpen: false,
  mobileNavOpen: false,
  set: (p) => set(p),
}));

const noop = () => () => {};

/** Reads a query-string value on the client only (avoids a Suspense boundary for useSearchParams). */
export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
