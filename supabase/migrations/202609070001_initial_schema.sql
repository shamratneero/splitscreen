-- SplitSave initial schema. All money is integer taka. Apply with Supabase CLI after linking a project.
create extension if not exists pgcrypto;

create type public.split_status as enum ('DRAFT','RECEIPT_CAPTURED','REVIEW_REQUIRED','READY_TO_SHARE','CLAIMING','ALL_ITEMS_ASSIGNED','AWAITING_PAYMENT','SETTLED');
create type public.payment_status as enum ('UNPAID','GUEST_REPORTED','CONFIRMED','FAILED','REFUNDED');
create type public.guest_status as enum ('ACTIVE','CONFIRMED');
create type public.claim_allocation_type as enum ('INDIVIDUAL','SHARED');
create type public.split_event_type as enum ('GUEST_JOINED','ITEM_CLAIMED','CLAIM_CHANGED','GUEST_CONFIRMED','PAYMENT_REPORTED','PAYMENT_CONFIRMED');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, bkash_number text, nagad_number text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.splits (
  id uuid primary key default gen_random_uuid(), host_user_id uuid not null references public.profiles(id) on delete restrict,
  restaurant_name text not null default '', split_date date not null default current_date, currency text not null default 'BDT' check (currency = 'BDT'), status public.split_status not null default 'DRAFT',
  subtotal integer not null default 0 check (subtotal >= 0), vat integer not null default 0 check (vat >= 0), service_charge integer not null default 0 check (service_charge >= 0), discount integer not null default 0 check (discount >= 0), receipt_total integer not null default 0 check (receipt_total >= 0), calculated_total integer not null default 0 check (calculated_total >= 0), public_token uuid not null unique default gen_random_uuid(),
  bkash_number text, nagad_number text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.receipts (id uuid primary key default gen_random_uuid(), split_id uuid not null unique references public.splits(id) on delete cascade, storage_path text, raw_ocr jsonb, captured_at timestamptz not null default now());
create table public.items (id uuid primary key default gen_random_uuid(), split_id uuid not null references public.splits(id) on delete cascade, name text not null check (char_length(name) <= 160), quantity integer not null check (quantity > 0), unit_price integer not null check (unit_price >= 0), line_total integer generated always as (quantity * unit_price) stored, ocr_confidence numeric(4,3), ocr_bbox jsonb, sort_order integer not null default 0, created_at timestamptz not null default now());
create table public.guests (id uuid primary key default gen_random_uuid(), split_id uuid not null references public.splits(id) on delete cascade, session_id uuid not null, display_name text, status public.guest_status not null default 'ACTIVE', confirmed_at timestamptz, created_at timestamptz not null default now(), unique(split_id, session_id));
create table public.claims (id uuid primary key default gen_random_uuid(), guest_id uuid not null references public.guests(id) on delete cascade, item_id uuid not null references public.items(id) on delete cascade, quantity integer not null check (quantity > 0), allocation_type public.claim_allocation_type not null default 'INDIVIDUAL', share_group_id uuid, participant_ids uuid[] not null default '{}', created_at timestamptz not null default now());
create table public.payments (id uuid primary key default gen_random_uuid(), guest_id uuid not null unique references public.guests(id) on delete cascade, amount integer not null check (amount >= 0), method text, status public.payment_status not null default 'UNPAID', guest_reported_at timestamptz, confirmed_at timestamptz, confirmed_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.split_events (id bigint generated always as identity primary key, split_id uuid not null references public.splits(id) on delete cascade, guest_id uuid references public.guests(id) on delete set null, event_type public.split_event_type not null, payload jsonb not null default '{}', created_at timestamptz not null default now());

create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '')); return new; end; $$;
create trigger create_profile_after_signup after insert on auth.users for each row execute procedure public.create_profile_for_user();

create index items_split_sort_idx on public.items(split_id, sort_order);
create index guests_split_idx on public.guests(split_id);
create index claims_item_idx on public.claims(item_id);
create index claims_guest_idx on public.claims(guest_id);
create index payments_status_idx on public.payments(status);
create index split_events_split_created_idx on public.split_events(split_id, created_at desc);

alter table public.profiles enable row level security; alter table public.splits enable row level security; alter table public.receipts enable row level security; alter table public.items enable row level security; alter table public.guests enable row level security; alter table public.claims enable row level security; alter table public.payments enable row level security; alter table public.split_events enable row level security;
create policy "host owns profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "host owns splits" on public.splits for all using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());
create policy "host owns receipts" on public.receipts for all using (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid())) with check (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid()));
create policy "host owns items" on public.items for all using (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid())) with check (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid()));
create policy "host reads guests" on public.guests for select using (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid()));
create policy "host reads claims" on public.claims for select using (exists (select 1 from public.guests g join public.splits s on s.id = g.split_id where g.id = guest_id and s.host_user_id = auth.uid()));
create policy "host manages payments" on public.payments for all using (exists (select 1 from public.guests g join public.splits s on s.id = g.split_id where g.id = guest_id and s.host_user_id = auth.uid())) with check (exists (select 1 from public.guests g join public.splits s on s.id = g.split_id where g.id = guest_id and s.host_user_id = auth.uid()));
create policy "host reads events" on public.split_events for select using (exists (select 1 from public.splits s where s.id = split_id and s.host_user_id = auth.uid()));

-- Public guests never receive direct table policies. Security-definer RPCs expose only their split and session.
create or replace function public.claim_item(p_token uuid, p_session_id uuid, p_item_id uuid, p_quantity integer)
returns public.claims language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid; v_available integer; v_claim public.claims;
begin
  if p_quantity < 1 then raise exception 'quantity must be positive'; end if;
  select id into v_split_id from splits where public_token = p_token and status in ('READY_TO_SHARE','CLAIMING','ALL_ITEMS_ASSIGNED');
  if v_split_id is null then raise exception 'split is unavailable'; end if;
  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then insert into guests(split_id, session_id) values(v_split_id, p_session_id) returning id into v_guest_id; end if;
  perform 1 from items where id = p_item_id and split_id = v_split_id for update;
  if not found then raise exception 'item not found'; end if;
  select i.quantity - coalesce(sum(c.quantity), 0) into v_available from items i left join claims c on c.item_id = i.id where i.id = p_item_id group by i.quantity;
  if v_available < p_quantity then raise exception 'Someone just claimed the last item'; end if;
  insert into claims(guest_id, item_id, quantity, allocation_type, participant_ids) values(v_guest_id, p_item_id, p_quantity, 'INDIVIDUAL', array[v_guest_id]) returning * into v_claim;
  insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'ITEM_CLAIMED', jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity));
  return v_claim;
end; $$;
revoke all on function public.claim_item(uuid, uuid, uuid, integer) from public;
grant execute on function public.claim_item(uuid, uuid, uuid, integer) to anon, authenticated;
