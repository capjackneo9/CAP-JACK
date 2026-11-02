import { MINUTES_PER_DAY, type IsoDay } from "./types";

const WEEKDAY_TO_ISO: Record<string, IsoDay> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface LocalTime {
  isoDay: IsoDay;
  minute: number; // minutes since local midnight
  year: number;
  month: number;
  day: number;
}

/** Wall-clock time in the station timezone (DST handled by Intl). */
export function toStationTime(date: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    isoDay: WEEKDAY_TO_ISO[get("weekday")],
    minute: hour * 60 + Number(get("minute")),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** Minute of the week (0 = Monday 00:00 local). */
export function weekMinute(t: Pick<LocalTime, "isoDay" | "minute">): number {
  return (t.isoDay - 1) * MINUTES_PER_DAY + t.minute;
}

/** Offset (minutes) of timeZone from UTC at instant `date`. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const lt = toStationTime(date, timeZone);
  const asUtc = Date.UTC(lt.year, lt.month - 1, lt.day, Math.floor(lt.minute / 60), lt.minute % 60);
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - actual) / 60000);
}

/** Convert a station-local wall-clock time to a UTC Date. */
export function fromStationTime(year: number, month: number, day: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60);
  // Two passes resolve DST boundaries.
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60000;
  offset = tzOffsetMinutes(new Date(result), timeZone);
  result = guess - offset * 60000;
  return new Date(result);
}

export function formatMinute(minute: number): string {
  if (minute === MINUTES_PER_DAY) return "12 AM";
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatMinute(start)} – ${formatMinute(end)}`;
}

/** AzuraCast stores schedule times as HHMM integers (e.g. 2130). 1440 → 2400. */
export function toAzuraTime(minute: number): number {
  return Math.floor(minute / 60) * 100 + (minute % 60);
}
