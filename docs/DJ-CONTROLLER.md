# Going live with a DJ controller (e.g. Numark Party Mix)

## Option 1 — Controller → NCVR broadcast console (in the browser)
Works in **Chrome or Edge on a computer** (Web MIDI). Safari and phones are not supported.

1. Plug the controller in by USB **before** opening the console, and **fully quit Serato DJ Lite / VirtualDJ / Rekordbox /
   Mixxx** (system tray too). On Windows only one program can use a controller; if another app holds it the console shows a red warning.
2. Studio → **Broadcast console** → **Power on console** → **Connect controller** (allow MIDI if the browser asks).
3. **Numark Party Mix / Party Mix II:** the console loads the Party Mix map by itself the first time it sees the controller
   (or click **Map controls → Load Numark Party Mix / Party Mix II map**). If any control doesn't respond, click
   **Map controls → Guided setup (1 minute)**: the console names each control in turn (“Move the LEFT volume fader”) and
   learns it as you touch it — this always matches your exact unit. What each control does:

   | Party Mix | Console |
   |---|---|
   | Play / Cue (each deck) | Play-pause / back to start |
   | Jog wheel | Scratch (SCRATCH mode) or nudge (NUDGE mode) |
   | Scratch button | Switch the deck between SCRATCH and NUDGE |
   | Headphone (PFL) button | Headphone cue for that deck |
   | Volume fader | Channel volume |
   | Gain, Treble, Bass knobs | Trim, EQ high, EQ low |
   | Pitch fader | Tempo ±8% (tick *Reverse pitch faders* if it moves the wrong way) |
   | Crossfader | Crossfader |
   | Master knob | Master volume (transmitted) |
   | Headphone volume knob | Headphone volume |
   | Load buttons | Load next queued track onto that deck |
   | 4 pads, left deck / right deck | Console pads 1–4 / 5–8 |

   Sync, browse and the pad-mode buttons have no console function. The ready-made map comes from the community Mixxx
   mapping for the original Party Mix (there is no published Party Mix II map), so the Guided setup is the sure way on a Party Mix II.
   Any other controller: click **Learn** next to each console control, then move/press it on the controller.
4. Click **Save** on the Presets bar so the mapping comes back every time (★ Load on startup).
5. **Headphones:** in the console's *Headphone cue output*, choose the Party Mix audio device, plug headphones
   into the controller, and press each deck's PFL/Cue button to preview. (Chrome/Edge support this.)
6. Enter your DJ username/password in the transmitter and press **Go live**.

**Nothing happens when you press Learn?** Open **MIDI monitor** on the controller bar and press a button. If no lines appear,
Chrome isn't receiving the controller: quit the other DJ apps, check padlock → Site settings → *MIDI devices: Allow*,
re-plug the USB cable and press **Reconnect**. If lines appear but Learn doesn't take, the yellow hint under “Listening…”
says which kind of control it expected.

**Scratching:** each deck has a **SCRATCH / NUDGE** switch. In SCRATCH, touching the jog-wheel top holds the record and turning
it scratches forwards and backwards; let go and the track carries on. (Without the touch control mapped, any jog turn scratches.)
You can also drag the on-screen record with the mouse. In NUDGE, turning while playing briefly speeds up / slows down the track
for beat-matching. Scratch works once a track has finished *Loading & analysing*.

## Option 2 — Mixxx (free desktop DJ software) → AzuraCast directly
Mixxx supports the Numark Party Mix out of the box and can broadcast to the station itself.

1. Install Mixxx from mixxx.org. Preferences → **Controllers** → select the Party Mix → load the *Numark Party Mix* mapping.
2. Preferences → **Live Broadcasting** → add a connection:
   | Field | Value |
   |---|---|
   | Type | Icecast 2 |
   | Host | `stream.nitecapviberadio.tech` |
   | Port | `8005` |
   | Mount | `/` |
   | Login | your DJ username (e.g. `caprio`) |
   | Password | your DJ password |
   | Format | MP3, 128–192 kbps, stereo |
3. Click **Enable Live Broadcasting** (the antenna button in Mixxx). AzuraCast switches from AutoDJ to you;
   NCVR shows **LIVE DJ** on the website. Stop broadcasting to hand back to AutoDJ.

Serato DJ Lite (bundled with many Party Mix units) cannot broadcast on its own — use Mixxx, or Option 1.
