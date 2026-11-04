import numpy as np
import pandas as pd
import pytest

from analysis.forecast import (
    days_off,
    error_table,
    fourier_terms,
    mean_last_4,
    rolling_origin,
    seasonal_naive,
    weekly_series,
)


def _visits(dates, prices):
    return pd.DataFrame({"date": pd.to_datetime(dates), "appointment_id": [f"r{i}" for i in range(len(dates))],
                         "price": prices})


def test_weekly_series_keeps_complete_weeks_and_empty_ones():
    v = _visits(["2023-01-02", "2023-01-08", "2023-01-20", "2023-01-26"], [100, np.nan, 50, 70])
    # Ends on Thursday 2023-01-26: that week (to Sun 29th) is partial and dropped
    w = weekly_series(v, pd.Timestamp("2023-01-02"), pd.Timestamp("2023-01-26"))
    assert w.index.tolist() == pd.to_datetime(["2023-01-08", "2023-01-15", "2023-01-22"]).tolist()
    assert w["bookings"].tolist() == [2, 0, 1]
    assert w["revenue"].tolist() == [100, 0, 50]
    assert w["price_missing"].tolist() == [1, 0, 0]


def test_days_off_counts_distinct_noted_dates_per_week():
    appts = pd.DataFrame({
        "date": pd.to_datetime(["2023-01-03", "2023-01-03", "2023-01-05", "2023-01-10"]),
        "is_special": [True, True, True, True],
        "notes": ["放假", "旅行", "瑜伽", "返鄉下"],
    })
    weeks = pd.DatetimeIndex(pd.to_datetime(["2023-01-08", "2023-01-15", "2023-01-22"]))
    assert days_off(appts, weeks).tolist() == [1, 1, 0]


def test_fourier_terms_repeat_yearly():
    weeks = pd.DatetimeIndex(pd.to_datetime(["2023-03-05", "2024-03-03"]))
    f = fourier_terms(weeks, k=2)
    assert list(f.columns) == ["sin1", "cos1", "sin2", "cos2"]
    assert f.iloc[0].to_numpy() == pytest.approx(f.iloc[1].to_numpy(), abs=0.05)


def test_baselines_and_rolling_origin_never_see_the_future():
    weeks = pd.date_range("2022-01-02", periods=60, freq="W-SUN")
    y = pd.Series(np.arange(60, dtype=float), index=weeks)
    exog = pd.DataFrame(index=weeks)
    future = exog.iloc[55:57]
    assert seasonal_naive(y.iloc[:55], exog, future).tolist() == [3.0, 4.0]
    assert mean_last_4(y.iloc[:55], exog, future).tolist() == [52.5, 52.5]

    seen = []

    def spy(train, _exog, fut):
        seen.append((train.index.max(), fut.index.min()))
        return np.zeros(len(fut))

    bt = rolling_origin(y, exog, {"spy": spy}, origins=[weeks[50], weeks[57]], horizon=4)
    assert all(last_train < first_future for last_train, first_future in seen)
    # The second origin only has 2 weeks left
    assert bt.groupby("origin").size().tolist() == [4, 2]
    assert error_table(bt).loc["spy", "MAE"] == pytest.approx(bt["actual"].mean())
