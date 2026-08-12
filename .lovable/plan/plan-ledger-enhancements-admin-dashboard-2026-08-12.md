# Plan: Ledger Enhancements & Admin Dashboard

Enhance the B2B agent ledger with refined flight formatting, IATA airline codes, and updated styling. Add an admin ledger dashboard to track outstanding balances across all agencies, and integrate Google Sheets backup for ledger data.

## User Requirements
- **Rename Columns**: "PARTICULARS" -> "DETAILS" (UI and exports).
- **Format Details**: "GRP TKT(MUHAMMAD AARAIZ - KHI JED - Salam Air)" (remove parentheses, rename GRP TKT, use IATA codes like "OV" for Salam Air).
- **Export Styling**: Excel (CSV) and PDF buttons styled like reference image (rounded, specific colors).
- **Color Palette**: Black, Golden Hue, and Cream (Cream = #FDFBF7 / oklch(98% 0.01 90), Gold = #D4AF37 / oklch(82% 0.12 85)).
- **Admin Ledger Dashboard**: Add a view to track all agency outstanding balances (similar to reference image).
- **Google Sheets Integration**: Create a separate "ROHI INTERNATIONAL TRAVELS MASTER LEDGER ACCOUNTS" sheet for sensitive ledger data.

## Proposed Changes

### 1. Database & Server Functions
- Update `src/integrations/supabase/types.ts` (if needed) to ensure ledger views exist or are accessible.
- Create `src/lib/ledger-admin.functions.ts` to fetch outstanding balances for all approved agents.
- Update `src/lib/backup/ledger-sync.server.ts` to handle syncing to a dedicated "Master Ledger Accounts" Google Sheet.

### 2. Utilities & Formatting
- Update `src/lib/booking-flight-format.ts` to include an IATA code mapper for common airlines (Salam Air -> OV, etc.).
- Add a formatter for the "DETAILS" column that removes parentheses and uses "GRP TKT".

### 3. Agent Ledger UI (`src/routes/_agentapp.agent.ledger.tsx`)
- Rename column headers.
- Update "Particulars" generation logic.
- Restyle export buttons (CSV = Green/White, PDF = Red/White, rounded).
- Apply the Cream/Gold/Black color scheme to the table and stats cards.

### 4. Admin Ledger Dashboard (`src/routes/admin.ledger.tsx`)
- Create a new route for the admin ledger overview.
- Add a summary table showing: Agent Code, Agent Name, Contact, Balance (DR/CR), and a link to their individual ledger.
- Add a "Grand Total" outstanding balance.
- Integrate "Send WhatsApp" feature for balance reminders.

### 5. Layout & Navigation
- Add the "Ledger" tab to `src/lib/admin-tabs.ts` and `src/components/AdminTabs.tsx`.

## Technical Details
- **Colors**: 
  - Cream: `bg-[#FDFBF7]` / `oklch(98.5% 0.01 90)`
  - Gold: `text-[#D4AF37]` / `oklch(82% 0.12 85)`
  - Black: `bg-[#0D0D0D]` / `oklch(15% 0 0)`
- **PDF Generation**: Update `jsPDF` config in the ledger page to match the new theme (Cream background, Gold headers).
- **Google Sheets**: Will use the existing Google Sheets connector logic but targeted at a new file name.

## Constraints & Rules
- Do not make generic visual modifications; stick to the "Commands" provided.
- Ensure airline names are mapped to IATA codes (Salam Air -> OV).
- Maintain 30s auto-refresh for admin views.
