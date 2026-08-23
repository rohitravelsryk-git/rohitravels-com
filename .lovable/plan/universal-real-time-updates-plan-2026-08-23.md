# Universal Real-time Updates Plan

The goal is to ensure all changes made in the Admin Panel reflect instantly in the B2B Agent Portal and the public website without requiring a page refresh. We will utilize Supabase Realtime across all relevant tables.

## Proposed Changes

### Database & Backend
- Ensure all relevant tables (`fares`, `agent_bookings`, `group_tickets`, `bank_details`, `b2b_sticky_notes`, `announcement_banner`, `queries`) have Realtime enabled in the database.

### Frontend Components & Routes

#### 1. B2B Agent Portal Updates
- **Fares Page (`src/routes/_agentapp.agent.fares.tsx`)**:
  - Optimize the existing `agent-fares-realtime` channel.
  - Instead of a full `loadData()` which refetches everything, implement partial state updates for row modifications (UPDATE/DELETE) while still supporting a refresh for complex changes.
  - Reduce polling interval for sold counts or switch to realtime for `agent_bookings` and `group_tickets`.

#### 2. Admin Panel Updates
- **Main Fares Tab (`src/routes/admin.index.tsx`)**:
  - Add a realtime listener for the `fares` table to update the list immediately when a fare is added, edited, or deleted.
- **Agent Group Bookings (`src/routes/admin.bookings.tsx`)**:
  - Add realtime listeners for `agent_bookings` to show new "Submitted" requests instantly.
- **Self Group Dashboards (`src/routes/admin.self-groups.tsx`)**:
  - Add realtime listeners for `agent_bookings`, `group_tickets`, and `self_group_passengers`.
- **Group Tickets Confirmed (`src/routes/admin.tickets.tsx`)**:
  - Add realtime listeners for `group_tickets`.
- **Bank Details (`src/routes/admin.bank-details.tsx`)**:
  - Add realtime listeners for `bank_details`.

#### 3. Public Website Updates
- **Homepage Fares (`src/routes/index.tsx`)**:
  - Add realtime listener for the `fares` table to reflect price changes or "Sold" status instantly for customers.

#### 4. Shared Components
- **Announcement Banner (`src/components/AnnouncementBanner.tsx`)**:
  - Ensure the banner updates instantly when toggled or changed in the admin panel.

## Technical Details

- **Supabase Realtime Channels**: We will use unique channel names for each view (e.g., `admin-bookings-sync`, `public-fares-sync`).
- **Data Freshness**: When a `postgres_changes` event is received, we will trigger a React Query invalidation or a state refetch.
- **Optimistic Updates**: For admin actions, we will use React Query's `onMutate` to provide immediate feedback before the server responds.

## User Impact
- No more manual refreshing to see if an agent has made a booking.
- Agents see price updates and seat availability changes the moment they happen.
- Universal "Live" feeling across the entire platform.
