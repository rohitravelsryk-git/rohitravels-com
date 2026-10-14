-- Rename 'KV Visit Visa' to 'Visit Visa' in accounts_book_services and accounts_book_transactions
update public.accounts_book_services
set name = 'Visit Visa'
where name ilike '%kv%visit%visa%' or name = 'KV Visit Visa' or name = 'KV VISIT VISA';

update public.accounts_book_transactions
set category = 'Visit Visa'
where category ilike '%kv%visit%visa%' or category = 'KV Visit Visa' or category = 'KV VISIT VISA';
