-- Ejecutar en Supabase SQL Editor si aún no existe la tabla favorites (US-03)

create table if not exists favorites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  recipe_id uuid references recipes(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, recipe_id)
);

alter table favorites enable row level security;

create policy "favorites_select_own" on favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on favorites for delete using (auth.uid() = user_id);

-- Perfil: permitir que el usuario cree su propia fila (auto-insert desde la app)
-- create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
-- create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
