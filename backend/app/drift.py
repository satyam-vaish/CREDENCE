"""Serve-time drift: PSI of the current batch vs training reference."""

from __future__ import annotations

import numpy as np
import pandas as pd
from credence.psi import band

from backend.app.state import DRIFT_SHARE, PSI_GAUGE


def _psi_from_reference(ref: dict, values: np.ndarray) -> float:
    edges = np.array(ref["edges"], dtype=float)
    edges[0], edges[-1] = -np.inf, np.inf
    ec = np.array(ref["counts"], dtype=float)
    ec = ec / max(ec.sum(), 1)
    ac = np.histogram(values, bins=edges)[0] / max(len(values), 1)
    ec, ac = np.clip(ec, 1e-6, None), np.clip(ac, 1e-6, None)
    return float(np.sum((ac - ec) * np.log(ac / ec)))


def compute_drift(meta: dict, batch: pd.DataFrame) -> dict:
    per_feature = {}
    for feat, ref in meta.get("psi_reference", {}).items():
        if feat not in batch.columns:
            continue
        v = _psi_from_reference(ref, batch[feat].to_numpy())
        per_feature[feat] = {"psi": round(v, 4), "band": band(v)}
        PSI_GAUGE.labels(feature=feat).set(v)
    drifted = [f for f, v in per_feature.items() if v["psi"] >= 0.10]
    share = len(drifted) / max(len(per_feature), 1)
    DRIFT_SHARE.set(share)
    return {
        "per_feature": per_feature,
        "drifted_features": drifted,
        "drifted_share": round(share, 3),
        "max_psi": max((v["psi"] for v in per_feature.values()), default=0.0),
    }


def should_retrain(meta: dict, drift: dict, cfg: dict) -> tuple[bool, str]:
    d = cfg["drift"]
    reasons = []
    if drift.get("drifted_share", 0) > d["max_share_before_retrain"]:
        reasons.append(
            f"drifted share {drift['drifted_share']} > " f"{d['max_share_before_retrain']}"
        )
    for kf in d["key_features"]:
        v = drift.get("per_feature", {}).get(kf, {})
        if v.get("psi", 0) > d["psi_significant"]:
            reasons.append(f"key feature {kf} PSI {v['psi']} > {d['psi_significant']}")
    return (bool(reasons), "; ".join(reasons))


def histograms(meta: dict, batch: pd.DataFrame, features: list[str] | None = None) -> list[dict]:
    """Density-normalized ref vs current bars for the UI (PSI per feature inline)."""
    feats = features or ["int_rate", "dti", "revol_util", "annual_inc", "delinq_2yrs", "loan_amnt"]
    out = []
    for f in feats:
        if f not in batch.columns or f not in meta.get("psi_reference", {}):
            continue
        ref = meta["psi_reference"][f]
        edges = np.array(ref["edges"], dtype=float)
        edges[0], edges[-1] = -np.inf, np.inf
        ec = np.array(ref["counts"], dtype=float)
        ec = ec / max(ec.sum(), 1)
        cur = batch[f].to_numpy()
        ac = np.histogram(cur, bins=edges)[0] / max(len(cur), 1)
        ec_c, ac_c = np.clip(ec, 1e-6, None), np.clip(ac, 1e-6, None)
        val = float(np.sum((ac_c - ec_c) * np.log(ac_c / ec_c)))
        centers = (edges[:-1] + edges[1:]) / 2
        out.append(
            {
                "feature": f,
                "bins": centers[1:-1].round(2).tolist(),
                "ref": ec[1:-1].round(4).tolist(),
                "cur": ac[1:-1].round(4).tolist(),
                "psi": {"psi": round(val, 4), "band": band(val)},
            }
        )
    return out
