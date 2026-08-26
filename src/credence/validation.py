"""Pandera schema — pipeline FAILS here on bad data (dvc stage: validate)."""

from __future__ import annotations

import pandas as pd

try:
    import pandera as pa
    from pandera import Check, Column

    SCHEMA = pa.DataFrameSchema(
        {
            "loan_amnt": Column(float, Check.in_range(500, 60_000), nullable=False),
            "term": Column(int, Check.isin([36, 60]), nullable=False),
            "int_rate": Column(float, Check.in_range(1, 35), nullable=False),
            "grade": Column(str, Check.str_matches(r"^[A-G]$"), nullable=False),
            "annual_inc": Column(float, Check.greater_than(0), nullable=False),
            "dti": Column(float, Check.in_range(0, 60), nullable=False),
            "emp_length": Column(float, Check.in_range(0, 10), nullable=True),
            "home_ownership": Column(
                str, Check.isin(["RENT", "MORTGAGE", "OWN", "ANY"]), nullable=False
            ),
            "purpose": Column(str, nullable=False),
            "revol_util": Column(float, Check.in_range(0, 150), nullable=False),
            "delinq_2yrs": Column(int, Check.in_range(0, 20), nullable=False),
            "credit_age": Column(float, Check.in_range(0, 40), nullable=False),
            "issue_date": Column(str, nullable=False),
            "default": Column(int, Check.isin([0, 1]), nullable=False),
        },
        strict=False,
        coerce=True,
    )
except ImportError:  # pragma: no cover
    SCHEMA = None


def validate(df: pd.DataFrame) -> pd.DataFrame:
    if SCHEMA is not None:
        return SCHEMA.validate(df, lazy=True)
    # minimal built-in guard if pandera is unavailable
    required = {"loan_amnt", "int_rate", "grade", "default", "issue_date", "_month"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"schema check failed, missing columns: {sorted(missing)}")
    if not df["default"].isin([0, 1]).all():
        raise ValueError("schema check failed: default must be binary")
    return df
