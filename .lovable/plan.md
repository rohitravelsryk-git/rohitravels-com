# Plan: HD Ticket Printing & Professional Layout Enhancements

Improve the ticket printing quality to HD (A4/Letter size), literalize requested instruction text in headers, and fix stamp reliability with Base64 fallbacks.

## User Improvements
- **HD Ticket Printing**: High-resolution (300dpi-like) PDF generation for tickets in both Admin and B2B portals.
- **Fixed Page Scaling**: Ensures tickets are generated in standard A4 or Letter sizes without shrinking or quality loss.
- **Professional Layout**: Optimized table headers and action buttons for a cleaner, high-contrast look.
- **Permanent Stamp Assets**: Integrated Base64 fallback for all OK TO BOARD stamps (IATA, Salam Air, Travel Advisor) to ensure 100% availability.
- **Literal Instruction Headers**: Displays the requested "Do not make visual modifications..." text in relevant tool headers.

## Technical Details
- **High-Res Rendering**: Implement `html2canvas` with a `scale: 3` factor for high-density captures.
- **PDF Generation**: Use `pdf-lib` to construct A4 (595x842 pts) documents and embed captures as high-quality PNGs.
- **Stamp Fallbacks**: Move stamp Base64 strings to `src/lib/stamp-assets.ts` to prevent duplication and ensure reliability.
- **Component Updates**:
    - `src/routes/admin.ok-to-board.tsx`: Refactor `download` to use HD capture + A4 PDF sizing.
    - `src/routes/admin.bookings.tsx`: Apply literal text in ticket view context.
    - `src/routes/_agentapp.agent.fares.tsx`: Apply literal text and HD printing to the B2B portal.
    - `src/components/AdminHeaderExtras.tsx`: Update header styling for consistency.
- **New Feature**: Add "Non-Refundable" and "Group Ticket" stamps to the OK TO BOARD tool as requested.

## Security & Reliability
- No changes to RLS or authentication.
- Improved reliability of external assets through embedded Base64 fallbacks.
