"""The 分析摘要 tab: small, chart-ready results for the app's 統計 → 洞察 view.

One long table, one row per number, so the app can add charts without the
sheet's layout changing: 項目 (what), 分類 / 子分類 (which group), 數值 with
its 95% interval (下限 / 上限) where there is one, and 人數 (how many rows or
customers it rests on, so the app can hide shaky numbers). Every item is
computed by the same code notebooks/04 uses.

Items (項目):

* gap_median: median days between visits per service (Kaplan–Meier, CI)
* never_return: share of visits after which the customer never came back
  (mixture cure model, CI), per service
* new_return: share of new customers back within 60 days, per first service
  and 全部 (Wilson CI); first visits in the last 2 years
* new_return_source: the same per 來源, once the column exists and a source
  has at least MIN_GROUP customers
* revenue_share: share of the last 12 months' revenue from the top 10 / 20 /
  50% of customers
* next_service: P(next visit's service | this visit's), last 2 years
* workload: booked hours per open day, per month (last 12); two_at_once: the
  share of open days with two bookings at the same time
* model_check: how the 60-day return model did on the last 6 months it can
  be checked on (the app shows it as "how much to trust these numbers")
* new_return_period (+ new_return_trend_p): new customers' return rate per
  half-year and the chi-square p-value for "it changed"
* first_visit_factor: odds ratio (CI) per first-visit feature;
  first_visit_model: the whole model's likelihood-ratio p and its AUC on
  later customers
* spend_per_visit: mean spend per visit day per full set, last 12 months (CI)
* price_list / price_paid / new_price_uptake: today's list price, the mean
  charged and the share charged at least the list, per full set, last 90 days
* addon_confidence / addon_lift: add-on rules (Apriori) seen 20+ times
* forecast_mae: weekly bookings error of the forecast vs the 4-week mean,
  rolling back-test over the last half-year
* segment_check: bootstrap stability of the segments and how much of the
  next 6 months they explain against RFM (η²)
* finding: one plain-language sentence per result (說明), worded by whether
  the result is significant. The app lists these generically, so a new
  analysis reaches the app by adding a finding, with no app or script change.

Every run recomputes all of it (run.py, nightly by cron).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import capacity as CP
from analysis import inference as INF
from analysis import returns as R
from analysis import sequences as SQ
from analysis import survival as SV
from analysis.clean import Frames
from analysis.features import inter_visit_gaps, visit_days
from analysis.retention import first_visits

CATEGORY_LABEL = {"nails": "整甲", "lashes": "眼睫毛", "both": "整甲 + 眼睫毛"}
# Groups smaller than this are left out: their rates would be noise
MIN_GROUP = 5
RECENT_YEARS = 2
NEXT_SERVICE_FROM = ["整甲", "眼睫毛", "整甲 + 眼睫毛", "補眼睫毛"]
MODEL_CHECK_CUTOFFS = 6

COLUMNS = ["item", "group", "subgroup", "value", "low", "high", "n", "text"]

FULL_SETS = ["整甲", "眼睫毛", "整甲 + 眼睫毛"]
PRICE_WINDOW_DAYS = 90
MIN_RULE_COUNT = 20
FORECAST_ORIGINS = 13

# first_visit.PREDICTORS in words, for the findings
PREDICTOR_LABEL = {
    "lashes": "第一次做眼睫毛", "both": "第一次做整甲 + 眼睫毛", "top_up_only": "第一次只做補",
    "spend_100": "第一次消費較高", "price_unknown": "收費未記錄", "weekend": "週末來", "evening": "晚上來",
    "q2": "4–6 月來", "q3": "7–9 月來", "q4": "10–12 月來", "has_phone": "有留電話",
    "deposit_paid": "有付訂金", "year_2025_on": "2025 年後的新客",
}


def _row(item, group, value, low=np.nan, high=np.nan, n=np.nan, subgroup="", text=""):
    return {"item": item, "group": group, "subgroup": subgroup, "value": value, "low": low, "high": high,
            "n": n, "text": text}


def gap_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    gaps = inter_visit_gaps(days, end)
    gaps = gaps[gaps["category"].isin(SV.MODEL_CATEGORIES)]
    rows = []
    for cat, r in INF.km_medians(gaps).iterrows():
        rows.append(_row("gap_median", CATEGORY_LABEL[cat], r["median_days"], r["ci_low"], r["ci_high"], r["gaps"]))
    for cat, r in SV.fit_cure(gaps).iterrows():
        rows.append(_row("never_return", CATEGORY_LABEL[cat], r["cured_fraction"], r["cured_ci_low"],
                         r["cured_ci_high"], r["gaps"]))
    return rows


def new_customer_rows(frames: Frames, days: pd.DataFrame) -> list[dict]:
    end = frames.observation_end
    f = first_visits(days)
    f = f[~f["left_truncated"] & (f["first_visit"] + pd.Timedelta(days=60) <= end)
          & (f["first_visit"] > end - pd.DateOffset(years=RECENT_YEARS))].copy()
    f["back"] = (f["second_visit"] - f["first_visit"]).dt.days.le(60)
    first_cat = days.sort_values("date").groupby("customer_id")["category"].first()
    f["first_service"] = first_cat.reindex(f.index).map(CATEGORY_LABEL)
    rows = []
    overall = INF.rate_table(f["back"], pd.Series("全部", index=f.index))
    by_service = INF.rate_table(f["back"], f["first_service"])
    for group, r in pd.concat([overall, by_service]).iterrows():
        if r["n"] >= MIN_GROUP:
            rows.append(_row("new_return", group, r["rate"], r["ci_low"], r["ci_high"], r["n"]))
    if "source" in frames.customers.columns:
        source = frames.customers.set_index("customer_id")["source"].reindex(f.index).fillna("")
        known = source != ""
        for group, r in INF.rate_table(f.loc[known, "back"], source[known]).iterrows():
            if r["n"] >= MIN_GROUP:
                rows.append(_row("new_return_source", group, r["rate"], r["ci_low"], r["ci_high"], r["n"]))
    return rows


def revenue_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    last = days[days["date"] > end - pd.Timedelta(days=365)]
    conc = INF.concentration(last.groupby("customer_id")["spend"].sum())
    return [_row("revenue_share", f"頭 {pct}%", conc[f"top_{pct}pct_share"], n=conc["customers"])
            for pct in (10, 20, 50)]


def next_service_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    recent = days[days["date"] > end - pd.DateOffset(years=RECENT_YEARS)]
    counts, _ = SQ.transition_matrix(recent, min_count=1)
    rows = []
    for source in NEXT_SERVICE_FROM:
        if source not in counts.index or counts.loc[source].sum() < MIN_GROUP * 4:
            continue
        line = counts.loc[source]
        total = int(line.sum())
        for target, count in line[line > 0].sort_values(ascending=False).items():
            rows.append(_row("next_service", source, count / total, n=total, subgroup=target))
    return rows


def workload_rows(frames: Frames) -> list[dict]:
    end = frames.observation_end
    load = CP.daily_load(frames.visits, end=end)
    start = (end.to_period("M") - 11).start_time  # this month and the 11 before it
    load = load[load.index >= start]
    open_days = load[load["open"]]
    rows = []
    for month, g in open_days.groupby(open_days.index.to_period("M")):
        label = str(month)
        rows.append(_row("workload", label, g["booked_hours"].mean(), n=len(g)))
        rows.append(_row("two_at_once", label, (g["max_overlap"] >= 2).mean(), n=len(g)))
    return rows


def model_check_rows(days: pd.DataFrame, end: pd.Timestamp, landmarks: pd.DataFrame | None = None) -> list[dict]:
    """Out-of-sample check of P(return within 60 days) at the last MODEL_CHECK_CUTOFFS monthly cut-offs."""
    from sklearn.metrics import roc_auc_score

    cutoffs = [end - pd.Timedelta(days=60 + 30 * m) for m in range(MODEL_CHECK_CUTOFFS)]
    bt = R.backtest(days, cutoffs, horizons=[R.CHURN_HORIZON_DAYS], landmarks=landmarks)
    p, y = f"p_{R.CHURN_HORIZON_DAYS}", f"y_{R.CHURN_HORIZON_DAYS}"
    bt = bt[bt["days_since_last_visit"] <= 365].dropna(subset=[y])
    likely = bt[p] >= R.CHURN_THRESHOLD
    return [
        _row("model_check", "預計會回來", bt.loc[likely, y].mean(), n=int(likely.sum())),
        _row("model_check", "預計不會回來", bt.loc[~likely, y].mean(), n=int((~likely).sum())),
        _row("model_check", "AUC", roc_auc_score(bt[y], bt[p]), n=len(bt)),
    ]


def new_return_trend_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    """New customers' 60-day return rate per half-year (last 3 years), and a chi-square test across them."""
    f = first_visits(days)
    f = f[~f["left_truncated"] & (f["first_visit"] + pd.Timedelta(days=60) <= end)
          & (f["first_visit"] > end - pd.DateOffset(years=3))].copy()
    f["back"] = (f["second_visit"] - f["first_visit"]).dt.days.le(60)
    half = np.where(f["first_visit"].dt.month <= 6, "上半年", "下半年")
    f["period"] = f["first_visit"].dt.year.astype(str) + " " + half
    table = INF.rate_table(f["back"], f["period"])
    table = table[table["n"] >= MIN_GROUP * 2]
    rows = [_row("new_return_period", period, r["rate"], r["ci_low"], r["ci_high"], r["n"])
            for period, r in table.sort_index().iterrows()]
    if len(table) >= 2:
        test = INF.chi_square(pd.crosstab(f.loc[f["period"].isin(table.index), "period"], f["back"]))
        rows.append(_row("new_return_trend_p", "chi-square", test["p_value"], n=test["n"]))
    return rows


