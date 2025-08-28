-- CineFile per-user RLS setup (trigger-free)
-- Run this once in Supabase SQL Editor for your project.

-- MOVIES -------------------------------------------------------
alter table public.movies add column if not exists user_id uuid;
alter table public.movies enable row level security;

drop policy if exists movies_select_own on public.movies;
drop policy if exists movies_insert_own on public.movies;
drop policy if exists movies_update_own on public.movies;
drop policy if exists movies_delete_own on public.movies;

create policy movies_select_own on public.movies
  for select using (user_id = auth.uid());
create policy movies_insert_own on public.movies
  for insert with check (user_id = auth.uid());
create policy movies_update_own on public.movies
  for update using (user_id = auth.uid());
create policy movies_delete_own on public.movies
  for delete using (user_id = auth.uid());

create unique index if not exists movies_user_id_id_key on public.movies (user_id, id);

-- LISTS --------------------------------------------------------
alter table public.lists add column if not exists user_id uuid;
alter table public.lists enable row level security;

drop policy if exists lists_select_own on public.lists;
drop policy if exists lists_insert_own on public.lists;
drop policy if exists lists_update_own on public.lists;
drop policy if exists lists_delete_own on public.lists;

create policy lists_select_own on public.lists
  for select using (user_id = auth.uid());
create policy lists_insert_own on public.lists
  for insert with check (user_id = auth.uid());
create policy lists_update_own on public.lists
  for update using (user_id = auth.uid());
create policy lists_delete_own on public.lists
  for delete using (user_id = auth.uid());

create unique index if not exists lists_user_id_id_key on public.lists (user_id, id);

-- LIST ITEMS ---------------------------------------------------
alter table public.list_items add column if not exists user_id uuid;
alter table public.list_items enable row level security;

drop policy if exists list_items_select_own on public.list_items;
drop policy if exists list_items_insert_own on public.list_items;
drop policy if exists list_items_update_own on public.list_items;
drop policy if exists list_items_delete_own on public.list_items;

create policy list_items_select_own on public.list_items
  for select using (user_id = auth.uid());
create policy list_items_insert_own on public.list_items
  for insert with check (user_id = auth.uid());
create policy list_items_update_own on public.list_items
  for update using (user_id = auth.uid());
create policy list_items_delete_own on public.list_items
  for delete using (user_id = auth.uid());

create unique index if not exists list_items_user_id_id_key on public.list_items (user_id, id);
