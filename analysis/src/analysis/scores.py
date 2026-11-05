"""Per-customer results from the final models, fitted on everything up to OBSERVATION_END.

The model choices were made in the notebooks, which also back-test them:

* return within 60 days, churn flag, expected next visit: landmark logistic
  models (returns.py, notebooks/04). They replaced the stratified Cox model,
  whose probabilities hardly depended on a customer's history (too low for
  regulars, too high for one-visit customers).
* P(alive) and CLV: MBG/CNBD-k on weekly visit data (cnbd.py, notebooks/04)
  × each customer's own mean spend. Customers come on a rhythm (gap CV well
  below the Poisson 1), and the Erlang-k gaps beat MBG/NBD on both holdouts;
  own mean spend beat Gamma-Gamma (notebooks/02).
"""

from __future__ import annotations

import pandas as pd

from analysis import clv as C
from analysis import cnbd
from analysis import returns as R
from analysis.clean import Frames
from analysis.features import visit_days
from analysis.segments import assign_segments, customer_features

CHURN_HORIZON_DAYS = R.CHURN_HORIZON_DAYS
CHURN_THRESHOLD = R.CHURN_THRESHOLD


def value_scores(days: pd.DataFrame, cutoff: pd.Timestamp) -> tuple[pd.DataFrame, cnbd.CNBDFit]:
    """P(alive), expected visits, spend per visit and 12-month CLV per customer, and the fit."""
    summary = cnbd.cnbd_summary(days, cutoff)
    model, _ = cnbd.fit(summary)
    spend = C.own_mean_spend(summary)
    out = pd.DataFrame(index=summary.index)
    out["p_alive"] = cnbd.probability_alive(model, summary)
    out["expected_visits_12m"] = cnbd.simulate_visits(model, summary, [52.0])[52.0]
    out["expected_spend_per_visit"] = spend
    out["clv_12m"] = cnbd.clv(model, spend, summary, months=12)
    return out, model


def customer_scores(frames: Frames, landmarks: pd.DataFrame | None = None) -> pd.DataFrame:
    """One row per customer with a visit: return, churn, P(alive), 12-month CLV and segment.

    `landmarks` (returns.landmark_frame up to OBSERVATION_END) is built here
    unless passed; run.py builds it once for this and the summary.
    """
    end = frames.observation_end
    days = visit_days(frames.visits)
    scores = R.return_scores(days, end, landmarks)

    upcoming = frames.customers.set_index("customer_id")["has_upcoming_booking"]
    scores["has_upcoming_booking"] = upcoming.reindex(scores.index).fillna(False).astype(bool)
    p = scores[f"p_return_{CHURN_HORIZON_DAYS}d"]
    # Someone with a booking ahead hasn't churned, whatever the model says
    scores["churn_flag"] = (p < CHURN_THRESHOLD) & ~scores["has_upcoming_booking"]

    value, model = value_scores(days, end)
    scores = scores.join(value, how="outer")
    scores.attrs["cnbd_k"] = model.k

    # Customers whose last visit was 'other' (粉嫩術) have value scores but no return model
    last = days.sort_values("date").groupby("customer_id").last()
    scores["last_visit"] = scores["last_visit"].fillna(last["date"].reindex(scores.index))
    scores["visits"] = scores["visits"].fillna(days.groupby("customer_id").size().reindex(scores.index))
    scores["has_upcoming_booking"] = scores["has_upcoming_booking"].fillna(
        upcoming.reindex(scores.index).fillna(False)).astype(bool)
    scores["churn_flag"] = scores["churn_flag"].fillna(False).astype(bool)

    # Phase 3: segment (k-means on repeat customers, rules for one-visit ones)
    scores["segment"] = assign_segments(customer_features(days, end, model)).reindex(scores.index)

    names = frames.customers.set_index("customer_id")["name"]
    scores.insert(0, "name", names.reindex(scores.index))
    return scores.sort_values("clv_12m", ascending=False)
