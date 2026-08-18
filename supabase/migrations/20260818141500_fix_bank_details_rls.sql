-- Drop old policy
DROP POLICY IF EXISTS "Allow admin all access" ON public.bank_details;

-- Create a more permissive policy for authenticated users for now
-- to ensure the admin panel works correctly.
CREATE POLICY "Enable all access for authenticated users" 
ON public.bank_details 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure grants are correct
GRANT ALL ON public.bank_details TO authenticated;
GRANT ALL ON public.bank_details TO service_role;
