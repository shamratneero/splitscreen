import { describe, expect, it } from 'vitest';
import { parseReceipt } from '../src/index';

describe('receipt suggestions', () => {
  it('reads item quantity, unit price and line total while excluding metadata', () => {
    const result = parseReceipt('TEST KITCHEN\nPhone 01700000000\nItem Qty Rate Amount\nChicken Biryani 2 100.00 200.00\nCoke 1 50.00 50.00\nSubtotal 250.00\nVAT 10% 25.00\nService charge 10.00\nDiscount 5.00\nGrand Total 280.00\nCash 300.00\nChange 20.00');
    expect(result.restaurantName).toBe('TEST KITCHEN');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ name: 'Chicken Biryani', quantity: 2, price: 100 });
    expect(result).toMatchObject({ vat: 25, serviceCharge: 10, discount: 5, receiptTotal: 280, warnings: [] });
  });
  it('reads a quantity plus line total and explicit multiplication', () => {
    expect(parseReceipt('Rice 2 200\nTotal 200').items[0]).toMatchObject({ quantity: 2, price: 100 });
    expect(parseReceipt('Rice 2 x 100\nTotal 200').items[0]).toMatchObject({ quantity: 2, price: 100 });
  });
  it('preserves Bengali names and converts Bengali numerals', () => {
    const result = parseReceipt('ঢাকা খাবার\nবিরিয়ানি ২ ১০০ ২০০\nভ্যাট ২০\nমোট ২২০');
    expect(result.items[0]).toMatchObject({ name: 'বিরিয়ানি', quantity: 2, price: 100 });
    expect(result.receiptTotal).toBe(220);
    expect(result.vat).toBe(20);
  });
  it('does not invent a printed receipt total', () => {
    const result = parseReceipt('TEST KITCHEN\nRice 100');
    expect(result.receiptTotal).toBe(0);
    expect(result.warnings.join(' ')).toContain('Receipt total was not found');
  });
  it('keeps a non-divisible line total intact as a group', () => {
    const result = parseReceipt('Rice 3 100\nTotal 100');
    expect(result.items[0]).toMatchObject({ name: 'Rice (3 units)', quantity: 1, price: 100 });
    expect(result.warnings.join(' ')).toContain('one group');
  });
  it('rounds decimals to whole taka and says so, rather than dropping the item', () => {
    // Refusing decimals dropped nearly every real item: Bangladeshi receipts
    // carry them wherever VAT is applied.
    const result = parseReceipt('Rice 1 99.50\nTotal 99.50');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ quantity: 1, price: 100 });
    expect(result.warnings.join(' ')).toContain('rounded to whole taka');
  });
  it('does not confuse a tax percentage with a money amount', () => {
    const result = parseReceipt('Rice 100\nVAT 15%\nTotal 115');
    expect(result.vat).toBe(0);
    expect(result.warnings.join(' ')).toContain('Enter the vat');
  });
  it('flags inconsistent quantities and missing items', () => {
    const result = parseReceipt('Rice 2 100 250\nTotal 300');
    expect(result.items[0]).toMatchObject({ price: 125, quantity: 2 });
    expect(result.warnings.join(' ')).toContain('quantity × price');
    expect(result.warnings.join(' ')).toContain('missing or incorrect');
  });
  it('handles blank input without producing fake items', () => {
    expect(parseReceipt('').items).toEqual([]);
  });
});

describe('a real Dhaka cafe receipt', () => {
  // Cafe Arabika, Merul Badda — transcribed from a photo the parser got wrong.
  // Everything above the "Qty Item Name" header is shop metadata, and the one
  // real item is priced in decimals, which the parser used to reject outright.
  const RECEIPT = [
    'CAFE ARABIKA LIMITED',
    'Brac University,Pragati Sharani,KHA-224',
    'Merul Badda,Dhaka-1212',
    'Contact:+8801329684351',
    'BIN:005484628-0101 ; Mushak:6.3',
    'Token Number:70',
    'Date:07-Sep-26     Time:6:49 PM',
    'Number Of Guests:0    Invoice No:BRAC10018',
    '--Qty Item Name      Price  T.Price',
    '-1 Tart of Arabika   228.57  228.57',
    'GROSS Total:                 228.57',
    '-Discount15.00%:             -34.29',
    '-VAT5.00%:                     9.71',
    'Total Payment:               204.00',
    'Payments:',
    '-Cash;                       204.00',
    '-TOTAL PAYMENT:              500.00',
    '-RETURNED AMOUNT:            296.00',
    'THANK YOU,COME AGAIN',
    'Powered by:3S',
    'www.3ssoftltd.com, 01329692488',
  ].join('\n');

  it('takes the shop name but never its address or token number as items', () => {
    const result = parseReceipt(RECEIPT);
    const names = result.items.map(item => item.name).join(' | ');
    expect(names).not.toMatch(/Brac University|Merul Badda|Token Number|GROSS|RETURNED|Cash/i);
    expect(result.restaurantName).toBe('CAFE ARABIKA LIMITED');
  });

  it('finds the one real item at its decimal price, rounded to whole taka', () => {
    const result = parseReceipt(RECEIPT);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ name: 'Tart of Arabika', quantity: 1, price: 229 });
  });

  it('reads percentage-labelled discount and VAT by their printed amounts', () => {
    const result = parseReceipt(RECEIPT);
    expect(result.discount).toBe(34);
    expect(result.vat).toBe(10);
  });

  it('takes the amount payable, not the cash tendered or the change', () => {
    expect(parseReceipt(RECEIPT).receiptTotal).toBe(204);
  });
});
