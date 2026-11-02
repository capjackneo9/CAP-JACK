/**
 * End-to-end checks against a running NCVR server + the AzuraCast test stub.
 *
 *   node tests/e2e/azuracast-stub.mjs 8099 &
 *   AZURACAST_BASE_URL=http://localhost:8099 AZURACAST_STATION_ID=1 AZURACAST_STATION_SHORTCODE=ncvr \
 *     AZURACAST_API_KEY=stub npm run build && npm start &
 *   node tests/e2e/run.cjs
 *
 * Requires: `playwright` (npm i -D playwright && npx playwright install chromium), ffmpeg,
 * a seeded DB, and users owner@ncvr.local / dj@ncvr.local with password devpassword123
 * (npm run user:create -- --email owner@ncvr.local --name Owner --role OWNER --password devpassword123).
 */
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STUB = process.env.STUB_URL ?? "http://localhost:8099";
const PASS = process.env.E2E_PASSWORD ?? "devpassword123";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ncvr-e2e-"));
const mp3 = path.join(dir, "tone.mp3");
const fake = path.join(dir, "fake.mp3");
execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-ac", "2", "-b:a", "128k", mp3, "-y"]);
fs.writeFileSync(fake, "<?php not audio ?>");

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++; };

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const login = async (email) => {
    const c = await browser.newContext({ permissions: ["microphone"] }); const pg = await c.newPage();
    await pg.goto(BASE + "/login"); await pg.fill("#email", email); await pg.fill("#password", PASS);
    await pg.click('button:has-text("Enter studio")'); await pg.waitForURL(BASE + "/studio"); return pg;
  };

  // Public pages
  const p = await (await browser.newContext()).newPage();
  for (const r of ["/radio", "/radio/listen", "/radio/schedule", "/radio/shows", "/radio/djs", "/radio/artists", "/radio/submit", "/radio/interviews", "/radio/advertise", "/radio/about", "/radio/contact"]) {
    const res = await p.goto(BASE + r); check(`renders ${r}`, res.status() === 200);
  }
  // Player + real stream
  await p.goto(BASE + "/radio/listen");
  await p.waitForSelector("text=Stub Tone 440Hz", { timeout: 20000 }).then(() => check("now playing shows API data", true), () => check("now playing shows API data", false));
  await p.click('button[aria-label="Play live stream"] >> nth=0');
  const live = await p.waitForSelector('[aria-live=polite]:has-text("Live")', { timeout: 15000 }).then(() => true, () => false);
  check("stream plays after user gesture", live);
  await p.click('nav[aria-label=Main] a:has-text("Schedule")'); await p.waitForURL(BASE + "/radio/schedule"); await p.waitForTimeout(2000);
  check("player persists across navigation", (await p.textContent('[role=region][aria-label="Live radio player"] [aria-live=polite]')).includes("Live"));

  // Submission validation
  await p.goto(BASE + "/radio/submit");
  const fill = async (f) => { await p.fill("#artistName", "E2E Artist"); await p.fill("#email", "e2e@example.com"); await p.fill("#songTitle", "E2E Song"); await p.fill("#genre", "VIBE");
    await p.fill("#bio", "Automated end-to-end test submission biography text."); await p.check("input[name=aiGenerated][value=yes]");
    await p.check("input[name=commercialRights]"); await p.check("input[name=broadcastPermission]"); await p.setInputFiles("#audio", f); };
  await fill(fake); await p.click('button:has-text("Submit for review")');
  const alertText = await p.waitForSelector("form [role=alert]").then((e) => e.textContent());
  check("disguised upload rejected", alertText.includes("Unsupported"), alertText);
  await fill(mp3); await p.click('button:has-text("Submit for review")');
  check("valid submission accepted", await p.waitForSelector("text=Received").then(() => true, () => false));

  // Authorization
  const unauth = await fetch(BASE + "/api/studio/schedule"); check("studio API requires sign-in", unauth.status === 401);
  const dj = await login("dj@ncvr.local");
  await dj.goto(BASE + "/studio/settings"); check("DJ blocked from settings", dj.url().includes("denied="));
  const pub = await dj.evaluate(() => fetch("/api/studio/schedule/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "PUBLISH SCHEDULE" }) }).then((r) => r.status));
  check("DJ cannot publish schedule", pub === 403);
  const force = await dj.evaluate(() => fetch("/api/studio/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "return-to-autodj", confirm: "RETURN TO AUTODJ" }) }).then((r) => r.status));
  check("DJ cannot force AutoDJ", force === 403);

  // Broadcast + ON AIR truth
  await dj.goto(BASE + "/studio/console"); await dj.click("text=Power on console"); await dj.waitForSelector("text=DECK A");
  await dj.click('button:has-text("Enable mic")'); await dj.waitForTimeout(400); await dj.click('button:has-text("MIC OFF")');
  await dj.setInputFiles('[aria-label="DECK A"] input[type=file]', mp3); await dj.waitForTimeout(1200);
  await dj.click('[aria-label="DECK A"] button:has-text("Play")');
  const lamp = () => dj.textContent("[aria-label=Transmitter] [role=status]");
  check("lamp OFF AIR while mic open but not transmitting", (await lamp()).includes("OFF AIR"));
  const goLive = async (pw) => { await dj.fill("[aria-label=Transmitter] input >> nth=1", "caprio"); await dj.fill("[aria-label=Transmitter] input[type=password]", pw);
    await dj.click('button:has-text("Go live")'); await dj.fill("#confirm-phrase", "GO LIVE"); await dj.click('[role=dialog] button:has-text("Confirm")'); };
  await goLive("wrong"); await dj.waitForTimeout(3500);
  check("bad DJ credentials → FAULT, not ON AIR", (await lamp()).includes("FAULT"));
  await goLive("test-pass");
  const onAir = await dj.waitForFunction(() => { const t = document.querySelector("[aria-label=Transmitter] [role=status]").textContent; return t.includes("ON AIR") && !t.includes("OFF"); }, null, { timeout: 20000 }).then(() => true, () => false);
  check("ON AIR only after engine confirms live source", onAir);
  const st = await (await fetch(STUB + "/__state")).json();
  check("program audio reached the broadcast input", st.bytes > 0, `${st.bytes} bytes`);
  await dj.click('button:has-text("End broadcast")'); await dj.waitForTimeout(6000);
  check("ending broadcast returns to AutoDJ", (await lamp()).includes("OFF AIR"));

  // Manager review workflow
  const ow = await login("owner@ncvr.local");
  await ow.goto(BASE + "/studio/submissions?status=SUBMITTED");
  await ow.click('button:has-text("→ Under review") >> nth=0'); await ow.waitForTimeout(800);
  await ow.goto(BASE + "/studio/submissions?status=UNDER_REVIEW");
  await ow.click('button:has-text("→ Approved") >> nth=0'); await ow.waitForTimeout(800);
  await ow.goto(BASE + "/studio/library?");
  check("approved submission lands in library as approved", (await ow.textContent("tbody")).includes("APPROVED"));

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
