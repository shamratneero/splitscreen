import type { SplitClaim, SplitGuest, SplitItem } from "@addasplit/split-engine";
import { supabase } from "./supabase";

/** The exact shape returned by the public.get_public_split RPC. */
export type PublicSplit = {
  split: {
    id: string;
    restaurantName: string;
    splitDate: string;
    status: string;
    vat: number;
    serviceCharge: number;
    discount: number;
    receiptTotal: number;
    hostDisplayName: string | null;
    hostBkash: string | null;
    hostNagad: string | null;
  };
  items: SplitItem[];
  claims: SplitClaim[];
  guests: (SplitGuest & { status: string; paymentStatus: PaymentStatus })[];
  myGuestId: string | null;
  myPaymentStatus: PaymentStatus;
};

export type PaymentStatus = "UNPAID" | "GUEST_REPORTED" | "CONFIRMED" | "FAILED" | "REFUNDED";

/**
 * Reads a split by its public token. `sessionId` is optional — pass it to have
 * the payload identify which guest row belongs to this browser.
 */
export async function fetchPublicSplit(token: string, sessionId?: string | null): Promise<PublicSplit | null> {
  // Public tokens are UUIDs; malformed links should show the inactive-link UI.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc("get_public_split", {
    p_token: token,
    p_session_id: sessionId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as PublicSplit | null) ?? null;
}

/** Idempotently sets this guest's claim on one item to `quantity` (0 removes it). */
export async function setClaim(token: string, sessionId: string, itemId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc("set_claim", {
    p_token: token,
    p_session_id: sessionId,
    p_item_id: itemId,
    p_quantity: quantity,
  });
  if (error) throw new Error(error.message);
}

export async function confirmGuestDetails(token: string, sessionId: string, displayName: string): Promise<void> {
  const { error } = await supabase.rpc("confirm_guest_details", {
    p_token: token,
    p_session_id: sessionId,
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
}

export async function reportGuestPayment(token: string, sessionId: string, method: string): Promise<void> {
  const { error } = await supabase.rpc("report_guest_payment", {
    p_token: token,
    p_session_id: sessionId,
    p_method: method,
  });
  if (error) throw new Error(error.message);
}
