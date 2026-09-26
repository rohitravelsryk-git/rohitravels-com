# Editable grouped Admin Panel menu

## What will change
- Replace the flat row of every admin page button with persistent main menu headings that open organized sub-link panels, matching the supplied reference structure.
- Keep every main heading visible across every Admin Panel page and clearly mark the current page inside its group.
- Add an admin-only menu editor for creating, renaming, and removing main headings; moving existing page links; and adding, editing, or removing custom links.
- Keep staff permissions enforced: staff only see links they are allowed to access and cannot edit the shared menu.
- Use the existing saved menu setting so changes remain consistent across devices.

## Interaction
- Clicking a main heading opens its sub-links; the heading containing the current page remains visually active.
- An Edit menus control exposes management actions without cluttering normal navigation.
- Removing a heading preserves built-in pages by moving them to an available menu; removing a custom link removes only that custom shortcut.
- Mobile uses the same headings and sub-links in its menu drawer.

## Technical details
- Extend the saved menu layout with validated custom link records while remaining compatible with existing saved layouts.
- Render known Admin Panel pages through typed app navigation and custom shortcuts through validated URLs.
- Keep the current admin server-side gate and booking notification count unchanged.
