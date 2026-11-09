# Apps Script API

A JSON API over the Google Sheet (`預約資料` and `顧客` tabs). The Expo app calls it through `src/services/appointmentsApi.ts`.

## Setup (point it at the COPY first)

1. Go to [script.google.com](https://script.google.com) and create a **New project**. Sign in with an account that can edit the copied spreadsheet.
2. Paste in `Code.gs`. Under **Project Settings**, tick "Show appsscript.json", then paste in `appsscript.json`.
3. Under **Project Settings → Script Properties**, add these properties:
   - `SPREADSHEET_ID`: the ID of the **copy**. It's the part of the URL between `/d/` and `/edit`.
   - `ALLOWED_EMAILS`, `GOOGLE_CLIENT_IDS`, `AUTH_GENERATION`: see the required security migration below.
4. Run `debugListAppointments` once from the editor and approve the permissions. Check the log: it should show the copy's name and some parsed rows. Make sure the dates, times and phone numbers look right.
5. Click **Deploy → New deployment → Web app**. Set Execute as **Me** and Who has access to **Anyone**. Copy the `/exec` URL.
6. In the Expo project, copy `.env.example` to `.env.local` and fill in the URL and Google client IDs. Then fully reload the app.

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

## Google sign-in

The app opens on a sign-in screen and only lets in the accounts listed in `src/auth/allowedEmails.ts`. iOS and Android use `@react-native-google-signin/google-signin` (Google's native SDKs), so they need a development build, not Expo Go. Its web support is for sponsors only, so `npm run web` signs in with `expo-auth-session` instead. All clients go in the same Google Cloud project:

1. **Consent screen:** Google Cloud Console → Google Auth Platform → Branding / Audience. Pick **External** and fill in the app name and support email. While the app is in **Testing**, add the three allowed Gmail addresses as **Test users** (other accounts then can't even get past Google). The scopes are only `openid`, `email` and `profile`, which need no verification.
2. **iOS client:** Clients → Create client → **iOS**, Bundle ID `com.nailswithcat.app`. Put its client ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.ts` turns it into the URL scheme Google returns to (`com.googleusercontent.apps.…`), so the ID must be set when the app is built.
3. **Android client:** Create client → **Android**, package `com.nailswithcat.app`, and the SHA-1 of the signing key (`npx eas-cli@latest credentials -p android` shows it; add one client per key, e.g. development and Play store, which re-signs with its own key shown in Play Console → App integrity). The app needs no Android client ID; Google matches the package and SHA-1.
4. **Web client** (required on every platform for backend identity verification): Create client → **Web application**, with **Authorized JavaScript origins** `http://localhost:8080` (plus any hosted origin) and the same values under **Authorized redirect URIs**. Put the client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Never put its client secret in the app.
5. Set the IDs in `.env.local` locally and as EAS environment variables for builds, then make a new development build (the Google SDKs, the iOS URL scheme and `expo-secure-store` are native changes).

The allowlist is checked in the app, so it stops anyone who installs the app. The backend independently verifies Google identity and its server-managed allowlist (see the required security migration below).

## Customer analytics (optional)

統計 can show the nightly results of the `analysis/` project through `listCustomerAnalytics`, which only reads them. To turn it on:

1. Make sure the Google account that deploys this script can open the results spreadsheet.
2. Paste the new `Code.gs`, then add the script property `ANALYSIS_SPREADSHEET_ID` with the results spreadsheet's ID (not `SPREADSHEET_ID`).
3. Redeploy as a new version (see "Updating the code").

Without the property the action returns empty lists, and the app keeps showing 久未回來.

The results spreadsheet has three tabs, all rewritten each night: 客人分析, 預測 and 分析摘要 (the numbers behind 統計 → 洞察 on iOS). A deployment older than 分析摘要 still works; the app just shows no 洞察 view until the new `Code.gs` is deployed. 分析摘要 is one long table (項目, 分類, 子分類, 數值, 下限, 上限, 人數, 說明), so new analyses add rows, not columns: once this version is deployed, the script needn't change for them.

## Customer source (來源)

New customers can record how they found the studio (朋友介紹, Instagram, 小紅書, …), which the analysis uses to compare how often each source's new customers come back. It lives in a **來源** column at the end of the **顧客** tab, which the script adds by itself the first time a customer is saved with a source (`ensureSourceColumn_`): nothing to set up beyond deploying this `Code.gs`. Existing columns don't move, so AppSheet keeps working and ignores the new column until its structure is regenerated.

## Marking finished bookings 已完成

`completePastBookings` changes 狀態 from `預約` to `已完成` once a booking's End Time has passed, looking back 30 days. It leaves `No show` and 特別事項 alone, and sends no push. A wrongly marked booking can still be changed in the app. To turn it on:

1. Paste the new `Code.gs`, then run `completePastBookings` once from the editor and check the log.
2. Under **Triggers → Add Trigger**, choose the function `completePastBookings`, deployment **Head**, event source **Time-driven**, **Hour timer**, **Every hour**.

## Photos (參考作品, 完成作品)

The app uploads and shows booking photos through the script, which keeps them in the `參考作品_images` and `完成作品_images` folders beside the spreadsheet (found by name, and created if missing when uploading). `參考作品` and `完成作品` hold each photo's path, one per line. To turn it on:

1. Paste the new `Code.gs` and `appsscript.json` (it now asks for Google Drive access).
2. Run `debugPhotoFolders` once from the editor, approve the new permission and check the log lists both folders.
3. Redeploy as a new version (see "Updating the code").
4. Before switching to the real sheet, add its `參考作品` column. Uploads there fail with a clear error until it exists.

The 作品 tab lists bookings through `listFinishedPhotoAppointments`, so it also needs the new `Code.gs` redeployed.

The script can only read or trash files in those folders (and `預約資料_Images` paths, whose files moved to `完成作品_images`). Removing a photo in the app moves the file to Drive's trash. Deleting a booking leaves its photos in Drive.

## Notes

- `TEXT_DATE_ORDER` in `Code.gs` only matters for dates stored as plain text. Real date cells are read correctly either way.
- If existing rows store a `顧客ID` (an AppSheet Ref) in the `顧客姓名` column, new rows store the ID too. This keeps AppSheet working.
- `EXPO_PUBLIC_*` values are public app configuration. Never put an API secret in them; access uses per-account server-issued sessions.

## Security migration: Google-backed sessions (required)

The shared client API token is no longer accepted, and older scripts don't know
the new app's sign-in, so the switch has a short gap either way. In this order:

1. Add the script properties below.
2. Install the new build on every phone (TestFlight), but don't sign in yet:
   sign-in fails until step 3.
3. Redeploy `Code.gs` as a new version of the existing deployment. From here
   older builds stop working.
4. Sign in on each phone (once; sessions then renew themselves).

In Apps Script **Script Properties**, set:

- `ALLOWED_EMAILS`: comma-separated allowed Google account emails. This is the
  authoritative backend allowlist; keep the app's display allowlist in sync.
- `GOOGLE_CLIENT_IDS`: comma-separated exact OAuth client IDs accepted as ID-token
  audiences. Include both the Web client and the iOS client (iOS tokens may carry
  either); Android tokens carry the Web client's ID. Set once; they only change if
  a client is recreated in Google Cloud.
- `AUTH_GENERATION`: start at `1`. Change this value to revoke every session and
  push subscription immediately on subsequent requests/deliveries.

Keep `SPREADSHEET_ID` and optional analytics settings as before. `API_TOKEN` is no
longer used and can be deleted. Remove `EXPO_PUBLIC_APPS_SCRIPT_TOKEN` from app build environments.
Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for native builds as well as web; native
Google sign-in uses it to obtain a backend-verifiable ID token.

The backend exchanges a Google ID token through Google's HTTPS tokeninfo endpoint,
checks issuer, audience, expiry, verified email and the server allowlist, then
issues an opaque session that lasts 90 days and renews whenever the app uses it. Only a hash of the session credential is stored
on the server; the native app stores its credential in SecureStore. Web retains
its existing same-origin localStorage storage model. Tokeninfo requires Google
availability and quota; login fails closed if verification fails. There is no
shared-token fallback or live-backend Expo Go bypass. Users only sign in again after
90 days without using the app. A maximum of 60 active sessions bounds script-property usage; expired
or revoked entries are cleaned up on the next login.

Push entries now bind to the registering session. Legacy unbound entries are
ignored, and current entries stop receiving changes when their session expires,
is signed out, the email is removed from `ALLOWED_EMAILS`, or the generation changes.
Existing devices re-register after their next successful login. Removing an email
on the server is the authoritative revocation step; merely changing the UI list
cannot revoke a credential on the server. Session keys (`SESSION:*`) and
`PUSH_TOKENS` are server-managed; never copy their values into the app or logs.

Signing out requests server-session deletion. Offline sign-out cannot guarantee remote
revocation; for a lost device remove its email from the server allowlist or change
AUTH_GENERATION. Already-delivered notifications cannot be recalled.
