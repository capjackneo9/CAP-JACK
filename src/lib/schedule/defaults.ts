/**
 * NCVR launch programming (America/New_York). This is the editable launch
 * proposal used to seed the database — the studio scheduler is the source of
 * truth once seeded.
 */
export interface DefaultProgram {
  slug: string;
  title: string;
  description: string;
  format: "LIVE" | "PRERECORDED" | "AUTOMATED";
  bucket: "CAPRIO" | "INDEPENDENT" | "GUEST";
  isFallback?: boolean;
  /** [isoDays, startHour, endHour] */
  slots: Array<[number[], number, number]>;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

export const DEFAULT_PROGRAMS: DefaultProgram[] = [
  // ── Monday – Friday ───────────────────────────────────────
  { slug: "after-dark-vibes", title: "After Dark Vibes", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Late-night soul, atmospheric VIBE and slow jams.", slots: [[WEEKDAYS, 0, 3]] },
  { slug: "the-midnight-matrix", title: "The Midnight Matrix", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Experimental, ambient and alternate-dimension music.", slots: [[WEEKDAYS, 3, 6], [[6], 0, 6]] },
  { slug: "first-light-frequencies", title: "First Light Frequencies", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Motivational VIBE, gospel cinematic and morning energy.", slots: [[WEEKDAYS, 6, 9]] },
  { slug: "caprio-radio-rotation", title: "Caprio Radio Rotation", format: "AUTOMATED", bucket: "CAPRIO", isFallback: true,
    description: "Original Caprio Jackson music and featured tracks. Also the station's default rotation whenever nothing else is scheduled.",
    slots: [[WEEKDAYS, 9, 12]] },
  { slug: "the-midday-mix", title: "The Midday Mix", format: "AUTOMATED", bucket: "CAPRIO",
    description: "ATL Soul, VIBE and selected independent artists.", slots: [[WEEKDAYS, 12, 15]] },
  { slug: "drive-time-frequency", title: "Drive-Time Frequency", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Uptempo, rhythm-driven music for the ride home.", slots: [[WEEKDAYS, 15, 18]] },
  { slug: "independent-frequency", title: "Independent Frequency", format: "AUTOMATED", bucket: "INDEPENDENT",
    description: "Approved AI-music and guest-artist spotlight.", slots: [[WEEKDAYS, 18, 20]] },
  { slug: "the-nite-cap-experience", title: "The Nite Cap Experience", format: "LIVE", bucket: "CAPRIO",
    description: "The flagship: Caprio mixes, premieres and interviews.", slots: [[WEEKDAYS, 20, 22]] },
  { slug: "moonlight-sessions", title: "Moonlight Sessions", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Unwind with slow grooves and late-night sounds.", slots: [[WEEKDAYS, 22, 24]] },

  // ── Saturday ──────────────────────────────────────────────
  { slug: "weekend-awakening", title: "Weekend Awakening", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Easing into the weekend with warm, uplifting grooves.", slots: [[[6], 6, 9]] },
  { slug: "the-metaphysical-matrix", title: "The Metaphysical Matrix", format: "LIVE", bucket: "GUEST",
    description: "A three-hour metaphysical window — conversation, consciousness and culture, with scheduled music breaks.",
    slots: [[[6], 9, 12]] },
  { slug: "the-independent-spotlight", title: "The Independent Spotlight", format: "AUTOMATED", bucket: "INDEPENDENT",
    description: "Approved independent and AI-music creators, front and center.", slots: [[[6], 12, 15]] },
  { slug: "saturday-vibe-sessions", title: "Saturday Vibe Sessions", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Afternoon VIBE, ATL Soul and Caprio cuts.", slots: [[[6], 15, 18]] },
  { slug: "ncvr-live-lounge", title: "NCVR Live Lounge", format: "LIVE", bucket: "GUEST",
    description: "Live DJs, guests and in-studio sessions.", slots: [[[6], 18, 21]] },
  { slug: "nite-cap-after-hours", title: "Nite Cap After Hours", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Saturday night, after dark.", slots: [[[6], 21, 24]] },

  // ── Sunday ────────────────────────────────────────────────
  { slug: "moonlight-frequency", title: "Moonlight Frequency", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Overnight ambient and slow-burn soul.", slots: [[[7], 0, 6]] },
  { slug: "soulful-sunday", title: "Soulful Sunday", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Gospel cinematic, soul and morning reflection.", slots: [[[7], 6, 9]] },
  { slug: "university-of-the-soul", title: "University of the Soul", format: "LIVE", bucket: "GUEST",
    description: "A three-hour metaphysical study hall — teachings and dialogue, with scheduled music breaks.",
    slots: [[[7], 9, 12]] },
  { slug: "the-soul-frequency", title: "The Soul Frequency", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Midday soul across eras and dimensions.", slots: [[[7], 12, 15]] },
  { slug: "the-artist-roundtable", title: "The Artist Roundtable", format: "LIVE", bucket: "GUEST",
    description: "Creators in conversation about craft, rights and the business of music.", slots: [[[7], 15, 18]] },
  { slug: "sunday-sunset-sessions", title: "Sunday Sunset Sessions", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Golden-hour grooves to close the weekend.", slots: [[[7], 18, 21]] },
  { slug: "the-reset", title: "The Reset", format: "AUTOMATED", bucket: "CAPRIO",
    description: "Wind down, recalibrate, prepare for the week ahead.", slots: [[[7], 21, 24]] },
];

/** Expand defaults into flat program + slot inputs (ids = slugs). */
export function defaultScheduleInputs() {
  const programs = DEFAULT_PROGRAMS.map((p) => ({
    id: p.slug, slug: p.slug, title: p.title, active: true, exclusive: true, isFallback: Boolean(p.isFallback),
  }));
  const slots = DEFAULT_PROGRAMS.flatMap((p) =>
    p.slots.flatMap(([days, s, e]) =>
      days.map((d) => ({ programId: p.slug, dayOfWeek: d, startMinute: s * 60, endMinute: e * 60 })),
    ),
  );
  return { programs, slots };
}
