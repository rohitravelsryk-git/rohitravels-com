# Plan - Fix Security Linter Issues

The Supabase linter identified security issues related to `SECURITY DEFINER` functions being executable by all authenticated users. This plan addresses these by explicitly revoking default execute permissions and granting them only where necessary.

## Proposed Changes

### Database Security
- Revoke `EXECUTE` on `public.has_role` from `PUBLIC`.
- Grant `EXECUTE` on `public.has_role` specifically to `authenticated` and `service_role`.
- Revoke `EXECUTE` on `public.booking_state_unchanged` from `PUBLIC`.
- Grant `EXECUTE` on `public.booking_state_unchanged` specifically to `authenticated` and `service_role`.

## Technical Details

### SQL Migration
```sql
-- Revoke default execute from public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;

-- Grant to specific roles
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated, service_role;
```

## Verification Plan
- Run the Supabase linter again to confirm the `WARN 1` issues are resolved.
- Verify that admin and agent functionality remains intact (since they are `authenticated`).