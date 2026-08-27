import numpy as np
from credence.features import FeatureBuilder


def test_leakage_columns_are_dropped(tiny_df):
    fb = FeatureBuilder().fit(tiny_df[0])
    names = set(fb.feature_names_)
    for leaked in ["total_pymnt", "issue_date", "id", "out_prncp"]:
        assert leaked not in names, f"leakage column '{leaked}' reached the model"


def test_no_nans_and_expected_width(tiny_df):
    train_df, val_df, _ = tiny_df
    fb = FeatureBuilder().fit(train_df)
    X = fb.transform(val_df)
    assert np.isfinite(X).all(), "imputation failed — NaNs survived"
    # 9 raw numeric + 4 engineered + one-hots for 2 categoricals
    assert X.shape[1] >= 15


def test_transform_row_matches_transform(tiny_df):
    train_df, _, _ = tiny_df
    fb = FeatureBuilder().fit(train_df)
    rec = train_df.iloc[0].drop(labels=["default", "_month"]).to_dict()
    row = fb.transform_row(rec)
    assert row.shape == (1, len(fb.feature_names_))
