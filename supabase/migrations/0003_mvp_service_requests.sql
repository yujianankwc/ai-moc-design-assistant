create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  request_type text not null check (request_type in ('bom_review', 'sampling_review', 'creator_plan')),
  contact_info text not null,
  request_note text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row
execute procedure public.set_updated_at();
