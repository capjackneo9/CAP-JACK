# NCVR — Nite Cap Vibe Radio

**After Dark. Beyond Sound. Into the Vibe.**

A 24/7 Afro-futuristic internet radio platform for the Caprio Jackson brand. It has two connected parts:

1. **Public station website** (`/radio/*`): a persistent live player, Now Playing, a weekly schedule, shows, DJs, artists, music submissions, interview bookings, advertising and about/contact pages.
2. **Private broadcast studio** (`/studio/*`, also served on `studio.<domain>`): a Web Audio mixing console with an authenticated live transmitter, a drag-and-drop 24/7 scheduler, the music library and approvals, the submission review queue, bookings and sponsors, WebRTC guest rooms, rotation reporting, users/roles and an audit log.

**AzuraCast** (Liquidsoap + Icecast) is the broadcast engine. NCVR wraps it with a custom-branded frontend and management layer. The radio stream runs independently of this app, so redeploying the website never interrupts the broadcast.

> Status, verification results and what still needs credentials: **[docs/STATUS.md](docs/STATUS.md)**
> Deploying to the Hostinger VPS: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**
> How it fits together: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## Stack
Next.js 15 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · PostgreSQL + Prisma 6 · Auth.js v5 (credentials, JWT) · Web Audio API · LiveKit (WebRTC guests) · Stripe (optional) · Vitest · Docker Compose + Caddy.

## Quick start (development)
```bash
cp .env.example .env              # set DATABASE_URL and AUTH_SECRET at minimum
npm install
npx prisma migrate deploy
npm run db:seed                   # station, 22 launch programs (168 h), products
npm run user:create -- --email you@example.com --name "Caprio Jackson" --role OWNER
npm run dev                       # http://localhost:3000/radio  ·  /login → studio
```
Without AzuraCast configured, the site runs and says plainly that the stream is not connected. It never shows invented track titles or listener counts.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / start |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests: schedule coverage, RBAC, player state, workflows, ON-AIR logic, upload validation, Now Playing normalization |
| `npm run test:e2e` | Browser end-to-end checks against a running server + the AzuraCast **test stub** (see `tests/e2e/run.cjs`) |
| `npm run stub:azuracast` | Starts the local AzuraCast/Liquidsoap **test stub**. For testing only, never production. |
| `npm run db:seed` | Seeds the station and launch schedule. Never overwrites studio edits. |
| `npm run user:create` | Creates or updates a staff user (prints a one-time password) |
| `npm run schedule:check` | Validates the database schedule covers all 168 hours with no conflicts |

## Brand assets
Put the original artwork in `public/brand/` (see `public/brand/README.md`): `caprio-marble.jpg` (marble portrait) and `caprio-banner.jpg` (editorial banner). Replace `ncvr-logo.svg` with the final logo when you have it. Until the files are added, pages show a labelled "artwork pending" frame, never a substitute face.

## Configuration
Every external dependency is optional and set by environment variable. See `.env.example` for the exact variables. The studio dashboard shows which integrations are configured.
