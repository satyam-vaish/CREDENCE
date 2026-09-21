# Model Card — credit-default-model

**Task:** binary classification — probability of loan default.
**Intended use:** origination-time decision support for unsecured personal loans.
**Not intended for:** fully automated adverse action without human review.

**Data:** 43,200 loans, monthly originations 2022-01 → 2025-12 (synthetic fallback mirrors the Lending Club schema).
**Split:** temporal only — train months 0–29, validation 30–35, live 36–47. No random splits.

**Features (13):** amount, term, rate, grade, log income, DTI, employment length, housing, purpose, revolving utilization, delinquencies-2y, credit age + engineered installment & rate×DTI. All payment/post-outcome columns dropped as target leakage (enforced by tests).

**Metrics (validation / live):** ROC-AUC ≈0.85/0.82 · PR-AUC ≈0.49/0.46 · KS ≈0.55/0.52 · Brier ≈0.10/0.11. Isotonic calibration prefit on validation.

**Fairness:** approval rates compared across income bands each release; investigate gaps > 5pp before promoting.

**Threshold:** cost-optimal (cost_FN=5, cost_FP=1) ≈ 0.34 on validation.

**Explainability:** TreeSHAP (global + per-prediction top-5).

**Limitations:** economic shocks degrade calibration (monitored via PSI, auto-retrained); synthetic fallback is illustrative, not regulatory-grade.
