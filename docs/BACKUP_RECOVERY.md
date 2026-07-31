# Backup & Disaster Recovery — Architecture and Procedures

Master spreadsheet: **ROHI INTERNATIONAL TRAVELS MASTER BACKUP** (created automatically in the
connected Google account, one worksheet per database table).

## Components

| Piece | Where | Purpose |
| --- | --- | --- |
| `backup_tables` | database | registry of every table in the backup, its worksheet, on/off switch, incremental cursor |
| `backup_runs` | database | history of every sync/backup run (kind, status, tables, rows, errors) |
| `backup_errors` | database | per-row validation problems and per-table failures |
| `backup_snapshots` | database | point-in-time full copies (`SNAP <timestamp> <Table>` worksheets) |
| `backup_settings` | database | stores the linked spreadsheet id |
| `backup_list_tables()` / `backup_fetch_rows()` / `backup_count_rows()` | database (server-only) | auto-discovery and paged change reads; new tables are found without code changes |
| `src/lib/backup/sheets.server.ts` | server | Google Sheets calls through the Lovable connector gateway, with retry + exponential backoff on 429/5xx |
| `src/lib/backup/engine.server.ts` | server | discovery, registry sync, per-table incremental upsert, full rebuild, snapshots |
| `src/lib/backup.functions.ts` | server fns | admin-session-gated dashboard data and actions |
| `src/routes/api/public/hooks/backup-sync.ts` | HTTP | scheduled entry point, authenticated with the project publishable key |
| `/admin/backup` | UI | health dashboard, manual sync, snapshots, per-table controls, error log |

## Sync model

* **Incremental (default, every 5 min).** For each enabled table the engine reads rows whose
  `updated_at` (or `created_at`) is newer than the stored cursor, reads column A of the worksheet
  (always the record id), updates matching rows in place and appends new ones. Idempotent: the same
  row can be synced repeatedly without duplicating.
* **Full (hourly, and on demand).** Worksheet is cleared and rewritten from the complete table.
  Also triggered automatically for a single table when its header row no longer matches the table's
  columns — schema changes self-heal.
* **Snapshots (daily 02:00, weekly Sun, monthly 1st, and on demand).** Each table is written to a
  new timestamped worksheet. Previous snapshots are never overwritten.
* Validation: rows without an id are skipped and logged; duplicate ids are skipped and logged. One
  bad row never aborts a run. Table-level failures are logged and the run continues with the rest.
* Credential tables (`admin_credentials`, `admin_password_resets`) are deliberately excluded.
* File/image columns are backed up as their stored URLs/metadata; the files themselves remain in
  storage.

## Scheduled jobs

`cron.job` entries: `rohi-backup-incremental` (*/5), `rohi-backup-hourly-full` (hourly),
`rohi-backup-daily-snapshot`, `rohi-backup-weekly-snapshot`, `rohi-backup-monthly-snapshot`.
All call `POST /api/public/hooks/backup-sync` with `apikey` and a `mode` of ``/`full`/`snapshot`.

## Recovery procedure (current capability)

1. Open the master spreadsheet (button on `/admin/backup`).
2. Identify the worksheet — live mirror (e.g. `Group Fares`) or a `SNAP …` snapshot tab.
3. Row 1 holds the exact database column names; column A is the record id, so the sheet is a
   complete, self-describing export of every record including ids and timestamps.
4. Rebuild: the sheet can be re-imported into the database column-for-column.

Automated one-click restore (entire database / one table / one record / one snapshot) and reverse
sync (edits made in Sheets flowing back into the database) are the next phase, together with soft
delete, per-field version history and the audit trail.

## Health monitoring

`/admin/backup` refreshes every 30 seconds and shows backup health %, last successful backup,
connection status for Google and the database, rows synced per table, newly detected tables awaiting
registration, and the most recent errors/warnings.
