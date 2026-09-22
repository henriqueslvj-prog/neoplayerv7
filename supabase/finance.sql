create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type text not null default 'receita',
  description text not null,
  category text,
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  payment_method text,
  status text not null default 'pago',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_type_check check (type in ('receita','despesa')),
  constraint financial_status_check check (status in ('pago','pendente','cancelado'))
);

alter table public.financial_transactions enable row level security;

drop policy if exists "financial_transactions_own_data" on public.financial_transactions;
create policy "financial_transactions_own_data"
on public.financial_transactions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists financial_transactions_user_date_idx
on public.financial_transactions(user_id, transaction_date desc);

create index if not exists financial_transactions_client_idx
on public.financial_transactions(client_id);

create or replace function public.validate_financial_client_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.user_id = new.user_id
  ) then
    raise exception 'A cliente selecionada não pertence ao usuário autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_financial_client_owner on public.financial_transactions;
create trigger validate_financial_client_owner
before insert or update of client_id, user_id
on public.financial_transactions
for each row execute procedure public.validate_financial_client_owner();

create or replace function public.touch_financial_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists financial_transactions_touch_updated_at on public.financial_transactions;
create trigger financial_transactions_touch_updated_at
before update on public.financial_transactions
for each row execute procedure public.touch_financial_transactions_updated_at();
