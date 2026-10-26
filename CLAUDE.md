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

Expo SDK 58, Expo Router with typed routes, and the `@/*` → `src/*` path alias. The UI mirrors the existing AppSheet app (`reference/timetable.png`). The root `Stack` holds the `(tabs)` group and the `add-appointment` modal, which accepts optional `date` / `customerName` params for prefilling, or an `id` param to edit that appointment. Tapping an appointment (timetable or list) opens the `appointment-details` modal, which has 修改 (the detail modals have no WhatsApp button; WhatsApp lives on the list rows). On iOS, 修改 turns the same sheet into `AppointmentForm` (`src/components/swiftui/`, the form the `add-appointment` route also renders) with 刪除預約 at the end; on Android and web it replaces itself with `add-appointment` in edit mode, next to a 刪除 button. Both look the appointment up with `findCachedAppointment`, so it must already be loaded. Tabs, in the same order on every platform (iOS uses `(tabs)/_layout.ios.tsx`: `NativeTabs`, the native Liquid Glass tab bar, which draws no headers, so each iOS screen draws its own title, e.g. a SwiftUI `NavigationStack`; Android and web use the JS `Tabs` in `_layout.tsx`). There's no 預約 tab: new bookings start from the ＋ buttons on the list and timetable screens. The tab bar hides while scrolling down and comes back on scroll up: both layouts wrap their tabs in `TabBarVisibilityProvider` (`src/hooks/useTabBarVisibility.tsx`), and each scrolling screen reports its offset with `useHideTabBarOnScroll` (spread `scrollHandlers` onto RN scroll views) or, in SwiftUI, with `...useHideTabBarOnScrollModifiers()` from `src/components/swiftui/hideTabBarOnScroll.ts`. Only offsets that change while the user drags or flings count, so layout shifts can't toggle the bar back. iOS hides the native bar via `NativeTabs hidden` and animates it however the system does (it can't be made to slide); keep the native bar there for its floating shape and touch effects. On Android and web, `SlidingTabBar` (`src/components/`) floats the stock `BottomTabBar` over the screens and slides it with a native-driver transform, so screens pad their scroll content by `useTabBarInset()` (0 on iOS), and `AddButton` slides with the bar.
- `stats` (統計, added after the AppSheet tabs): dashboard over the last 12 months, loaded with one open-ended `useAppointments({ from })` call. Calculations are in `src/utils/stats.ts` (特別事項 and rows without a customer are skipped), charts in `src/components/stats/` (plain Views, no chart library).
- `customers` (顧客資料): tapping a customer opens the `customer-details` modal, which edits the name/phone in place or deletes the 顧客 row (found via `findCachedCustomer`), and shows their booking history (`useCustomerAppointments`, rendered by `CustomerHistory`). Its ＋ button opens the `add-customer` modal, prefilled from an unmatched search.
- `appointments` (預約資料): upcoming list.
- `index` (時間表, home): Day/Week/Month calendar, built from `src/components/calendar/` (`MonthView`, and `TimeGrid` for Day and Week).

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
- `預約資料` (appointments): 預約ID, 活動, 備注, 顧客姓名, 日期, 時間, Duration, 手/腳, 收費, 狀態, End Time, View, 訂金 (特別事項 rows copy 備注 into View, 粉嫩術 and 拆眼睫毛 rows copy 顧客姓名; only 拆眼睫毛, 補眼睫毛, 補甲 and 拆甲 use 訂金, a TRUE / FALSE "paid" flag, and the script errors if a 訂金 is sent but the column is missing). The top-ups' default 收費 depends on the customer's last full set before the booking date (`src/utils/topUpPrice.ts`, which the forms also show under 收費): 補眼睫毛 after 眼睫毛 is $0 within 5 days, $214 within 14 days, else $428; 補甲 after 整甲 is $0 within 5 days, else $30
- `顧客` (customers): 顧客ID, 顧客姓名, 電話

Real-data conventions (from AppSheet): 狀態 is `預約` / `已完成` (blank for 特別事項), and new 預約ID values are 22-char alphanumeric. The service list and each service's default Duration live in `src/constants/services.ts`. End Time = 時間 + Duration, or 時間 itself when there's no duration.

The `Appointment` type uses English field names. `phone` comes from a join with `顧客` by customer name, done either client-side or in Apps Script. Dates are `YYYY-MM-DD` and times are `HH:mm` (24h) strings. `groupAppointmentsByDate` depends on sorting these strings lexically, so keep that format when you parse the sheet's values.

**Home screen widget (iOS only):** `src/widgets/TodayWidget.tsx` (`expo-widgets`, configured in `app.json`, small and medium) shows today's booking count and the next booking. Its `'widget'` component runs in an isolated runtime, so it can't fetch or import anything; the app pushes data instead. `useTodayWidgetSync` (called in the root layout; a no-op off iOS) loads two weeks via `listAppointments` on launch, on returning to the foreground, and after every write (`onAppointmentsChanged` in `appointmentsApi`), and `buildTodayWidgetTimeline` turns it into timeline entries at each midnight and booking start. Needs a development build, not Expo Go; where the `ExpoWidgets` native module is missing (Expo Go, older builds), the sync hook does nothing instead of crashing.

**WhatsApp:** `src/utils/whatsapp.ts` opens `https://wa.me/<digits>` through `expo-linking`. Phones should be digits only with the country code (Hong Kong `852…`). `AppointmentCard` hides the WhatsApp button when there is no phone. WhatsApp buttons are icon-only with the WhatsApp logo (`assets/images/whatsapp.png`, white on transparent): `WhatsAppButton` in `src/components/swiftui/` on iOS (SwiftUI `Image` needs a local file, so it goes through `expo-asset`), `WhatsAppIcon` inside the green round `Pressable` elsewhere. Give them an `accessibilityLabel`, since there's no text.

**Styling:** plain `StyleSheet` with tokens from `src/constants/theme.ts` (`colors`, `spacing`, `radius`). The app is dark-only (`userInterfaceStyle: "dark"`) with a salmon accent, to match AppSheet. Each service's calendar colour is in `src/constants/services.ts`; use `serviceColor()`, which tolerates unknown values from old rows. On iOS the screens are SwiftUI (`@expo/ui`) in Liquid Glass style: use `glassButton()` / `glassProminentButton()` from `src/components/swiftui/glass.ts` instead of `buttonStyle('bordered' | 'borderedProminent')` (they fall back to bordered below iOS 26), and wrap modals in `SwiftModal`, which puts ✕ (left) and ✓ save or 修改 (right) in the native stack header with `Stack.Toolbar` (a SwiftUI `NavigationStack` bar doesn't show inside these native-stack modals). Details modals edit in place: 修改 swaps the content to the edit form, ✕ then leaves edit mode rather than closing, and delete is a red full-width row (`Button role="destructive"` with no button style) shown only while editing, at the bottom of the form. Icons go through `src/components/Icon.tsx` (`expo-symbols`: SF Symbols on iOS, Material Symbols on Android and web).
