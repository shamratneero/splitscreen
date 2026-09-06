"use client";

export function QuantityStepper({ value, maximum, onChange, label }: { value: number; maximum: number; onChange: (value: number) => void; label: string }) {
  return <div className="stepper" aria-label={`${label} quantity`}>
    <button type="button" aria-label={`Remove ${label}`} disabled={value === 0} onClick={() => onChange(value - 1)}>−</button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`Add ${label}`} disabled={value === maximum} onClick={() => onChange(value + 1)}>+</button>
  </div>;
}
