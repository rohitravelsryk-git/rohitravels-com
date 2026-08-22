# Plan: Unified Booking Management on Bookings Page

To eliminate confusion, I will consolidate all booking information onto the `/agent/bookings` page and simplify the dashboard to act only as a navigation hub.

## Proposed Strategy

### 1. Dashboard Simplification
- Remove the "Recent Booking Updates" table from `src/routes/_agentapp.agent.dashboard.tsx`.
- Keep only the high-level stats cards (All Group Bookings, Group Fares, Ledger).
- This ensures agents always go to the main bookings page for status updates.

### 2. Smart "All Group Bookings" Page (`/agent/bookings`)
I will enhance the main bookings page to make it "smart" and easier to scan:
- **Priority Sorting**: Automatically sort bookings so that "Actionable" ones (Submitted, On Hold, Pending Payment) appear at the top, followed by recently "Confirmed" ones.
- **Visual Highlighting**:
    - Use a subtle background glow or border for "Actionable" bookings (e.g., those missing payment slips).
    - Use a distinct "Confirmed" badge/row style for successful bookings.
- **Improved Filtering**: Ensure the "Ticket Status" filter is prominent so agents can quickly isolate what they need.

## Technical Details

### Frontend Changes
- **src/routes/_agentapp.agent.dashboard.tsx**:
    - Delete the `useEffect` and state related to `recentBookings`.
    - Remove the table UI section.
- **src/routes/_agentapp.agent.bookings.tsx**:
    - Update the `rows` sorting logic: `(a, b) => actionableScore(b) - actionableScore(a)`.
    - Add conditional styling to the table rows based on `ticket_status` and `payment_status`.

---

I have updated the debug instruction in the admin panel and refined the plan to focus all booking management on a single, smart page.