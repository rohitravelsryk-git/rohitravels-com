# Move two pages to new addresses and retire the old ones

The menu links do work, but they point at the current addresses (`/services`, `/calculator`). The friendlier addresses you want don't exist yet — hence the 404 on `/our-services`.

## What changes

- Our Services page becomes `rohitravels.com/our-services`
- Date Calculator page becomes `rohitravels.com/calculators`
- The header menu and any in-page buttons point only at the new addresses
- The old addresses `/services` and `/calculator` no longer exist as pages; anyone arriving on them is forwarded automatically to the new address (this is what keeps old shared links and search rankings from breaking — nothing old stays visible)
- The site map and the plain-text site summary list only the new addresses

Page content, design and behaviour stay exactly as they are.

## Technical details

- Rename `src/routes/services.tsx` → `src/routes/our-services.tsx`, update `createFileRoute("/our-services")`, `og:url` and canonical.
- Rename `src/routes/calculator.tsx` → `src/routes/calculators.tsx`, update `createFileRoute("/calculators")`, `og:url` and canonical.
- Update link targets in `src/components/SiteHeader.tsx` and `src/routes/preview.header-concepts.tsx`.
- Add to `LEGACY_REDIRECTS` in `src/lib/legacy-redirects.ts`: `/services` → `/our-services`, `/calculator` → `/calculators`. These 301s are served in `src/server.ts` before routing, so no old route files remain (they previously caused route-tree collisions).
- Update paths in `src/routes/sitemap[.]xml.ts` and `public/llms.txt` to the new addresses only.
- Leave the agent portal's `/agent/services` route untouched.
- Verify with `bunx tsgo --noEmit`, then check in a browser: `/our-services` and `/calculators` load; `/services` and `/calculator` 301 to them.
