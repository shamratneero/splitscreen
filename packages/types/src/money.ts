/**
 * Money is always an integer count of a currency's smallest unit — poisha for
 * taka, cents for a Singapore dollar. Storing minor units keeps every amount
 * exact and lets the split engine stay integer-only, which is what makes
 * remainder allocation deterministic. Nothing anywhere should hold a float.
 *
 * `minorUnits` is the number of decimal places the currency is *written* with,
 * not what it is stored as. Taka is written whole (`minorUnits: 0`) even though
 * poisha nominally exist, because no Bangladeshi restaurant prices in them.
 */
export type CurrencyCode = 'BDT' | 'INR' | 'MYR' | 'SGD' | 'THB';

export type Currency = {
  code: CurrencyCode;
  symbol: string;
  /** Decimal places used when writing an amount. 0 means whole units only. */
  minorUnits: number;
  /** Digit grouping. South Asian currencies group by lakh, not by thousand. */
  grouping: 'thousand' | 'lakh';
  /** Mobile wallets a guest is likely to pay with, most common first. */
  wallets: string[];
};

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  BDT: { code: 'BDT', symbol: '৳', minorUnits: 0, grouping: 'lakh', wallets: ['bKash', 'Nagad', 'Rocket'] },
  INR: { code: 'INR', symbol: '₹', minorUnits: 0, grouping: 'lakh', wallets: ['UPI', 'Paytm', 'PhonePe'] },
  MYR: { code: 'MYR', symbol: 'RM', minorUnits: 2, grouping: 'thousand', wallets: ['DuitNow', 'Touch ’n Go', 'GrabPay'] },
  SGD: { code: 'SGD', symbol: 'S$', minorUnits: 2, grouping: 'thousand', wallets: ['PayNow', 'GrabPay'] },
  THB: { code: 'THB', symbol: '฿', minorUnits: 2, grouping: 'thousand', wallets: ['PromptPay', 'TrueMoney'] },
};

export const DEFAULT_CURRENCY: CurrencyCode = 'BDT';

export const currencyOf = (code: string | null | undefined): Currency =>
  CURRENCIES[(code ?? DEFAULT_CURRENCY) as CurrencyCode] ?? CURRENCIES[DEFAULT_CURRENCY];

/**
 * Group digits by hand rather than with toLocaleString.
 *
 * These strings render on the server and again in the guest's browser, and the
 * two ICU implementations do not always agree — which discards the server tree
 * and fails hydration. Doing it explicitly also lets lakh grouping be a
 * property of the currency instead of a locale guess.
 */
function group(digits: string, style: Currency['grouping']): string {
  if (style === 'thousand') return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Lakh: the last three digits, then pairs. 1234567 -> 12,34,567
  if (digits.length <= 3) return digits;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${tail}`;
}

/** Formats an integer minor-unit amount for display, e.g. 22900 SGD -> "S$229.00". */
export function formatMoney(minor: number, code: string | null | undefined = DEFAULT_CURRENCY): string {
  const currency = currencyOf(code);
  const sign = minor < 0 ? '-' : '';
  const magnitude = Math.abs(Math.round(minor));

  if (currency.minorUnits === 0) {
    return `${sign}${currency.symbol}${group(String(magnitude), currency.grouping)}`;
  }

  const factor = 10 ** currency.minorUnits;
  const whole = Math.floor(magnitude / factor);
  const fraction = String(magnitude % factor).padStart(currency.minorUnits, '0');
  return `${sign}${currency.symbol}${group(String(whole), currency.grouping)}.${fraction}`;
}

/** Turns a typed amount ("229.50") into integer minor units, or null if unreadable. */
export function parseMoney(input: string, code: string | null | undefined = DEFAULT_CURRENCY): number | null {
  const currency = currencyOf(code);
  const normalized = input.replace(/,/g, '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const scaled = Math.round(Number(normalized) * 10 ** currency.minorUnits);
  return Number.isSafeInteger(scaled) ? scaled : null;
}
