"""Training entrypoint:  dvc stages validate -> features -> train -> evaluate.

  1. validate schema (fail fast)
  2. temporal split only
  3. LR baseline vs LightGBM vs XGBoost, tuned with Optuna
     (every trial logged to MLflow as a nested run)
  4. best model by val ROC-AUC -> isotonic calibration (prefit on val)
  5. threshold by business cost; live-period evaluation
  6. artifacts: bundle + meta (curves, PSI reference, example applicant)
  7. registry promotion gated on beating current Production
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from credence import metrics as M  # noqa: E402
from credence.config import ROOT, load_config  # noqa: E402
from credence.data import generate, time_split  # noqa: E402
from credence.features import FeatureBuilder  # noqa: E402
from credence.psi import PSI_FEATURES, psi_report  # noqa: E402
from credence.registry import LocalRegistry  # noqa: E402
from credence.threshold import cost_curve, optimal_threshold  # noqa: E402
from credence.validation import validate  # noqa: E402

log = logging.getLogger("credence.train")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

MODELS_DIR = ROOT / "models"


def _mlflow():
    try:
        import urllib.request

        import mlflow

        uri = load_config()["mlflow"]["tracking_uri"]
        if uri.startswith("http"):
            try:
                urllib.request.urlopen(uri, timeout=0.5)
            except Exception:
                uri = str(ROOT / "mlruns")
        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment(load_config()["mlflow"]["experiment"])
        return mlflow
    except Exception as exc:  # offline demo: keep training
        log.warning("MLflow unavailable (%s) — continuing with local artifacts", exc)
        return None


def _save_plot(name: str) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.savefig(MODELS_DIR / "artifacts" / f"{name}.png", dpi=130, bbox_inches="tight")
        plt.close("all")
    except Exception as exc:  # plots are non-critical
        log.warning("plot %s skipped: %s", name, exc)


def _fit_lr():
    from sklearn.linear_model import LogisticRegression

    return LogisticRegression(C=1.0, max_iter=2000, class_weight="balanced")


def _tune_lgbm(Xtr, ytr, Xva, yva, mlflow, n_trials: int, seed: int):
    import lightgbm as lgb
    import optuna

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": 500,
            "objective": "binary",
            "metric": "auc",
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.25, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 16, 128),
            "min_child_samples": trial.suggest_int("min_child_samples", 20, 200),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10, log=True),
            "random_state": seed,
            "verbose": -1,
        }
        model = lgb.LGBMClassifier(**params)
        model.fit(
            Xtr, ytr, eval_set=[(Xva, yva)], callbacks=[lgb.early_stopping(40, verbose=False)]
        )
        auc = M.all_metrics(yva, model.predict_proba(Xva)[:, 1])["roc_auc"]
        if mlflow:
            with mlflow.start_run(nested=True, run_name=f"trial-{trial.number}"):
                mlflow.log_params(params)
                mlflow.log_metric("val_roc_auc", auc)
        return auc

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=seed))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    best = dict(study.best_params)
    best.update(
        {
            "n_estimators": 500,
            "objective": "binary",
            "metric": "auc",
            "random_state": seed,
            "verbose": -1,
        }
    )
    model = lgb.LGBMClassifier(**best)
    model.fit(Xtr, ytr, eval_set=[(Xva, yva)], callbacks=[lgb.early_stopping(40, verbose=False)])
    return model, best


def _tune_xgb(Xtr, ytr, Xva, yva, mlflow, n_trials: int, seed: int):
    import optuna
    import xgboost as xgb

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": 400,
            "objective": "binary:logistic",
            "eval_metric": "auc",
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.25, log=True),
            "max_depth": trial.suggest_int("max_depth", 3, 9),
            "min_child_weight": trial.suggest_float("min_child_weight", 1, 50, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10, log=True),
            "random_state": seed,
            "verbosity": 0,
        }
        model = xgb.XGBClassifier(**params)
        model.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
        auc = M.all_metrics(yva, model.predict_proba(Xva)[:, 1])["roc_auc"]
        if mlflow:
            with mlflow.start_run(nested=True, run_name=f"xgb-trial-{trial.number}"):
                mlflow.log_params(params)
                mlflow.log_metric("val_roc_auc", auc)
        return auc

    study = optuna.create_study(
        direction="maximize", sampler=optuna.samplers.TPESampler(seed=seed + 1)
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    best = dict(study.best_params)
    best.update(
        {
            "n_estimators": 400,
            "objective": "binary:logistic",
            "eval_metric": "auc",
            "random_state": seed,
            "verbosity": 0,
        }
    )
    model = xgb.XGBClassifier(**best)
    model.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    return model, best


def _plot_all(yva, candidates: dict, Xva, meta: dict) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from credence.metrics import calibration_points, roc_points

    fig, ax = plt.subplots(figsize=(6, 5))
    for name, m in candidates.items():
        pts = np.array(roc_points(yva, m.predict_proba(Xva)[:, 1]))
        ax.plot(
            pts[:, 0],
            pts[:, 1],
            label=f"{name} AUC={meta['metrics']['candidates'][name]['roc_auc']:.3f}",
        )
    ax.plot([0, 1], [0, 1], "k--", lw=0.8)
    ax.set_xlabel("FPR")
    ax.set_ylabel("TPR")
    ax.legend()
    ax.set_title("ROC")
    _save_plot("roc")

    fig2, ax2 = plt.subplots(figsize=(6, 5))
    for name, m in candidates.items():
        pts = np.array(calibration_points(yva, m.predict_proba(Xva)[:, 1]))
        ax2.plot(pts[:, 0], pts[:, 1], marker="o", ms=3, label=name)
    ax2.plot([0, 1], [0, 1], "k--", lw=0.8)
    ax2.set_title("Calibration")
    ax2.set_xlabel("Mean predicted PD")
    ax2.set_ylabel("Observed default rate")
    ax2.legend()
    _save_plot("calibration")

    fig3, ax3 = plt.subplots(figsize=(6, 5))
    c = meta["cost"]["curve"]
    ax3.plot(c["thresholds"], c["costs"])
    ax3.axvline(meta["threshold"], color="r", ls="--")
    ax3.set_title(f"Cost vs threshold (best={meta['threshold']:.3f})")
    _save_plot("cost")


def train(cfg: dict | None = None, n_trials_override: int | None = None) -> dict:
    cfg = cfg or load_config()
    n_trials = n_trials_override or cfg["optuna"]["n_trials"]
    seed = cfg["optuna"]["seed"]
    MODELS_DIR.mkdir(exist_ok=True)
    (MODELS_DIR / "artifacts").mkdir(exist_ok=True)

    # ---- data ------------------------------------------------------------
    raw = ROOT / cfg["data"]["raw_path"]
    df = (
        pd.read_csv(raw)
        if raw.exists()
        else generate(cfg["data"]["n_months"], cfg["data"]["rows_per_month"], cfg["data"]["seed"])
    )
    df = validate(df)

    # ---- temporal split (never random) ------------------------------------
    train_df, val_df, live_df = time_split(
        df, cfg["split"]["train_last_month"], cfg["split"]["val_last_month"]
    )
    log.info("split: train=%d val=%d live=%d", len(train_df), len(val_df), len(live_df))

    # ---- features (fit on train ONLY — no leakage through preprocessing) --
    fb = FeatureBuilder().fit(train_df)
    Xtr, ytr = fb.transform(train_df), train_df["default"].to_numpy()
    Xva, yva = fb.transform(val_df), val_df["default"].to_numpy()
    Xlv, ylv = fb.transform(live_df), live_df["default"].to_numpy()

    mlflow = _mlflow()
    parent = (
        mlflow.start_run(run_name=f"train-{time.strftime('%Y%m%d-%H%M%S')}") if mlflow else None
    )

    # ---- candidates -------------------------------------------------------
    candidates: dict[str, object] = {}
    candidates["logreg"] = _fit_lr().fit(Xtr, ytr)
    candidates["lightgbm"], lgb_params = _tune_lgbm(Xtr, ytr, Xva, yva, mlflow, n_trials, seed)
    candidates["xgboost"], xgb_params = _tune_xgb(Xtr, ytr, Xva, yva, mlflow, n_trials, seed)

    results = {
        name: M.all_metrics(yva, m.predict_proba(Xva)[:, 1]) for name, m in candidates.items()
    }
    best_name = max(results, key=lambda k: results[k]["roc_auc"])
    best_raw = candidates[best_name]
    log.info(
        "val results: %s -> best=%s",
        {k: round(v["roc_auc"], 4) for k, v in results.items()},
        best_name,
    )

    # ---- calibration (isotonic, prefit on validation) ---------------------
    from sklearn.calibration import CalibratedClassifierCV

    calibrator = CalibratedClassifierCV(best_raw, method="isotonic", cv="prefit")
    calibrator.fit(Xva, yva)
    pva = calibrator.predict_proba(Xva)[:, 1]
    plv = calibrator.predict_proba(Xlv)[:, 1]

    # ---- business threshold ----------------------------------------------
    c_fn, c_fp = cfg["cost"]["cost_fn"], cfg["cost"]["cost_fp"]
    thr = optimal_threshold(yva, pva, c_fn, c_fp)
    curve = cost_curve(yva, pva, c_fn, c_fp)

    # ---- meta for API/UI --------------------------------------------------
    meta = {
        "best_model": best_name,
        "metrics": {
            "val": M.all_metrics(yva, pva),
            "live": M.all_metrics(ylv, plv),
            "candidates": results,
        },
        "threshold": thr,
        "cost": {
            "cost_fn": c_fn,
            "cost_fp": c_fp,
            "curve": {
                "thresholds": curve["thresholds"],
                "costs": [round(c, 1) for c in curve["costs"]],
            },
        },
        "curves": {
            name: {
                "roc": M.roc_points(yva, m.predict_proba(Xva)[:, 1]),
                "calibration": M.calibration_points(yva, m.predict_proba(Xva)[:, 1]),
            }
            for name, m in candidates.items()
        },
        "psi_reference": {},  # filled below (serve-time drift needs it)
        "medians": {
            c: float(train_df[c].median())
            for c in [
                "annual_inc",
                "dti",
                "int_rate",
                "loan_amnt",
                "revol_util",
                "delinq_2yrs",
                "emp_length",
                "credit_age",
            ]
        },
        "params": {"lightgbm": lgb_params, "xgboost": xgb_params},
        "trained_at": time.time(),
        "n_train": len(train_df),
        "n_val": len(val_df),
        "n_live": len(live_df),
    }
    ex = live_df.iloc[[0]].drop(columns=["default", "_month"], errors="ignore")
    meta["example_applicant"] = ex.iloc[0].to_dict()

    # PSI reference: train-period histograms per monitored feature
    for f in PSI_FEATURES:
        if f in train_df.columns:
            vals = train_df[f].dropna().to_numpy()
            edges = np.unique(np.quantile(vals, np.linspace(0, 1, 11))).tolist()
            counts = np.histogram(vals, bins=edges)[0].tolist()
            meta["psi_reference"][f] = {"edges": edges, "counts": counts}
    meta["psi_train_vs_live"] = psi_report(train_df, live_df)

    # ---- persist bundle + plots ------------------------------------------
    bundle = {
        "feature_builder": fb,
        "estimator": best_raw,
        "calibrator": calibrator,
        "threshold": thr,
        "meta": meta,
    }
    bundle_path = MODELS_DIR / "bundle.joblib"
    joblib.dump(bundle, bundle_path)
    _plot_all(yva, candidates, Xva, meta)

    # ---- registry ---------------------------------------------------------
    reg = LocalRegistry(MODELS_DIR / "registry")
    meta = reg.promote(bundle_path, meta)
    log.info("registry: %s", meta["promotion_note"])

    # ---- MLflow parent run ------------------------------------------------
    if mlflow and parent:
        for k, v in meta["metrics"]["val"].items():
            mlflow.log_metric(f"val_{k}", v)
        for k, v in meta["metrics"]["live"].items():
            mlflow.log_metric(f"live_{k}", v)
        mlflow.log_param("best_model", best_name)
        mlflow.log_param("threshold", thr)
        mlflow.log_artifact(str(bundle_path))
        for png in (MODELS_DIR / "artifacts").glob("*.png"):
            mlflow.log_artifact(str(png))
        mlflow.end_run()

    (MODELS_DIR / "meta.json").write_text(json.dumps(meta, indent=2, default=str))
    log.info(
        "DONE best=%s thr=%.3f val_auc=%.4f live_auc=%.4f",
        best_name,
        thr,
        meta["metrics"]["val"]["roc_auc"],
        meta["metrics"]["live"]["roc_auc"],
    )
    return meta


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else None
    train(n_trials_override=n)
