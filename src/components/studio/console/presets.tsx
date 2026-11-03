"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PresetData } from "@/lib/console/preset";

/**
 * Each console section registers a slot (get current settings / apply saved
 * settings). The preset bar snapshots or restores all slots at once.
 */
type SlotKey = "deckA" | "deckB" | "master" | "mic" | "pads" | "queue" | "transmit";
interface Slot { get: () => unknown; set: (v: unknown) => void | Promise<void> }
interface Registry { register: (k: SlotKey, s: Slot) => () => void; slots: Map<SlotKey, Slot> }

const Ctx = createContext<Registry | null>(null);

export function PresetRegistryProvider({ children }: { children: ReactNode }) {
  const slots = useRef(new Map<SlotKey, Slot>()).current;
  const value = useMemo<Registry>(() => ({
    slots,
    register: (k, s) => { slots.set(k, s); return () => { if (slots.get(k) === s) slots.delete(k); }; },
  }), [slots]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePresetSlot<T>(key: SlotKey, value: T, apply: (v: T) => void | Promise<void>) {
  const reg = useContext(Ctx);
  const v = useRef(value);
  const a = useRef(apply);
  v.current = value;
  a.current = apply;
  useEffect(() => reg?.register(key, { get: () => v.current, set: (x) => a.current(x as T) }), [reg, key]);
}

function snapshot(reg: Registry): PresetData {
  const g = <T,>(k: SlotKey) => reg.slots.get(k)?.get() as T | undefined;
  return {
    version: 1,
    decks: { A: g("deckA"), B: g("deckB") } as PresetData["decks"],
    master: g("master"), mic: g("mic"), pads: g("pads"), queue: g("queue"), transmit: g("transmit"),
  };
}

async function restore(reg: Registry, d: PresetData) {
  const s = (k: SlotKey, v: unknown) => (v !== undefined ? reg.slots.get(k)?.set(v) : undefined);
  await Promise.all([
    s("deckA", d.decks?.A), s("deckB", d.decks?.B), s("master", d.master), s("mic", d.mic),
    s("pads", d.pads), s("queue", d.queue), s("transmit", d.transmit),
  ]);
}

interface Preset { id: string; name: string; isDefault: boolean; data: PresetData; updatedAt: string }

/** Load / save / default presets. Auto-loads the default preset once the console is ready. */
export function PresetBar({ ready }: { ready: boolean }) {
  const reg = useContext(Ctx)!;
  const [presets, setPresets] = useState<Preset[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const autoLoaded = useRef(false);

  const refresh = async () => {
    const r = await fetch("/api/studio/console/presets");
    const j = await r.json();
    if (!r.ok) { setMsg({ tone: "err", text: j.error }); return [] as Preset[]; }
    setPresets(j.presets);
    return j.presets as Preset[];
  };

  async function load(p: Preset, auto = false) {
    setBusy(true);
    try {
      await restore(reg, p.data);
      setCurrent(p.id);
      setMsg({ tone: "ok", text: `${auto ? "Default preset loaded" : "Loaded"}: “${p.name}”. Mic stays OFF until you open it.` });
    } catch (e) {
      setMsg({ tone: "err", text: `Some items could not be restored: ${(e as Error).message}` });
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!ready || autoLoaded.current) return;
    autoLoaded.current = true;
    // Give every section a tick to register before restoring.
    refresh().then((list) => { const d = list.find((p) => p.isDefault); if (d) setTimeout(() => load(d, true), 50); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function save(asNew: boolean) {
    const data = snapshot(reg);
    const existing = presets.find((p) => p.id === current);
    let name = existing?.name ?? "";
    if (asNew || !existing) {
      const n = window.prompt("Name this preset (e.g. “Friday Nite Cap Experience”):", existing ? `${existing.name} copy` : "My show setup");
      if (!n?.trim()) return;
      name = n.trim();
    }
    setBusy(true);
    const r = asNew || !existing
      ? await fetch("/api/studio/console/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, data }) })
      : await fetch(`/api/studio/console/presets/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    await refresh();
    setCurrent(j.preset.id);
    setMsg({ tone: "ok", text: `Saved “${j.preset.name}”${j.preset.isDefault ? " (loads automatically)" : ""}.` });
  }

  async function makeDefault() {
    if (!current) return;
    const r = await fetch(`/api/studio/console/presets/${current}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    if (r.ok) { await refresh(); setMsg({ tone: "ok", text: "This preset now loads automatically when you power on the console." }); }
  }

  async function remove() {
    const p = presets.find((x) => x.id === current);
    if (!p || !window.confirm(`Delete preset “${p.name}”?`)) return;
    const r = await fetch(`/api/studio/console/presets/${p.id}`, { method: "DELETE" });
    if (r.ok) { setCurrent(""); await refresh(); setMsg({ tone: "ok", text: "Preset deleted." }); }
  }

  const sel = presets.find((p) => p.id === current);
  return (
    <section className="glass flex flex-wrap items-center gap-2 p-3" aria-label="Console presets">
      <span className="kicker mr-1">Presets</span>
      <select aria-label="Choose preset" className="field w-auto min-w-48 py-1.5 text-sm" value={current} onChange={(e) => {
        const p = presets.find((x) => x.id === e.target.value);
        if (p) load(p); else setCurrent("");
      }} disabled={busy || !ready}>
        <option value="">{presets.length ? "Choose a preset…" : "No presets yet"}</option>
        {presets.map((p) => <option key={p.id} value={p.id}>{p.isDefault ? "★ " : ""}{p.name}</option>)}
      </select>
      <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" disabled={busy || !ready} onClick={() => save(false)}>{sel ? "Save" : "Save setup…"}</button>
      {sel && <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => save(true)}>Save as new…</button>}
      {sel && !sel.isDefault && <button type="button" className="btn btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={makeDefault}>★ Load on startup</button>}
      {sel?.isDefault && <span className="text-xs text-[var(--color-gold)]">★ Loads on startup</span>}
      {sel && <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={remove}>Delete</button>}
      <span className="basis-full text-[10px] text-[var(--color-muted)] sm:ml-auto sm:basis-auto">Saves pads/sound bank, deck EQ &amp; faders, crossfader, mic &amp; FX, queue and DJ connection (never your password).</span>
      {msg && <p role="status" className={`basis-full text-xs ${msg.tone === "err" ? "text-red-300" : "text-[var(--color-signal)]"}`}>{msg.text}</p>}
    </section>
  );
}
