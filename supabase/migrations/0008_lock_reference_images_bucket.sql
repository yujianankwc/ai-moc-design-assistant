update storage.buckets
set public = false
where id = 'reference-images';

drop policy if exists "Public read for reference-images" on storage.objects;
