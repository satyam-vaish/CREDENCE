import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LinePlot } from "../components/Plots";
import Reveal from "../components/Reveal";
import { api, type DriftRes, type ModelInfo } from "../api";
import { useDebouncedFn } from "../hooks";
import { setGlobal, useGlobal } from "../store";

const BAND_COLOR: Record<string, string> = {
  stable: "#d9ff3f", moderate: "#ffb62e", significant: "#ff5a3c",
};

function PsiDial({ value, band }: { value: number; band: string }) {
  const pct = Math.min(value / 0.5, 1);
  const C = Math.PI * 48; // semicircle arc length (r=48)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-28">
        <path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" strokeLinecap="round" />
        <path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke={BAND_COLOR[band]} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={C}
          style={{ strokeDashoffset: C * (1 - pct), transition: "stroke-dashoffset .6s, stroke .4s" }} />
        <text x="60" y="58" textAnchor="middle" fontSize="15" fontFamily="JetBrains Mono"
          fill={BAND_COLOR[band]}>{value.toFixed(3)}</text>
      </svg>
      <span className="mono-label" style={{ color: BAND_COLOR[band] }}>{band}</span>
    </div>
  );
}

export default function Drift() {
  const [month, setMonth] = useState(40);
  const [drift, setDrift] = useState<DriftRes | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [model, setModel] = useState<"logreg" | "lightgbm" | "xgboost">("lightgbm");
  const [featIdx, setFeatIdx] = useState(0);
  const [banner, setBanner] = useState(false);
  const [timelineStep, setTimelineStep] = useState(-1);
  const version = useGlobal((s) => s.modelVersion);
  const firedRef = useRef(false);

  const runTimeline = useCallback(() => {
    setTimelineStep(0);
    [1, 2, 3, 4].forEach((s, i) => setTimeout(() => setTimelineStep(s), 700 * (i + 1)));
    setTimeout(async () => {
      const r = await api.retrain();
      setGlobal({ modelVersion: r.new_version });
    }, 3200);
  }, []);

  const doLoad = useCallback(async (m: number) => {
    const d = await api.simulate(m);
    setDrift(d);
    const trigger = !!d.should_retrain || d.drifted_share > 0.3;
    setBanner(trigger);
    if (trigger && !firedRef.current) { firedRef.current = true; runTimeline(); }
    if (!trigger) firedRef.current = false;
  }, [runTimeline]);

  const loadLater = useDebouncedFn((m: number) => { void doLoad(m); }, 180);
  useEffect(() => { loadLater(month); }, [month, loadLater]);
  useEffect(() => { void api.modelInfo().then(setInfo); }, []);

  const hists = drift?.histograms ?? [];
  const hist = hists[Math.min(featIdx, Math.max(hists.length - 1, 0))];
  const curve = (info?.curves?.[model]?.roc ?? [[0, 0], [1, 1]]) as [number, number][];
  const calib = (info?.curves?.[model]?.calibration ?? [[0, 0], [1, 1]]) as [number, number][];
  const cost = info?.cost?.curve ?? { thresholds: [], costs: [] };

  // bars are normalized per-feature so spiky features (delinq_2yrs) never overflow
  const maxV = hist ? Math.max(...hist.ref, ...hist.cur, 1e-6) : 1;
  const yv = (v: number) => 180 - (v / maxV) * 160;
  const hv = (v: number) => (v / maxV) * 160;

  return (
    <section id="drift" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <p className="mono-label">03 · PLOTS / DRIFT</p>
        <h2 className="headline mt-3 text-6xl text-paper md:text-7xl">
          When the world changes,{" "}
          <span className="grad-text font-serifit italic">the model notices.</span>
        </h2>
      </Reveal>

      <AnimatePresence>
        {banner && (
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            className="mt-8 overflow-hidden rounded-card border border-ember bg-ember/[0.08] p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm tracking-[0.2em] text-ember">▌RETRAIN TRIGGERED</span>
              <span className="font-mono text-[11px] text-muted">{drift?.reason}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["DRIFT DETECTED", "RETRAIN", "VALIDATE", "PROMOTE", "LIVE"].map((s, i) => (
                <span key={s} className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest transition-all duration-300 ${
                  timelineStep >= i ? "border-lime bg-lime/10 text-lime" : "border-line text-muted"}`}>
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* months scrubber */}
      <Reveal className="mt-10 rounded-card border border-line bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mono-label">MONTHS SINCE TRAINING</div>
            <div className="mt-1 font-mono text-3xl text-paper">
              M+{Math.max(0, month - 30)}
              <span className="ml-3 text-sm text-muted">month {month}/47</span>
            </div>
          </div>
          <button onClick={() => setMonth(46)}
            data-cursor="OPEN"
            className="rounded-2xl border border-ember px-5 py-2.5 font-mono text-xs tracking-widest text-ember transition hover:bg-ember/10">
            SIMULATE ECONOMIC SHOCK →
          </button>
        </div>
        <input type="range" min={0} max={47} value={month} className="mt-5 w-full"
          onChange={(e) => setMonth(Number(e.target.value))} aria-label="Months since training" />
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
          <span>TRAIN ERA</span><span className="text-amber">VALIDATION</span>
          <span className="text-ember">LIVE</span>
        </div>
      </Reveal>

      {/* histograms + PSI dials */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <Reveal className="rounded-card border border-line bg-white/[0.02] p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {hists.map((h, i) => (
              <button key={h.feature} onClick={() => setFeatIdx(i)}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest transition ${
                  i === featIdx ? "border-lime text-lime" : "border-line text-muted"}`}>
                {h.feature.toUpperCase()} · PSI {h.psi.psi.toFixed(2)}
              </button>
            ))}
          </div>
          {hist && (
            <svg viewBox="0 0 460 200" className="w-full" role="img"
              aria-label={`Reference vs current distribution of ${hist.feature}`}>
              {hist.ref.map((v, i) => (
                <rect key={`r${i}`} x={20 + i * (420 / hist.bins.length)}
                  width={420 / hist.bins.length - 3}
                  y={yv(v)} height={hv(v)}
                  fill="none" stroke="rgba(242,238,227,0.35)" strokeWidth="1" />
              ))}
              {hist.cur.map((v, i) => (
                <motion.rect key={`c${i}`} x={20 + i * (420 / hist.bins.length)}
                  width={420 / hist.bins.length - 3} fill="rgba(217,255,63,0.55)"
                  stroke="#d9ff3f" strokeWidth="1" rx="2"
                  initial={{ y: 180, height: 0 }}
                  animate={{ y: yv(v), height: hv(v) }}
                  transition={{ type: "spring", stiffness: 80, damping: 16 }} />
              ))}
            </svg>
          )}
          <p className="mono-label mt-2">OUTLINE = TRAINING REFERENCE · FILL = CURRENT BATCH</p>
        </Reveal>

        <Reveal delay={0.05} className="grid grid-cols-3 content-start gap-4 rounded-card border border-line bg-white/[0.02] p-6">
          {Object.entries(drift?.per_feature ?? {}).slice(0, 6).map(([f, v]) => (
            <div key={f}>
              <PsiDial value={v.psi} band={v.band} />
              <span className="mono-label mt-1 block text-center">{f.replace("_", " ")}</span>
            </div>
          ))}
          <div className="col-span-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
            DRIFTED SHARE {(drift?.drifted_share ?? 0).toFixed(2)} · TRIGGER &gt; 0.30 · MODEL v{version}
          </div>
        </Reveal>
      </div>

      {/* self-drawing plots */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Reveal>
          <div className="mb-3 flex gap-2">
            {(["logreg", "lightgbm", "xgboost"] as const).map((m) => (
              <button key={m} onClick={() => setModel(m)}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest transition ${
                  m === model ? "border-lime text-lime" : "border-line text-muted"}`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <LinePlot points={curve} label={`ROC — ${model.toUpperCase()}`} />
        </Reveal>
        <Reveal delay={0.05}>
          <LinePlot points={calib} color="#ffb62e" label="CALIBRATION (ISOTONIC)" />
        </Reveal>
        <Reveal delay={0.1}>
          <LinePlot points={cost.thresholds.map((t, i) => [t, cost.costs[i]] as [number, number])}
            color="#ff5a3c" label="COST vs THRESHOLD"
            markerX={info?.threshold} />
        </Reveal>
      </div>
    </section>
  );
}
