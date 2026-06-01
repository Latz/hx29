# HX29 Effects Reference

This file documents all configurable effects for use when building an options/settings page.

---

## Idle Sequences

Triggered after a configurable period of inactivity. One sequence plays per idle event, never repeating the same one twice in a row. Timer only restarts after the user submits a command.

**Current settings:**
- Idle timeout: `5 * 60 * 1000` ms (5 minutes) — `src/index.js`, `IDLE_MS`
- Loader array: `SEQUENCE_LOADERS` — `src/index.js`

| ID | File | Name | Description |
|---|---|---|---|
| 0 | `src/idle/neonFlicker.js` | Neon Flicker | Sign text flickers between clean and corrupted frames |
| 1 | `src/idle/vortex.js` | Network Vortex | ASCII vortex spins until keypress collapses it |
| 2 | `src/idle/bufferMelt.js` | Buffer Melt | Status line erodes into block glyphs character by character |
| 3 | `src/idle/cyberdeck.js` | Cyberdeck Heartbeat | Core temp pulses 60→84% in a wave, separator line alternates |
| 4 | `src/idle/overheat.js` | Overheat | Thermal alert with jittering temp readout and cycling voltage bar |
| 5 | `src/idle/gridGlitch.js` | Grid Glitch | Hex values swap, ticker scrolls, glitch codes morph |
| 6 | `src/idle/synapseDesync.js` | Synapse Desync | Sync-rate counts down, bracket jitters left/right, clears at 0% |
| 7 | `src/idle/memoryLeak.js` | Memory Leak | Files shredded right-to-left with `#` chars, progress bar fills |

**Options page controls needed:**
- Enable/disable individual sequences (checkbox per sequence)
- Idle timeout duration (number input, minutes)
- Enable/disable idle sequences entirely (master toggle)

---

## Returning Visitor Intro Sequences

Stored in `src/returning.json`. Stage advances only after a 1-hour gap between visits. Session data in `localStorage`.

| localStorage key | Purpose |
|---|---|
| `hx29_sig` | Permanent random ID, e.g. `SIG-8942` |
| `hx29_visits` | Visit counter |
| `hx29_last_visit` | ISO timestamp of last visit |

| Stage | Condition | Prompt | Tone |
|---|---|---|---|
| 1 | First visit | `guest@aeon-gateway:~$` | Unknown anomaly — profiling |
| 2 | 2nd visit (1h+ gap) | `intruder@aeon-gateway:#` | Recognized — monitored |
| 3 | 3rd visit (1h+ gap) | `anon@apex-mainframe:#` | Persistent threat actor |
| 4+ | 4th+ visit (1h+ gap) | `operator@aeon-core:#` | Trusted operator |

**Code location:** `src/intros.js` → `getSessionIntro()`, `loadSession()`

**Options page controls needed:**
- Enable/disable returning visitor intros (toggle) — falls back to standard random intro
- Minimum gap between stage advances (number input, hours) — currently hardcoded `3600_000` ms in `src/intros.js`
- Reset visitor session button (clears `localStorage`)

---

## Standard Intro Sequences

Stored in `src/intro.json`. Three sequences chosen at random on first visit.

| Index | Name | Description |
|---|---|---|
| 0 | Mainframe | Hayes modem dial-up + IBM MVS/XA logon |
| 1 | DoD Intrusion | Project Dark Matter hack sequence |
| 2 | RobCo Termlink | Fallout-style terminal login |

**Options page controls needed:**
- Enable/disable individual intros (checkboxes)
- Enable/disable intro entirely (skip straight to prompt)

---

## Hardware Simulation Effects

### 1. Baud-Rate Stutter

Simulates line noise on a 1200 baud modem connection. Mid-word characters have a random chance of triggering a transmission freeze.

**Code location:** `handleInput` → `charDelay()` — `src/index.js`

| Parameter | Current value | Code location |
|---|---|---|
| Base char delay | `6 + Math.random() * 4` ms | `charDelay()` |
| Freeze probability | `0.02` (2%) | `charDelay()` |
| Freeze duration | `100 + Math.random() * 150` ms (100–250ms) | `charDelay()` |

**Options page controls needed:**
- Enable/disable (toggle)
- Freeze probability (slider, 0–10%)
- Freeze duration range (min/max ms)

---

### 2. Key-Bounce

Simulates dirty mechanical switch contacts registering a keystroke twice. Auto-corrects after a short delay.

**Code location:** `onKeyDown` handler — `src/index.js`

| Parameter | Current value | Code location |
|---|---|---|
| Bounce probability | `0.005` (0.5%) | `Math.random() < 0.005` |
| Auto-correct delay | `120` ms | `setTimeout(..., 120)` |
| Notice display duration | `320` ms | `setTimeout(() => notice.remove(), 320)` |

**Options page controls needed:**
- Enable/disable (toggle)
- Bounce probability (slider, 0–5%)

