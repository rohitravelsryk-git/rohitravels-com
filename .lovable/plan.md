# Plan: Premium B2B Agent Ledger and Exports

## Outcome
Refresh the B2B Agent Ledger so its typography, balances, controls, table alignment, and exported files match the polished Discount Vouchers experience.

## Changes
- Rework the ledger header and Outstanding Balance emphasis using the existing Claude-inspired cream, near-black, terracotta, and sage theme.
- Use the project Button component for Print, Excel, and PDF controls with clear, consistent colors.
- Restyle the ledger table with compact spacing, white column headings, stable column widths, readable figures, and responsive horizontal scrolling.
- Make **Print** open the browser's standard print dialog so users can select printer, pages, paper size, orientation, and other system options.
- Make **Excel** download a real `.xlsx` workbook and **PDF** download a portrait A4 file directly, using the same shared export flow as Discount Vouchers.
- Extend the shared exporter with a consistent premium document theme, proper headings, row spacing, numeric alignment, auto-sized columns, print settings, and page numbering so all future shared exports use the same look.

## Technical Details
- Replace ledger-specific ExcelJS/jsPDF code with `downloadExcel` and `downloadPdf` from the shared exporter.
- Keep all ledger calculations, realtime updates, booking rules, and admin/agent data synchronization unchanged.
- Verify TypeScript and inspect the ledger at desktop and mobile widths where authentication permits.
