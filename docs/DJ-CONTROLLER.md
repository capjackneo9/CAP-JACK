# Going live with a DJ controller (e.g. Numark Party Mix)

## Option 1 — Controller → NCVR broadcast console (in the browser)
Works in **Chrome or Edge on a computer** (Web MIDI). Safari and phones are not supported.

1. Plug the controller in by USB **before** opening the console, and **fully quit Serato DJ Lite / VirtualDJ / Rekordbox /
   Mixxx** (system tray too). On Windows only one program can use a controller; if another app holds it the console shows a red warning.
2. Studio → **Broadcast console** → **Power on console** → **Connect controller** (allow MIDI if the browser asks).
3. Click **Map controls (MIDI Learn)**. For each control: click **Learn**, then move/press it on the controller.
   Suggested Party Mix layout: crossfader → Crossfader · each deck's Play/Cue buttons → Play / Cue ·
   jog wheels → *Jog wheel (turn)* (turn by the outer edge) and *Jog wheel top (touch = scratch)* (rest your hand on top) · volume faders → Channel volume · Treble/Bass knobs → EQ high / EQ low ·
   Filter knob → Filter · Pad buttons → Pads 1–8 · Load buttons → Load next queued track.
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
