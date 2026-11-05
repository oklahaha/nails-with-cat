import numpy as np
import pandas as pd

from analysis.summary import COLUMNS, findings


def _table(rows):
    full = [{"item": i, "group": g, "subgroup": sg, "value": v, "low": lo, "high": hi, "n": n, "text": ""}
            for i, g, sg, v, lo, hi, n in rows]
    return pd.DataFrame(full, columns=COLUMNS)


def _texts(rows):
    return [r["text"] for r in findings(_table(rows))]


def test_rhythm_is_called_faster_only_when_the_intervals_dont_overlap():
    faster = _texts([("gap_median", "整甲", "", 36, 35, 37, 100), ("gap_median", "眼睫毛", "", 29, 27, 32, 100)])
    assert any("比整甲" in t and "快" in t for t in faster)
    overlap = _texts([("gap_median", "整甲", "", 36, 30, 40, 100), ("gap_median", "眼睫毛", "", 33, 28, 38, 100)])
    assert any("分別不大" in t for t in overlap)


def test_trend_is_called_a_change_only_when_significant():
    periods = [("new_return_period", "2025 上半年", "", 0.5, 0.4, 0.6, 50),
               ("new_return_period", "2026 上半年", "", 0.3, 0.2, 0.4, 50),
               ("new_return", "全部", "", 0.4, 0.35, 0.45, 100)]
    assert any("明顯下降" in t for t in _texts(periods + [("new_return_trend_p", "chi-square", "", 0.01, np.nan, np.nan, 100)]))
    calm = _texts(periods + [("new_return_trend_p", "chi-square", "", 0.4, np.nan, np.nan, 100)])
    assert not any("明顯下降" in t or "明顯上升" in t for t in calm) and any("隨機波動" in t for t in calm)


def test_first_visit_factors_only_when_their_interval_excludes_one():
    texts = _texts([
        ("first_visit_factor", "第一次做整甲 + 眼睫毛", "both", 6.8, 1.4, 32.3, 528),
        ("first_visit_factor", "週末來", "weekend", 0.9, 0.6, 1.3, 528),
        ("first_visit_model", "LLR p", "", 0.16, np.nan, np.nan, 528),
    ])
    assert any(t.startswith("第一次做整甲 + 眼睫毛") and "僅供參考" in t for t in texts)
    assert not any("週末來" in t for t in texts)
    assert any("記錄「來源」" in t for t in texts)


def test_add_on_rule_is_said_once_per_pair_and_findings_are_ordered():
    rows = _table([
        ("addon_confidence", "延長", "拆甲", 0.55, np.nan, np.nan, 52),
        ("addon_confidence", "拆甲", "延長", 0.04, np.nan, np.nan, 52),
        ("addon_lift", "延長", "拆甲", 0.59, np.nan, np.nan, 52),
        ("addon_lift", "拆甲", "延長", 0.59, np.nan, np.nan, 52),
        ("revenue_share", "頭 20%", "", 0.57, np.nan, np.nan, 191),
    ])
    out = findings(rows)
    assert [r["value"] for r in out] == list(range(1, len(out) + 1))
    rules = [r["text"] for r in out if "延長" in r["text"]]
    assert rules == ["選「延長」的預約，有 55% 同時「拆甲」，比一般少。"]


def test_a_failing_section_becomes_a_finding(monkeypatch):
    from types import SimpleNamespace

    import analysis.summary as S

    monkeypatch.setattr(S, "visit_days", lambda visits: pd.DataFrame())
    for name in ["gap_rows", "new_customer_rows", "revenue_rows", "next_service_rows", "workload_rows",
                 "model_check_rows", "new_return_trend_rows", "first_visit_rows", "spend_rows", "price_rows",
                 "addon_rows", "segment_rows"]:
        monkeypatch.setattr(S, name, lambda *a, **k: [])

    def broken(*_):
        raise ValueError("boom")

    monkeypatch.setattr(S, "forecast_rows", broken)
    out = S.summary_rows(SimpleNamespace(observation_end=pd.Timestamp("2026-11-03"), visits=None))
    notes = out[(out["item"] == "finding") & (out["group"] == "注意")]["text"].tolist()
    assert notes == ["今晚有 1 項分析未能完成，其餘照常更新；詳情見伺服器的 data/cron.log。"]
