# Admin Group Bookings operational dashboard

## Goal
Replace the current step-by-step booking cards with a premium, responsive command table that matches Rohi’s warm Claude-inspired theme and the B2B agent portal, while keeping all admin data and controls available.

## Chosen direction
Use a dense operational table rather than cards, steppers, kanban columns, or generic View/More menus. This gives the admin the clearest scan of every booking and the fastest access to the correct next action.

## Changes
1. **Dashboard summary and filters**
   - Keep concise clickable totals for action required, all bookings, payment pending, and confirmed tickets.
   - Preserve search, status filters, live updates, and document cleanup.

2. **Complete booking table**
   - Show booking reference/date, agency/contact, complete standardized flight details, passengers/seats, per-seat fare and total, payment state, passport/payment-slip state, ticket state, and actions.
   - Use the same near-black header, warm off-white surfaces, terracotta accent, sage success, rose warning, Inter typography, compact spacing, and restrained motion as the rest of the site.
   - Keep booking identity and actions reachable on narrow screens with horizontal scrolling and sticky columns.

3. **Action-oriented controls**
   - Remove the step tracker and remove generic View/More buttons.
   - Show contextual controls directly: set fare, payment status, passport/payment documents, upload/remove ticket, put on hold, confirm, edit, and delete.
   - Show passenger details inline through a clearly named disclosure, not a generic View button.
   - Keep Confirm disabled until a ticket is attached. Uploading a ticket or receiving payment must never confirm the booking automatically.

4. **Safety and verification**
   - Preserve the server-side admin gate, realtime refresh, fare calculation, document storage, agent synchronization, and explicit admin confirmation rule.
   - Verify TypeScript, desktop layout, mobile overflow/touch controls, and the main status/document actions.
