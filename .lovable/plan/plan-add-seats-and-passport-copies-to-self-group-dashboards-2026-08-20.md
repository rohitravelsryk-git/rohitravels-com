# Plan: Add Seats and Passport Copies to Self Group Dashboards

Add "SEATS" and "PASSPORT COPIES" columns to the passenger tables within the Self Group dashboards in the admin panel. These columns will display data from the associated agent group booking (stored in `agent_bookings`) when a passenger is linked to a booking.

## User Review Required

> [!IMPORTANT]
> The "Seats" column will show the specific seats assigned to the booking (e.g., "1" if a single seat was booked, or the booking's total seat count if it was a group booking). The "Passport Copies" column will provide links to the documents uploaded by the agent during the B2B booking process.

## Proposed Changes

### Database & Types
- Update `SelfGroupPassenger` type in `src/lib/self-groups.functions.ts` (if needed) to ensure it can reflect linked booking data.
- *Note:* The data is already available in the `agent_bookings` table, which we can join or look up by `ticket_id` -> `booking_id`.

### Admin Panel UI
#### `src/routes/admin.self-groups.tsx`
- **Passenger Table Header:** Add "SEATS" and "PASSPORT COPIES" column headers to the `PassengersTable` component.
- **Passenger Table Rows:** Update `PaxRow` to:
    - Look up the associated booking for the passenger (via `ticket_id`).
    - Display the booking's seat count.
    - Display links/icons for any passport copies found in the booking's `attachments`.
- **HD Export:** Update Excel, CSV, and PDF export logic to include these two new columns.

## Technical Details

- The `Panel` component already fetches `tickets` (`GroupTicket[]`).
- `GroupTicket` has a `booking_id` field.
- We need to fetch `agent_bookings` (or use a server function) to get the `attachments` and `seats` for those bookings.
- Since `self_group_passengers` are created from `agent_bookings` (via `promoteConfirmedBooking`), each passenger linked to a `ticket_id` can be traced back to its parent booking.
- I will add a `useQuery` to fetch all `agent_bookings` in the `Panel` component to allow for efficient lookup without per-row fetches.
- "Passport Copies" will be rendered as clickable links or icons (e.g., `Paperclip` or `FileText`) using the attachment data from the booking.
