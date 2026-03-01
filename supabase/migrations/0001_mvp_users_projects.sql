create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text,
  category text,
  style text,
  size_target text,
  size_note text,
  audience text,
  description text,
  must_have_elements text,
  avoid_elements text,
  build_goal text,
  collaboration_goal text,
  willing_creator_plan text,
  willing_sampling text,
  reference_links text,
  notes_for_factory text,
  status text not null check (status in ('draft', 'generating')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute procedure public.set_updated_at();
