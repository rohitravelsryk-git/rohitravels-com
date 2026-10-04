-- Visa Links are grouped by country and sorted by purpose; manual sort order is no longer needed.
alter table public.visa_verification_links drop column if exists sort_order;
