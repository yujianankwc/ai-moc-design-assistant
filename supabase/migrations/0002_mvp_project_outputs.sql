create table if not exists public.project_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  design_summary text,
  design_positioning text,
  build_difficulty text,
  structure_notes text,
  highlight_points text[] not null default '{}',
  bom_groups jsonb not null default '[]'::jsonb,
  substitution_suggestions text,
  risk_notes text,
  production_hint text,
  production_score int not null default 0,
  recommended_next_step text,
  internal_recommendation text,
  recommended_service text,
  editable_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_outputs_updated_at on public.project_outputs;
create trigger trg_project_outputs_updated_at
before update on public.project_outputs
for each row
execute procedure public.set_updated_at();
