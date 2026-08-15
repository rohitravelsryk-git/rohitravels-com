# Plan: Unified Admin Notification Center

The goal is to consolidate all administrative alerts into a single, high-impact "Notifications Center" using a WhatsApp-style UI. This replaces confusing split alerts (popups + notifications) with one clear source of truth.

## User Interface

- **Admin Notification Center**: A dedicated side panel (accessible via the bell icon in the header) that lists all pending actions.
- **WhatsApp-Style Aesthetic**:
  - Circular icons with badges.
  - "New" indicators for unread items.
  - Clear "Reply" or "Take Action" buttons on each card.
  - Grouping by category: *New Bookings*, *New Agents*, *Ticket Reminders*, and *Customer Queries*.
- **Improved Toast Notifications**: Replacing standard browser popups with an in-app "Flash Notification" that mimics the WhatsApp toast style (cleaner, stays for 5s, clickable).

## Technical Details

- **Consolidated Component**: Refactor `src/components/AdminNotifications.tsx` to be the primary engine. It will poll multiple sources (bookings, agents, tickets, queries) and merge them.
- **Centralized Management**:
  - **New Agents**: Add `listPendingAgents` to the notification feed.
  - **Booking Requests**: Direct link to the specific booking in the admin panel.
  - **Ticket Reminders**: Integrate the "Scan" action directly into the notification list.
- **Visual Polish**: Use the navy/gold/white palette for consistency with the "Premium Ledger" aesthetic.

## Implementation Steps

1.  **Refactor `AdminNotifications.tsx`**:
    - Add `listAgentsAdmin` to the polling logic.
    - Redesign the list items to match the WhatsApp notification style (larger text, better spacing).
    - Add a "Quick Action" button for each item (e.g., "Approve Agent" or "View Booking").
2.  **Clean up redundant alerts**:
    - Remove individual `useEffect` notification logic from `admin.bookings.tsx` and `admin.agents.tsx`.
    - Ensure only the central bell icon and the unified popup system are used.
3.  **Enhance the Header**:
    - Update `AdminHeaderExtras.tsx` to show a single unified count on the Bell icon.
    - Ensure the Bell icon pulsates when there are unread critical items (new bookings/agents).
