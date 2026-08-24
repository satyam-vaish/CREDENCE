"""Shared API state: bundle, Prometheus metrics, drift cache, SSE bus."""

from __future__ import annotations

import collections
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

import joblib
from prometheus_client import Counter, Gauge, Histogram

REQ_COUNT = Counter("credence_requests_total", "HTTP requests", ["method", "path", "status"])
LATENCY = Histogram(
    "credence_request_latency_seconds",
    "Latency",
    ["path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.08, 0.1, 0.25, 0.5, 1, 2.5),
)
PD_GAUGE = Gauge("credence_last_pd", "Most recent predicted default probability")
PSI_GAUGE = Gauge("credence_psi", "PSI per monitored feature", ["feature"])
DRIFT_SHARE = Gauge("credence_drift_share", "Share of features with PSI >= 0.1")

_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class AppState:
    bundle: dict | None = None
    meta: dict | None = None
    started: float = field(default_factory=time.time)
    latencies: collections.deque = field(default_factory=lambda: collections.deque(maxlen=300))
    last_pd: float = 0.0
    current_batch: object | None = None  # pd.DataFrame of latest simulated month
    drift: dict = field(default_factory=dict)
    retrain_flag: bool = False
    events: collections.deque = field(default_factory=lambda: collections.deque(maxlen=100))

    @property
    def model_dir(self) -> str:
        return os.environ.get("MODEL_DIR") or str(
            _ROOT / "models" / "registry" / "credit-default-model"
        )

    def load(self) -> bool:
        d = Path(self.model_dir)
        prod = None
        if (d / "versions.json").exists():
            versions = json.loads((d / "versions.json").read_text())
            prods = [v for v in versions if v["stage"] == "Production"]
            if prods:
                prod = max(prods, key=lambda v: v["version"])
        vdir = d / f"v{prod['version']}" if prod else None
        path = (
            (vdir / "bundle.joblib")
            if vdir and (vdir / "bundle.joblib").exists()
            else d / "bundle.joblib"
        )
        if not path.exists():
            return False
        self.bundle = joblib.load(path)
        self.meta = dict(self.bundle["meta"])
        if prod:
            self.meta["version"] = prod["version"]
        return True

    def emit(self, event: dict) -> None:
        event["ts"] = time.time()
        self.events.append(event)

    def p50_ms(self) -> float:
        return sorted(self.latencies)[len(self.latencies) // 2] * 1000 if self.latencies else 0.0
