-- Repair Supabase Auth rows created with NULL confirmation tokens.
-- GoTrue expects confirmation_token to be a string; NULL causes HTTP 500
-- during password authentication. Keep this migration idempotent.
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;
