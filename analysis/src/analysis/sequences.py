"""Which service follows which, and which add-ons go together (notebooks/04).

Classic market-basket association rules (Apriori) need baskets with many
items. A visit here has one or two services, so rules over services would
only restate the top-up rule. Two better-suited questions:

* transitions: a first-order Markov chain over each customer's consecutive
  visit days (整甲 → 補甲 → 整甲 …): P(next service | this one). The diagonal
  shows loyalty to a service; off-diagonal cells show cross-selling.
* add-on rules: Apriori on the 整甲 add-ons (複雜款, 延長, 拆甲) and the lash
  combo, recorded from 2025, which do form small baskets. Support,
  confidence and lift as in COM6004 Ch6 (Tan et al.): lift > 1 means the
  items appear together more often than if they were independent.
"""

from __future__ import annotations

from itertools import combinations

import pandas as pd

# Visit-day label: the day's main service (a full set wins over a top-up)
ORDER = ["整甲 + 眼睫毛", "整甲", "眼睫毛", "補甲", "補眼睫毛", "拆甲", "拆眼睫毛", "粉嫩術"]


def day_label(services: str) -> str:
    parts = services.split(" / ")
    for name in ORDER:
        if name in parts:
            return name
    return "其他"


def transition_matrix(days: pd.DataFrame, min_count: int = 10) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Counts and row-normalised P(next visit's label | this visit's label).

    Rows with fewer than `min_count` transitions are dropped from the
    probabilities (their rates would be noise).
    """
    d = days.sort_values(["customer_id", "date"]).copy()
    d["label"] = d["services"].map(day_label)
    d["next_label"] = d.groupby("customer_id")["label"].shift(-1)
    pairs = d.dropna(subset=["next_label"])
    counts = pd.crosstab(pairs["label"], pairs["next_label"])
    probs = counts.div(counts.sum(axis=1), axis=0)
    return counts, probs[counts.sum(axis=1) >= min_count]


def add_on_baskets(visits: pd.DataFrame) -> pd.DataFrame:
    """One basket (bool columns) per 整甲 / 整甲 + 眼睫毛 booking for 手 with add-ons recorded."""
    v = visits[visits["service"].isin(["整甲", "整甲 + 眼睫毛"]) & (visits["hand_foot"] == "手")
               & visits["removal"].notna()]
    return pd.DataFrame({
        "複雜款(半個鐘)": v["complex_design"] == "半個鐘",
        "複雜款(一個鐘)": v["complex_design"] == "一個鐘",
        "延長": v["extension"].fillna(False).astype(bool),
        "拆甲": v["removal"].fillna(False).astype(bool),
        "+眼睫毛": v["service"] == "整甲 + 眼睫毛",
    }, index=v.index)


def apriori(baskets: pd.DataFrame, min_support: float = 0.01) -> pd.DataFrame:
    """Frequent itemsets by the Apriori principle: a k-itemset is a candidate only if
    all its (k−1)-subsets are frequent. Returns itemset (tuple) and support."""
    x = baskets.to_numpy(bool)
    items = list(baskets.columns)
    support = lambda idx: x[:, list(idx)].all(axis=1).mean()
    frequent = {(i,): support((i,)) for i in range(len(items)) if support((i,)) >= min_support}
    level = list(frequent)
    while level:
        candidates = set()
        for a, b in combinations(level, 2):
            union = tuple(sorted(set(a) | set(b)))
            if len(union) == len(a) + 1 and all(sub in frequent for sub in combinations(union, len(union) - 1)):
                candidates.add(union)
        level = []
        for c in candidates:
            s = support(c)
            if s >= min_support:
                frequent[c] = s
                level.append(c)
    return pd.DataFrame([{"itemset": tuple(items[i] for i in k), "support": s} for k, s in frequent.items()])


def association_rules(baskets: pd.DataFrame, min_support: float = 0.01, min_confidence: float = 0.1) -> pd.DataFrame:
    """Rules A → B from the frequent itemsets: support, confidence = s(A∪B)/s(A), lift = conf / s(B)."""
    freq = apriori(baskets, min_support)
    s = {frozenset(row.itemset): row.support for row in freq.itertuples()}
    rows = []
    for itemset, sup in s.items():
        if len(itemset) < 2:
            continue
        for r in range(1, len(itemset)):
            for lhs in combinations(sorted(itemset), r):
                lhs = frozenset(lhs)
                rhs = itemset - lhs
                conf = sup / s[lhs]
                if conf >= min_confidence:
                    rows.append({"if": " + ".join(sorted(lhs)), "then": " + ".join(sorted(rhs)), "support": sup,
                                 "confidence": conf, "lift": conf / s[rhs], "count": int(round(sup * len(baskets)))})
    cols = ["if", "then", "support", "confidence", "lift", "count"]
    return pd.DataFrame(rows, columns=cols).sort_values("lift", ascending=False).reset_index(drop=True)


