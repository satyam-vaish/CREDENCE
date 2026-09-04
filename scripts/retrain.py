"""Drift-triggered retrain (standalone). Either:
  * reads a RETRAIN flag file written by monitoring, or
  * --force
Then: fast retrain run -> evaluate -> conditional promotion. Scheduled by
.github/workflows/retrain.yml weekly; the API exposes POST /retrain for live demos.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from credence.config import ROOT, load_config  # noqa: E402
from credence.train import train  # noqa: E402

FLAG = ROOT / "models" / "RETRAIN_TRIGGERED"


def main() -> None:
    force = "--force" in sys.argv
    if not force and not FLAG.exists():
        print("[retrain] no trigger flag — nothing to do")
        return
    print("[retrain] trigger:", "--force" if force else FLAG.read_text().strip())
    cfg = load_config()
    meta = train(cfg, n_trials_override=8)  # fast retrain profile
    print(
        f"[retrain] done: v{meta['version']} ({meta['stage']}) " f"{meta.get('promotion_note', '')}"
    )
    FLAG.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
