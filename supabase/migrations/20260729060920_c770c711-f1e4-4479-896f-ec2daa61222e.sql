ALTER TABLE public.agent_bookings
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "booking_attachments_owner_insert" ON storage.objects;
CREATE POLICY "booking_attachments_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "booking_attachments_owner_select" ON storage.objects;
CREATE POLICY "booking_attachments_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'booking-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "booking_attachments_owner_delete" ON storage.objects;
CREATE POLICY "booking_attachments_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'booking-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );