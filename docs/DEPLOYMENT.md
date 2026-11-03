# Deploying NCVR on the Hostinger VPS

**Server:** `srv2118691.hstgr.cloud` · Hostinger **KVM 4** (4 vCPU, 16 GB RAM, 200 GB NVMe). That comfortably exceeds AzuraCast's recommended 4 vCPU / 4 GB / 40 GB, so AzuraCast and the NCVR app can share this VPS.

> ⚠️ Reinstalling the VPS operating system erases everything on it. Take a Hostinger snapshot/backup before changing the OS or application template.
> The existing capriojacksoncoded.si website is **not** modified by anything here.

## 0. DNS (domain: nitecapviberadio.tech, managed in Hostinger)
hPanel → **Domains** → **nitecapviberadio.tech** → **DNS / Nameservers**. Point these records at the VPS IPv4 address (hPanel → VPS → Overview):

| Type | Name | Points to | Purpose |
|---|---|---|---|
| **A** | `@` | VPS IP | Public NCVR site (`https://nitecapviberadio.tech`) — *edit the existing `@` record if one exists* |
| **CNAME** | `www` | `nitecapviberadio.tech` | Redirects to the main address — *edit the existing `www` record if one exists* |
| **A** | `studio` | VPS IP | Private studio |
| **A** | `stream` | VPS IP | AzuraCast (admin, API, `/listen` streams, `/webdj`) |
| **A** | `livekit` *(optional)* | VPS IP | Guest rooms |

Remove any old parking/website-builder `A` or `AAAA` records on `@` / `www` that point elsewhere, or browsers may land on the wrong server.

## 1. AzuraCast (launch this first — get the 24/7 stream running)
**Option A (recommended):** hPanel → VPS → Manage → OS & Panel → Operating System → **Application** → *Ubuntu 24.04 with AzuraCast*.
**Option B:** a fresh *Ubuntu 24.04* (Plain OS), then the official installer:
```bash
mkdir -p /var/azuracast && cd /var/azuracast
curl -fsSL https://raw.githubusercontent.com/AzuraCast/AzuraCast/main/docker.sh > docker.sh
chmod a+x docker.sh && ./docker.sh install
```
Then, in the AzuraCast web UI:
1. Create the station **Nite Cap Vibe Radio**, short name **`ncvr`**, timezone **America/New_York**.
2. Upload the Caprio Jackson catalog. Create a **General Rotation** playlist named *Caprio Radio Rotation* (the always-on fallback), plus one playlist per scheduled program you want automated.
3. Station → *Profile* → enable **Streamers/DJs**. Create a streamer account for each DJ (username + password). These are the credentials DJs type into the NCVR console.
4. System → Settings → set **Base URL** to `https://stream.nitecapviberadio.tech` and enable **Use Web Proxy for Radio**. This makes `/listen/…` and `/webdj/…` work over HTTPS on port 443.
5. My Account → **API Keys** → create a key for NCVR. Keep it secret; it goes only in the server `.env`.
6. Confirm the stream plays at `https://stream.nitecapviberadio.tech/listen/ncvr/radio.mp3` before going further.

