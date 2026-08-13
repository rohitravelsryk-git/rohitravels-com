# Plan: Advanced Agent Management

Consolidate agent management by adding creation and deletion capabilities, and refining the "Approved/Rejected/Reset" workflow to be more intuitive.

## User Review Required

> [!IMPORTANT]
> - Adding an agent manually requires generating a default password. I will set it to a temporary value (e.g., `RohiAgent2024!`) and recommend the agent changes it on first login.
> - "Reset" changes an agent back to "Pending" status (waiting for approval). "Reject" prevents them from logging in. These are useful if an agent was approved by mistake or violates terms.

## Proposed Changes

### Backend (Supabase)
- No schema changes needed; `agents` table and `auth.users` already exist.
- Will use `supabaseAdmin.auth.admin.createUser` to handle manual agent creation.

### Server Functions (`src/lib/agent-admin.functions.ts`)
- Add `createAgentAdmin`: Creates an `auth.user` and a corresponding `agents` record.
- Add `deleteAgentAdmin`: Removes the `agents` record and the `auth.user`.
- Ensure all functions are protected by the admin session gate.

### Admin UI (`src/routes/admin.agents.tsx`)
- **Add Agent**: Add a "Register New Agent" button that opens a form (Agency Name, Contact, Email, Phone, City, etc.).
- **Delete Action**: Add a "Delete" button to each row with a confirmation dialog.
- **Clarified Actions**: 
    - Rename "Reset" to "Set to Pending".
    - Add tooltips or small labels explaining that "Reject" blocks access and "Set to Pending" removes approval.
- **Refined Layout**: Keep the "Registered Agents" consolidated view with the visibility toggle.

## Technical Details
- Manual creation will use `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
- Deletion will use `supabaseAdmin.auth.admin.deleteUser(id)`.
- UI will use `lucide-react` icons (Plus, Trash2) and standard tailwind styling.
