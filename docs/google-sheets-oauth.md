# Google Sheets OAuth setup

This project supports a server-side Google Sheets OAuth connection for the Admin Panel.

## Google Cloud

1. Create/select a Google Cloud project.
2. Enable **Google Sheets API**.
3. Configure **Google Auth Platform / OAuth consent screen**.
   - Use External if the authorized account is a normal Gmail account such as `rohitravelsryk@gmail.com`.
   - Add `rohitravelsryk@gmail.com` as a test user while the app is in testing.
4. Create an OAuth 2.0 Client ID with application type **Web application**.
5. Add these authorized redirect URIs:
   - Production: `https://rohitravels.com/api/admin/google-sheets/oauth/callback`
   - Local development: `http://localhost:3000/api/admin/google-sheets/oauth/callback`
6. Keep the client secret server-side. Never commit the downloaded OAuth JSON or client secret to GitHub.

Google's web-server OAuth flow requires the redirect URI to be registered and recommends offline access when the application needs to refresh access without the user being present.

## Server environment variables

Set these as deployment/server secrets, not source-code values:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://rohitravels.com/api/admin/google-sheets/oauth/callback
GOOGLE_SHEETS_ALLOWED_EMAIL=rohitravelsryk@gmail.com
ROHI_GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY=...
```

Generate the 32-byte encryption key with Node.js:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The Sheet ID is the value between `/d/` and `/edit` in the Google Sheets URL.

## Database migration

Apply:

`supabase/migrations/20260929005000_google_sheets_oauth.sql`

The OAuth refresh token is stored only in the service-role-accessible table and is encrypted with AES-GCM before storage.

## Authorize the account

1. Sign in to the Rohi Admin Panel.
2. Open **Backup & Disaster Recovery**.
3. In **Google Sheets OAuth**, click **Connect Google Sheets**.
4. Sign in with `rohitravelsryk@gmail.com` and approve the requested Sheets access.
5. Google redirects back to the Admin Backup page.
6. The server stores the encrypted refresh token and uses it for future Sheets API calls.

The browser never receives the refresh token.

## Using the connection from server code

Server-only code can call:

- `getGoogleSheetsAccessToken()`
- `getGoogleSheetsSpreadsheetId()`
- `getGoogleSheetsOAuthStatus()`

The access token is refreshed server-side as needed.

## Important

This OAuth connection does not automatically replace the existing service-account backup. The existing service-account path remains available. The OAuth path is intended for operations where the Google account itself should authorize access to a Sheet.
