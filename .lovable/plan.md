# Plan: Overhaul Ledger Design & Excel/PDF Buttons

The user wants to overhaul the B2B agent ledger design to match a provided screenshot (Warm Paper Ledger style) and ensure Excel/PDF download buttons are styled consistently across the app.

## Proposed Changes

### 1. Unified Excel & PDF Button Design
- Define a standard visual style for download buttons in `src/styles.css`.
- Screenshot shows:
  - Green pill for **Excel** with a spreadsheet icon.
  - Red/Pink pill for **PDF** with a document/download icon.
  - Rounded corners, bold white text, and clear icons.
- Apply this style to:
  - B2B Agent Ledger (`src/routes/_agentapp.agent.ledger.tsx`)
  - Admin Booking Requests (`src/routes/admin.bookings.tsx`)
  - Admin Confirmed Tickets (`src/routes/admin.tickets.tsx`)
  - Admin Queries (`src/routes/admin.queries.tsx`)
  - Self Group Dashboards (`src/routes/admin.self-groups.tsx`)

### 2. Overhaul B2B Agent Ledger
- Modify `src/routes/_agentapp.agent.ledger.tsx` to match the "Rais Air Travels Statement" screenshot.
- **Top Header Block:**
  - Red background header with "ROHI" branding.
  - Business name "Rohi International Travels" and phone.
- **Summary Row:**
  - "Rais Air Travels Statement" (dynamic agent name).
  - Summary grid with: No of Entries, Total Debit (DR), Total Credit (CR), Net Balance.
  - Colors: Red for DR, Green for CR.
- **Table Design:**
  - "Warm paper" background (already defined in `styles.css` as `sheet-paper`).
  - Columns: Date, Details, Debit (-), Credit (+), Balance.
  - Alternating light red/green tints for debit/credit columns.
  - "Balance" column showing DR/CR suffix.
  - Opening balance row.

### 3. Refine PDF Generation
- Update `downloadPDF` in the ledger to match the new visual structure:
  - Branding at top left.
  - Statement summary table before the main transaction ledger.
  - Landscape layout with proper column widths.

## Technical Details
- Use Tailwind utility classes for the new button styles.
- Leverage existing `sheet-paper` and `ledger-figures` utilities from `styles.css`.
- Ensure the agent's business name is pulled from their profile/agency data for the "Statement" heading.
- Update `jspdf` and `jspdf-autotable` logic to include the summary header in the PDF.

## User Review Required
- The screenshot shows "DR" (Debit) and "CR" (Credit) indicators. I will implement these based on standard accounting: Debit increases what is owed to the travel agency, Credit is payment received.
- I will apply the Excel/PDF button styles wherever a "Download" or "Export" action currently exists.
