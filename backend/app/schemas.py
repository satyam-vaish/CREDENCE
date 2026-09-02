"""Pydantic contract for every applicant-facing endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

HomeOwn = Literal["RENT", "MORTGAGE", "OWN", "OTHER"]
Purpose = Literal[
    "debt_consolidation", "credit_card", "home_improvement", "major_purchase", "medical", "other"
]


class ApplicantInput(BaseModel):
    annual_inc: float = Field(10_000, ge=10_000, le=500_000, description="Gross annual income, $")
    dti: float = Field(18, ge=0, le=50, description="Debt-to-income ratio, %")
    int_rate: float = Field(12.5, ge=4, le=32, description="Loan interest rate, %")
    loan_amnt: float = Field(15_000, ge=500, le=50_000, description="Requested amount, $")
    revol_util: float = Field(34, ge=0, le=125, description="Revolving utilization, %")
    delinq_2yrs: int = Field(0, ge=0, le=10, description="Delinquencies last 24 months")
    emp_length: int = Field(5, ge=0, le=10, description="Employment length, years")
    grade: Literal["A", "B", "C", "D", "E", "F", "G"] = "C"
    term: int = Field(36, ge=36, le=60, description="Loan term, months")
    credit_age: float = Field(9, ge=0, le=35, description="Age of oldest credit line, years")
    home_ownership: HomeOwn = "RENT"
    purpose: Purpose = "debt_consolidation"


class PredictResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    default_probability: float
    decision: Literal["APPROVE", "REJECT"]
    threshold: float
    model_version: int


class WhatIfRequest(BaseModel):
    base: ApplicantInput
    feature: str = Field(..., description="single feature to change")
    value: float = Field(..., description="new value for that feature")


class WhatIfResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    default_probability: float
    base_probability: float
    delta: float
    model_version: int


class ExplainResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    base_value: float
    contributions: list[dict]  # [{feature, value, contribution}] top-5 by |contribution|
    model_version: int


class SimulateRequest(BaseModel):
    month: int = Field(..., ge=0, le=47, description="originations month to sample")
