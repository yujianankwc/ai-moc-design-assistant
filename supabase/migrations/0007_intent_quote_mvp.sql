create table if not exists public.intent_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null references public.projects(id) on delete set null,
  user_id text not null references public.users(id) on delete cascade,
  source_type text not null check (source_type in ('small_batch', 'crowdfunding', 'pro_upgrade', 'manual_consult')),
  status text not null check (status in ('new', 'contact_pending', 'contacted', 'confirming', 'quoted', 'deposit_pending', 'locked', 'closed_won', 'closed_lost')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  contact_name text,
  contact_phone_or_wechat text not null,
  contact_preference text,
  prefer_priority_contact boolean not null default false,
  operator_id text,
  operator_note text,
  lost_reason text,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_intent_orders_updated_at on public.intent_orders;
create trigger trg_intent_orders_updated_at
before update on public.intent_orders
for each row
execute procedure public.set_updated_at();

create table if not exists public.intent_snapshots (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intent_orders(id) on delete cascade,
  project_title text,
  result_summary text,
  selected_quantity int,
  package_level text,
  design_service_level text,
  sale_mode text,
  crowdfunding_target_people int,
  estimated_unit_price_min int,
  estimated_unit_price_max int,
  estimated_total_price_min int,
  estimated_total_price_max int,
  discount_amount int not null default 0,
  pricing_meta jsonb not null default '{}'::jsonb,
  ui_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_sheets (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intent_orders(id) on delete cascade,
  version int not null default 1,
  quote_status text not null default 'draft' check (quote_status in ('draft', 'sent', 'accepted', 'expired', 'replaced', 'converted_to_order')),
  valid_until timestamptz,
  quantity int not null,
  package_level text not null,
  design_service_level text not null,
  final_unit_price int not null,
  final_total_price int not null,
  design_fee int not null default 0,
  discount_amount int not null default 0,
  deposit_amount int not null default 0,
  payment_mode text not null default 'deposit' check (payment_mode in ('deposit', 'full', 'crowdfunding_support')),
  delivery_note text,
  production_note text,
  risk_note text,
  extra jsonb not null default '{}'::jsonb,
  confirmed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_quote_sheets_updated_at on public.quote_sheets;
create trigger trg_quote_sheets_updated_at
before update on public.quote_sheets
for each row
execute procedure public.set_updated_at();

create table if not exists public.intent_followups (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intent_orders(id) on delete cascade,
  action_type text not null,
  from_status text,
  to_status text,
  content text not null,
  actor_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_intent_orders_status_created
on public.intent_orders(status, created_at desc);

create index if not exists idx_intent_orders_source_created
on public.intent_orders(source_type, created_at desc);

create index if not exists idx_intent_orders_user_created
on public.intent_orders(user_id, created_at desc);

create index if not exists idx_intent_snapshots_intent_created
on public.intent_snapshots(intent_id, created_at desc);

create index if not exists idx_quote_sheets_intent_version
on public.quote_sheets(intent_id, version desc);

create index if not exists idx_quote_sheets_status_created
on public.quote_sheets(quote_status, created_at desc);

create index if not exists idx_intent_followups_intent_created
on public.intent_followups(intent_id, created_at desc);
