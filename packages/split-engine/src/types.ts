export type Taka = number;

export interface SplitItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: Taka;
}

export interface SplitGuest {
  id: string;
  displayName: string;
}

/** A shared claim owns `quantity` physical units; participants split their value explicitly. */
export interface SplitClaim {
  id: string;
  itemId: string;
  guestId: string;
  quantity: number;
  allocationType: "INDIVIDUAL" | "SHARED";
  participantIds?: string[];
}

export interface CalculateSplitInput {
  items: SplitItem[];
  claims: SplitClaim[];
  guests: SplitGuest[];
  vat: Taka;
  serviceCharge: Taka;
  discount: Taka;
  receiptTotal: Taka;
}

export interface GuestAllocation extends SplitGuest {
  itemSubtotal: Taka;
  vat: Taka;
  serviceCharge: Taka;
  discount: Taka;
  total: Taka;
}

export interface UnclaimedItem {
  itemId: string;
  name: string;
  quantity: number;
  value: Taka;
}

export interface SplitCalculation {
  guests: GuestAllocation[];
  unclaimedItems: UnclaimedItem[];
  allocatedCharges: { vat: Taka; serviceCharge: Taka; discount: Taka };
  /** Charges reserved for unclaimed items, or unallocatable on a zero subtotal. */
  unallocatedCharges: { vat: Taka; serviceCharge: Taka; discount: Taka };
  roundingAdjustments: Record<string, Taka>;
  calculatedTotal: Taka;
  receiptTotal: Taka;
  reconciled: boolean;
}
