# Plan: Undo Dual City Support

The user wants to revert the recent changes that added support for dual origin and destination cities across the application. This includes reverting database changes and UI updates in the Admin Panel, B2B Portal, and Public Website.

## User Review Required

> [!IMPORTANT]
> This action will remove the `origin2`, `origin2_code`, `destination2`, and `destination2_code` columns from the database. Any data currently stored in these columns will be permanently lost.

## Proposed Changes

### Database
- Create a new migration to drop the columns `origin2`, `origin2_code`, `destination2`, and `destination2_code` from the `public.fares` table.

### Backend & Shared Logic
- **src/lib/fares.functions.ts**: Remove dual city fields from the `Fare` type and `PUBLIC_FARE_COLUMNS` list.
- **src/lib/fare-format.ts**: Remove dual city handling from `FareShare` type and `buildFareShareText` (WhatsApp sharing logic).

### Admin Panel
- **src/routes/admin.index.tsx**: 
    - Revert the `Draft` type and `EMPTY` draft object to exclude dual city fields.
    - Remove dual city inputs from the "Add New Group Fare" modal.
    - Remove dual city inputs from the inline editing table.
    - Revert the main table view to show single city/code pairs.
    - Update the `toPayload` helper to exclude the extra fields.

### Public Website
- **src/routes/index.tsx**:
    - Revert the Hero section to display only a single origin and destination city.
    - Revert the Urdu display in the Hero to show single city names.
    - Update `buildBookNowText` to remove dual city information from WhatsApp messages.
    - Remove dual city handling from the `FareCard` component.

### B2B Agent Portal
- **src/routes/_agentapp.agent.fares.tsx**:
    - Revert the `Fare` type to exclude dual city fields.
    - Update the table rendering to show single city/code pairs.
    - Revert the `BookingModal` header to display only primary cities.

## Technical Details
- The migration will use `ALTER TABLE public.fares DROP COLUMN IF EXISTS ...`.
- UI changes will involve removing the JSX/logic that checks for `origin2` and `destination2`.
- Types will be updated to match the restored schema.
