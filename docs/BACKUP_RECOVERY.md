# ROHI Backup & Disaster Recovery

## Source of truth

**ROHI WEBSITE → SUPABASE → GOOGLE SHEETS**

Supabase/PostgreSQL is the only authoritative production database. Google Sheets is an emergency, human-readable mirror. No Google worksheet is allowed to become a second financial source of truth.

Credentials, passwords, service-account JSON, authentication secrets and admin credentials are never exported to Google Sheets.

## Emergency financial workbook

The configured emergency workbook is the existing AIRLINE_ACCOUNTS workbook supplied by the owner. The backup flow retains that workbook rather than creating a duplicate Airline Accounts workbook.

The workbook is normalized to exactly five tabs:

1. AIRLINE_ACCOUNTS — airline balances, opening balances and airline transaction/statement details.
2. LEDGER_ACCOUNTS — agent ledger/statement details derived from the authoritative airline ledger.
3. SALE_ACCOUNTS — all Accounts Book transactions classified as sales.
4. BANKS_AND_WALLETS — bank and wallet accounts plus their transactions.
5. CASH_BOOK — cash accounts plus daily cash-book transactions.

Legacy tabs in this emergency workbook are removed during a successful sync. Unrelated Google Drive files are not touched.

## Live sync

Financial changes continue to write to Supabase first. The website then performs a best-effort emergency mirror. The admin Backup page also supports manual refresh.

If Google is unavailable, the website must not switch to Google as a write source. Supabase remains authoritative.

## Snapshots

Snapshot copies are optional and are never mixed into the five-tab emergency workbook. If a snapshot is created, it is placed in a separate ROHI SNAPSHOT ARCHIVE spreadsheet.

## Disaster recovery hierarchy

1. Supabase PostgreSQL — production source of truth.
2. Supabase automated daily backups and, where enabled, PITR — infrastructure/database recovery.
3. Google emergency workbook — human-readable operational mirror.
4. Git repository — source-code and migration recovery.

For strong production recovery, enable Supabase PITR on the production project and keep SSL enforcement, MFA and appropriate network restrictions enabled.

## Security rules

- Never put database passwords, API keys, service-account JSON or tokens in Git.
- Keep service-role credentials server-side only.
- Keep financial tables behind RLS/grants and server-side application gates.
- Fail closed when the financial database cannot be loaded.
- Never create demo/default financial records as a recovery fallback.
- Verify a backup by reading back the destination and comparing revision/row counts where practical.