import { useEffect, useRef, useState } from "react";
import { connectEvents } from "./api";
import { setGlobal } from "./store";

/** Debounced callback (used for the 60ms what-if debounce and slider spam). */
export function useDebouncedFn<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return (...args: A) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => latest.current(...args), ms);
  };
}

/** Fires once when the element scrolls into view with smooth proactive rootMargin. */
export function useInView<T extends HTMLElement>(threshold = 0.08, rootMargin = "0px 0px -40px 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return [ref, inView] as const;
}

/** Live model version + drift status from SSE /events (with synthetic fallback). */
export function useEvents() {
  useEffect(
    () =>
      connectEvents((e) => {
        if (e.type === "tick" || e.type === "prediction") {
          if (typeof e.latency_ms === "number") setGlobal({ latencyMs: e.latency_ms as number });
          if (typeof e.drift_share === "number") setGlobal({ driftShare: e.drift_share as number });
          if (typeof e.version === "number") setGlobal({ modelVersion: e.version as number });
          if (typeof e.pd === "number") setGlobal({ pd: e.pd as number });
        }
        if (e.type === "retrained" && typeof e.version === "number") {
          setGlobal({ modelVersion: e.version as number });
        }
      }),
    [],
  );
}
