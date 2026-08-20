# Plan: Booking Cost Calculator & Total Price Displays

Implement a real-time booking cost calculator in the B2B agent portal's booking modal and add "Total Cost" columns to the B2B and Admin booking tables to display the aggregated fare for all seats.

## Proposed Changes

### 1. B2B Portal: Real-Time Calculator in Booking Modal
- Modify `src/routes/_agentapp.agent.fares.tsx` (the booking modal section) to include a "Total Price" summary.
- Display a breakdown: `Price per Seat` × `Number of Seats`.
- Show `Total Cost` prominently, updating instantly as the seat count is adjusted.
- Adopt a layout inspired by the requested "Price/Seat" and "Total Price" design.

### 2. Database Schema: Total Price Storage
- The `agent_bookings` table already stores `seats` and a snapshot of the `fare`.
- I will calculate and display `Total Cost` dynamically in the UI to ensure consistency with current fare snapshots.

### 3. B2B Portal: All Group Bookings Table
- Add a new "TOTAL COST" column to the `agent_bookings` view in the agent portal.
- This will show `fare * seats` for confirmed bookings, helping agents track their total spend.

### 4. Admin Panel: All Group Bookings Table
- Modify `src/routes/admin.bookings.tsx` to add a "Total Cost" column.
- Display the total purchase cost (vendor fare × seats) and sale cost (agent fare × seats) where applicable.
- This will provide admins with a clear view of the financial volume for every group booking.

## Technical Details
- **Dynamic Pricing**: Use the `fare_on_demand` (if set) or the numeric part of `fare_snapshot.price_text` for calculations.
- **Seat Multiplier**: Reactive calculation in the React component using the `pax` array length or `seats` count.
- **Table Density**: Ensure the new column fits within the existing optimized table layout by adjusting column widths.

## Verification Plan
- **Manual Verification**: Launch the booking modal in the B2B portal and verify the total updates as seats are added/removed.
- **Visual Check**: Inspect the Admin and Agent booking tables to ensure the "Total Cost" column aligns correctly and displays accurate calculations.
- **Build Test**: Run `bun run build` to ensure no regressions in the TanStack Start routing or type safety.
