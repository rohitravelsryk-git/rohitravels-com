# Redesign Latest Updates and Announcement Banner

The user wants to redesign the "Latest Updates" section to look more like a social media feed ("recent post with captions") and remove the "Text/Image/Video" classification (screenshot 1/screenshot 3). They also mentioned that when a notification occurs, it shouldn't show this text/image label under menus.

## User Requirements
1. **Remove Classification Labels**: Do not show "Text/Image/Video" categories in the updates feed or cards.
2. **Social Media Feed Style**: Design updates like recent posts with captions (based on Screenshot 3).
3. **Fix Layout/Overlap**: Ensure no text/labels appear under menus when a notification occurs.
4. **Consistency**: Keep other functions like the WhatsApp notification on the homepage and B2B portal.

## Technical Tasks

### 1. Update `src/routes/updates.tsx` (Public Updates Page)
- Redesign the layout to use a clean, social-post-like card system.
- Remove "Text", "Image", "Video" filter tabs and labels from cards.
- Implement a search bar and a unified feed of "Latest Updates".
- Use the "Cream, Gold, Black" theme for the page.

### 2. Update `src/routes/admin.announcement.tsx` (Admin Management)
- Remove categorization logic if any (e.g., checking if it's text-only).
- Update the admin management UI to match the new "Post" concept.

### 3. Update `src/components/AnnouncementToast.tsx`
- Refactor the toast to be a clean WhatsApp-style notification without the "Latest Updates" header overlap issues.
- Ensure the progress bar and layout are tight.

### 4. Styling Adjustments in `src/styles.css`
- Add cards and grid layouts for the updates feed.

## Validation
- Verify the updates page matches the "Screenshot 3" aesthetic (Clean cards, dates, "Read More").
- Ensure the homepage layout is clean when notifications are active.
