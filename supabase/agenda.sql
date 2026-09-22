-- EsteticPro — Agenda + integração de notificações
-- Execute no SQL Editor do Supabase.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_date date not null,
  start_time time not null,
  end_time time,
  procedure_name text,
  status text not null default 'Agendado',
  notes text,
  whatsapp_status text not null default 'nao_enviado',
  whatsapp_sent_at timestamptz,
  whatsapp_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('Agendado','Confirmado','Aguardando','Concluído','Cancelado','Faltou')),
  constraint appointments_whatsapp_status_check check (whatsapp_status in ('nao_enviado','enviado','erro'))
);

alter table public.appointments enable row level security;

drop policy if exists "appointments_own_data" on public.appointments;
create policy "appointments_own_data"
on public.appointments
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists appointments_user_date_idx
on public.appointments(user_id, appointment_date, start_time);

create index if not exists appointments_client_idx
on public.appointments(client_id);

-- Garante que a cliente vinculada pertence ao mesmo profissional.
create or replace function public.validate_appointment_client_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clients c
    where c.id = new.client_id
      and c.user_id = new.user_id
  ) then
    raise exception 'A cliente selecionada não pertence ao usuário autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_appointment_client_owner on public.appointments;
create trigger validate_appointment_client_owner
before insert or update of client_id, user_id
on public.appointments
for each row execute procedure public.validate_appointment_client_owner();

create or replace function public.touch_appointments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
before update on public.appointments
for each row execute procedure public.touch_appointments_updated_at();

