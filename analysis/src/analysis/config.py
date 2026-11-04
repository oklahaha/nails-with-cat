"""Settings from environment variables, loaded from `analysis/.env`.

Nothing here has a default spreadsheet ID on purpose: which sheet we read is
decided only by the environment, the same way the Apps Script reads its
SPREADSHEET_ID script property.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

# analysis/ (this file is analysis/src/analysis/config.py)
PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    source_spreadsheet_id: str | None
    analysis_spreadsheet_id: str | None
    credentials_path: Path | None
    data_dir: Path
    # Optional override for the censoring date (see clean.default_observation_end)
    observation_end: date | None

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"


def load_settings() -> Settings:
    """Read `analysis/.env` (if present) and the process environment."""
    load_dotenv(PROJECT_ROOT / ".env")
    credentials = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or None
    observation_end = os.environ.get("OBSERVATION_END") or None
    data_dir = os.environ.get("ANALYSIS_DATA_DIR") or None
    return Settings(
        source_spreadsheet_id=os.environ.get("SOURCE_SPREADSHEET_ID") or None,
        analysis_spreadsheet_id=os.environ.get("ANALYSIS_SPREADSHEET_ID") or None,
        credentials_path=_resolve(credentials) if credentials else None,
        data_dir=_resolve(data_dir) if data_dir else PROJECT_ROOT / "data",
        observation_end=date.fromisoformat(observation_end) if observation_end else None,
    )


def _resolve(path: str) -> Path:
    """Relative paths in .env are relative to analysis/, not the shell's cwd."""
    p = Path(path).expanduser()
    return p if p.is_absolute() else PROJECT_ROOT / p
