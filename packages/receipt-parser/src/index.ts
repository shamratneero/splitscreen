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
const money = (value: string) => {
  const normalized = value.replace(/,/g, '');
  if (!/^\d+(?:\.0{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number <= 10_000_000 ? number : null;
};

/** Conservative suggestions, never an authoritative bill. Keep unreadable lines visible for review. */
export function parseReceipt(rawText: string): ParsedReceipt {
  const receipt: ParsedReceipt = { restaurantName: '', items: [], vat: 0, serviceCharge: 0, discount: 0, receiptTotal: 0, warnings: [], rawText };
  const lines = digits(rawText).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let foundTotal = false;
  const warn = (message: string) => { if (!receipt.warnings.includes(message)) receipt.warnings.push(message); };
  const summaries: [RegExp, 'vat' | 'serviceCharge' | 'discount' | 'receiptTotal'][] = [
    [/\b(?:vat|tax)\b|ভ্যাট|কর\b/i, 'vat'],
    [/\b(?:service|svc)\b|সার্ভিস/i, 'serviceCharge'],
    [/\bdiscount\b|ছাড়|ছাড়/i, 'discount'],
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
    if (/\b(sub\s*total|cash|change|paid|balance|tendered|round(?:ing)?|invoice|bill\s*(?:no|#)|table|date|time|phone|tel|mobile|bin|tin|address|qty|quantity|unit\s*price|rate|amount|thank|welcome|served|customer|payment)\b|উপমোট|তারিখ|ধন্যবাদ/i.test(line)) continue;
    // Require a text name and trailing numeric columns. Don't treat IDs/dates as food.
    const row = line.match(/^(.+?\p{L}.*?)\s+(\d[\d,.]*(?:\s*(?:[x×*]\s*|\s+)\d[\d,.]*)*)\s*$/u);
    if (!row) {
      if (!receipt.restaurantName && /\p{L}/u.test(line) && !/\d/.test(line) && receipt.items.length === 0) receipt.restaurantName = original;
      else if (/\d/.test(line) && /\p{L}/u.test(line)) warn('Some lines could not be read. Compare the extracted text with the receipt.');
      continue;
    }
    let name = row[1]!.trim();
    const numbers = row[2]!.split(/\s*[x×*]\s*|\s+/).map(money);
    if (numbers.some(value => value === null) || numbers.length > 3) { warn(`Check “${name}”: the amounts could not be read as whole taka.`); continue; }
    const values = numbers as number[];
    let quantity = 1;
    let price = values[0]!;
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
