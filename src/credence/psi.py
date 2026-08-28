"""Population Stability Index, implemented manually.

PSI = sum_i (a_i - e_i) * ln(a_i / e_i) over 10 quantile bands of the reference.
Bands: < 0.10 stable | 0.10-0.25 moderate | > 0.25 significant.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

STABLE, MODERATE = 0.10, 0.25
PSI_FEATURES = [
    "int_rate",
    "dti",
    "revol_util",
    "annual_inc",
    "loan_amnt",
    "delinq_2yrs",
    "credit_age",
    "emp_length",
]


def psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10, eps: float = 1e-6) -> float:
    e = np.asarray(expected, dtype=float)
    a = np.asarray(actual, dtype=float)
    e, a = e[np.isfinite(e)], a[np.isfinite(a)]
    if len(e) == 0 or len(a) == 0:
        return 0.0
    edges = np.unique(np.quantile(e, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:  # constant column -> nothing to drift
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf  # open-ended tails
    ec = np.histogram(e, bins=edges)[0] / len(e)
    ac = np.histogram(a, bins=edges)[0] / len(a)
    ec, ac = np.clip(ec, eps, None), np.clip(ac, eps, None)
    return float(np.sum((ac - ec) * np.log(ac / ec)))


def band(value: float) -> str:
    if value < STABLE:
        return "stable"
    if value < MODERATE:
        return "moderate"
    return "significant"


def psi_report(
    reference: pd.DataFrame, current: pd.DataFrame, features: list[str] | None = None
) -> dict:
    feats = features or [f for f in PSI_FEATURES if f in reference.columns and f in current.columns]
    per_feature = {
        f: {"psi": psi(reference[f].to_numpy(), current[f].to_numpy()), "band": ""} for f in feats
    }
    for v in per_feature.values():
        v["band"] = band(v["psi"])
    drifted = sum(1 for v in per_feature.values() if v["psi"] >= STABLE)
    return {
        "per_feature": per_feature,
        "drifted_share": drifted / max(len(per_feature), 1),
        "max_psi": max((v["psi"] for v in per_feature.values()), default=0.0),
    }
