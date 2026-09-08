"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@splitsave/types";

export type Sharer = { id: string; displayName: string };

/**
 * Choosing who splits one item.
 *
 * The value is divided evenly across everyone ticked, so the only decision is
 * who was in on it. Anyone who hasn't opened the link yet cannot be listed —
 * the server refuses participants who haven't joined the split, because
 * otherwise one guest could bind absent people to a charge.
 */
export function ShareItemModal({
  itemName,
  unitPrice,
  currency,
  people,
  selected,
  onCancel,
  onConfirm,
}: {
  itemName: string;
  unitPrice: number;
  currency: string;
  people: Sharer[];
  selected: string[];
  onCancel: () => void;
  onConfirm: (participantIds: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const dialog = useRef<HTMLDivElement>(null);

  // Escape closes, as any dialog should.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    dialog.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const toggle = (id: string) =>
    setChosen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const each = chosen.length > 0 ? Math.floor(unitPrice / chosen.length) : 0;
  const remainder = chosen.length > 0 ? unitPrice - each * chosen.length : 0;

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${itemName}`}
        tabIndex={-1}
        ref={dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>Share this item?</h2>
          <p className="quiet">Choose who split the {itemName}.</p>
        </header>

        <div className="sheet-item">
          <b>{itemName}</b>
          <span>{formatMoney(unitPrice, currency)}</span>
        </div>

        <ul className="people-picker">
          {people.map((person) => {
            const isChosen = chosen.includes(person.id);
            return (
              <li key={person.id}>
                <label>
                  <input type="checkbox" checked={isChosen} onChange={() => toggle(person.id)} />
                  <span>{person.displayName}</span>
                  <span className="share">{isChosen ? formatMoney(each, currency) : ""}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {chosen.length > 0 ? (
          <p className="quiet split-note">
            {formatMoney(unitPrice, currency)} ÷ {chosen.length} = {formatMoney(each, currency)} each
            {remainder > 0
              ? ` — the extra ${formatMoney(remainder, currency)} is spread so the bill still adds up.`
              : ""}
          </p>
        ) : (
          <p className="quiet split-note">Tick everyone who shared it, including yourself.</p>
        )}

        <footer className="sheet-actions">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="button" disabled={chosen.length === 0} onClick={() => onConfirm(chosen)}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
