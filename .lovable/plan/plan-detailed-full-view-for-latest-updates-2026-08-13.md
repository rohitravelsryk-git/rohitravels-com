# Plan: Detailed Full View for Latest Updates

Implement a full-screen modal or detailed view when a user clicks on an update in the "Latest Updates" page, showing all text and media. Rename "Read More" to "More Info".

## User Review Required

> [!IMPORTANT]
> The full view will display the image (if present), the complete text, the date, and the "More Info" button leading to WhatsApp.

- None.

## Proposed Changes

### UI & Components

#### [Latest Updates Page](src/routes/latest-updates.tsx)
- Add a state to track the currently selected update for the detailed view.
- Implement a modal overlay that appears when an update is clicked.
- Rename "Read More" to "More Info" in both the grid view and the full view.
- Ensure the full view displays the image, all text (with `whitespace-pre-wrap`), and the formatted date.

## Technical Details

- **State Management**: Use `useState` in `UpdatesPage` to manage `selectedUpdate`.
- **Accessibility**: Use appropriate ARIA roles for the modal and ensure it can be closed with the Escape key or by clicking outside.
- **Styling**: Use Tailwind CSS for the modal layout, maintaining the existing navy/gold/cream theme.

## Screenshots

- N/A (UI modifications).
