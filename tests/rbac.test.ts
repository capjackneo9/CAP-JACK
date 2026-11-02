import { describe, expect, it } from "vitest";
import { assertCan, AuthorizationError, can, permissionsFor, ROLES } from "@/lib/rbac";

describe("RBAC", () => {
  it("only owners and station managers may approve songs, publish schedules or configure streaming", () => {
    for (const role of ROLES) {
      const privileged = role === "OWNER" || role === "STATION_MANAGER";
      expect(can(role, "library.approve")).toBe(privileged);
      expect(can(role, "schedule.publish")).toBe(privileged);
      expect(can(role, "streaming.configure")).toBe(privileged);
      expect(can(role, "submissions.approve")).toBe(privileged);
    }
  });

  it("only the owner manages users", () => {
    expect(ROLES.filter((r) => can(r, "users.manage"))).toEqual(["OWNER"]);
  });

  it("advertisers and artists cannot enter the studio", () => {
    expect(permissionsFor("ADVERTISER")).toEqual([]);
    expect(permissionsFor("ARTIST")).toEqual([]);
    expect(can("ARTIST", "studio.access")).toBe(false);
  });

  it("DJs can broadcast but not return the station to AutoDJ for others or approve music", () => {
    expect(can("DJ_HOST", "console.broadcast")).toBe(true);
    expect(can("DJ_HOST", "broadcast.returnToAutoDJ")).toBe(false);
    expect(can("DJ_HOST", "library.approve")).toBe(false);
  });

  it("reviewers can review but not give final approval", () => {
    expect(can("MUSIC_REVIEWER", "submissions.review")).toBe(true);
    expect(can("MUSIC_REVIEWER", "submissions.approve")).toBe(false);
  });

  it("assertCan distinguishes 401 and 403", () => {
    try { assertCan(null, "studio.access"); } catch (e) { expect((e as AuthorizationError).status).toBe(401); }
    try { assertCan("ARTIST", "studio.access"); } catch (e) { expect((e as AuthorizationError).status).toBe(403); }
    expect(() => assertCan("OWNER", "users.manage")).not.toThrow();
  });
});
