# Complete design-system adoption

## Goal
Apply the warm-minimalist design system to existing and future public, admin, and agent experiences without changing business behavior, booking sync, permissions, exports, or print layouts.

## Current state
- Commit `2f271fa` exists and added the design-system document, four shared primitives, token aliases, and safe head metadata.
- The requested system is not fully adopted: only one route uses `PageShell`, 63 source files still contain hardcoded colors, and the current tokens remain a broader legacy palette.
- This project uses Tailwind CSS v4, so token mappings belong in `src/styles.css`; there is no `tailwind.config.js`.
- TanStack Start owns the document head in `src/routes/__root.tsx`; there is no `index.html`.

## Implementation batches

### 1. Canonical tokens and shared components
- Add the exact requested warm-minimalist semantic tokens and Tailwind v4 mappings in `src/styles.css`.
- Preserve necessary domain/status tokens as semantic aliases to the canonical palette so booking, payment, ledger, and ticket states stay understandable.
- Add the requested page-enter and shimmer utilities with reduced-motion handling.
- Update `PageShell`, `Heading`, `Text`, and `EmptyState` to the final contract.
- Update shared Button, Card, Input, Select, Dialog, Table, Dropdown, and Tooltip styles through their existing variants rather than duplicating styles in pages.

### 2. Existing public pages
- Migrate public content routes to `PageShell`, `Heading`, `Text`, and `EmptyState` in small groups.
- Replace hardcoded visual colors with semantic tokens while preserving current structure, text, links, forms, calculators, and image placement.
- Keep the homepage’s approved composition and fare-card behavior intact.

### 3. Admin and agent portals
- Replace page-level hardcoded colors and duplicate control styling with semantic tokens and shared UI components.
- Preserve all portal parity rules, read-only agency fields, booking status behavior, payment notifications, fare synchronization, tables, mobile drawers, and existing standardized flight details.
- Do not force `PageShell` spacing onto dense operational screens where it would break existing portal layout; use the same tokens and typography inside their existing authenticated shells.

### 4. Security and performance cleanup
- Remove or safely replace visitor-controlled raw HTML rendering; keep only framework/internal style generation that cannot contain user input.
- Keep CSP in report-only mode until the already-requested monitoring period is approved. Before enforcement, allow required Google Fonts, Google Maps, and realtime connections, then use response headers rather than ineffective/unsafe meta-only framing directives.
- Keep secrets server-only and `.env` ignored.
- Complete image metadata gaps and preserve eager loading only for first-fold imagery.
- Do not add blanket route-level `React.lazy`; TanStack Router already code-splits route modules where configured, and forcing wrappers across every route risks SSR regressions.
- Do not alter print media blocks or PDF editor behavior.

### 5. Verification and rollout
- Run TypeScript validation and focused interaction checks after each batch.
- Test public pages plus admin and agent booking/payment/ticket flows at desktop and mobile widths.
- Audit hardcoded colors, image attributes, forbidden brand names, raw HTML, route primitive adoption, and reduced-motion coverage.
- Run the dependency audit without automatic broad upgrades; address only applicable high/critical findings.
- Produce a final evidence report listing completed checks and any justified exceptions.

## Technical notes
- Exact tokens will be exposed through Tailwind v4 `@theme inline`; no legacy configuration file will be introduced.
- Existing data requires no migration: these are presentation and security-boundary changes, so all current and future records inherit the updated rendering.
- The existing report-only CSP will not be silently changed to enforcement in this work.
- Commit/push cannot be performed directly by this environment; completed source changes remain in the project for the managed workspace to version and publish.
