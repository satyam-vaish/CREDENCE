import { useEffect, useState } from "react";
import { clearMockToast, useGlobal } from "../store";

export default function MockModeHUD() {
  const isMock = useGlobal((s) => s.mock);
  const toastMessage = useGlobal((s) => s.mockToast);
  const [visible, setVisible] = useState(true);

  // Auto-dismiss toast message banner after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        clearMockToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!visible || !toastMessage) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2 pointer-events-auto select-none">
      <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-ink/90 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-sm font-bold ${
            isMock ? "bg-amber-400/20 text-amber-300 border border-amber-400/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          }`}
        >
          {isMock ? "⚡" : "🟢"}
        </span>
        <div className="flex flex-col text-left">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
            {isMock ? "Simulation Mode" : "Live API Connected"}
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
    </div>
  );
}
