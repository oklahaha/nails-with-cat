"""Customer segmentation: behaviour features, model-based clusters and rule-based RFM.

Features for a cut-off only use visits on or before it, so segments can be
built at a past date and checked against what customers did afterwards.

One-visit customers (about 40%) have no gaps and no repeat spend, and would
dominate any clustering, so they're segmented by a rule (`one_time_segment`)
and only repeat customers are clustered.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from analysis import clv as C
from analysis.features import BOTH, LASHES, NAILS

# One-visit customers seen this recently are "new", older ones "one-and-done"
NEW_CUSTOMER_DAYS = 60


def customer_features(days: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """Per customer, from visit days on or before `cutoff`:

    recency_days, visits, tenure_days, avg_spend (known 收費 only), the share
    of visits with nails / lashes / top-ups only, avg_gap_days (NaN with one
    visit), and MBG/NBD P(alive) and 12-month CLV fitted at the cut-off.
    """
    cutoff = pd.Timestamp(cutoff)
    d = days[days["date"] <= cutoff]
    g = d.groupby("customer_id")
    first, last = g["date"].min(), g["date"].max()
    visits = g.size()
    f = pd.DataFrame({
        "recency_days": (cutoff - last).dt.days,
        "visits": visits,
        "tenure_days": (cutoff - first).dt.days,
        "avg_spend": g["spend"].mean(),  # NaN-skipping: blank prices aren't zeros
        "share_nails": g["category"].agg(lambda c: c.isin([NAILS, BOTH]).mean()),
        "share_lashes": g["category"].agg(lambda c: c.isin([LASHES, BOTH]).mean()),
        "share_top_up": g["top_up_only"].mean(),
        # Mean gap = span / (visits − 1), the same as averaging the gaps
        "avg_gap_days": ((last - first).dt.days / (visits - 1)).where(visits > 1),
    })
    summary = C.rfm_summary(d, cutoff)
    bg = C.fit_bgnbd(summary, modified=True)
    f["p_alive"] = C.probability_alive(bg, summary)
    f["clv_12m"] = C.clv(bg, C.own_mean_spend(summary), summary, months=12)
    return f


# Columns clustered, and which get a log first (long right tails would
# otherwise let a few extreme customers decide the clusters)
CLUSTER_FEATURES = ["recency_days", "visits", "tenure_days", "avg_spend", "share_nails", "share_lashes",
                    "share_top_up", "avg_gap_days", "p_alive", "clv_12m"]
LOG_FEATURES = ["recency_days", "visits", "tenure_days", "avg_spend", "avg_gap_days", "clv_12m"]


def cluster_matrix(features: pd.DataFrame, scaler: StandardScaler | None = None
                   ) -> tuple[pd.DataFrame, StandardScaler]:
    """log1p the skewed columns, then standardise (mean 0, sd 1) so no unit dominates.

    Pass the scaler fitted on the training customers to transform others the
    same way. Customers with no known spend get the median spend.
    """
    x = features[CLUSTER_FEATURES].copy()
    x["avg_spend"] = x["avg_spend"].fillna(x["avg_spend"].median())
    for col in LOG_FEATURES:
        x[col] = np.log1p(x[col])
    if scaler is None:
        scaler = StandardScaler().fit(x)
    return pd.DataFrame(scaler.transform(x), index=x.index, columns=x.columns), scaler


def one_time_segment(features: pd.DataFrame) -> pd.Series:
    """Segment names for one-visit customers, by how recent the visit was."""
    one = features[features["visits"] == 1]
    return pd.Series(np.where(one["recency_days"] <= NEW_CUSTOMER_DAYS, "新客", "一次客"), index=one.index)


def rfm_scores(features: pd.DataFrame) -> pd.DataFrame:
    """R, F, M quintile scores 1–5 (5 = best: most recent, most visits, highest spend).

    Ranks break ties first, so the many customers with the same visit count
    still spread over the quintiles.
    """
    def quintile(values: pd.Series, best_high: bool) -> pd.Series:
        ranks = values.rank(method="first", ascending=best_high)
        return pd.qcut(ranks, 5, labels=False).astype(int) + 1

    spend = features["avg_spend"].fillna(features["avg_spend"].median())
    return pd.DataFrame({
        "R": quintile(features["recency_days"], best_high=False),
        "F": quintile(features["visits"], best_high=True),
        "M": quintile(spend, best_high=True),
    }, index=features.index)


def rfm_segment(scores: pd.DataFrame) -> pd.Series:
    """The common rule-based RFM segments, from R and F (M is shown but not used to name)."""
    r, f = scores["R"], scores["F"]
    rules = [
        ((r >= 4) & (f >= 4), "Champions"),
        ((r >= 3) & (f >= 4), "Loyal"),
        ((r >= 4) & (f <= 3), "Promising"),
        ((r <= 2) & (f >= 4), "At risk"),
        ((r == 3) & (f <= 3), "Need attention"),
    ]
    names = np.select([cond for cond, _ in rules], [name for _, name in rules], default="Hibernating")
    return pd.Series(names, index=scores.index)


def eta_squared(values: pd.Series, labels: pd.Series) -> float:
    """Share of the variance of `values` explained by the group labels (one-way ANOVA R²).

    Used to ask: how well do segments made at a cut-off separate what
    customers did afterwards? 0 = not at all, 1 = perfectly.
    """
    data = pd.DataFrame({"y": values, "g": labels}).dropna()
    total = ((data["y"] - data["y"].mean()) ** 2).sum()
    if total == 0:
        return 0.0
    group_means = data.groupby("g")["y"].transform("mean")
    return float(((group_means - data["y"].mean()) ** 2).sum() / total)


# k for k-means, chosen in notebooks/03 (silhouette is flat across k, and k = 5 gives
# segments that are distinct, nameable, and separate later behaviour best)
N_CLUSTERS = 5


def name_cluster(profile: pd.Series) -> str:
    """A business name for a cluster from its median profile.

    Cluster numbers change between fits, so names come from rules on the
    medians instead. Two clusters can get the same name, and then they're
    one segment.
    """
    # Recency and visit count, not P(alive): the drifting cluster's median P(alive)
    # crosses 0.5 at some cut-offs, while these thresholds hold at every one tried
    if profile["recency_days"] <= 60 and profile["visits"] >= 8:
        return "活躍熟客"  # active regulars: recent, frequent, most of the CLV
    if profile["share_lashes"] >= 0.5 and profile["share_top_up"] >= 0.3:
        return "睫毛試客"  # came to try lashes: a set, often a top-up soon after, then no more
    if profile["recency_days"] <= 365:
        return "疏遠中"  # drifting: seen this year but at long, irregular gaps
    if profile["share_lashes"] >= 0.5:
        return "流失睫毛客"  # lapsed lash customers
    return "流失甲客"  # lapsed nail customers


SEGMENT_DESCRIPTIONS = {
    "活躍熟客": "Active regulars: recent, frequent visits on a steady rhythm; most of the future revenue",
    "疏遠中": "Drifting: seen within the year, but with long irregular gaps; worth a nudge",
    "流失甲客": "Lapsed nail customers: regular once, not seen for a year or more",
    "流失睫毛客": "Lapsed lash customers: higher spend per visit, not seen for a year or more",
    "睫毛試客": "Lash triers: came to try lashes (a set, often a top-up soon after), not regulars who left",
    "新客": f"New: one visit within the last {NEW_CUSTOMER_DAYS} days",
    "一次客": "One-and-done: a single visit, longer ago",
}


def assign_segments(features: pd.DataFrame, k: int = N_CLUSTERS, seed: int = 0) -> pd.Series:
    """Segment name per customer: k-means on repeat customers, rules for one-visit ones."""
    from sklearn.cluster import KMeans

    repeat = features[features["visits"] >= 2]
    x, _ = cluster_matrix(repeat)
    labels = pd.Series(KMeans(k, n_init=20, random_state=seed).fit_predict(x), index=repeat.index)
    profiles = repeat.groupby(labels)[CLUSTER_FEATURES].median()
    names = profiles.apply(name_cluster, axis=1)
    return pd.concat([labels.map(names), one_time_segment(features)]).reindex(features.index)
