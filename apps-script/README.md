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

## Notes

- `TEXT_DATE_ORDER` in `Code.gs` only matters for dates stored as plain text. Real date cells are read correctly either way.
- If existing rows store a `顧客ID` (an AppSheet Ref) in the `顧客姓名` column, new rows store the ID too. This keeps AppSheet working.
- `EXPO_PUBLIC_*` values are bundled into the app. The token keeps casual visitors out, but it isn't a strong secret, so don't publish the app build publicly.
