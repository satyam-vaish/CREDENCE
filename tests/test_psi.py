import numpy as np
from credence.psi import band, psi


def test_identical_distributions_give_near_zero():
    rng = np.random.default_rng(0)
    x = rng.normal(size=20_000)
    assert psi(x, x) < 0.01
    assert psi(x, rng.normal(size=20_000)) < 0.05


def test_shifted_distribution_crosses_significant_band():
    rng = np.random.default_rng(1)
    ref = rng.normal(0, 1, 20_000)
    cur = rng.normal(1.2, 1, 20_000)  # 1.2 sigma shift
    value = psi(ref, cur)
    assert value > 0.25
    assert band(value) == "significant"


def test_band_boundaries():
    assert band(0.05) == "stable"
    assert band(0.15) == "moderate"
    assert band(0.30) == "significant"
