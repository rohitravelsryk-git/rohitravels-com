# Restoration and Fix Plan - Admin Panel

The admin panel in `src/routes/admin.index.tsx` was corrupted during previous edits, leading to a "Crawling result not available" build error and missing functionality. This plan restores the `AdminPanel` component, resolves syntax errors, and ensures the deletion logic (bypassing password for 'party' fares) is correctly implemented.

## User Review Required

> [!IMPORTANT]
> This will restore the main Admin Panel UI which was accidentally corrupted. All previously requested features (like the specific deletion logic for 'party' vs 'self' fares) will be preserved.

## Proposed Changes

### Admin Panel Restoration
- Reconstruct the `AdminPanel` component body.
- Re-implement all necessary states: `search`, `filterOrigin`, `filterDest`, `filterType`, `showSettings`, `showFormatMaker`, `showChangePw`, etc.
- Restore data fetching for fares, airlines, locations, luggages, and tickets.
- Fix the `AdminTabs` integration and overall layout.

### Deletion Logic Fix
- Correct the `doDelete` and row-level delete logic to ensure 'party' fares can be deleted with a simple confirmation, while 'self' fares require the admin password modal.
- Fix the syntax error (invalid elision `...`) on line 641.

### UI/UX Restoration
- Restore the "Add New Fare" row at the top of the fares table.
- Restore the filter bar for searching and narrowing down fares.
- Ensure the "Format Maker" and "Themes" buttons are correctly placed.

## Technical Details

- **File**: `src/routes/admin.index.tsx`
- **Logic**: Use `useQuery` for data fetching and `useServerFn` for mutations.
- **Syntax**: Ensure all JSX tags and JS expressions are properly closed.
- **Permissions**: Ensure staff-restricted tabs are respected based on the `status.staffTabs` prop.
