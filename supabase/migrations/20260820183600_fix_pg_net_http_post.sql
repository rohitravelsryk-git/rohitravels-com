-- Fix for scheduled backend task failing every minute (pg_net http_post call)
-- The caller expects extensions.http_post(url, headers, body) but it doesn't exist.
-- We create a wrapper in the extensions schema that redirects to net.http_post.

CREATE OR REPLACE FUNCTION extensions.http_post(
    url text,
    headers jsonb DEFAULT '{}'::jsonb,
    body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, net
AS $$
BEGIN
    RETURN net.http_post(
        url := url,
        body := body,
        headers := headers
    );
END;
$$;

GRANT EXECUTE ON FUNCTION extensions.http_post(text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extensions.http_post(text, jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION extensions.http_post IS 'Wrapper for net.http_post to satisfy legacy callers or out-of-band scheduled jobs.';
