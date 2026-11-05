import numpy as np
import pandas as pd
import pytest

from analysis import capacity as CP
from analysis import pricing as PR
from analysis import sequences as SQ
from analysis.survival import fit_cure
from conftest import make_days


def test_max_overlap():
    t = lambda h: pd.Timestamp("2025-01-01") + pd.Timedelta(hours=h)
    assert CP.max_overlap(pd.Series([t(10), t(11), t(14)]), pd.Series([t(12), t(13), t(15)])) == 2
    # back to back isn't an overlap: the end sorts before the next start
    assert CP.max_overlap(pd.Series([t(10), t(12)]), pd.Series([t(12), t(14)])) == 1


def _visit(service, date, customer="a", hand_foot="手", complex_design="不是複雜款", removal=False, extension=False):
    return {"service": service, "date": pd.Timestamp(date), "customer_id": customer, "hand_foot": hand_foot,
            "complex_design": complex_design, "removal": removal, "extension": extension}


def test_list_price_follows_the_app_rules():
    v = pd.DataFrame([
        _visit("整甲", "2025-01-01", complex_design="半個鐘", extension=True),  # 218 + 60 + 100
        _visit("整甲", "2025-01-02", hand_foot="腳", extension=True),  # 腳: 298, no add-ons
        _visit("整甲 + 眼睫毛", "2025-01-03", removal=True),  # 218 + 428, removal free
        _visit("眼睫毛", "2025-02-01", customer="b"),
        _visit("補眼睫毛", "2025-02-04", customer="b"),  # within 5 days: 0
        _visit("補眼睫毛", "2025-02-12", customer="b"),  # 11 days after the set: 214
        _visit("補眼睫毛", "2025-03-30", customer="b"),  # long after: 428
        _visit("補甲", "2025-01-20"),  # 18 days after 整甲 + 眼睫毛: 30
    ])
    assert PR.list_price(v).tolist() == [378, 298, 646, 428, 0, 214, 428, 30]


def test_apriori_and_rules_on_the_textbook_example():
    # Tan et al. Ch6 market baskets
    items = ["Bread", "Milk", "Diaper", "Beer", "Eggs", "Coke"]
    tx = [{"Bread", "Milk"}, {"Bread", "Diaper", "Beer", "Eggs"}, {"Milk", "Diaper", "Beer", "Coke"},
          {"Bread", "Milk", "Diaper", "Beer"}, {"Bread", "Milk", "Diaper", "Coke"}]
    baskets = pd.DataFrame([{i: i in t for i in items} for t in tx])
    freq = SQ.apriori(baskets, min_support=0.6).set_index("itemset")["support"]
    # Itemsets list items in column order; {Milk, Diaper} is in 3 of 5 baskets
    assert freq[("Milk", "Diaper")] == pytest.approx(0.6)
    assert ("Milk", "Beer") not in freq  # support 0.4 < 0.6
    rules = SQ.association_rules(baskets, min_support=0.4, min_confidence=0.0)
    r = rules[(rules["if"] == "Diaper + Milk") & (rules["then"] == "Beer")].iloc[0]
    assert r["support"] == pytest.approx(0.4)
    assert r["confidence"] == pytest.approx(2 / 3)
    assert r["lift"] == pytest.approx((2 / 3) / 0.6)


def test_transition_matrix_rows_sum_to_one():
    days = make_days([("a", "2023-01-01", 200), ("a", "2023-02-01", 30), ("a", "2023-03-01", 200)])
    days["services"] = ["整甲", "補甲", "整甲"]
    counts, probs = SQ.transition_matrix(days, min_count=1)
    assert counts.loc["整甲", "補甲"] == 1 and counts.loc["補甲", "整甲"] == 1
    assert np.allclose(probs.sum(axis=1), 1)


def test_cure_model_recovers_the_never_returning_share():
    rng = np.random.default_rng(0)
    n = 3000
    cured = rng.random(n) < 0.3
    t = rng.weibull(2.0, n) * 40
    durations = np.where(cured, 400.0, np.minimum(t, 400.0))
    gaps = pd.DataFrame({"category": "nails", "gap_days": durations, "event": (~cured & (t < 400)).astype(int)})
    out = fit_cure(gaps).loc["nails"]
    assert out["cured_fraction"] == pytest.approx(0.3, abs=0.04)
    assert out["aic_cure"] < out["aic_weibull"]
