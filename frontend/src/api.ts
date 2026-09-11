/**
 * Typed API client. Every call has an offline fallback so the blob and all
 * sections keep working without the backend (a "MOCK" tag appears in the nav).
 */
import { clamp } from "./lib";
import { getGlobal, setGlobal } from "./store";

const RAW = import.meta.env.VITE_API_URL as string | undefined;
const BASE = RAW && RAW.length > 0 ? RAW : "/api";

export const API_URL = BASE;

export const PURPOSES = ["debt_consolidation", "credit_card", "home_improvement"];

export type Applicant = {
  annual_inc: number; dti: number; int_rate: number; loan_amnt: number;
  revol_util: number; delinq_2yrs: number; emp_length: number;
  grade: string; term: number; credit_age: number;
  home_ownership: string; purpose: string;
};

export type PredictRes = { default_probability: number; decision: "APPROVE" | "REJECT"; threshold: number; model_version: number };
export type WhatIfRes = { default_probability: number; base_probability: number; delta: number; model_version: number };
export type ExplainRes = { base_value: number; contributions: { feature: string; contribution: number; value?: number }[]; model_version: number };
export type DriftRes = {
  per_feature: Record<string, { psi: number; band: string }>;
  drifted_share: number; max_psi: number; drifted_features: string[];
  month?: number; model_version?: number; should_retrain?: boolean; reason?: string;
  histograms?: { feature: string; bins: number[]; ref: number[]; cur: number[]; psi: { psi: number; band: string } }[];
};
export type ModelInfo = {
  best_model: string; threshold: number; version: number;
  metrics: { val: Record<string, number>; live?: Record<string, number>; candidates: Record<string, Record<string, number>> };
  curves: Record<string, { roc: [number, number][]; calibration: [number, number][] }>;
  cost: { cost_fn: number; cost_fp: number; curve: { thresholds: number[]; costs: number[] } };
  example_applicant: Record<string, unknown>;
  n_train: number; n_val: number; n_live: number;
};
export type QuizQ = { question: string; options: string[]; answer: number; explanation: string; tag: string };

async function withFallback<T>(fn: () => Promise<T>, fb: () => T): Promise<T> {
  if (getGlobal().mock) {
    return Promise.resolve(fb());
  }
  try {
    const res = await fn();
    return res;
  } catch (err) {
    console.warn("Live backend call failed, falling back to mock:", err);
    setGlobal({ mock: true, mockToast: "⚠️ Live backend unreachable — using Mock Simulation Engine." });
    return fb();
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`${r.status}`);
    return (await r.json()) as T;
  } finally { clearTimeout(timer); }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

/* -------------- blob vertex values (numbers) -> API-domain applicant -------- */
export function makeApplicant(values: number[]): Applicant {
  const gi = Math.round(clamp(values[7], 0, 6));
  const hi = Math.round(clamp(values[10], 0, 2));
  const pi = Math.round(clamp(values[11], 0, 2));
  return {
    annual_inc: values[0], dti: values[1], int_rate: values[2],
    loan_amnt: values[3], revol_util: values[4], delinq_2yrs: Math.round(values[5]),
    emp_length: Math.round(values[6]), grade: "ABCDEFG"[gi],
    term: values[8] >= 48 ? 60 : 36, credit_age: values[9],
    home_ownership: ["RENT", "MORTGAGE", "OWN"][hi],
    purpose: PURPOSES[pi],
  };
}

/* ------------------- offline logistic fallback (documented) ----------------- */
export function localScore(a: Applicant): number {
  const gi = "ABCDEFG".indexOf(a.grade);
  const ho = ["RENT", "MORTGAGE", "OWN", "OTHER"].indexOf(a.home_ownership);
  const pu = PURPOSES.indexOf(a.purpose);
  const z = (-2.2 + 0.055 * (a.int_rate - 12.5)
    + 0.030 * (a.dti - 18)
    + 0.013 * (a.revol_util - 34)
    + 0.45 * a.delinq_2yrs
    + 0.00002 * (a.loan_amnt - 15000)
    - 0.000010 * (a.annual_inc - 62000)
    - 0.030 * a.emp_length
    + 0.10 * gi
    + 0.002 * (a.term - 40)
    - 0.025 * (a.credit_age - 9)
    + 0.04 * ho + 0.05 * pu);
  return 1 / (1 + Math.exp(-z));
}

