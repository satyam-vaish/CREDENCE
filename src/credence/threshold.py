"""Decision threshold = argmin_t  cost_FN*FN(t) + cost_FP*FP(t).

Lowering the threshold approves more (recall up, precision down) — the cost
curve trades those off explicitly instead of guessing 0.5.
"""

from __future__ import annotations

import numpy as np


def cost_curve(
    y_true: np.ndarray, p: np.ndarray, cost_fn: float, cost_fp: float, n_points: int = 200
) -> dict:
    thresholds = np.linspace(0.01, 0.99, n_points)
    preds = p[:, None] >= thresholds[None, :]
    y = np.asarray(y_true)[:, None]
    fn = ((y == 1) & ~preds).sum(axis=0)
    fp = ((y == 0) & preds).sum(axis=0)
    costs = cost_fn * fn + cost_fp * fp
    return {
        "thresholds": thresholds.tolist(),
        "costs": costs.tolist(),
        "best_threshold": float(thresholds[int(np.argmin(costs))]),
        "best_cost": float(costs.min()),
    }


def optimal_threshold(y_true: np.ndarray, p: np.ndarray, cost_fn: float, cost_fp: float) -> float:
    return cost_curve(y_true, p, cost_fn, cost_fp)["best_threshold"]


def cost_at(
    y_true: np.ndarray, p: np.ndarray, threshold: float, cost_fn: float, cost_fp: float
) -> float:
    pred = p >= threshold
    fn = int(((y_true == 1) & ~pred).sum())
    fp = int(((y_true == 0) & pred).sum())
    return cost_fn * fn + cost_fp * fp