def first_visit_rows(frames: Frames) -> list[dict]:
    """What about a first visit predicts a return: odds ratios, the model's p-value and test AUC."""
    from analysis import first_visit as FV

    table = FV.first_visit_table(frames)
    odds, model = FV.odds_ratios(table)
    rows = [_row("first_visit_factor", PREDICTOR_LABEL.get(name, name), r["odds_ratio"], r["ci_low"], r["ci_high"],
                 len(table), subgroup=name) for name, r in odds.iterrows()]
    rows.append(_row("first_visit_model", "LLR p", model.llr_pvalue, n=len(table)))
    comparison, info = FV.compare_models(table, n_boot=200, importance=False)
    lr = comparison.loc["logistic regression"]
    rows.append(_row("first_visit_model", "AUC", lr["AUC"], lr["AUC_ci_low"], lr["AUC_ci_high"], info["test"]))
    return rows


def spend_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    """Mean spend per visit day with a full set, per category, last 12 months (t interval)."""
    from scipy import stats

    last = days[(days["date"] > end - pd.Timedelta(days=365)) & days["has_full_set"] & days["spend"].notna()]
    rows = []
    for cat, g in last.groupby("category"):
        if cat not in CATEGORY_LABEL or len(g) < MIN_GROUP:
            continue
        mean, sem = g["spend"].mean(), stats.sem(g["spend"])
        half = stats.t.ppf(0.975, len(g) - 1) * sem if len(g) > 1 else np.nan
        rows.append(_row("spend_per_visit", CATEGORY_LABEL[cat], mean, mean - half, mean + half, len(g)))
    return rows


