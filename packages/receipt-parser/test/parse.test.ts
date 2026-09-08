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
  it('flags decimals rather than silently rounding money', () => {
    const result = parseReceipt('Rice 1 99.50\nTotal 99.50');
    expect(result.items).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('whole taka');
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
