
create policy "Staff view student photos" on storage.objects for select to authenticated
  using (bucket_id = 'student-photos' and public.is_staff(auth.uid()));
create policy "Staff upload student photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos' and public.is_staff(auth.uid()));
create policy "Staff update student photos" on storage.objects for update to authenticated
  using (bucket_id = 'student-photos' and public.is_staff(auth.uid()));
create policy "Staff delete student photos" on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos' and public.is_staff(auth.uid()));
