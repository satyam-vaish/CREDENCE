"""Config loader — YAML defaults, overridable via env vars (no hard-coded paths)."""

from __future__ import annotations

import os
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "configs" / "config.yaml"


def load_config(path: str | Path | None = None) -> dict:
    cfg_path = Path(path or os.environ.get("CREDENCE_CONFIG", DEFAULT_CONFIG))
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    # env overrides keep secrets/paths out of the repo
    if os.environ.get("CREDENCE_DATA_PATH"):
        cfg["data"]["raw_path"] = os.environ["CREDENCE_DATA_PATH"]
    if os.environ.get("MLFLOW_TRACKING_URI"):
        cfg["mlflow"]["tracking_uri"] = os.environ["MLFLOW_TRACKING_URI"]
    return cfg
