"""Weekly bookings and revenue: series, baselines, SARIMAX, and rolling-origin back-tests.

These are forecasts of *fulfilled* bookings. Full days turn customers away
without a trace in the sheet (capacity censoring), so true demand on busy
weeks is higher than what we see, and no model of this series can know it.
"""

from __future__ import annotations

import warnings
from collections.abc import Callable

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

# Weeks run Monday–Sunday and are labelled by their Sunday
WEEK = "W-SUN"
WEEKS_PER_YEAR = 365.25 / 7

# Bookings before 2023 are the AppSheet ramp-up (well under the later level),
# and 收費 is mostly blank until March 2023, so each series starts later
BOOKINGS_START = pd.Timestamp("2023-01-02")
REVENUE_START = pd.Timestamp("2023-03-06")

# Wednesday has been the studio's regular day off since this date (the other days
# are working days, with some flexibility). Before it, Wednesdays were ordinary
# working days. Inferred from the data and confirmed by the studio. Tried as a
# step regressor in notebooks/03; the ARIMA level absorbs it, so the final model
# doesn't use it.
REGULAR_WEDNESDAY_OFF_FROM = pd.Timestamp("2026-01-07")

# Words in 特別事項 that mark a planned day away from the studio
DAY_OFF_PATTERN = "放假|旅行|鄉下|澳門|大陸|北上|翻來|清明|過年|新年"


def weekly_series(visits: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Weekly bookings (visit rows) and revenue (sum of known 收費), complete weeks only.

    A week is kept only if its Sunday is on or before `end`, so a partial
    last week never looks like a slump.
    """
    v = visits[(visits["date"] >= start) & (visits["date"] <= end)]
    weeks = v.set_index("date").resample(WEEK).agg(
        bookings=("appointment_id", "size"),
        revenue=("price", "sum"),
        price_missing=("price", lambda p: int(p.isna().sum())),
    )
    full_range = pd.date_range(pd.Timestamp(start).to_period(WEEK).end_time.normalize(), end, freq=WEEK)
    return weeks.reindex(full_range, fill_value=0).rename_axis("week")


def days_off(appointments: pd.DataFrame, weeks: pd.DatetimeIndex) -> pd.Series:
    """Planned days off per week: distinct dates with a day-off 特別事項 note.

    These are written into the sheet ahead of time, so unlike the bookings
    themselves they may be used for future weeks. They cover only some days
    off (many go unrecorded).
    """
    special = appointments[appointments["is_special"]]
    off = special[special["notes"].str.contains(DAY_OFF_PATTERN, regex=True)]
    per_week = off.drop_duplicates("date").set_index("date").resample(WEEK).size()
    return per_week.reindex(weeks, fill_value=0).rename("days_off")


def fourier_terms(weeks: pd.DatetimeIndex, k: int) -> pd.DataFrame:
    """Annual seasonality as k sine/cosine pairs of the day of year.

    A weekly series has a season of ~52.18 weeks, which isn't a whole number
    and is too long for SARIMA's seasonal lags (s = 52 would need years of data
    and is very slow). Fourier terms as regressors are the standard workaround
    (dynamic harmonic regression); k sets how wiggly the yearly pattern may be.
    """
    t = 2 * np.pi * weeks.dayofyear.to_numpy() / 365.25
    cols = {}
    for i in range(1, k + 1):
        cols[f"sin{i}"] = np.sin(i * t)
        cols[f"cos{i}"] = np.cos(i * t)
    return pd.DataFrame(cols, index=weeks)


# A forecaster takes the training series, exog for the training weeks and for
# the h future weeks, and returns h forecasts
Forecaster = Callable[[pd.Series, pd.DataFrame, pd.DataFrame], np.ndarray]


def seasonal_naive(y: pd.Series, _exog: pd.DataFrame, future: pd.DataFrame) -> np.ndarray:
    """Each future week = the same week one year (52 weeks) earlier."""
    out = []
    for week in future.index:
        same_week_last_year = week - pd.to_timedelta(364, unit="D")
        out.append(y.get(same_week_last_year, np.nan))
    return np.asarray(out, dtype=float)


def mean_last_4(y: pd.Series, _exog: pd.DataFrame, future: pd.DataFrame) -> np.ndarray:
    """Every future week = the mean of the last 4 weeks."""
    return np.full(len(future), y.iloc[-4:].mean())


def sarimax(order: tuple[int, int, int], exog_cols: list[str]) -> Forecaster:
    """SARIMAX(order) with the given exog columns (Fourier terms, days off), refitted per call."""

    def forecast(y: pd.Series, exog: pd.DataFrame, future: pd.DataFrame) -> np.ndarray:
        model = fit_sarimax(y, exog[exog_cols] if exog_cols else None, order)
        return model.forecast(len(future), exog=future[exog_cols] if exog_cols else None).to_numpy()

    return forecast


def fit_sarimax(y: pd.Series, exog: pd.DataFrame | None, order: tuple[int, int, int]):
    with warnings.catch_warnings():
        # Convergence chatter on short windows; the back-test judges the result
        warnings.simplefilter("ignore")
        return SARIMAX(y, exog=exog, order=order, trend="c" if order[1] == 0 else "n",
                       enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)


def rolling_origin(y: pd.Series, exog: pd.DataFrame, forecasters: dict[str, Forecaster],
                   origins: list[pd.Timestamp], horizon: int) -> pd.DataFrame:
    """Back-test: at each origin, fit on weeks up to it and forecast the next `horizon` weeks.

    No random splits: every forecast only sees the past of its origin. Returns
    one row per origin × model × step ahead with the actual value.
    """
    rows = []
    for origin in origins:
        train = y[y.index <= origin]
        future = exog[exog.index > origin].iloc[:horizon]
        future = future[future.index.isin(y.index)]
        if len(future) == 0:  # not .empty, which is also true with no exog columns
            continue
        for name, forecaster in forecasters.items():
            predicted = forecaster(train, exog.loc[train.index], future)
            for step, (week, value) in enumerate(zip(future.index, predicted), start=1):
                rows.append({"origin": origin, "model": name, "h": step, "week": week,
                             "forecast": value, "actual": y[week]})
    return pd.DataFrame(rows)


def error_table(backtest: pd.DataFrame, min_actual_for_mape: float = 1.0) -> pd.DataFrame:
    """MAE and MAPE per model. MAPE skips weeks with an actual below `min_actual_for_mape`
    (closures), where a percentage error explodes."""
    b = backtest.dropna(subset=["forecast"]).assign(abs_err=lambda t: (t["forecast"] - t["actual"]).abs())
    mape_rows = b[b["actual"] >= min_actual_for_mape]
    out = pd.DataFrame({
        "MAE": b.groupby("model")["abs_err"].mean(),
        "MAPE": (mape_rows["abs_err"] / mape_rows["actual"]).groupby(mape_rows["model"]).mean(),
        "forecasts": b.groupby("model").size(),
    })
    return out.sort_values("MAE")


# Chosen in notebooks/03 by AIC on the weeks before the back-test, then confirmed
# by the rolling-origin back-test against the baselines
ORDER = (0, 1, 1)  # = simple exponential smoothing: a level that drifts week to week
EXOG_COLS = ["sin1", "cos1", "days_off"]
FOURIER_K = 1
# Revenue per booking is taken over this many recent weeks
REVENUE_PER_BOOKING_WEEKS = 8


def exog_frame(appointments: pd.DataFrame, weeks: pd.DatetimeIndex) -> pd.DataFrame:
    """The model's regressors for these weeks: one Fourier pair and planned days off."""
    return pd.concat([fourier_terms(weeks, FOURIER_K), days_off(appointments, weeks)], axis=1)


