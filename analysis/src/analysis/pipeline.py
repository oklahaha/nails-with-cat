"""Load → clean → link → split, shared by `run.py` and the notebooks."""

from __future__ import annotations

from datetime import date

from analysis.clean import Frames, build_frames, clean_appointments, clean_customers
from analysis.config import Settings, load_settings
from analysis.sheets import APPOINTMENTS_TAB, CUSTOMERS_TAB, load_source


def load_frames(
    settings: Settings | None = None,
    refresh: bool = False,
    observation_end: date | None = None,
) -> Frames:
    """The cleaned frames, from the local cache unless `refresh` (or no cache yet).

    `observation_end` overrides the OBSERVATION_END setting, which overrides
    the default (the latest booking date before today).
    """
    settings = settings or load_settings()
    raw = load_source(settings, refresh=refresh)
    appointments = clean_appointments(raw.tabs[APPOINTMENTS_TAB])
    customers = clean_customers(raw.tabs[CUSTOMERS_TAB])
    return build_frames(appointments, customers, observation_end or settings.observation_end)
