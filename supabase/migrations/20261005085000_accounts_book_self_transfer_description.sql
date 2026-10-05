-- Normalize internal bank/wallet transfers so they are immediately recognizable
-- as personal/self transfers in the ledger and Google Sheets backup.

CREATE OR REPLACE FUNCTION public.accounts_book_set_self_transfer_description()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_name text;
  to_name text;
  transfer_count integer;
BEGIN
  -- Prevent the UPDATE issued below from recursively re-entering this trigger.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.entry_type <> 'transfer' OR COALESCE(NEW.source_type, '') <> 'transfer' OR NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO transfer_count
  FROM public.accounts_book_transactions t
  WHERE t.source_type = 'transfer'
    AND t.source_id = NEW.source_id;

  -- A transfer is represented by its paired OUT and IN rows. Wait until both
  -- sides exist so we can derive the exact source/destination account names.
  IF transfer_count < 2 THEN
    RETURN NEW;
  END IF;

  SELECT a.name
    INTO from_name
  FROM public.accounts_book_transactions t
  JOIN public.accounts_book_accounts a ON a.id = t.account_id
  WHERE t.source_type = 'transfer'
    AND t.source_id = NEW.source_id
    AND t.direction = 'out'
  ORDER BY t.created_at
  LIMIT 1;

  SELECT a.name
    INTO to_name
  FROM public.accounts_book_transactions t
  JOIN public.accounts_book_accounts a ON a.id = t.account_id
  WHERE t.source_type = 'transfer'
    AND t.source_id = NEW.source_id
    AND t.direction = 'in'
  ORDER BY t.created_at
  LIMIT 1;

  IF from_name IS NULL OR to_name IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.accounts_book_transactions
  SET description = format('Online Transfer %s to %s ( Self )', from_name, to_name)
  WHERE source_type = 'transfer'
    AND source_id = NEW.source_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_book_self_transfer_description_trigger
  ON public.accounts_book_transactions;

CREATE TRIGGER accounts_book_self_transfer_description_trigger
AFTER INSERT OR UPDATE OF account_id, entry_type, source_type, source_id
ON public.accounts_book_transactions
FOR EACH ROW
EXECUTE FUNCTION public.accounts_book_set_self_transfer_description();

-- Backfill existing paired internal transfers using the same deterministic rule.
WITH transfer_pairs AS (
  SELECT
    t.source_id,
    max(a_from.name) FILTER (WHERE t.direction = 'out') AS from_name,
    max(a_to.name) FILTER (WHERE t.direction = 'in') AS to_name
  FROM public.accounts_book_transactions t
  LEFT JOIN public.accounts_book_accounts a_from
    ON a_from.id = t.account_id AND t.direction = 'out'
  LEFT JOIN public.accounts_book_accounts a_to
    ON a_to.id = t.account_id AND t.direction = 'in'
  WHERE t.entry_type = 'transfer'
    AND t.source_type = 'transfer'
    AND t.source_id IS NOT NULL
  GROUP BY t.source_id
  HAVING count(*) >= 2
     AND max(a_from.name) FILTER (WHERE t.direction = 'out') IS NOT NULL
     AND max(a_to.name) FILTER (WHERE t.direction = 'in') IS NOT NULL
)
UPDATE public.accounts_book_transactions t
SET description = format('Online Transfer %s to %s ( Self )', p.from_name, p.to_name)
FROM transfer_pairs p
WHERE t.source_type = 'transfer'
  AND t.source_id = p.source_id;