def revenue_via_bookings(bookings: pd.Series, order: tuple[int, int, int] = ORDER,
                         exog_cols: list[str] = EXOG_COLS) -> Forecaster:
    """Revenue = forecast bookings × revenue per booking over the recent weeks.

    Forecasting revenue directly lost to the 4-week mean in the back-test;
    going through bookings (the better-forecast series) beat it.
    """
    forecast_bookings = sarimax(order, exog_cols)

    def forecast(y: pd.Series, exog: pd.DataFrame, future: pd.DataFrame) -> np.ndarray:
        past = bookings.loc[y.index]
        recent = slice(-REVENUE_PER_BOOKING_WEEKS, None)
        per_booking = y.iloc[recent].sum() / max(past.iloc[recent].sum(), 1)
        return forecast_bookings(past, exog, future) * per_booking

    return forecast


def final_forecast(visits: pd.DataFrame, appointments: pd.DataFrame, end: pd.Timestamp,
                   horizon: int = 12, interval: float = 0.8) -> pd.DataFrame:
    """The next `horizon` weeks of bookings and revenue, with `interval` prediction bands.

    Revenue's band is the bookings band × revenue per booking, so it ignores
    uncertainty in prices (narrower than the truth). Planned days off already
    in the sheet are used for the future weeks; other weeks assume none.
    """
    weekly = weekly_series(visits, BOOKINGS_START, end)
    y = weekly["bookings"].astype(float)
    future_weeks = pd.date_range(y.index[-1] + pd.to_timedelta(7, unit="D"), periods=horizon, freq=WEEK)
    exog = exog_frame(appointments, y.index.append(future_weeks))
    model = fit_sarimax(y, exog.loc[y.index, EXOG_COLS], ORDER)
    prediction = model.get_forecast(horizon, exog=exog.loc[future_weeks, EXOG_COLS])
    band = prediction.conf_int(alpha=1 - interval)

    recent = weekly.iloc[-REVENUE_PER_BOOKING_WEEKS:]
    per_booking = recent["revenue"].sum() / recent["bookings"].sum()
    out = pd.DataFrame({
        "bookings": prediction.predicted_mean,
        "bookings_low": band.iloc[:, 0].clip(lower=0),
        "bookings_high": band.iloc[:, 1],
    }, index=future_weeks)
    for col in ("", "_low", "_high"):
        out[f"revenue{col}"] = out[f"bookings{col}"] * per_booking
    out["planned_days_off"] = exog.loc[future_weeks, "days_off"]
    return out.rename_axis("week")
