import numpy as np
import pandas as pd
import pytest

from analysis import returns as R
from conftest import make_days


def _days():
    # a: regular every 30 days; b: one visit
    rows = [("a", (pd.Timestamp("2023-01-01") + pd.Timedelta(days=30 * i)).date().isoformat(), 200) for i in range(6)]
    rows.append(("b", "2023-03-01", 200))
    return make_days(rows)


def test_state_features_measure_overdue_against_own_rhythm():
    days = _days()
    cutoff = pd.Timestamp("2023-06-29")  # a's last visit 2023-05-31: 29 days, b: 120 days
    s = R.state_at(days, cutoff).set_index("customer_id")
    assert s.loc["a", "days_since_last_visit"] == 29
    assert s.loc["a", "visits"] == 6
    assert s.loc["a", "rel"] == pytest.approx(np.log(29 / 30))
    assert s.loc["a", "over_max"] == 0  # not past their longest gap
    assert s.loc["a", "cv"] == pytest.approx(0.0)
    assert s.loc["b", "first"] == 1 and s.loc["b", "rel"] == 0


def test_outcomes_are_blank_until_known():
    days = _days()
    s = R.add_outcomes(R.state_at(days, pd.Timestamp("2023-02-15")), days, horizons=[30, 365])
    a = s.set_index("customer_id").loc["a"]
    assert a["y_30"] == 1.0  # visited on 2023-03-02
    assert np.isnan(a["y_365"])  # data ends 2023-05-31


def test_predictions_are_monotone_in_horizon_and_expected_days_interpolate():
    p = pd.DataFrame({7: [0.1, 0.6], 14: [0.3, 0.7], 21: [0.7, 0.8]})
    days = R.expected_days_to_return(p)
    assert days.iloc[0] == pytest.approx(14 + (0.5 - 0.3) / 0.4 * 7)
    assert days.iloc[1] == pytest.approx(7 * 0.5 / 0.6)
    assert np.isnan(R.expected_days_to_return(pd.DataFrame({7: [0.1], 14: [0.2]})).iloc[0])


def test_fit_uses_only_outcomes_known_at_the_cutoff():
    rng = np.random.default_rng(0)
    rows = []
    for c in range(40):
        start = pd.Timestamp("2023-01-01") + pd.Timedelta(days=int(rng.integers(0, 60)))
        gap = int(rng.integers(20, 50))
        for i in range(int(rng.integers(1, 12))):
            rows.append((f"c{c}", (start + pd.Timedelta(days=gap * i)).date().isoformat(), 200))
    days = make_days(rows)
    landmarks = R.landmark_frame(days, days["date"].max(), horizons=[30, 60])
    cutoff = pd.Timestamp("2023-09-01")
    model = R.fit(landmarks, cutoff, horizons=[30, 60])
    p = model.predict(R.state_at(days[days["date"] <= cutoff], cutoff))
    assert (p[60] >= p[30]).all()
    assert p.to_numpy().min() >= 0 and p.to_numpy().max() <= 1
