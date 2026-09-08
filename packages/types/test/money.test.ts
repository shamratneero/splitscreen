import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney, currencyOf } from '../src/money';

describe('money', () => {
  it('writes whole-unit currencies without decimals', () => {
    expect(formatMoney(229, 'BDT')).toBe('৳229');
    expect(formatMoney(0, 'BDT')).toBe('৳0');
  });

  it('writes minor-unit currencies with them', () => {
    expect(formatMoney(22900, 'SGD')).toBe('S$229.00');
    expect(formatMoney(22950, 'MYR')).toBe('RM229.50');
    expect(formatMoney(5, 'THB')).toBe('฿0.05');
  });

  it('groups South Asian amounts by lakh, not by thousand', () => {
    // A Bangladeshi reader expects 12,34,567 — not 1,234,567.
    expect(formatMoney(1234567, 'BDT')).toBe('৳12,34,567');
    expect(formatMoney(100000, 'INR')).toBe('₹1,00,000');
    expect(formatMoney(123456789, 'SGD')).toBe('S$1,234,567.89');
  });

  it('keeps the sign outside the symbol', () => {
    expect(formatMoney(-450, 'BDT')).toBe('-৳450');
  });

  it('reads typed amounts into minor units', () => {
    expect(parseMoney('229', 'BDT')).toBe(229);
    expect(parseMoney('229.50', 'SGD')).toBe(22950);
    expect(parseMoney('1,234', 'BDT')).toBe(1234);
    expect(parseMoney('abc', 'BDT')).toBeNull();
  });

  it('falls back to taka for an unknown currency rather than throwing', () => {
    expect(currencyOf('XYZ').code).toBe('BDT');
    expect(currencyOf(null).code).toBe('BDT');
  });
});
