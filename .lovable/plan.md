# Plan: Consolidate Agent Management

Consolidate agent management into a single tab named **Registered Agents** that includes both the registration visibility toggle (previously in "Manage lists") and the agent management table.

## User Review Required

> [!IMPORTANT]
> - The "REGISTERED AGENTS" sub-tab in the "Manage lists" dialog will be removed as its functionality is moving to the main "Registered Agents" tab.
> - The tab previously named "Manage Agents" will be renamed to "Registered Agents".

## Proposed Changes

### 1. Naming & Navigation
- Update `src/lib/admin-tabs.ts` to rename the "Manage Agents" tab to **Registered Agents**.

### 2. Tab Consolidation
- Modify `src/routes/admin.agents.tsx`:
  - Add the **Registration Page Visibility** toggle (fetched from `site_settings`) above the agent table.
  - Ensure the layout matches the professional "Warm Paper Ledger" aesthetic.

### 3. Cleanup
- Remove the "REGISTERED AGENTS" tab/toggle from the "Manage dropdown lists" modal in `src/routes/admin.index.tsx`.

## Technical Details

- **Database**: Use the existing `site_settings` table to read/write `registration_visible`.
- **UI Components**: Use the existing `setRegistrationVisibility` server function.
- **Real-time**: Maintain existing real-time updates and notification popups in the consolidated agents view.
