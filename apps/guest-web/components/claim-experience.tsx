"use client";

import { useMemo, useState } from "react";
import { QuantityStepper } from "./quantity-stepper";

type DemoSplit = {
  restaurant: string; date: string; hostName: string; payment: { bkash: string; nagad: string }; vat: number; serviceCharge: number;
  items: readonly { id: string; name: string; price: number; available: number }[];
};
type Stage = "claim" | "confirm" | "pay" | "done";
const taka = (value: number) => `৳${value.toLocaleString("en-BD")}`;

export function ClaimExperience({ split }: { split: DemoSplit }) {
  const [stage, setStage] = useState<Stage>("claim");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [reported, setReported] = useState(false);
  const subtotal = useMemo(() => split.items.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 0), 0), [quantities, split.items]);
  // The server will calculate final prorations from all claims. This preview uses the current guest's selected subtotal.
  const itemTotal = split.items.reduce((sum, item) => sum + item.price * item.available, 0);
  const vat = itemTotal ? Math.round((subtotal / itemTotal) * split.vat) : 0;
  const service = itemTotal ? Math.round((subtotal / itemTotal) * split.serviceCharge) : 0;
  const total = subtotal + vat + service;
  const itemCount = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const update = (id: string, value: number) => setQuantities((current) => ({ ...current, [id]: value }));

  if (stage === "confirm") return <section className="screen"><header className="split-header"><p className="eyebrow">AddaSplit</p><h1>Almost done</h1><p>Tell your friends whose items these are.</p></header><label className="field"><span>Your name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tanvir" /></label><div className="summary"><span>You’ll pay</span><strong>{taka(total)}</strong><dl><div><dt>Items</dt><dd>{taka(subtotal)}</dd></div><div><dt>VAT</dt><dd>{taka(vat)}</dd></div><div><dt>Service charge</dt><dd>{taka(service)}</dd></div></dl></div><footer className="bottom-bar"><button className="button" disabled={!name.trim() || itemCount === 0} onClick={() => setStage("pay")}>Confirm {taka(total)}</button></footer></section>;

  if (stage === "pay") return <section className="screen"><header className="split-header"><p className="eyebrow">Pay {split.hostName}</p><h1 className="pay-amount">{taka(total)}</h1><button className="text-button" onClick={() => navigator.clipboard?.writeText(String(total))}>Copy amount</button></header><div className="payment-method"><b>bKash</b><span>{split.payment.bkash}</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(split.payment.bkash)}>Copy</button></div><div className="payment-method"><b>Nagad</b><span>{split.payment.nagad}</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(split.payment.nagad)}>Copy</button></div><p className="quiet">After sending the money, {split.hostName} will mark your payment as received.</p><footer className="bottom-bar"><button className="button" onClick={() => { setReported(true); setStage("done"); }}>I’ve sent it</button></footer></section>;

  if (stage === "done") return <section className="screen success"><div className="success-mark">✓</div><p className="eyebrow">{reported ? "Payment reported" : "Confirmed"}</p><h1>You’re all set</h1><p>You claimed {itemCount} {itemCount === 1 ? "item" : "items"} as {name}.</p><div className="summary"><span>Total</span><strong>{taka(total)}</strong><p className="quiet">Waiting for host confirmation</p></div><button className="secondary-button" onClick={() => setStage("claim")}>View full split</button></section>;

  return <section className="screen"><header className="split-header"><p className="eyebrow">{split.restaurant}</p><h1>{split.date}</h1><p>Tap what you had.</p></header><div className="items">{split.items.map((item) => <article className="claim-row" key={item.id}><div><h2>{item.name}</h2><p>{taka(item.price)} · {item.available} available</p></div><QuantityStepper label={item.name} value={quantities[item.id] ?? 0} maximum={item.available} onChange={(value) => update(item.id, value)} /></article>)}</div><footer className="bottom-bar"><div><span>Your share</span><strong>{taka(total)}</strong></div><button className="button compact" disabled={itemCount === 0} onClick={() => setStage("confirm")}>Continue</button></footer></section>;
}
