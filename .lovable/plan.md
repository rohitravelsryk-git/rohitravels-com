# Submitted booking focus and Fare On Demand flow

## Goal
Make newly submitted admin bookings easier to notice and ensure bookings created without a numeric fare clearly request an admin fare, then show the verified total to the agent automatically.

## Changes
1. **Admin submitted-row focus**
   - Darken the existing warm submitted-row tint only when the **Submitted** filter is active.
   - Keep the current palette, table layout, and all existing actions unchanged.

2. **Fare On Demand prompt**
   - Detect bookings whose original fare is not a valid numeric amount and which do not yet have an admin fare.
   - Show a prominent **Fare On Demand** action in the Booking Total cell so the admin can enter the per-seat fare.
   - Keep the existing verification dialog showing fare per seat, booked seats, and the total sent to the agent.

3. **Agent Booking Total**
   - Before an admin fare is supplied, show **Fare On Demand** only for bookings that were made without a numeric fare.
   - After admin verification, calculate **Booking Total = verified per-seat fare × seats**.
   - Preserve realtime refresh so the updated total appears without reloading.

4. **Safety and verification**
   - Do not change payment or ticket status when setting a fare.
   - Preserve explicit admin-only ticket confirmation and all existing booking synchronization.
   - Run the focused type check and verify the admin and agent booking views.
