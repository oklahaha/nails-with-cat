"""Read-only access to the source Google Sheet, with a local cache.

We ask the Sheets API for UNFORMATTED_VALUE + SERIAL_NUMBER, so cells come
back as the numbers Sheets stores: a date is days since 1899-12-30, a time is
a fraction of a day, a checkbox is a bool. That avoids parsing display
strings, which depend on the sheet's locale and format (`clean.py` converts
the numbers).

The credentials only ever get the `spreadsheets.readonly` scope for the
source sheet, so this module cannot write to it even by mistake.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from analysis.config import Settings

APPOINTMENTS_TAB = "預約資料"
CUSTOMERS_TAB = "顧客"
SOURCE_TABS = (APPOINTMENTS_TAB, CUSTOMERS_TAB)

READONLY_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

CACHE_FILE = "source_sheet.json"


@dataclass(frozen=True)
class RawSheet:
    """The source tabs as the API returned them: a list of rows per tab."""

    tabs: dict[str, list[list[Any]]]
    fetched_at: datetime


def load_source(settings: Settings, refresh: bool = False) -> RawSheet:
    """The cached copy of the source tabs, fetched first if missing or `refresh`."""
    cache = settings.raw_dir / CACHE_FILE
    if refresh or not cache.exists():
        raw = fetch_source(settings)
        save_cache(raw, cache)
        return raw
    return read_cache(cache)


def fetch_source(settings: Settings) -> RawSheet:
    """Fetch both tabs in one batchGet call (read-only scope)."""
    if not settings.source_spreadsheet_id:
        raise RuntimeError("SOURCE_SPREADSHEET_ID is not set (see analysis/.env.example)")
    service = _sheets_service(settings, READONLY_SCOPES)
    response = (
        service.spreadsheets()
        .values()
        .batchGet(
            spreadsheetId=settings.source_spreadsheet_id,
            # Quoted because the tab names aren't plain A1 identifiers
            ranges=[f"'{tab}'" for tab in SOURCE_TABS],
            valueRenderOption="UNFORMATTED_VALUE",
            dateTimeRenderOption="SERIAL_NUMBER",
            majorDimension="ROWS",
        )
        .execute()
    )
    tabs = {
        tab: value_range.get("values", [])
        for tab, value_range in zip(SOURCE_TABS, response["valueRanges"], strict=True)
    }
    return RawSheet(tabs=tabs, fetched_at=datetime.now(timezone.utc))


def save_cache(raw: RawSheet, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"fetched_at": raw.fetched_at.isoformat(), "tabs": raw.tabs}
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def read_cache(path: Path) -> RawSheet:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return RawSheet(tabs=payload["tabs"], fetched_at=datetime.fromisoformat(payload["fetched_at"]))


def _sheets_service(settings: Settings, scopes: list[str]):
    # Imported here so the cleaning code and its tests don't need Google libraries loaded
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    if not settings.credentials_path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS is not set (see analysis/.env.example)")
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.credentials_path), scopes=scopes
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)