---

### 3. Horizontal Sync Tear

Simulates flyback transformer voltage fluctuation causing a horizontal sync slip. Briefly skews and clips a rendered line.

**Code location:** `maybeSyncTear()` — `src/index.js`  
**CSS:** `.sync-tear` keyframe — `style.css`

| Parameter | Current value | Code location |
|---|---|---|
| Trigger probability | `0.03` (3%) per output line | `maybeSyncTear()` |
| Animation duration | `40 + Math.random() * 40` ms (40–80ms) | `maybeSyncTear()` |
| Skew amount | `skewX(12deg)` / `skewX(-8deg)` | `.sync-tear` keyframe |

**Options page controls needed:**
- Enable/disable (toggle)
- Trigger probability (slider, 0–10%)

---

### 4. Scroll Voltage Drop

Simulates the current spike from the flyback transformer repositioning the electron beam when the screen scrolls.

**Code location:** `scrollTerminal()` — `src/index.js`

| Parameter | Current value | Code location |
|---|---|---|
| Minimum opacity | `0.94` | `wrapper.style.opacity = "0.94"` |
| Drop duration | `50` ms | `transition: "opacity 50ms linear"` |
| Recovery duration | `120` ms | `transition: "opacity 120ms ease-out"` |

**Options page controls needed:**
- Enable/disable (toggle)
- Minimum opacity (slider, 0.8–1.0)

---

### 5. Mains Hum Bar

Simulates 50Hz mains interference creating a rolling brightness band across the screen.

**Code location:** `runHumBar()` useEffect — `src/index.js`  
**CSS:** `#hx29-root::after` + `@keyframes hum-bar` — `style.css`

| Parameter | Current value | Code location |
|---|---|---|
| Interval | `60000 + Math.random() * 60000` ms (1–2 min) | `src/index.js` |
| Sweep duration | `3` s | `@keyframes hum-bar` animation, `runHumBar()` cleanup timeout |
| Bar height | `80` px | `#hx29-root::after` height |
| Bar opacity | `0.03` (3%) | `rgba(255,255,255,0.03)` in `style.css` |

**Options page controls needed:**
- Enable/disable (toggle)
- Interval range (min/max minutes)
- Opacity (slider, 1–10%)

---

### 6. CRT Vignette

Simulates the dimming caused by the electron beam traveling further to reach the curved glass edges.

**Code location:** `#hx29-root::before` — `style.css`

| Parameter | Current value | Code location |
|---|---|---|
| Clear center radius | `65%` | `transparent 65%` |
| Mid-edge opacity | `0.12` (12%) | `rgba(0,0,0,0.12) 85%` |
| Corner opacity | `0.30` (30%) | `rgba(0,0,0,0.30) 100%` |

**Options page controls needed:**
- Enable/disable (toggle)
- Corner darkness (slider, 0–60%)

---

### 7. Periodic Glitch Messages

Random system error messages (kernel panics, segfaults, security alerts) injected into the terminal at random intervals. Also triggers inline during normal output.

**Code location:** Glitch timer useEffect + inline in `handleInput` — `src/index.js`  
**Data:** `src/glitches.json`

| Parameter | Current value | Code location |
|---|---|---|
| Timer interval | `90000 + Math.random() * 60000` ms (90–150s) | Glitch timer useEffect |
| Inline probability | `0.01` (1%) per output line | `handleInput` |
| Message pool | 31 messages | `src/glitches.json` |

**Options page controls needed:**
- Enable/disable timer glitches (toggle)
- Enable/disable inline glitches (toggle)
- Timer interval range (min/max seconds)
- Inline probability (slider, 0–5%)

---

### 8. Random Intro Corruption (`__phases`)

Intro sequence items with `__phases` generate a randomly corrupted middle frame at runtime — different each page load.

**Code location:** `expandItem()` in `src/intros.js`

| Parameter | Current value | Code location |
|---|---|---|
| Corruption probability per char | `0.45` (45%) | `corrupt()` in `src/intros.js` |
| First phase hold | `200 + Math.random() * 300` ms | `expandItem()` |
| Corrupt phase hold | `100 + Math.random() * 200` ms | `expandItem()` |

**Options page controls needed:**
- Enable/disable phase corruption (toggle)

---

## Summary Table

| Effect | Toggle | Key tunable |
|---|---|---|
| Idle sequences | yes | timeout, per-sequence enable |
| Returning visitor intro | yes | stage gap hours, reset |
| Standard intro | yes | per-intro enable, skip all |
| Baud stutter | yes | probability, freeze duration |
| Key-bounce | yes | probability |
| Sync tear | yes | probability |
| Scroll voltage drop | yes | opacity floor |
| Mains hum bar | yes | interval, opacity |
| CRT vignette | yes | corner darkness |
| Periodic glitches | yes | interval |
| Inline glitches | yes | probability |
| Intro corruption | yes | — |
