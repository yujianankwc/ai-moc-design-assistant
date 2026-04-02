alter table public.service_requests
drop constraint if exists service_requests_status_check;

alter table public.service_requests
add constraint service_requests_status_check
check (status in ('pending', 'reviewing', 'responded', 'converted', 'closed'));

alter table public.service_requests
add column if not exists operator_note text,
add column if not exists handled_by text,
add column if not exists responded_at timestamptz;

create index if not exists idx_service_requests_status_created
on public.service_requests(status, created_at desc);

create index if not exists idx_service_requests_user_created
on public.service_requests(user_id, created_at desc);
