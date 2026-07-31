REVOKE ALL ON FUNCTION public.backup_list_tables() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_touch_updated_at() FROM PUBLIC, anon, authenticated;