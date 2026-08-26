"""Feature engineering.

LEAKAGE POLICY — dropped before anything touches the model:
  * id / member_id                  : identifiers, no signal
  * funded_amnt(_inv)               : near-duplicate of loan_amnt
  * out_prncp, total_pymnt(_inv),
    total_rec_*, recoveries,
    collection_recovery_fee,
    last_pymnt_d, next_pymnt_d      : observed AFTER the outcome — pure target leakage
  * issue_date (raw string)         : used ONLY for the temporal split, never as a feature
Engineered (all computable at origination):
  * grade_ord          : ordinal A..G -> 0..6
  * log_income         : annual income is heavy-tailed
  * installment        : amortized monthly payment proxy
  * rate_x_dti         : interaction — expensive debt on a stretched budget
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DROPPED_LEAKAGE = [
    "id",
    "member_id",
    "funded_amnt",
    "funded_amnt_inv",
    "out_prncp",
    "out_prncp_inv",
    "total_pymnt",
    "total_pymnt_inv",
    "total_rec_prncp",
    "total_rec_int",
    "total_rec_late_fee",
    "recoveries",
    "collection_recovery_fee",
    "last_pymnt_d",
    "next_pymnt_d",
    "issue_date",
]

NUMERIC_RAW = [
    "loan_amnt",
    "term",
    "int_rate",
    "annual_inc",
    "dti",
    "revol_util",
    "delinq_2yrs",
    "emp_length",
    "credit_age",
]
CATEGORICAL_RAW = ["home_ownership", "purpose"]


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "grade" in out:
        out["grade_ord"] = out["grade"].map({g: i for i, g in enumerate("ABCDEFG")})
    if "emp_length" in out:
        out["emp_length"] = pd.to_numeric(out["emp_length"], errors="coerce")
    out["log_income"] = np.log1p(out["annual_inc"].clip(lower=0))
    r = out["int_rate"] / 100 / 12
    n = out["term"].clip(lower=12)
    out["installment"] = out["loan_amnt"] * r / (1 - (1 + r) ** (-n))
    out["rate_x_dti"] = out["int_rate"] * out["dti"]
    out["home_ownership"] = out["home_ownership"].replace({"ANY": "OTHER", "NONE": "OTHER"})
    return out


def make_preprocessor() -> ColumnTransformer:
    num = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
    cat = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        [
            ("num", num, NUMERIC_RAW + ["grade_ord", "log_income", "installment", "rate_x_dti"]),
            ("cat", cat, CATEGORICAL_RAW),
        ],
        verbose_feature_names_out=False,
    )


class FeatureBuilder:
    """Fit on TRAIN only; transform val/live/serving rows with frozen stats."""

    def __init__(self) -> None:
        self.preprocessor: ColumnTransformer | None = None
        self.feature_names_: list[str] = []

    def fit(self, df: pd.DataFrame) -> FeatureBuilder:
        self.preprocessor = make_preprocessor()
        self.preprocessor.fit(_clean(df))
        self.feature_names_ = list(self.preprocessor.get_feature_names_out())
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if self.preprocessor is None:
            raise RuntimeError("FeatureBuilder.fit must run before transform")
        return self.preprocessor.transform(_clean(df)).astype(np.float64)

    def transform_row(self, record: dict) -> np.ndarray:
        return self.transform(pd.DataFrame([record]))[0:1]
