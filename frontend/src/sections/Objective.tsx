import Reveal from "../components/Reveal";

const REAL_WORLD_USE_CASES = [
  {
    title: "Automated Consumer & Fintech Underwriting",
    role: "Retail Banks, Neobanks, Buy-Now-Pay-Later (BNPL)",
    description:
      "Evaluates loan applicants in milliseconds. Instead of manual underwriting queues taking 3–5 business days, CREDENCE delivers instant, risk-calibrated decisions with zero human latency.",
    stat: "< 45ms",
    statLabel: "Decision Latency",
    tag: "Fintech Automation",
  },
  {
    title: "Asymmetric Business Cost Minimization",
    role: "Chief Risk Officers (CRO) & Portfolio Managers",
    description:
      "Standard ML optimizes generic accuracy or 0.5 coin-flip cutoffs. In real banking, missing a default (losing $20,000 principal) is 5× more catastrophic than declining a good borrower ($500 lost margin). CREDENCE tunes thresholds directly against dollar costs.",
    stat: "5.0× : 1.0×",
    statLabel: "FN vs FP Loss Ratio",
    tag: "Cost Optimization",
  },
  {
    title: "Adverse Action & Regulatory Compliance",
    role: "Legal, Compliance & Fair Lending (FCRA / ECOA)",
    description:
      "Federal regulations require lenders to provide exact, legally justifiable reasons when declining credit. CREDENCE uses exact TreeSHAP attribution to pinpoint why an application was rejected (e.g. debt-to-income, card utilization, recent delinquencies).",
    stat: "100%",
    statLabel: "Explainable Attribution",
    tag: "Fair Lending / FCRA",
  },
  {
    title: "Macroeconomic Shock & Drift Early Warning",
    role: "MLOps & Model Risk Governance (MRM)",
    description:
      "When central banks hike interest rates or inflation squeezes consumer balance sheets, old training data becomes obsolete. CREDENCE continuously monitors Population Stability Index (PSI) distributions and triggers automated retraining before portfolio defaults surge.",
    stat: "PSI ≥ 0.25",
    statLabel: "Automated Retrain Gate",
    tag: "Drift Governance",
  },
];

const PARADIGM_COMPARISON = [
  {
    aspect: "Data Partitioning",
    traditional: "Random train/test splits that leak future economic conditions into past training.",
    credence: "Strict time-based boundaries (Months 0–29 Train, 30–35 Validation, 36–47 Live).",
  },
  {
    aspect: "Decision Threshold",
    traditional: "Arbitrary 0.5 probability cutoff, ignoring actual dollar losses from defaults.",
    credence: "Cost-curve optimization minimizing (5 × False Negatives + 1 × False Positives).",
  },
  {
    aspect: "Model Explainability",
    traditional: "Opaque 'black box' scores that fail regulatory compliance and audit reviews.",
    credence: "TreeSHAP attribution decomposing every single decision into exact dollar drivers.",
  },
  {
    aspect: "Production Drift",
    traditional: "Models sit unmonitored until delinquency rates spike months later.",
    credence: "Continuous PSI telemetry with real-time histogram shifts and automated retraining.",
  },
];

export default function Objective() {
  return (
    <section id="objective" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <div className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/10 px-3.5 py-1 text-xs font-mono text-lime">
          <span>00 · OBJECTIVE & INDUSTRY IMPACT</span>
        </div>
        <h2 className="headline mt-4 text-5xl text-paper md:text-7xl">
          Why this project exists:{" "}
          <span className="grad-text font-serifit italic block sm:inline">
            Real-world credit risk.
          </span>
        </h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
          Every second, algorithmic systems decide who buys a home, who expands a small business, and
          who gets denied capital. <strong className="text-paper">CREDENCE</strong> bridges the
          dangerous divide between machine learning engineering, banking regulatory compliance, and
          financial solvency.
        </p>
      </Reveal>

      {/* Real-World Use Cases Grid */}
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {REAL_WORLD_USE_CASES.map((uc, i) => (
          <Reveal key={uc.title} delay={i * 0.08}>
            <div className="group relative flex h-full flex-col justify-between rounded-card border border-line bg-surface/40 p-7 transition-all duration-300 hover:border-lime/50 hover:bg-surface/70 hover:shadow-[0_0_25px_rgba(217,255,63,0.08)]">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime">
                    {uc.tag}
                  </span>
                  <span className="font-mono text-xs text-muted">{uc.role}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-paper group-hover:text-lime transition-colors">
                  {uc.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{uc.description}</p>
              </div>

              <div className="mt-6 flex items-baseline justify-between border-t border-line/60 pt-4">
                <span className="font-mono text-xs uppercase text-muted">{uc.statLabel}</span>
                <span className="font-mono text-xl font-bold text-paper">{uc.stat}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Traditional Banking vs CREDENCE Paradigm */}
      <Reveal delay={0.2}>
        <div className="mt-20 rounded-card border border-line/80 bg-ink/60 p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-line gap-2">
            <div>
              <h3 className="font-display text-2xl font-bold text-paper">
                The Shift: Traditional Lending vs CREDENCE Architecture
              </h3>
              <p className="text-xs text-muted mt-1">
                How modern MLOps principles protect loan portfolios from catastrophic credit shocks
              </p>
            </div>
            <span className="rounded-full border border-lime/40 bg-lime/10 px-3 py-1 font-mono text-xs text-lime self-start sm:self-auto">
              Production-Grade Architecture
            </span>
          </div>

          <div className="mt-6 divide-y divide-line/40">
            {PARADIGM_COMPARISON.map((row) => (
              <div key={row.aspect} className="grid py-4 md:grid-cols-12 gap-3 text-sm">
                <div className="md:col-span-3 font-mono font-semibold text-paper flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                  {row.aspect}
                </div>
                <div className="md:col-span-4 text-muted/80 line-through decoration-rose-500/50">
                  <span className="text-rose-400/90 font-mono text-xs block mb-1">Traditional Method:</span>
                  {row.traditional}
                </div>
                <div className="md:col-span-5 text-paper font-medium bg-lime/[0.03] p-2.5 rounded-lg border border-lime/20">
                  <span className="text-lime font-mono text-xs block mb-1">The CREDENCE Standard:</span>
                  {row.credence}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
