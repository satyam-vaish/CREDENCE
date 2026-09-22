"""Fetch real Lending Club data, or fall back to the synthetic generator.

Real data (Kaggle, requires the `kaggle` CLI + API token in ~/.kaggle/kaggle.json):
    kaggle datasets download -d wordsforthewise/lending-club --unzip -p data/raw
    cp data/raw/accepted_2007_to_2018Q4.csv.gz data/raw/loans.csv

Then map/rename columns to our schema (see MAP below) and ensure a binary
`default` column. If data/raw/loans.csv is missing, we generate the synthetic
portfolio with built-in drift so the whole pipeline, API, and UI demo work offline.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from credence.config import ROOT, load_config  # noqa: E402
from credence.data import generate  # noqa: E402

MAP = {  # real Lending Club -> our schema
    "loan_amnt": "loan_amnt",
    "term": "term",
    "int_rate": "int_rate",
    "grade": "grade",
    "annual_inc": "annual_inc",
    "dti": "dti",
    "emp_length": "emp_length",
    "home_ownership": "home_ownership",
    "purpose": "purpose",
    "revol_util": "revol_util",
    "delinq_2yrs": "delinq_2yrs",
    "issue_d": "issue_date",
    "loan_status": "default",
}


def main() -> None:
    cfg = load_config()
    raw = ROOT / cfg["data"]["raw_path"]
    raw.parent.mkdir(parents=True, exist_ok=True)

    if raw.exists():
        print(f"[download_data] found {raw} — using real data")
        return

    print(
        "[download_data] real dataset not found.\n"
        "  To use Lending Club:\n"
        "    kaggle datasets download -d wordsforthewise/lending-club --unzip -p data/raw\n"
        "    cp data/raw/accepted_2007_to_2018Q4.csv.gz data/raw/loans.csv\n"
        "  (map columns per the MAP dict above)\n"
        "  Falling back to the synthetic drift generator (demo always works)."
    )
    df = generate(cfg["data"]["n_months"], cfg["data"]["rows_per_month"], cfg["data"]["seed"])
    df.to_csv(raw, index=False)
    print(f"[download_data] wrote {len(df):,} rows x {len(df)} cols -> {raw}")
    print(
        f"  default rate: {df['default'].mean():.3f} | " f"months 0..{cfg['data']['n_months'] - 1}"
    )


if __name__ == "__main__":
    main()
