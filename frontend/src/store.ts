import { useSyncExternalStore } from "react";

export type GlobalState = {
  pd: number;
  decision: "APPROVE" | "REJECT";
  threshold: number;
  modelVersion: number;
  mock: boolean;
  driftShare: number;
  latencyMs: number;
  glossaryOpen: boolean;
  mockToast: string | null;
};

let state: GlobalState = {
  pd: 0.137,
  decision: "APPROVE",
  threshold: 0.34,
  modelVersion: 1,
  mock: false, // Start in Live API mode by default
  driftShare: 0,
  latencyMs: 0,
  glossaryOpen: false,
  mockToast: "🟢 Live API Connected: Querying live FastAPI backend on http://localhost:8000.",
};
const listeners = new Set<() => void>();

export function setGlobal(patch: Partial<GlobalState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useGlobal<T>(sel: (s: GlobalState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => sel(state),
  );
}

export const getGlobal = () => state;

export const toggleGlossary = () => setGlobal({ glossaryOpen: !state.glossaryOpen });
export const openGlossary = () => setGlobal({ glossaryOpen: true });
export const closeGlossary = () => setGlobal({ glossaryOpen: false });

export const toggleMockMode = () => {
  const next = !state.mock;
  setGlobal({
    mock: next,
    mockToast: next
      ? "⚡ Mock Mode Active: High-fidelity client simulation engine with 0ms latency."
      : "🟢 Live API Active: Connecting directly to FastAPI backend on http://localhost:8000.",
  });
};

export const clearMockToast = () => setGlobal({ mockToast: null });
