-- Guests had no way to learn that the host confirmed their payment: the public
-- payload carried guests and claims but never payments, so "waiting for host
-- confirmation" was a permanent state no matter what the host did.
--
-- Expose payment status through the same security-definer read path. Guests
-- still get no table grants; they see their own status plus a coarse per-guest
-- status for the shared view, and never amounts or phone numbers.

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
    -- paymentStatus lets everyone see who has settled up, which is the whole
    -- point of gathering round one bill.
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
