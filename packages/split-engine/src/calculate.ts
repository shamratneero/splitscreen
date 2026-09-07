import type {
  CalculateSplitInput,
  GuestAllocation,
  SplitCalculation,
  SplitClaim,
  Taka,
} from "./types";

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

/** Allocates an integer amount proportionally, retaining every remainder deterministically. */
function prorate(amount: Taka, weights: Taka[]): Taka[] {
  if (amount === 0) return weights.map(() => 0);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight === 0) return weights.map(() => 0);
  const raw = weights.map((weight, index) => ({
    index,
    base: Math.floor((amount * weight) / totalWeight),
    remainder: (amount * weight) % totalWeight,
  }));
  let remaining = amount - raw.reduce((sum, entry) => sum + entry.base, 0);
  raw.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) raw[index]!.base += 1;
  return raw.sort((a, b) => a.index - b.index).map((entry) => entry.base);
}

function claimParticipants(claim: SplitClaim): string[] {
  if (claim.allocationType === "INDIVIDUAL") return [claim.guestId];
  const participants = claim.participantIds ?? [];
  if (participants.length === 0) throw new Error("Shared claims need fixed participants");
  if (!participants.includes(claim.guestId)) throw new Error("Shared claim owner must be a participant");
  return [...new Set(participants)];
}

export function calculateSplit(input: CalculateSplitInput): SplitCalculation {
  const { items, claims, guests, vat, serviceCharge, discount, receiptTotal } = input;
  [vat, serviceCharge, discount, receiptTotal].forEach((value, index) =>
    assertInteger(value, ["vat", "serviceCharge", "discount", "receiptTotal"][index]!),
  );
  if (new Set(guests.map((guest) => guest.id)).size !== guests.length) throw new Error("Guest IDs must be unique");
  const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
  const claimedByItem = new Map<string, number>();
  const subtotals = new Map(guests.map((guest) => [guest.id, 0]));

  for (const item of items) {
    assertInteger(item.quantity, `${item.name} quantity`);
    assertInteger(item.unitPrice, `${item.name} unitPrice`);
  }
  for (const claim of claims) {
    assertInteger(claim.quantity, "Claim quantity");
    const item = items.find((entry) => entry.id === claim.itemId);
    if (!item) throw new Error(`Claim refers to unknown item ${claim.itemId}`);
    const participants = claimParticipants(claim);
    participants.forEach((id) => {
      if (!guestsById.has(id)) throw new Error(`Claim refers to unknown guest ${id}`);
    });
    claimedByItem.set(item.id, (claimedByItem.get(item.id) ?? 0) + claim.quantity);
    const shares = prorate(item.unitPrice * claim.quantity, participants.map(() => 1));
    participants.forEach((id, index) => subtotals.set(id, (subtotals.get(id) ?? 0) + shares[index]!));
  }

  for (const item of items) {
    if ((claimedByItem.get(item.id) ?? 0) > item.quantity) throw new Error(`${item.name} is over-claimed`);
  }

  const itemTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const calculatedTotal = itemTotal + vat + serviceCharge - discount;
  const weights = guests.map((guest) => subtotals.get(guest.id) ?? 0);
  // Keep the unclaimed subtotal in the denominator. Its charges must not be
  // paid by the guests who happen to arrive first.
  const unclaimedSubtotal = itemTotal - weights.reduce((sum, value) => sum + value, 0);
  const chargeWeights = [...weights, unclaimedSubtotal];
  const vatAllocations = prorate(vat, chargeWeights);
  const serviceAllocations = prorate(serviceCharge, chargeWeights);
  const discountAllocations = prorate(discount, chargeWeights);
  const allocatedCharges = {
    vat: vatAllocations.slice(0, guests.length).reduce((sum, value) => sum + value, 0),
    serviceCharge: serviceAllocations.slice(0, guests.length).reduce((sum, value) => sum + value, 0),
    discount: discountAllocations.slice(0, guests.length).reduce((sum, value) => sum + value, 0),
  };
  const allocations: GuestAllocation[] = guests.map((guest, index) => ({
    ...guest,
    itemSubtotal: weights[index]!,
    vat: vatAllocations[index]!,
    serviceCharge: serviceAllocations[index]!,
    discount: discountAllocations[index]!,
    total: weights[index]! + vatAllocations[index]! + serviceAllocations[index]! - discountAllocations[index]!,
  }));
  const unclaimedItems = items.flatMap((item) => {
    const quantity = item.quantity - (claimedByItem.get(item.id) ?? 0);
    return quantity > 0 ? [{ itemId: item.id, name: item.name, quantity, value: quantity * item.unitPrice }] : [];
  });
  const roundingAdjustments = Object.fromEntries(
    allocations.map((guest) => [guest.id, guest.total - (guest.itemSubtotal + guest.vat + guest.serviceCharge - guest.discount)]),
  );

  return {
    guests: allocations,
    unclaimedItems,
    allocatedCharges,
    unallocatedCharges: {
      vat: vat - allocatedCharges.vat,
      serviceCharge: serviceCharge - allocatedCharges.serviceCharge,
      discount: discount - allocatedCharges.discount,
    },
    roundingAdjustments,
    calculatedTotal,
    receiptTotal,
    reconciled: calculatedTotal === receiptTotal,
  };
}