const PROBE: Applicant = {
  annual_inc: 62000, dti: 18, int_rate: 12.5, loan_amnt: 15000, revol_util: 34,
  delinq_2yrs: 1, emp_length: 5, grade: "E", term: 60, credit_age: 9,
  home_ownership: "RENT", purpose: "credit_card",
};

/* --------------------------------- endpoints -------------------------------- */
export const api = {
  predict: (a: Applicant) =>
    withFallback<PredictRes>(
      () => post("/predict", a),
      () => {
        const p = localScore(a);
        return { default_probability: p, decision: p >= 0.34 ? "REJECT" : "APPROVE", threshold: 0.34, model_version: 0 };
      },
    ),

  whatif: (base: Applicant, feature: string, value: number) =>
    withFallback<WhatIfRes>(
      () => post("/whatif", { base, feature, value }),
      () => {
        const bp = localScore(base);
        const p = localScore({ ...base, [feature]: value } as Applicant);
        return { default_probability: p, base_probability: bp, delta: p - bp, model_version: 0 };
      },
    ),

  explain: (a: Applicant) =>
    withFallback<ExplainRes>(
      () => post("/explain", a),
      () => {
        // ablation-style pseudo-SHAP against the local logistic
        const full = localScore(a);
        const keys = Object.keys(PROBE) as (keyof Applicant)[];
        const contribs = keys.map((k) => ({
          feature: k as string,
          contribution: full - localScore({ ...a, [k]: PROBE[k] } as Applicant),
        }));
        contribs.sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
        return { base_value: full, contributions: contribs.slice(0, 5), model_version: 0 };
      },
    ),

  modelInfo: () =>
    withFallback<ModelInfo>(
      async () => {
        const info = await get<ModelInfo>("/model-info");
        if (info.version !== undefined) {
          setGlobal({ modelVersion: info.version });
        }
        return info;
      },
      () => ({
        best_model: "lightgbm", threshold: 0.34, version: 3,
        metrics: {
          val: { roc_auc: 0.847, pr_auc: 0.492, ks: 0.551, gini: 0.694, brier: 0.096, base_rate: 0.137 },
          live: { roc_auc: 0.821, pr_auc: 0.463, ks: 0.522, gini: 0.642, brier: 0.108, base_rate: 0.184 },
          candidates: { logreg: { roc_auc: 0.792 }, lightgbm: { roc_auc: 0.847 }, xgboost: { roc_auc: 0.841 } },
        },
        curves: {
          logreg: { roc: [[0, 0], [0.4, 0.62], [1, 1]] as [number, number][], calibration: [[0.1, 0.08], [0.4, 0.38], [0.8, 0.78]] as [number, number][] },
          lightgbm: { roc: [[0, 0], [0.25, 0.68], [0.5, 0.85], [1, 1]] as [number, number][], calibration: [[0.1, 0.11], [0.3, 0.31], [0.6, 0.58], [0.9, 0.88]] as [number, number][] },
          xgboost: { roc: [[0, 0], [0.3, 0.66], [1, 1]] as [number, number][], calibration: [[0.1, 0.09], [0.5, 0.52], [0.9, 0.86]] as [number, number][] },
        },
        cost: {
          cost_fn: 5, cost_fp: 1,
          curve: {
            thresholds: [0.05, 0.15, 0.25, 0.34, 0.45, 0.6, 0.8],
            costs: [4200, 3100, 2450, 2280, 2600, 3400, 4900],
          },
        },
        example_applicant: {}, n_train: 27000, n_val: 5400, n_live: 10800,
      }),
    ),

  simulate: (month: number) =>
    withFallback<DriftRes>(() => post(`/simulate?month=${month}`, {}), () => mockDrift(month)),

  drift: () => withFallback<DriftRes>(() => get("/drift"), () => mockDrift(40)),

  retrain: () =>
    withFallback<{ promoted: boolean; new_version: number; val_metrics: Record<string, number> }>(
      () => post("/retrain", {}),
      () => ({ promoted: true, new_version: getGlobal().modelVersion + 1, val_metrics: { roc_auc: 0.851 } }),
    ),

  quiz: () =>
    withFallback<{ questions: QuizQ[] }>(
      () => get("/quiz"),
      () => ({
        questions: [
          { question: "If we LOWER the decision threshold, what happens?", options: ["Precision rises and recall falls", "Precision falls and recall rises", "Both rise", "Nothing changes"], answer: 1, explanation: "More applicants flagged risky -> recall up, precision down.", tag: "THRESHOLD" },
          { question: "A feature's PSI jumps to 0.31. That means...", options: ["Stable", "Moderate drift", "Significant drift — the model is extrapolating", "Remove the feature"], answer: 2, explanation: "PSI > 0.25 = significant drift; it trips the retrain trigger on key features.", tag: "DRIFT" },
          { question: "Which metric can look healthy under heavy imbalance for a useless model?", options: ["ROC-AUC", "PR-AUC", "Brier", "KS"], answer: 0, explanation: "True negatives dominate ROC-AUC when defaults are ~13%.", tag: "METRICS" },
          { question: "The KS statistic measures...", options: ["Average error", "Max gap between cumulative good/bad distributions", "ROC slope at 0.5", "Share of drifted features"], answer: 1, explanation: "KS = max|TPR - FPR|.", tag: "METRICS" },
        ],
      }),
    ),
};

