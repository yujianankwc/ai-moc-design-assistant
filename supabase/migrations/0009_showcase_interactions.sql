create table if not exists public.showcase_interactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null references public.projects(id) on delete cascade,
  showcase_key text not null,
  visitor_id text not null,
  action_type text not null check (action_type in ('like', 'watch')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_showcase_interactions_unique_action
on public.showcase_interactions(showcase_key, visitor_id, action_type);

create index if not exists idx_showcase_interactions_showcase_action
on public.showcase_interactions(showcase_key, action_type, created_at desc);

create index if not exists idx_showcase_interactions_project_action
on public.showcase_interactions(project_id, action_type, created_at desc);
