# Premium ticket PDF editor overhaul

## Goal
Replace the current partly simulated editor with one focused, Foxit-inspired ticket workspace for both Admin and B2B Agent users. Keep **Print Tickets** as the normal booking workflow and keep branding plus editing in the same place.

## Changes
- Rework the editor shell into a denser desktop-style interface with a clear title bar, file actions, ribbon tabs, page sidebar, document canvas, properties panel, and bottom status/navigation bar.
- Remove Foxit trademark/clone wording, sample-ticket controls, and automatic sample generation. A booking opens its attached ticket; a standalone editor starts empty and asks for a PDF.
- Make Select mode support mouse-drag selection of original PDF text through the rendered text layer.
- Add keyboard handling:
  - `Delete`/`Backspace` removes the selected added object.
  - When original PDF text is selected, `Delete`/`Backspace` creates a precisely positioned whiteout over that selection.
  - Do not intercept deletion while typing in an input or text box.
  - Add standard undo, redo, save, print, zoom, and escape shortcuts where applicable.
- Make placement tools drag-to-create instead of fixed-size click placement for whiteout, redaction, highlight, underline, strikeout, shapes, lines, arrows, text/form fields, and notes.
- Finish currently exposed tools that are incomplete: underline, strikeout, line, arrow, sticky note, form text, checkbox, custom stamp, formatting, duplication, page rotation/deletion/reordering, signatures, search, zoom, dark mode, and export rendering.
- Add a compact Branding tool group for agency header/footer text, contact details, and stamps without creating a second redundant editor.
- Preserve role permissions: agents get customer-safe ticket tools; admin keeps redaction and page organization controls.
- Keep existing Admin and Agent booking launch points, passing the real ticket URL/bytes. The standalone Print Tickets page can open the editor only after upload.

## Verification
- Check TypeScript and runtime logs.
- Browser-test an actual editor flow at desktop and mobile widths: load PDF, drag-select original text, press Delete to whiteout it, add/edit/remove an overlay, undo/redo, download, and invoke print.
- Confirm Admin and B2B Agent launch points still work and booking/ticket state is untouched.
