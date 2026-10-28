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

## Google sign-in

The app opens on a sign-in screen and only lets in the accounts listed in `src/auth/allowedEmails.ts`. iOS and Android use `@react-native-google-signin/google-signin` (Google's native SDKs), so they need a development build, not Expo Go. Its web support is for sponsors only, so `npm run web` signs in with `expo-auth-session` instead. All clients go in the same Google Cloud project:

1. **Consent screen:** Google Cloud Console → Google Auth Platform → Branding / Audience. Pick **External** and fill in the app name and support email. While the app is in **Testing**, add the three allowed Gmail addresses as **Test users** (other accounts then can't even get past Google). The scopes are only `openid`, `email` and `profile`, which need no verification.
2. **iOS client:** Clients → Create client → **iOS**, Bundle ID `com.nailswithcat.app`. Put its client ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.ts` turns it into the URL scheme Google returns to (`com.googleusercontent.apps.…`), so the ID must be set when the app is built.
3. **Android client:** Create client → **Android**, package `com.nailswithcat.app`, and the SHA-1 of the signing key (`npx eas-cli@latest credentials -p android` shows it; add one client per key, e.g. development and Play store, which re-signs with its own key shown in Play Console → App integrity). The app needs no Android client ID; Google matches the package and SHA-1.
4. **Web client** (only for `npm run web`): Create client → **Web application**, with **Authorized JavaScript origins** `http://localhost:8080` (plus any hosted origin) and the same values under **Authorized redirect URIs**. Put the client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Never put its client secret in the app.
5. Set the IDs in `.env.local` locally and as EAS environment variables for builds, then make a new development build (the Google SDKs, the iOS URL scheme and `expo-secure-store` are native changes).

The allowlist is checked in the app, so it stops anyone who installs the app. It doesn't protect the Apps Script URL itself, which still relies on `API_TOKEN` (see below).

## Notes

- `TEXT_DATE_ORDER` in `Code.gs` only matters for dates stored as plain text. Real date cells are read correctly either way.
- If existing rows store a `顧客ID` (an AppSheet Ref) in the `顧客姓名` column, new rows store the ID too. This keeps AppSheet working.
- `EXPO_PUBLIC_*` values are bundled into the app. The token keeps casual visitors out, but it isn't a strong secret, so don't publish the app build publicly.
