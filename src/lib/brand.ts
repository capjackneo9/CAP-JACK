export const BRAND = {
  name: "Nite Cap Vibe Radio",
  short: "NCVR",
  tagline: "After Dark. Beyond Sound. Into the Vibe.",
  owner: "Caprio Jackson",
  logo: "/brand/ncvr-logo.svg",
  marblePortrait: "/brand/caprio-marble.jpg",
  editorialBanner: "/brand/caprio-banner.jpg",
  mainSite: "https://capriojacksoncoded.si",
  /** Set NEXT_PUBLIC_CONTACT_EMAIL; nothing is shown until it is configured. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
} as const;
