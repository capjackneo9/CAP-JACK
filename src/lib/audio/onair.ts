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
  const { transport, engineLive, engineStreamer, ourStreamer } = params;
  const sameStreamer = Boolean(
    ourStreamer && engineStreamer && engineStreamer.trim().toLowerCase() === ourStreamer.trim().toLowerCase(),
  );
  if (transport === "error") return "FAULT";
  if (transport === "connecting" || transport === "authenticating") return "CONNECTING";
  if (transport === "streaming") return engineLive && (sameStreamer || !engineStreamer) ? "ON_AIR" : "UNCONFIRMED";
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
