# Apps Script API

A JSON API over the Google Sheet (`預約資料` and `顧客` tabs). The Expo app calls it through `src/services/appointmentsApi.ts`.

## Setup (point it at the COPY first)

1. Go to [script.google.com](https://script.google.com) and create a **New project**. Sign in with an account that can edit the copied spreadsheet.
2. Paste in `Code.gs`. Under **Project Settings**, tick "Show appsscript.json", then paste in `appsscript.json`.
3. Under **Project Settings → Script Properties**, add these two properties:
   - `SPREADSHEET_ID`: the ID of the **copy**. It's the part of the URL between `/d/` and `/edit`.
   - `API_TOKEN`: any long random string.
4. Run `debugListAppointments` once from the editor and approve the permissions. Check the log: it should show the copy's name and some parsed rows. Make sure the dates, times and phone numbers look right.
5. Click **Deploy → New deployment → Web app**. Set Execute as **Me** and Who has access to **Anyone**. Copy the `/exec` URL.
6. In the Expo project, copy `.env.example` to `.env.local` and fill in the URL and token. Then fully reload the app.

## Switching to the real data

Change the `SPREADSHEET_ID` script property to the real spreadsheet's ID. You don't need to edit code or redeploy. Run `debugListAppointments` again to confirm the script now points at the real sheet.

## Updating the code

After you edit `Code.gs`, go to **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same `/exec` URL. If you choose "New deployment" instead, you get a new URL.

## Push notifications

When one phone adds, edits or deletes a booking, the script sends a push message to the other registered phones through Expo's push service. The app registers each phone on launch, and the list is kept in the `PUSH_TOKENS` script property (run `debugListPushTokens` to see it). Changes made in AppSheet don't send anything. The reminders and morning summary are scheduled on each phone and need none of this.

One-time setup:

1. **Script:** paste the new `Code.gs` and `appsscript.json` (it now asks to reach external URLs), run `debugListPushTokens` once from the editor and approve the new permission, then redeploy as a new version (see below).
2. **EAS project:** run `npx eas-cli@latest init` in the Expo project. It adds `extra.eas.projectId` to `app.json`, which the app needs for a push token. Without it only the local notifications work.
3. **iOS:** run `npx eas-cli@latest credentials -p ios` (or start an iOS build) and let EAS create a push notification key.
4. **Android:** in the [Firebase console](https://console.firebase.google.com), add an Android app with the package `com.nailswithcat.app` and download `google-services.json` to the project root. Add `"googleServicesFile": "./google-services.json"` under `android` in `app.json`. Then create a service account key (Project settings → Service accounts) and upload it with `npx eas-cli@latest credentials -p android` → Google Service Account → FCM V1.
5. Make a new development build on both platforms (`expo-notifications` and `expo-task-manager` are native modules), open the app once on each phone and allow notifications.

## Customer analytics (optional)

統計 can show the nightly results of the `analysis/` project through `listCustomerAnalytics`, which only reads them. To turn it on:

1. Make sure the Google account that deploys this script can open the results spreadsheet.
2. Paste the new `Code.gs`, then add the script property `ANALYSIS_SPREADSHEET_ID` with the results spreadsheet's ID (not `SPREADSHEET_ID`).
3. Redeploy as a new version (see "Updating the code").

Without the property the action returns empty lists, and the app keeps showing 久未回來.

## Marking finished bookings 已完成

`completePastBookings` changes 狀態 from `預約` to `已完成` once a booking's End Time has passed, looking back 30 days. It leaves `No show` and 特別事項 alone, and sends no push. A wrongly marked booking can still be changed in the app. To turn it on:

1. Paste the new `Code.gs`, then run `completePastBookings` once from the editor and check the log.
2. Under **Triggers → Add Trigger**, choose the function `completePastBookings`, deployment **Head**, event source **Time-driven**, **Hour timer**, **Every hour**.

## Notes

- `TEXT_DATE_ORDER` in `Code.gs` only matters for dates stored as plain text. Real date cells are read correctly either way.
- If existing rows store a `顧客ID` (an AppSheet Ref) in the `顧客姓名` column, new rows store the ID too. This keeps AppSheet working.
- `EXPO_PUBLIC_*` values are bundled into the app. The token keeps casual visitors out, but it isn't a strong secret, so don't publish the app build publicly.
