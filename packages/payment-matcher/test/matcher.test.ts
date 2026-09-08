import { describe, expect, it } from 'vitest';
import { parseTransfers, reconcile, suggestFor, type ExpectedPayment } from '../src/index';

const guests = (...rows: [string, string, number, boolean?][]): ExpectedPayment[] =>
  rows.map(([guestId, displayName, amount, settled]) => ({ guestId, displayName, amount, settled: settled ?? false }));

describe('reading confirmations', () => {
  it('reads a bKash message', () => {
    const [transfer] = parseTransfers(
      'You have received Tk 366.00 from 01712345678. Fee Tk 0.00. Balance Tk 1,234.56. TrxID 9F2KD81A at 07/09/2026 18:49',
    );
    expect(transfer).toMatchObject({ amount: 366, sender: '01712345678', reference: '9F2KD81A' });
  });

  it('reads a Nagad message', () => {
    const [transfer] = parseTransfers('Money Received. Amount: Tk 1,050.00, Sender: 8801812345678, TxnID: NGD77XY2Q1');
    expect(transfer).toMatchObject({ amount: 1050, sender: '01812345678', reference: 'NGD77XY2Q1' });
  });

  it('takes the received amount, never the balance or the fee', () => {
    // The balance is the largest number in the message and the fee the smallest;
    // picking either would be silently wrong.
    const [transfer] = parseTransfers('You have received Tk 200.00 from 01711111111. Fee Tk 5.00. Balance Tk 98,000.00. TrxID AB12CD34');
    expect(transfer!.amount).toBe(200);
  });

  it('reads Bengali digits', () => {
    const [transfer] = parseTransfers('You have received Tk ৩৬৬ from ০১৭১২৩৪৫৬৭৮. TrxID BN99XX12');
    expect(transfer!.amount).toBe(366);
  });

  it('reads several messages pasted together', () => {
    const text = [
      'You have received Tk 300.00 from 01711111111. TrxID AAA111AA',
      'You have received Tk 450.00 from 01722222222. TrxID BBB222BB',
      'You have received Tk 120.00 from 01733333333. TrxID CCC333CC',
    ].join('\n\n');
    expect(parseTransfers(text).map(t => t.amount)).toEqual([300, 450, 120]);
  });

  it('ignores text carrying no amount', () => {
    expect(parseTransfers('Your bKash PIN reset was successful. Thank you.')).toHaveLength(0);
  });

  it('scales to minor units for a currency written with cents', () => {
    const [transfer] = parseTransfers('Received Tk 22.90 from 01711111111', 2);
    expect(transfer!.amount).toBe(2290);
  });
});

describe('matching payments to guests', () => {
  it('matches unambiguous exact amounts', () => {
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1\n\nReceived Tk 450 from 01722222222. TrxID BKH2B2'),
      guests(['g1', 'Rahim', 300], ['g2', 'Karim', 450], ['g3', 'Jamal', 120]),
    );
    expect(result.matched.map(m => [m.displayName, m.transfer.amount])).toEqual([['Rahim', 300], ['Karim', 450]]);
    expect(result.outstanding.map(o => o.displayName)).toEqual(['Jamal']);
  });

  it('refuses to guess when two guests owe the same amount', () => {
    // Everyone shared a thali; crediting the wrong person costs someone real money.
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300], ['g2', 'Karim', 300]),
    );
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous[0]!.candidates.map(c => c.displayName)).toEqual(['Rahim', 'Karim']);
  });

  it('resolves an ambiguity once the other guest is matched exactly', () => {
    // Two people owe 300, but one payment is for 450 — matching that first
    // leaves only one candidate for the 300.
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1\n\nReceived Tk 450 from 01722222222. TrxID BKH2B2'),
      guests(['g1', 'Rahim', 300], ['g2', 'Karim', 450], ['g3', 'Jamal', 300]),
    );
    // 300 still fits both Rahim and Jamal, so it stays ambiguous rather than guessing.
    expect(result.matched.map(m => m.displayName)).toEqual(['Karim']);
    expect(result.ambiguous).toHaveLength(1);
  });

  it('never credits one payment to two guests', () => {
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300]),
    );
    expect(result.matched).toHaveLength(1);
    expect(result.outstanding).toHaveLength(0);
  });

  it('ignores a message pasted twice', () => {
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300]),
      { alreadySeen: ['BKH1A1'] },
    );
    expect(result.matched).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(result.outstanding.map(o => o.displayName)).toEqual(['Rahim']);
  });

  it('skips guests who already settled', () => {
    const result = reconcile(
      parseTransfers('Received Tk 300 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300, true], ['g2', 'Karim', 300]),
    );
    expect(result.matched.map(m => m.displayName)).toEqual(['Karim']);
  });

  it('leaves an amount nobody owes unmatched', () => {
    const result = reconcile(
      parseTransfers('Received Tk 999 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300]),
    );
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it('absorbs a transfer fee within tolerance but not a different guest', () => {
    const result = reconcile(
      parseTransfers('Received Tk 295 from 01711111111. TrxID BKH1A1'),
      guests(['g1', 'Rahim', 300], ['g2', 'Karim', 250]),
      { tolerance: 5 },
    );
    expect(result.matched.map(m => m.displayName)).toEqual(['Rahim']);
    expect(result.matched[0]!.difference).toBe(-5);
    // Flagged as short, not silently treated as settled in full.
    expect(result.matched[0]!.kind).toBe('short');
  });
});

describe('helping with what did not match', () => {
  it('offers the closest guests, nearest first', () => {
    const [transfer] = parseTransfers('Received Tk 310 from 01711111111. TrxID BKH1A1');
    const near = suggestFor(transfer!, guests(['g1', 'Rahim', 300], ['g2', 'Karim', 450], ['g3', 'Jamal', 120]));
    expect(near.map(s => s.displayName)).toEqual(['Rahim', 'Karim', 'Jamal']);
    expect(near[0]!.difference).toBe(10);
  });
});
