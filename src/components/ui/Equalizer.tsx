export function Equalizer({ active, bars = 5, className = "" }: { active: boolean; bars?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-5 items-end gap-[3px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={`w-[3px] rounded-sm ${active ? "eq-bar bg-[var(--color-signal)]" : "h-1 bg-[var(--color-muted)]/50"}`}
          style={active ? { height: "100%", animationDelay: `${i * 0.12}s`, animationDuration: `${0.7 + (i % 3) * 0.2}s` } : undefined} />
      ))}
    </span>
  );
}
