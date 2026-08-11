# Plan - Adjust Hero Text Spacing and Layout

The user wants to improve the layout of the hero section in the homepage to prevent overlapping between the Urdu city names and the origin/destination text. Additionally, the origin/destination codes should be moved to a separate line below the city names.

## Proposed Changes

### Frontend - Homepage Layout (`src/routes/index.tsx`)
- Increase the gap/margin between the Urdu city names and the sub-header containing the origin/destination details.
- Restructure the origin/destination details section:
    - Currently, it shows `Origin OriginCode | Destination DestinationCode` on one line.
    - Change it to show the full names (`Karachi - Jeddah`) on one line and the codes (`KHI - JED`) on the line below it, or as requested: "write origin destination code not with them but under that origin and destination".
    - To follow the instruction "write origin destination code... under that origin and destination", I will move the `{hero.origin_code}` and `{hero.destination_code}` into their own container below the name labels.
- Adjust vertical spacing (`mt-4`, `gap-2` etc.) to ensure no overlap between the large Urdu text and the English labels.

## Technical Details
- Update the `hero` section's centerpiece in `src/routes/index.tsx`.
- Modify the `flex-col` container that holds the Urdu text and the code labels to have more spacing.
- Split the code display into a new `div` or `span` block.

## Verification Plan
- Check the preview URL to ensure the Urdu text (Karachi/Jeddah) is clearly separated from the English labels.
- Verify that the airport codes (KHI/JED) appear on a separate line below the city names as requested.
- Ensure the layout remains responsive and centered.