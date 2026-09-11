import { useEffect, useState } from "react";
import Reveal from "../components/Reveal";

const STAGES = [
  { n: "01", name: "Ingest", metric: "43,200 rows · 48 months" },
  { n: "02", name: "Validate", metric: "14 schema checks · fail-fast" },
  { n: "03", name: "Train", metric: "3 models · 50 optuna trials" },
  { n: "04", name: "Register", metric: "promote only if AUC beats prod" },
  { n: "05", name: "Serve", metric: "/whatif p99 ≈ 3ms" },
  { n: "06", name: "Monitor", metric: "PSI × 8 · Prometheus · Grafana" },
];

/** Animated SVG: packets travelling along the MLOps graph, active stage lit. */
function Diagram({ active }: { active: number }) {
  const paths = [
    "M60,60 L180,60", "M240,60 L360,60", "M420,60 L540,60",
    "M540,90 L540,150", "M540,180 L360,180 L360,240", "M360,270 L120,270 L120,180",
  ];
  return (
    <svg viewBox="0 0 600 320" className="w-full" aria-hidden>
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none"
            stroke={i === active ? "#d9ff3f" : "rgba(255,255,255,0.12)"} strokeWidth="1.5" />
          <circle r="3.5" fill={i === active ? "#d9ff3f" : "#9a9a94"}>
            <animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={d} />
          </circle>
        </g>
      ))}
      {[
        { x: 30, y: 60, t: "DVC" }, { x: 210, y: 60, t: "VALIDATE" },
        { x: 390, y: 60, t: "MLFLOW" }, { x: 510, y: 60, t: "REGISTRY" },
        { x: 330, y: 180, t: "FASTAPI" }, { x: 90, y: 270, t: "PROM/GRAF" },
      ].map((n, i) => (
        <g key={n.t}>
          <rect x={n.x - 26} y={n.y - 16} width={110} height={32} rx={10}
            fill={i === active ? "rgba(217,255,63,0.12)" : "rgba(255,255,255,0.03)"}
            stroke={i === active ? "#d9ff3f" : "rgba(255,255,255,0.14)"} />
          <text x={n.x + 29} y={n.y + 4} textAnchor="middle" fontSize="10"
            fontFamily="JetBrains Mono" letterSpacing="2"
            fill={i === active ? "#d9ff3f" : "#9a9a94"}>{n.t}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Pipeline() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="pipeline" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <p className="mono-label">02 · PIPELINE</p>
        <h2 className="headline mt-3 text-6xl text-paper md:text-7xl">
          From raw loans{" "}
          <span className="grad-text font-serifit italic">to live decisions.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          {STAGES.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.05}>
              <button
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                data-cursor="VIEW"
                className={`group flex w-full items-center justify-between border-l-2 px-5 py-6 text-left transition-all duration-300 ${
                  active === i
                    ? "-translate-y-0.5 border-l-lime bg-white/[0.04]"
                    : "border-l-line hover:bg-white/[0.02]"
                }`}
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-xs text-muted">{s.n}</span>
                  <span className="text-2xl text-paper">{s.name}</span>
                </span>
                <span className="font-mono text-[11px] tracking-wider text-muted">
                  {s.metric}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="rounded-card border border-line bg-white/[0.02] p-6">
          <Diagram active={active} />
          <p className="mono-label mt-4 text-center">
            DVC → VALIDATION → MLFLOW → REGISTRY → FASTAPI → PROMETHEUS/GRAFANA
          </p>
        </Reveal>
      </div>
    </section>
  );
}
