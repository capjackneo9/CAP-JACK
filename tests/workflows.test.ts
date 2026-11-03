import { describe, expect, it } from "vitest";
import { checkTransition, statusAfterPayment } from "@/lib/submissions/workflow";
import { permissionsFor } from "@/lib/rbac";
import { computeRotationReport, validateGoals, DEFAULT_GOALS } from "@/lib/rotation";
import { deriveOnAir } from "@/lib/audio/onair";
import { detectFileType } from "@/lib/files";
import { createInviteToken, tokenMatches } from "@/lib/tokens";
import { normalizeNowPlaying } from "@/lib/azuracast/normalize";

const base = { rightsConfirmed: true, broadcastPermission: true };

describe("submission workflow", () => {
  it("reviewer can start review but cannot approve", () => {
    const p = permissionsFor("MUSIC_REVIEWER");
    expect(checkTransition({ ...base, from: "SUBMITTED", to: "UNDER_REVIEW", permissions: p }).ok).toBe(true);
    expect(checkTransition({ ...base, from: "UNDER_REVIEW", to: "APPROVED", permissions: p }).ok).toBe(false);
  });

  it("manager approves only with rights + broadcast permission", () => {
    const p = permissionsFor("STATION_MANAGER");
    expect(checkTransition({ ...base, from: "UNDER_REVIEW", to: "APPROVED", permissions: p }).ok).toBe(true);
    expect(checkTransition({ ...base, rightsConfirmed: false, from: "UNDER_REVIEW", to: "APPROVED", permissions: p }).ok).toBe(false);
  });

  it("cannot skip review", () => {
    const p = permissionsFor("OWNER");
    expect(checkTransition({ ...base, from: "SUBMITTED", to: "APPROVED", permissions: p }).ok).toBe(false);
    expect(checkTransition({ ...base, from: "SUBMITTED", to: "SCHEDULED", permissions: p }).ok).toBe(false);
  });

  it("payment never guarantees airplay", () => {
    expect(statusAfterPayment("SUBMITTED")).toBe("SUBMITTED");
    expect(statusAfterPayment("REJECTED")).toBe("REJECTED");
    // a paid submission still needs editorial permission to be approved
    expect(checkTransition({ ...base, paid: true, from: "UNDER_REVIEW", to: "APPROVED", permissions: [] }).ok).toBe(false);
  });
});

describe("rotation reporting", () => {
  it("validates goals", () => {
    expect(validateGoals(DEFAULT_GOALS)).toBeNull();
    expect(validateGoals({ caprio: 80, independent: 15, guest: 10 })).toMatch(/100/);
  });

  it("measures actual airtime by bucket and tracks unmatched plays", () => {
    const library = [
      { title: "Moon Code", artistName: "Caprio Jackson", category: "CAPRIO_ORIGINALS" },
      { title: "Synth Dreams", artistName: "Indie AI", category: "INDEPENDENT_AI", azuracastMediaId: 9 },
      { title: "NCVR ID", artistName: "NCVR", category: "STATION_IDS" },
    ];
    const r = computeRotationReport(
      [
        { title: "moon code", artist: "caprio jackson", durationSec: 300 },
        { mediaId: 9, title: "x", artist: "y", durationSec: 60 },
        { title: "NCVR ID", artist: "NCVR", durationSec: 40 },
        { title: "Unknown", artist: "Nobody", durationSec: 100 },
      ],
      library,
      DEFAULT_GOALS,
    );
    expect(r.totalSec).toBe(500);
    expect(r.unmatchedSec).toBe(100);
    expect(r.actual).toEqual({ CAPRIO: 75, INDEPENDENT: 15, GUEST: 10 });
    expect(r.variance.CAPRIO).toBe(0);
  });
});

describe("ON AIR indicator", () => {
  it("never shows ON AIR from a local toggle alone", () => {
    expect(deriveOnAir({ transport: "disconnected", engineLive: false, engineStreamer: null, ourStreamer: "caprio" })).toBe("OFF_AIR");
    expect(deriveOnAir({ transport: "streaming", engineLive: false, engineStreamer: null, ourStreamer: "caprio" })).toBe("UNCONFIRMED");
  });
  it("shows ON AIR only when AzuraCast confirms our live source", () => {
    expect(deriveOnAir({ transport: "streaming", engineLive: true, engineStreamer: "Caprio", ourStreamer: "caprio" })).toBe("ON_AIR");
    // AzuraCast reports the display name ("Caprio Jackson"), not the login ("caprio")
    expect(deriveOnAir({ transport: "streaming", engineLive: true, engineStreamer: "Caprio Jackson", ourStreamer: "caprio" })).toBe("ON_AIR");
    expect(deriveOnAir({ transport: "disconnected", engineLive: true, engineStreamer: "OtherDJ", ourStreamer: "caprio" })).toBe("OTHER_DJ_LIVE");
    expect(deriveOnAir({ transport: "error", engineLive: true, engineStreamer: "caprio", ourStreamer: "caprio" })).toBe("FAULT");
  });
});

describe("upload validation", () => {
  const pad = (arr: number[]) => new Uint8Array([...arr, ...new Array(16).fill(0)]);
  it("detects audio and image types from magic bytes", () => {
    expect(detectFileType(pad([0x49, 0x44, 0x33]))?.mime).toBe("audio/mpeg");
    expect(detectFileType(pad([0x66, 0x4c, 0x61, 0x43]))?.mime).toBe("audio/flac");
    const wav = new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt ");
    expect(detectFileType(wav)?.mime).toBe("audio/wav");
    expect(detectFileType(pad([0xff, 0xd8, 0xff]))?.kind).toBe("image");
  });
  it("rejects disguised files", () => {
    expect(detectFileType(new TextEncoder().encode("<?php echo 'hi'; ?>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("MZ executable....."))).toBeNull();
  });
});

describe("guest invite tokens", () => {
  it("stores only a hash and verifies in constant time", () => {
    const { token, hash } = createInviteToken();
    expect(hash).not.toContain(token);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(token + "x", hash)).toBe(false);
  });
});

describe("now playing normalization", () => {
  const api = {
    station: { id: 1, name: "NCVR", shortcode: "ncvr", listen_url: "https://s/listen/ncvr/radio.mp3" },
    listeners: { total: 12, unique: 10, current: 11 },
    live: { is_live: false, streamer_name: "", broadcast_start: null },
    now_playing: { sh_id: 1, played_at: 1, duration: 200, elapsed: 20, remaining: 180, song: { id: "x", text: "A - B", artist: "A", title: "B", art: "" } },
    song_history: [],
    is_online: true,
  };
  it("hides listener counts unless approved for display", () => {
    expect(normalizeNowPlaying(api, { showListeners: false }).listeners).toBeNull();
    expect(normalizeNowPlaying(api, { showListeners: true }).listeners).toBe(11);
  });
  it("passes through real metadata and treats empty artwork as missing", () => {
    const n = normalizeNowPlaying(api, { showListeners: false });
    expect(n.track).toMatchObject({ title: "B", artist: "A", art: null });
    expect(n.listenUrl).toBe("https://s/listen/ncvr/radio.mp3");
    expect(n.live.isLive).toBe(false);
  });
  it("returns no track when the API reports none (no invented titles)", () => {
    expect(normalizeNowPlaying({ ...api, now_playing: null }, { showListeners: false }).track).toBeNull();
  });
});
