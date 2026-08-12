# Plan: Separate Announcement and Latest Updates

Decouple the top-of-page announcement banner from the "Latest Updates" social-style feed. Create a new dedicated admin form for the announcement banner.

## User Review Required

> [!IMPORTANT]
> The "Announcement Banner" (top strip) will now have its own management form and visibility toggle. Saving a "Latest Update" post will no longer automatically update the banner text or visibility.

## Proposed Changes

### Database & Logic
- Add `getBannerSettings` and `setBannerSettings` to `src/lib/fares.functions.ts` to manage a new `banner_settings` key in `site_settings`.
- Update `setAnnouncement` to stop modifying the banner state; it will strictly manage the "Latest Updates" feed/toast.

### Admin Interface
- **Announcement Management**: Create `src/routes/admin.announcement-banner.tsx` (or similar) to host a dedicated form for the top banner (text, image, toggle).
- **Latest Updates**: Update `src/routes/admin.announcement.tsx` to remove banner-related labels and focus purely on "Post" management for the feed/toast.
- **Admin Navigation**: Add the new "Announcement Banner" tab to `src/lib/admin-tabs.ts`.

### Frontend
- **Global Banner**: Update `GlobalAnnouncementBanner` in `src/routes/index.tsx` to fetch from `banner_settings` instead of the general `announcement` object.
- **Layout**: Ensure the banner remains correctly positioned below the menus as requested, with a clear separation.

## Technical Details
- **Storage**: JSON-serialized object in `site_settings` under key `banner_settings`.
- **Schema**: `{ enabled: boolean, text: string, imageUrl: string, linkUrl: string }`.
- **Real-time**: Ensure `qc.invalidateQueries` is called for the new key to keep the public site in sync.
