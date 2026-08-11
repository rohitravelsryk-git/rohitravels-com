# Plan - Update Hero Section with New Copy and Buttons

The user wants to update the hero section of the homepage to match the design provided in the reference image (file-28). This includes updating the main headline, adding a description paragraph, and placing two buttons ("REGISTER NOW" and "AGENT LOGIN") below the description.

## Proposed Changes

### Frontend - Homepage (`src/routes/index.tsx`)
- Update the `h2` headline to match the color scheme in the image:
    - "Your" (white)
    - "trusted" (white)
    - "partner" (gold)
    - "for" (gold)
    - "better" (green/emerald)
    - "fares." (green/emerald)
- Add the description text below the headline:
    - "Unlock competitive group fares, smart ticketing support and dependable travel solutions built for modern travel agents."
- Add a button container with two buttons:
    - **Register Now**: A prominent white button with bold black/navy text.
    - **Agent Login**: An outlined or subtle dark button with white text.
- Ensure the spacing and typography match the "premium look" established previously.

## Technical Details
- Modify `src/routes/index.tsx` around line 322.
- Use Tailwind classes for the new colors and button styles.
- Colors to use (based on existing theme):
    - Gold: `text-gold` (#D4AF37)
    - Emerald: `text-emerald-500` or similar for "better fares."
- Buttons:
    - Register: `bg-white text-navy font-black`
    - Login: `border border-white/20 bg-transparent text-white font-bold`

## Verification Plan
- Check the preview URL to ensure the hero section prominently displays the new text and buttons.
- Verify that the colors correctly transition from white to gold to green.
- Ensure the layout is clean and centered within the left column of the hero.