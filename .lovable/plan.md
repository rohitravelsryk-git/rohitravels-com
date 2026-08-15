# Plan: B2B Agent Portal Table Redesign

Design a professional, high-impact table layout for the B2B Agent Portal inspired by the provided reference image (user-uploads://file-120). The goal is to maximize clarity, readability, and a "premium travel agency" feel using a bold Red/Orange/Gold/Navy palette.

## Proposed Layouts

### Option 1: The "Premium Flight Strip" (Inspired by reference)
*   **Header**: Solid high-contrast Red/Crimson background with bold white text.
*   **Rows**: Alternating subtle orange/amber shades.
*   **Typography**: Serif fonts for dates and fares, bold sans-serif for flight numbers.
*   **Visual Cues**: Plane icons for dates, clock icons for times, luggage icons for baggage.
*   **Call to Action**: Distinctive buttons (e.g., "Book Now (E)"/"Book Now (O)") in a dark navy/black block.

### Option 2: The "Modern Airline Grid"
*   **Header**: Navy Blue header with gold accents.
*   **Rows**: Clean white rows with thin ledger-style dividers.
*   **Highlights**: Fare values in high-visibility orange; "Baggage" and "Meal" in distinct colored badges.

## Technical Implementation

### CSS & Theming
*   Define new semantic colors in `src/styles.css`:
    *   `--agent-red`: Vibrant red for headers.
    *   `--agent-amber`: Soft amber for row backgrounds.
    *   `--agent-orange`: Punchy orange for fares.
*   Add a utility `@utility table-flight-strip` for the specific row styling.

### Component Updates (`src/routes/_agentapp.agent.fares.tsx`)
*   Refactor the `rows.map` loop to use the new layout.
*   Implement a "Time" column combining `depart_time` and `arrive_time` with a clock icon.
*   Restructure "Flight Details" to isolate the flight number (e.g., OV-538).
*   Add the "( AG# 4626 )" style metadata above the Book Now button using the `fare_id` or a shortened hash.

## User Choice
I will implement **Option 1** as the primary redesign since it most closely matches the requested screenshot, while maintaining the "Rohi Travels" branding elements.

### Metadata
- Title: B2B Agent Portal Redesign
- Description: Overhaul of the B2B fares table with a premium flight-strip aesthetic.
