import { useEffect, useState } from "react";
import { clearMockToast, toggleMockMode, useGlobal } from "../store";

export default function MockModeHUD() {
  const isMock = useGlobal((s) => s.mock);
  const toastMessage = useGlobal((s) => s.mockToast);
  const [visible, setVisible] = useState(true);

  // Auto-dismiss toast message banner after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <div className="fixed bottom-6 left-6 z-40 hidden sm:flex flex-col gap-2 pointer-events-none select-none">
      {/* Toast Notification when mode changes */}
      {visible && toastMessage && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line/80 bg-ink/90 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-sm font-bold ${
              isMock ? "bg-amber-400/20 text-amber-300 border border-amber-400/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}
          >
            {isMock ? "⚡" : "🟢"}
          </span>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              {isMock ? "High-Fidelity Simulation Active" : "FastAPI Backend Connected"}
            </span>
            <span className="text-xs text-paper/90 max-w-xs">{toastMessage}</span>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              clearMockToast();
            }}
            className="ml-2 text-muted hover:text-paper text-xs"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* Persistent Mini Indicator in Mock Mode */}
      {isMock && (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-ink/80 px-3 py-1 shadow-md backdrop-blur-md transition-all hover:border-amber-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="font-mono text-[10px] tracking-wider text-amber-300 font-semibold">
            MOCK ENGINE: 0ms LATENCY
          </span>
          <button
            onClick={toggleMockMode}
            className="ml-1 rounded px-1.5 py-0.2 font-mono text-[9px] bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 transition-colors"
            title="Switch to Live FastAPI API"
          >
            Switch to Live
          </button>
        </div>
      )}
    </div>
  );
}
