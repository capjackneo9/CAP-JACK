# NCVR architecture

```
 Listeners ──HTTPS──► radio.capriojacksoncoded.si  (Next.js app: public pages + persistent player)
                         │  /api/radio/nowplaying  (server proxy, 8 s cache)
                         ▼
 Studio staff ─HTTPS─► studio.capriojacksoncoded.si (same app, /studio, Auth.js + RBAC)
                         │  server-only API key
                         ▼
                 AzuraCast  (stream.capriojacksoncoded.si)
                 ├─ Liquidsoap AutoDJ — scheduled playlists, fallback rotation
                 ├─ Icecast — /listen/<station>/radio.mp3  ◄── listeners' audio
                 └─ Harbor webcast input (/webdj/<station>/)  ◄── studio transmitter (DJ login)
 Guests ─WebRTC─► LiveKit room ◄─► studio console (guest audio gated OFF the program until the host puts them on air)
 PostgreSQL ── programs, slots, overrides, tracks, submissions, bookings, sponsors, invites, users, audit log
```

## Key decisions
- **The stream is independent of the site.** AzuraCast keeps broadcasting if the app is down or being redeployed.
- **Broadcast-engine adapter.** `src/lib/azuracast/client.ts` exposes a `BroadcastEngine` interface. Screens never call AzuraCast directly, so endpoints, a second station or a different engine can change without UI rewrites. Station-scoped tables carry `stationId` so the network can grow to multiple stations.
- **Local metadata vs. applied state.** Schedule edits are saved in NCVR first. Publishing to AzuraCast is a separate, confirmed step, and each program records `syncState` (`NOT_LINKED` / `PENDING` / `SYNCED` / `FAILED`) so the UI shows what actually reached the engine.
- **168-hour validation.** `src/lib/schedule/coverage.ts` merges slots into week-minute intervals and reports gaps, exclusive-show conflicts and invalid slots. The resolver uses this priority: override → scheduled slot → fallback program (the default Caprio rotation). Station time uses `America/New_York` through `Intl`, so DST is handled correctly.
- **ON AIR truth.** `src/lib/audio/onair.ts` derives the lamp from (a) the webcast socket state and (b) AzuraCast's own `live.is_live` and `streamer_name`. A local mic toggle can never light it.
- **Monitoring vs. transmission.** In `src/lib/audio/engine.ts`, only `programOut` (the master bus) is transmitted. Speaker monitoring and headphone cue (`setSinkId`) are local. The mic is excluded from the speaker monitor by default to prevent feedback.
- **Transmission protocol.** `src/lib/audio/webcaster.ts` encodes the program bus with MediaRecorder (Opus). It sends it over the same WebSocket "webcast" handshake AzuraCast's Web DJ uses (`hello` → binary chunks → `metadata`). DJ credentials are the DJ's own AzuraCast streamer login, kept in browser memory only. The AzuraCast Web DJ link stays available as a fallback.
- **Guests never touch stream credentials.** Guests get a hashed, expiring invite link, then a LiveKit token. Host mute is enforced server-side by LiveKit. Recording is blocked while an on-air guest has not consented.
- **Payments never buy airplay.** Stripe webhooks update `paymentStatus` only. Editorial transitions are a separate state machine (`src/lib/submissions/workflow.ts`) that requires manager permission plus confirmed rights.
- **Uploads.** Files are validated by magic bytes, size-limited, stored outside the web root, and streamed to staff through authenticated routes with HTTP Range support. Only `public-art/` images are publicly served.
