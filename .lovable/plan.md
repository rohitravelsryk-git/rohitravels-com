# Rename two public pages and keep old links working

The menu links do work, but they point at the current addresses (`/services`, `/calculator`). You want the friendlier addresses `/our-services` and `/calculators`, which don't exist yet — hence the 404.

## What changes

- Our Services page moves from `rohitravels.com/services` to `rohitravels.com/our-services`
- Date Calculator page moves from `rohitravels.com/calculator` to `rohitravels.com/calculators`
- The header menu, footer and any in-page buttons point at the new addresses
- The old addresses permanently forward to the new ones, so existing links, bookmarks and search results keep working and rankings carry over
- The site map and the plain-text site summary list the new addresses

Page content, design and behaviour stay exactly as they are.

## Technical details

- Rename `src/routes/services.tsx` → `src/routes/our-services.tsx` and update `createFileRoute("/our-services")`, plus its `og:url` and canonical.
- Rename `src/routes/calculator.tsx` → `src/routes/calculators.tsx` and update `createFileRoute("/calculators")`, `og:url` and canonical.
- Update link targets in `src/components/SiteHeader.tsx` and `src/routes/preview.header-concepts.tsx`.
- Add to `LEGACY_REDIRECTS` in `src/lib/legacy-redirects.ts`: `/services` → `/our-services`, `/calculator` → `/calculators`. These 301s are served in `src/server.ts` before routing, so no legacy route files are needed (they previously caused route-tree collisions).
- Update paths in `src/routes/sitemap[.]xml.ts` and `public/llms.txt`.
- Leave the agent portal's `/agent/services` route untouched.
- Verify with `bunx tsgo --noEmit`, then check in a browser: `/our-services` and `/calculators` load, `/services` and `/calculator` redirect.
