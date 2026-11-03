# NCVR build status

_Last verified: 2026-11-02 in a development container (PostgreSQL 16, Chromium via Playwright)._

## Verification results
| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run typecheck` | ✅ clean |
| `npm test` (Vitest, 42 tests) | ✅ all pass: schedule coverage (168 h), conflicts, gaps, fallback, DST, RBAC matrix, player state machine, submission workflow, rotation report, ON-AIR truth table, upload magic-byte validation, invite tokens, Now Playing normalization |
| `npm run build` | ✅ production build (standalone output) |
| `npm run schedule:check` on the seeded DB | ✅ 168/168 hours, 0 gaps, 0 conflicts |
| `npm run test:e2e` (26 browser checks) | ✅ all pass, run against the **AzuraCast test stub** (below) |
| Docker image runtime | ⚠️ Not built here (no Docker daemon in the sandbox). The runtime-stage layout, migrator and entrypoint were reproduced by hand: migrations applied and the standalone server served pages, CSS and assets. Run `docker compose up -d --build` on the VPS to confirm. |

The e2e run covered: all 11 public pages rendering; Now Playing showing API data; a **real MP3 stream playing** after a user gesture and **continuing across page navigation**; disguised uploads rejected; DJ blocked from settings, schedule publishing and force-AutoDJ (403); the studio API returning 401 when signed out; the console transmitting the program bus over the webcast WebSocket; **bad DJ credentials → FAULT**; **ON AIR lit only after the engine reported the DJ live**; ending the broadcast returning to AutoDJ; and submission → review → approval landing in the library.

> **About the test stub.** `tests/e2e/azuracast-stub.mjs` imitates AzuraCast's Now Playing API, an MP3 mount and the Liquidsoap webcast input. It proves NCVR's side of each contract. It is **not** proof of compatibility with your specific AzuraCast version. That must be confirmed on the VPS (see "Needs integration" below).

## ✅ Functional now (no external credentials needed)
- Public site: all 13 routes, persistent player bar, Matrix background (reduced-motion aware), mobile layout without horizontal scroll, keyboard focus styles, skip link
- 24/7 launch schedule (22 programs) seeded in America/New_York; "on now" resolution with overrides and fallback
- Studio sign-in (Auth.js credentials, bcrypt, lockout after 5 failed attempts), role-based navigation, and **server-side permission checks on every studio route**
- Drag-and-drop scheduler with live 168-hour validation; saves are blocked on conflicts or invalid slots; slot inspector for keyboard users; program settings; temporary overrides
- Music library: upload with magic-byte validation, preview (Range streaming), approve/reject/archive; unapproved tracks cannot reach playlists
- Submissions: public form → review queue → approve/reject/schedule/complete with history; approval creates an approved library track; payment never changes editorial state
- Bookings (interviews, ads, sponsorships, showcases, contact), sponsor management with on-air disclosures shown on show pages
- Broadcast console (Web Audio): two decks with waveforms and seek, 3-band EQ, filter sweep, trim and channel faders, equal-power crossfader, PFL cue to a chosen output device (where the browser supports `setSinkId`), master and per-channel meters, mic channel with gain, mute, talk-over ducking, echo and reverb, 8 sound pads (keys 1–8) loaded from library IDs/FX or local files, music queue, local program recording (consent-gated)
- Guest invites: hashed, expiring, revocable links shown once; waiting room with mic check and consent capture
- Rotation goals (75/15/10) with validation; listener-count display toggle; user management (owner only); audit log of approvals, schedule saves/publishes, live actions, role changes and payments

### Added 2026-11-03
- **Console presets:** save and load the whole console setup (pad sound bank, including sounds loaded from your computer, deck EQ and faders, crossfader, master and monitor, mic and FX, queue, DJ connection without the password). One preset per user can load automatically when the console powers on. *Verified in a browser:* save → reload → auto-restore.
- **NCVR TV** (`/radio/tv`): music-video channel where every viewer sees the same video at the same moment, with an 80s-style lower third and channel bug. It switches to a live OBS feed (MediaMTX → HLS) automatically. *Verified:* upload → approve → plays in sync with the channel clock. The live feed path needs MediaMTX on the VPS (not testable here).
- **Join the team** (`/radio/join`): internship application with interest areas and an optional PDF résumé, reviewed under **Studio → Team applications**. *Verified* end to end.
- NCVR TV logo added: TV page header, on-screen channel bug, homepage promo and studio channel manager.

## 🔑 Needs integration credentials or server setup
| Feature | Needs |
|---|---|
| Live stream + Now Playing | `AZURACAST_BASE_URL`, `AZURACAST_STATION_ID` (+ `NEXT_PUBLIC_STREAM_URL` optional) |
| Publish schedule, send tracks to AzuraCast, playlists, engine status, rotation report, force AutoDJ, skip | `AZURACAST_API_KEY` |
| Console **Go live** | AzuraCast streamer accounts and `NEXT_PUBLIC_WEBCAST_URL` (`wss://…/webdj/ncvr/`), with "Use Web Proxy for Radio" enabled |
| NCVR TV live camera feed | MediaMTX (`docker compose --profile tv`), port 1935, `MEDIAMTX_API_URL` |
| Guest rooms | LiveKit server + `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| Paid review / booking payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Brand imagery | `public/brand/caprio-marble.jpg`, `public/brand/caprio-banner.jpg`, final logo (not in the repo yet) |
| Domain | DNS records for nitecapviberadio.tech (`@`, `www`, `studio`, `stream`) pointing to the VPS; optional `/radio` shortcut redirect on capriojacksoncoded.si |

## ⚠️ Must be verified on the real AzuraCast before relying on it
1. **Webcast handshake.** The transmitter follows AzuraCast Web DJ's protocol (`webcast` sub-protocol, `hello` with mime/user/password, Opus chunks). Test a DJ login on staging. If the handshake differs in your AzuraCast version, use the **AzuraCast Web DJ (fallback)** button in the console, which is the supported first-version path.
2. **Admin endpoints** used: `PUT /api/station/{id}/playlist/{pid}` (`schedule_items`), `POST /api/station/{id}/files`, `PUT /api/station/{id}/file/{mid}` (playlists), `POST /api/station/{id}/backend/disconnect`, `POST /api/station/{id}/backend/skip`, `GET /api/station/{id}/history`, `GET /api/station/{id}/status`. Check each once against your version's API docs at `/api` on the AzuraCast host.
3. **Schedule semantics.** Blocks ending at midnight are sent as `end_time: 0` (AzuraCast's overnight wrap). The fallback program's playlist is left **unscheduled** so it works as the general rotation. Overrides are sent as dated schedule items. Confirm playlist priority/weights behave as intended.
4. **Rotation matching.** Play history is matched to library tracks by title + artist. Plays that can't be matched are reported separately, not guessed.

## ⏳ Not yet implemented / known limits
- Rate limiting and the login lockout are in-memory per process. Add a proxy-level limiter (or Redis) if you run more than one app instance.
- No email notifications yet (submission status changes, booking replies). Staff see everything in the studio.
- Guest talkback sends the host's raw mic to the guest. A full mix-minus (music + other guests) is not yet built.
- Program recordings download in the browser. They are not uploaded to server storage.
- A real-time push channel for Now Playing (AzuraCast SSE/Centrifugo) isn't wired yet. The player polls every 15 s through the cached server proxy.
- Artist/host profile editing has no UI yet (seeded Caprio profiles exist; edit through Prisma Studio: `npm run db:studio`).
- Multi-station: the schema is station-scoped, but the UI targets the single `ncvr` station.
