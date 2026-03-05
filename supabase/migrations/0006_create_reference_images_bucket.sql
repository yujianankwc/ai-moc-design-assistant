-- Create a public storage bucket for reference images uploaded by users.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reference-images',
  'reference-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Allow anyone to read objects (the AI image service needs direct URL access).
create policy "Public read for reference-images"
  on storage.objects for select
  using (bucket_id = 'reference-images');

-- Allow authenticated & anon inserts via the service-role key (API route uploads).
create policy "Service role upload for reference-images"
  on storage.objects for insert
  with check (bucket_id = 'reference-images');
