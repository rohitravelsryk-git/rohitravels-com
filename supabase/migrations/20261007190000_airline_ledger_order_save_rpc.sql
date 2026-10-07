-- Lightweight, revision-checked airline ordering save.
-- Dragging an airline must not run the full financial snapshot save/backup path.

create or replace function public.reorder_airline_ledger(
  p_airline_ids jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_new_revision bigint;
  v_count integer;
  v_before jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('rohi:airline-ledger', 0));

  if jsonb_typeof(p_airline_ids) <> 'array' then
    raise exception 'AIRLINE_LEDGER_INVALID_ORDER: airline ids must be an array';
  end if;

  select revision into v_revision
    from public.airline_ledger_meta
   where id = 1
   for update;

  if v_revision is null then
    insert into public.airline_ledger_meta (id, revision)
    values (1, 1)
    on conflict (id) do nothing;
    select revision into v_revision
      from public.airline_ledger_meta where id = 1 for update;
  end if;

  if p_expected_revision is distinct from v_revision then
    raise exception 'AIRLINE_LEDGER_CONFLICT: database revision % does not match client revision %',
      v_revision, p_expected_revision using errcode = '40001';
  end if;

  select count(*) into v_count from public.airline_ledger_airlines;

  if jsonb_array_length(p_airline_ids) <> v_count then
    raise exception 'AIRLINE_LEDGER_INVALID_ORDER: the order must contain every existing airline exactly once';
  end if;

  if exists (
    select 1
      from (
        select value::text as id
          from jsonb_array_elements_text(p_airline_ids)
      ) ids
     group by id
    having count(*) > 1
  ) then
    raise exception 'AIRLINE_LEDGER_INVALID_ORDER: duplicate airline id';
  end if;

  if exists (
    select 1
      from jsonb_array_elements_text(p_airline_ids) ids
     where not exists (
       select 1 from public.airline_ledger_airlines a where a.id = ids.value
     )
  ) then
    raise exception 'AIRLINE_LEDGER_INVALID_ORDER: unknown airline id';
  end if;

  v_before := jsonb_build_object(
    'airlines', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.sort_order)
         from public.airline_ledger_airlines a),
      '[]'::jsonb
    ),
    'agents', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.sort_order)
         from public.airline_ledger_agents a),
      '[]'::jsonb
    ),
    'transactions', coalesce(
      (select jsonb_agg(to_jsonb(t) order by t.airline_id, t.sort_order)
         from public.airline_ledger_transactions t),
      '[]'::jsonb
    )
  );

  perform set_config('rohi.airline_ledger_save', '1', true);

  insert into public.airline_ledger_audit (revision, action, snapshot)
  values (v_revision, 'before-reorder', v_before);

  update public.airline_ledger_airlines a
     set sort_order = ordered.sort_order
    from (
      select value as id, ordinality - 1 as sort_order
        from jsonb_array_elements_text(p_airline_ids) with ordinality
    ) ordered
   where a.id = ordered.id;

  update public.airline_ledger_meta
     set revision = revision + 1, updated_at = now()
   where id = 1
   returning revision into v_new_revision;

  insert into public.airline_ledger_audit (revision, action, snapshot)
  values (
    v_new_revision,
    'after-reorder',
    jsonb_build_object('airline_ids', p_airline_ids)
  );

  return v_new_revision;
end;
$$;

revoke all on function public.reorder_airline_ledger(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.reorder_airline_ledger(jsonb, bigint) to service_role;
