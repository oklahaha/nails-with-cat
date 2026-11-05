"""Run the pipeline: `uv run python -m analysis.run [--refresh] [--observation-end YYYY-MM-DD]`.

Fetches the source sheet (read-only), cleans it, prints the data-quality
report and saves the cleaned frames to data/processed/ for the notebooks
(Phase 1), scores every customer for return, churn and CLV (Phase 2), and
adds segments and the weekly forecast (Phase 3) and the summary numbers for
the app's 洞察 view (Phase 5), then writes the 客人分析, 預測 and 分析摘要 tabs
of the separate results spreadsheet (Phase 4; skip with --no-write). Add --refresh to fetch the latest data first, as a scheduled
run should.
"""

from __future__ import annotations

import argparse
from datetime import date

import pandas as pd

from analysis import quality
from analysis.forecast import final_forecast
from analysis.results_sheet import (
    CUSTOMERS_TAB,
    FORECAST_TAB,
    SUMMARY_TAB,
    customer_table,
    forecast_table,
    summary_table,
    run_timestamp,
    write_results,
)
from analysis.features import visit_days
from analysis.returns import landmark_frame
from analysis.scores import customer_scores
from analysis.summary import summary_rows
from analysis.config import load_settings
from analysis.pipeline import load_frames


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="fetch the sheet again instead of using the cache")
    parser.add_argument("--observation-end", type=date.fromisoformat, help="censoring date (default: last booking date before today)")
    parser.add_argument("--no-write", action="store_true", help="don't write the results spreadsheet")
    args = parser.parse_args(argv)

    settings = load_settings()
    frames = load_frames(settings, refresh=args.refresh, observation_end=args.observation_end)

    with pd.option_context("display.width", 160, "display.max_columns", 30, "display.max_rows", 100):
        print("== Checks ==", quality.checks(frames), sep="\n", end="\n\n")
        print("== 顧客姓名 linking (customer services) ==", quality.link_summary(frames), sep="\n", end="\n\n")
        print("== Row roles ==", quality.role_summary(frames), sep="\n", end="\n\n")
        print("== Missing 收費 by service and year ==", quality.missing_prices(frames), sep="\n", end="\n\n")
        print("== 整甲 Duration by era ==", quality.duration_by_era(frames), sep="\n", end="\n\n")

    out = settings.processed_dir
    out.mkdir(parents=True, exist_ok=True)
    # Period columns don't round-trip through parquet; the notebooks rebuild them from `date`
    for name in ("appointments", "visits", "no_shows", "upcoming", "customers"):
        frame = getattr(frames, name)
        frame.drop(columns=["month"], errors="ignore").to_parquet(out / f"{name}.parquet", index=False)
    print(f"Saved cleaned frames to {out} (OBSERVATION_END = {frames.observation_end.date()})")

    # Phase 2: per-customer return / churn / CLV from the final models
    # The landmark frame (every customer's state every 14 days) is the slow part; build it once
    landmarks = landmark_frame(visit_days(frames.visits), frames.observation_end)
    scores = customer_scores(frames, landmarks)
    scores.reset_index().to_parquet(out / "customer_scores.parquet", index=False)
    active = scores[scores["days_since_last_visit"] <= 365]
    print(f"Scored {len(scores)} customers: {int(scores['churn_flag'].sum())} flagged as churned "
          f"({int(active['churn_flag'].sum())} of the {len(active)} seen in the last year), "
          f"12-month CLV total HK${scores['clv_12m'].sum():,.0f} (MBG/CNBD-{scores.attrs.get('cnbd_k', '?')})")
    print(scores["segment"].value_counts().to_string(), end="\n\n")

    # Phase 3: weekly forecast of fulfilled bookings and revenue
    forecast = final_forecast(frames.visits, frames.appointments, frames.observation_end)
    forecast.reset_index().to_parquet(out / "forecast.parquet", index=False)
    print("== Forecast (next 12 weeks) ==", forecast.round(1).to_string(), sep="\n")

    # Phase 5: chart-ready summary numbers for the app's 洞察 view
    summary = summary_rows(frames, landmarks)
    summary.to_parquet(out / "summary.parquet", index=False)
    print(f"== Summary ({len(summary)} rows) ==", summary.round(3).to_string(index=False), sep="\n")

    # Phase 4: the results spreadsheet (never the source sheet)
    if args.no_write:
        return
    if not settings.analysis_spreadsheet_id:
        print("ANALYSIS_SPREADSHEET_ID is not set, so the results spreadsheet wasn't written")
        return
    run_at = run_timestamp()
    write_results(settings, {
        CUSTOMERS_TAB: customer_table(scores, run_at),
        FORECAST_TAB: forecast_table(forecast, run_at),
        SUMMARY_TAB: summary_table(summary, run_at),
    })
    print(f"Wrote {CUSTOMERS_TAB} ({len(scores)} customers), {FORECAST_TAB} ({len(forecast)} weeks) and "
          f"{SUMMARY_TAB} ({len(summary)} rows) to the results spreadsheet at {run_at}")


if __name__ == "__main__":
    main()
