export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 4h6M9 11h6M9 15h3" /></svg></span><span>SplitUp</span></div>;
}

export function BillSteps({ stage }: { stage: "claim" | "confirm" | "pay" | "done" }) {
  const current = { claim: 0, confirm: 1, pay: 2, done: 3 }[stage];
  return <div className="bill-chrome"><Brand /><ol className="bill-steps" aria-label="Your split progress">
    {["Choose", "Review", "Pay"].map((label, index) => <li key={label} className={index < current ? "complete" : index === current ? "current" : ""} aria-current={index === current ? "step" : undefined}><span aria-hidden="true">{index < current ? "✓" : index + 1}</span>{label}</li>)}
  </ol></div>;
}
