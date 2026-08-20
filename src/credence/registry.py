"""Model registry — MLflow Model Registry when a server is up, plus a local
filesystem registry (models/registry/<name>/) so the API and UI work offline.

Promotion rule: a candidate reaches Production ONLY if its validation ROC-AUC
beats the current Production model's. The loser stays as a versioned snapshot.
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

REGISTRY_NAME = "credit-default-model"


class LocalRegistry:
    def __init__(self, root: Path, name: str = REGISTRY_NAME) -> None:
        self.dir = root / name
        self.dir.mkdir(parents=True, exist_ok=True)
        self.versions_file = self.dir / "versions.json"
        if not self.versions_file.exists():
            self._write([])

    def _read(self) -> list[dict]:
        return json.loads(self.versions_file.read_text())

    def _write(self, versions: list[dict]) -> None:
        self.versions_file.write_text(json.dumps(versions, indent=2))

    def production(self) -> dict | None:
        prods = [v for v in self._read() if v["stage"] == "Production"]
        return max(prods, key=lambda v: v["version"]) if prods else None

    def promote(self, src_bundle: Path, meta: dict, min_advantage: float = 0.0) -> dict:
        """Register `src_bundle`; promote to Production only if strictly better."""
        versions = self._read()
        new_version = max((v["version"] for v in versions), default=0) + 1
        prod = self.production()

        if (
            prod is not None
            and meta["metrics"]["val"]["roc_auc"]
            <= prod["metrics"]["val"]["roc_auc"] + min_advantage
        ):
            stage, note = "Staging", (
                f"not promoted: val AUC {meta['metrics']['val']['roc_auc']:.4f} "
                f"<= production {prod['metrics']['val']['roc_auc']:.4f}"
            )
        else:
            stage, note = "Production", (
                f"promoted (val AUC {meta['metrics']['val']['roc_auc']:.4f})"
                if prod
                else "first production model"
            )
            if prod:  # demote previous champion
                for v in versions:
                    if v["stage"] == "Production":
                        v["stage"] = "Archived"

        vdir = self.dir / f"v{new_version}"
        vdir.mkdir(exist_ok=True)
        shutil.copy2(src_bundle, vdir / "bundle.joblib")
        meta = {**meta, "version": new_version, "stage": stage, "registered_at": time.time()}
        (vdir / "meta.json").write_text(json.dumps(meta, indent=2, default=str))
        versions.append(
            {
                "version": new_version,
                "stage": stage,
                "metrics": meta["metrics"],
                "note": note,
                "created": meta["registered_at"],
            }
        )
        self._write(versions)
        meta["promotion_note"] = note
        return meta
