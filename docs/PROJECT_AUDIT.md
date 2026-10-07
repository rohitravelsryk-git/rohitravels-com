# Rohi Travels — Project Stabilization & Source-of-Truth Audit

**Audit date:** 2026-10-07
**Repository:** rohitravelsryk-git/rohitravels-com
**Database:** Supabase project zxcenmkxxshnlawnwans

## Current source of truth
1. GitHub main is the application source of truth.
2. Supabase migrations committed in supabase/migrations/ are the database source of truth.
3. DESIGN_SYSTEM.md + src/styles.css are the visual/system source of truth.
4. .lovable/plan/ files are historical planning notes, not executable requirements. They must not override the codebase or migration history.
5. Lovable should be used only as a repository sync/build surface; application edits should be made in GitHub.

## Build stability changes completed
- Fixed the broken SiteHeader.tsx JSX nesting that caused the recurring Vite/JSX build failure.
- Pinned CI Bun to 1.4.2 instead of latest.
- Added a TypeScript check before the production build.
- Fixed the security-guard credential scanner so its own regex cannot fail the workflow.
- Removed the unused legacy xlsx exporter and its vulnerable direct dependency.
- Added a deterministic Bun lockfile guard using bun install --frozen-lockfile --dry-run.
- Removed the obsolete src/routes/latest-updates.tsx.bak source file.
- Replaced deprecated TanStack server-function inputValidator usage with .validator().

## Supabase security / data architecture
The public schema currently contains 34 tables. No live table was deleted during cleanup because the reviewed tables are referenced by active application logic.

### Server-only data now explicitly protected
Direct anon / authenticated Data API grants were removed from server-managed financial, credential, backup, vendor, voucher, sticky-note, and airline-ledger tables. Server functions continue to use privileged server-side access.

### Agent data
agent_bookings now has four explicit authenticated-user policies: select/insert/update/delete are restricted to the row owner.
agents browser access is restricted to the authenticated agent's own row for select/update.

### Public data
fares retains one intentional public read policy for non-deleted fares. The duplicate unrestricted fare-read policy was removed.

### Default privileges
New public-schema tables/functions/sequences are no longer automatically exposed to anon / authenticated; future migrations must grant only what a client actually needs.

### Function exposure
Sensitive backup/financial SECURITY DEFINER helper functions had direct public/anonymous/authenticated EXECUTE privileges revoked.

### Database performance
Four missing foreign-key indexes were added: accounts_book_transactions.created_by, agent_bookings.agent_user_id, backup_errors.run_id, vendor_ledger.vendor_id.
Unused-index advisor findings are intentionally not being deleted automatically: low traffic can make a useful index look unused, so removal requires workload evidence.

### Data quality
Reviewed master datasets showed no duplicate airline names, location codes/cities, luggage labels, inquiry-service labels, agent emails, vendor names, account names, or site-setting keys.
Repeated voucher PNRs were inspected and are legitimate multi-passenger records, not duplicate-row cleanup candidates.

## Security findings intentionally remaining
- Supabase leaked-password protection is disabled. This is an Auth project setting and should be enabled in the Supabase Auth password-security settings before final public launch.
- Twelve server-only tables still show the informational RLS enabled/no policy advisor finding. They have no browser Data API grants by design, so the effective protection is the grant boundary plus server-side access. Do not add permissive policies merely to silence the informational linter.
- Dependency audit results must be treated as a release gate; no vulnerability should be fixed by blindly using semver-major/force upgrades.

## Visual/system contract
The existing visual foundation is intentionally retained rather than replaced with another template. It already provides semantic warm-neutral tokens, premium motion/easing, typography, status colors, card/surface shadows, booking/ledger themes, and shared UI primitives.

### Non-negotiable design rules
- No page should invent a new primary color, spacing scale, radius scale, or shadow language.
- Prefer semantic tokens and shared UI components over raw hex/Tailwind one-offs.
- Data labels and database contents must never define the visual hierarchy.
- Missing/empty data must render a designed empty state, not break layout.
- Menu/tab additions must be configuration-driven and route-type-safe.
- Database/table removal must not require visual component rewrites outside the feature boundary.
- No dangerouslySetInnerHTML in application code. Editable HTML must be sanitized and sandboxed.
- Generated routeTree.gen.ts remains generated; route files are the source of routing truth.
- Every schema change requires a committed migration and corresponding RLS/grant review.

## Cleanup policy going forward
Before adding a new table, route, menu item, exporter, or UI primitive:
1. Search for an existing implementation.
2. Reuse or extend the existing system instead of creating a duplicate.
3. Add/update the migration if database structure changes.
4. Add explicit grants/RLS for any Data API exposure.
5. Run TypeScript + production build.
6. Run security checks.
7. Verify the affected user flow before calling the work complete.

This is the project's stability contract: no more ad-hoc fixes that create hidden duplicates or cross-feature breakage.