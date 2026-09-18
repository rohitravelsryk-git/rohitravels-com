# Premium All Group Bookings Table

## Goal
Make the B2B agent portal's **All Group Bookings** table feel premium, easier to scan, and strongly action-oriented without changing booking, payment, ticket, or synchronization logic.

## Design direction
- Use the existing Claude-inspired warm cream, near-black, terracotta, sage, and muted rose palette.
- Give column headings the strongest visual hierarchy with a warm dark header band, crisp alignment, and stable column widths.
- Keep rows clean and restrained: booking reference and route are prominent; dates and supporting text are quieter; avoid unnecessary bold text.
- Align every value directly beneath its heading and vertically center compact controls.

## Table and actions
- Replace the text **View** control with an Eye icon-only button, including an accessible label and tooltip.
- Rename the final column to **Tickets & Actions** and keep all ticket controls there.
- Place Ticket Download and Print/Edit as separate icon-only controls in that column, with tooltips and accessible labels.
- Make **Payment Status** the visual focus using clear status badges:
  - Unpaid/Pending: terracotta action badge with restrained Framer Motion pulse.
  - Received/Paid: sage success badge.
  - Added in Ledger: neutral badge.
  - Refunded: muted rose badge.
- Put **Upload Slip** beside the pending payment badge as the primary row action so agents immediately know what to do.
- Keep ticket status visually secondary and use concise labels such as Submitted, On Hold, and Confirmed.

## Responsive behavior
- Preserve a structured desktop table with deliberate widths so controls do not drift between columns.
- On narrow screens, keep horizontal scrolling and sticky first/action columns where practical so booking identity and actions remain reachable.
- Maintain stable control dimensions to prevent rows shifting while uploads or animations run.

## Safety and verification
- Change presentation only; preserve live loading, realtime updates, filtering, uploads, ticket downloads, PDF editing, standardized flight details, ticket status rules, and group-fare synchronization.
- Verify desktop and mobile layouts, icon tooltips, pending-payment animation, upload behavior, and ticket controls.
- Run the project code check after implementation.
