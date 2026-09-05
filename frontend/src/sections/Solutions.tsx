import Reveal from "../components/Reveal";
import { useGlobal } from "../store";

const STEPS = [
  {
    n: "01", title: "Raw application",
    body: "A 60-month, $20,000 loan at 18.9% for a borrower earning $52,000 — DTI 31, two delinquencies in 24 months, revolving utilization at 72%.",
    formula: "loan_amnt=20000 · term=60 · int_rate=18.9 · annual_inc=52000 · dti=31 · delinq_2yrs=2",
  },
  {
    n: "02", title: "Validation gate",
    body: "Pandera checks 14 constraints (term ∈ {36,60}, grade ∈ A–G, DTI ∈ [0,60]…). One violation fails the pipeline before training.",
    formula: "validate(df) → PASS · 0 rows quarantined",
  },
  {
    n: "03", title: "Features (leakage-free)",
    body: "Payment columns (total_pymnt, out_prncp…) are dropped — they are observed after the outcome and would leak the label. Engineered: log_income, installment, rate×DTI.",
    formula: "installment = A·r / (1 − (1+r)^(−n)),  r = 0.189/12, n = 60 → 516.6",
  },
  {
    n: "04", title: "Model probability",
    body: "The champion LightGBM (isotonic-calibrated) maps the feature vector to a default probability for the live period.",
    formula: "PD(x) = σ(f(x)) = 0.412",
  },
  {
    n: "05", title: "SHAP breakdown",
    body: "TreeSHAP on the transformed vector: utilization, rate and delinquencies push risk up; credit age and income pull it down.",
    formula: "revol_util +0.081 · int_rate +0.064 · delinq +0.052 · credit_age −0.021 · income −0.014",
  },
  {
    n: "06", title: "Threshold → decision",
    body: "The cost-optimal cutoff (minimizing 5·FN + 1·FP) is compared against PD. 0.412 ≥ 0.34 → decline, with reasons attached for the applicant.",
    formula: "0.412 ≥ 0.34 → REJECT · expected cost saved ≈ 1.8× vs a 0.5 cutoff",
  },
];

const NOTES = [
  { t: "Why time-based splits", b: "Credit is non-stationary: borrowers next quarter are not a random reshuffle of last quarter's. Random splits leak the future into training and inflate AUC by 3–6 points in our experiments. Train on months 0–29, validate on 30–35, and treat 36–47 as the live era." },
  { t: "PSI vs KS", b: "PSI compares feature/population distributions bin-by-bin and is the standard drift alarm; KS measures how well the model separates goods and bads. PSI watches the world, KS watches the model — you need both, and neither replaces the other." },
  { t: "Choosing a threshold by cost", b: "A missed default costs ~5× a declined good loan. Argmin over the cost curve lands near 0.34 — far below the lazy 0.5 — and cuts expected cost by roughly a third on validation." },
  { t: "What broke in production", b: "At month ~33 rates and delinquencies jumped (the engineered shock). PSI crossed 0.25 on int_rate and dti, the share of drifted features passed 0.30, retraining fired, and the challenger beat production's val AUC — v3 became v4. Without the monitor, the model would have silently over-approved." },
];

export default function Solutions() {
  const version = useGlobal((s) => s.modelVersion);
  return (
    <section id="solutions" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <p className="mono-label">05 · SOLUTIONS</p>
        <h2 className="headline mt-3 text-6xl text-paper md:text-7xl">
          A worked{" "}
          <span className="grad-text font-serifit italic">solution.</span>
        </h2>
      </Reveal>

      <div className="mt-12 space-y-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.04}>
            <div className="grid gap-4 rounded-card border border-line bg-white/[0.02] p-6 md:grid-cols-[70px_1fr]">
              <div className="font-mono text-2xl text-lime">{s.n}</div>
              <div>
                <h3 className="text-xl text-paper">{s.title}</h3>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{s.body}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-ink/70 px-4 py-3 font-mono text-[12px] text-lime">{s.formula}</pre>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {NOTES.map((n, i) => (
          <Reveal key={n.t} delay={i * 0.05}>
            <div className="rounded-card border border-line bg-white/[0.02] p-6">
              <h3 className="font-serifit text-2xl italic text-amber">{n.t}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{n.b}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mono-label mt-8">CURRENT LIVE MODEL: v{version} · DECISIONS RE-SCORED CONTINUOUSLY</p>
    </section>
  );
}
