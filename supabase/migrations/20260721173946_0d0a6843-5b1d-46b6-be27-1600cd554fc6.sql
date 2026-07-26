CREATE POLICY "query_attachments_deny_anon_select" ON storage.objects FOR SELECT TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_update" ON storage.objects FOR UPDATE TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_delete" ON storage.objects FOR DELETE TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id <> 'query-attachments');