# Plan: Restore Email Template Quality

The user reported that email templates are "showing poor quality" and wants them reset to the state they were in at 4pm today (likely meaning a restoration of the "Warm Paper Ledger" brand aesthetic with serif headings, gold accents, and clean typography).

## User Review Required

> [!IMPORTANT]
> The restoration will affect all system emails, including agent approvals, welcome messages, booking notifications, and authentication emails. I will use a consistent "Warm Paper Ledger" theme (Navy, Gold, Cream/White) across all of them.

## Proposed Changes

### 1. Unified Email Styling
- Define a consistent set of CSS variables and inline styles matching the "Warm Paper Ledger" theme:
    - **Header**: Navy background (`#0b2545`), Gold text (`#e8b647`).
    - **Typography**: Serif for headings (Georgia), Sans-serif for body (Arial).
    - **Accents**: Gold top border (`#e8b647`), rounded containers, and high-contrast buttons.

### 2. Update React Email Templates (Transactional Auth)
- Modify files in `src/lib/email-templates/` (`signup.tsx`, `invite.tsx`, `magic-link.tsx`, `recovery.tsx`, `email-change.tsx`, `reauthentication.tsx`) to use the unified styling.
- Ensure all use a consistent `Container` width (560px) and padding.

### 3. Update Custom HTML Emails (Business Logic)
- **`src/lib/agent-admin-helpers.ts`**: Restore quality to `agentApprovedEmail`, `agentWelcomeEmail`, and `newAgentAdminEmail`.
- **`src/lib/agent-bookings.functions.ts`**: Restore quality to `notifyBookingCreated` and `promoteConfirmedBooking`.
- **`src/lib/login-otp.server.ts`**: Restore quality to `otpEmailHtml`.

### 4. Component-Based Refactor (Internal)
- I will introduce a helper function `wrapInBrandLayout` to ensure future emails automatically inherit the correct branding, preventing "quality degradation" if content is changed.

## Technical Details

- **Theme Colors**: 
    - Primary Navy: `#0b2545`
    - Accent Gold: `#e8b647`
    - Background: `#f8f4ee` (Warm Cream) or `#ffffff` (Clean White)
- **Fonts**: `Georgia, 'Times New Roman', serif` for headings; `Arial, Helvetica, sans-serif` for body.
- **Components**: Using `@react-email/components` where applicable, and standardized template strings for server-side HTML.
