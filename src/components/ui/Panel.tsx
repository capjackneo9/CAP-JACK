import type { ReactNode } from "react";

export function Panel({ title, kicker, children, className = "", actions }: { title?: string; kicker?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`glass p-5 ${className}`}>
      {(title || kicker || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            {title && <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-wide">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "royal" }: { children: ReactNode; tone?: "royal" | "signal" | "live" | "gold" | "muted" | "danger" }) {
  const tones = {
    royal: "bg-[var(--color-royal)]/40 text-[var(--color-royal-300)] border-[var(--color-royal-400)]/40",
    signal: "bg-[var(--color-signal)]/10 text-[var(--color-signal)] border-[var(--color-signal)]/40",
    live: "bg-[var(--color-live)]/15 text-[var(--color-live)] border-[var(--color-live)]/50",
    gold: "bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/40",
    muted: "bg-white/5 text-[var(--color-muted)] border-white/10",
    danger: "bg-red-500/10 text-red-300 border-red-400/40",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ kicker, title, intro }: { kicker?: string; title: string; intro?: ReactNode }) {
  return (
    <header className="mb-8">
      {kicker && <div className="kicker">{kicker}</div>}
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-wide sm:text-4xl">{title}</h1>
      {intro && <div className="mt-3 max-w-3xl text-[var(--color-muted)]">{intro}</div>}
    </header>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const t = { info: "border-[var(--color-royal-400)]/40 bg-[var(--color-royal)]/15", warn: "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10", error: "border-red-400/50 bg-red-500/10", ok: "border-[var(--color-signal)]/40 bg-[var(--color-signal)]/10" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${t}`}>{children}</div>;
}
