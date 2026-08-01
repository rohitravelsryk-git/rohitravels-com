CREATE POLICY "booking_attachments_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'booking-attachments'
  AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'booking-attachments'
  AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(), 'admin'::public.app_role))
);