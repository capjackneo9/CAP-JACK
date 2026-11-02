/**
 * TEST HARNESS ONLY — never point production at this.
 * Mimics the slice of AzuraCast that NCVR talks to:
 *   GET  /api/nowplaying/:id           (AzuraCast Now Playing shape)
 *   GET  /listen/ncvr/radio.mp3        (real MP3 audio, encoded live by ffmpeg)
 *   WS   /webdj/ncvr/  (protocol "webcast") — accepts DJ "hello" + audio chunks,
 *        then reports live.is_live=true in Now Playing, like Liquidsoap harbor.
 * Usage: node tests/e2e/azuracast-stub.mjs [port]
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

const port = Number(process.argv[2] ?? 8099);
const state = { live: null, chunks: 0, bytes: 0, metadata: null };
const DJ = { user: "caprio", password: "test-pass" };

const np = () => ({
  station: { id: 1, name: "NCVR (test stub)", shortcode: "ncvr", listen_url: `http://localhost:${port}/listen/ncvr/radio.mp3`, mounts: [] },
  listeners: { total: 3, unique: 3, current: 3 },
  live: { is_live: Boolean(state.live), streamer_name: state.live ?? "", broadcast_start: state.live ? Math.floor(Date.now() / 1000) : null },
  now_playing: { sh_id: 1, played_at: Math.floor(Date.now() / 1000) - 30, duration: 240, elapsed: 30, remaining: 210, playlist: "Caprio Radio Rotation",
    song: { id: "x", text: "Stub Artist - Stub Tone", artist: state.metadata?.artist || "Stub Artist", title: state.metadata?.title || "Stub Tone 440Hz", art: "" } },
  playing_next: { duration: 200, song: { id: "y", text: "", artist: "Next Artist", title: "Next Tone" } },
  song_history: [{ sh_id: 0, played_at: Math.floor(Date.now() / 1000) - 300, duration: 270, song: { id: "z", text: "", artist: "Earlier Artist", title: "Earlier Tone", art: "" } }],
  is_online: true,
});

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/nowplaying/")) { res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); return res.end(JSON.stringify(np())); }
  if (req.url?.startsWith("/listen/ncvr/radio.mp3")) {
    res.writeHead(200, { "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" });
    const ff = spawn("ffmpeg", ["-loglevel", "error", "-re", "-f", "lavfi", "-i", "sine=frequency=440", "-ac", "2", "-b:a", "128k", "-f", "mp3", "pipe:1"]);
    ff.stdout.pipe(res);
    req.on("close", () => ff.kill("SIGKILL"));
    return;
  }
  if (req.url === "/__state") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(state)); }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, path: "/webdj/ncvr/", handleProtocols: (p) => (p.has("webcast") ? "webcast" : false) });
wss.on("connection", (ws) => {
  let authed = false;
  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const msg = JSON.parse(data.toString());
      if (msg.type === "hello") {
        if (msg.data.user !== DJ.user || msg.data.password !== DJ.password) return ws.close(4001, "auth failed");
        authed = true;
        // Liquidsoap switches to the live source after receiving audio; emulate a short delay.
        setTimeout(() => { if (authed) state.live = msg.data.user; }, 1500);
      }
      if (msg.type === "metadata") state.metadata = msg.data;
      return;
    }
    if (!authed) return ws.close(4002, "no hello");
    state.chunks++; state.bytes += data.length;
  });
  ws.on("close", () => { authed = false; state.live = null; });
});

server.listen(port, () => console.log(`azuracast stub on :${port}`));
