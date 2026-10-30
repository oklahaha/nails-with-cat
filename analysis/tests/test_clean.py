import math
from datetime import date

import pandas as pd
import pytest

from analysis.clean import (
    LINK_AMBIGUOUS,
    LINK_BLANK,
    LINK_BY_ID,
    LINK_BY_NAME,
    LINK_UNMATCHED,
    ROLE_AFTER_END,
    ROLE_NO_SHOW,
    ROLE_SPECIAL,
    ROLE_UNLINKED,
    ROLE_UPCOMING,
    ROLE_VISIT,
    build_frames,
    cell_flag,
    cell_number,
    cell_text,
    clean_appointments,
    clean_customers,
    default_observation_end,
    link_customers,
    rows_to_frame,
    serial_to_date,
    serial_to_minutes,
)
from conftest import APP_ID, APPOINTMENT_HEADER, booking, serial


# --- cell conversions -------------------------------------------------------


def test_serial_to_date_uses_the_1899_12_30_epoch():
    assert serial_to_date(1) == pd.Timestamp("1899-12-31")
    assert serial_to_date(serial("2022-07-01")) == pd.Timestamp("2022-07-01")


def test_serial_to_date_drops_the_time_part():
    assert serial_to_date(serial("2024-02-29") + 0.75) == pd.Timestamp("2024-02-29")


def test_serial_to_date_reads_text_dates_as_day_first():
    assert serial_to_date("5/11/2022") == pd.Timestamp("2022-11-05")
    assert pd.isna(serial_to_date("31/2/2022"))
    assert pd.isna(serial_to_date("next week"))
    assert pd.isna(serial_to_date(""))
    assert pd.isna(serial_to_date(None))


def test_serial_to_minutes_time_of_day_ignores_whole_days():
    assert serial_to_minutes(14.5 / 24, time_of_day=True) == 870
    # A time cell holding a full date-time
    assert serial_to_minutes(45000 + 10 / 24, time_of_day=True) == 600


def test_serial_to_minutes_duration_and_rounding():
    assert serial_to_minutes(2.5 / 24, time_of_day=False) == 150
    # 1/1440 isn't exact in binary; still a whole minute
    assert serial_to_minutes(0.1 + 1 / 1440 * 0.4, time_of_day=False) == 144
    assert serial_to_minutes("2:30:00", time_of_day=False) == 150
    assert math.isnan(serial_to_minutes("", time_of_day=True))


def test_cell_text_turns_numeric_ids_into_text():
    assert cell_text(549) == "549"
    assert cell_text(549.0) == "549"
    assert cell_text(" Amy ") == "Amy"
    assert cell_text(None) == ""
    assert cell_text(True) == "TRUE"


def test_cell_number_and_flag():
    assert cell_number(218) == 218.0
    assert cell_number("$1,200") == 1200.0
    assert math.isnan(cell_number(""))
    assert math.isnan(cell_number("free"))
    assert cell_flag(True) is True
    assert cell_flag("FALSE") is False
    assert cell_flag("") is None


# --- tables -----------------------------------------------------------------


def test_rows_to_frame_finds_columns_by_header_and_pads_short_rows():
    rows = [["B", "A"], ["b1", "a1"], ["b2"]]
    frame = rows_to_frame(rows, {"A": "a", "B": "b", "C": "c"}, required=["A"])
    assert frame["a"].tolist() == ["a1", None]
    assert frame["b"].tolist() == ["b1", "b2"]
    assert frame["c"].isna().all()
    assert frame["sheet_row"].tolist() == [2, 3]


def test_rows_to_frame_requires_columns():
    with pytest.raises(ValueError, match="顧客姓名"):
        rows_to_frame([["預約ID"]], {}, required=["預約ID", "顧客姓名"])


def test_clean_appointments_types_and_era():
    rows = [
        APPOINTMENT_HEADER,
        booking(APP_ID + "1", "整甲", "549", "2026-10-01", time=14 / 24, duration=2.5 / 24),
        booking("ab12cd34", "整甲", "549", "2022-08-01", time=11 / 24, duration=2.5 / 24, price=""),
        ["", "", "", ""],  # blank row
    ]
    df = clean_appointments(rows)
    assert len(df) == 2
    first = df.iloc[0]
    assert first["date"] == pd.Timestamp("2026-10-01")
    assert first["start"] == pd.Timestamp("2026-10-01 14:00")
    assert first["duration_min"] == 150
    assert first["id_era"] == "app" and first["duration_reliable"]
    second = df.iloc[1]
    assert second["id_era"] == "appsheet" and not second["duration_reliable"]
    assert math.isnan(second["price"])


