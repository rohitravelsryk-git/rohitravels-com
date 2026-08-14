# Plan: Synchronize Confirmed Bookings to Tickets and Self Group Dashboards

The objective is to ensure that every confirmed booking from the **All Group Bookings** tab correctly generates a record in the **Group Tickets Confirmed** table and subsequently mirrors any "Self" group entries into the **Self Group Dashboards**. I will also ensure previous data is backfilled.

## User Review Required

> [!IMPORTANT]
> This plan will modify how confirmed bookings are handled. If a booking is confirmed, it will automatically create a ticket. If it's a "Self" group, it will also appear in the Self Groups dashboard. I will also run a one-time sync to fix any missing links in existing data.

## Proposed Changes

### 1. Refine Booking Promotion Logic
- Update `promoteConfirmedBooking` in `src/lib/agent-bookings.functions.ts` to be more robust.
- Ensure the `fare_id` is always captured from the snapshot.
- Add logging to track why a promotion might fail (e.g., status not confirmed).

### 2. Strengthen Linkage Logic
- Update `syncSelfTicketsToDashboards` in `src/lib/self-group-link.server.ts` to ensure it captures all missing tickets.
- Ensure it properly handles tickets that were manually added vs. promoted from bookings.

### 3. Data Backfill
- Create a temporary one-time script or server function to scan all "confirmed" bookings and "Self" group tickets to ensure they are properly linked and mirrored.
- Call this backfill function once.

### 4. Admin UI Verification
- Ensure the "Confirm" and "Ticket" buttons in `src/routes/admin.bookings.tsx` correctly trigger these sync processes.

## Technical Details

### Backend Logic
- `src/lib/agent-bookings.functions.ts`:
    - Ensure `promoteConfirmedBooking` handles cases where `tickets` array might be empty initially (especially for "Self" groups where the system generates the manifest).
- `src/lib/self-group-link.server.ts`:
    - Improve `matchSelfFare` to be more inclusive if PNR is missing but itinerary matches perfectly.

### Database Operations
- No schema changes required, as we are leveraging existing `fare_id`, `booking_id`, and `ticket_id` columns.
- The sync will primarily involve `INSERT` or `UPDATE` on `group_tickets` and `self_group_passengers`.

## Verification Plan

### Automated Tests
- I will run a script to verify counts:
    - `count(agent_bookings where status='confirmed')` vs `count(group_tickets where booking_id is not null)`.
    - `count(group_tickets where group_type='self')` vs `count(distinct ticket_id in self_group_passengers)`.

### Manual Verification
- I will use Playwright to:
    1. Confirm a booking in the Admin panel.
    2. Verify it appears in "Group Tickets Confirmed".
    3. Verify it appears in the specific "Self Groups" dashboard.
