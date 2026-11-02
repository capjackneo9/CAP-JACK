"use client";
import { useState, type ReactNode } from "react";

/** Multipart form → JSON API. Shows real server responses; redirects to checkout when provided. */
export function AjaxForm({ action, children, submitLabel, successMessage }: { action: string; children: ReactNode; submitLabel: string; successMessage: string }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "ok" | "error"; message?: string; ref?: string }>({ status: "idle" });
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const res = await fetch(action, { method: "POST", body: new FormData(e.currentTarget) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ status: "error", message: j.error ?? `Request failed (${res.status})` });
      if (j.checkoutUrl) { window.location.href = j.checkoutUrl; return; }
      (e.target as HTMLFormElement).reset();
      setState({ status: "ok", ref: j.reference, message: j.paymentNote });
    } catch {
      setState({ status: "error", message: "Network error — please try again." });
    }
  }
  if (state.status === "ok") {
    return (
      <div role="status" className="rounded-2xl border border-[var(--color-signal)]/40 bg-[var(--color-signal)]/10 p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-signal)]">Received</h2>
        <p className="mt-2">{successMessage}</p>
        {state.ref && <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">Reference: {state.ref}</p>}
        <button className="btn btn-ghost mt-4" onClick={() => setState({ status: "idle" })}>Send another</button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      {/* honeypot */}
      <div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {children}
      {state.status === "error" && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{state.message}</p>}
      <button className="btn btn-primary" disabled={state.status === "sending"}>{state.status === "sending" ? "Sending…" : submitLabel}</button>
    </form>
  );
}

export function Field({ label, name, type = "text", required, hint, ...rest }: { label: string; name: string; type?: string; required?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-[var(--color-live)]"> *</span>}</label>
      <input id={name} name={name} type={type} required={required} className="field" {...rest} />
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, required, rows = 4, hint }: { label: string; name: string; required?: boolean; rows?: number; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-[var(--color-live)]"> *</span>}</label>
      <textarea id={name} name={name} required={required} rows={rows} className="field" />
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function Check({ name, children, required }: { name: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} required={required} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
      <span>{children}{required && <span className="text-[var(--color-live)]"> *</span>}</span>
    </label>
  );
}
