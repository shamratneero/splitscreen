import { calculateSplit } from '@splitsave/split-engine';
import { requireHostId, supabase } from './supabase';

export type SplitSummary = {
  id: string;
  restaurantName: string;
  splitDate: string;
  status: string;
  receiptTotal: number;
  /** How much the host has actually been paid so far. */
  collected: number;
  /** What every guest owes in total — never more than receiptTotal. */
  owed: number;
  guestCount: number;
  paidCount: number;
  settled: boolean;
};

type Row = {
  id: string;
  restaurant_name: string;
  split_date: string;
  status: string;
  vat: number;
  service_charge: number;
  discount: number;
  receipt_total: number;
  items: { id: string; name: string; quantity: number; unit_price: number }[] | null;
  guests: {
    id: string;
    display_name: string | null;
    claims: { id: string; item_id: string; quantity: number; allocation_type: 'INDIVIDUAL' | 'SHARED'; participant_ids: string[] }[] | null;
    payments: { status: string }[] | { status: string } | null;
  }[] | null;
};

type PaymentEmbed = { status: string }[] | { status: string } | null;

/** PostgREST embeds a unique-constrained relation as an object, array, or null. */
const statusOf = (payments: PaymentEmbed): string => {
  if (!payments) return 'UNPAID';
  const row = Array.isArray(payments) ? payments[0] : payments;
  return row?.status ?? 'UNPAID';
};

/**
 * Every split this host has created, newest first, with enough detail to show
 * what is still outstanding without opening each one.
 */
export async function fetchSplitHistory(): Promise<SplitSummary[]> {
  await requireHostId();

  const { data, error } = await supabase
    .from('splits')
    .select(
      `id, restaurant_name, split_date, status, vat, service_charge, discount, receipt_total,
       items(id, name, quantity, unit_price),
       guests(id, display_name,
         claims(id, item_id, quantity, allocation_type, participant_ids),
         payments(status))`,
    )
    .order('created_at', { ascending: false })
    .returns<Row[]>();

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const items = (row.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    }));
    const guestRows = (row.guests ?? []).filter((guest) => (guest.claims ?? []).length > 0);
    const claims = guestRows.flatMap((guest) =>
      (guest.claims ?? []).map((claim) => ({
        id: claim.id,
        itemId: claim.item_id,
        guestId: guest.id,
        quantity: claim.quantity,
        allocationType: claim.allocation_type,
        participantIds: claim.participant_ids,
      })),
    );

    let fullyAllocated = false;
    let totalsById = new Map<string, number>();
    try {
      const result = calculateSplit({
        items,
        claims,
        guests: guestRows.map((guest) => ({ id: guest.id, displayName: guest.display_name ?? '' })),
        vat: row.vat,
        serviceCharge: row.service_charge,
        discount: row.discount,
        receiptTotal: row.receipt_total,
      });
      fullyAllocated = result.reconciled && result.unclaimedItems.length === 0
        && Object.values(result.unallocatedCharges).every(amount => amount === 0);
      totalsById = new Map(result.guests.map((guest) => [guest.id, guest.total]));
    } catch {
      // A malformed historical split shouldn't break the whole list.
      totalsById = new Map();
    }

    const paid = guestRows.filter((guest) => statusOf(guest.payments) === 'CONFIRMED');
    const collected = paid.reduce((sum, guest) => sum + (totalsById.get(guest.id) ?? 0), 0);
    const owed = guestRows.reduce((sum, guest) => sum + (totalsById.get(guest.id) ?? 0), 0);

    return {
      id: row.id,
      restaurantName: row.restaurant_name || 'Untitled split',
      splitDate: row.split_date,
      status: row.status,
      receiptTotal: row.receipt_total,
      collected,
      owed,
      guestCount: guestRows.length,
      paidCount: paid.length,
      settled: fullyAllocated && guestRows.length > 0 && paid.length === guestRows.length,
    };
  });
}

/** Total still outstanding across every open split — the home screen headline. */
export function outstandingTotal(splits: SplitSummary[]): number {
  return splits.reduce((sum, split) => sum + Math.max(0, split.owed - split.collected), 0);
}
