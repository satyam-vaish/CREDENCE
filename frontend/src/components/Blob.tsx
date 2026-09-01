/**
 * THE LIVING RISK BLOB.
 * A closed Catmull-Rom spline through N=12 vertices; each vertex IS one
 * applicant feature. Radius per vertex:
 *     R(theta,t) = R0 * f(feature) * (1 + sum a_i * sin(omega*t + phi_i + k_i*theta)), omega = 0.7 rad/s
 * Drag a vertex -> the feature moves -> debounced POST /whatif (60ms) ->
 * the glow shifts lime->amber->ember as PD rises. Release springs back softly;
 * double-click locks the value in. Fully keyboard operable (arrows + Tab).
 * Offline: local logistic fallback keeps everything alive.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api, localScore, makeApplicant, type Applicant } from "../api";
import { clamp, REDUCED, riskColor } from "../lib";
import { getGlobal, setGlobal, useGlobal } from "../store";

export type FeatureDef = {
  key: keyof Applicant;
  label: string;
  min: number; max: number; step: number; init: number;
  polarity: 1 | -1;              // +1: dragging OUT increases the feature (risk up)
  categorical?: boolean;         // sent via /predict, not /whatif
  fmt: (v: number) => string;
};

export const FEATURES: FeatureDef[] = [
  { key: "annual_inc",  label: "INCOME",     min: 12000, max: 200000, step: 500, init: 62000, polarity: -1, fmt: (v) => `$${Math.round(v / 1000)}K` },
  { key: "dti",         label: "DTI",        min: 0,     max: 45,     step: 0.5, init: 18,    polarity: 1,  fmt: (v) => v.toFixed(1) },
  { key: "int_rate",    label: "RATE",       min: 5,     max: 30,     step: 0.1, init: 12.5,  polarity: 1,  fmt: (v) => `${v.toFixed(1)}%` },
  { key: "loan_amnt",   label: "LOAN",       min: 1000,  max: 40000,  step: 100, init: 15000, polarity: 1,  fmt: (v) => `$${Math.round(v / 1000)}K` },
  { key: "revol_util",  label: "REVOL UTIL", min: 0,     max: 110,    step: 1,   init: 34,    polarity: 1,  fmt: (v) => `${v.toFixed(0)}%` },
  { key: "delinq_2yrs", label: "DELINQ",     min: 0,     max: 6,      step: 1,   init: 0,     polarity: 1,  fmt: (v) => `${Math.round(v)}` },
  { key: "emp_length",  label: "EMP LENGTH", min: 0,     max: 10,     step: 1,   init: 5,     polarity: -1, fmt: (v) => `${Math.round(v)}y` },
  { key: "grade",       label: "GRADE",      min: 0,     max: 6,      step: 1,   init: 2,     polarity: 1,  categorical: true, fmt: (v) => "ABCDEFG"[clamp(Math.round(v), 0, 6)] },
  { key: "term",        label: "TERM",       min: 36,    max: 60,     step: 24,  init: 36,    polarity: 1,  categorical: true, fmt: (v) => `${v >= 48 ? 60 : 36}m` },
  { key: "credit_age",  label: "CREDIT AGE", min: 1,     max: 30,     step: 0.5, init: 9,     polarity: -1, fmt: (v) => `${v.toFixed(0)}y` },
  { key: "home_ownership", label: "HOUSING", min: 0,     max: 2,      step: 1,   init: 0,     polarity: 1,  categorical: true, fmt: (v) => ["RENT", "MORTGAGE", "OWN"][clamp(Math.round(v), 0, 2)] },
  { key: "purpose",     label: "PURPOSE",    min: 0,     max: 2,      step: 1,   init: 0,     polarity: 1,  categorical: true, fmt: (v) => ["DEBT CONSOL", "CARD", "HOME IMP"][clamp(Math.round(v), 0, 2)] },
];

export const DEFAULT_VALUES: number[] = FEATURES.map((f) => f.init);

const N = 12;
const OMEGA = 0.7;

type Props = {
  values: number[];
  onChange?: (index: number, value: number) => void;
  onScore?: (pd: number, changedIndex: number | null) => void;
  className?: string;
};

export default function Blob({ values, onChange, onScore, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const threshold = useGlobal((s) => s.threshold);
  const version = useGlobal((s) => s.modelVersion);

  const [pd, setPd] = useState(0);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; delta: number } | null>(null);
  const [locked, setLocked] = useState<boolean[]>(() => Array(N).fill(false));
  const [sel, setSel] = useState(0);

  // ---- refs declared BEFORE the effects that close over them ----
  const pdRef = useRef(0);
  const lockedRef = useRef(locked);
  const selRef = useRef(sel);
  const thresholdRef = useRef(threshold);
  const valuesRef = useRef(values);
  const coordsRef = useRef<[number, number][]>([]);
  const dragVal = useRef<(number | null)[]>(Array(N).fill(null));
  const dragStartPd = useRef(0);
  const dragIdx = useRef<number | null>(null);
  const springs = useRef<(null | { from: number; t0: number })[]>(Array(N).fill(null));
  const ghosts = useRef<number[][]>([]);
  const lastGhost = useRef(0);
  const visible = useRef(true);
  const onScoreRef = useRef(onScore);
  const onChangeRef = useRef(onChange);

  // mirror props/state into refs every render (cheap, effect-safe)
  pdRef.current = pd;
  lockedRef.current = locked;
  selRef.current = sel;
  thresholdRef.current = threshold;
  onScoreRef.current = onScore;
  onChangeRef.current = onChange;

  const norm = (i: number, v: number) => {
    const f = FEATURES[i];
    const x = clamp((v - f.min) / (f.max - f.min), 0, 1);
    return f.polarity > 0 ? x : 1 - x;          // risk direction -> radius
  };
  const denorm = (i: number, n: number) => {
    const f = FEATURES[i];
    const x = f.polarity > 0 ? n : 1 - n;
    return f.min + x * (f.max - f.min);
  };

  // debounced (60ms) scoring — stable identity, reads latest via refs
  const scoreNow = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (vals: number[], changedIdx: number | null) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const applicant = makeApplicant(vals);
        const before = pdRef.current;
        let newPd: number;
        let newThr: number | undefined;
        let newVer: number | undefined;
        const feat = changedIdx !== null ? FEATURES[changedIdx] : null;
        if (feat && !feat.categorical) {
          const res = await api.whatif(applicant, feat.key as string, vals[changedIdx as number]);
          newPd = res.default_probability;
          newVer = res.model_version;
        } else {
          const res = await api.predict(applicant);
          newPd = res.default_probability;
          newThr = res.threshold;
          newVer = res.model_version;
        }
        const g = getGlobal();
        const thr = newThr ?? g.threshold;
        setPd(newPd);
        pdRef.current = newPd;
        setGlobal({
          pd: newPd,
          threshold: thr,
          decision: newPd >= thr ? "REJECT" : "APPROVE",
          modelVersion: newVer || g.modelVersion,
        });
        if (changedIdx !== null) {
          setHover((h) => (h && h.i === changedIdx
            ? { ...h, delta: newPd - before } : h));
        }
        onScoreRef.current?.(newPd, changedIdx);
      }, 60);
    };
  }, []);

  // score on mount and on every externally-driven values change (sliders)
  useEffect(() => {
    const changed = values !== valuesRef.current;
    valuesRef.current = values;
    if (changed || pdRef.current === 0) {
      const applicant = makeApplicant(values);
      // seed pd synchronously from the fallback so the first paint has a number
      if (pdRef.current === 0) setPd(localScore(applicant));
      scoreNow(values, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  /* ------------------------------ render loop ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let W = 0, H = 0, DPR = 1;

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);   // DPR capped at 2
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    io.observe(wrap);

    let t = REDUCED ? 10 : 0;          // frozen frame under reduced motion
    let last = performance.now();
    let progress = REDUCED ? 1 : 0;    // draw-in animation

    const vertexPoints = (radii: number[], cx: number, cy: number) =>
      radii.map((r, i) => {
        const th = (i / N) * Math.PI * 2 - Math.PI / 2;
        return [cx + Math.cos(th) * r, cy + Math.sin(th) * r] as [number, number];
      });

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible.current || document.hidden) return;   // pause off-screen/hidden

      t += dt;
      progress = Math.min(1, progress + dt / 1.4);
      const R0 = Math.min(W, H) * 0.30;
      const cx = W / 2, cy = H / 2;

      // effective radii: drag value > spring-back > committed value
      const radii: number[] = [];
      for (let i = 0; i < N; i++) {
        const sp = springs.current[i];
        let n: number;
        if (dragIdx.current === i && dragVal.current[i] !== null) {
          n = norm(i, dragVal.current[i]!);
        } else if (sp) {
          const k = REDUCED ? 1 : Math.min(1, (now - sp.t0) / 600);
          const eased = 1 - Math.pow(1 - k, 3);          // soft spring-back
          n = norm(i, sp.from) * (1 - eased) + norm(i, valuesRef.current[i]) * eased;
          if (k >= 1) { springs.current[i] = null; n = norm(i, valuesRef.current[i]); }
        } else {
          n = norm(i, valuesRef.current[i]);
        }
        radii.push(R0 * (0.62 + 0.56 * n));
      }

      // organic morph — never stops (unless reduced motion)
      const morphed = radii.map((r, i) => {
        const th = (i / N) * Math.PI * 2;
        if (REDUCED) return r;
        const m = 0.055 * Math.sin(OMEGA * t + 0.7 + 2 * th)
                + 0.042 * Math.sin(OMEGA * 1.31 * t + 2.1 + 3 * th)
                + 0.028 * Math.sin(OMEGA * 0.63 * t + 4.2 + 5 * th);
        return r * (1 + m);
      });

      // ghost trails
      if (now - lastGhost.current > 110 && !REDUCED) {
        ghosts.current.push([...morphed]);
        if (ghosts.current.length > 4) ghosts.current.shift();
        lastGhost.current = now;
      }

      const pts = vertexPoints(morphed, cx, cy);
      coordsRef.current = pts;
      const risk = clamp(pdRef.current / Math.max(thresholdRef.current, 0.05), 0, 1);
      const glowColor = riskColor(risk);
      const gradRot = REDUCED ? 0 : t * 0.15;            // gradient slowly rotates

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // inner radial glow, color follows risk
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.5);
      rg.addColorStop(0, glowColor.replace("rgb", "rgba").replace(")", ",0.28)"));
      rg.addColorStop(0.55, glowColor.replace("rgb", "rgba").replace(")", ",0.07)"));
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);

      // ghost outlines
      ghosts.current.forEach((g, gi) => {
        const gp = vertexPoints(g, cx, cy);
        ctx.beginPath();
        drawClosedSpline(ctx, gp);
        ctx.strokeStyle = `rgba(217,255,63,${0.03 + gi * 0.02})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // main gradient stroke (conic if available, rotating)
      ctx.beginPath();
      drawClosedSpline(ctx, pts);
      let stroke: CanvasGradient;
      if (typeof ctx.createConicGradient === "function") {
        stroke = ctx.createConicGradient(gradRot, cx, cy);
        stroke.addColorStop(0, "#d9ff3f");
        stroke.addColorStop(0.35, "#d9ff3f");
        stroke.addColorStop(0.65, "#ffb62e");
        stroke.addColorStop(1, "#ff5a3c");
      } else {
        stroke = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0);
        stroke.addColorStop(0, "#d9ff3f");
        stroke.addColorStop(0.5, "#ffb62e");
        stroke.addColorStop(1, "#ff5a3c");
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 22;
      // draw-in via dash
      const perim = pts.reduce((acc, a, i) => {
        const b = pts[(i + 1) % N];
        return acc + Math.hypot(b[0] - a[0], b[1] - a[1]);
      }, 0);
      ctx.setLineDash([perim * (1 - Math.pow(1 - progress, 3)), perim]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // vertex dots (sel/locked read from refs -> no effect restarts)
      pts.forEach(([x, y], i) => {
        const isDrag = dragIdx.current === i;
        const isActive = i === selRef.current || isDrag;
        ctx.beginPath();
        ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "#f2eee3" : "#d9ff3f";
        ctx.fill();
        if (lockedRef.current[i]) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(217,255,63,0.7)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      });

      // decision core
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
      const pulse = 1 + 0.12 * Math.sin(OMEGA * t * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(242,238,227,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // follow the hovered vertex; bail out of re-render when still
      setHover((h) => {
        if (!h) return h;
        const [x, y] = pts[h.i];
        if (Math.abs(x - h.x) < 1 && Math.abs(y - h.y) < 1) return h;
        return { ...h, x, y };
      });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  /* ------------------------------ interaction ------------------------------ */
  const pickVertex = (mx: number, my: number) => {
    let best = -1, bd = 22;
    coordsRef.current.forEach(([x, y], i) => {
      const d = Math.hypot(x - mx, y - my);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };

  const localXY = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as [number, number];
  };

  const requestScore = (i: number) => {
    const vals = [...valuesRef.current];
    if (dragVal.current[i] !== null) vals[i] = dragVal.current[i]!;
    scoreNow(vals, i);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const [x, y] = localXY(e);
    const i = pickVertex(x, y);
    if (i < 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragIdx.current = i;
    dragStartPd.current = pdRef.current;
    setSel(i);
    springs.current[i] = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const [x, y] = localXY(e);
    if (dragIdx.current === null) {
      const i = pickVertex(x, y);
      setHover((h) => (i >= 0 ? { i, x, y, delta: h?.i === i ? h.delta : 0 } : null));
      return;
    }
    const i = dragIdx.current;
    const r = canvasRef.current!.getBoundingClientRect();
    const R0 = Math.min(r.width, r.height) * 0.30;
    const d = Math.hypot(x - r.width / 2, y - r.height / 2);
    const n = clamp((d / R0 - 0.62) / 0.56, 0, 1);
    const v = denorm(i, n);                    // denorm applies polarity itself
    dragVal.current[i] = v;
    setHover({ i, x, y, delta: pdRef.current - dragStartPd.current });
    requestScore(i);
  };

  const onPointerUp = () => {
    const i = dragIdx.current;
    dragIdx.current = null;
    if (i === null) return;
    if (lockedRef.current[i] && dragVal.current[i] !== null) {
      // locked: commit the dragged value to the parent (sliders follow)
      onChangeRef.current?.(i, dragVal.current[i]!);
      dragVal.current[i] = null;
    } else if (dragVal.current[i] !== null) {
      // unlocked: soft spring back to the committed value
      springs.current[i] = { from: dragVal.current[i]!, t0: performance.now() };
      dragVal.current[i] = null;
      scoreNow(valuesRef.current, i);
    }
  };

  const toggleLock = (i: number) => {
    setLocked((L) => {
      const next = [...L];
      next[i] = !next[i];
      if (next[i] && dragVal.current[i] !== null) {
        onChangeRef.current?.(i, dragVal.current[i]!);
        dragVal.current[i] = null;
      }
      return next;
    });
  };

  // keyboard dragging: Tab cycles vertices, arrows step the selected feature
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setSel((s) => (s + (e.shiftKey ? N - 1 : 1)) % N);
      return;
    }
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = selRef.current;
    const f = FEATURES[i];
    const v = clamp(valuesRef.current[i] + dir * f.step, f.min, f.max);
    onChangeRef.current?.(i, v);
    const vals = [...valuesRef.current]; vals[i] = v;
    valuesRef.current = vals;
    scoreNow(vals, i);
  };

  const f = hover ? FEATURES[hover.i] : null;
  const liveHoverVal = hover
    ? (dragVal.current[hover.i] ?? valuesRef.current[hover.i])
    : 0;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Interactive risk blob: 12 vertices, one per applicant feature. Tab to cycle vertices, arrow keys to drag."
        className="h-full w-full touch-none rounded-card outline-lime focus-visible:outline focus-visible:outline-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={(e) => {
          const [x, y] = localXY(e);
          const i = pickVertex(x, y);
          if (i >= 0) toggleLock(i);
        }}
        onKeyDown={onKeyDown}
      />

      {/* mono annotations */}
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        N = 12 FEATURES<br />Ω = 0.7 RAD/S
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        PD(x) = σ(β₀ + Σ βᵢxᵢ)<br />CONTINUOUS RE-SCORING
      </div>

      {/* live readout — flips ember on REJECT */}
      <div
        className={`pointer-events-none absolute right-3 top-3 rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] transition-colors duration-300 ${
          pd >= threshold ? "border-ember text-ember" : "border-lime/40 text-lime"
        }`}
      >
        PD {pd.toFixed(3)} · {pd >= threshold ? "REJECT" : "APPROVE"} · v{version || 3}
      </div>

      {/* hover / drag tooltip */}
      {hover && f && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-ink/90 px-2.5 py-1.5 font-mono text-[11px] text-paper"
          style={{ left: hover.x + 14, top: hover.y - 34 }}
        >
          {f.label} = {f.fmt(liveHoverVal)}
          {hover.delta !== 0 && (
            <span className={hover.delta > 0 ? "text-ember" : "text-lime"}>
              {"  ·  "}
              {hover.delta > 0 ? "+" : ""}
              {(hover.delta * 100).toFixed(1)}% PD
            </span>
          )}
          {locked[hover.i] && <span className="text-lime">  · LOCKED</span>}
        </div>
      )}
    </div>
  );
}

/** Closed Catmull-Rom spline -> cubic beziers. */
function drawClosedSpline(ctx: CanvasRenderingContext2D, p: [number, number][]) {
  const n = p.length;
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  ctx.closePath();
}
