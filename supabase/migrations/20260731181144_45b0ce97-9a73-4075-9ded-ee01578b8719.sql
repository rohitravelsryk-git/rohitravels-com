-- ============ Backup / disaster-recovery foundation ============

CREATE TABLE public.backup_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.backup_settings TO service_role;
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_backup_settings" ON public.backup_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.backup_tables (
  table_name text PRIMARY KEY,
  sheet_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  direction text NOT NULL DEFAULT 'push',
  cursor_column text,
  last_cursor timestamptz,
  last_synced_at timestamptz,
  last_row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.backup_tables TO service_role;
ALTER TABLE public.backup_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_backup_tables" ON public.backup_tables
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'incremental',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  tables_synced integer NOT NULL DEFAULT 0,
  rows_synced integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  message text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX backup_runs_started_at_idx ON public.backup_runs (started_at DESC);
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_backup_runs" ON public.backup_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.backup_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.backup_runs(id) ON DELETE CASCADE,
  table_name text NOT NULL DEFAULT '',
  row_id text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX backup_errors_created_at_idx ON public.backup_errors (created_at DESC);
GRANT ALL ON public.backup_errors TO service_role;
ALTER TABLE public.backup_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_backup_errors" ON public.backup_errors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.backup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'manual',
  spreadsheet_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows integer NOT NULL DEFAULT 0,
  taken_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  message text NOT NULL DEFAULT ''
);
CREATE INDEX backup_snapshots_taken_at_idx ON public.backup_snapshots (taken_at DESC);
GRANT ALL ON public.backup_snapshots TO service_role;
ALTER TABLE public.backup_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_backup_snapshots" ON public.backup_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.backup_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER backup_tables_updated_at BEFORE UPDATE ON public.backup_tables
  FOR EACH ROW EXECUTE FUNCTION public.backup_touch_updated_at();
CREATE TRIGGER backup_settings_updated_at BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW EXECUTE FUNCTION public.backup_touch_updated_at();

-- ============ Discovery helpers (server-only) ============

CREATE OR REPLACE FUNCTION public.backup_list_tables()
RETURNS TABLE (table_name text, columns text[], cursor_column text, est_rows bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text,
    ARRAY(
      SELECT a.attname::text
      FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    ),
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'updated_at' AND a.attnum > 0 AND NOT a.attisdropped) THEN 'updated_at'
      WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'created_at' AND a.attnum > 0 AND NOT a.attisdropped) THEN 'created_at'
      ELSE NULL
    END::text,
    GREATEST(c.reltuples, 0)::bigint
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'backup_%'
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;

CREATE OR REPLACE FUNCTION public.backup_fetch_rows(
  _table text,
  _since timestamptz DEFAULT NULL,
  _limit integer DEFAULT 500,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cursor text;
  _sql text;
  _result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = _table
      AND c.relname NOT LIKE 'backup_%'
  ) THEN
    RAISE EXCEPTION 'Unknown table: %', _table;
  END IF;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_table AND column_name='updated_at') THEN 'updated_at'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_table AND column_name='created_at') THEN 'created_at'
    ELSE NULL
  END INTO _cursor;

  IF _cursor IS NULL THEN
    _sql := format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I LIMIT %s OFFSET %s) t',
      _table, GREATEST(_limit, 1), GREATEST(_offset, 0));
  ELSIF _since IS NULL THEN
    _sql := format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I ORDER BY %I ASC LIMIT %s OFFSET %s) t',
      _table, _cursor, GREATEST(_limit, 1), GREATEST(_offset, 0));
  ELSE
    _sql := format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE %I > %L ORDER BY %I ASC LIMIT %s OFFSET %s) t',
      _table, _cursor, _since, _cursor, GREATEST(_limit, 1), GREATEST(_offset, 0));
  END IF;

  EXECUTE _sql INTO _result;
  RETURN coalesce(_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.backup_count_rows(_table text)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = _table
  ) THEN
    RAISE EXCEPTION 'Unknown table: %', _table;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', _table) INTO _n;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_count_rows(text) TO service_role;