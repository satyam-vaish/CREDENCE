import { useEffect, useMemo, useRef, useState } from "react";
import { closeGlossary, toggleGlossary, useGlobal } from "../store";

export type AcronymItem = {
  acronym: string;
  fullName: string;
  category: "Applicant & Risk" | "Metrics & Validation" | "Drift & MLOps" | "Models & Algorithms";
  plainEnglish: string;
  ruleOfThumb: string;
  sectionId?: string;
  sectionLabel?: string;
};

export const ACRONYM_ITEMS: AcronymItem[] = [
  {
    acronym: "PD",
    fullName: "Probability of Default",
    category: "Applicant & Risk",
    plainEnglish:
      "The estimated percentage likelihood (0% to 100%) that a loan applicant will fail to make scheduled debt payments over their loan term.",
    ruleOfThumb:
      "If PD is below the decision threshold (e.g. < 15.8%), the loan is automatically APPROVED. Above the threshold, it is REJECTED.",
    sectionId: "playground",
    sectionLabel: "Playground & Hero",
  },
  {
    acronym: "DTI",
    fullName: "Debt-to-Income Ratio",
    category: "Applicant & Risk",
    plainEnglish:
      "The share of a borrower's monthly gross income spent paying down existing debt (credit cards, existing loans, auto/mortgage).",
    ruleOfThumb:
      "Below 36% is standard prime health. Over 43% indicates heavy debt stress and significantly elevates default probability.",
    sectionId: "playground",
    sectionLabel: "Applicant Sliders & Drift",
  },
  {
    acronym: "PSI",
    fullName: "Population Stability Index",
    category: "Drift & MLOps",
    plainEnglish:
      "A statistical metric measuring how much the live applicant distribution in production has drifted away from the original training baseline data.",
    ruleOfThumb:
      "PSI < 0.10: Stable (green). 0.10 ≤ PSI < 0.25: Moderate drift (yellow). PSI ≥ 0.25: Significant drift (red, triggers automated model retraining).",
    sectionId: "drift",
    sectionLabel: "Drift Dashboard Gauges",
  },
  {
    acronym: "KS",
    fullName: "Kolmogorov-Smirnov Statistic",
    category: "Metrics & Validation",
    plainEnglish:
      "The maximum vertical separation between the cumulative distribution function (CDF) of defaulting borrowers versus non-defaulting borrowers.",
    ruleOfThumb:
      "Measures default separation power. A KS score > 0.40 indicates high credit discrimination capability.",
    sectionId: "pipeline",
    sectionLabel: "Pipeline Validation",
  },
  {
    acronym: "ROC-AUC",
    fullName: "Receiver Operating Characteristic — Area Under Curve",
    category: "Metrics & Validation",
    plainEnglish:
      "Evaluates how effectively the model ranks risky borrowers above safe borrowers across every possible approval threshold.",
    ruleOfThumb:
      "0.50 = pure coin flip (random); 0.70–0.80 = good; 0.80–0.90 = excellent credit scoring performance.",
    sectionId: "drift",
    sectionLabel: "Model Curves & Pipeline",
  },
  {
    acronym: "PR-AUC",
    fullName: "Precision-Recall — Area Under Curve",
    category: "Metrics & Validation",
    plainEnglish:
      "The area under the Precision vs Recall curve. Especially vital in credit lending where defaults are rare (imbalanced data).",
    ruleOfThumb:
      "Unlike ROC-AUC, PR-AUC does not get artificially inflated by a large pool of easy approvals.",
    sectionId: "pipeline",
    sectionLabel: "Pipeline Metrics",
  },
  {
    acronym: "SHAP",
    fullName: "SHapley Additive exPlanations",
    category: "Applicant & Risk",
    plainEnglish:
      "A game-theory method that breaks down a loan decision into individual dollar/percentage contributions for each applicant attribute.",
    ruleOfThumb:
      "Positive SHAP (+%): pushes default probability UP (higher risk). Negative SHAP (-%): pushes default probability DOWN (lower risk).",
    sectionId: "playground",
    sectionLabel: "Playground Waterfall",
  },
  {
    acronym: "FN / FP",
    fullName: "False Negative vs False Positive (Cost Matrix)",
    category: "Applicant & Risk",
    plainEnglish:
      "False Negative (FN) = approving a borrower who ends up defaulting (lender loses principal). False Positive (FP) = declining an applicant who would have repaid (lender loses interest margin).",
    ruleOfThumb:
      "In Credence, an FN costs 5.0× more than an FP. The optimal decision threshold is mathematically calibrated to minimize total business cost.",
    sectionId: "drift",
    sectionLabel: "Cost vs Threshold Curve",
  },
  {
    acronym: "REVOL UTIL",
    fullName: "Revolving Credit Line Utilization Rate",
    category: "Applicant & Risk",
    plainEnglish:
      "The percentage of total revolving credit lines currently drawn by the borrower (Current Card Balances ÷ Total Credit Limits).",
    ruleOfThumb:
      "Under 30% is ideal. Above 75% signals liquidity strain and is one of the strongest early warning indicators of impending default.",
    sectionId: "playground",
    sectionLabel: "Playground & Drift Gauges",
  },
  {
    acronym: "DELINQ 2YRS",
    fullName: "Number of 30+ Days Past-Due Delinquencies (Past 2 Years)",
    category: "Applicant & Risk",
    plainEnglish:
      "The count of times within the past 24 months that an applicant was 30 or more days late on any credit account.",
    ruleOfThumb:
      "0 delinquencies is standard. A single late payment significantly increases default risk score.",
    sectionId: "playground",
    sectionLabel: "Playground Inputs",
  },
  {
    acronym: "LGBM",
    fullName: "Light Gradient Boosting Machine",
    category: "Models & Algorithms",
    plainEnglish:
      "A gradient boosted decision tree algorithm optimized for speed and tabular accuracy, using histogram-based binning and leaf-wise splitting.",
    ruleOfThumb:
      "Credence's primary production model, offering superior accuracy and fast low-latency inference.",
    sectionId: "drift",
    sectionLabel: "Drift Model Selector",
  },
  {
    acronym: "XGB",
    fullName: "eXtreme Gradient Boosting (XGBoost)",
    category: "Models & Algorithms",
    plainEnglish:
      "A gradient boosting library that includes second-order gradients and built-in L1/L2 regularization to prevent overfitting on credit tables.",
    ruleOfThumb:
      "Compared side-by-side with LightGBM and Logistic Regression in the Model Comparison dashboard.",
    sectionId: "drift",
    sectionLabel: "Drift Model Selector",
  },
  {
    acronym: "LOGREG",
    fullName: "Logistic Regression Baseline",
    category: "Models & Algorithms",
    plainEnglish:
      "A transparent, linear statistical model used by financial regulators as the primary baseline for credit risk transparency and log-odds scoring.",
    ruleOfThumb:
      "Serves as the explainability baseline against which modern gradient boosted trees are benchmarked.",
    sectionId: "drift",
    sectionLabel: "Drift Model Selector",
  },
  {
    acronym: "ISOTONIC",
    fullName: "Isotonic Probability Calibration",
    category: "Models & Algorithms",
    plainEnglish:
      "A post-processing calibration layer that aligns raw tree model prediction scores with true empirical default probabilities.",
    ruleOfThumb:
      "Ensures that when the model outputs a 15% probability of default, exactly 15 out of 100 historical applicants defaulted.",
    sectionId: "drift",
    sectionLabel: "Calibration Curve",
  },
  {
    acronym: "DGP",
    fullName: "Data Generating Process",
    category: "Drift & MLOps",
    plainEnglish:
      "The underlying economic environment and portfolio distributions that produce loan applications over time.",
    ruleOfThumb:
      "Credence features an engineered macroeconomic shock ramping up around month 33 to demonstrate live PSI drift detection and retraining.",
    sectionId: "drift",
    sectionLabel: "Drift Shock Simulation",
  },
  {
    acronym: "DVC",
    fullName: "Data Version Control",
    category: "Drift & MLOps",
    plainEnglish:
      "An open-source MLOps tool that versions massive datasets and ML pipelines using Git-like hashes without storing gigabytes inside Git.",
    ruleOfThumb:
      "Guarantees that any trained credit model can be traced back to the exact snapshot of training data that created it.",
    sectionId: "pipeline",
    sectionLabel: "MLOps Pipeline",
  },
  {
    acronym: "M+0 .. M+16",
    fullName: "Months Elapsed Since Deployment",
    category: "Drift & MLOps",
    plainEnglish:
      "The monthly time axis tracking portfolio aging. Months 0–29 are Train, 30–35 are Validation, and 36–47 are Live Production Simulation.",
    ruleOfThumb:
      "As macroeconomic conditions shift after month 33, PSI dials rise from green to orange and red.",
    sectionId: "drift",
    sectionLabel: "Drift Timeline Slider",
  },
  {
    acronym: "SSE",
    fullName: "Server-Sent Events",
    category: "Drift & MLOps",
    plainEnglish:
      "A real-time HTTP streaming mechanism allowing the FastAPI server to push retrain milestones and live drift telemetry directly to the frontend.",
    ruleOfThumb:
      "Powers the live retraining timeline animation without needing repeated network polling.",
    sectionId: "drift",
    sectionLabel: "Live Retraining Animation",
  },
  {
    acronym: "ANNUAL INC",
    fullName: "Annual Gross Stated Income",
    category: "Applicant & Risk",
    plainEnglish:
      "Self-reported annual gross income before taxes. High income reduces default probability by providing cash reserves for debt service.",
    ruleOfThumb:
      "Combined with loan amount and term to evaluate disposable income and solvency.",
    sectionId: "playground",
    sectionLabel: "Applicant Sliders",
  },
  {
    acronym: "LOAN AMNT",
    fullName: "Requested Loan Principal Amount",
    category: "Applicant & Risk",
    plainEnglish:
      "The total borrowed principal requested by the borrower (ranging from $1,000 to $40,000 in typical consumer portfolios).",
    ruleOfThumb:
      "Larger loan balances increase monthly installments, raising default sensitivity under economic shock.",
    sectionId: "playground",
    sectionLabel: "Applicant Sliders",
  },
  {
    acronym: "INT RATE",
    fullName: "Annual Loan Interest Rate",
    category: "Applicant & Risk",
    plainEnglish:
      "The annualized interest percentage charged on the principal balance over the duration of the loan.",
    ruleOfThumb:
      "High interest rates reflect riskier borrower profiles and increase the monthly cost of servicing debt.",
    sectionId: "playground",
    sectionLabel: "Drift Key Features",
  },
];

