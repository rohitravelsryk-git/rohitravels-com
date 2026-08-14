# Plan: B2B Booking and Fare ID Fixes

Refine the B2B agent portal booking flow and seat tracking system to ensure precise inventory management, Fare ID visibility, and improved UX for self-groups.

## Proposed Changes

### 1. B2B Booking Flow (src/routes/_agentapp.agent.fares.tsx)
- **Conditional "Book Full Group"**: Enable the button only when the `group_type` is "Self".
- **Passenger Pre-filling**: Re-implement the automatic pre-filling of passenger rows with placeholders (e.g., "PAX 1 SEAT", "PAX 2 SEAT") when "Book Full Group" is clicked for a Self group.
- **Seat Availability Logic**: Update the display logic to show `Remaining out of Total` (e.g., "3 out of 5") instead of just the remaining count. Ensure the "Total" part remains constant when seats are sold.

### 2. Admin Fare ID Visibility
- **Admin Fares Table (src/routes/admin.index.tsx)**: Add a column or tooltip to display the `Fare ID` (the UUID from the database) for each entry in the Group Fares tab.
- **Self Group Dashboard (src/routes/admin.self-groups.tsx)**: Display the `Fare ID` prominently in the group header or details section for each self-group card.

### 3. Seat Tracking Fixes
- **Inventory Precision**: Audit and fix the aggregation logic in `src/lib/agent-fares.functions.ts` to ensure `getSectorSoldCounts` (which aggregates by `fare_id`) is correctly reflecting all confirmed bookings.
- **Unified Count Display**: Synchronize the seat display logic across all three areas mentioned by the user (Agent Portal, Admin Group Fares, and Self Groups Dashboard) to use the same isolated `fare_id` based count.

### 4. Code Cleanup
- Remove redundant seat parsing or counting logic that might be causing the "wrong number of seats" discrepancy between screens.

## Technical Details
- Update `parseSeatsTotal` helper to return both available and total values as a tuple or object to simplify display.
- Ensure `listBookingsAdmin` and `listTickets` are consistent in how they filter/count seats for a specific `fare_id`.
- Add a new "ID" column to the `AdminPanel` table in `src/routes/admin.index.tsx`.

## Verification Plan
- **B2B Test**: Open the booking modal for a "Party" group (button disabled) and a "Self" group (button enabled). Click "Book Full Group" and verify rows are pre-filled.
- **Seat Tracking Test**: Confirm a booking for a specific `fare_id` and verify that the count updates correctly on all three pages (Admin Index, Admin Self-Groups, Agent Fares) without affecting other fares on the same route.
- **Visual Check**: Verify Fare IDs are visible in the Admin panel.
