-- ============================================================================
-- All in one converter — Supabase / PostgreSQL schema
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Includes tables, row-level security, and a trigger that provisions a
-- profile row whenever a new auth user signs up.
-- ============================================================================

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type subscription_plan as enum ('free', 'pro', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_status as enum ('uploaded', 'processing', 'ready', 'failed', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversion_status as enum ('queued', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active', 'canceled', 'trialing', 'past_due');
exception when duplicate_object then null; end $$;

-- ── profiles ───────────────────────────────────────────────────────────────
-- 1:1 with auth.users. Stores public-facing user info + current plan.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  avatar_url  text,
  plan        subscription_plan not null default 'free',
  pro_until   timestamptz,                 -- when a paid plan lapses back to free
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- For existing databases, add the columns if they aren't there yet:
alter table public.profiles add column if not exists pro_until timestamptz;
-- When we last emailed this user a renewal reminder (cleared on each grant).
alter table public.profiles add column if not exists renewal_reminded_at timestamptz;
-- When the one-time welcome email was sent (null = not welcomed yet).
alter table public.profiles add column if not exists welcomed_at timestamptz;

-- ── files ──────────────────────────────────────────────────────────────────
create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  filename      text not null,
  size          bigint not null default 0,
  type          text,                       -- MIME type
  status        file_status not null default 'uploaded',
  storage_path  text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);
create index if not exists files_user_id_idx on public.files (user_id, created_at desc);
-- Shared team workspace: tag each output file with the team + the converter used.
alter table public.files add column if not exists team_id uuid;
alter table public.files add column if not exists tool text;
create index if not exists files_team_id_idx on public.files (team_id, created_at desc);

-- ── conversions ────────────────────────────────────────────────────────────
create table if not exists public.conversions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  tool          text not null,              -- tool slug, e.g. 'merge-pdf'
  source_file   text,
  output_file   text,
  status        conversion_status not null default 'queued',
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists conversions_user_id_idx on public.conversions (user_id, created_at desc);
-- Tag conversions to a team so members can see shared activity (optional).
alter table public.conversions add column if not exists team_id uuid;

-- ── subscriptions ──────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  plan                subscription_plan not null default 'free',
  status              subscription_status not null default 'active',
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);
create unique index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- ── updated_at trigger for profiles ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Auto-provision profile on signup ───────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.files         enable row level security;
alter table public.conversions   enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: a user can read/update only their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- files
drop policy if exists "files_select_own" on public.files;
create policy "files_select_own" on public.files for select using (auth.uid() = user_id);
drop policy if exists "files_insert_own" on public.files;
create policy "files_insert_own" on public.files for insert with check (auth.uid() = user_id);
drop policy if exists "files_modify_own" on public.files;
create policy "files_modify_own" on public.files for update using (auth.uid() = user_id);
drop policy if exists "files_delete_own" on public.files;
create policy "files_delete_own" on public.files for delete using (auth.uid() = user_id);

-- conversions
drop policy if exists "conversions_select_own" on public.conversions;
create policy "conversions_select_own" on public.conversions for select using (auth.uid() = user_id);
drop policy if exists "conversions_insert_own" on public.conversions;
create policy "conversions_insert_own" on public.conversions for insert with check (auth.uid() = user_id);
drop policy if exists "conversions_update_own" on public.conversions;
create policy "conversions_update_own" on public.conversions for update using (auth.uid() = user_id);

-- subscriptions (read-only to the user; writes happen via service role)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- Business plan features: REST API keys + Team workspaces & roles
-- All access is mediated by the backend (service-role), which bypasses RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── api_keys ────────────────────────────────────────────────────────────────
-- One row per issued key. Only a SHA-256 hash of the key is stored; the full
-- key is shown to the user exactly once at creation time.
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'API key',
  key_hash     text not null,          -- sha256 hex of the full secret
  key_prefix   text not null,          -- e.g. 'aio_live_9f3k…' (display only)
  last_used_at timestamptz,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists api_keys_user_id_idx on public.api_keys (user_id, created_at desc);
create unique index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

-- ── teams + members ─────────────────────────────────────────────────────────
do $$ begin
  create type team_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'My team',
  created_at  timestamptz not null default now()
);
-- One workspace per owner (keeps the model simple).
create unique index if not exists teams_owner_id_idx on public.teams (owner_id);

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  email       text not null,
  user_id     uuid references auth.users (id) on delete set null,
  role        team_role not null default 'member',
  status      text not null default 'invited',  -- 'invited' until the user signs in
  created_at  timestamptz not null default now()
);
create unique index if not exists team_members_team_email_idx on public.team_members (team_id, lower(email));
create index if not exists team_members_email_idx on public.team_members (lower(email));
create index if not exists team_members_user_id_idx on public.team_members (user_id);

-- ── api_requests ────────────────────────────────────────────────────────────
-- One row per REST-API-authenticated request (for usage analytics: totals,
-- errors, success rate, peak RPM/RPD, per-tool, per-key). Written by the backend.
create table if not exists public.api_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  key_id      uuid references public.api_keys (id) on delete set null,
  tool        text,
  status      int not null default 200,
  created_at  timestamptz not null default now()
);
create index if not exists api_requests_user_created_idx on public.api_requests (user_id, created_at desc);

-- RLS on (service-role bypasses; these allow a signed-in user to read their own).
alter table public.api_keys     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.api_requests enable row level security;

drop policy if exists "api_requests_select_own" on public.api_requests;
create policy "api_requests_select_own" on public.api_requests for select using (auth.uid() = user_id);

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys for select using (auth.uid() = user_id);

drop policy if exists "teams_select_own" on public.teams;
create policy "teams_select_own" on public.teams for select using (auth.uid() = owner_id);

drop policy if exists "team_members_select_self" on public.team_members;
create policy "team_members_select_self" on public.team_members
  for select using (auth.uid() = user_id);

-- ── Storage bucket for user uploads ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

drop policy if exists "user_files_rw" on storage.objects;
create policy "user_files_rw" on storage.objects
  for all using (
    bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]
  );
