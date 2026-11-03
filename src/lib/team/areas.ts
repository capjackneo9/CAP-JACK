export const TEAM_AREAS = [
  ["SPONSORSHIP_SALES", "Sponsorship & ad sales"],
  ["BUSINESS_DEV", "Business development & finance"],
  ["PARTNERSHIPS", "Partnerships & artist relations"],
  ["MARKETING", "Marketing & social media"],
  ["AUDIO_PRODUCTION", "Audio production & DJ"],
  ["VIDEO_PRODUCTION", "Video & live production (NCVR TV)"],
  ["WEB_TECH", "Web & tech"],
  ["EVENTS", "Community & events"],
] as const;

export const AREA_LABEL: Record<string, string> = Object.fromEntries(TEAM_AREAS);
export const isArea = (v: string) => TEAM_AREAS.some(([k]) => k === v);

export const APPLICATION_STATUSES = ["NEW", "REVIEWING", "INTERVIEW", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const;
export const APPLICATION_LABEL: Record<string, string> = {
  NEW: "New", REVIEWING: "Reviewing", INTERVIEW: "Interview", ACCEPTED: "Accepted", DECLINED: "Declined", WITHDRAWN: "Withdrawn",
};
