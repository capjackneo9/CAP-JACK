/**
 * Role-based access control. Pure module (usable in tests, middleware and
 * server code). The server must ALWAYS call `can`/`assertCan` — UI hiding is
 * only a convenience.
 */
export const ROLES = ["OWNER", "STATION_MANAGER", "DJ_HOST", "MUSIC_REVIEWER", "ADVERTISER", "ARTIST"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner / Super Administrator",
  STATION_MANAGER: "Station Manager",
  DJ_HOST: "DJ / Host",
  MUSIC_REVIEWER: "Music Reviewer",
  ADVERTISER: "Advertiser",
  ARTIST: "Artist",
};

export type Permission =
  | "studio.access"
  | "console.broadcast"       // go live from the studio console
  | "broadcast.returnToAutoDJ"
  | "schedule.view"
  | "schedule.edit"           // edit local schedule metadata (drafts)
  | "schedule.publish"        // apply schedule to AzuraCast
  | "library.view"
  | "library.upload"
  | "library.approve"         // approve tracks into public playlists
  | "submissions.review"      // view + move submissions through review
  | "submissions.approve"     // final approve / reject / schedule
  | "bookings.manage"
  | "guests.invite"
  | "streaming.configure"     // stream / AzuraCast configuration
  | "users.manage"
  | "audit.view"
  | "settings.rotation";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [
    "studio.access", "console.broadcast", "broadcast.returnToAutoDJ", "schedule.view", "schedule.edit", "schedule.publish",
    "library.view", "library.upload", "library.approve", "submissions.review", "submissions.approve", "bookings.manage",
    "guests.invite", "streaming.configure", "users.manage", "audit.view", "settings.rotation",
  ],
  STATION_MANAGER: [
    "studio.access", "console.broadcast", "broadcast.returnToAutoDJ", "schedule.view", "schedule.edit", "schedule.publish",
    "library.view", "library.upload", "library.approve", "submissions.review", "submissions.approve", "bookings.manage",
    "guests.invite", "streaming.configure", "audit.view", "settings.rotation",
  ],
  DJ_HOST: ["studio.access", "console.broadcast", "schedule.view", "library.view", "guests.invite"],
  MUSIC_REVIEWER: ["studio.access", "schedule.view", "library.view", "submissions.review"],
  // Advertisers and artists are customers: they use the public portal only.
  ADVERTISER: [],
  ARTIST: [],
};

export function permissionsFor(role: Role | null | undefined): Permission[] {
  return role ? MATRIX[role] ?? [] : [];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export class AuthorizationError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.status = status;
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!role) throw new AuthorizationError("Sign-in required", 401);
  if (!can(role, permission)) throw new AuthorizationError(`Missing permission: ${permission}`, 403);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
