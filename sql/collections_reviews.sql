-- US-08 Colecciones, US-09 libros de cocina, US-10 Reseñas
-- Ejecutar en Supabase SQL Editor

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists collection_recipes (
  collection_id uuid not null references collections (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table collections enable row level security;
alter table collection_recipes enable row level security;
alter table reviews enable row level security;

create policy "collections_select_own" on collections for select using (auth.uid() = user_id);
create policy "collections_insert_own" on collections for insert with check (auth.uid() = user_id);
create policy "collections_update_own" on collections for update using (auth.uid() = user_id);
create policy "collections_delete_own" on collections for delete using (auth.uid() = user_id);

create policy "collection_recipes_select" on collection_recipes for select using (
  exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
);
create policy "collection_recipes_insert" on collection_recipes for insert with check (
  exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
);
create policy "collection_recipes_delete" on collection_recipes for delete using (
  exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
);

create policy "reviews_select_all" on reviews for select using (true);
create policy "reviews_insert_own" on reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on reviews for update using (auth.uid() = user_id);
create policy "reviews_delete_own" on reviews for delete using (auth.uid() = user_id);
