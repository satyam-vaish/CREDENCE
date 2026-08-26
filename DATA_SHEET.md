# Datasheet — Lending Club / Synthetic Credit Default Dataset

## Motivation
- **Purpose:** Loan default risk prediction, time-based split validation, and drift simulation for credit risk modelling.
- **Creators:** CREDENCE synthetic data generator (mirrors Lending Club accepted loans schema).

## Composition
- **Instances:** 43,200 loan origination records spanning 48 consecutive months (900 loans/month).
- **Target:** Binary indicator default (1 = default, 0 = fully paid).
- **Temporal Axis:** _month (0..47) and issue_date (2022-01 to 2025-12).
- **Features:**
  - loan_amnt: Requested loan principal ( - ,000).
  - 	erm: Loan tenure in months (36 or 60).
  - int_rate: Interest rate (4.0% - 32.0%).
  - grade: Credit risk grade (A through G).
  - nnual_inc: Borrower gross annual income (,000 - ,000).
  - dti: Debt-to-income ratio (0% - 50%).
  - emp_length: Employment tenure in years (0 - 10, ~1% missing for imputation testing).
  - home_ownership: Residential status (RENT, MORTGAGE, OWN, OTHER).
  - purpose: Loan purpose category (debt_consolidation, credit_card, home_improvement, etc.).
  - 
evol_util: Revolving line credit utilization percentage (0% - 125%).
  - delinq_2yrs: Delinquency count in past 24 months (0 - 10).
  - credit_age: Age of oldest active credit line in years (0 - 35).
- **Target Leakage Fields:** 	otal_pymnt (post-origination cumulative repayment) included in raw data to test leakage prevention; dropped prior to model ingestion.

## Collection Process
- **Mechanism:** Procedural Data Generating Process (DGP) with economic shock ramp engineered around month 33 (raising interest rates, DTI, revolving utilization, and baseline default probabilities) to rigorously validate Population Stability Index (PSI) drift detection.

## Preprocessing & Data Splits
- **Splits:** Strictly temporal:
  - Training: Months 0–29 (27,000 loans).
  - Validation: Months 30–35 (5,400 loans).
  - Live Simulation: Months 36–47 (10,800 loans).
- **Preprocessing:** Median imputation and standard scaling for numeric features; most-frequent imputation and one-hot encoding for categoricals.

## Uses & Distribution
- **Distribution:** Internal demo, testing, and continuous retraining benchmarks.
- **License:** Open educational and portfolio use.
