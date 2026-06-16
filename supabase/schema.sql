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

-- For existing databases, add the column if it isn't there yet:
alter table public.profiles add column if not exists pro_until timestamptz;

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
