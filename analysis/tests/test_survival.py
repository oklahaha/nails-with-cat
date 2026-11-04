import numpy as np
import pandas as pd
import pytest

from analysis.survival import (
    add_covariates,
    conditional_median_remaining,
    conditional_return,
    gaps_until,
    returned_within,
)
from conftest import make_days


def test_gaps_until_censors_at_the_cutoff():
    days = make_days([("a", "2023-01-01", 100), ("a", "2023-03-01", 100)])
    gaps = gaps_until(days, pd.Timestamp("2023-02-01"))
    # As of Feb 1 the March visit hasn't happened: one open gap of 31 days
    assert gaps["gap_days"].tolist() == [31]
    assert gaps["event"].tolist() == [0]


def test_covariates_use_only_the_past():
    days = make_days([
        ("a", "2023-01-01", 100, "nails"),
        ("a", "2023-01-31", None, "lashes", True),  # blank price
        ("a", "2023-03-02", 400, "both"),
        ("a", "2023-04-01", 100, "nails"),
    ])
    g = add_covariates(gaps_until(days, pd.Timestamp("2023-06-01")))
    # Mean spend so far, skipping the blank, in HK$100
    assert g["avg_spend_100"].tolist() == pytest.approx([1.0, 1.0, 2.5, 2.0])
    # Own rhythm: mean of earlier (closed) gaps only; gaps are 30, 30, 30, then open
    assert g["first_gap"].tolist() == [1, 0, 0, 0]
    assert np.exp(g["log_prev_gap"].iloc[1:]).tolist() == pytest.approx([30, 30, 30])
    assert g[["lashes", "both"]].values.tolist() == [[0, 0], [1, 0], [0, 1], [0, 0]]
    assert g["top_up_only"].tolist() == [0, 1, 0, 0]
    assert g["q2"].tolist() == [0, 0, 0, 1]


def test_spend_fill_for_customers_with_no_known_price():
    days = make_days([("a", "2023-01-01", None), ("b", "2023-01-01", 300)])
    g = add_covariates(gaps_until(days, pd.Timestamp("2023-02-01")), spend_fill=200)
    assert dict(zip(g["customer_id"], g["avg_spend_100"])) == {"a": 2.0, "b": 3.0}
    assert dict(zip(g["customer_id"], g["spend_unknown"])) == {"a": 1, "b": 0}


def test_conditional_return_and_median():
    # S(t) = 1 - t/100 for one customer: uniform return over 100 days
    t = np.arange(0, 201)
    sf = pd.DataFrame({0: np.clip(1 - t / 100, 0, 1)}, index=t)
    waited = pd.Series([50])
    # Having waited 50 days, half the mass is left; 25 more days take half of that
    assert conditional_return(sf, waited, horizon=25).iloc[0] == pytest.approx(0.5)
    assert conditional_median_remaining(sf, waited).iloc[0] == 25


def test_conditional_median_is_nan_when_it_never_halves():
    t = np.arange(0, 101)
    sf = pd.DataFrame({0: np.where(t < 10, 1.0, 0.8)}, index=t)  # 80% never come back
    assert np.isnan(conditional_median_remaining(sf, pd.Series([20])).iloc[0])


def test_returned_within():
    days = make_days([("a", "2023-01-10", 1), ("b", "2023-05-01", 1), ("c", "2022-12-01", 1)])
    back = returned_within(days, pd.Timestamp("2023-01-01"), horizon=90)
    assert set(back.index) == {"a"}


def test_conditional_return_past_the_end_of_the_grid():
    t = np.arange(0, 11).astype(float)  # lifelines gives a float index
    sf = pd.DataFrame({0: np.linspace(1, 0.5, 11)}, index=t)
    # Waited longer than the grid: S stays flat, so no further return
    assert conditional_return(sf, pd.Series([50]), horizon=5).iloc[0] == 0
