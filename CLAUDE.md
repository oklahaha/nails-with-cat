# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project context

Booking schedule app for a small nail (整甲) and eyelash (眼睫毛) studio. It is a rewrite of an existing **Google AppSheet** app whose data lives in a **Google Sheet**; the new Expo app must reuse that existing sheet data rather than migrate to a new database.

Two users, both writing to the same schedule:
- The owner's daughter arranges times with customers over WhatsApp, then records the booking in the app.
- The studio owner sometimes books customers herself.

Because the AppSheet app may stay in use during the transition, treat the Google Sheet as the single source of truth and don't change its column layout.

All UI copy is Traditional Chinese. Keep new strings in the same language and tone.

## Commands

The project uses **npm** (`package-lock.json`), so use `npx`, not `bunx`.

```bash
npm start                 # expo start on port 8080 (also: npm run ios / android / web)
npm run start:tunnel      # expo start behind a Cloudflare tunnel (ngrok --tunnel fails); needs cloudflared
npm run lint              # expo lint
npx tsc --noEmit          # typecheck
```

There is no test runner set up yet.

## Architecture

Expo SDK 57, Expo Router with typed routes, and the `@/*` → `src/*` path alias. The UI mirrors the existing AppSheet app (`reference/timetable.png`). The root `Stack` holds the `(tabs)` group and the `add-appointment` modal, which accepts optional `date` / `customerName` params for prefilling, or an `id` param to edit that appointment. Tapping an appointment (timetable or list) opens the `appointment-details` modal, which has WhatsApp, 修改 (replaces itself with the form in edit mode) and 刪除. Both look the appointment up with `findCachedAppointment`, so it must already be loaded. Tabs, in AppSheet order:
- `new` (預約): `tabPress` is intercepted to push the modal, so the screen file is only a redirect.
- `customers` (顧客資料): tapping a customer opens the `customer-details` modal, which edits the name/phone in place or deletes the 顧客 row (found via `findCachedCustomer`), and shows their booking history (`useCustomerAppointments`, rendered by `CustomerHistory`). Its ＋ button opens the `add-customer` modal, prefilled from an unmatched search.
- `appointments` (預約資料): upcoming list.
- `index` (時間表, home): Day/Week/Month calendar, built from `src/components/calendar/` (`MonthView`, and `TimeGrid` for Day and Week).
- `stats` (統計, added after the AppSheet tabs): dashboard over the last 12 months, loaded with one open-ended `useAppointments({ from })` call. Calculations are in `src/utils/stats.ts` (特別事項 and rows without a customer are skipped), charts in `src/components/stats/` (plain Views, no chart library).

`useAppointments({ from, to })` (`src/hooks/`) loads a date range and reloads on focus. The timetable fetches the whole month grid at once, so switching views within a month doesn't call Apps Script again. Date helpers in `src/utils/dates.ts` work on `YYYY-MM-DD` strings, with weeks starting on Sunday.

On web, `Alert.alert` from react-native-web is a no-op. Use `showAlert` from `src/utils/alert.ts`, which falls back to `window.alert` / `window.confirm`.

**Data flow:** screens never touch data sources directly. They call `src/services/appointmentsApi.ts` (`listAppointments`, `createAppointment`, `updateAppointment`, `deleteAppointment`). That module talks to the Google Apps Script Web App in `apps-script/Code.gs`, using `EXPO_PUBLIC_APPS_SCRIPT_URL` and `EXPO_PUBLIC_APPS_SCRIPT_TOKEN` from `.env.local` (see `.env.example`). When the URL is empty, it falls back to `src/data/mockAppointments.ts`, and the mock writes don't persist.

**Apps Script** (`apps-script/`, deployed by hand. Setup steps are in `apps-script/README.md`):
- Every response is HTTP 200 with JSON `{ ok, ... }` or `{ ok: false, error }`. Actions are `listAppointments` (with `from`/`to` filters), `listCustomers`, `listCustomerAppointments` (by `id`/`name`, any date) and `ping` via GET, and `createAppointment`, `updateAppointment` (by 預約ID, writing only the known columns) `deleteAppointment` (removes the row), `createCustomer` (new 顧客ID shaped like the existing ones), `updateCustomer` and `deleteCustomer` via POST. Customers are keyed by 顧客ID, or by name when a row has none. Renaming a customer also renames the 預約資料 rows that store the old name; deleting one rewrites rows that store its 顧客ID to the name, so bookings stay readable.
- POST bodies are sent as `text/plain` so web builds skip the CORS preflight, which Apps Script can't handle.
- The script reads which spreadsheet to use from the `SPREADSHEET_ID` Script Property. During development that's a **copy** of the real data. Switching to the real sheet only changes this property, so never hard-code a spreadsheet ID.
- Columns are looked up by header name. Times are parsed from display strings, not raw values, because time-only cells come back as 1899 dates with odd Asia/Hong_Kong offsets.
- Writes happen under `LockService`, since both users may save at the same moment. Code changes have to be redeployed as a new version of the existing deployment, which keeps the `/exec` URL.

**Sheet ↔ type mapping** lives in `src/types/appointment.ts`, which documents the sheet tabs and their columns:
- `預約資料` (appointments): 預約ID, 活動, 備注, 顧客姓名, 日期, 時間, Duration, 手/腳, 收費, 狀態, End Time
- `顧客` (customers): 顧客ID, 顧客姓名, 電話

Real-data conventions (from AppSheet): 狀態 is `預約` / `已完成` (blank for 特別事項), and new 預約ID values are 22-char alphanumeric. The service list and each service's default Duration live in `src/constants/services.ts`. End Time = 時間 + Duration, or 時間 itself when there's no duration.

The `Appointment` type uses English field names. `phone` comes from a join with `顧客` by customer name, done either client-side or in Apps Script. Dates are `YYYY-MM-DD` and times are `HH:mm` (24h) strings. `groupAppointmentsByDate` depends on sorting these strings lexically, so keep that format when you parse the sheet's values.

**WhatsApp:** `src/utils/whatsapp.ts` opens `https://wa.me/<digits>` through `expo-linking`. Phones should be digits only with the country code (Hong Kong `852…`). `AppointmentCard` hides the WhatsApp button when there is no phone.

**Styling:** plain `StyleSheet` with tokens from `src/constants/theme.ts` (`colors`, `spacing`, `radius`). The app is dark-only (`userInterfaceStyle: "dark"`) with a salmon accent, to match AppSheet. Each service's calendar colour is in `src/constants/services.ts`; use `serviceColor()`, which tolerates unknown values from old rows. Icons go through `src/components/Icon.tsx` (`expo-symbols`: SF Symbols on iOS, Material Symbols on Android and web).
