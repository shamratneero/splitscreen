import { createContext, useContext, useState, type PropsWithChildren } from 'react';

export type DraftItem = { id: string; name: string; quantity: number; price: number };
export type Draft = { restaurant: string; items: DraftItem[]; vat: string; service: string; discount: string; receiptTotal: string; started: boolean };
const initial: Draft = { restaurant: "Sultan's Dine", items: [{ id: '1', name: 'Chicken Biryani', quantity: 2, price: 280 }], vat: '0', service: '0', discount: '0', receiptTotal: '560', started: false };
const Context = createContext<{ draft: Draft; update: (patch: Partial<Draft>) => void }>({ draft: initial, update: () => {} });
export function DraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(initial);
  return <Context.Provider value={{ draft, update: patch => setDraft(current => ({ ...current, ...patch })) }}>{children}</Context.Provider>;
}
export const useDraft = () => useContext(Context);
