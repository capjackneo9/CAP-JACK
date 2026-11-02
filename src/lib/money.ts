export function priceLabel(min: number | null, max: number | null): string {
  const f = (c: number) => `$${(c / 100).toFixed(0)}`;
  if (min == null && max == null) return "Custom quote";
  if (min != null && max != null && max !== min) return `${f(min)}–${f(max)}`;
  return f((min ?? max)!);
}
