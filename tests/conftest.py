from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def tiny_df() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    from credence.data import generate, time_split

    df = generate(n_months=8, rows_per_month=150, seed=99)
    return time_split(df, train_last_month=4, val_last_month=5)


@pytest.fixture(scope="session")
def tiny_bundle(tmp_path_factory, tiny_df):
    """A real trained LR bundle in a tmp registry — used by API tests."""
    import joblib
    import numpy as np
    from credence.features import FeatureBuilder
    from credence.metrics import all_metrics, calibration_points, roc_points
    from credence.registry import LocalRegistry
    from credence.threshold import optimal_threshold
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.linear_model import LogisticRegression

    train_df, val_df, live_df = tiny_df
    fb = FeatureBuilder().fit(train_df)
    Xtr, ytr = fb.transform(train_df), train_df["default"].to_numpy()
    Xva, yva = fb.transform(val_df), val_df["default"].to_numpy()
    lr = LogisticRegression(max_iter=500).fit(Xtr, ytr)
    cal = CalibratedClassifierCV(lr, method="isotonic", cv="prefit").fit(Xva, yva)
    pva = cal.predict_proba(Xva)[:, 1]

    meta = {
        "best_model": "logreg",
        "metrics": {"val": all_metrics(yva, pva), "candidates": {"logreg": all_metrics(yva, pva)}},
        "threshold": optimal_threshold(yva, pva, 5.0, 1.0),
        "curves": {
            "logreg": {"roc": roc_points(yva, pva), "calibration": calibration_points(yva, pva)}
        },
        "psi_reference": {},
        "medians": {
            c: float(train_df[c].median())
            for c in ["annual_inc", "dti", "int_rate", "loan_amnt", "revol_util"]
        },
        "trained_at": 0,
        "n_train": len(train_df),
        "n_val": len(val_df),
        "n_live": len(live_df),
        "example_applicant": train_df.iloc[0].drop(labels=["default", "_month"]).to_dict(),
        "version": 1,
        "stage": "Production",
    }
    for f in ["int_rate", "dti", "revol_util", "annual_inc", "loan_amnt"]:
        vals = train_df[f].dropna().to_numpy()
        edges = np.unique(np.quantile(vals, np.linspace(0, 1, 11))).tolist()
        meta["psi_reference"][f] = {
            "edges": edges,
            "counts": np.histogram(vals, bins=edges)[0].tolist(),
        }

    reg_dir = tmp_path_factory.mktemp("registry")
    bundle_path = reg_dir / "bundle.joblib"
    joblib.dump(
        {
            "feature_builder": fb,
            "estimator": lr,
            "calibrator": cal,
            "threshold": meta["threshold"],
            "meta": meta,
        },
        bundle_path,
    )
    reg = LocalRegistry(reg_dir)
    reg.promote(bundle_path, meta)
    return reg_dir
