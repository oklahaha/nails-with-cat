import math

import pandas as pd

from analysis.clean import build_frames, clean_appointments, clean_customers
from analysis.features import (
    BOTH,
    LASHES,
    NAILS,
    add_service_columns,
    best_duration,
    default_duration,
    inter_visit_gaps,
    visit_days,
    visits_per_customer,
)
from conftest import APP_ID, APPOINTMENT_HEADER, booking


def _frames(customer_rows, *rows, observation_end=None):
    appts = clean_appointments([APPOINTMENT_HEADER, *rows])
    return build_frames(appts, clean_customers(customer_rows), observation_end)


def test_service_columns():
    df = add_service_columns(pd.DataFrame({"service": ["整甲", "補眼睫毛", "整甲 + 眼睫毛", "粉嫩術", "old thing"]}))
    assert df["category"].tolist() == [NAILS, LASHES, BOTH, "other", "other"]
    assert df["kind"].tolist() == ["full_set", "top_up", "full_set", "other", "other"]


def test_default_duration_follows_the_app_rules():
    assert default_duration("整甲", "手") == 120
    assert default_duration("整甲", "手", "一個鐘", removal=True, extension=True) == 120 + 60 + 30 + 60
    # 腳 bookings don't take the add-ons
    assert default_duration("整甲", "腳", "一個鐘", removal=True) == 60
    assert default_duration("整甲 + 眼睫毛", "手 + 腳") == 180 + 120
    assert default_duration("補眼睫毛") == 60
    assert math.isnan(default_duration("特別事項"))


def test_best_duration_trusts_only_app_rows(customer_rows):
    frames = _frames(
        customer_rows,
        booking(APP_ID + "1", "整甲", "549", "2023-01-01", duration=3 / 24),
        booking("old00001", "整甲", "549", "2023-01-02", duration=2.5 / 24),
    )
    assert best_duration(frames.visits).tolist() == [180, 120]


def test_visit_days_merge_same_day_bookings(customer_rows):
    frames = _frames(
        customer_rows,
        booking("a", "整甲", "549", "2023-01-01", price=218),
        booking("b", "補眼睫毛", "549", "2023-01-01", price=""),
        booking("c", "補甲", "549", "2023-01-10", price=30),
    )
    days = visit_days(frames.visits)
    assert len(days) == 2
    first = days.iloc[0]
    assert first["bookings"] == 2 and first["category"] == BOTH
    assert first["spend"] == 218 and first["price_missing"] == 1
    assert first["has_full_set"] and not first["top_up_only"]
    assert days.iloc[1]["top_up_only"]
    assert visits_per_customer(days).to_dict() == {"549": 2}


def test_inter_visit_gaps_censor_the_last_gap(customer_rows):
    frames = _frames(
        customer_rows,
        booking("a", "整甲", "549", "2023-01-01"),
        booking("b", "整甲", "549", "2023-01-29"),
        booking("c", "眼睫毛", "1f5570d6", "2023-01-15"),
        observation_end=pd.Timestamp("2023-03-01"),
    )
    gaps = inter_visit_gaps(visit_days(frames.visits), frames.observation_end)
    amy = gaps[gaps["customer_id"] == "549"]
    assert amy["gap_days"].tolist() == [28, 31]
    assert amy["event"].tolist() == [1, 0]
    assert amy["visit_number"].tolist() == [1, 2]
    betty = gaps[gaps["customer_id"] == "1f5570d6"].iloc[0]
    assert betty["event"] == 0 and betty["gap_days"] == 45 and betty["category"] == LASHES
