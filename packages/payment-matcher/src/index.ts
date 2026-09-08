/**
 * Matching incoming mobile-money confirmations to the guests who owe them.
 *
 * There is no bKash or Nagad API that pushes a third party your incoming
 * payments, and a browser cannot read SMS, so the text has to arrive by being
 * pasted. Everything here works on whatever the host pastes — one message or
 * twenty, bKash or Nagad, English or Bengali digits.
 *
 * The rule throughout is that a wrong automatic match costs more than no match:
 * an unmatched payment is a small annoyance, but telling a host that Karim paid
 * when it was Rahim's money loses someone real taka. So ambiguity is surfaced
 * rather than guessed, and only an unambiguous exact amount is ever applied on
 * its own.
 */

export type ExpectedPayment = {
  guestId: string;
  displayName: string;
  /** What this guest owes, in the currency's smallest unit. */
  amount: number;
  /** Already-confirmed guests are excluded from matching. */
  settled: boolean;
};

export type ParsedTransfer = {
  /** Amount received, in the currency's smallest unit. */
  amount: number;
  /** Sender's number if the message named one. */
  sender: string | null;
  /** Provider's transaction id, used to ignore a message pasted twice. */
  reference: string | null;
  /** The line this came from, so a host can see what was read. */
  source: string;
};

export type Match = {
  transfer: ParsedTransfer;
  guestId: string;
  displayName: string;
  /** `exact` is safe to apply; `short` and `over` need the host to look. */
  kind: 'exact' | 'short' | 'over';
  /** received − owed. Negative means they underpaid. */
  difference: number;
};

export type Ambiguity = {
  transfer: ParsedTransfer;
  /** Everyone this amount would fit equally well. */
  candidates: { guestId: string; displayName: string }[];
};

export type Reconciliation = {
  /** Safe to apply without asking. */
  matched: Match[];
  /** Fits more than one guest; the host must choose. */
  ambiguous: Ambiguity[];
  /** Nothing plausible to attach it to. */
  unmatched: ParsedTransfer[];
  /** Messages already seen, by transaction reference. */
  duplicates: ParsedTransfer[];
  /** Guests still owing after everything above is applied. */
  outstanding: ExpectedPayment[];
};

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';
const toWesternDigits = (value: string) =>
  value.replace(/[০-৯]/g, digit => String(BENGALI_DIGITS.indexOf(digit)));

/**
 * Pulls the amount out of a confirmation line.
 *
 * Providers write money several ways — "Tk 366.00", "৳366", "Amount: 1,234.50"
 * — and every message also carries a balance and often a fee, which are the
 * wrong numbers. Anchor on a currency marker or an explicit amount label so a
 * bare number elsewhere in the line is never mistaken for the payment.
 */
