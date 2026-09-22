-- ESTETICPRO V6 — EVOLUÇÃO + GOOGLE DRIVE
-- Banco compatível com o fluxo atual do App.jsx e das Edge Functions.

create table if not exists public.client_evolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  evolution_date date not null default current_date,
  procedure_name text,
  notes text,
  products_used text,
  recommendations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_evolutions enable row level security;
drop policy if exists "client_evolutions_own_data" on public.client_evolutions;
create policy "client_evolutions_own_data"
on public.client_evolutions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists client_evolutions_user_date_idx
on public.client_evolutions (user_id, evolution_date desc);

create index if not exists client_evolutions_client_idx
on public.client_evolutions (client_id, evolution_date desc);

create index if not exists client_evolutions_appointment_idx
on public.client_evolutions (appointment_id);

create table if not exists public.evolution_photos (
  id uuid primary key default gen_random_uuid(),
  evolution_id uuid not null references public.client_evolutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_type text not null default 'adicional',
  drive_file_id text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint evolution_photos_type_check
    check (photo_type in ('antes','depois','adicional'))
);

alter table public.evolution_photos enable row level security;
drop policy if exists "evolution_photos_own_data" on public.evolution_photos;
create policy "evolution_photos_own_data"
on public.evolution_photos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists evolution_photos_evolution_idx
on public.evolution_photos (evolution_id);

create index if not exists evolution_photos_user_idx
on public.evolution_photos (user_id);

create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  google_account_email text,
  google_subject_id text,
  root_folder_id text,
  root_folder_name text default 'EsteticPro',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_connections enable row level security;
drop policy if exists "google_drive_connections_own_data" on public.google_drive_connections;
create policy "google_drive_connections_own_data"
on public.google_drive_connections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists google_drive_connections_user_idx
on public.google_drive_connections (user_id);

create table if not exists public.google_drive_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  state text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.google_drive_oauth_states enable row level security;
drop policy if exists "google_drive_oauth_states_own_data" on public.google_drive_oauth_states;
create policy "google_drive_oauth_states_own_data"
on public.google_drive_oauth_states
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists google_drive_oauth_states_user_idx
on public.google_drive_oauth_states (user_id);

create index if not exists google_drive_oauth_states_expires_idx
on public.google_drive_oauth_states (expires_at);

create or replace function public.validate_evolution_client_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.clients c
    where c.id = new.client_id
      and c.user_id = new.user_id
  ) then
    raise exception 'A cliente selecionada não pertence ao usuário autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_evolution_client_owner on public.client_evolutions;
create trigger validate_evolution_client_owner
before insert or update of client_id, user_id
on public.client_evolutions
for each row
execute procedure public.validate_evolution_client_owner();

create or replace function public.validate_evolution_photo_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.client_evolutions e
    where e.id = new.evolution_id
      and e.user_id = new.user_id
  ) then
    raise exception 'A evolução selecionada não pertence ao usuário autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_evolution_photo_owner on public.evolution_photos;
create trigger validate_evolution_photo_owner
before insert or update of evolution_id, user_id
on public.evolution_photos
for each row
execute procedure public.validate_evolution_photo_owner();

create or replace function public.touch_client_evolutions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_evolutions_touch_updated_at on public.client_evolutions;
create trigger client_evolutions_touch_updated_at
before update on public.client_evolutions
for each row
execute procedure public.touch_client_evolutions_updated_at();

create or replace function public.touch_google_drive_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists google_drive_connections_touch_updated_at on public.google_drive_connections;
create trigger google_drive_connections_touch_updated_at
before update on public.google_drive_connections
for each row
execute procedure public.touch_google_drive_connections_updated_at();

create or replace function public.cleanup_expired_google_drive_oauth_states()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.google_drive_oauth_states
  where expires_at < now();
$$;

-- Vault: refresh token nunca é exposto ao frontend.
create or replace function public.store_google_drive_refresh_token_backend(
  p_user_id uuid,
  p_refresh_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_secret_name text;
begin
  if current_user <> 'service_role'
     and current_user <> 'postgres' then
    raise exception 'Acesso não autorizado.';
  end if;

  v_secret_name := 'esteticpro_google_refresh_' || p_user_id::text;

  select id
  into v_secret_id
  from vault.secrets
  where name = v_secret_name
  limit 1;

  if v_secret_id is not null then
    perform vault.update_secret(
      v_secret_id,
      p_refresh_token,
      v_secret_name,
      'Refresh token Google Drive do usuário EsteticPro'
    );
    return v_secret_id;
  end if;

  v_secret_id := vault.create_secret(
    p_refresh_token,
    v_secret_name,
    'Refresh token Google Drive do usuário EsteticPro'
  );

  return v_secret_id;
end;
$$;

revoke all on function public.store_google_drive_refresh_token_backend(uuid, text) from public;
revoke all on function public.store_google_drive_refresh_token_backend(uuid, text) from anon;
revoke all on function public.store_google_drive_refresh_token_backend(uuid, text) from authenticated;
grant execute on function public.store_google_drive_refresh_token_backend(uuid, text) to service_role;

create or replace function public.get_google_drive_refresh_token(
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_token text;
  v_secret_name text;
begin
  if current_user <> 'service_role'
     and current_user <> 'postgres' then
    raise exception 'Acesso não autorizado.';
  end if;

  v_secret_name := 'esteticpro_google_refresh_' || p_user_id::text;

  select decrypted_secret
  into v_token
  from vault.decrypted_secrets
  where name = v_secret_name
  limit 1;

  return v_token;
end;
$$;

revoke all on function public.get_google_drive_refresh_token(uuid) from public;
revoke all on function public.get_google_drive_refresh_token(uuid) from anon;
revoke all on function public.get_google_drive_refresh_token(uuid) from authenticated;
grant execute on function public.get_google_drive_refresh_token(uuid) to service_role;