const CATEGORIES = [
  "All",
  "Applicant & Risk",
  "Drift & MLOps",
  "Metrics & Validation",
  "Models & Algorithms",
] as const;

export default function GlossaryDrawer() {
  const isOpen = useGlobal((s) => s.glossaryOpen);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Global hotkeys: '?' to toggle, 'Escape' to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "Escape" && isOpen) {
        closeGlossary();
      } else if (e.key === "?" && !isInput) {
        e.preventDefault();
        toggleGlossary();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ACRONYM_ITEMS.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.acronym.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q) ||
        item.plainEnglish.toLowerCase().includes(q) ||
        item.ruleOfThumb.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory]);

  const handleJumpToSection = (sectionId?: string) => {
    if (!sectionId) return;
    closeGlossary();
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: string, o?: object) => void } }).__lenis;
    if (lenis) {
      lenis.scrollTo(`#${sectionId}`, { offset: -80 });
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Floating Side Trigger Pill (Classy cyber-fintech pill fixed on right edge) */}
      <button
        onClick={toggleGlossary}
        data-cursor="GLOSSARY"
        aria-label="Toggle Acronyms & Short Forms Glossary"
        className="group fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-lime/40 bg-ink/90 px-3.5 py-4 shadow-[0_0_25px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-lime hover:bg-surface hover:shadow-[0_0_20px_rgba(217,255,63,0.25)] hover:-translate-x-1"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
        </span>
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold tracking-wider text-lime">ACRONYMS</span>
            <span className="rounded bg-lime/20 px-1 py-0.2 font-mono text-[9px] text-lime font-semibold">?</span>
          </div>
          <span className="text-[10px] text-paper/60 transition-colors group-hover:text-paper/90">
            Full Forms & Guide
          </span>
        </div>
      </button>

      {/* Drawer Overlay Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeGlossary}
        aria-hidden="true"
      />

      {/* Sliding Side Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Short Forms & Glossary Knowledge Base"
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-lg flex-col border-l border-lime/30 bg-[#0c0f14]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out sm:w-[480px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex flex-col border-b border-line p-5">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime/15 text-lime border border-lime/30 font-mono text-xs font-bold">
                ?
              </span>
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-paper">
                  Credence Glossary
                </h2>
                <p className="text-xs text-muted">
                  Full forms & plain-English definitions for every term
                </p>
              </div>
            </div>

            <button
              onClick={closeGlossary}
              className="group flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/50 text-paper/70 transition-all hover:border-lime/50 hover:bg-surface hover:text-lime"
              aria-label="Close glossary"
              data-cursor="CLOSE"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1 L13 13 M13 1 L1 13" />
              </svg>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative mt-2">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11 L15 15" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search acronym (e.g. PSI, DTI, ROC, SHAP...)"
              className="w-full rounded-xl border border-line bg-surface/80 py-2.5 pl-10 pr-9 text-xs text-paper placeholder-muted focus:border-lime focus:bg-surface focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-paper text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-mono tracking-tight transition-all ${
                  selectedCategory === cat
                    ? "bg-lime text-ink font-semibold shadow-[0_0_10px_rgba(217,255,63,0.3)]"
                    : "border border-line bg-surface/40 text-muted hover:border-paper/30 hover:text-paper"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Acronym List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin scrollbar-thumb-line">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
              <span className="text-2xl mb-2">🔍</span>
              <p className="text-sm">No acronyms found matching "{search}"</p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
                className="mt-3 font-mono text-xs text-lime underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.acronym}
                className="group relative rounded-xl border border-line/80 bg-surface/40 p-4 transition-all duration-200 hover:border-lime/50 hover:bg-surface/70 hover:shadow-[0_0_15px_rgba(217,255,63,0.08)]"
              >
                {/* Header row: Acronym + Full form */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="rounded-md border border-lime/40 bg-lime/10 px-2 py-0.5 font-mono text-xs font-bold text-lime shadow-sm">
                      {item.acronym}
                    </span>
                    <h3 className="font-display text-sm font-semibold text-paper group-hover:text-lime transition-colors">
                      {item.fullName}
                    </h3>
                  </div>
                  <span className="rounded-full border border-line bg-ink/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted shrink-0">
                    {item.category}
                  </span>
                </div>

                {/* Plain-English Definition */}
                <p className="mt-2 text-xs leading-relaxed text-paper/80">
                  {item.plainEnglish}
                </p>

                {/* Rule of thumb benchmark */}
                <div className="mt-2.5 rounded-lg border border-line/40 bg-ink/50 p-2 text-[11px] text-muted">
                  <span className="font-mono font-semibold uppercase text-lime/90 tracking-wider">
                    How to read:{" "}
                  </span>
                  <span className="text-paper/70">{item.ruleOfThumb}</span>
                </div>

                {/* Jump link */}
                {item.sectionId && (
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-[10px] text-muted">Seen in {item.sectionLabel}</span>
                    <button
                      onClick={() => handleJumpToSection(item.sectionId)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-lime hover:underline"
                    >
                      <span>Jump to section</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info note */}
        <div className="border-t border-line/80 bg-surface/30 p-4 text-center">
          <p className="font-mono text-[11px] text-muted">
            Tip: Press <kbd className="rounded bg-line px-1.5 py-0.5 text-paper">?</kbd> anywhere to toggle this guide • <kbd className="rounded bg-line px-1.5 py-0.5 text-paper">Esc</kbd> to close
          </p>
        </div>
      </aside>
    </>
  );
}
