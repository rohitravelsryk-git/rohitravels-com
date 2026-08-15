# Plan - Fix Security Linter Issues

The Supabase linter identified two security issues related to `SECURITY DEFINER` functions being executable by all authenticated users. This plan addresses these by explicitly revoking default execute permissions and granting them only where necessary.

## Proposed Changes

### Database Security
- Revoke `EXECUTE` on `public.has_role` from `PUBLIC`.
- Grant `EXECUTE` on `public.has_role` specifically to `authenticated` and `service_role`.
- Revoke `EXECUTE` on `public.booking_state_unchanged` from `PUBLIC`.
- Grant `EXECUTE` on `public.booking_state_unchanged` specifically to `authenticated` and `service_role`.
- Ensure all other `SECURITY DEFINER` functions discovered during the fix follow the same pattern if they are currently exposed.

## Technical Details

### SQL Migration
```sql
-- Revoke default execute from public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged() FROM PUBLIC;

-- Grant to specific roles
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged() TO authenticated, service_role;
```

### Context
`SECURITY DEFINER` functions run with the privileges of the user who created them (usually the owner/postgres). By default, all functions in the `public` schema are executable by everyone. Restricting these to specific roles prevents unauthorized users (like `anon` or even `authenticated` if they shouldn't call them directly) from invoking them outside of intended RLS policies or application logic.
