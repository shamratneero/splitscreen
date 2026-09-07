import { describe, expect, it } from "vitest";
import { calculateSplit, type CalculateSplitInput } from "../src/index";

const base = (overrides: Partial<CalculateSplitInput> = {}): CalculateSplitInput => ({
  items: [{ id: "biryani", name: "Chicken Biryani", quantity: 1, unitPrice: 300 }],
  claims: [{ id: "c1", itemId: "biryani", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" }],
  guests: [{ id: "a", displayName: "Asha" }],
  vat: 0,
  serviceCharge: 0,
  discount: 0,
  receiptTotal: 300,
  ...overrides,
});

describe("calculateSplit", () => {
  it("handles one guest", () => expect(calculateSplit(base()).guests[0]!.total).toBe(300));
  it("splits quantities across guests", () => {
    const result = calculateSplit(base({ items: [{ id: "coke", name: "Coke", quantity: 2, unitPrice: 60 }], claims: [
      { id: "1", itemId: "coke", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" },
      { id: "2", itemId: "coke", guestId: "b", quantity: 1, allocationType: "INDIVIDUAL" },
    ], guests: [{ id: "a", displayName: "Asha" }, { id: "b", displayName: "Babu" }], receiptTotal: 120 }));
    expect(result.guests.map((guest) => guest.total)).toEqual([60, 60]);
  });
  it("allocates explicitly shared items", () => {
    const result = calculateSplit(base({ items: [{ id: "f", name: "Fuchka", quantity: 1, unitPrice: 121 }], claims: [{ id: "s", itemId: "f", guestId: "a", quantity: 1, allocationType: "SHARED", participantIds: ["a", "b"] }], guests: [{ id: "a", displayName: "Asha" }, { id: "b", displayName: "Babu" }], receiptTotal: 121 }));
    expect(result.guests.map((guest) => guest.total)).toEqual([61, 60]);
  });
  it("prorates VAT and service charges", () => {
    const result = calculateSplit(base({ items: [{ id: "a", name: "A", quantity: 1, unitPrice: 100 }, { id: "b", name: "B", quantity: 1, unitPrice: 300 }], claims: [{ id: "1", itemId: "a", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" }, { id: "2", itemId: "b", guestId: "b", quantity: 1, allocationType: "INDIVIDUAL" }], guests: [{ id: "a", displayName: "Asha" }, { id: "b", displayName: "Babu" }], vat: 40, serviceCharge: 20, receiptTotal: 460 }));
    expect(result.guests.map((guest) => guest.total)).toEqual([115, 345]);
  });
  it("prorates discount consistently", () => {
    const result = calculateSplit(base({ items: [{ id: "a", name: "A", quantity: 1, unitPrice: 100 }, { id: "b", name: "B", quantity: 1, unitPrice: 200 }], claims: [{ id: "1", itemId: "a", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" }, { id: "2", itemId: "b", guestId: "b", quantity: 1, allocationType: "INDIVIDUAL" }], guests: [{ id: "a", displayName: "Asha" }, { id: "b", displayName: "Babu" }], discount: 30, receiptTotal: 270 }));
    expect(result.guests.map((guest) => guest.total)).toEqual([90, 180]);
  });
  it("uses deterministic rounding and retains all money", () => {
    const result = calculateSplit(base({ items: [{ id: "a", name: "A", quantity: 1, unitPrice: 1 }, { id: "b", name: "B", quantity: 1, unitPrice: 1 }, { id: "c", name: "C", quantity: 1, unitPrice: 1 }], claims: [{ id: "1", itemId: "a", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" }, { id: "2", itemId: "b", guestId: "b", quantity: 1, allocationType: "INDIVIDUAL" }, { id: "3", itemId: "c", guestId: "c", quantity: 1, allocationType: "INDIVIDUAL" }], guests: [{ id: "a", displayName: "A" }, { id: "b", displayName: "B" }, { id: "c", displayName: "C" }], vat: 100, receiptTotal: 103 }));
    expect(result.guests.map((guest) => guest.total)).toEqual([35, 34, 34]);
    expect(result.guests.reduce((sum, guest) => sum + guest.total, 0)).toBe(103);
  });
  it("supports zero-value charges", () => expect(calculateSplit(base()).allocatedCharges).toEqual({ vat: 0, serviceCharge: 0, discount: 0 }));
  it("reports partial and unclaimed items", () => {
    const result = calculateSplit(base({ items: [{ id: "coke", name: "Coke", quantity: 3, unitPrice: 60 }], claims: [{ id: "c1", itemId: "coke", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" }], receiptTotal: 180 }));
    expect(result.unclaimedItems).toEqual([{ itemId: "coke", name: "Coke", quantity: 2, value: 120 }]);
  });
  it("flags a receipt mismatch", () => expect(calculateSplit(base({ receiptTotal: 301 })).reconciled).toBe(false));
  it("reconciles a fully claimed final receipt", () => {
    const result = calculateSplit(base({ vat: 15, serviceCharge: 5, receiptTotal: 320 }));
    expect(result.reconciled).toBe(true);
    expect(result.unclaimedItems).toHaveLength(0);
    expect(result.guests.reduce((sum, guest) => sum + guest.total, 0)).toBe(result.receiptTotal);
  });
  it("rejects over-claims", () => expect(() => calculateSplit(base({ claims: [{ id: "x", itemId: "biryani", guestId: "a", quantity: 2, allocationType: "INDIVIDUAL" }] }))).toThrow("over-claimed"));
  it("reserves proportional charges for unclaimed items", () => {
    const result = calculateSplit(base({
      items: [{ id: "biryani", name: "Biryani", quantity: 4, unitPrice: 100 }],
      vat: 40, serviceCharge: 20, discount: 80, receiptTotal: 380,
    }));
    expect(result.guests[0]).toMatchObject({ itemSubtotal: 100, vat: 10, serviceCharge: 5, discount: 20, total: 95 });
    expect(result.allocatedCharges).toEqual({ vat: 10, serviceCharge: 5, discount: 20 });
    expect(result.unallocatedCharges).toEqual({ vat: 30, serviceCharge: 15, discount: 60 });
    expect(result.guests[0]!.total + 300 + 30 + 15 - 60).toBe(result.receiptTotal);
  });
  it("keeps charges unallocated before anyone claims", () => {
    const result = calculateSplit(base({ claims: [], guests: [], vat: 30, receiptTotal: 330 }));
    expect(result.allocatedCharges.vat).toBe(0);
    expect(result.unallocatedCharges.vat).toBe(30);
  });
  it("retains rounding remainders across claimed and unclaimed portions", () => {
    const result = calculateSplit(base({
      items: [{ id: "biryani", name: "Biryani", quantity: 3, unitPrice: 1 }],
      vat: 5, serviceCharge: 2, discount: 1, receiptTotal: 9,
    }));
    expect(result.allocatedCharges).toEqual({ vat: 2, serviceCharge: 1, discount: 0 });
    expect(result.unallocatedCharges).toEqual({ vat: 3, serviceCharge: 1, discount: 1 });
    expect(result.guests[0]!.total + 2 + 3 + 1 - 1).toBe(9);
  });
  it("allocates all charges once the remaining items are claimed", () => {
    const result = calculateSplit(base({
      items: [{ id: "biryani", name: "Biryani", quantity: 2, unitPrice: 100 }],
      guests: [{ id: "a", displayName: "Asha" }, { id: "b", displayName: "Babu" }],
      claims: [
        { id: "a", itemId: "biryani", guestId: "a", quantity: 1, allocationType: "INDIVIDUAL" },
        { id: "b", itemId: "biryani", guestId: "b", quantity: 1, allocationType: "INDIVIDUAL" },
      ], vat: 21, receiptTotal: 221,
    }));
    expect(result.guests.map(guest => guest.total)).toEqual([111, 110]);
    expect(result.unallocatedCharges).toEqual({ vat: 0, serviceCharge: 0, discount: 0 });
  });
  it("reports charges that cannot be allocated to a zero-value bill", () => {
    const result = calculateSplit(base({ items: [{ id: "biryani", name: "Free", quantity: 1, unitPrice: 0 }], vat: 10, receiptTotal: 10 }));
    expect(result.guests[0]!.total).toBe(0);
    expect(result.allocatedCharges.vat).toBe(0);
    expect(result.unallocatedCharges.vat).toBe(10);
  });

});
