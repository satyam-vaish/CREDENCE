"""Data layer.

Real data: run `python scripts/download_data.py` for Kaggle instructions
(Lending Club accepted loans). If the file is absent we generate a synthetic
portfolio with drift *engineered into the DGP* (an economic shock ramps up
around month 33): rates, DTI, utilization and delinquencies all shift, and
base default risk rises. That guarantees PSI / retrain demos always work.

Months are the time axis: 0..47. Train = 0..29, Val = 30..35, Live = 36..47.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

PURPOSES = [
    "debt_consolidation",
    "credit_card",
    "home_improvement",
    "major_purchase",
    "medical",
    "other",
]
GRADES = list("ABCDEFG")


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


def month_frame(m: int, n: int, rng: np.random.Generator) -> pd.DataFrame:
    """One month of originations. `shock` = severity of the late-period downturn."""
    shock = 1.0 / (1.0 + np.exp(-(m - 33) / 3.0))  # 0 -> 1 around month 33

    grade_i = rng.integers(0, 7, n)
    int_rate = 6.0 + 2.2 * grade_i + rng.normal(0, 0.7, n) + 2.5 * shock
    term = rng.choice([36, 60], n, p=[0.62, 0.38])
    log_inc = rng.normal(10.9, 0.55, n) - 0.25 * shock
    annual_inc = np.clip(np.exp(log_inc), 12_000, 400_000)
    loan_amnt = np.clip(rng.normal(15_000, 8_000, n) * (1 + 0.15 * grade_i / 6), 1_000, 40_000)
    dti = np.clip(rng.normal(17, 7, n) + 4.0 * shock, 0, 45)
    emp_p = np.array([0.12, 0.09, 0.08, 0.09, 0.08, 0.07, 0.07, 0.10, 0.10, 0.10, 0.10])
    emp_length = rng.choice(np.arange(11), n, p=emp_p)
    home = rng.choice(["RENT", "MORTGAGE", "OWN", "ANY"], n, p=[0.42, 0.38, 0.18, 0.02])
    purpose = rng.choice(PURPOSES, n, p=[0.46, 0.22, 0.10, 0.09, 0.06, 0.07])
    revol_util = np.clip(rng.normal(34, 20, n) + 6.0 * shock, 0, 120)
    delinq = rng.poisson(0.22 + 0.30 * shock, n)
    credit_age = np.clip(rng.normal(9, 4, n), 1, 30)

    # Ground-truth mechanism (deliberately NOT learned from features — it is the DGP)
    z = (
        -2.35
        + 0.55 * (int_rate - 13.0) / 4.0
        + 0.38 * (dti - 17.0) / 7.0
        + 0.50 * delinq
        + 0.30 * (revol_util - 34.0) / 20.0
        + 0.10 * grade_i
        - 0.45 * (log_inc - 10.9) / 0.55
        - 0.12 * (emp_length - 5.0) / 3.2
        - 0.25 * (credit_age - 9.0) / 4.0
        + 0.15 * (term == 60)
        + 0.10 * (home == "RENT")
        + 0.12 * (purpose == "debt_consolidation")
        + 0.35 * shock
    )
    default = rng.binomial(1, _sigmoid(z))

    # Deliberate TARGET-LEAKAGE column (payments observed after origination):
    # strong post-outcome signal. features.py must drop it — tests enforce it.
    total_pymnt = loan_amnt * (1 + int_rate / 100 * term / 12 * 0.55) * (
        1 - default * 0.4
    ) + rng.normal(0, 50, n)

    dates = pd.date_range("2022-01-01", periods=48, freq="MS")[m]
    return pd.DataFrame(
        {
            "loan_amnt": loan_amnt.round(0),
            "term": term,
            "int_rate": int_rate.round(2),
            "grade": np.take(GRADES, grade_i),
            "annual_inc": annual_inc.round(0),
            "dti": dti.round(2),
            "emp_length": emp_length.astype(float),
            "home_ownership": home,
            "purpose": purpose,
            "revol_util": revol_util.round(2),
            "delinq_2yrs": delinq,
            "credit_age": credit_age.round(1),
            "issue_date": np.full(n, dates.strftime("%Y-%m")),
            "total_pymnt": total_pymnt.round(2),
            "default": default,
            "_month": np.full(n, m, dtype=int),
        }
    )


def generate(n_months: int = 48, rows_per_month: int = 900, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    frames = [month_frame(m, rows_per_month, rng) for m in range(n_months)]
    df = pd.concat(frames, ignore_index=True)
    # a realistic 1% of employment lengths are missing — exercises imputation
    miss = rng.random(len(df)) < 0.01
    df.loc[miss, "emp_length"] = np.nan
    return df


def time_split(
    df: pd.DataFrame, train_last_month: int, val_last_month: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Strictly temporal split. Never random."""
    month = df["_month"] if "_month" in df.columns else None
    if month is None:
        raise ValueError("time_split requires the '_month' axis column")
    train = df[month <= train_last_month].reset_index(drop=True)
    val = df[(month > train_last_month) & (month <= val_last_month)].reset_index(drop=True)
    live = df[month > val_last_month].reset_index(drop=True)
    return train, val, live
