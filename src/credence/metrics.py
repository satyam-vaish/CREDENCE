"""Classification metrics for credit risk."""

from __future__ import annotations

import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score, roc_curve


def ks_statistic(y_true: np.ndarray, p: np.ndarray) -> float:
    """Kolmogorov-Smirnov: max vertical gap between the two cumulative ROC curves."""
    fpr, tpr, _ = roc_curve(y_true, p)
    return float(np.max(tpr - fpr))


def all_metrics(y_true: np.ndarray, p: np.ndarray) -> dict:
    auc = float(roc_auc_score(y_true, p))
    return {
        "roc_auc": auc,
        "pr_auc": float(average_precision_score(y_true, p)),
        "ks": ks_statistic(y_true, p),
        "gini": 2.0 * auc - 1.0,
        "brier": float(brier_score_loss(y_true, p)),
        "n": int(len(y_true)),
        "base_rate": float(np.mean(y_true)),
    }


def calibration_points(y_true: np.ndarray, p: np.ndarray, n_bins: int = 10) -> list[list[float]]:
    frac_pos, mean_pred = calibration_curve(y_true, p, n_bins=n_bins, strategy="quantile")
    return [[float(m), float(f)] for m, f in zip(mean_pred, frac_pos, strict=False)]


def roc_points(y_true: np.ndarray, p: np.ndarray) -> list[list[float]]:
    fpr, tpr, _ = roc_curve(y_true, p)
    step = max(1, len(fpr) // 120)  # thin for transport
    return [[float(a), float(b)] for a, b in zip(fpr[::step], tpr[::step], strict=False)]
