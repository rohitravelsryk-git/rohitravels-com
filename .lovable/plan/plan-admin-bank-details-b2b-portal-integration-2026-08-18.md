# Plan: Admin Bank Details & B2B Portal Integration

Implement a new "Bank Details" management system in the admin panel and display these details in the B2B agent portal with real-time updates.

## User Review Required

> [!IMPORTANT]
> - The design will follow the provided screenshot, featuring bank logos, bank names, account holder names, account numbers, and IBANs.
> - Admins will be able to manage these details (Add, Edit, Delete).
> - Agents will see these details in their portal under a new "Bank Details" section.

## Proposed Changes

### Database Schema
- Create a `bank_details` table to store bank information.
  - `id` (uuid, primary key)
  - `bank_name` (text)
  - `bank_logo_url` (text, optional)
  - `account_name` (text)
  - `account_no` (text)
  - `iban` (text)
  - `created_at`, `updated_at` (timestamps)

### Admin Panel
- **New Route**: `src/routes/admin.bank-details.tsx`.
- **Admin Tab**: Add "Bank Details" to `src/lib/admin-tabs.ts`.
- **Functionality**:
  - List all bank details in a grid or table format.
  - Dialog for adding/editing bank details.
  - Delete functionality.
  - Image upload/URL for bank logos.

### Agent Portal
- **New Route**: `src/routes/_agentapp.agent.bank-details.tsx`.
- **Sidebar Update**: Add "Bank Details" link to `src/components/AgentSidebarNav.tsx` under the "Accounts" section.
- **UI Design**: Replicate the "Bank Details" card layout from the provided screenshot.
  - Clean cards with bank logos on the top left.
  - Clear hierarchy for Bank Name, Account Name, Account No, and IBAN.

### Backend Functions
- Add server functions in a new `src/lib/bank-details.functions.ts` file for CRUD operations.

## Technical Details

### Database Migration
```sql
CREATE TABLE public.bank_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_name text NOT NULL,
    bank_logo_url text,
    account_name text NOT NULL,
    account_no text NOT NULL,
    iban text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_details TO authenticated;
GRANT ALL ON public.bank_details TO service_role;
GRANT SELECT ON public.bank_details TO anon; -- If public access is needed, though usually for agents (authenticated)

-- RLS
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.bank_details FOR SELECT USING (true);
CREATE POLICY "Allow admin all access" ON public.bank_details FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### Component Structure
- `BankDetailCard`: A reusable component for both Admin and Agent views.
- `BankDetailsManager`: Admin-only view for CRUD.
- `BankDetailsDisplay`: Agent-only read-only view.
