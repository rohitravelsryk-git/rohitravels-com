# Plan: Automated "Fare On WhatsApp" Reset

Implement a mechanism that automatically changes the fare text to "Fare On WhatsApp" if a fare has not been edited for 2 hours. This will apply to the public and agent views while allowing admins to toggle visibility back to the actual numeric fare.

## Proposed Changes

### 1. Backend Logic
- Create a new migration to add `hide_fare_after_2h` (boolean, default true) to the `fares` table.
- Update `listFares` in `src/lib/fares.functions.ts` to check `updated_at`. If `hide_fare_after_2h` is true and `updated_at` is older than 2 hours, return "Fare On WhatsApp" instead of the actual `price_text`.

### 2. Admin Interface
- Update `Fare` type and `fareInput` schema in `src/lib/fares.functions.ts` to include `hide_fare_after_2h`.
- Add a toggle in the Admin Group Fares table (src/routes/admin.index.tsx) to enable/disable this automated behavior per fare.
- Add a "Show Actual Fare" button/action in the Admin panel that resets the `updated_at` timestamp (effectively showing the fare for another 2 hours) or toggles the behavior.

### 3. Verification Plan
- Manually update a fare's `updated_at` in the database to >2 hours ago and verify the public view shows "Fare On WhatsApp".
- Toggle the setting in Admin and verify the behavior changes.
- Verify that editing a fare resets the timer.

## Technical Details

- **Database**: `ALTER TABLE public.fares ADD COLUMN hide_fare_after_2h BOOLEAN DEFAULT TRUE;`
- **Grace Period**: 2 hours (7200 seconds).
- **Public Masking**: The masking happens at the server function level (`listFares`) so the real numeric value never reaches the client for expired fares.
