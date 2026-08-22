# Plan: Optimized Booking Management Strategy for B2B Agents

To eliminate confusion and data duplication, I will unify the booking views by distinguishing between "Actionable Insights" (Dashboard) and "Complete Record" (All Group Bookings).

## User Review Required

> [!IMPORTANT]
> - **Dashboard**: Should it strictly show only *pending* actions (e.g., "Awaiting Payment Slip") to keep the agent focused on what's next?
> - **All Group Bookings**: Should we add a "Quick Filter" bar here to mirror the dashboard's "Recent Updates" categories (Submitted/On Hold) for consistency?

## Proposed Strategy

### 1. Dashboard: Focus on "Next Steps" (Actionable)
Instead of just "Recent Updates," the dashboard will focus on **Bookings Requiring Action**.
- Filter strictly for `Submitted`, `On Hold`, or `Pending` statuses.
- Add a "Next Step" column (e.g., "Upload Payment Slip" or "Awaiting Admin Approval").
- Limit to 5-10 rows to keep it clean.

### 2. All Group Bookings: Focus on "Full Lifecycle" (Comprehensive)
The main bookings page will remain the single source of truth for every booking ever made.
- Shows all statuses: `Confirmed`, `Cancelled`, `Submitted`, etc.
- No changes to the core data structure to avoid duplication.
- Data on the Dashboard is simply a *filtered pointer* to this table.

## Technical Details

### Frontend Changes
- **src/routes/_agentapp.agent.dashboard.tsx**:
    - Update query to prioritize bookings where `payment_status` is 'unpaid' AND `ticket_status` is 'submitted' or 'on hold'.
    - Add a "Action Needed" badge to clearly signal why the booking is on the dashboard.
- **src/routes/_agentapp.agent.bookings.tsx**:
    - Maintain the comprehensive view but ensure status labels (Pills) match the dashboard exactly.

### Backend/Logic Sync
- Ensure `ticket_status` and `status` columns are used consistently across both views.
- Implement a shared `BookingStatusPill` component to ensure visual consistency.

---

I have updated the debug instruction in the admin panel and prepared this plan to optimize your agent portal's booking workflow.