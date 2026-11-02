/**
 * Live player state machine. Pure — the <audio> element side effects live in
 * PlayerProvider. Playback never starts without a user gesture ("PLAY").
 */
export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "reconnecting" | "error" | "unavailable";

export interface PlayerState {
  status: PlayerStatus;
  volume: number; // 0..1
  muted: boolean;
  streamUrl: string | null;
  error: string | null;
  reconnectAttempts: number;
  /** True only after the listener pressed play at least once (autoplay policy). */
  userActivated: boolean;
}

export type PlayerAction =
  | { type: "SET_STREAM"; url: string | null }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "AUDIO_PLAYING" }
  | { type: "AUDIO_WAITING" }
  | { type: "AUDIO_ERROR"; message: string }
  | { type: "RECONNECT" }
  | { type: "GIVE_UP" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "TOGGLE_MUTE" };

export const MAX_RECONNECTS = 6;

export const initialPlayerState: PlayerState = {
  status: "unavailable",
  volume: 0.8,
  muted: false,
  streamUrl: null,
  error: null,
  reconnectAttempts: 0,
  userActivated: false,
};

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "SET_STREAM": {
      if (!action.url) return { ...state, streamUrl: null, status: "unavailable" };
      if (action.url === state.streamUrl) return state;
      const wasActive = ["playing", "loading", "buffering", "reconnecting"].includes(state.status);
      return { ...state, streamUrl: action.url, status: wasActive ? "loading" : state.status === "unavailable" ? "idle" : state.status };
    }
    case "PLAY":
      if (!state.streamUrl) return { ...state, status: "unavailable", error: "The live stream is not connected yet." };
      return { ...state, status: "loading", error: null, userActivated: true, reconnectAttempts: 0 };
    case "PAUSE":
      return state.status === "unavailable" ? state : { ...state, status: "paused", reconnectAttempts: 0 };
    case "AUDIO_PLAYING":
      if (state.status === "paused" || state.status === "idle") return state;
      return { ...state, status: "playing", error: null, reconnectAttempts: 0 };
    case "AUDIO_WAITING":
      return state.status === "playing" ? { ...state, status: "buffering" } : state;
    case "AUDIO_ERROR":
      if (state.status === "paused" || state.status === "idle" || state.status === "unavailable") return state;
      if (state.reconnectAttempts >= MAX_RECONNECTS) return { ...state, status: "error", error: action.message };
      return { ...state, status: "reconnecting", error: action.message };
    case "RECONNECT":
      return state.status === "reconnecting"
        ? { ...state, status: "loading", reconnectAttempts: state.reconnectAttempts + 1 }
        : state;
    case "GIVE_UP":
      return { ...state, status: "error" };
    case "SET_VOLUME":
      return { ...state, volume: Math.min(1, Math.max(0, action.volume)), muted: action.volume <= 0 ? true : false };
    case "TOGGLE_MUTE":
      return { ...state, muted: !state.muted };
    default:
      return state;
  }
}

/** Exponential backoff for stream reconnects: 1s, 2s, 4s … capped at 20s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(20_000, 1000 * 2 ** attempt);
}

export function statusLabel(s: PlayerStatus): string {
  return {
    idle: "Ready", loading: "Connecting…", playing: "Live", paused: "Paused", buffering: "Buffering…",
    reconnecting: "Reconnecting…", error: "Stream error", unavailable: "Stream not connected",
  }[s];
}