def test_clean_customers_keeps_ids_as_text(customer_rows):
    customers = clean_customers(customer_rows)
    assert customers["customer_id"].tolist() == ["549", "1f5570d6", "c3", "c4", ""]
    assert customers.loc[0, "phone"] == "85291234567"
    assert customers.loc[1, "joined_date"] == pd.Timestamp("2023-01-05")


# --- linking ----------------------------------------------------------------


def _appointments(*rows):
    return clean_appointments([APPOINTMENT_HEADER, *rows])


def test_link_customers_id_first_then_name(customer_rows):
    appts = _appointments(
        booking("r1", "整甲", 549, "2023-01-01"),  # numeric ID cell
        booking("r2", "整甲", "1f5570d6", "2023-01-02"),
        booking("r3", "整甲", "Betty", "2023-01-03"),  # a deleted-customer rewrite to the name
        booking("r4", "整甲", "小貓", "2023-01-04"),  # two customers called 小貓
        booking("r5", "整甲", "walk-in friend of Amy", "2023-01-05"),
        booking("r6", "整甲", "", "2023-01-06", notes="顧客: 小狗"),
        booking("r7", "整甲", "Dora", "2023-01-07"),  # customer without an ID: keyed by name
    )
    linked = link_customers(appts, clean_customers(customer_rows))
    assert linked["link_method"].tolist() == [
        LINK_BY_ID, LINK_BY_ID, LINK_BY_NAME, LINK_AMBIGUOUS, LINK_UNMATCHED, LINK_BLANK, LINK_BY_NAME,
    ]
    assert linked["customer_id"].tolist() == ["549", "1f5570d6", "1f5570d6", None, None, None, "Dora"]
    assert linked["notes_customer"].tolist()[5] == "小狗"


# --- frames -----------------------------------------------------------------


def test_build_frames_assigns_roles_and_upcoming_flag(customer_rows):
    appts = _appointments(
        booking("v1", "整甲", "549", "2023-01-01"),
        booking("v2", "補甲", "549", "2023-01-20", status="預約"),  # past 預約 counts as a visit
        booking("n1", "整甲", "549", "2023-02-01", status="No show"),
        booking("s1", "特別事項", "", "2023-02-02", status=""),
        booking("x1", "整甲", "somebody", "2023-02-03"),
        booking("u1", "眼睫毛", "1f5570d6", "2023-03-01", status="預約"),
        booking("v3", "眼睫毛", "1f5570d6", "2023-02-10"),
    )
    frames = build_frames(appts, clean_customers(customer_rows), today=date(2023, 2, 15))
    assert frames.observation_end == pd.Timestamp("2023-02-10")
    roles = dict(zip(frames.appointments["appointment_id"], frames.appointments["role"]))
    assert roles == {
        "v1": ROLE_VISIT, "v2": ROLE_VISIT, "n1": ROLE_NO_SHOW, "s1": ROLE_SPECIAL,
        "x1": ROLE_UNLINKED, "u1": ROLE_UPCOMING, "v3": ROLE_VISIT,
    }
    assert set(frames.visits["appointment_id"]) == {"v1", "v2", "v3"}
    assert frames.no_shows["appointment_id"].tolist() == ["n1"]
    upcoming = dict(zip(frames.customers["customer_id"], frames.customers["has_upcoming_booking"]))
    assert upcoming["1f5570d6"] and not upcoming["549"]


def test_explicit_observation_end_keeps_later_rows_out_of_history(customer_rows):
    appts = _appointments(
        booking("v1", "整甲", "549", "2023-01-01"),
        booking("v2", "整甲", "549", "2023-03-01"),
    )
    frames = build_frames(appts, clean_customers(customer_rows), observation_end=pd.Timestamp("2023-02-01"))
    roles = dict(zip(frames.appointments["appointment_id"], frames.appointments["role"]))
    assert roles == {"v1": ROLE_VISIT, "v2": ROLE_AFTER_END}


def test_default_observation_end_is_the_last_booking_before_today(customer_rows):
    appts = link_customers(
        _appointments(
            booking("a", "整甲", "549", "2023-01-01", status="預約"),  # 已完成 is rarely set
            booking("b", "整甲", "549", "2023-01-09", status="預約"),
            booking("t", "整甲", "549", "2023-01-10", status="預約"),  # today: may not have happened
            booking("s", "特別事項", "", "2023-01-09", status=""),
        ),
        clean_customers(customer_rows),
    )
    assert default_observation_end(appts, today=date(2023, 1, 10)) == pd.Timestamp("2023-01-09")
    with pytest.raises(ValueError):
        default_observation_end(appts, today=date(2022, 12, 1))
