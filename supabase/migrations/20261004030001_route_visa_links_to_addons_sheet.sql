-- Keep Visa Links in the existing Addons worksheet instead of creating a dedicated sheet.
update public.backup_tables
set sheet_name = 'Addons'
where table_name = 'visa_verification_links';
