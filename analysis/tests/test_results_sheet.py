from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from analysis.config import Settings
from analysis.results_sheet import check_target, customer_table, forecast_table, run_timestamp


def _settings(source, target):
    return Settings(source_spreadsheet_id=source, analysis_spreadsheet_id=target, credentials_path=None,
                    data_dir=Path("data"), observation_end=None)


def test_never_writes_to_the_source_sheet():
    with pytest.raises(RuntimeError, match="source"):
        check_target(_settings("same-id", "same-id"))
    with pytest.raises(RuntimeError, match="not set"):
        check_target(_settings("source", None))
    assert check_target(_settings("source", "results")) == "results"


def test_run_timestamp_is_hong_kong_time():
    assert run_timestamp(datetime(2026, 10, 30, 9, 5, tzinfo=timezone.utc)) == "2026-10-30 17:05"


def test_customer_table_formats_cells_and_sorts_by_clv():
    scores = pd.DataFrame({
        "name": ["Amy", "Betty"], "segment": ["活躍熟客", "一次客"], "p_alive": [0.98765, 0.1],
        "expected_next_visit": [pd.Timestamp("2026-11-15"), pd.NaT], "churn_flag": [np.False_, np.True_],
        "p_return_60d": [0.9, np.nan], "clv_12m": [1234.56, 5000.0],
        "last_visit": [pd.Timestamp("2026-10-20"), pd.Timestamp("2024-01-01")], "visits": [np.int64(20), np.int64(1)],
        "has_upcoming_booking": [True, False],
    }, index=pd.Index(["549", "1f5570d6"], name="customer_id"))
    rows = customer_table(scores, "2026-10-30 17:05")
    assert rows[0][:3] == ["顧客ID", "顧客姓名", "分群"] and rows[0][-1] == "更新時間"
    betty, amy = rows[1], rows[2]
    assert betty[0] == "1f5570d6" and betty[4] == "" and betty[6] == "" and betty[5] is True
    assert amy[3] == 0.988 and amy[4] == "2026-11-15" and amy[7] == 1235 and amy[9] == 20
    assert all(type(v) in (str, int, float, bool) for row in rows for v in row)


def test_forecast_table_weeks_run_monday_to_sunday():
    fc = pd.DataFrame({"bookings": [15.24], "bookings_low": [9.5], "bookings_high": [20.9], "revenue": [3754.3],
                       "revenue_low": [2354.2], "revenue_high": [5154.4], "planned_days_off": [np.int64(1)]},
                      index=pd.DatetimeIndex([pd.Timestamp("2026-11-08")], name="week"))
    rows = forecast_table(fc, "2026-10-30 17:05")
    assert rows[1][:3] == ["2026-11-02", "2026-11-08", 15.2]
    assert rows[1][5] == 3754 and rows[1][8] == 1 and rows[1][-1] == "2026-10-30 17:05"
