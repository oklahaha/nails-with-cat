# Customer analytics (`analysis/`)

A separate Python project that analyses the booking data in the Google Sheet the app uses
(`預約資料` and `顧客`, see the repo's `CLAUDE.md`). It **reads the source sheet only**
(`spreadsheets.readonly` scope) and never changes the sheet's layout.

| Phase | Contents | Status |
| --- | --- | --- |
| 1 | Data pipeline, cleaning rules, data-quality report, EDA | done |
| 2 | Cohort retention, survival analysis of visit gaps, BG/NBD + Gamma-Gamma CLV | done |
| 3 | Segmentation, weekly demand forecast | done |
| 4 | Results written to a separate spreadsheet, shown on 統計 | done |

## Layout

```
analysis/
  src/analysis/      config.py   settings from .env
                     sheets.py   read-only Sheets API fetch + local cache
                     clean.py    typed frames, customer linking, visit / No show / upcoming split
                     features.py service categories, visit days, inter-visit gaps, durations
                     quality.py  data-quality tables
                     retention.py cohort tables, second-visit rates
                     survival.py  Kaplan-Meier, Cox PH, conditional return probabilities
                     clv.py       RFM summary, BG/NBD / MBG/NBD, Gamma-Gamma, CLV
                     segments.py  behaviour features, k-means segments, RFM baseline
                     forecast.py  weekly series, baselines, SARIMAX, rolling-origin back-tests
                     scores.py    the final per-customer table (return, churn, P(alive), CLV, segment)
                     results_sheet.py writes 客人分析 / 預測 to the results spreadsheet
                     pipeline.py load → clean → split, used by run.py and the notebooks
                     run.py      the one command to run everything
  notebooks/         (gitignored) 01_eda.ipynb, 02_retention_survival_clv.ipynb, 03_segmentation_forecast.ipynb
  deploy/            systemd timer for the nightly run
  tests/             pytest for the cleaning and feature code
  data/              (gitignored) raw cache and cleaned frames
  secrets/           (gitignored) put the service-account key here
```

## Setup

### 1. Python

Needs [uv](https://docs.astral.sh/uv/). From `analysis/`:

```bash
uv sync          # creates .venv with the pinned versions (Python 3.12)
uv run pytest    # the cleaning and feature tests
```

**CLV library:** `lifetimes` 0.11.3. It's no longer maintained, but its models install and fit
on Python 3.12 with current pandas / NumPy / SciPy (checked when setting this up). Only its
bundled example datasets fail to import (they need `pkg_resources`), and we don't use them.
`pymc-marketing` would be the fallback, at the cost of a much heavier install (PyMC, PyTensor).

### 2. Service account (once)

1. In the [Google Cloud console](https://console.cloud.google.com), pick or create a project.
2. **APIs & Services → Library**: enable the **Google Sheets API**.
3. **IAM & Admin → Service accounts → Create service account**. A name like
   `nails-analysis` is fine. It needs no project roles.
4. Open the account → **Keys → Add key → Create new key → JSON**. Save the file as
   `analysis/secrets/service-account.json` (gitignored). Treat it like a password.
5. Copy the account's email (`nails-analysis@<project>.iam.gserviceaccount.com`).

### 3. Share the sheets with it

* **Source sheet** (the dev copy now, the real sheet later): **Share → paste the service
  account email → Viewer**. Viewer plus the read-only scope means the pipeline can't write to it.
* **Results spreadsheet** (Phase 4): create a new, empty spreadsheet, share it with the same
  email as **Editor**.

### 4. `.env`

```bash
cp .env.example .env
```

Fill in `SOURCE_SPREADSHEET_ID` (the part of the sheet's URL between `/d/` and `/edit`),
`ANALYSIS_SPREADSHEET_ID` and `GOOGLE_APPLICATION_CREDENTIALS`. Switching from the dev copy to
the real sheet only changes `SOURCE_SPREADSHEET_ID`, then share the real sheet as Viewer.

## Running

```bash
uv run python -m analysis.run --refresh   # everything: fetch, clean, model, write the results sheet
uv run python -m analysis.run             # same, from the cached copy in data/raw/
uv run python -m analysis.run --no-write  # don't touch the results spreadsheet
uv run python -m analysis.run --observation-end 2026-09-30   # censor at another date
uv run jupyter lab notebooks/             # then open 01_eda.ipynb, 02_…, 03_…
```

`run.py` prints the data-quality report, saves the cleaned frames, `customer_scores.parquet`
(one row per customer) and `forecast.parquet` (the next 12 weeks) to `data/processed/`, and
writes the results spreadsheet. The notebooks load the cache through
`analysis.pipeline.load_frames()`, so they don't call Google.

### The results spreadsheet

Both tabs are replaced in full on every run and are meant to be read by header name.
Dates are `YYYY-MM-DD` text, so readers don't depend on the spreadsheet's locale.

* **客人分析**: one row per customer with a visit, highest CLV first: 顧客ID, 顧客姓名, 分群
  (segment), P(alive), 預計下次到訪 (blank = not expected within a year), 流失 (churn flag),
  60日內回來機率, 12個月CLV (HK$), 上次到訪, 到訪次數, 已有預約, 更新時間.
* **預測**: the next 12 weeks, Monday to Sunday: 預計預約 and 預計收入 with 80% bands,
  已知休息日 (days off already noted in the sheet), 更新時間. These are *fulfilled* bookings:
  full weeks hide turned-away demand.

The script refuses to write if `ANALYSIS_SPREADSHEET_ID` equals `SOURCE_SPREADSHEET_ID`, and the
service account is only a Viewer on the source sheet, so the bookings can't be changed.

### Running on a schedule

`deploy/` holds a systemd user timer that runs the job at 03:00 Hong Kong time, and catches up
if the server was off then. Install it once:

```bash
mkdir -p ~/.config/systemd/user
cp deploy/customer-analytics.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now customer-analytics.timer
loginctl enable-linger "$USER"     # keeps it running while logged out
```

Check it with `systemctl --user list-timers customer-analytics.timer` and
`journalctl --user -u customer-analytics.service`. The job runs from this working tree, so it
needs `analysis/` checked out (it isn't on a branch that doesn't have it).

Don't use GitHub Actions for this while the repo is public: its logs are public too, and the
job handles customer data. A failed run only leaves the results a day older, and 統計 goes back
to its 久未回來 list once they're more than 7 days old.

### What stays out of git

The repo is public, so `.gitignore` keeps out `.env`, `secrets/`, `data/` and
`notebooks/*.ipynb`: the notebooks' saved outputs contain real customer names, so they exist
only on this machine. Clear their outputs (`jupyter nbconvert --clear-output`) and check the
text cells before ever un-ignoring them. `.easignore` keeps all of `analysis/` out of EAS builds.

## How the data is read

* Cells are fetched with `valueRenderOption=UNFORMATTED_VALUE` and
  `dateTimeRenderOption=SERIAL_NUMBER`: dates arrive as days since 1899-12-30, times and
  durations as fractions of a day. No display strings are parsed. Cells that really hold text
  (a date typed as `5/11/2022`) are read day-first, as `Code.gs` does, and counted.
* Columns are found by header name, as in `Code.gs`.
* Cleaning rules (customer linking, what counts as a visit, OBSERVATION_END, the Duration
  problem on AppSheet rows) are documented in `clean.py` and checked with counts in section 1
  of `01_eda.ipynb`.

## How the app uses the results

```
Main sheet ──read-only──▶ this job (nightly) ──writes──▶ Results spreadsheet
                                                                │ reads
Phone ◀──JSON── Apps Script: listCustomerAnalytics ◀────────────┘
```

* `listCustomerAnalytics` in `apps-script/Code.gs` reads both tabs by header name, from the
  spreadsheet in its `ANALYSIS_SPREADSHEET_ID` script property (setup in `apps-script/README.md`).
  Renaming a column in `results_sheet.py` means changing it there too.
* `useCustomerAnalytics` in the app caches the results on the device and reloads them at most
  every 6 hours. `src/utils/customerAnalytics.ts` builds the lists for 統計:
  * **可能流失** replaces 久未回來: 流失 = TRUE in 活躍熟客 or 疏遠中, highest CLV first.
  * **快將回來**: 預計下次到訪 within 3 weeks and not flagged. The window is 3 weeks because the
    model rarely expects anyone back in under two: gaps vary a lot, so the conditional median
    stays well ahead of today (11 days at the shortest on the first run).
  * **顧客分群** and **未來 12 週**.
* Both customer lists drop anyone who has booked or visited since the run, using the bookings the
  app already has, and match on 顧客ID so renames keep working.
* With results missing or over 7 days old, 統計 shows 久未回來 as before.
