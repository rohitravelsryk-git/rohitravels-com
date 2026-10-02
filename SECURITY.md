# Security Policy

ROHI International Travels treats Supabase as the authoritative production database. Google Sheets is an emergency read-only mirror for operational visibility and recovery assistance.

## Rules
- Never commit passwords, API keys, service-account JSON, database URLs, or tokens.
- Production secrets must live only in the hosting provider or GitHub Actions secrets.
- Financial writes must remain server-side and transactional.
- Google Sheets must never be used as the primary financial database.
- Security failures must fail closed rather than creating demo/default financial records.
- Backups must be tested by restoring or validating data, not merely by confirming that a sync job ran.

## Reporting
Report suspected vulnerabilities privately to the site owner/maintainer. Do not publish credentials, exploit details, or customer data in an issue.

## Recovery
The production database is recovered from Supabase backups/PITR. Google Sheets is an emergency human-readable mirror, not a replacement for PostgreSQL.
