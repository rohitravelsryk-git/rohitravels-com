# Admin Scratchpad Feature

Implement a persistent, editable "Scratchpad" (Composed Message) in the Admin Group Fares panel to store and quickly copy marketing text or data, with country flag support based on group sectors.

## User Review Required

> [!IMPORTANT]
> - The scratchpad will be local to the admin's current browser session (using `localStorage`) by default for instant persistence, but I can link it to the database if you need it to be shared across different computers.
> - Flags will be automatically determined based on the destination airport codes in the fares you've added.

## Technical Details

### State Management
- Create `AdminScratchpad` component to handle editing and saving the composed message.
- Use `localStorage` for "save-as-you-type" functionality.
- Integrate `buildFareShareText` from `src/lib/fare-format.ts` for consistent flag generation logic.

### UI Implementation
- Position a sticky/collapsible drawer or side-bar in `src/routes/admin.index.tsx`.
- Design: Navy/Gold theme to match the existing admin aesthetics.
- Features: "Copy to Clipboard", "Clear", "Auto-Format from Selection".

### Data Model
- If DB persistence is requested: Add `admin_scratchpad` table to Supabase.
- Current plan: Client-side only for zero-latency editing.

## Working Steps

1. **Component Creation**: Develop `AdminScratchpad.tsx` with a rich text area or standard text area styled professionally.
2. **Flag Logic**: Expose a helper in `src/lib/fare-format.ts` to get flags by country/airport.
3. **Integration**: Mount the scratchpad in `src/routes/admin.index.tsx` as a floating or sticky element.
4. **Copy Functionality**: Add one-click copy and "append fare data" shortcuts.
