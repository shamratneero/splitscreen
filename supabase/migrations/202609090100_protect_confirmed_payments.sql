-- A guest could undo a payment the host had already confirmed.
--
-- report_guest_payment upserts unconditionally, so a guest who navigated back
-- from the "all settled" screen and tapped "I've sent it" again reset their
-- status from CONFIRMED to GUEST_REPORTED. Worse, it overwrote `method`, which
-- now carries the provider transaction reference recorded during
-- reconciliation — so the host lost both the settlement and its audit trail,
-- and the guest reappeared as unpaid.
--
-- Confirmation belongs to the host: only they can say money arrived, and only
-- they can take that back. A guest reporting again on a settled payment is a
-- no-op rather than an error, because from their side nothing is wrong.

create or replace function public.report_guest_payment(p_token uuid, p_session_id uuid, p_method text)
returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid;
begin
  select id into v_split_id from splits where public_token = p_token;
  if v_split_id is null then raise exception 'split is unavailable'; end if;
  select id into v_guest_id from guests where split_id = v_split_id and session_id = p_session_id;
  if v_guest_id is null then raise exception 'claim something before paying'; end if;

  insert into payments(guest_id, amount, method, status, guest_reported_at)
    values(v_guest_id, null, p_method, 'GUEST_REPORTED', now())
  on conflict (guest_id) do update
    set method = excluded.method,
        status = 'GUEST_REPORTED',
        guest_reported_at = now()
    -- Leave a host-confirmed payment exactly as it stands.
    where payments.status <> 'CONFIRMED';

  insert into split_events(split_id, guest_id, event_type, payload)
    values(v_split_id, v_guest_id, 'PAYMENT_REPORTED', jsonb_build_object('method', p_method));
end; $$;
revoke all on function public.report_guest_payment(uuid, uuid, text) from public;
grant execute on function public.report_guest_payment(uuid, uuid, text) to anon, authenticated;

-- Same reasoning for claims: a guest who has settled should not be able to
-- change what they are settled for. Their share is fixed once the host has
-- confirmed the money, otherwise the amount the host verified stops matching
-- the items behind it.
create or replace function public.set_claim(p_token uuid, p_session_id uuid, p_item_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_split_id uuid; v_guest_id uuid; v_current integer; v_available integer; v_settled boolean;
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

  select exists(select 1 from payments where guest_id = v_guest_id and status = 'CONFIRMED') into v_settled;
  if v_settled then raise exception 'Your payment is already settled — ask the host to reopen it.'; end if;

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
