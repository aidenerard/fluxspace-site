-- FluxSpace: runs table + storage buckets
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)

-- ─── Table ─────────────────────────────────────────────────
create table if not exists public.runs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'uploaded'
                     check (status in ('uploaded','queued','processing','exporting','done','failed')),
  stage            text,
  progress         int not null default 0,
  raw_zip_path     text not null,
  processed_prefix text not null,
  error_message    text,
  log_path         text,
  summary_json     jsonb
);

create index if not exists idx_runs_user   on public.runs(user_id);
create index if not exists idx_runs_status on public.runs(status);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.runs enable row level security;

create policy "Users can view own runs"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

-- Only the service-role (backend worker) updates rows; anon/auth
-- users can read but never update or delete.

-- ─── Storage Buckets ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('runs-raw', 'runs-raw', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('runs-processed', 'runs-processed', false)
on conflict (id) do nothing;

-- Users can upload to runs-raw under their own user-id prefix
create policy "Users upload own raw zips"
  on storage.objects for insert
  with check (
    bucket_id = 'runs-raw'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own raw objects"
  on storage.objects for select
  using (
    bucket_id = 'runs-raw'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own processed outputs
create policy "Users read own processed objects"
  on storage.objects for select
  using (
    bucket_id = 'runs-processed'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role writes to runs-processed bypass RLS automatically.
