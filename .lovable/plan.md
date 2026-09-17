# Premium Homepage Redesign

## Goal
Create a polished, responsive travel-agency homepage that keeps live fare functionality while removing redundant route controls and improving visual hierarchy across all devices.

## Changes
- Remove the airline-logo/route selector above the featured fare and remove the homepage search bar.
- Keep destination pills as the single fare-filter control and redesign them for clear selection, touch scrolling, and mobile visibility.
- Rebuild the opening section as a compact premium travel showcase with the agency name, live rotating group fare, clear booking actions, and no overlap.
- Redesign Trending Destinations with a balanced multi-color gradient system, stronger destination hierarchy, fare counts, and animated selection feedback.
- Improve section spacing, typography, fare-list presentation, and service presentation so the homepage feels cohesive rather than assembled from separate blocks.
- Add restrained Framer Motion sequences: cinematic entrance, fare crossfades, destination-tile stagger, subtle depth/parallax, and reduced-motion support.
- Verify desktop, tablet, and mobile layouts, interactions, console output, and TypeScript.

## Technical details
- Keep all existing live fare data, commission calculations, WhatsApp booking, realtime refresh, destination filtering, service links, and SEO metadata.
- Use existing semantic design tokens and add only reusable gradient/motion tokens in the global design system.
- Avoid overlapping or fixed-height layouts; use stable responsive grids and content-driven sizing.
