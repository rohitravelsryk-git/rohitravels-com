-- Keep one logical Accounts Book transaction consistent across every ledger projection.
-- Updates to linked sale/transfer rows are performed in one database transaction.
create or replace function public.rohi_update_accounts_book_transaction_group(
  p_id uuid,
  p_entry_date date,
  p_category text,
  p_party text,
  p_description text,
  p_amount numeric,
  p_direct_cost numeric,
  p_direction text,
  p_account_id uuid
)
returns public.accounts_book_transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  base public.accounts_book_transactions;
  result_row public.accounts_book_transactions;
begin
  select * into base
  from public.accounts_book_transactions
  where id = p_id
  for update;

  if not found then
    raise exception 'Transaction % not found', p_id using errcode = 'P0002';
  end if;

  if base.source_type = 'transfer' and base.source_id is not null then
    update public.accounts_book_transactions
    set entry_date = p_entry_date,
        category = p_category,
        description = p_description,
        amount = p_amount,
        direct_cost = 0,
        updated_at = now()
    where source_type = 'transfer' and source_id = base.source_id;

    update public.accounts_book_transactions
    set party = p_party,
        updated_at = now()
    where source_type = 'transfer' and source_id = base.source_id;

    select * into result_row
    from public.accounts_book_transactions
    where id = p_id;

  elsif base.source_type = 'sale' and base.source_id is not null then
    update public.accounts_book_transactions
    set entry_date = p_entry_date,
        category = p_category,
        party = p_party,
        description = p_description,
        updated_at = now()
    where source_type = 'sale' and source_id = base.source_id;

    update public.accounts_book_transactions
    set account_id = p_account_id,
        amount = p_amount,
        direct_cost = p_direct_cost,
        direction = p_direction,
        source_key = 'sale:' || base.source_id::text || ':' || p_account_id::text || ':' || p_direction,
        updated_at = now()
    where id = p_id
    returning * into result_row;

    if p_direct_cost = 0 then
      delete from public.accounts_book_transactions
      where source_type = 'sale'
        and source_id = base.source_id
        and id <> p_id
        and direction = 'out';
    else
      update public.accounts_book_transactions
      set amount = p_direct_cost,
          direct_cost = 0,
          updated_at = now()
      where source_type = 'sale'
        and source_id = base.source_id
        and id <> p_id
        and direction = 'out';
    end if;

  else
    update public.accounts_book_transactions
    set account_id = p_account_id,
        entry_date = p_entry_date,
        entry_type = base.entry_type,
        category = p_category,
        party = p_party,
        description = p_description,
        amount = p_amount,
        direct_cost = p_direct_cost,
        direction = p_direction,
        source_key = case
          when base.source_type is not null and base.source_id is not null
          then base.source_type || ':' || base.source_id::text || ':' || p_account_id::text || ':' || p_direction
          else null
        end,
        updated_at = now()
    where id = p_id
    returning * into result_row;
  end if;

  return result_row;
end;
$$;

revoke all on function public.rohi_update_accounts_book_transaction_group(uuid,date,text,text,text,numeric,numeric,text,uuid) from public;
grant execute on function public.rohi_update_accounts_book_transaction_group(uuid,date,text,text,text,numeric,numeric,text,uuid) to service_role;
