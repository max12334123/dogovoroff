# Google Sheets webhook

This Apps Script receives signed application records from the server and writes them to the private `Заявки ДоговорОфф` spreadsheet. Telegram delivery is performed independently by the website server.

## One-time setup

1. Open the spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor contents with `Code.gs` from this directory and save the project.
3. Open **Project Settings → Script Properties** and add:
   - `SPREADSHEET_ID`: the ID from the spreadsheet URL;
   - `SHEET_NAME`: `Заявки`;
   - `WEBHOOK_SECRET`: a newly generated random secret of at least 32 characters.
4. Choose **Deploy → New deployment → Web app**.
5. Set **Execute as** to your account and **Who has access** to `Anyone`. Requests are accepted only with a valid HMAC signature and a fresh timestamp.
6. Copy the `/exec` URL. Store it in Vercel as `GOOGLE_SHEETS_WEBHOOK_URL`; store the same secret as `GOOGLE_SHEETS_WEBHOOK_SECRET`.

Never place the webhook secret in source control, client-side variables, or chat messages.
