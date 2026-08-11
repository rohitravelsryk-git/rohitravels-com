# Plan - Optimize Hero Layout and Spacing

Refine the hero section by reducing whitespace gaps and improving the layout of flight sector text.

## User Review Required

> [!IMPORTANT]
> I will be adjusting the spacing and layout of the hero section. Please verify the placement of the flight sector codes and the overall height once the changes are applied.

- Does the reduced gap between the header and hero content look correct?
- Is the spacing between the Urdu text and the city names comfortable?

## Proposed Changes

### Frontend Layout

#### `src/routes/index.tsx`
- Reduce top padding of the hero container from `py-12 md:py-20` to `pt-6 pb-12 md:pt-10 md:pb-20` to pull content up towards the menu.
- Adjust the Urdu text container style to ensure no vertical clipping while keeping it close to the city names.
- Redesign the flight sector display:
    - Increase spacing between Urdu text and city names.
    - Stack "City Name" and "City Code" vertically as requested.
    - Standardize font sizes for better fit and visibility.
- Ensure the hero content fits well within the `min-h-[85vh]` vertical scale.

### Styling

#### `src/styles.css`
- Tweak the `font-urdu` utility if necessary to ensure consistent line-height across browsers.

## Technical Details

- Use Tailwind padding utilities (`pt-`, `pb-`) to control the vertical distribution.
- Use `flex-col` on the flight sector info container to stack city names and codes.
- Apply targeted `mt-` (margin-top) to control the gap between the Urdu headers and the sector details.

## Constancy
- The "Elite Heritage" aesthetic and cinematic background will remain unchanged.
- All functional links (Register, Login, WhatsApp) will remain exactly where they are.