### Free ports 80/443 for the shared reverse proxy
AzuraCast binds 80/443 by default. To share the VPS, move it to internal ports and let Caddy front everything. In `/var/azuracast/.env`:
```
AZURACAST_HTTP_PORT=8080
AZURACAST_HTTPS_PORT=8443
```
Then:
```bash
cd /var/azuracast && docker compose down && docker compose up -d
```
*(If you'd rather not move AzuraCast, host the NCVR app on another server and point `radio`/`studio` there instead.)*

## 2. Caddy (HTTPS for all subdomains)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
cp deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy
```

## 3. NCVR app
```bash
apt install -y git && git clone <this repo> /opt/ncvr && cd /opt/ncvr
cp .env.example .env && nano .env      # fill the values below
docker compose up -d --build
```
Seed the station and create the owner account (one time):
```bash
docker compose run --rm tools npm run db:seed
docker compose run --rm tools npm run user:create -- --email YOU@EXAMPLE.COM --name "Caprio Jackson" --role OWNER
docker compose run --rm tools npm run schedule:check
```
The owner password is printed once. Sign in at `https://studio.nitecapviberadio.tech`.

### Required `.env` values
| Variable | Value |
|---|---|
| `APP_URL` | `https://nitecapviberadio.tech` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | a strong random password |
| `AZURACAST_BASE_URL` | `https://stream.nitecapviberadio.tech` |
| `AZURACAST_STATION_ID` | `ncvr` (or the numeric id) |
| `AZURACAST_STATION_SHORTCODE` | `ncvr` |
| `AZURACAST_API_KEY` | key from step 1.5 |
| `NEXT_PUBLIC_STREAM_URL` | `https://stream.nitecapviberadio.tech/listen/ncvr/radio.mp3` *(optional — otherwise taken from AzuraCast)* |
| `NEXT_PUBLIC_WEBCAST_URL` | `wss://stream.nitecapviberadio.tech/webdj/ncvr/` |
| `LIVEKIT_*`, `STRIPE_*` | optional — see below |

`NEXT_PUBLIC_*` values are compiled in, so rebuild after changing them: `docker compose up -d --build app`.

## 4. Link from capriojacksoncoded.si (optional)
NCVR lives on its own domain, so the main Caprio Jackson site needs no changes. To keep `capriojacksoncoded.si/radio` working as a shortcut, add a redirect from `/radio` to `https://nitecapviberadio.tech` on whoever hosts that site.

## 5. Optional services
- **Guest rooms (LiveKit):** generate keys with `docker run --rm livekit/livekit-server generate-keys`, put them in `deploy/livekit.yaml` and `.env` (`LIVEKIT_URL=wss://livekit.nitecapviberadio.tech`), uncomment the `livekit` block in the Caddyfile, open **TCP 7881** and **UDP 50000–50200** in the Hostinger firewall, then run `docker compose --profile guests up -d`.
- **Payments (Stripe):** set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Add a webhook endpoint `https://nitecapviberadio.tech/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`.

## 5b. NCVR TV live video (optional)
The music-video rotation works with no extra setup — upload videos in **Studio → NCVR TV**. Live camera video needs MediaMTX:
```bash
cd /opt/ncvr && cp deploy/mediamtx.yml.example deploy/mediamtx.yml
LIVEPASS=$(openssl rand -hex 12) && sed -i "s/CHANGE_ME_LIVE_PASSWORD/$LIVEPASS/" deploy/mediamtx.yml && echo "Your OBS live password: $LIVEPASS"
grep -q '^MEDIAMTX_API_URL=' .env && sed -i 's|^MEDIAMTX_API_URL=.*|MEDIAMTX_API_URL=http://mediamtx:9997|' .env || echo 'MEDIAMTX_API_URL=http://mediamtx:9997' >> .env
grep -q '^LIVE_RTMP_URL=' .env || echo 'LIVE_RTMP_URL=rtmp://stream.nitecapviberadio.tech:1935' >> .env
docker compose --profile tv up -d && docker compose up -d --force-recreate app
```
Then update Caddy with the `handle_path /live-hls/*` block from `deploy/Caddyfile` and `systemctl reload caddy`.
Keep TCP **1935** open in the Hostinger firewall.

**OBS:** Settings → Stream → Service *Custom* · Server `rtmp://stream.nitecapviberadio.tech:1935` · Stream key `live?user=ncvr&pass=YOUR-LIVE-PASSWORD`.
Recommended output: 1280×720 or 1920×1080, 30 fps, x264, 2500–4500 kbps, keyframe interval 2 s, AAC 160 kbps.
NCVR TV switches to the live feed within ~20 s and back to the rotation when you stop.

## 6. Go-live checklist
- [ ] Stream plays from the public player; Now Playing shows real track data
- [ ] `npm run schedule:check` passes (168/168 h); link programs to playlists in the studio scheduler, then **Publish to AzuraCast** and confirm each shows SYNCED
- [ ] Studio console: a DJ test login reaches **ON AIR** only after AzuraCast reports the DJ live; ending returns to AutoDJ
- [ ] Hostinger firewall: 80/443 open (plus LiveKit ports if used); 5432 and 3000 **not** public
- [ ] Backups: Hostinger snapshots + `docker compose exec db pg_dump -U ncvr ncvr > backup.sql` + the `uploads` volume + AzuraCast's own backup tool
- [ ] Music licensing: confirm performance-royalty obligations for internet broadcast in your jurisdiction (separate from owning the recordings), and review AI-tool commercial terms for submitted music
