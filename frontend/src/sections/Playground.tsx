import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Blob, { DEFAULT_VALUES, FEATURES } from "../components/Blob";
import Reveal from "../components/Reveal";
import { api, localScore, makeApplicant, type ExplainRes } from "../api";
import { useDebouncedFn } from "../hooks";
import { clamp } from "../lib";
import { useGlobal } from "../store";

export default function Playground() {
  const [values, setValues] = useState<number[]>(DEFAULT_VALUES);
  const [pd, setPd] = useState(() => localScore(makeApplicant(DEFAULT_VALUES)));
  const [explain, setExplain] = useState<ExplainRes | null>(null);
  const [deltas, setDeltas] = useState<{ label: string; from: number; to: number }[]>([]);
  const threshold = useGlobal((s) => s.threshold);
  const [thr, setThr] = useState<number | null>(null);
  const effThr = thr ?? threshold;
  const decision = pd >= effThr ? "REJECT" : "APPROVE";

  // debounced SHAP refresh (slider spam-safe)
  const explainLater = useDebouncedFn((vals: number[]) => {
    void api.explain(makeApplicant(vals)).then(setExplain);
  }, 150);

  const setOne = (i: number, v: number) => {
    setValues((vs) => {
      if (vs[i] === v) return vs;
      setDeltas((ds) => [
        ...ds.filter((d) => d.label !== FEATURES[i].label).slice(-4),
        { label: FEATURES[i].label, from: vs[i], to: v },
      ]);
      const next = [...vs]; next[i] = v;
      explainLater(next);
      return next;
    });
  };

  const maxAbs = useMemo(
    () => Math.max(...(explain?.contributions ?? [{ contribution: 0.1 }]).map((c) => Math.abs(c.contribution)), 0.0001),
    [explain],
  );

  const gaugePct = clamp(pd / (effThr * 1.6), 0, 1);

  return (
    <section id="playground" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <p className="mono-label">01 · PLAYGROUND</p>
        <h2 className="headline mt-3 text-6xl text-paper md:text-7xl">
          Pull a vertex.{" "}
          <span className="grad-text font-serifit italic">Watch the risk move.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="rounded-card border border-line bg-white/[0.02] p-6">
          <div className="h-[460px]" data-cursor="DRAG">
            <Blob values={values} onChange={setOne} onScore={setPd} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <label key={f.key} className="block">
                <span className="mono-label flex justify-between">
                  {f.label}
                  <span className="text-paper">{f.fmt(values[i])}</span>
                </span>
                <input type="range" className="mt-1.5 w-full" min={f.min} max={f.max}
                  step={f.step} value={values[i]}
                  onChange={(e) => setOne(i, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={0.05} className="rounded-card border border-line bg-white/[0.02] p-6">
            <div className="mono-label">LIVE PD GAUGE</div>
            <div className="mt-4 flex items-end gap-6">
              <div className="text-6xl font-bold tracking-tight"
                style={{ color: decision === "REJECT" ? "#ff5a3c" : "#d9ff3f" }}>
                {pd.toFixed(3)}
              </div>
              <span className={`rounded-full px-3 py-1 font-mono text-xs tracking-widest ${
                decision === "REJECT" ? "bg-ember/15 text-ember" : "bg-lime/15 text-lime"}`}>
                {decision}
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full"
                style={{ background: decision === "REJECT" ? "#ff5a3c" : "#d9ff3f" }}
                animate={{ width: `${gaugePct * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
              <span>0</span>
              <span className="text-ember">THRESHOLD {effThr.toFixed(2)}</span>
              <span>1</span>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="rounded-card border border-line bg-white/[0.02] p-6">
            <div className="mono-label mb-4">TOP-5 SHAP CONTRIBUTIONS</div>
            {(explain?.contributions ?? []).map((c) => (
              <div key={c.feature} className="mb-3">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="uppercase text-muted">{c.feature}</span>
                  <span style={{ color: c.contribution > 0 ? "#ff5a3c" : "#d9ff3f" }}>
                    {c.contribution > 0 ? "+" : ""}{(c.contribution * 100).toFixed(2)}% PD
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full"
                    style={{ background: c.contribution > 0 ? "#ff5a3c" : "#d9ff3f" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(c.contribution) / maxAbs) * 100}%` }}
                    transition={{ duration: 0.5 }} />
                </div>
              </div>
            ))}
            {!explain && <p className="text-sm text-muted">Drag a vertex or move a slider to compute contributions…</p>}
          </Reveal>

          <Reveal delay={0.15} className="rounded-card border border-line bg-white/[0.02] p-6">
            <div className="mono-label mb-3">WHAT CHANGED?</div>
            {deltas.length === 0 && <p className="text-sm text-muted">Nothing yet — move something.</p>}
            {deltas.map((d, i) => (
              <div key={`${d.label}-${i}`} className="flex justify-between py-1 font-mono text-[11px]">
                <span className="text-muted">{d.label}</span>
                <span className="text-paper">
                  {d.from.toFixed(1)} <span className="text-lime">→</span> {d.to.toFixed(1)}
                </span>
              </div>
            ))}
            <label className="mt-5 block">
              <span className="mono-label flex justify-between">
                DECISION THRESHOLD
                <span className="text-paper">{effThr.toFixed(2)}</span>
              </span>
              <input type="range" className="mt-1.5 w-full" min={0.05} max={0.8} step={0.01}
                value={effThr} onChange={(e) => setThr(Number(e.target.value))} />
            </label>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
