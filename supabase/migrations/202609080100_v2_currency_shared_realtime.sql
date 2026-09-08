-- v2: multi-currency, shared items, and realtime.
--
-- Money stays an integer count of the currency's smallest unit. Taka is written
-- whole, so a taka column already holds minor units; SGD and MYR are written
-- with cents, so the same integer column holds cents. Nothing becomes a float,
-- and the split engine's remainder allocation keeps working unchanged.

-- 1. Currency ------------------------------------------------------------
-- The original schema pinned every split to BDT. Allow the markets the app
-- actually targets, still refusing anything unrecognised.
alter table public.splits drop constraint if exists splits_currency_check;
alter table public.splits add constraint splits_currency_check
  check (currency in ('BDT', 'INR', 'MYR', 'SGD', 'THB'));

-- Hosts settle in one currency; remember it so new splits inherit it.
alter table public.profiles add column if not exists default_currency text not null default 'BDT'
  check (default_currency in ('BDT', 'INR', 'MYR', 'SGD', 'THB'));

-- Payment handles differ per country — bKash here, UPI or PayNow elsewhere —
-- so store them as labelled rows rather than two fixed columns.
create table if not exists public.payment_handles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  handle text not null check (char_length(handle) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, label)
);
alter table public.payment_handles enable row level security;
drop policy if exists "host owns payment handles" on public.payment_handles;
create policy "host owns payment handles" on public.payment_handles for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- 2. Shared items --------------------------------------------------------
-- The engine and the claims table already model a SHARED allocation split
-- across fixed participants; only a public entry point was missing. Guests get
-- no table grants, so this is a security-definer RPC like the others.
create or replace function public.set_shared_claim(
  p_token uuid, p_session_id uuid, p_item_id uuid, p_quantity integer, p_participant_ids uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid; v_current integer; v_available integer; v_stranger integer;
begin
  if p_quantity < 0 then raise exception 'quantity must not be negative'; end if;
  if array_length(p_participant_ids, 1) is null then raise exception 'choose who is sharing'; end if;

  select id into v_split_id from splits
    where public_token = p_token and status in ('READY_TO_SHARE','CLAIMING','ALL_ITEMS_ASSIGNED');
  if v_split_id is null then raise exception 'split is unavailable'; end if;

  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then
    if p_quantity = 0 then return; end if;
    insert into guests(split_id, session_id) values(v_split_id, p_session_id) returning id into v_guest_id;
    insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'GUEST_JOINED', '{}');
  end if;

  -- Everyone sharing must already be on this split; otherwise a guest could
  -- name arbitrary ids and bind strangers to a charge.
  select count(*) into v_stranger from unnest(p_participant_ids) as pid
    where not exists (select 1 from guests g where g.id = pid and g.split_id = v_split_id);
  if v_stranger > 0 then raise exception 'everyone sharing must have joined this split'; end if;
  if not (v_guest_id = any(p_participant_ids)) then raise exception 'you must be one of the people sharing'; end if;

  perform 1 from items where id = p_item_id and split_id = v_split_id for update;
  if not found then raise exception 'item not found'; end if;

  select quantity into v_current from claims where guest_id = v_guest_id and item_id = p_item_id;
  select i.quantity - coalesce(sum(c.quantity), 0) + coalesce(v_current, 0) into v_available
    from items i left join claims c on c.item_id = i.id where i.id = p_item_id group by i.quantity;
  if v_available < p_quantity then raise exception 'Someone else just claimed that — try a smaller amount'; end if;

  if p_quantity = 0 then
    delete from claims where guest_id = v_guest_id and item_id = p_item_id;
  elsif v_current is null then
    insert into claims(guest_id, item_id, quantity, allocation_type, participant_ids)
      values(v_guest_id, p_item_id, p_quantity, 'SHARED', p_participant_ids);
  else
    update claims set quantity = p_quantity, allocation_type = 'SHARED', participant_ids = p_participant_ids
      where guest_id = v_guest_id and item_id = p_item_id;
  end if;

  insert into split_events(split_id, guest_id, event_type, payload)
    values(v_split_id, v_guest_id, 'ITEM_CLAIMED',
           jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'shared_with', p_participant_ids));
  update splits set status = 'CLAIMING' where id = v_split_id and status = 'READY_TO_SHARE';
end; $$;
revoke all on function public.set_shared_claim(uuid, uuid, uuid, integer, uuid[]) from public;
grant execute on function public.set_shared_claim(uuid, uuid, uuid, integer, uuid[]) to anon, authenticated;

-- 3. Expose currency and payment handles to guests -----------------------
create or replace function public.get_public_split(p_token uuid, p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_split record; v_guest_id uuid; v_result jsonb;
begin
  select s.*, p.bkash_number as host_bkash, p.nagad_number as host_nagad, p.display_name as host_display_name
    into v_split from splits s join profiles p on p.id = s.host_user_id where s.public_token = p_token;
  if v_split is null then return null; end if;

  if p_session_id is not null then
    select id into v_guest_id from guests where split_id = v_split.id and session_id = p_session_id;
  end if;

  select jsonb_build_object(
    'split', jsonb_build_object(
      'id', v_split.id, 'restaurantName', v_split.restaurant_name, 'splitDate', v_split.split_date,
      'status', v_split.status, 'currency', v_split.currency,
      'vat', v_split.vat, 'serviceCharge', v_split.service_charge,
      'discount', v_split.discount, 'receiptTotal', v_split.receipt_total,
      'hostDisplayName', v_split.host_display_name, 'hostBkash', v_split.host_bkash, 'hostNagad', v_split.host_nagad,
      'paymentHandles', coalesce((select jsonb_agg(jsonb_build_object('label', h.label, 'handle', h.handle) order by h.sort_order)
        from payment_handles h where h.profile_id = v_split.host_user_id), '[]'::jsonb)
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'quantity', i.quantity, 'unitPrice', i.unit_price) order by i.sort_order)
      from items i where i.split_id = v_split.id), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'guestId', c.guest_id, 'quantity', c.quantity, 'allocationType', c.allocation_type, 'participantIds', c.participant_ids))
      from claims c join items i on i.id = c.item_id where i.split_id = v_split.id), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', g.id, 'displayName', g.display_name, 'status', g.status,
        'paymentStatus', coalesce(pay.status::text, 'UNPAID')))
      from guests g left join payments pay on pay.guest_id = g.id
      where g.split_id = v_split.id), '[]'::jsonb),
    'myGuestId', v_guest_id,
    'myPaymentStatus', coalesce((select pay.status::text from payments pay where pay.guest_id = v_guest_id), 'UNPAID')
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_public_split(uuid, uuid) from public;
grant execute on function public.get_public_split(uuid, uuid) to anon, authenticated;

-- 4. Realtime ------------------------------------------------------------
-- Both screens poll every five seconds. Publishing these tables lets the host's
-- tracking screen and every guest's page update the moment a claim lands.
-- Guests still read through the RPC; this only carries change notifications.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.claims;
    alter publication supabase_realtime add table public.guests;
    alter publication supabase_realtime add table public.payments;
  end if;
exception when duplicate_object then null;
end $$;
