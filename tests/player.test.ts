import { describe, expect, it } from "vitest";
import { initialPlayerState, MAX_RECONNECTS, playerReducer, reconnectDelay, type PlayerState } from "@/lib/player/state";

const withStream: PlayerState = playerReducer(initialPlayerState, { type: "SET_STREAM", url: "https://s/radio.mp3" });

describe("player state", () => {
  it("is unavailable until a stream is configured and refuses to play", () => {
    expect(initialPlayerState.status).toBe("unavailable");
    const s = playerReducer(initialPlayerState, { type: "PLAY" });
    expect(s.status).toBe("unavailable");
    expect(s.error).toMatch(/not connected/);
  });

  it("does not autoplay: setting a stream leaves the player idle", () => {
    expect(withStream.status).toBe("idle");
    expect(withStream.userActivated).toBe(false);
    // the audio element reporting playing without a user PLAY must not flip state
    expect(playerReducer(withStream, { type: "AUDIO_PLAYING" }).status).toBe("idle");
  });

  it("plays after user gesture and handles buffering", () => {
    let s = playerReducer(withStream, { type: "PLAY" });
    expect(s).toMatchObject({ status: "loading", userActivated: true });
    s = playerReducer(s, { type: "AUDIO_PLAYING" });
    expect(s.status).toBe("playing");
    s = playerReducer(s, { type: "AUDIO_WAITING" });
    expect(s.status).toBe("buffering");
    s = playerReducer(s, { type: "AUDIO_PLAYING" });
    expect(s.status).toBe("playing");
  });

  it("reconnects with backoff and eventually reports an error", () => {
    let s = playerReducer(playerReducer(withStream, { type: "PLAY" }), { type: "AUDIO_PLAYING" });
    for (let i = 0; i < MAX_RECONNECTS; i++) {
      s = playerReducer(s, { type: "AUDIO_ERROR", message: "network" });
      expect(s.status).toBe("reconnecting");
      s = playerReducer(s, { type: "RECONNECT" });
      expect(s.reconnectAttempts).toBe(i + 1);
    }
    s = playerReducer(s, { type: "AUDIO_ERROR", message: "network" });
    expect(s.status).toBe("error");
    expect(reconnectDelay(0)).toBe(1000);
    expect(reconnectDelay(10)).toBe(20000);
  });

  it("ignores errors while paused", () => {
    const s = playerReducer(playerReducer(withStream, { type: "PLAY" }), { type: "PAUSE" });
    expect(playerReducer(s, { type: "AUDIO_ERROR", message: "x" }).status).toBe("paused");
  });

  it("clamps volume and mutes at zero", () => {
    expect(playerReducer(withStream, { type: "SET_VOLUME", volume: 4 }).volume).toBe(1);
    expect(playerReducer(withStream, { type: "SET_VOLUME", volume: 0 }).muted).toBe(true);
  });
});
