/**
 * ON-AIR truth table. The studio light must reflect the real, authenticated
 * broadcast connection — never just a local toggle.
 *
 * transport: state of our webcast socket to AzuraCast/Liquidsoap
 * engineLive: AzuraCast Now Playing reports live.is_live with our streamer
 */
export type TransportState = "disconnected" | "connecting" | "authenticating" | "streaming" | "error";

export type OnAirState =
  | "OFF_AIR"         // nothing transmitting
  | "CONNECTING"      // socket opening / handshake
  | "UNCONFIRMED"     // we are sending audio but AzuraCast has not confirmed the live switch yet
  | "ON_AIR"          // AzuraCast confirms our live source is the program
  | "OTHER_DJ_LIVE"   // AzuraCast is live, but not with this studio session
  | "FAULT";

export function deriveOnAir(params: {
  transport: TransportState;
  engineLive: boolean;
  engineStreamer: string | null;
  ourStreamer: string | null;
}): OnAirState {
  const { transport, engineLive } = params;
  if (transport === "error") return "FAULT";
  if (transport === "connecting" || transport === "authenticating") return "CONNECTING";
  // AzuraCast reports the DJ's *display name*, not the login, so names can't be compared.
  // Our authenticated socket is open AND the engine says a live source is on air → that's us
  // (AzuraCast accepts only one live source at a time).
  if (transport === "streaming") return engineLive ? "ON_AIR" : "UNCONFIRMED";
  // disconnected
  return engineLive ? "OTHER_DJ_LIVE" : "OFF_AIR";
}

export const ON_AIR_LABEL: Record<OnAirState, string> = {
  OFF_AIR: "OFF AIR · AutoDJ",
  CONNECTING: "CONNECTING…",
  UNCONFIRMED: "SENDING · awaiting AzuraCast confirmation",
  ON_AIR: "ON AIR",
  OTHER_DJ_LIVE: "LIVE · another DJ",
  FAULT: "TRANSMIT FAULT",
};
