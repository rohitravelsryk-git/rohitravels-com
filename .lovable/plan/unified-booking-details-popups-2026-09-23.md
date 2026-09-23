# Unified booking details popups

## Goal
Make the booking detail view consistent in the B2B **All Group Bookings**, admin **Agents Group Bookings**, and admin **Group Tickets Confirmed** pages.

## Changes
- Create one shared booking-details popup so all three pages use the same Rohi Warm Clay layout and remain visually synchronized.
- Match the **Book Fare → Confirm Booking** passenger table: numbered rows, separate Given Name and Surname columns, uppercase names, stable widths, alternating rows, and a scrollable list for larger groups.
- Use the same standardized flight display as the All Group Bookings table: route cities, airport codes, airline, segment lines, and baggage in the same order and typography.
- Add the matching locally stored official airline artwork beside the airline name, with a clean fallback when no airline artwork is available.
- Keep each page’s existing booking totals, agency information, payment/document links, ticket controls, editing, confirmation rules, and realtime behavior unchanged.
- Add or update the eye-shaped **View booking** control in both admin tables so it opens this same popup.

## Verification
- Check all three popups with single and multiple passengers, connecting flights, baggage, and missing-logo data.
- Verify desktop and phone layouts and confirm the popup stays above the page.
- Run the project type check and confirm booking/payment/ticket synchronization logic was not changed.
