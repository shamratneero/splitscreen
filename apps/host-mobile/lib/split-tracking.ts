import { calculateSplit, type SplitClaim } from '@splitsave/split-engine';
import { requireHostId, supabase } from './supabase';

export type TrackedGuest = {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'CONFIRMED';
  itemCount: number;
  total: number;
  paymentStatus: 'UNPAID' | 'GUEST_REPORTED' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
  /** Provider transaction id if this was recorded from a pasted message. */
  paymentReference: string | null;
};

export type TrackedItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  claimedQuantity: number;
  claimedBy: string[];
};

export type SplitTracking = {
  id: string;
  restaurantName: string;
  splitDate: string;
  status: string;
  currency: string;
  publicToken: string;
  guests: TrackedGuest[];
  items: TrackedItem[];
  unclaimed: { name: string; quantity: number; value: number }[];
  confirmedCount: number;
  reconciled: boolean;
  calculatedTotal: number;
  receiptTotal: number;
};

type Row = {
  id: string;
  restaurant_name: string;
  split_date: string;
  status: string;
  currency: string;
  public_token: string;
  vat: number;
  service_charge: number;
  discount: number;
  receipt_total: number;
  items: { id: string; name: string; quantity: number; unit_price: number; sort_order: number }[];
  guests: {
    id: string;
    display_name: string | null;
    status: 'ACTIVE' | 'CONFIRMED';
    claims: { id: string; item_id: string; quantity: number; allocation_type: 'INDIVIDUAL' | 'SHARED'; participant_ids: string[] }[] | null;
    // payments.guest_id is unique, so PostgREST may embed this as an object,
    // an array, or null depending on how it resolves the relationship.
    payments: { status: TrackedGuest['paymentStatus']; method?: string | null }[] | { status: TrackedGuest['paymentStatus']; method?: string | null } | null;
  }[];
};

function paymentStatusOf(payments: Row['guests'][number]['payments']): TrackedGuest['paymentStatus'] {
  if (!payments) return 'UNPAID';
  const row = Array.isArray(payments) ? payments[0] : payments;
  return row?.status ?? 'UNPAID';
}

/** The transaction id a pasted confirmation was recorded under, if any. */
function paymentReferenceOf(payments: Row['guests'][number]['payments']): string | null {
  if (!payments) return null;
  const row = Array.isArray(payments) ? payments[0] : payments;
  const method = row?.method ?? '';
  return method.startsWith('ref:') ? method.slice(4) : null;
}

