"""Re-run every notebook in place: `uv run python -m analysis.notebooks`.

Cron runs this after the nightly analysis (see README), so the notebooks'
tables and charts always show the latest data, without opening Jupyter.
Each notebook runs on its own: one that fails is reported and the rest still
run. A banner cell at the top of each says when it last ran, because the
prose in the notebooks was written on a given date and its numbers can drift
from the refreshed outputs.

The notebooks read the cache that `analysis.run` saved, so they never call
Google themselves.
"""

from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

import nbformat
from nbclient import NotebookClient

from analysis.results_sheet import STUDIO_TZ

NOTEBOOK_DIR = Path(__file__).resolve().parents[2] / "notebooks"
TIMEOUT_SECONDS = 1800
BANNER_TAG = "run-banner"


def banner(now: datetime) -> str:
    return (f"> **Last run automatically:** {now:%Y-%m-%d %H:%M} (Hong Kong). Tables and charts below are "
            "from that run. Numbers quoted in the text were written when the notebook was, so where "
            "they differ, the outputs are current.")


def set_banner(nb: nbformat.NotebookNode, now: datetime) -> None:
    """Add or update the first cell, tagged so later runs replace it."""
    cell = nb.cells[0] if nb.cells and BANNER_TAG in nb.cells[0].get("metadata", {}).get("tags", []) else None
    if cell is None:
        cell = nbformat.v4.new_markdown_cell(metadata={"tags": [BANNER_TAG]})
        nb.cells.insert(0, cell)
    cell.source = banner(now)


def run_notebook(path: Path) -> bool:
    nb = nbformat.read(path, as_version=4)
    start = time.time()
    try:
        NotebookClient(nb, timeout=TIMEOUT_SECONDS, kernel_name="python3",
                       resources={"metadata": {"path": str(path.parent)}}).execute()
    except Exception as e:  # noqa: BLE001 - report and keep the others going
        print(f"FAILED {path.name} after {time.time() - start:.0f}s: {type(e).__name__}: {str(e)[:300]}")
        return False
    set_banner(nb, datetime.now(STUDIO_TZ))
    nbformat.write(nb, path)
    print(f"ok     {path.name} in {time.time() - start:.0f}s")
    return True


def main() -> int:
    notebooks = sorted(NOTEBOOK_DIR.glob("[0-9][0-9]_*.ipynb"))
    print(f"== Notebooks {datetime.now(STUDIO_TZ):%Y-%m-%d %H:%M} ({len(notebooks)}) ==")
    results = [run_notebook(p) for p in notebooks]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
