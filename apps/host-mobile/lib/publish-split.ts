import { ensureHostSession, supabase } from './supabase';
import type { Draft } from '../state/draft';

const toInt = (value: string) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

/**
 * Turns the in-memory draft into a real split the guest link can serve.
 * Returns the split id (for tracking) and the public token (for the QR).
 *
 * Writes go through normal RLS as the signed-in host — splits and items are
 * both covered by the "host owns …" policies.
 */
export async function publishSplit(draft: Draft): Promise<{ id: string; publicToken: string }> {
  const hostUserId = await ensureHostSession();

  const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const vat = toInt(draft.vat);
  const serviceCharge = toInt(draft.service);
  const discount = toInt(draft.discount);
  const receiptTotal = toInt(draft.receiptTotal);

  const { data: split, error: splitError } = await supabase
    .from('splits')
    .insert({
      host_user_id: hostUserId,
      restaurant_name: draft.restaurant.trim(),
      // READY_TO_SHARE is the gate set_claim checks before accepting guests.
      status: 'READY_TO_SHARE',
      subtotal,
      vat,
      service_charge: serviceCharge,
      discount,
      receipt_total: receiptTotal,
      calculated_total: subtotal + vat + serviceCharge - discount,
    })
    .select('id, public_token')
    .single();

  if (splitError) throw new Error(splitError.message);

  const rows = draft.items.map((item, index) => ({
    split_id: split.id,
    name: item.name.trim(),
    quantity: item.quantity,
    unit_price: item.price,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase.from('items').insert(rows);
  if (itemsError) {
    // Don't leave an empty bill behind a live link.
    await supabase.from('splits').delete().eq('id', split.id);
    throw new Error(itemsError.message);
  }

  return { id: split.id as string, publicToken: split.public_token as string };
}
