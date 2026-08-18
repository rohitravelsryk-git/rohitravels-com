# Plan: High-Definition UI Overhaul for Admin Panel

Redesigning the Admin Panel "Group Fares" tab to match high-fidelity visual references, focusing on high-contrast typography, premium iconography, and crisp layouts.

## User Review Required

- [ ] **Aesthetic Preference**: The plan focuses on a "Midnight High-Contrast" look with gold accents. Does this match your vision of "HD Quality"?
- [ ] **Layout**: "FROM" and "TO" columns will be stacked with city names and airport codes.

## Proposed Changes

### Styling Refinement
- Update `src/styles.css` with a dedicated `admin-hd-table` utility class to ensure sub-pixel rendering and high-contrast text.
- Refine Urdu font sizing and vertical alignment to prevent visual "cramping".

### Admin Panel Redesign (`src/routes/admin.index.tsx`)
- **Table Headers**: Switch to high-contrast Navy (#0A1128) with Gold text.
- **"FROM" & "TO" Columns**: Implement stacked layout:
  - Top: City name (e.g., "KARACHI") in Bold Navy.
  - Bottom: IATA code (e.g., "KHI") in muted grey/navy.
- **Flight Details**: Use a cleaner mono-font with increased letter spacing for legibility.
- **Actions**: Replace text buttons with clean, HD icons (Lucide-react) for a modern look.

### Format Maker Upgrade (`src/components/FormatMakerDialog.tsx`)
- Improve the output preview to show exactly how the high-quality text will look on WhatsApp.

## Technical Details

- Using CSS `font-smoothing: antialiased` for crisper text.
- Implementing `leading-tight` and `tracking-tighter` on city labels to match high-end travel booking UI.
- Leveraging `lucide-react` for vector-based icons that remain sharp at any scale.
