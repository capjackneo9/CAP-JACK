import { DAY_SHORT } from "./types";
import { formatRange } from "./time";

export function slotSummary(slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>) {
  const groups = new Map<string, number[]>();
  for (const s of [...slots].sort((a, b) => a.startMinute - b.startMinute)) {
    const k = formatRange(s.startMinute, s.endMinute);
    groups.set(k, [...(groups.get(k) ?? []), s.dayOfWeek]);
  }
  return [...groups.entries()].map(([range, days]) => {
    const sorted = [...days].sort();
    const label = sorted.join(",") === "1,2,3,4,5" ? "Mon–Fri" : sorted.map((d) => DAY_SHORT[d]).join(", ");
    return `${label} · ${range} ET`;
  });
}
