import pandas as pd
import pytest

from analysis import inference as INF


def test_wilson_interval_known_values():
    lo, hi = INF.wilson_ci(0, 10)
    assert lo == pytest.approx(0.0, abs=1e-12)
    assert hi == pytest.approx(0.2775, abs=1e-4)
    lo, hi = INF.wilson_ci(50, 100)
    assert (lo, hi) == pytest.approx((0.4038, 0.5962), abs=1e-4)


def test_chi_square_falls_back_to_fisher_on_small_2x2():
    small = pd.DataFrame([[1, 9], [6, 4]])
    out = INF.chi_square(small)
    assert out["test"] == "Fisher exact"
    big = pd.DataFrame([[40, 60], [60, 40]])
    out = INF.chi_square(big)
    assert out["test"] == "chi-square" and out["assumptions_ok"] and out["p_value"] < 0.01


def test_concentration_extremes():
    assert INF.concentration(pd.Series([10.0] * 50))["gini"] == pytest.approx(0, abs=1e-9)
    one = INF.concentration(pd.Series([0.0] * 99 + [100.0]))
    assert one["top_10pct_share"] == 1.0 and one["gini"] > 0.95


def test_km_medians_without_censoring_is_the_sample_median():
    gaps = pd.DataFrame({"category": ["x"] * 5, "gap_days": [10, 20, 30, 40, 50], "event": [1] * 5})
    assert INF.km_medians(gaps).loc["x", "median_days"] == 30
