CREATE TABLE public.wa_quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_quick_replies TO authenticated;
GRANT ALL ON public.wa_quick_replies TO service_role;

ALTER TABLE public.wa_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quick replies" 
ON public.wa_quick_replies 
FOR ALL 
TO authenticated 
USING (true);
