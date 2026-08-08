import pandera as pa
import pytest
from credence.data import generate
from credence.validation import validate


def test_validate_success(tiny_df):
    train_df, _, _ = tiny_df
    res = validate(train_df)
    assert len(res) == len(train_df)


def test_validate_invalid_default():
    df = generate(n_months=1, rows_per_month=10, seed=1)
    df.loc[0, "default"] = 99
    with pytest.raises((ValueError, pa.errors.SchemaErrors, pa.errors.SchemaError)):
        validate(df)


def test_validate_fallback(monkeypatch):
    import credence.validation as val_mod

    monkeypatch.setattr(val_mod, "SCHEMA", None)
    df = generate(n_months=1, rows_per_month=10, seed=2)
    res = val_mod.validate(df)
    assert len(res) == len(df)

    # Missing column
    with pytest.raises(ValueError, match="missing columns"):
        val_mod.validate(df.drop(columns=["default"]))

    # Non binary default
    bad_df = df.copy()
    bad_df.loc[0, "default"] = 5
    with pytest.raises(ValueError, match="must be binary"):
        val_mod.validate(bad_df)
