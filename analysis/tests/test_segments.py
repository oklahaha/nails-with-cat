import numpy as np
import pandas as pd
import pytest

from analysis.segments import (
    cluster_matrix,
    customer_features,
    eta_squared,
    one_time_segment,
    rfm_scores,
    rfm_segment,
)
from conftest import make_days


def _days():
    return make_days([
        ("a", "2023-01-01", 200, "nails"), ("a", "2023-01-31", None, "lashes", True), ("a", "2023-03-02", 400, "both"),
        ("b", "2023-03-20", 100, "lashes"),
        ("c", "2022-06-01", 300, "nails"),
        ("late", "2023-05-01", 100, "nails"),  # after the cut-off
    ])


def test_customer_features_use_only_visits_before_the_cutoff():
    f = customer_features(_days(), pd.Timestamp("2023-03-31"))
    assert "late" not in f.index
    a = f.loc["a"]
    assert a["visits"] == 3 and a["recency_days"] == 29 and a["tenure_days"] == 89
    assert a["avg_spend"] == 300  # the blank price is skipped, not counted as 0
    assert a["share_nails"] == pytest.approx(2 / 3) and a["share_lashes"] == pytest.approx(2 / 3)
    assert a["share_top_up"] == pytest.approx(1 / 3)
    assert a["avg_gap_days"] == 30  # Jan 1 → Jan 31 → Mar 2
    assert np.isnan(f.loc["b", "avg_gap_days"])
    assert f["p_alive"].between(0, 1).all() and (f["clv_12m"] >= 0).all()


def test_one_time_segment_by_recency():
    f = customer_features(_days(), pd.Timestamp("2023-03-31"))
    assert one_time_segment(f).to_dict() == {"b": "新客", "c": "一次客"}


def test_cluster_matrix_reuses_the_training_scaler():
    f = customer_features(_days(), pd.Timestamp("2023-03-31"))
    x, scaler = cluster_matrix(f)
    assert x.mean().abs().max() < 1e-9
    again, _ = cluster_matrix(f, scaler)
    pd.testing.assert_frame_equal(x, again)


def test_rfm_scores_and_segments():
    f = pd.DataFrame({"recency_days": [1, 10, 100, 200, 400], "visits": [20, 2, 15, 1, 1],
                      "avg_spend": [300, 200, np.nan, 100, 50]}, index=list("vwxyz"))
    s = rfm_scores(f)
    assert s.loc["v"].tolist() == [5, 5, 5]
    assert s.loc["z", "R"] == 1
    seg = rfm_segment(s)
    assert seg["v"] == "Champions"
    assert seg["x"] == "Loyal"  # R 3, F 4
    assert seg["z"] == "Hibernating"


def test_name_cluster_rules():
    from analysis.segments import name_cluster

    base = {"recency_days": 30, "visits": 20, "share_lashes": 0.1, "share_top_up": 0.0, "p_alive": 0.95}
    assert name_cluster(pd.Series(base)) == "活躍熟客"
    # A drifting cluster can have P(alive) above 0.5 and still not be active
    assert name_cluster(pd.Series(base | {"recency_days": 133, "visits": 4, "p_alive": 0.63})) == "疏遠中"
    assert name_cluster(pd.Series(base | {"recency_days": 269, "visits": 2, "share_lashes": 1.0,
                                          "share_top_up": 0.5})) == "睫毛試客"
    assert name_cluster(pd.Series(base | {"recency_days": 663, "visits": 3, "share_lashes": 0.86})) == "流失睫毛客"
    assert name_cluster(pd.Series(base | {"recency_days": 732, "visits": 4})) == "流失甲客"
