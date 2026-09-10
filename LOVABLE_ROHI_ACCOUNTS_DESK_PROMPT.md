# Lovable Prompt: Rohi Accounts Desk

Build and integrate a production-ready **Rohi Accounts Desk** inside the existing Rohi International Travels admin panel. Do not replace the existing site, authentication, styling system, or business workflows. Add this as a new admin menu item and route at `/admin/accounts`.

## Goal

Create an agency accounting module for cash, bank, wallet, sales, expenses, transfers, opening balances, cash book, reports, and exports. It must use the existing Supabase integration and the existing server-side admin authorization pattern.

## Existing database contract

Use these existing Supabase tables exactly:

- `public.accounts_book_accounts`
  - `id uuid`
  - `name text`
  - `kind text`: `cash`, `bank`, or `wallet`
  - `opening_balance numeric`
  - `is_active boolean`
  - `created_at timestamptz`
- `public.accounts_book_transactions`
  - `id uuid`
  - `account_id uuid`
  - `entry_date date`
  - `entry_type text`: `sale`, `expense`, `transfer`, or `manual`
  - `category text`
  - `party text nullable`
  - `description text`
  - `amount numeric`
  - `direct_cost numeric`
  - `direction text`: `in` or `out`
  - `source_type text nullable`
  - `source_id uuid nullable`
  - `created_by uuid nullable`
  - `created_at timestamptz`

The migration is already present at `supabase/migrations/20260910120000_accounts_book.sql`. Do not invent a second schema or rename these columns.

## Required UI

Add a clear admin navigation item named **Rohi Accounts Desk** with a wallet/accounts icon.

The page must contain these views:

1. **Overview**
   - Cash in hand
   - Banks and wallets
   - Total sales
   - Net profit
   - Recent activity
2. **Cash Book**
   - Opening cash balance
   - Date
   - Description
   - Received
   - Payment
   - Running balance
3. **Transactions**
   - List all entries
   - Add transaction button
   - Delete transaction action with confirmation
   - Columns for date, type, party, description, account, amount, direction
4. **Account Movement**
   - List cash, bank, and wallet accounts
   - Inline editable opening balances
   - Current balance
   - Add account action
5. **Reports**
   - Sales
   - Direct costs
   - Expenses
   - Net profit
   - Print/save as PDF

## Transaction workflow

Use one clearly labelled **Add transaction** action. The form must support:

- Sale
- Expense
- Transfer
- Manual entry
- Date
- Account
- Category
- Party/customer
- Description
- Amount
- Direct cost
- Direction

For sales, default direction to `in`. For expenses, default direction to `out`. Validate account, description, positive amount, and non-negative direct cost before saving.

## Exports

Provide working buttons for:

- CSV export compatible with Excel and Google Sheets
- Print dialog suitable for saving as PDF

Exports must contain real loaded account and transaction data, not placeholder rows.

## Security

All database access must go through the existing server-side Supabase admin client and existing admin session gate. Keep the migration's RLS/revoke configuration intact. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Use only the existing public client variables in browser code.

## UX and quality

- Preserve the existing Rohi admin visual language.
- Make the page responsive on desktop and mobile.
- Show loading, empty, success, and error states.
- Refresh data after create, update, or delete.
- Reset the transaction form after a successful save.
- Confirm destructive deletes.
- Use accessible labels and buttons.
- Avoid duplicate routes, duplicate tables, mock data, or localStorage for the production route.

## Environment variables

Configure these in Lovable project settings, using values from the connected Supabase project:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Keep the service-role key server-only.

## Completion checks

1. Confirm `/admin/accounts` is registered in the router.
2. Confirm **Rohi Accounts Desk** appears in the admin navigation.
3. Run the migration in the connected Supabase project.
4. Verify the default `Cash in hand` account exists.
5. Create one sale and one expense.
6. Verify balances, Cash Book, reports, CSV export, and print/PDF.
7. Verify unauthorized users cannot access the route or server functions.
8. Run the project's typecheck, lint, and production build before deployment.
