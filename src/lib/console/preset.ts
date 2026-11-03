import { z } from "zod";

/** Saved broadcast-console setup. Never contains passwords. */
const deck = z.object({
  trim: z.number().min(0).max(2), filter: z.number().min(-1).max(1),
  low: z.number().min(-24).max(12), mid: z.number().min(-24).max(12), high: z.number().min(-24).max(12),
  fader: z.number().min(0).max(1), cue: z.boolean(), trackId: z.string().max(64).nullable().optional(),
});
const pad = z.union([
  z.null(),
  z.object({ source: z.enum(["library", "pad"]), id: z.string().min(1).max(64), name: z.string().max(120) }),
]);

export const presetDataSchema = z.object({
  version: z.literal(1),
  decks: z.object({ A: deck, B: deck }).partial().optional(),
  master: z.object({ crossfade: z.number().min(0).max(1), master: z.number().min(0).max(1.2), monitor: z.number().min(0).max(1) }).optional(),
  mic: z.object({
    gain: z.number().min(0).max(3), ducking: z.boolean(), duckLevel: z.number().min(0).max(1),
    echo: z.number().min(0).max(0.8), reverb: z.number().min(0).max(1), monitor: z.boolean(),
  }).optional(),
  pads: z.array(pad).max(8).optional(),
  queue: z.array(z.string().max(64)).max(200).optional(),
  transmit: z.object({ url: z.string().max(300).optional(), user: z.string().max(120).optional(), bitrate: z.number().int().min(32000).max(320000).optional() }).optional(),
});

export type PresetData = z.infer<typeof presetDataSchema>;
export type PadSource = Exclude<z.infer<typeof pad>, null>;

export function padUrl(p: PadSource): string {
  return p.source === "library" ? `/api/studio/library/${p.id}/audio` : `/api/studio/console/pads/${p.id}`;
}
