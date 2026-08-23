# Plan: Redo Seat Logic, OTP, and Smart UI Enhancements

I will synchronize the seat availability logic across the B2B portal and admin panel to ensure accurate inventory tracking. I will also implement mandatory OTP verification for agent bookings (when enabled) and refresh the B2B upload UI with a modern, placeholder-driven aesthetic.

## User Review Required
> [!IMPORTANT]
> The OTP verification will be active for agents who have "MFA Enabled" in their profile. If you want this to be mandatory for *all* agents regardless of their profile setting, please let me know.

- **Seat Availability**: If a "Karachi Dammam" fare has 9 seats and 6 are booked (confirmed/submitted), it will correctly show "3 out of 9".
- **Admin Notifications**: A badge will show the number of new (submitted) bookings in the admin sidebar/tabs.

## Proposed Changes

### Backend & Logic
#### [agent-fares.functions.ts](src/lib/agent-fares.functions.ts)
- Redo `getSectorSoldCounts` to aggregate seats from both `agent_bookings` AND `group_tickets`.
- Ensure isolation by `fare_id` so sectors with multiple group types/dates remain independent.

#### [agent-bookings.functions.ts](src/lib/agent-bookings.functions.ts)
- Add `countSubmittedBookings` server function to return the total number of unread (submitted) bookings.

### Admin Panel
#### [AdminTabs.tsx](src/components/AdminTabs.tsx)
- Integrate a real-time badge for the "Agent Group Bookings" tab using the new `countSubmittedBookings` function.

### B2B Agent Portal
#### [_agentapp.agent.fares.tsx](src/routes/_agentapp.agent.fares.tsx)
- Verify `BookingModal` correctly isolates seat counts by `fare_id`.
- Ensure the OTP flow is prominent and correctly handled during the two-step confirmation process.

#### [_agentapp.agent.bookings.tsx](src/routes/_agentapp.agent.bookings.tsx)
- Overhaul the upload buttons in the "Visa Copies" and "Payment Status" columns.
- Use dashed borders and placeholders for "Upload Visa Copy" and high-contrast navy styling for "Upload Payment Slip" as per the provided reference image.

### Database
- No schema changes required; utilizing existing `agent_bookings` and `group_tickets` tables.
