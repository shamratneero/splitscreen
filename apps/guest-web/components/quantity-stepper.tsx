"use client";

export function QuantityStepper({
  value,
  maximum,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  maximum: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return <div className="stepper" aria-label={`${label} quantity`} aria-busy={disabled}>
    <button type="button" aria-label={`Remove ${label}`} disabled={disabled || value === 0} onClick={() => onChange(value - 1)}>−</button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`Add ${label}`} disabled={disabled || value === maximum} onClick={() => onChange(value + 1)}>+</button>
  </div>;
}