def price_rows(frames: Frames) -> list[dict]:
    """Today's list price vs what was charged in the last PRICE_WINDOW_DAYS, per full set (手)."""
    from analysis import pricing as PR

    end = frames.observation_end
    v = frames.visits
    v = v[(v["date"] > end - pd.Timedelta(days=PRICE_WINDOW_DAYS)) & v["service"].isin(FULL_SETS)
          & (v["hand_foot"] == "手") & v["price"].notna()].copy()
    if v.empty:
        return []
    v["list_price"] = PR.list_price(v)
    base_list = {"整甲": PR.NAIL_HAND_FOOT_PRICE["手"], "眼睫毛": PR.BASE_PRICE["眼睫毛"],
                 "整甲 + 眼睫毛": PR.BASE_PRICE["整甲 + 眼睫毛"]}
    rows = []
    for service, g in v.groupby("service"):
        rows.append(_row("price_list", service, base_list[service], n=len(g)))
        rows.append(_row("price_paid", service, g["price"].mean(), n=len(g)))
        rows.append(_row("new_price_uptake", service, (g["price"] >= g["list_price"]).mean(), n=len(g)))
    return rows


def addon_rows(frames: Frames) -> list[dict]:
    baskets = SQ.add_on_baskets(frames.visits)
    if len(baskets) < MIN_RULE_COUNT:
        return []
    rules = SQ.association_rules(baskets, min_support=0.005, min_confidence=0.0)
    rules = rules[rules["count"] >= MIN_RULE_COUNT]
    rows = []
    for r in rules.itertuples():
        rows.append(_row("addon_confidence", r[1], r.confidence, n=r.count, subgroup=r.then))
        rows.append(_row("addon_lift", r[1], r.lift, n=r.count, subgroup=r.then))
    return rows


