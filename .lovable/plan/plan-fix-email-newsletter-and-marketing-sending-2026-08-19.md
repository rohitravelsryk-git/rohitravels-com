# Plan: Fix Email Newsletter and Marketing Sending

The user reports that the email newsletter is not working. Based on the codebase investigation, the `sendMarketingEmail` server function relies on the `@lovable.dev/email-js` library. A common cause of failure in this environment is the missing or incorrectly configured `LOVABLE_API_KEY` or `LOVABLE_SEND_URL` environment variables, or the use of an unauthorized sender email address.

## Proposed Changes

### 1. Update Server Function Logic
- Modify `src/lib/email-marketing.functions.ts` to use the unified `sendAppMail` helper from `src/lib/mailer.ts`.
- `sendAppMail` is already configured with the correct `SENDER_DOMAIN` (`notify.rohitravels.com`) and standard error handling.
- This ensures consistency across the app and uses the verified sender domain.

### 2. Refine Error Reporting
- Improve the error messages in `src/routes/admin.marketing.tsx` to be more user-friendly and less technical.
- Remove the debug-style text that was injected into the UI description.

### 3. Verification Steps
- Add a manual check to ensure the `LOVABLE_API_KEY` is present before attempting to send.
- Log specific failure codes (like `401 Unauthorized` or `403 Forbidden`) to the server console for better debugging if issues persist.

## Technical Details
- **File**: `src/lib/email-marketing.functions.ts`
  - Import `sendAppMail` from `@/lib/mailer`.
  - Replace `sendEmail` from `@lovable.dev/email-js` with `sendAppMail`.
- **File**: `src/routes/admin.marketing.tsx`
  - Clean up the `description` text in the `Route` metadata and the UI header.
  - Ensure the `handleSend` function provides clear feedback on success or failure.

## User Review Required
> [!IMPORTANT]
> To send emails successfully, the backend must have a valid `LOVABLE_API_KEY`. If this key was recently changed or is missing, you may need to re-link your project or add the secret in the backend settings.
