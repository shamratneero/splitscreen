export type ReceiptItem = { id: string; name: string; quantity: number; price: number };
export type ParsedReceipt = {
  restaurantName: string;
  items: ReceiptItem[];
  vat: number;
  serviceCharge: number;
  discount: number;
  receiptTotal: number;
  warnings: string[];
  rawText: string;
};

const digits = (value: string) => value.replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
/**
 * Whole taka, rounded from whatever the receipt printed.
 *
 * Bangladeshi receipts carry decimals almost everywhere — a 5% VAT line on a
 * ৳228.57 item is never a round number — so refusing them dropped nearly every
 * real item and left only the misread lines behind. Round instead, and let the
 * caller warn: a visible near-miss the host can correct beats a silently
 * missing item. The reconciliation check against the printed total is what
 * catches rounding that actually matters.
 */
const money = (value: string) => {
  const normalized = value.replace(/,/g, '');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const exact = Number(normalized);
  if (!Number.isFinite(exact) || Math.abs(exact) > 10_000_000) return null;
  return Math.round(exact);
};

/** True when rounding to whole taka actually lost something. */
const isFractional = (value: string) => /\.\d*[1-9]/.test(value.replace(/,/g, ''));

/** Conservative suggestions, never an authoritative bill. Keep unreadable lines visible for review. */
export function parseReceipt(rawText: string): ParsedReceipt {
  const receipt: ParsedReceipt = { restaurantName: '', items: [], vat: 0, serviceCharge: 0, discount: 0, receiptTotal: 0, warnings: [], rawText };
  const allLines = digits(rawText).split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  /**
   * Most printed receipts label their item columns — "Qty Item Name Price
   * T.Price". Everything above that is shop metadata, and it is exactly the
   * part that fools a line parser: "Merul Badda,Dhaka-1212" looks like an item
   * costing ৳1,212, and "KHA-224" like one costing ৳224. Anchor on the header
   * when there is one; receipts without a header still parse as before.
   */
  const headerIndex = allLines.findIndex(line => {
    const columns = ['qty', 'quantity', 'item', 'description', 'price', 'amount', 'rate', 'total'];
    const hits = columns.filter(word => new RegExp(`\\b${word}`, 'i').test(line)).length;
    return hits >= 2 && !/\d{2,}/.test(line);
  });
  const lines = headerIndex >= 0 ? allLines.slice(headerIndex + 1) : allLines;
  // The name still comes from the top of the receipt, above the header.
  const heading = headerIndex >= 0 ? allLines.slice(0, headerIndex) : [];
  for (const line of heading) {
    if (!receipt.restaurantName && /\p{L}/u.test(line) && !/\d/.test(line)) receipt.restaurantName = line;
  }

  let foundTotal = false;
  const warn = (message: string) => { if (!receipt.warnings.includes(message)) receipt.warnings.push(message); };
  const summaries: [RegExp, 'vat' | 'serviceCharge' | 'discount' | 'receiptTotal'][] = [
    // Printers routinely glue the rate to the label — "VAT5.00%",
    // "Discount15.00%" — leaving no word boundary after the word, so \b never
    // matched and the line fell through to be read as an item.
    [/\b(?:vat|tax)(?!\p{L})|ভ্যাট|কর(?!\p{L})/iu, 'vat'],
    [/\b(?:service|svc)(?!\p{L})|সার্ভিস/iu, 'serviceCharge'],
    [/\bdiscount(?!\p{L})|ছাড়/iu, 'discount'],
    [/^(?:grand\s+total|net\s+(?:total|payable)|total(?:\s+(?:amount|payable))?|amount\s+(?:due|payable))\b|^(?:মোট|সর্বমোট)(?:\s|:)/i, 'receiptTotal'],
  ];
  for (const original of lines) {
    const line = original.replace(/(?:৳|\bBDT\b|\bTK\.?)/gi, '').trim();
    const summary = summaries.find(([pattern]) => pattern.test(line));
    if (summary) {
      const match = line.match(/([\d,]+(?:\.\d{1,2})?)\s*$/);
      const amount = match ? money(match[1]!) : null;
      if (amount === null || /%\s*$/.test(line)) { warn(`Enter the ${summary[1]} amount from the receipt.`); continue; }
      receipt[summary[1]] = amount;
      if (summary[1] === 'receiptTotal') foundTotal = true;
      continue;
    }
    // Shop and transaction metadata. Anything here that carries a trailing
    // number would otherwise be read as something the table ate.
    if (/\b(sub\s*total|gross|cash|change|paid|balance|tendered|round(?:ing)?|invoice|bill\s*(?:no|#)|token|table|date|time|phone|tel|mobile|contact|bin|tin|mushak|vat\s*reg|address|guests?|qty|quantity|unit\s*price|rate|amount|thank|welcome|served|customer|payments?|returned|powered|www|https?)\b|উপমোট|তারিখ|ধন্যবাদ/i.test(line)) continue;
    // Many printers bullet each item with a dash, and some put the quantity in
    // its own leading column ("-1 Tart of Arabika  228.57  228.57") rather than
    // beside the price. Peel both off before looking for name and amounts.
    const body = line.replace(/^[-–—•*]+\s*/, '');
    const lead = body.match(/^(\d{1,4})\s+(?=\p{L})/u);
    const leadingQuantity = lead ? Number(lead[1]) : null;
    const remainder = lead ? body.slice(lead[0].length) : body;

    // Require a text name and trailing numeric columns. Don't treat IDs/dates as food.
    const row = remainder.match(/^(.+?\p{L}.*?)\s+(\d[\d,.]*(?:\s*(?:[x×*]\s*|\s+)\d[\d,.]*)*)\s*$/u);
    if (!row) {
      if (!receipt.restaurantName && /\p{L}/u.test(line) && !/\d/.test(line) && receipt.items.length === 0) receipt.restaurantName = original;
      else if (/\d/.test(line) && /\p{L}/u.test(line)) warn('Some lines could not be read. Compare the extracted text with the receipt.');
      continue;
    }
    let name = row[1]!.trim();
    const columns = row[2]!.split(/\s*[x×*]\s*|\s+/);
    const numbers = columns.map(money);
    if (numbers.some(value => value === null) || numbers.length > 3) { warn(`Check “${name}”: the amounts could not be read.`); continue; }
    if (columns.some(isFractional)) warn(`“${name}” was rounded to whole taka. Check it against the receipt.`);
    const values = numbers as number[];
    let quantity = 1;
    let price = values[0]!;

    // Quantity printed in its own leading column: the amounts that follow are
    // the unit price and, usually, the line total.
    if (leadingQuantity !== null) {
      if (leadingQuantity < 1 || leadingQuantity > 1000) { warn(`Check the quantity for “${name}”.`); continue; }
      quantity = leadingQuantity;
      price = values[0]!;
      const printedTotal = values.length >= 2 ? values[values.length - 1]! : null;
      if (printedTotal !== null && Math.abs(quantity * price - printedTotal) > quantity) {
        warn(`Check “${name}”: quantity × price does not match the printed line total.`);
      }
      receipt.items.push({ id: `ocr-${receipt.items.length}`, name, quantity, price });
      continue;
    }

    if (values.length >= 2) {
      quantity = values[0]!;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) { warn(`Check the quantity for “${name}”.`); continue; }
      const explicitTimes = /[x×*]/.test(row[2]!);
      const total = values.length === 3 ? values[2]! : explicitTimes ? quantity * values[1]! : values[1]!;
      price = total / quantity;
      if (values.length === 3 && quantity * values[1]! !== total) warn(`Check “${name}”: quantity × price does not match the printed line total.`);
      if (!Number.isSafeInteger(price)) {
        name += ` (${quantity} units)`;
        quantity = 1;
        price = total;
        warn('An item was kept as one group because its unit price is not whole taka. Review it before sharing.');
      }
    }
    receipt.items.push({ id: `ocr-${receipt.items.length}`, name, quantity, price });
  }
  if (!foundTotal) warn('Receipt total was not found. Enter the printed total before sharing.');
  if (!receipt.restaurantName) warn('Add the restaurant name.');
  if (!receipt.items.length) warn('No item rows were found. Add the items manually or try a clearer photo.');
  const calculated = receipt.items.reduce((sum, item) => sum + item.quantity * item.price, 0) + receipt.vat + receipt.serviceCharge - receipt.discount;
  if (foundTotal && calculated !== receipt.receiptTotal) warn('Extracted items and charges do not match the receipt total. Check for missing or incorrect lines.');
  return receipt;
}
