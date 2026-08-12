# Plan - Fix Domain Access and Optimize Hero Headline

Fixing the "site can't be reached" issue for `www.rohitravels.com` and optimizing the hero headline as requested.

## User Review Required

> [!IMPORTANT]
> The `www.rohitravels.com` issue is likely due to a missing DNS record (CNAME). I will provide the exact settings to add to your domain registrar (GoDaddy/Namecheap/etc).

## Proposed Changes

### Domain & Redirects
- Check and fix the canonical URL logic to ensure `rohitravels.com` is prioritized while supporting `www` access via redirects.
- Update `src/routes/__root.tsx` to include a canonical link tag for SEO.

### Hero Section Optimization
- Update `src/routes/index.tsx` hero headline to match the requested visual hierarchy.
- Ensure "Your trusted partner for better fares" text is perfectly fitted and styled with the requested color accents.
- Tighten spacing between the Urdu text and origin/destination codes to prevent overlapping.
- Position origin/destination codes directly under the city names as requested.

### Marketing Studio Refinement
- Ensure AI studio performance and accuracy instructions are integrated as high-priority commands for the AI agent handling marketing tasks.

## Technical Details

### DNS Fix (Instructions for User)
To make `www.rohitravels.com` work, add this record in your domain provider's DNS settings:
- **Type:** `CNAME`
- **Host:** `www`
- **Value:** `rohitravels.com` (or the internal Lovable app hostname if required)

### Frontend Edits
- **src/routes/index.tsx**: 
    - Adjust `h2` in hero to use `text-7xl` (mobile responsive) with `font-serif` and `leading-[0.9]`.
    - Modify the flight sector grid to place codes (`origin_code`, `destination_code`) in a secondary row below city names.
    - Reduce top padding/margin in the hero section to "take data up".
- **src/routes/__root.tsx**: Add `head()` function to set canonical URL to `https://rohitravels.com`.
