create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  photo_url text,
  handle text unique,
  friend_code text unique,
  timezone text not null default 'UTC',
  discoverable_by_handle boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dinners (
  id text primary key,
  payer_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  participant_ids text[] not null default '{}',
  receipt_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinners_payer_is_participant check (payer_id = any(participant_ids))
);

create table if not exists public.receipt_scans (
  id text primary key,
  dinner_id text not null references public.dinners(id) on delete cascade,
  merchant_name text not null,
  receipt_date date not null,
  image_url text not null default '',
  ocr_confidence double precision not null default 0,
  parser_mode text not null,
  parse_status text,
  parse_warnings text[] not null default '{}',
  tax_cents integer not null default 0,
  tax_included boolean not null default false,
  service_charge_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  raw_receipt jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_items (
  id text primary key,
  dinner_id text not null references public.dinners(id) on delete cascade,
  receipt_id text not null references public.receipt_scans(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  price_cents integer not null default 0,
  assigned_participant_ids text[] not null default '{}',
  confidence double precision not null default 0,
  parse_source text,
  needs_review boolean not null default false,
  item_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint receipt_items_quantity_positive check (quantity >= 1)
);

create table if not exists public.dinner_member_statuses (
  dinner_id text not null references public.dinners(id) on delete cascade,
  participant_id text not null references public.profiles(id) on delete cascade,
  status text not null default 'unpaid',
  updated_at timestamptz not null default now(),
  primary key (dinner_id, participant_id),
  constraint dinner_member_status_valid check (status in ('unpaid', 'reminded', 'paid'))
);

create table if not exists public.payment_proofs (
  id text primary key,
  dinner_id text not null references public.dinners(id) on delete cascade,
  participant_id text not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text,
  uploaded_at timestamptz not null,
  extracted jsonb not null,
  validation jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_devices (
  user_id text not null references public.profiles(id) on delete cascade,
  token_hash text not null,
  fcm_token text not null,
  enabled boolean not null default true,
  platform text not null default 'Unknown browser',
  updated_at timestamptz not null default now(),
  primary key (user_id, token_hash)
);

create table if not exists public.notification_events (
  id text primary key,
  dinner_id text not null references public.dinners(id) on delete cascade,
  participant_id text not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  delivery_status text not null default 'queued',
  created_at timestamptz not null default now()
);

create index if not exists dinners_participant_ids_gin
  on public.dinners using gin (participant_ids);

create index if not exists receipt_items_dinner_id_idx
  on public.receipt_items (dinner_id, item_order);

create index if not exists dinner_member_statuses_participant_id_idx
  on public.dinner_member_statuses (participant_id);

create index if not exists payment_proofs_dinner_participant_idx
  on public.payment_proofs (dinner_id, participant_id);

create index if not exists user_devices_enabled_idx
  on public.user_devices (user_id, enabled);

alter table public.profiles enable row level security;
alter table public.dinners enable row level security;
alter table public.receipt_scans enable row level security;
alter table public.receipt_items enable row level security;
alter table public.dinner_member_statuses enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.user_devices enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "Profiles are readable by signed-in users" on public.profiles;
create policy "Profiles are readable by signed-in users"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

drop policy if exists "Dinner members can read dinners" on public.dinners;
create policy "Dinner members can read dinners"
  on public.dinners for select
  using (auth.uid()::text = any(participant_ids));

drop policy if exists "Payers can manage their dinners" on public.dinners;
create policy "Payers can manage their dinners"
  on public.dinners for all
  using (payer_id = auth.uid()::text)
  with check (payer_id = auth.uid()::text);

drop policy if exists "Dinner members can read receipt scans" on public.receipt_scans;
create policy "Dinner members can read receipt scans"
  on public.receipt_scans for select
  using (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_scans.dinner_id
        and auth.uid()::text = any(dinners.participant_ids)
    )
  );

drop policy if exists "Dinner payers can manage receipt scans" on public.receipt_scans;
create policy "Dinner payers can manage receipt scans"
  on public.receipt_scans for all
  using (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_scans.dinner_id
        and dinners.payer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_scans.dinner_id
        and dinners.payer_id = auth.uid()::text
    )
  );

drop policy if exists "Dinner members can read receipt items" on public.receipt_items;
create policy "Dinner members can read receipt items"
  on public.receipt_items for select
  using (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_items.dinner_id
        and auth.uid()::text = any(dinners.participant_ids)
    )
  );

drop policy if exists "Dinner payers can manage receipt items" on public.receipt_items;
create policy "Dinner payers can manage receipt items"
  on public.receipt_items for all
  using (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_items.dinner_id
        and dinners.payer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.dinners
      where dinners.id = receipt_items.dinner_id
        and dinners.payer_id = auth.uid()::text
    )
  );

drop policy if exists "Dinner members can read statuses" on public.dinner_member_statuses;
create policy "Dinner members can read statuses"
  on public.dinner_member_statuses for select
  using (
    exists (
      select 1 from public.dinners
      where dinners.id = dinner_member_statuses.dinner_id
        and auth.uid()::text = any(dinners.participant_ids)
    )
  );

drop policy if exists "Participants can update their own status" on public.dinner_member_statuses;
create policy "Participants can update their own status"
  on public.dinner_member_statuses for update
  using (participant_id = auth.uid()::text)
  with check (participant_id = auth.uid()::text);

drop policy if exists "Participants can manage their proofs" on public.payment_proofs;
create policy "Participants can manage their proofs"
  on public.payment_proofs for all
  using (participant_id = auth.uid()::text)
  with check (participant_id = auth.uid()::text);

drop policy if exists "Users can manage their own devices" on public.user_devices;
create policy "Users can manage their own devices"
  on public.user_devices for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "Users can read their notification events" on public.notification_events;
create policy "Users can read their notification events"
  on public.notification_events for select
  using (participant_id = auth.uid()::text);
