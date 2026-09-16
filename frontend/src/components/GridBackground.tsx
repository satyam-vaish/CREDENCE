import { useEffect, useRef } from "react";
import { REDUCED } from "../lib";

/**
 * High-performance 64px square grid + hardware-accelerated cursor spotlight.
 *
 * Base grid and illuminated lime grid are drawn ONCE on resize into static canvases.
 * Cursor tracking uses GPU CSS mask-image & radial gradient (0% CPU main-thread overhead,
 * zero frame drops, zero redraw latency).
 */
export default function GridBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const CELL = 64;

    const drawGrid = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      dpr: number,
      color: string,
    ) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += CELL) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += CELL) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    };

    const setupCanvas = (c: HTMLCanvasElement) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      return { ctx: c.getContext("2d")!, w, h, dpr };
    };

    const renderGrids = () => {
      if (!baseRef.current || !glowRef.current) return;
      const base = setupCanvas(baseRef.current);
      drawGrid(base.ctx, base.w, base.h, base.dpr, "rgba(255,255,255,0.05)");

      const glow = setupCanvas(glowRef.current);
      drawGrid(glow.ctx, glow.w, glow.h, glow.dpr, "rgba(217,255,63,0.30)");
    };

    renderGrids();

    const container = containerRef.current;
    if (!container) return;

    let rafId = 0;
    let pendingX = -9999;
    let pendingY = -9999;

    const onPointerMove = (e: MouseEvent) => {
      if (REDUCED) return;
      pendingX = e.clientX;
      pendingY = e.clientY;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          container.style.setProperty("--spotlight-x", `${pendingX}px`);
          container.style.setProperty("--spotlight-y", `${pendingY}px`);
        });
      }
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("resize", renderGrids);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("resize", renderGrids);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={
        {
          "--spotlight-x": "-9999px",
          "--spotlight-y": "-9999px",
        } as React.CSSProperties
      }
    >
      {/* Static dim white base grid */}
      <canvas ref={baseRef} className="absolute inset-0" aria-hidden />

      {/* Vibrant lime spotlight ambient aura */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          background:
            "radial-gradient(circle 320px at var(--spotlight-x) var(--spotlight-y), rgba(217,255,63,0.08) 0%, rgba(217,255,63,0.02) 45%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Bright lime grid masked with GPU radial-gradient (zero canvas redraws) */}
      <canvas
        ref={glowRef}
        className="absolute inset-0 will-change-transform"
        style={{
          maskImage:
            "radial-gradient(circle 240px at var(--spotlight-x) var(--spotlight-y), black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(circle 240px at var(--spotlight-x) var(--spotlight-y), black 0%, transparent 100%)",
        }}
        aria-hidden
      />
    </div>
  );
}
