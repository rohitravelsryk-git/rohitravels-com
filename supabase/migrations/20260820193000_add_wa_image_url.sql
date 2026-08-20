ALTER TABLE public.wa_quick_replies ADD COLUMN IF NOT EXISTS image_url text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_quick_replies TO authenticated;
GRANT ALL ON public.wa_quick_replies TO service_role;
