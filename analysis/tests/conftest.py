"""Shared fixtures: small raw tabs shaped like the Sheets API's UNFORMATTED_VALUE output."""

from __future__ import annotations

import pytest

APPOINTMENT_HEADER = ["預約ID", "活動", "備注", "顧客姓名", "日期", "時間", "Duration", "手/腳", "收費",
                      "狀態", "End Time", "View", "訂金", "複雜款", "拆甲", "延長", "訂金處理"]

APP_ID = "A" * 21  # + one character: the app's 22-char IDs


def serial(iso: str) -> int:
    """Days since 1899-12-30, as the Sheets API returns a date cell."""
    from datetime import date

    return (date.fromisoformat(iso) - date(1899, 12, 30)).days


def booking(id_, service, customer, iso, time=14 / 24, duration=2 / 24, price=218, status="已完成", notes=""):
    """One 預約資料 row in header order; the API trims trailing blanks, so we do too."""
    row = [id_, service, notes, customer, serial(iso), time, duration, "手", price, status, "", customer]
    return row


@pytest.fixture
def customer_rows():
    return [
        ["顧客ID", "顧客姓名", "電話", "IG", "加入日期"],
        [549, "Amy", 85291234567],  # numeric ID and phone, as UNFORMATTED_VALUE gives them
        ["1f5570d6", "Betty", "85298765432", "@betty", serial("2023-01-05")],
        ["c3", "小貓"],
        ["c4", "小貓"],  # a duplicate name
        ["", "Dora"],  # no 顧客ID: keyed by name
    ]


def make_days(rows):
    """A visit_days-shaped frame from (customer_id, iso date, spend[, category[, top_up_only]]) tuples."""
    import numpy as np
    import pandas as pd

    records = []
    for row in rows:
        customer, iso, spend, *rest = row
        category = rest[0] if rest else "nails"
        top_up = rest[1] if len(rest) > 1 else False
        records.append({
            "customer_id": customer, "date": pd.Timestamp(iso),
            "spend": np.nan if spend is None else float(spend), "category": category,
            "services": "整甲", "has_full_set": not top_up, "top_up_only": top_up,
        })
    return pd.DataFrame(records)
