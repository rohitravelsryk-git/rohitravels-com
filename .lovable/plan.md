# Group Fare Deletion Overhaul Plan

This plan implements conditional password protection for group fare deletions and ensures that 'Self' group records are preserved in dashboards even when removed from the main fares list.

## User-facing changes
- **Conditional Password Prompt**: Deleting a "Party" group fare will now happen instantly with a simple confirmation, while deleting a "Self" group fare will require the Admin Password.
- **Data Preservation**: Deleting a "Self" group fare from the Group Fares tab will no longer wipe associated booking records from the "Self Groups" dashboards.
- **UI Label Update**: The deletion dialog text will be updated to reflect the new rule.

## Technical details
- **Frontend (`src/routes/admin.index.tsx`)**:
  - Update `doDelete` to handle both password-protected and direct deletions.
  - Modify the `confirmDelete` state and `onDelete` handler to distinguish between group types.
  - Update the deletion confirmation dialog to only show the password field when required (for "Self" groups).
- **Backend (`src/lib/fares.functions.ts`)**:
  - The `deleteFare` server function will remain as a direct deletion from the `fares` table.
  - Preservation of dashboard data is already inherently supported because `self_group_manifest` and `group_tickets` entries typically link via data snapshots or IDs that aren't cascadingly deleted by a simple fare row removal (verified by checking current schema/sync logic).
- **Documentation**:
  - Update memory to reflect this business rule.

## Verification plan
1. Log in as admin.
2. Create a "Party" group fare and delete it: verify it deletes with a simple confirmation.
3. Create a "Self" group fare and delete it: verify it asks for a password and fails if the password is wrong.
4. Verify that existing bookings in "Self Groups" dashboards remain visible after the "Self" fare is deleted from the main tab.
