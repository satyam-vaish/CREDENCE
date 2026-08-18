import numpy as np
from credence.threshold import cost_at, optimal_threshold


def test_asymmetric_costs_push_threshold_down():
    rng = np.random.default_rng(2)
    y = rng.binomial(1, 0.2, 4_000)  # 20% base rate
    p = np.clip(y * 0.7 + rng.random(4_000) * 0.3 + 0.05, 0, 0.999)
    thr = optimal_threshold(y, p, cost_fn=5.0, cost_fp=1.0)
    # a missed default costs 5x a false alarm -> optimal cutoff well below 0.5
    assert thr < 0.45
    assert cost_at(y, p, thr, 5, 1) <= cost_at(y, p, 0.5, 5, 1)


def test_symmetric_costs_hover_near_base_rate():
    rng = np.random.default_rng(3)
    y = rng.binomial(1, 0.5, 4_000)
    p = np.where(y == 1, rng.random(4_000) * 0.5 + 0.5, rng.random(4_000) * 0.5)
    thr = optimal_threshold(y, p, cost_fn=1.0, cost_fp=1.0)
    assert 0.3 < thr < 0.7
