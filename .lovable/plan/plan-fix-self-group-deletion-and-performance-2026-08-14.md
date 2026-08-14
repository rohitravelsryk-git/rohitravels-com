# Plan: Fix Self Group Deletion and Performance

The user reported that deleting a "Self" group takes too long and fails to preserve passenger/booking records in the "Self Groups" dashboard. We need to implement a "Soft Delete" mechanism for fares and optimize the deletion flow.

## User Requirements
- Deleting a "Self" group from "Group Fares" should preserve records in "Self Groups" dashboards.
- Deleting "Self" groups should be faster (currently "taking long time").
- Deleting "Self" group still requires Admin Password.
- Deleting "Party" group does NOT require password and deletes permanently (implied by "if i want to delete a Group Type Self... Records remains...").

## Technical Strategy

### 1. Database Schema Update
- Add `is_deleted` (boolean, default false) and `deleted_at` (timestamptz) columns to the `fares` table.
- This allows "soft deletion" where the fare is hidden from lists but remains in the database to maintain foreign key integrity for bookings and passengers.

### 2. Backend Logic (`src/lib/fares.functions.ts`)
- Update `listFares` and `listFaresAdmin` to filter out `is_deleted = true`.
- Update `deleteFare` to check the group type:
    - If `group_type === 'self'`, set `is_deleted = true` instead of deleting.
    - If `group_type === 'party'`, perform a permanent deletion (as it's currently working).
- Optimize the `deleteFare` function to minimize latency.

### 3. Frontend Optimization (`src/routes/admin.index.tsx` and `src/routes/admin.self-groups.tsx`)
- Review the `doDelete` implementation to ensure it doesn't perform unnecessary work.
- Ensure the password verification is efficient.

## Implementation Details

### Step 1: Migration
```sql
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

### Step 2: Update `src/lib/fares.functions.ts`
- Modify `deleteFare` to handle soft-delete for `self` groups.
- Update listing functions to exclude deleted fares.

### Step 3: Verify "Self Groups" Dashboard (`src/routes/admin.self-groups.tsx`)
- Ensure it still shows passengers even if the parent fare is "deleted" (soft-deleted).

## User Review Required

> [!IMPORTANT]
> I will implement a "Soft Delete" for Self groups. This means the fare will disappear from your main "Group Fares" list, but the database record will stay (hidden) so your passenger manifests and booking history in the "Self Groups" tab remain perfectly intact. Party groups will continue to be deleted permanently.