function mockDrift(month: number): DriftRes {
  const s = Math.max(0, (month - 30) / 18); // ramp like the real generator
  const mk = (psi: number) => ({ psi, band: psi < 0.1 ? "stable" : psi < 0.25 ? "moderate" : "significant" });
  const hist = (base: number, driftAmt: number, bins = 12) => {
    const ref = Array.from({ length: bins }, (_, i) => Math.exp(-((i - bins * base) ** 2) / (2 * (bins / 6) ** 2)));
    const cur = Array.from({ length: bins }, (_, i) => Math.exp(-((i - bins * base - driftAmt * bins / 8) ** 2) / (2 * (bins / 6) ** 2)));
    const nr = ref.reduce((a, b) => a + b, 0), nc = cur.reduce((a, b) => a + b, 0);
    return {
      ref: ref.map((v) => +(v / nr).toFixed(4)),
      cur: cur.map((v) => +(v / nc).toFixed(4)),
      bins: Array.from({ length: bins }, (_, i) => +(i / bins).toFixed(2)),
    };
  };
  const f = (name: string, psi: number, base: number, amt: number) => {
    const h = hist(base, amt * s);
    return { feature: name, bins: h.bins, ref: h.ref, cur: h.cur, psi: mk(psi * s) };
  };
  const per = { int_rate: mk(0.31 * s), dti: mk(0.27 * s), revol_util: mk(0.14 * s), annual_inc: mk(0.09 * s), loan_amnt: mk(0.02 * s), delinq_2yrs: mk(0.38 * s) };
  const drifted = Object.entries(per).filter(([, v]) => v.psi >= 0.1);
  return {
    per_feature: per,
    drifted_share: drifted.length / 6,
    max_psi: Math.max(...Object.values(per).map((v) => v.psi)),
    drifted_features: drifted.map(([k]) => k),
    month,
    histograms: [f("int_rate", 0.31, 0.4, 1), f("dti", 0.27, 0.4, 1), f("revol_util", 0.14, 0.35, 1), f("delinq_2yrs", 0.38, 0.15, 1.4)],
    should_retrain: s > 0.85,
    reason: s > 0.85 ? "drifted share > 0.30" : "",
  };
}

/** SSE hook for /events with a graceful synthetic fallback. */
export function connectEvents(onEvent: (e: Record<string, unknown>) => void): () => void {
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  try {
    es = new EventSource(`${BASE}/events`);
    es.onmessage = (m) => onEvent(JSON.parse(m.data));
    es.onerror = () => { es?.close(); startFallback(); };
  } catch { startFallback(); }
  function startFallback() {
    if (timer) return;
    timer = setInterval(() => {
      const g = getGlobal();
      onEvent({ type: "tick", pd: g.pd, latency_ms: 2 + Math.random() * 3, drift_share: g.driftShare, version: g.modelVersion });
    }, 2000);
  }
  return () => { es?.close(); if (timer) clearInterval(timer); };
}
