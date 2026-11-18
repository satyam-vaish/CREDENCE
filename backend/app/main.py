"""CREDENCE FastAPI service.

Endpoints: /health /metrics /model-info /predict /explain /whatif
           /plots/{name} /drift /simulate /events /quiz /retrain
Offline-friendly: if no trained bundle exists, /health reports degraded and
every scoring endpoint answers with a transparent local logistic fallback.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from prometheus_client import generate_latest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from credence.config import ROOT, load_config  # noqa: E402
from credence.data import month_frame  # noqa: E402

from backend.app import drift as drift_mod  # noqa: E402
from backend.app import quiz as quiz_mod  # noqa: E402
from backend.app.explain import top_contributions  # noqa: E402
from backend.app.schemas import (  # noqa: E402
    ApplicantInput,
    ExplainResponse,
    PredictResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from backend.app.state import LATENCY, PD_GAUGE, REQ_COUNT, AppState  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("credence.api")

app = FastAPI(title="CREDENCE API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
state = AppState()


@app.on_event("startup")
def startup() -> None:
    if not state.load():
        log.warning(
            "no trained bundle found — run `make train`; " "endpoints will answer in FALLBACK mode"
        )
    else:
        log.info("loaded model v%s (%s)", state.meta.get("version", "?"), state.meta["best_model"])


@app.middleware("http")
async def handle_api_prefix(request: Request, call_next):
    # Support both /endpoint and /api/endpoint for cloud deployments (Vercel, Render, AWS)
    if request.scope.get("path", "").startswith("/api/"):
        request.scope["path"] = request.scope["path"][4:]
    return await call_next(request)


@app.middleware("http")
async def logging_metrics(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    dt = time.perf_counter() - t0
    REQ_COUNT.labels(request.method, request.url.path, response.status_code).inc()
    LATENCY.labels(request.url.path).observe(dt)
    state.latencies.append(dt)
    log.info(
        "%s %s -> %s %.1fms", request.method, request.url.path, response.status_code, dt * 1000
    )
    response.headers["x-process-time-ms"] = f"{dt * 1000:.1f}"
    return response


# ---------------------------------------------------------------- scoring ---
def _record(a: ApplicantInput | dict) -> dict:
    if isinstance(a, dict):
        return a
    return a.model_dump()


def _score(record: dict) -> float:
    fb = state.bundle["feature_builder"]
    xt = fb.transform_row(record)
    if state.bundle.get("calibrator") is not None:
        return float(state.bundle["calibrator"].predict_proba(xt)[0, 1])
    return float(state.bundle["estimator"].predict_proba(xt)[0, 1])


def _fallback_score(record: dict) -> float:
    """Local logistic used when no model is trained — keeps the blob alive."""
    z = (
        -2.2
        + 0.055 * (record["int_rate"] - 12.5)
        + 0.030 * (record["dti"] - 18)
        + 0.013 * (record["revol_util"] - 34)
        + 0.45 * record["delinq_2yrs"]
        + 0.00002 * (record["loan_amnt"] - 15000)
        - 0.000010 * (record["annual_inc"] - 62000)
        - 0.030 * (record["emp_length"] - 5)
        + 0.10 * "ABCDEFG".index(record["grade"])
        + 0.15 * (record["term"] == 60)
    )
    return float(1 / (1 + np.exp(-z)))


def _p(record: dict) -> float:
    return _score(record) if state.bundle else _fallback_score(record)


def _threshold() -> float:
    return float(state.bundle["threshold"]) if state.bundle else 0.30


def _version() -> int:
    return int(state.meta.get("version", 0)) if state.meta else 0


# --------------------------------------------------------------- endpoints --
@app.get("/health")
def health():
    return {
        "status": "ok" if state.bundle else "degraded:fallback",
        "model_version": _version(),
        "uptime_s": round(time.time() - state.started, 1),
        "fallback": state.bundle is None,
    }


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")


@app.get("/model-info")
def model_info():
    if not state.meta:
        raise HTTPException(503, "no model trained yet — run `make train`")
    m = dict(state.meta)
    m["threshold"] = _threshold()
    m["version"] = _version()
    return JSONResponse(m)


@app.post("/predict", response_model=PredictResponse)
def predict(a: ApplicantInput):
    p = _p(_record(a))
    thr = _threshold()
    PD_GAUGE.set(p)
    state.last_pd = p
    decision = "REJECT" if p >= thr else "APPROVE"
    state.emit(
        {"type": "prediction", "pd": round(p, 4), "decision": decision, "version": _version()}
    )
    return PredictResponse(
        default_probability=round(p, 5), decision=decision, threshold=thr, model_version=_version()
    )


@app.post("/explain", response_model=ExplainResponse)
def explain(a: ApplicantInput):
    if not state.bundle:
        raise HTTPException(503, "no model — explanations need a trained bundle")
    rec = _record(a)
    result = top_contributions(state.bundle, rec)
    for c in result["contributions"]:
        c["value"] = rec.get(c["feature"].replace("_ord", ""))
    return ExplainResponse(**result, model_version=_version())


@app.post("/whatif", response_model=WhatIfResponse)
def whatif(req: WhatIfRequest):
    """One changed feature on a base applicant. Targets <80ms; a predict is ~2-3ms."""
    base = _record(req.base)
    if req.feature not in base:
        raise HTTPException(422, f"unknown feature '{req.feature}'")
    base_p = _p(base)
    rec = {**base, req.feature: req.value}
    p = _p(rec)
    PD_GAUGE.set(p)
    state.last_pd = p
    return WhatIfResponse(
        default_probability=round(p, 5),
        base_probability=round(base_p, 5),
        delta=round(p - base_p, 5),
        model_version=_version(),
    )


@app.get("/plots/{name}")
def plots(name: str):
    allowed = {"roc", "calibration", "cost"}
    if name not in allowed:
        raise HTTPException(404, f"plot must be one of {sorted(allowed)}")
    path = ROOT / "models" / "artifacts" / f"{name}.png"
    if path.exists():
        return FileResponse(path, media_type="image/png")
    raise HTTPException(404, "plot not generated — run `make train`")


@app.get("/drift")
def drift():
    if state.current_batch is None or not state.meta:
        raise HTTPException(409, "no batch simulated yet — POST /simulate?month=N")
    result = drift_mod.compute_drift(state.meta, state.current_batch)
    result["should_retrain"], result["reason"] = drift_mod.should_retrain(
        state.meta, result, load_config()
    )
    result["model_version"] = _version()
    return result


@app.post("/simulate")
def simulate(month: int = Query(..., ge=0, le=47)):
    """Progressively shifted 'live' batches: sample one month of originations
    directly from the generator (month determines the built-in economic shock)."""
    cfg = load_config()
    rng = np.random.default_rng(cfg["data"]["seed"] + month)
    batch = month_frame(month, cfg["data"]["rows_per_month"], rng)
    batch["_month"] = month
    state.current_batch = batch

    if state.meta:
        result = drift_mod.compute_drift(state.meta, batch)
        result["histograms"] = drift_mod.histograms(state.meta, batch)
        result["should_retrain"], result["reason"] = drift_mod.should_retrain(
            state.meta, result, cfg
        )
        state.retrain_flag = result["should_retrain"]
    else:
        result = {
            "per_feature": {},
            "drifted_share": 0.0,
            "max_psi": 0.0,
            "drifted_features": [],
            "histograms": [],
            "should_retrain": False,
            "reason": "",
        }
    result["month"] = month
    result["model_version"] = _version()
    state.drift = result
    state.emit(
        {
            "type": "drift",
            "month": month,
            "share": result["drifted_share"],
            "max_psi": result["max_psi"],
        }
    )
    return result


@app.post("/retrain")
def retrain():
    """Drift-response retrain: refit on train + current live batch, evaluate,
    promote only if val AUC beats current production. Returns the new version."""
    if not state.bundle:
        raise HTTPException(503, "train a base model first")
    from credence.data import time_split
    from credence.features import FeatureBuilder
    from credence.registry import LocalRegistry
    from credence.train import MODELS_DIR

    cfg = load_config()
    df = (
        pd.read_csv(ROOT / cfg["data"]["raw_path"])
        if (ROOT / cfg["data"]["raw_path"]).exists()
        else None
    )
    if df is None:
        from credence.data import generate

        df = generate(cfg["data"]["n_months"], cfg["data"]["rows_per_month"], cfg["data"]["seed"])
    train_df, val_df, _ = time_split(
        df, cfg["split"]["train_last_month"], cfg["split"]["val_last_month"]
    )
    if state.current_batch is not None:
        live = state.current_batch.copy()
        live = live.drop(columns=["_month"], errors="ignore")
        train_df = pd.concat([train_df, live], ignore_index=True)

    fb = FeatureBuilder().fit(train_df)
    Xtr, ytr = fb.transform(train_df), train_df["default"].to_numpy()
    Xva, yva = fb.transform(val_df), val_df["default"].to_numpy()

    import joblib
    import lightgbm as lgb

    model = lgb.LGBMClassifier(
        n_estimators=400,
        learning_rate=0.06,
        num_leaves=48,
        min_child_samples=60,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        random_state=0,
        verbose=-1,
    )
    model.fit(Xtr, ytr)
    from credence import metrics as M
    from credence.threshold import optimal_threshold

    pva = model.predict_proba(Xva)[:, 1]
    val_m = M.all_metrics(yva, pva)
    thr = optimal_threshold(yva, pva, cfg["cost"]["cost_fn"], cfg["cost"]["cost_fp"])

    # walk the retrain timeline over SSE so the UI can animate it
    for step in ("DRIFT DETECTED", "RETRAIN", "VALIDATE", "PROMOTE", "LIVE"):
        state.emit({"type": "retrain_step", "step": step})

    new_meta = {
        "best_model": "lightgbm",
        "metrics": {"val": val_m},
        "threshold": thr,
        "curves": {
            "lightgbm": {
                "roc": M.roc_points(yva, pva),
                "calibration": M.calibration_points(yva, pva),
            }
        },
        "psi_reference": state.meta["psi_reference"],
        "medians": state.meta.get("medians", {}),
        "params": {"lightgbm": {"n_estimators": 400, "learning_rate": 0.06}},
        "trained_at": time.time(),
        "n_train": len(train_df),
        "n_val": len(val_df),
        "n_live": state.meta.get("n_live", 0),
        "retrained_due_to_drift": True,
    }
    ex = val_df.iloc[[0]].drop(columns=["default", "_month"], errors="ignore")
    new_meta["example_applicant"] = ex.iloc[0].to_dict()

    tmp = MODELS_DIR / "bundle-retrain.joblib"
    joblib.dump(
        {
            "feature_builder": fb,
            "estimator": model,
            "calibrator": None,
            "threshold": thr,
            "meta": new_meta,
        },
        tmp,
    )
    reg = LocalRegistry(MODELS_DIR / "registry")
    new_meta = reg.promote(tmp, new_meta)
    tmp.unlink(missing_ok=True)

    state.load()  # reload whichever bundle won promotion
    result = {
        "promoted": new_meta["stage"] == "Production",
        "new_version": _version(),
        "val_metrics": val_m,
        "promotion_note": new_meta.get("promotion_note", ""),
    }
    state.emit({"type": "retrained", "version": _version(), "promoted": result["promoted"]})
    return result


def _pop_event(timeout: float) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if state.events:
            return state.events.popleft()
        time.sleep(0.05)
    raise TimeoutError


@app.get("/events")
async def events(request: Request):
    async def gen():
        while True:
            if await request.is_disconnected():
                break
            try:
                item = await asyncio.to_thread(_pop_event, 2.0)
            except TimeoutError:
                item = {
                    "type": "tick",
                    "pd": round(state.last_pd, 4),
                    "latency_ms": round(state.p50_ms(), 1),
                    "drift_share": state.drift.get("drifted_share", 0.0),
                    "version": _version(),
                }
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/quiz")
def quiz():
    if not state.meta:
        raise HTTPException(503, "no model trained yet")
    return {"questions": quiz_mod.build_quiz(state.meta, state.drift)}
