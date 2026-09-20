# Mobile usability pass for admin and agent portals

## Scope
Improve phone and tablet usability across the existing admin and B2B agent pages without changing colors, typography, business logic, permissions, or desktop styling.

## Implementation
1. **Shared mobile navigation**
   - Convert `AdminTabs` and `AgentTopBar` navigation below 1024px into left slide-out drawers.
   - Add accessible hamburger and close controls, a full-screen backdrop using the existing blur utility, route-change closing, Escape-key closing, and body-scroll locking.
   - Keep the existing desktop tab navigation unchanged at `lg` and above.

2. **Tables and row details**
   - Add horizontal-scroll wrappers to every interactive data table in `admin.*` and `_agentapp.agent.*` routes that does not already have one.
   - Make each wide table’s identifying first column sticky on small screens, while preserving existing desktop table presentation.
   - Reuse existing booking detail expanders where present; add a compact mobile “View Details” disclosure for wide data rows that currently expose actions only across columns.
   - Leave print/PDF ticket-layout tables unchanged because they are fixed-format document canvases, not portal data tables.

3. **Forms and touch targets**
   - Change portal form grids to a one-column base with their current `md`/`lg` column count restored responsively.
   - Move dense row actions into mobile disclosure/dropdown areas while keeping current inline desktop actions.
   - Enforce a 44px minimum touch target for portal navigation, form actions, and row actions below 640px without changing their desktop sizing.

4. **Verification**
   - Run the project’s automatic TypeScript validation and production build checks.
   - Test at 375px on the actual routes `/admin`, `/agent/fares`, and `/agent/bookings` (the project’s equivalents of the requested route names), restoring an authenticated session when available.
   - Confirm the page itself does not scroll horizontally, tables can scroll within their wrappers, drawers open from the hamburger and close correctly, forms stack, and actions meet touch size requirements.
   - Review and report the complete modified-file diff.
