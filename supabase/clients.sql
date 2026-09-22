-- EsteticPro — módulo Clientes
-- Execute no SQL Editor caso a tabela public.clients ainda não exista.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  cpf text,
  instagram text,
  address text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;
drop policy if exists "clients_own_data" on public.clients;
create policy "clients_own_data" on public.clients
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_full_name_idx on public.clients(user_id, full_name);
