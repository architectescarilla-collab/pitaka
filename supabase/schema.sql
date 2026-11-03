-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- One row per user holds that user's whole Pitaka data as JSON.
create table if not exists public.pitaka_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pitaka_data enable row level security;

-- Each signed-in user can only see and change their own row.
drop policy if exists "own row: select" on public.pitaka_data;
drop policy if exists "own row: insert" on public.pitaka_data;
drop policy if exists "own row: update" on public.pitaka_data;
drop policy if exists "own row: delete" on public.pitaka_data;
create policy "own row: select" on public.pitaka_data for select to authenticated using (auth.uid() = user_id);
create policy "own row: insert" on public.pitaka_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own row: update" on public.pitaka_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.pitaka_data for delete to authenticated using (auth.uid() = user_id);
