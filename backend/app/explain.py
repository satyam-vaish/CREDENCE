"""Per-prediction explanations.

Order of preference:
  1. SHAP TreeExplainer  (LightGBM / XGBoost — exact TreeSHAP)
  2. coefficient x (x - reference)  (logistic regression — exact for linear models)
  3. single-reference ablation dP (works for anything, used as last resort)
All paths return the same contract: top-k signed contributions.
"""

from __future__ import annotations

import numpy as np

TOP_K = 5


def _tree_shap(estimator, xt: np.ndarray) -> np.ndarray | None:
    try:
        import shap

        expl = shap.TreeExplainer(estimator)
        sv = expl.shap_values(xt)
        if isinstance(sv, list):  # older lgbm returns [class0, class1]
            sv = sv[-1]
        sv = np.asarray(sv)
        if sv.ndim == 3:  # (1, n_features, n_classes)
            sv = sv[0, :, -1]
        return sv.reshape(-1)
    except Exception:
        return None


def _linear_contrib(estimator, xt: np.ndarray, ref: np.ndarray) -> np.ndarray | None:
    try:
        coef = estimator.coef_.reshape(-1)
        return coef * (xt.reshape(-1) - ref.reshape(-1))
    except Exception:
        return None


def _ablation(score_fn, xt: np.ndarray, ref: np.ndarray) -> np.ndarray:
    p_full = float(score_fn(xt))
    out = np.zeros(xt.shape[1])
    for j in range(xt.shape[1]):
        x_mod = xt.copy()
        x_mod[0, j] = ref[j]
        out[j] = p_full - float(score_fn(x_mod))
    return out


def top_contributions(bundle: dict, record: dict, k: int = TOP_K) -> dict:
    fb = bundle["feature_builder"]
    est = bundle["estimator"]
    xt = fb.transform_row(record)
    names = fb.feature_names_
    ref = bundle.get("ref_transformed")
    if ref is None:
        ref = np.zeros(xt.shape[1])
    ref = np.asarray(ref, dtype=float).reshape(-1)

    sv = _tree_shap(est, xt)
    if sv is None:
        sv = _linear_contrib(est, xt, ref)
    if sv is None:

        def score(x):
            return est.predict_proba(x)[0, 1]

        sv = _ablation(score, xt, ref)

    order = np.argsort(-np.abs(sv))[:k]
    contributions = [{"feature": names[i], "contribution": round(float(sv[i]), 5)} for i in order]
    p = (
        bundle["calibrator"].predict_proba(xt)[0, 1]
        if bundle.get("calibrator")
        else est.predict_proba(xt)[0, 1]
    )
    return {"base_value": round(float(p), 5), "contributions": contributions}
