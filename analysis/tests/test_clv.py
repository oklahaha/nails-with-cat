import numpy as np
import pandas as pd
import pytest
from lifetimes.utils import summary_data_from_transaction_data

from analysis.clv import calibration_holdout, naive_rate_baseline, rfm_summary
from conftest import make_days


def _days():
    return make_days([
        ("a", "2023-01-02", 200), ("a", "2023-01-04", 100),  # same week: one transaction of 300
        ("a", "2023-02-06", None),  # blank price
        ("a", "2023-03-06", 500),
        ("b", "2023-02-13", 100),
        ("c", "2023-01-09", 100), ("c", "2023-04-03", 0),  # a free top-up
    ])


def test_rfm_matches_lifetimes():
    days = _days()
    ours = rfm_summary(days, pd.Timestamp("2023-04-30"))
    theirs = summary_data_from_transaction_data(days, "customer_id", "date", freq="W",
                                                observation_period_end="2023-04-30")
    pd.testing.assert_frame_equal(ours[["frequency", "recency", "T"]], theirs[["frequency", "recency", "T"]],
                                  check_names=False)


def test_rfm_monetary_skips_blank_prices_and_the_first_visit():
    s = rfm_summary(_days(), pd.Timestamp("2023-04-30"))
    # a: repeat weeks are Feb 6 (blank) and Mar 6 (500); the first week's 300 is left out
    assert s.loc["a", "monetary_value"] == 500
    assert s.loc["a", "monetary_known_weeks"] == 1
    assert s.loc["b", "frequency"] == 0 and s.loc["b", "monetary_value"] == 0
    assert s.loc["c", "monetary_value"] == 0 and s.loc["c", "monetary_known_weeks"] == 1


def test_calibration_holdout_and_naive_baseline():
    ch = calibration_holdout(_days(), pd.Timestamp("2023-02-28"), pd.Timestamp("2023-04-30"))
    assert set(ch.index) == {"a", "b", "c"}
    assert ch.loc["a", "frequency_holdout"] == 1 and ch.loc["a", "spend_holdout"] == 500
    assert ch.loc["b", "frequency_holdout"] == 0
    # a: 1 repeat week over T weeks of age, carried over the holdout
    expected = ch.loc["a", "frequency"] / ch.loc["a", "T"] * ch.loc["a", "duration_holdout"]
    assert naive_rate_baseline(ch, ch["duration_holdout"]).loc["a"] == pytest.approx(expected)
    # b's whole history is one week: T > 0 but no repeats → 0
    assert naive_rate_baseline(ch, 8).loc["b"] == 0


def test_own_mean_spend_falls_back_to_the_mean_of_known_customers():
    from analysis.clv import own_mean_spend

    s = rfm_summary(_days(), pd.Timestamp("2023-04-30"))
    spend = own_mean_spend(s)
    assert spend["a"] == 500 and spend["c"] == 0
    # b has no repeat visit: the mean over a and c
    assert spend["b"] == 250
