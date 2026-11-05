"""What about a first visit makes a new customer come back? (notebooks/04)

About half of new customers never return, and the first 60 days decide it
(notebooks/02). The scoring models only know "this is a first gap"; this
module asks *which* first visits turn into regulars, so the studio knows
where a follow-up matters most.

Unit: one new customer (first visit from FIRST_CLEAN_COHORT on, so existing
customers who entered with the sheet in 2022 don't count as new, and at least
60 days before OBSERVATION_END so the outcome is known). Outcome: a second
visit within 60 days. Features describe only the first visit day.

Models: logistic regression (odds ratios with confidence intervals, for
explanation) and, for prediction, the same against a depth-3 decision tree
and a random forest, trained on earlier first visits and tested on later ones
(time split, never random: a model must predict customers it hasn't met).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from analysis.clean import Frames
from analysis.features import add_service_columns, visit_days
from analysis.retention import FIRST_CLEAN_COHORT

WINDOW_DAYS = 60
# Train on first visits before this date, test on those from it on
SPLIT_DATE = pd.Timestamp("2025-07-01")

PREDICTORS = ["lashes", "both", "top_up_only", "spend_100", "price_unknown", "weekend",
              "evening", "q2", "q3", "q4", "has_phone", "deposit_paid", "year_2025_on"]


def first_visit_table(frames: Frames, window: int = WINDOW_DAYS) -> pd.DataFrame:
    """One row per eligible new customer: first-visit features and `returned` (within `window` days)."""
    end = frames.observation_end
    days = visit_days(frames.visits)
    rows = add_service_columns(frames.visits)
    ordered = days.sort_values(["customer_id", "date"]).assign(
        n=lambda d: d.groupby("customer_id").cumcount())
    first_day = ordered[ordered["n"] == 0].set_index("customer_id")["date"]
    second_day = ordered[ordered["n"] == 1].set_index("customer_id")["date"]

    first_rows = rows.merge(first_day.rename("first_date"), left_on="customer_id", right_index=True)
    first_rows = first_rows[first_rows["date"] == first_rows["first_date"]]
    g = first_rows.groupby("customer_id")
    first = days.merge(first_day.rename("first_date"), left_on="customer_id", right_index=True)
    first = first[first["date"] == first["first_date"]].set_index("customer_id")

    t = pd.DataFrame(index=first.index)
    t["first_visit"] = first["date"]
    t["category"] = first["category"]
    t["lashes"] = (first["category"] == "lashes").astype(int)
    t["both"] = (first["category"] == "both").astype(int)
    t["top_up_only"] = first["top_up_only"].astype(int)
    t["spend_100"] = (first["spend"] / 100)
    t["price_unknown"] = t["spend_100"].isna().astype(int)
    t["spend_100"] = t["spend_100"].fillna(t["spend_100"].median())
    start_hour = (g["start_minute"].min() / 60).reindex(t.index)
    t["weekend"] = first["date"].dt.dayofweek.isin([5, 6]).astype(int)
    t["evening"] = (start_hour >= 18).astype(int)
    quarter = first["date"].dt.quarter
    for q in (2, 3, 4):
        t[f"q{q}"] = (quarter == q).astype(int)
    customers = frames.customers.set_index("customer_id")
    t["has_phone"] = (customers["phone"].reindex(t.index).fillna("") != "").astype(int)
    # 訂金 is recorded from 2023; blank before (treated as not known = 0 with its own year effect)
    t["deposit_paid"] = g["deposit"].agg(lambda s: bool(s.fillna(False).any())).reindex(t.index).astype(int)
    t["year_2025_on"] = (first["date"] >= pd.Timestamp("2025-01-01")).astype(int)

    second = second_day.reindex(t.index)
    t["returned"] = ((second - t["first_visit"]).dt.days <= window).astype(int)
    eligible = (t["first_visit"].dt.to_period("M") >= FIRST_CLEAN_COHORT) & \
               (t["first_visit"] + pd.to_timedelta(window, unit="D") <= end)
    return t[eligible & t["category"].isin(["nails", "lashes", "both"])]


def odds_ratios(table: pd.DataFrame, predictors: list[str] = PREDICTORS):
    """Logistic regression on every eligible customer: odds ratio, 95% CI and p per predictor."""
    formula = "returned ~ " + " + ".join(predictors)
    model = smf.logit(formula, data=table).fit(disp=0)
    ci = np.exp(model.conf_int())
    out = pd.DataFrame({"odds_ratio": np.exp(model.params), "ci_low": ci[0], "ci_high": ci[1],
                        "p_value": model.pvalues}).drop(index="Intercept")
    return out, model


def compare_models(table: pd.DataFrame, split: pd.Timestamp = SPLIT_DATE, seed: int = 0,
                   n_boot: int = 1000, importance: bool = True) -> tuple[pd.DataFrame, dict]:
    """Train before `split`, test from it: AUC (bootstrap CI) and Brier per model, plus baselines.

    Baselines: the training return rate for everyone (AUC 0.5 by definition)
    and the training rate per first-visit category (the simplest rule).
    """
    train, test = table[table["first_visit"] < split], table[table["first_visit"] >= split]
    x_tr, x_te = train[PREDICTORS], test[PREDICTORS]
    scaler = StandardScaler().fit(x_tr)
    models = {
        "logistic regression": LogisticRegression(max_iter=2000).fit(scaler.transform(x_tr), train["returned"]),
        "decision tree (depth 3)": DecisionTreeClassifier(max_depth=3, min_samples_leaf=20, random_state=seed)
        .fit(x_tr, train["returned"]),
        "random forest": RandomForestClassifier(500, min_samples_leaf=10, random_state=seed)
        .fit(x_tr, train["returned"]),
    }
    preds = {
        "logistic regression": models["logistic regression"].predict_proba(scaler.transform(x_te))[:, 1],
        "decision tree (depth 3)": models["decision tree (depth 3)"].predict_proba(x_te)[:, 1],
        "random forest": models["random forest"].predict_proba(x_te)[:, 1],
        "baseline: rate per category": test["category"].map(train.groupby("category")["returned"].mean())
        .fillna(train["returned"].mean()).to_numpy(),
    }
    y = test["returned"].to_numpy()
    rng = np.random.default_rng(seed)
    rows = {}
    for name, p in preds.items():
        boots = []
        for _ in range(n_boot):
            idx = rng.integers(0, len(y), len(y))
            if y[idx].min() != y[idx].max():
                boots.append(roc_auc_score(y[idx], p[idx]))
        rows[name] = {"AUC": roc_auc_score(y, p), "AUC_ci_low": np.percentile(boots, 2.5),
                      "AUC_ci_high": np.percentile(boots, 97.5), "Brier": brier_score_loss(y, p)}
    rows["baseline: overall rate"] = {"AUC": 0.5, "AUC_ci_low": 0.5, "AUC_ci_high": 0.5,
                                      "Brier": brier_score_loss(y, np.full(len(y), train["returned"].mean()))}
    info = {"train": len(train), "test": len(test), "train_rate": train["returned"].mean(),
            "test_rate": test["returned"].mean(), "models": models, "test_predictions": preds, "y_test": y}
    if importance:  # the notebook shows it; the nightly summary doesn't need it
        info["permutation_importance"] = pd.Series(
            permutation_importance(models["random forest"], x_te, y, scoring="roc_auc", n_repeats=30,
                                   random_state=seed).importances_mean, index=PREDICTORS).sort_values(ascending=False)
    return pd.DataFrame(rows).T, info
