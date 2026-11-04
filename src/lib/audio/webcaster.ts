"use client";
import type { TransportState } from "./onair";

/**
 * Transmits the studio program bus to AzuraCast's Liquidsoap harbor using the
 * same WebSocket "webcast" protocol as AzuraCast's built-in Web DJ:
 *   1. open wss://<azuracast>/webdj/<station>/ with sub-protocol "webcast"
 *   2. send {type:"hello", data:{mime, user, password}}
 *   3. stream encoded chunks from MediaRecorder; optional {type:"metadata"}
 * Credentials are the DJ's own AzuraCast streamer (DJ) account; they are kept
 * in memory only and never sent to the NCVR server.
 *
 * Verify against your AzuraCast version on staging before going live; if the
 * handshake differs, use the AzuraCast Web DJ fallback in the console.
 */
/** MediaRecorder chunk size for the live webcast. */
export const WEBCAST_TIMESLICE_MS = 100;

export class Webcaster {
  private ws: WebSocket | null = null;
  private rec: MediaRecorder | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  state: TransportState = "disconnected";
  lastError: string | null = null;
  bytesSent = 0;

  constructor(private onChange: (s: TransportState, err: string | null) => void) {}

  static supportedMime(): string | null {
    const opts = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
    if (typeof MediaRecorder === "undefined") return null;
    return opts.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
  }

  private set(s: TransportState, err: string | null = null) {
    this.state = s;
    this.lastError = err;
    this.onChange(s, err);
  }

  connect(url: string, user: string, password: string, stream: MediaStream, bitrate = 128000) {
    if (this.ws) this.disconnect();
    const mime = Webcaster.supportedMime();
    if (!mime) return this.set("error", "This browser can't broadcast audio (no Opus encoder). Use Chrome or Edge on a computer — Safari/iPhone/iPad are not supported for going live.");
    if (!/^wss?:\/\//.test(url)) return this.set("error", "Webcast URL must start with wss://");
    this.set("connecting");
    this.bytesSent = 0;
    let ws: WebSocket;
    try { ws = new WebSocket(url, "webcast"); } catch (e) { return this.set("error", (e as Error).message); }
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      this.set("authenticating");
      ws.send(JSON.stringify({ type: "hello", data: { mime, user, password } }));
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: bitrate });
      this.rec = rec;
      // Blobs are sent as-is so chunks always leave in order.
      rec.ondataavailable = (e) => {
        if (e.data.size && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
          this.bytesSent += e.data.size;
        }
      };
      // Small, steady chunks (like AzuraCast's own Web DJ) keep the station's DJ buffer
      // evenly fed — 1-second bursts caused audible choppiness for listeners.
      rec.start(WEBCAST_TIMESLICE_MS);
      // Liquidsoap closes the socket on rejected credentials; surviving this window means accepted.
      this.confirmTimer = setTimeout(() => { if (ws.readyState === WebSocket.OPEN) this.set("streaming"); }, 2500);
    };
    ws.onerror = () => this.set("error", this.state === "connecting"
      ? "Couldn't reach the DJ input. Check the Webcast URL (wss://stream.nitecapviberadio.tech/webdj/ncvr/) and that AzuraCast's “Use Web Proxy for Radio” is on."
      : "Webcast connection error");
    ws.onclose = (ev) => {
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
      if (this.rec && this.rec.state !== "inactive") this.rec.stop();
      this.rec = null;
      this.ws = null;
      if (this.state === "authenticating") this.set("error", `The station refused the DJ login (code ${ev.code}). Check the DJ username/password (the AzuraCast streamer account, not your website login), that the account is active, and that "Enforce schedule" is off for that DJ.`);
      else if (this.state !== "disconnected" && this.state !== "error") this.set(ev.wasClean ? "disconnected" : "error", ev.wasClean ? null : `Connection lost (code ${ev.code})`);
    };
  }

  sendMetadata(title: string, artist: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "metadata", data: { title, artist } }));
  }

  /** Stop transmitting. AzuraCast automatically returns to AutoDJ. */
  disconnect() {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    try { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); } catch { /* ignore */ }
    this.rec = null;
    const ws = this.ws;
    this.ws = null;
    this.set("disconnected");
    ws?.close(1000, "DJ ended broadcast");
  }
}

export class ProgramRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  startedAt: number | null = null;
  start(stream: MediaStream) {
    const mime = Webcaster.supportedMime() ?? "";
    this.chunks = [];
    this.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(1000);
    this.startedAt = Date.now();
  }
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(new Blob());
      this.rec.onstop = () => resolve(new Blob(this.chunks, { type: this.rec?.mimeType || "audio/webm" }));
      this.rec.stop();
      this.startedAt = null;
    });
  }
  get recording() { return this.rec?.state === "recording"; }
}