function readAmount(line: string, minorUnits: number): number | null {
  const patterns = [
    /(?:received|amount|received\s+amount)\s*:?\s*(?:tk\.?|৳|bdt)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:tk\.?|৳|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const found = line.match(pattern);
    if (!found) continue;
    const raw = found[1]!.replace(/,/g, '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) continue;
    const scaled = Math.round(Number(raw) * 10 ** minorUnits);
    if (Number.isSafeInteger(scaled) && scaled > 0) return scaled;
  }
  return null;
}

/** Bangladeshi mobile numbers, however the message writes them. */
function readSender(line: string): string | null {
  const found = line.match(/\b(?:\+?88)?(01[3-9]\d{8})\b/);
  return found ? found[1]! : null;
}

/** Provider transaction id — the only reliable way to spot a duplicate paste. */
function readReference(line: string): string | null {
  const labelled = line.match(/\b(?:trx\s*id|txn\s*id|transaction\s*id|trxid|txnid|ref(?:erence)?)\s*[:.]?\s*([A-Z0-9]{4,24})\b/i);
  return labelled ? labelled[1]!.toUpperCase() : null;
}

/**
 * Reads every confirmation in a blob of pasted text.
 *
 * A "line" is any run of text that carries an amount; hosts paste messages
 * separated by blank lines, by newlines, or run together after forwarding, so
 * splitting on sentence-ish boundaries recovers more than splitting on \n alone.
 */
export function parseTransfers(text: string, minorUnits = 0): ParsedTransfer[] {
  const normalized = toWesternDigits(text);
  const chunks = normalized
    .split(/\n{2,}|(?<=\d)\s*\n(?=[A-Z])|\n/)
    .map(chunk => chunk.trim())
    .filter(Boolean);

  const transfers: ParsedTransfer[] = [];
  for (const chunk of chunks) {
    const amount = readAmount(chunk, minorUnits);
    if (amount === null) continue;
    transfers.push({
      amount,
      sender: readSender(chunk),
      reference: readReference(chunk),
      source: chunk.length > 160 ? `${chunk.slice(0, 157)}…` : chunk,
    });
  }
  return transfers;
}

/**
 * Pairs parsed transfers with the guests who owe money.
 *
 * `alreadySeen` holds references applied previously, so re-pasting the same
 * messages after a partial run does not double-credit anyone.
 *
 * `tolerance` allows for the sender's transfer fee, which some providers deduct
 * so the host receives slightly less than the guest sent. It is deliberately
 * small and never enough to bridge two different guests' amounts.
 */
export function reconcile(
  transfers: ParsedTransfer[],
  expected: ExpectedPayment[],
  options: { alreadySeen?: string[]; tolerance?: number } = {},
): Reconciliation {
  const seen = new Set((options.alreadySeen ?? []).map(reference => reference.toUpperCase()));
  const tolerance = options.tolerance ?? 0;

  const owing = expected.filter(entry => !entry.settled && entry.amount > 0);
  const claimed = new Set<string>();

  const matched: Match[] = [];
  const ambiguous: Ambiguity[] = [];
  const unmatched: ParsedTransfer[] = [];
  const duplicates: ParsedTransfer[] = [];

  // Exact amounts first: resolving those shrinks the pool, which can turn a
  // would-be ambiguity into a single remaining candidate.
  const byConfidence = [...transfers].sort((a, b) => {
    const exact = (transfer: ParsedTransfer) => owing.some(entry => entry.amount === transfer.amount);
    return Number(exact(b)) - Number(exact(a));
  });

  for (const transfer of byConfidence) {
    if (transfer.reference && seen.has(transfer.reference)) {
      duplicates.push(transfer);
      continue;
    }

    const available = owing.filter(entry => !claimed.has(entry.guestId));
    const exact = available.filter(entry => Math.abs(entry.amount - transfer.amount) <= tolerance);

    if (exact.length === 1) {
      const guest = exact[0]!;
      claimed.add(guest.guestId);
      if (transfer.reference) seen.add(transfer.reference);
      const difference = transfer.amount - guest.amount;
      matched.push({
        transfer,
        guestId: guest.guestId,
        displayName: guest.displayName,
        // Within tolerance but not equal: the host should still see that the
        // amount differed, usually because a transfer fee was deducted.
        kind: difference === 0 ? 'exact' : difference < 0 ? 'short' : 'over',
        difference,
      });
      continue;
    }

    if (exact.length > 1) {
      // Two guests owing the same amount is common — everyone shared a thali.
      // Guessing here would credit the wrong person, so ask.
      ambiguous.push({
        transfer,
        candidates: exact.map(entry => ({ guestId: entry.guestId, displayName: entry.displayName })),
      });
      continue;
    }

    unmatched.push(transfer);
  }

  return {
    matched,
    ambiguous,
    unmatched,
    duplicates,
    outstanding: owing.filter(entry => !claimed.has(entry.guestId)),
  };
}

/**
 * The nearest guests to an amount that matched nobody, so the host can attach
 * it by hand instead of hunting. Ordered by how far off each is.
 */
export function suggestFor(
  transfer: ParsedTransfer,
  expected: ExpectedPayment[],
  limit = 3,
): { guestId: string; displayName: string; difference: number }[] {
  return expected
    .filter(entry => !entry.settled && entry.amount > 0)
    .map(entry => ({
      guestId: entry.guestId,
      displayName: entry.displayName,
      difference: transfer.amount - entry.amount,
    }))
    .sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference))
    .slice(0, limit);
}
