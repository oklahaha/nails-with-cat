"""Customer lifetime value: BG/NBD (how often) × spend per visit (Gamma-Gamma or own mean).

The models work on the classic RFM summary per customer, in weeks:

* frequency: number of *repeat* weeks with a visit (weeks with a visit − 1)
* recency: weeks from the first to the last visit week
* T: weeks from the first visit week to the cut-off (the customer's "age")
* monetary_value: mean spend per repeat visit week, over weeks with a known
  收費 (blank prices are skipped, never treated as 0)

Two visits in one week count as one transaction, as `lifetimes` does with
freq='W'. We build the summary ourselves (rather than lifetimes'
summary_data_from_transaction_data) so blank prices can be handled
explicitly; a test checks frequency / recency / T against lifetimes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from lifetimes import BetaGeoFitter, GammaGammaFitter, ModifiedBetaGeoFitter

FREQ = "W"


def weekly_transactions(days: pd.DataFrame) -> pd.DataFrame:
    """Visit days rolled up to customer × week: spend summed (NaN if no price known that week)."""
    d = days.assign(week=days["date"].dt.to_period(FREQ))
    return (
        d.groupby(["customer_id", "week"])
        .agg(spend=("spend", lambda s: s.sum(min_count=1)))
        .reset_index()
    )


def rfm_summary(days: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """The RFM summary of visits on or before `cutoff` (see module docstring)."""
    tx = weekly_transactions(days[days["date"] <= pd.Timestamp(cutoff)])
    end_week = pd.Timestamp(cutoff).to_period(FREQ)
    tx = tx.sort_values(["customer_id", "week"])
    tx["repeat"] = tx.groupby("customer_id").cumcount() > 0

    def weeks(a: pd.Series, b) -> pd.Series:
        return (a - b).map(lambda offset: offset.n)

    g = tx.groupby("customer_id")
    first, last = g["week"].min(), g["week"].max()
    summary = pd.DataFrame({
        "frequency": g.size() - 1,
        "recency": weeks(last, first),
        "T": first.map(lambda w: (end_week - w).n),
    })
    repeat = tx[tx["repeat"]]
    summary["monetary_value"] = repeat.groupby("customer_id")["spend"].mean()
    summary["monetary_known_weeks"] = repeat.groupby("customer_id")["spend"].count()
    summary[["monetary_value"]] = summary[["monetary_value"]].fillna(0.0)
    summary["monetary_known_weeks"] = summary["monetary_known_weeks"].fillna(0).astype(int)
    return summary.astype({"frequency": float, "recency": float, "T": float})


def holdout_actuals(days: pd.DataFrame, calibration_end: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Per customer, what really happened in (calibration_end, end]: visit weeks and known spend."""
    window = days[(days["date"] > pd.Timestamp(calibration_end)) & (days["date"] <= pd.Timestamp(end))]
    tx = weekly_transactions(window)
    return tx.groupby("customer_id").agg(
        frequency_holdout=("week", "size"),
        spend_holdout=("spend", lambda s: s.sum(min_count=0)),
    )