/** Reads one of the host's splits with everything needed to track it live. */
export async function fetchSplitTracking(splitId: string): Promise<SplitTracking> {
  await requireHostId();

  const { data, error } = await supabase
    .from('splits')
    .select(
      `id, restaurant_name, split_date, status, currency, public_token, vat, service_charge, discount, receipt_total,
       items(id, name, quantity, unit_price, sort_order),
       guests(id, display_name, status,
         claims(id, item_id, quantity, allocation_type, participant_ids),
         payments(status, method))`,
    )
    .eq('id', splitId)
    .single<Row>();

  if (error) throw new Error(error.message);

  const items = [...(data.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const claims: SplitClaim[] = data.guests.flatMap((guest) =>
    (guest.claims ?? []).map((claim) => ({
      id: claim.id,
      itemId: claim.item_id,
      guestId: guest.id,
      quantity: claim.quantity,
      allocationType: claim.allocation_type,
      participantIds: claim.participant_ids,
    })),
  );

  // The same engine the guests see, so host and guest totals can never disagree.
  const result = calculateSplit({
    items: items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, unitPrice: item.unit_price })),
    claims,
    guests: (data.guests ?? []).map((guest) => ({ id: guest.id, displayName: guest.display_name ?? '' })),
    vat: data.vat,
    serviceCharge: data.service_charge,
    discount: data.discount,
    receiptTotal: data.receipt_total,
  });

  const totalsById = new Map(result.guests.map((guest) => [guest.id, guest.total]));

  const guests: TrackedGuest[] = (data.guests ?? [])
    // A session that opened the link and claimed nothing isn't a participant.
    .filter((guest) => (guest.claims ?? []).length > 0 || guest.status === 'CONFIRMED')
    .map((guest) => ({
      id: guest.id,
      displayName: guest.display_name?.trim() || 'Not confirmed',
      status: guest.status,
      itemCount: (guest.claims ?? []).reduce((sum, claim) => sum + claim.quantity, 0),
      total: totalsById.get(guest.id) ?? 0,
      paymentStatus: paymentStatusOf(guest.payments),
      paymentReference: paymentReferenceOf(guest.payments),
    }))
    .sort((a, b) => b.total - a.total);

  const claimedByItem = new Map<string, number>();
  const namesByItem = new Map<string, string[]>();
  for (const guest of data.guests ?? []) {
    for (const claim of guest.claims ?? []) {
      claimedByItem.set(claim.item_id, (claimedByItem.get(claim.item_id) ?? 0) + claim.quantity);
      const names = namesByItem.get(claim.item_id) ?? [];
      names.push(guest.display_name?.trim() || 'Guest');
      namesByItem.set(claim.item_id, names);
    }
  }

  return {
    id: data.id,
    restaurantName: data.restaurant_name,
    splitDate: data.split_date,
    status: data.status,
    currency: data.currency ?? 'BDT',
    publicToken: data.public_token,
    guests,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      claimedQuantity: claimedByItem.get(item.id) ?? 0,
      claimedBy: namesByItem.get(item.id) ?? [],
    })),
    unclaimed: result.unclaimedItems.map((entry) => ({ name: entry.name, quantity: entry.quantity, value: entry.value })),
    confirmedCount: (data.guests ?? []).filter((guest) => guest.status === 'CONFIRMED').length,
    reconciled: result.reconciled,
    calculatedTotal: result.calculatedTotal,
    receiptTotal: result.receiptTotal,
  };
}

/** Host confirms they actually received this guest's money. */
export async function confirmPayment(guestId: string, amount: number): Promise<void> {
  await requireHostId();
  const { error } = await supabase
    .from('payments')
    .upsert(
      { guest_id: guestId, amount, status: 'CONFIRMED', confirmed_at: new Date().toISOString() },
      { onConflict: 'guest_id' },
    );
  if (error) throw new Error(error.message);
}

/**
 * Calls `onChange` whenever a guest claims, names themselves, or pays.
 *
 * The host is watching a table fill up in real time, so a five-second lag is
 * visible. Returns an unsubscribe function; the caller keeps a slow poll as a
 * fallback because a dropped socket is silent.
 */
export function subscribeToSplit(splitId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`host:${splitId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `split_id=eq.${splitId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/**
 * Records several confirmed payments in one go.
 *
 * The provider's transaction reference is stored on the payment row so a host
 * who pastes the same messages again is told they were already recorded rather
 * than crediting anyone twice.
 */
export async function confirmPayments(
  entries: { guestId: string; amount: number; reference: string | null }[],
): Promise<void> {
  if (entries.length === 0) return;
  await requireHostId();
  const now = new Date().toISOString();
  const { error } = await supabase.from('payments').upsert(
    entries.map(entry => ({
      guest_id: entry.guestId,
      amount: entry.amount,
      status: 'CONFIRMED',
      confirmed_at: now,
      method: entry.reference ? `ref:${entry.reference}` : null,
    })),
    { onConflict: 'guest_id' },
  );
  if (error) throw new Error(error.message);
}

/** Transaction references already recorded against this split. */
export function recordedReferences(tracking: SplitTracking): string[] {
  return tracking.guests
    .map(guest => guest.paymentReference)
    .filter((reference): reference is string => Boolean(reference));
}

/**
 * Removes a split and everything under it.
 *
 * Items, guests, claims and payments all cascade from the split row, and RLS
 * already restricts deletion to the host who owns it, so this is a single
 * delete rather than a cleanup sequence. Guest links stop resolving
 * immediately, which is the point — a mistyped bill should not stay shareable.
 */
export async function deleteSplit(splitId: string): Promise<void> {
  await requireHostId();
  const { error } = await supabase.from('splits').delete().eq('id', splitId);
  if (error) throw new Error(error.message);
}
