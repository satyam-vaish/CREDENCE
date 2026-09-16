import { useEffect, useRef, useState } from "react";
import { REDUCED } from "../lib";

/**
 * Ultra-low-latency, classy custom cursor.
 * - Point dot tracks the hardware pointer with 0ms lag via direct translate3d.
 * - Trailing ring uses responsive spring physics (lerp 0.42) with luminous glow.
 * - Click ripple micro-animations and magnetic hover aura over interactive targets.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);

  const [label, setLabel] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    if (REDUCED || window.matchMedia("(pointer: coarse)").matches) return;

    document.body.classList.add("custom-cursor");

    // Coordinate storage (persists across hovers, avoiding cursor teleporting)
    const m = { x: -100, y: -100 };
    const r = { x: -100, y: -100 };
    let isVisible = false;
    let currentLabel: string | null = null;
    let currentHover = false;

    const onPointerMove = (e: PointerEvent) => {
      m.x = e.clientX;
      m.y = e.clientY;

      if (!isVisible) {
        isVisible = true;
        r.x = m.x;
        r.y = m.y;
      }

      // Zero-latency direct update for the dot
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${m.x - 4}px, ${m.y - 4}px, 0)`;
        dotRef.current.style.opacity = "1";
      }

      // Detect interactive elements or custom data-cursor labels
      const target = e.target as HTMLElement | null;
      const cursorTarget = target?.closest?.("[data-cursor]") as HTMLElement | null;
      const interactiveTarget = target?.closest?.(
        "a, button, input, select, textarea, [role='button'], .cursor-pointer, [data-interactive]"
      );

      const nextLabel = cursorTarget?.dataset.cursor ?? null;
      const nextHover = Boolean(cursorTarget || interactiveTarget);

      if (nextLabel !== currentLabel) {
        currentLabel = nextLabel;
        setLabel(nextLabel);
      }
      if (nextHover !== currentHover) {
        currentHover = nextHover;
        setIsHovered(nextHover);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      setIsClicking(true);
      if (rippleRef.current) {
        rippleRef.current.style.transform = `translate3d(${e.clientX - 24}px, ${e.clientY - 24}px, 0) scale(0.2)`;
        rippleRef.current.style.opacity = "0.8";
        rippleRef.current.style.transition = "none";

        // Trigger expanding ripple burst
        requestAnimationFrame(() => {
          if (rippleRef.current) {
            rippleRef.current.style.transition = "transform 0.45s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.45s ease-out";
            rippleRef.current.style.transform = `translate3d(${e.clientX - 24}px, ${e.clientY - 24}px, 0) scale(2.2)`;
            rippleRef.current.style.opacity = "0";
          }
        });
      }
    };

    const onPointerUp = () => {
      setIsClicking(false);
    };

    const onPointerLeave = () => {
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };

    const onPointerEnter = () => {
      if (dotRef.current) dotRef.current.style.opacity = "1";
      if (ringRef.current) ringRef.current.style.opacity = "1";
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.documentElement.addEventListener("pointerenter", onPointerEnter);

    // High-responsiveness spring tick loop for trailing aura ring (lerp = 0.40)
    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!isVisible) return;

      r.x += (m.x - r.x) * 0.42;
      r.y += (m.y - r.y) * 0.42;

      if (ringRef.current) {
        const scale = currentLabel ? 2.2 : currentHover ? 1.6 : 1.0;
        ringRef.current.style.transform = `translate3d(${r.x - 16}px, ${r.y - 16}px, 0) scale(${scale})`;
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.documentElement.removeEventListener("pointerenter", onPointerEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (REDUCED) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] hidden md:block select-none overflow-hidden"
    >
      {/* Click ripple burst */}
      <div
        ref={rippleRef}
        className="absolute h-12 w-12 rounded-full border border-lime bg-lime/10 opacity-0 pointer-events-none will-change-transform"
      />

      {/* Instant point dot with glowing corona */}
      <div
        ref={dotRef}
        className={`absolute h-2 w-2 rounded-full bg-lime shadow-[0_0_10px_#d9ff3f,0_0_20px_rgba(217,255,63,0.5)] transition-[opacity,background-color] duration-150 will-change-transform ${
          isClicking ? "scale-75 bg-[#ffb62e]" : ""
        }`}
        style={{ opacity: 0 }}
      />

      {/* Responsive trailing ring with magnetic expansion & label */}
      <div
        ref={ringRef}
        className={`absolute flex h-8 w-8 items-center justify-center rounded-full border transition-[border-color,background-color,box-shadow] duration-200 will-change-transform ${
          label
            ? "border-lime bg-lime/10 shadow-[0_0_20px_rgba(217,255,63,0.35)]"
            : isHovered
            ? "border-lime/90 bg-lime/5 shadow-[0_0_15px_rgba(217,255,63,0.25)]"
            : "border-lime/40 bg-transparent shadow-[0_0_8px_rgba(217,255,63,0.1)]"
        }`}
        style={{ opacity: 0 }}
      >
        {/* Subtle inner crosshair tick for precision aesthetic */}
        {isHovered && !label && (
          <span className="h-1 w-1 rounded-full bg-lime/80 animate-ping" />
        )}

        {label && (
          <span className="absolute -bottom-6 whitespace-nowrap rounded border border-lime/40 bg-ink/90 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.2em] text-lime shadow-md backdrop-blur-sm">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
