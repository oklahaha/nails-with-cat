"""Per-customer results from the final models, fitted on everything up to OBSERVATION_END.

The model choices here were made in notebooks/02_retention_survival_clv.ipynb,
which also back-tests them:

* next visit and churn: Cox PH stratified by service category (the PH test
  fails for category unstratified), scored on each customer's open gap
* CLV: MBG/NBD on weekly visit data × each customer's own mean spend.
  MBG/NBD beat BG/NBD slightly on the holdout and doesn't call one-visit
  customers certainly alive; own mean spend beat Gamma-Gamma.
"""

from __future__ import annotations

import pandas as pd

from analysis import clv as C
from analysis import survival as SV
from analysis.segments import assign_segments, customer_features
from analysis.clean import Frames
from analysis.features import visit_days

# Cox covariates once category is a stratum instead
COX_COVARIATES = [c for c in SV.COVARIATES if c not in ("lashes", "both")]
COX_STRATA = ["category"]

# The churn rule: P(next visit within CHURN_HORIZON_DAYS) below CHURN_THRESHOLD,
# and no upcoming booking. 60 days suits the studio's follow-up habit (and lash
# refills). The threshold was chosen on a back-test (max F1 at
# OBSERVATION_END − 270 days) and checked at OBSERVATION_END − 90 days.
CHURN_HORIZON_DAYS = 60
CHURN_THRESHOLD = 0.41

# Expected next visits further out than this are left blank: not expected
MAX_EXPECTED_DAYS = 365


def fit_cox_at(days: pd.DataFrame, cutoff: pd.Timestamp):
    """The stratified Cox model on gaps as of `cutoff`, and its spend fill value."""
    train = SV.add_covariates(SV.gaps_until(days, cutoff))
    spend_fill = float((train["avg_spend_100"] * 100)[train["spend_unknown"] == 0].median())
    cph = SV.fit_cox(SV.model_frame(train, COX_COVARIATES, COX_STRATA), strata=COX_STRATA)
    return cph, spend_fill


def return_scores(days: pd.DataFrame, cutoff: pd.Timestamp, horizon: int = CHURN_HORIZON_DAYS) -> pd.DataFrame:
    """Per customer at `cutoff`: days since last visit, P(return within horizon), expected next visit.

    Customers whose last visit was 'other' (粉嫩術 / blank 活動) have no
    stratum in the model and get NaN.
    """
    cph, spend_fill = fit_cox_at(days, cutoff)
    current = SV.current_gaps(days, cutoff, spend_fill)
    scorable = current[current["category"].isin(SV.MODEL_CATEGORIES)].reset_index(drop=True)
    sf = SV.survival_grid(cph, scorable[COX_COVARIATES + COX_STRATA])
    sf.columns = range(len(scorable))
    scorable[f"p_return_{horizon}d"] = SV.conditional_return(sf, scorable["gap_days"], horizon)
    remaining = SV.conditional_median_remaining(sf, scorable["gap_days"])
    remaining = remaining.where(remaining <= MAX_EXPECTED_DAYS)
    scorable["expected_next_visit"] = pd.Timestamp(cutoff) + pd.to_timedelta(remaining, unit="D")
    out = current[["customer_id", "start_date", "gap_days", "category", "visit_number"]].merge(
        scorable[["customer_id", f"p_return_{horizon}d", "expected_next_visit"]], on="customer_id", how="left")
    return out.rename(columns={"start_date": "last_visit", "gap_days": "days_since_last_visit",
                               "category": "last_category", "visit_number": "visits"}).set_index("customer_id")


def customer_scores(frames: Frames) -> pd.DataFrame:
    """One row per customer with a visit: return, churn, P(alive), 12-month CLV and segment."""
    end = frames.observation_end
    days = visit_days(frames.visits)
    scores = return_scores(days, end)

    upcoming = frames.customers.set_index("customer_id")["has_upcoming_booking"]
    scores["has_upcoming_booking"] = upcoming.reindex(scores.index).fillna(False).astype(bool)
    p = scores[f"p_return_{CHURN_HORIZON_DAYS}d"]
    # Someone with a booking ahead hasn't churned, whatever the model says
    scores["churn_flag"] = (p < CHURN_THRESHOLD) & ~scores["has_upcoming_booking"]

    summary = C.rfm_summary(days, end)
    bg = C.fit_bgnbd(summary, modified=True)
    spend = C.own_mean_spend(summary)
    scores["p_alive"] = C.probability_alive(bg, summary)
    scores["expected_visits_12m"] = C.expected_visits(bg, 52, summary)
    scores["expected_spend_per_visit"] = spend
    scores["clv_12m"] = C.clv(bg, spend, summary, months=12)

    # Phase 3: segment (k-means on repeat customers, rules for one-visit ones)
    scores["segment"] = assign_segments(customer_features(days, end)).reindex(scores.index)

    names = frames.customers.set_index("customer_id")["name"]
    scores.insert(0, "name", names.reindex(scores.index))
    return scores.sort_values("clv_12m", ascending=False)