def calibration_holdout(days: pd.DataFrame, calibration_end: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Calibration RFM (to calibration_end) joined with holdout actuals (0 for no visit).

    Only customers seen by calibration_end are in it: the model can't predict
    customers it hasn't met.
    """
    cal = rfm_summary(days, calibration_end)
    out = cal.join(holdout_actuals(days, calibration_end, end)).fillna(
        {"frequency_holdout": 0, "spend_holdout": 0.0})
    out["duration_holdout"] = float((pd.Timestamp(end).to_period(FREQ) - pd.Timestamp(calibration_end).to_period(FREQ)).n)
    return out


def naive_rate_baseline(summary: pd.DataFrame, weeks: float | pd.Series) -> pd.Series:
    """Each customer repeats their historical rate: repeat weeks per week of age × weeks ahead.

    Customers whose whole history is one week (T = 0) get 0: they have no rate.
    """
    rate = (summary["frequency"] / summary["T"].replace(0, np.nan)).fillna(0)
    return rate * weeks


def fit_bgnbd(summary: pd.DataFrame, penalizer: float = 0.001, modified: bool = False) -> BetaGeoFitter:
    """BG/NBD on frequency / recency / T. The small penalty stops parameters running off.

    `modified` fits MBG/NBD instead, which lets a customer drop out right after
    their first visit too. Plain BG/NBD only allows dropping out after a
    repeat visit, so it calls every one-visit customer certainly alive.
    """
    model = ModifiedBetaGeoFitter if modified else BetaGeoFitter
    return model(penalizer_coef=penalizer).fit(
        *(summary[c].to_numpy() for c in ("frequency", "recency", "T")))


def expected_visits(bg: BetaGeoFitter, weeks: float, summary: pd.DataFrame) -> pd.Series:
    """BG/NBD's expected visit weeks in the next `weeks`, per customer.

    lifetimes' formulas break on pandas 2 Series inputs (a ufunc mixes
    DataFrame and Series), so plain arrays go in and the index comes back on.
    """
    values = bg.conditional_expected_number_of_purchases_up_to_time(
        weeks, *(summary[c].to_numpy() for c in ("frequency", "recency", "T")))
    return pd.Series(np.asarray(values, dtype=float), index=summary.index)


def probability_alive(bg: BetaGeoFitter, summary: pd.DataFrame) -> pd.Series:
    """BG/NBD's P(alive): the chance the customer hasn't silently dropped out."""
    values = bg.conditional_probability_alive(*(summary[c].to_numpy() for c in ("frequency", "recency", "T")))
    return pd.Series(np.asarray(values, dtype=float), index=summary.index)


def gamma_gamma_rows(summary: pd.DataFrame) -> pd.DataFrame:
    """Customers Gamma-Gamma can learn from: a repeat visit with a known, positive mean spend."""
    return summary[(summary["frequency"] > 0) & (summary["monetary_known_weeks"] > 0)
                   & (summary["monetary_value"] > 0)]


def fit_gamma_gamma(summary: pd.DataFrame, penalizer: float = 0.001) -> GammaGammaFitter:
    rows = gamma_gamma_rows(summary)
    return GammaGammaFitter(penalizer_coef=penalizer).fit(rows["monetary_known_weeks"].to_numpy(),
                                                         rows["monetary_value"].to_numpy())


def expected_spend_per_visit(gg: GammaGammaFitter, summary: pd.DataFrame) -> pd.Series:
    """Gamma-Gamma's expected mean spend per visit, shrunk toward the population mean.

    Customers without a usable spend history get the population mean (their
    own data count as 0 observations).
    """
    usable = summary.index.isin(gamma_gamma_rows(summary).index)
    n = pd.Series(np.where(usable, summary["monetary_known_weeks"], 0), index=summary.index)
    m = summary["monetary_value"].where(usable, 0.0)
    values = gg.conditional_expected_average_profit(n.to_numpy(), m.to_numpy())
    return pd.Series(np.asarray(values, dtype=float), index=summary.index)


def own_mean_spend(summary: pd.DataFrame) -> pd.Series:
    """Each customer's own mean spend per repeat visit week, no shrinkage.

    Customers with no known repeat spend (one visit, or only blank prices)
    get the mean over those who have one. On the holdout this beat
    Gamma-Gamma, whose heavy-tailed prior over-states light customers.
    """
    known = summary["monetary_known_weeks"] > 0
    own = summary["monetary_value"].where(known)
    return own.fillna(own.mean())


def clv(bg: BetaGeoFitter, spend_per_visit: pd.Series, summary: pd.DataFrame,
        months: int = 12, monthly_discount: float = 0.01) -> pd.Series:
    """Discounted expected revenue over the next `months`, per customer (HK$).

    The sum lifetimes' customer_lifetime_value computes: expected visits in
    each month × expected spend per visit, discounted per month. The spend
    estimate is passed in (own_mean_spend or expected_spend_per_visit from
    Gamma-Gamma), so blank prices are handled before it gets here.
    """
    spend = spend_per_visit
    weeks_per_month = 4.345
    total = pd.Series(0.0, index=summary.index)
    previous = 0.0
    for month in range(1, months + 1):
        cumulative = expected_visits(bg, month * weeks_per_month, summary)
        total += (cumulative - previous) * spend / (1 + monthly_discount) ** month
        previous = cumulative
    return total
