import { useEffect, useRef } from "react";
import { REDUCED } from "../lib";

const GLYPHS = ["∫", "Σ", "σ", "β", "Δ", "π", "%", "β", "σ", "∫"];

/** Math/finance glyphs drifting on slow sine paths with efficient mouse parallax. */
export default function GlyphField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED) return;
    const el = ref.current;
    if (!el) return;

    let isVisible = true;
    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    io.observe(el);

    let rafId = 0;
    let pendingX = 0.5;
    let pendingY = 0.5;
    let dirty = false;

    const onMove = (e: MouseEvent) => {
      if (!isVisible) return;
      pendingX = e.clientX / window.innerWidth;
      pendingY = e.clientY / window.innerHeight;

      if (!dirty) {
        dirty = true;
        rafId = requestAnimationFrame(() => {
          dirty = false;
          if (!isVisible) return;
          const kids = el.children;
          for (let i = 0; i < kids.length; i++) {
            const k = kids[i] as HTMLElement;
            const depth = (i % 3) + 1;
            k.style.translate = `${(pendingX - 0.5) * 18 * depth}px ${(pendingY - 0.5) * 12 * depth}px`;
          }
        });
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform">
      {GLYPHS.map((g, i) => (
        <span
          key={i}
          className="absolute select-none font-serifit will-change-transform"
          style={{
            left: `${8 + ((i * 9.3) % 84)}%`,
            top: `${12 + ((i * 37) % 70)}%`,
            color: ["#6a7a3a", "#8a6a2e", "#7a3a2a"][i % 3],
            opacity: 0.1,
            animation: REDUCED ? undefined : `glyph-bob ${6 + (i % 6) * 1.2}s ease-in-out ${i * 0.4}s infinite`,
            fontSize: `${44 + ((i * 23) % 40)}px`,
          }}
        >
          {g}
        </span>
      ))}
    </div>
  );
}
