import { useMemo } from "react";
import { useInView } from "../hooks";

/** Self-drawing SVG line (stroke-dashoffset animated on scroll into view). */
export function LinePlot({ points, color = "#d9ff3f", label, markerX, height = 220 }: {
  points: [number, number][]; color?: string; label: string;
  markerX?: number; height?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const W = 460, H = height, PAD = 28;
  const { path, marker } = useMemo(() => {
    if (points.length === 0) return { path: "", marker: null as number | null };
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const xmax = Math.max(...xs, 1), ymax = Math.max(...ys, 1);
    const sx = (x: number) => PAD + (x / xmax) * (W - 2 * PAD);
    const sy = (y: number) => H - PAD - (y / ymax) * (H - 2 * PAD);
    return {
      path: points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" "),
      marker: markerX !== undefined ? sx(markerX) : null,
    };
  }, [points, H, markerX]);

  return (
    <div ref={ref} className="rounded-card border border-line bg-white/[0.02] p-4">
      <div className="mono-label mb-2">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD}
          fill="none" stroke="rgba(255,255,255,0.08)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2"
          style={{
            strokeDasharray: 1600,
            strokeDashoffset: inView ? 0 : 1600,
            transition: "stroke-dashoffset 1.8s cubic-bezier(0.22,1,0.36,1)",
          }} />
        {marker !== null && (
          <line x1={marker} x2={marker} y1={PAD} y2={H - PAD}
            stroke="#ff5a3c" strokeDasharray="4 3" />
        )}
      </svg>
    </div>
  );
}
