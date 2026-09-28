# Airline Ledger → Google Sheets Backup

## Data authority

**Supabase is the only authoritative financial ledger. Google Sheets is a one-way read-only mirror.**

No website action, Google Sheet edit, or Google connector can write back into the airline ledger.

## Required server secrets

Configure these on the production server (never in source control):

- `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete Google Cloud service-account JSON credential.
- `ROHI_AIRLINE_LEDGER_SHEET_ID`: the spreadsheet ID from the Google Sheets URL.

The service account email must be granted **Editor** access to the target spreadsheet so the server can maintain the mirror. Do not share the private key with staff or put it in browser/client environment variables.

## Backup tabs

The integration creates/maintains these dedicated tabs:

- `AIRLINES`
- `AGENTS`
- `TRANSACTIONS`

Every successful Supabase ledger save triggers a downstream mirror of the exact saved database snapshot and revision.

## Failure behavior

If Google Sheets is unavailable:

1. The Supabase financial save remains successful.
2. The Google sync status is recorded as `error`.
3. No Google data is imported into Supabase.
4. The next successful ledger save can retry the mirror.

This intentionally prevents a backup-service outage from risking the primary financial ledger.

## Google setup

1. Create/select a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account and download its JSON key.
4. Create the destination Google Sheet.
5. Share the Sheet with the service-account email as Editor.
6. Configure the two server secrets above.
7. Apply the Supabase migration:
   `supabase/migrations/20260928193000_airline_ledger_google_sheet_sync.sql`
8. Make one harmless airline-ledger edit/save and verify the three backup tabs and the sync status.

Never configure a Google Sheet formula, Apps Script, Zapier/Make workflow, or connector that writes back to the Supabase airline-ledger tables. The direction must remain:

**Supabase → Google Sheets only.**