def forecast_rows(frames: Frames) -> list[dict]:
    """Rolling-origin MAE (bookings / week, 1–8 weeks ahead) of the final model and the 4-week mean."""
    from analysis import forecast as F

    end = frames.observation_end
    weekly = F.weekly_series(frames.visits, F.BOOKINGS_START, end)
    y = weekly["bookings"].astype(float)
    exog = F.exog_frame(frames.appointments, weekly.index)
    origins = list(y.index[-(8 + 2 * FORECAST_ORIGINS):-8:2])
    models = {"預測模型": F.sarimax(F.ORDER, F.EXOG_COLS), "最近 4 週平均": F.mean_last_4}
    errors = F.error_table(F.rolling_origin(y, exog, models, origins, 8), min_actual_for_mape=5)
    return [_row("forecast_mae", name, r["MAE"], n=r["forecasts"]) for name, r in errors.iterrows()]


def segment_rows(days: pd.DataFrame, end: pd.Timestamp) -> list[dict]:
    """Segment stability (bootstrap ARI) and η² of the next 6 months' visits: segments vs RFM, cut 6 months back."""
    from sklearn.cluster import KMeans
    from sklearn.metrics import adjusted_rand_score

    from analysis import segments as SG

    feats = SG.customer_features(days, end)
    x, _ = SG.cluster_matrix(feats[feats["visits"] >= 2])
    x = x.to_numpy()
    full = KMeans(SG.N_CLUSTERS, n_init=20, random_state=0).fit(x)
    rng = np.random.default_rng(0)
    aris = [adjusted_rand_score(full.labels_, KMeans(SG.N_CLUSTERS, n_init=10, random_state=b)
                                .fit(x[rng.integers(0, len(x), len(x))]).predict(x)) for b in range(20)]
    cut = end - pd.Timedelta(days=182)
    fc = SG.customer_features(days, cut)
    after = days[(days["date"] > cut) & (days["date"] <= cut + pd.Timedelta(days=182))]
    visits_after = after.groupby("customer_id").size().reindex(fc.index).fillna(0)
    return [
        _row("segment_check", "穩定度", float(np.mean(aris)), n=len(x)),
        _row("segment_check", "分群解釋力", SG.eta_squared(visits_after, SG.assign_segments(fc)), n=len(fc)),
        _row("segment_check", "RFM 解釋力", SG.eta_squared(visits_after, SG.rfm_segment(SG.rfm_scores(fc))), n=len(fc)),
    ]


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def findings(rows: pd.DataFrame) -> list[dict]:
    """Plain-language sentences for the app, worded by significance. Order = how prominent."""
    get = lambda item: rows[rows["item"] == item].set_index("group")  # noqa: E731
    out: list[tuple[str, str]] = []

    gaps = get("gap_median")
    if {"整甲", "眼睫毛"} <= set(gaps.index):
        n, l = gaps.loc["整甲"], gaps.loc["眼睫毛"]
        if l["high"] < n["low"]:
            out.append(("回訪節奏", f"眼睫毛顧客平均約 {l['value']:.0f} 日回來，比整甲（約 {n['value']:.0f} 日）快。"))
        else:
            out.append(("回訪節奏", f"整甲約 {n['value']:.0f} 日、眼睫毛約 {l['value']:.0f} 日回來一次，分別不大。"))
    never = get("never_return")
    if len(never):
        out.append(("流失", f"每次做完，約 {round(never['value'].min() * 100)}–{_pct(never['value'].max())} 的顧客之後沒有再來。"))

    trend = get("new_return_period")
    p = get("new_return_trend_p")
    if len(trend) >= 2:
        first, last = trend.iloc[0], trend.iloc[-1]
        if len(p) and p["value"].iloc[0] < 0.05:
            direction = "下降" if last["value"] < first["value"] else "上升"
            out.append(("新客", f"新客 60 日內回頭率明顯{direction}：由 {trend.index[0]} 的 {_pct(first['value'])} "
                                f"變為 {trend.index[-1]} 的 {_pct(last['value'])}。"))
        else:
            overall = get("new_return")
            rate = _pct(overall.loc["全部", "value"]) if "全部" in overall.index else _pct(last["value"])
            out.append(("新客", f"約 {rate} 新客會在 60 日內回來；近年的升跌未算明顯，可能只是隨機波動。"))

    factors = get("first_visit_factor")
    model = get("first_visit_model")
    significant = factors[(factors["low"] > 1) | (factors["high"] < 1)] if len(factors) else factors
    for label, r in significant.iterrows():
        more = r["value"] > 1
        out.append(("新客", f"{label}的新客較{'常' if more else '少'}回頭"
                            f"（機會約 {r['value']:.1f} 倍{'，人數少，僅供參考' if r['high'] / max(r['low'], 1e-9) > 5 else ''}）。"))
    if "LLR p" in model.index and model.loc["LLR p", "value"] >= 0.05:
        out.append(("新客", "其他第一次來店的記錄（時段、收費、訂金等）都看不出誰會回頭；記錄「來源」可助找出原因。"))
    sources = get("new_return_source")
    if len(sources) >= 2:
        best = sources["value"].idxmax()
        out.append(("來源", f"來自「{best}」的新客回頭率最高（{_pct(sources.loc[best, 'value'])}，{int(sources.loc[best, 'n'])} 位）。"))

    shares = get("revenue_share")
    if "頭 20%" in shares.index:
        out.append(("收入", f"消費最多的 20% 顧客帶來 {_pct(shares.loc['頭 20%', 'value'])} 收入。"))
    spend = get("spend_per_visit")
    if len(spend) >= 2:
        parts = "、".join(f"{k} ${v:.0f}" for k, v in spend["value"].items())
        out.append(("收入", f"過去 12 個月每次平均消費：{parts}。"))

    uptake = get("new_price_uptake")
    if len(uptake):
        lists = get("price_list")
        parts = "、".join(f"{k}（${lists.loc[k, 'value']:.0f}）{_pct(v)}" for k, v in uptake["value"].items()
                          if k in lists.index)
        out.append(("收費", f"最近 {PRICE_WINDOW_DAYS} 日按新價收費的預約：{parts}。"))

    nxt = rows[rows["item"] == "next_service"]
    lash = nxt[(nxt["group"] == "眼睫毛") & nxt["subgroup"].isin(["整甲", "整甲 + 眼睫毛"])]["value"].sum()
    nail = nxt[(nxt["group"] == "整甲") & nxt["subgroup"].isin(["眼睫毛", "整甲 + 眼睫毛", "補眼睫毛"])]["value"].sum()
    if len(nxt):
        out.append(("服務", f"做眼睫毛的顧客，下次有 {_pct(lash)} 轉做整甲或整甲 + 眼睫毛；"
                            f"做整甲的只有 {_pct(nail)} 下次試眼睫毛。"))
    lifts = rows[(rows["item"] == "addon_lift") & ((rows["value"] < 0.8) | (rows["value"] > 1.25))]
    conf = rows[rows["item"] == "addon_confidence"].set_index(["group", "subgroup"])["value"]
    seen: set[frozenset] = set()
    # A → B and B → A share a lift; say it once, from the side with the higher confidence
    for r in lifts.assign(conf=[conf.get((g, sg), 0) for g, sg in zip(lifts["group"], lifts["subgroup"])]) \
            .sort_values("conf", ascending=False).itertuples():
        pair = frozenset((r.group, r.subgroup))
        if pair in seen:
            continue
        seen.add(pair)
        c = conf.get((r.group, r.subgroup))
        if c is not None:
            out.append(("服務", f"選「{r.group}」的預約，有 {_pct(c)} 同時「{r.subgroup}」，"
                                f"比一般{'少' if r.value < 1 else '多'}。"))

    load = get("workload")
    load = load[load["n"] >= 8].sort_index()
    if len(load) >= 6:
        recent, before = load["value"].iloc[-3:].mean(), load["value"].iloc[-6:-3].mean()
        change = recent - before
        word = "多" if change > 0 else "少"
        out.append(("工作量", f"最近 3 個月每個開工日平均預約 {recent:.1f} 小時，比之前 3 個月{word} {abs(change):.1f} 小時。"))

    check = get("model_check")
    if {"預計會回來", "預計不會回來"} <= set(check.index):
        out.append(("預測", f"估計會回來的顧客，實際 {_pct(check.loc['預計會回來', 'value'])} 有回來；"
                            f"估計不會回來的只有 {_pct(check.loc['預計不會回來', 'value'])}。"))
    mae = get("forecast_mae")
    if {"預測模型", "最近 4 週平均"} <= set(mae.index):
        m, b = mae.loc["預測模型", "value"], mae.loc["最近 4 週平均", "value"]
        better = (b - m) / b
        out.append(("預測", f"每週預約預測平均誤差約 {m:.1f} 個"
                            + (f"，比單看最近 4 週平均準 {_pct(better)}。" if better > 0 else "，與最近 4 週平均相若。")))
    seg = get("segment_check")
    if {"分群解釋力", "RFM 解釋力"} <= set(seg.index):
        a, b = seg.loc["分群解釋力", "value"], seg.loc["RFM 解釋力", "value"]
        out.append(("分群", f"顧客分群比傳統 RFM 分類更能預示未來半年的來店次數（{_pct(a)} 對 {_pct(b)}）。"
                    if a > b else f"顧客分群與傳統 RFM 分類同樣能預示未來半年的來店次數。"))

    return [_row("finding", title, i + 1, text=text) for i, (title, text) in enumerate(out)]


