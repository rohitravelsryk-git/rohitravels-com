# Print Format: rename button and move Header & Footer into the PDF Editor

## What changes
1. **Rename the button** on `/print-format` from "Open Ticket Canvas Studio & Print" to **"PDF Editor"**. Same colour, icon and behaviour (opens the editor popup).
2. **Header & Footer inside the PDF Editor.** The editor popup gets a "Header & Footer" panel with the same controls that sit on the page today:
   - Remove header, footer & agent details
   - Apply to pages (All / None / per page)
   - Agency name, phone, address, tagline, logo and footer note
3. Changes made in the editor's panel show on the ticket straight away and stay in step with the page settings, so nothing is lost when the popup is closed.
4. The Header & Footer box on the main page will be **kept** as it is, unless you say it should be removed and only appear inside the editor.

## Not changed
- Ticket upload, printing, downloads and saving to the booking.
- Agent portal Print Tickets keeps working the same way (agency details stay read-only there).
- No database or financial records are touched.

## Technical details
- `src/routes/print-format.tsx` line ~1638: button label.
- Pull the Header & Footer block (lines ~1665 onward) into a shared component, render it on the page and pass it into `TicketPDFEditorModal` as a side panel, using the same state setters (`noBrand`, `headerFooterPages`, agency fields, logo).

## Approval
Your standing rule says nothing is built without the words **"approved build"**. Reply "approved build" to go ahead, and say whether the Header & Footer box should also stay on the main page.
