export const BRAND = {
  name: "Nite Cap Vibe Radio",
  short: "NCVR",
  tagline: "After Dark. Beyond Sound. Into the Vibe.",
  owner: "Caprio Jackson",
  /** Round badge (mic + headphones + tower). */
  logo: "/brand/ncvr-emblem.webp",
  logoSquare: "/brand/ncvr-emblem-512.png",
  icon: "/brand/ncvr-emblem-192.png",
  /** Wide "NCVR · Nite Cap Vibe Radio" text logo (1200×365). */
  wordmark: "/brand/ncvr-wordmark.webp",
  marblePortrait: "/brand/caprio-marble.jpg",
  editorialBanner: "/brand/caprio-banner.jpg",
  mainSite: "https://capriojacksoncoded.si",
  site: "https://nitecapviberadio.tech",
  /** Set NEXT_PUBLIC_CONTACT_EMAIL; nothing is shown until it is configured. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
} as const;
