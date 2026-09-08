import { createContext, useContext, useState, type PropsWithChildren } from 'react';

export type DraftItem = { id: string; name: string; quantity: number; price: number };
export type Draft = { restaurant: string; items: DraftItem[]; vat: string; service: string; discount: string; receiptTotal: string; started: boolean; scanText?: string; scanWarnings?: string[]; scanReviewed?: boolean };
const initial: Draft = { restaurant: '', items: [{ id: '1', name: '', quantity: 1, price: 0 }], vat: '0', service: '0', discount: '0', receiptTotal: '', started: false };
const Context = createContext<{ draft: Draft; update: (patch: Partial<Draft>) => void }>({ draft: initial, update: () => {} });
export function DraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(initial);
  return <Context.Provider value={{ draft, update: patch => setDraft(current => ({ ...current, ...patch })) }}>{children}</Context.Provider>;
}
export const useDraft = () => useContext(Context);