def summary_rows(frames: Frames, landmarks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Every 分析摘要 row for this run, then the findings worded from them.

    A failing section is logged and skipped, so one problem can't stop the
    rest (or the customer scores) from reaching the app; it also becomes a
    finding, so 洞察 says something is missing instead of dropping it quietly.
    `landmarks` is the frame run.py already built for the scores.
    """
    end = frames.observation_end
    days = visit_days(frames.visits)
    sections = [
        lambda: gap_rows(days, end), lambda: new_customer_rows(frames, days), lambda: revenue_rows(days, end),
        lambda: next_service_rows(days, end), lambda: workload_rows(frames),
        lambda: model_check_rows(days, end, landmarks),
        lambda: new_return_trend_rows(days, end), lambda: first_visit_rows(frames), lambda: spend_rows(days, end),
        lambda: price_rows(frames), lambda: addon_rows(frames), lambda: forecast_rows(frames),
        lambda: segment_rows(days, end),
    ]
    rows: list[dict] = []
    failed = 0
    for section in sections:
        try:
            rows += section()
        except Exception as e:  # noqa: BLE001 - keep the nightly run going
            failed += 1
            print(f"summary section failed, skipped: {e!r}")
    table = pd.DataFrame(rows, columns=COLUMNS)
    found = findings(table)
    if failed:
        found.append(_row("finding", "注意", len(found) + 1,
                          text=f"今晚有 {failed} 項分析未能完成，其餘照常更新；詳情見伺服器的 data/cron.log。"))
    return pd.concat([table, pd.DataFrame(found, columns=COLUMNS)], ignore_index=True)
