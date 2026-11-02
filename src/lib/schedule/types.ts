export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7; // 10080 = 168 hours

/** ISO weekday: 1 = Monday … 7 = Sunday (matches AzuraCast schedule "days"). */
export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
};
export const DAY_SHORT: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

export interface SlotInput {
  id?: string;
  programId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface ProgramInput {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  exclusive: boolean;
  isFallback: boolean;
}

export interface OverrideInput {
  id?: string;
  programId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface Interval { start: number; end: number } // week-minute range, end exclusive
