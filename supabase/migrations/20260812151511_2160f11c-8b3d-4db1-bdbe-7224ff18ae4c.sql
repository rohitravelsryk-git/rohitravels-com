
-- 1. Create manual ledger entries table
CREATE TABLE public.ledger_manual_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date timestamptz NOT NULL DEFAULT now(),
    details text NOT NULL,
    debit numeric NOT NULL DEFAULT 0,
    credit numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_manual_entries TO authenticated;
GRANT ALL ON public.ledger_manual_entries TO service_role;

-- 3. Enable RLS
ALTER TABLE public.ledger_manual_entries ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Admin can do everything
CREATE POLICY "Admins have full access to manual entries" 
ON public.ledger_manual_entries
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Agents can only see their own manual entries
CREATE POLICY "Agents can see their own manual entries"
ON public.ledger_manual_entries
FOR SELECT
TO authenticated
USING (agent_user_id = auth.uid());
