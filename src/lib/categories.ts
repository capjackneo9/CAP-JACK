export const TRACK_CATEGORIES = [
  ["CAPRIO_ORIGINALS", "Caprio Jackson Originals"],
  ["VIBE_MUSIC", "VIBE Music"],
  ["ATL_SOUL", "ATL Soul"],
  ["ALT_DIMENSION", "Alt Dimension"],
  ["GOSPEL_CINEMATIC", "Gospel Cinematic"],
  ["VIBE_19", "Vibe 19"],
  ["INDEPENDENT_AI", "Independent AI-Music"],
  ["DJ_MIXES", "DJ Mixes"],
  ["INTERVIEWS", "Interviews"],
  ["STATION_IDS", "Station IDs"],
  ["COMMERCIALS", "Commercials"],
  ["SOUND_EFFECTS", "Sound Effects"],
] as const;

export type TrackCategoryKey = (typeof TRACK_CATEGORIES)[number][0];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(TRACK_CATEGORIES);
export const isCategory = (v: string): v is TrackCategoryKey => TRACK_CATEGORIES.some(([k]) => k === v);
