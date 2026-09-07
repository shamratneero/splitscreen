-- Public guest access: security-definer RPCs for reading and mutating a split
-- via its public_token + an anonymous per-browser session_id. Guests never
-- receive direct table grants; every read and write is scoped through these
-- functions so RLS on the base tables stays host-only.

-- Confirmed-received amounts are host-entered (see report_guest_payment /
-- host tracking); "amount due" is always computed live by the shared
-- @addasplit/split-engine over real items+claims, never duplicated in SQL.
alter table public.payments alter column amount drop not null;
alter table public.payments drop constraint payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount is null or amount >= 0);

-- Idempotent "set my claim on this item to N" — replaces additive claim_item
-- for the guest stepper UI, where repeated taps must not create duplicate rows.
create or replace function public.set_claim(p_token uuid, p_session_id uuid, p_item_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid; v_current integer; v_available integer;
begin
  if p_quantity < 0 then raise exception 'quantity must not be negative'; end if;
  select id into v_split_id from splits where public_token = p_token and status in ('READY_TO_SHARE','CLAIMING','ALL_ITEMS_ASSIGNED');
  if v_split_id is null then raise exception 'split is unavailable'; end if;

  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then
    if p_quantity = 0 then return; end if;
    insert into guests(split_id, session_id) values(v_split_id, p_session_id) returning id into v_guest_id;
    insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'GUEST_JOINED', '{}');
  end if;

  perform 1 from items where id = p_item_id and split_id = v_split_id for update;
  if not found then raise exception 'item not found'; end if;

  select quantity into v_current from claims where guest_id = v_guest_id and item_id = p_item_id;
  select i.quantity - coalesce(sum(c.quantity), 0) + coalesce(v_current, 0) into v_available
    from items i left join claims c on c.item_id = i.id where i.id = p_item_id group by i.quantity;
  if v_available < p_quantity then raise exception 'Someone else just claimed that — try a smaller amount'; end if;

  if p_quantity = 0 then
    delete from claims where guest_id = v_guest_id and item_id = p_item_id;
  elsif v_current is null then
    insert into claims(guest_id, item_id, quantity, allocation_type, participant_ids) values(v_guest_id, p_item_id, p_quantity, 'INDIVIDUAL', array[v_guest_id]);
  else
    update claims set quantity = p_quantity where guest_id = v_guest_id and item_id = p_item_id;
  end if;

  insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'ITEM_CLAIMED', jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity));
  update splits set status = 'CLAIMING' where id = v_split_id and status = 'READY_TO_SHARE';
end; $$;
revoke all on function public.set_claim(uuid, uuid, uuid, integer) from public;
grant execute on function public.set_claim(uuid, uuid, uuid, integer) to anon, authenticated;

-- Guest confirms their display name; locks their claim set for this round.
create or replace function public.confirm_guest_details(p_token uuid, p_session_id uuid, p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid;
begin
  select id into v_split_id from splits where public_token = p_token;
  if v_split_id is null then raise exception 'split is unavailable'; end if;
  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then raise exception 'claim something before confirming'; end if;
  update guests set display_name = p_display_name, status = 'CONFIRMED', confirmed_at = now() where id = v_guest_id;
  insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'GUEST_CONFIRMED', jsonb_build_object('display_name', p_display_name));
end; $$;
revoke all on function public.confirm_guest_details(uuid, uuid, text) from public;
grant execute on function public.confirm_guest_details(uuid, uuid, text) to anon, authenticated;

-- Guest reports they sent the money; amount is filled in later by the host.
create or replace function public.report_guest_payment(p_token uuid, p_session_id uuid, p_method text)
returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid;
begin
  select id into v_split_id from splits where public_token = p_token;
  if v_split_id is null then raise exception 'split is unavailable'; end if;
  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then raise exception 'claim something before paying'; end if;
  insert into payments(guest_id, amount, method, status, guest_reported_at) values(v_guest_id, null, p_method, 'GUEST_REPORTED', now())
    on conflict (guest_id) do update set method = excluded.method, status = 'GUEST_REPORTED', guest_reported_at = now();
  insert into split_events(split_id, guest_id, event_type, payload) values(v_split_id, v_guest_id, 'PAYMENT_REPORTED', jsonb_build_object('method', p_method));
end; $$;
revoke all on function public.report_guest_payment(uuid, uuid, text) from public;
grant execute on function public.report_guest_payment(uuid, uuid, text) to anon, authenticated;

-- The only public read path: one JSON payload, no table grants to anon.
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
      'status', v_split.status, 'vat', v_split.vat, 'serviceCharge', v_split.service_charge,
      'discount', v_split.discount, 'receiptTotal', v_split.receipt_total,
      'hostDisplayName', v_split.host_display_name, 'hostBkash', v_split.host_bkash, 'hostNagad', v_split.host_nagad
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'quantity', i.quantity, 'unitPrice', i.unit_price) order by i.sort_order)
      from items i where i.split_id = v_split.id), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'guestId', c.guest_id, 'quantity', c.quantity, 'allocationType', c.allocation_type, 'participantIds', c.participant_ids))
      from claims c join items i on i.id = c.item_id where i.split_id = v_split.id), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'displayName', g.display_name, 'status', g.status))
      from guests g where g.split_id = v_split.id), '[]'::jsonb),
    'myGuestId', v_guest_id
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_public_split(uuid, uuid) from public;
grant execute on function public.get_public_split(uuid, uuid) to anon, authenticated;
