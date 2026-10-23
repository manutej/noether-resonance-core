# HANDOFF.md — Noether Resonance Core (`v10.0.0 Final Production`)

**Project:** Noether Resonance Core — 3D Quantum Field Audio Visualizer, Chrome Tab / System Audio Monitor & Live Conversational Voice AI (`Kore` & `Puck`)  
**Application Root:** `/Users/cairo/Documents/CETI/ACCENTURE/content-factory v2/noether-resonance-app/`  
**Standalone Bundle:** `/Users/cairo/Documents/CETI/ACCENTURE/content-factory v2/noether_resonance_core.html`  
**Live Server:** `http://localhost:3333` (Local) · `https://noether-resonance-core.vercel.app` (Production)  
**GitHub Repository:** `https://github.com/manutej/noether-resonance-core`

---

## 1. Quick Start & Monitor / Music Workflow (`v10.0.0 Final Production`)

### A. Listening to Music from Another Chrome Tab or System Audio on a Fullscreen Monitor
1. Open **`http://localhost:3333`** (or **`https://noether-resonance-core.vercel.app`**) in Google Chrome, Arc, Brave, or Edge.
2. Click **`🔈 System / Tab Audio`** in the bottom dock (or inside the right-side Studio Settings Drawer).
3. In the browser picker:
   - **To capture Spotify / YouTube / SoundCloud / Apple Music in another Chrome Tab:** Select the **Chrome Tab** tab, choose your music tab, and keep **"Also share tab audio"** checked (it is pre-enabled via `systemAudio: 'include'` and `suppressLocalAudioPlayback: false` so your music continues playing out loud in the tab while feeding the visualizer).
   - **To capture OS-wide System Audio without any prompt:** Select **`🎙 Audio Input`** and choose `BlackHole 2ch` / `Loopback` in the device selector inside the Studio Settings Drawer.
4. Click **`⛶ Fullscreen`** (or press **`F`**) to fill your monitor.
   - **Auto-Hide on Idle** is enabled by default: after **2.8 seconds** without mouse movement, the top topology bar, bottom dock, right pull-tab, and mouse cursor fade completely out so only the 3D quantum visual fills your display.
   - Moving the mouse or hovering near the right edge immediately reveals the **`⚙ STUDIO`** pull-tab.
   - Pressing **`U`** (or clicking **`Hide Corner Text`** inside the drawer) toggles **Pure Monitor Mode**, hiding even the top-left status text.

### B. Hidden Right-Edge Studio Settings Drawer (`⚙ STUDIO` or Key `T`)
Click the **`⚙ STUDIO`** tab docked on the right edge of the screen (or press **`T`**) to slide open the 5-section **Studio Settings & Styles** drawer without blocking the 3D visual:
- **Section I · Live Audio Source & Monitor:**
  - `🔈 Capture Chrome Tab / System Audio`, `🎙 Mic / Loopback`, `🎵 Open Audio File` (or drag-and-drop any `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a` onto the window)
  - Hardware input device selector (`enumerateDevices`) + **Audio Gain (`0.25×` – `3.0×`)** slider
  - **`Auto-Hide on Idle`** and **`Hide Corner Text`** monitor toggles
- **Section II · Colors & Sanzo Wada Palettes:**
  - **4 Live Interactive Pigment Pickers** (`1·GROUND`, `2·BODY`, `3·CREST`, `4·ACCENT`) with live hex readouts
  - **12 Authentic Sanzo Wada *Haishoku Soukan* 4-Pigment Combinations** (`Auto`, `#142`, `#068`, `#219`, `#284`, `#091`, `#173`, `#148`, `#281`, `Silver`, `Sumi`, `Ice`)
  - **`↻ Rotate`** (cycles the 4 pigments across shader roles) and **`Beat-Sync`** (rotates pigment roles on every 4th musical beat)
  - **`Accent Pop`** and **`Room Glow`** sliders
- **Section III · Surface Style, Layers & Camera:**
  - **5 Surface Equations:** `Liquid Yℓm`, `Chladni`, `Hopf Torus`, `Ferrofluid`, `Superfluid`
  - **6 Independent Layer Toggles:** `Core Surface` (ON), `144 Spectrum` (ON), `4.8k Halo` (ON), `Surface Veins` (OFF by default for clean organic surface), `3D Coils` (OFF by default), `Wave Loops` (OFF by default)
  - **4 Camera Modes:** `Front`, `3/4 Iso`, `Orbit 360°`, `Macro`
- **Section IV · Physics & 2D XY Symplectic Pad:**
  - Interactive 2D XY Morph Pad (`X: Harmonic ℓ`, `Y: Symmetry ε`) + `Harmonic ℓ`, `Free Room`, `Symmetry ε`, and `Vein Gain` sliders
- **Section V · Noether Voice AI & Export:**
  - Neural Voice selector (`Kore` / `Puck` / `Hands-Free VAD`), `PNG` high-DPI still capture, `Rec WebM` 60fps video+audio recorder, `Share URL` state permalink, and `CLI / SDK` modal.

---

## 2. Key Architectural Upgrades in `v10.0.0 Final Production`

1. **Bulletproof Chromium Tab & System Audio Pipeline (`attachStream` & `startSystemAudio`):**
   - **Root Cause #1 Fixed (Premature Stream Termination):** Removed `s.getVideoTracks().forEach(vt => vt.stop())` from `startSystemAudio()`. In Chromium, stopping the video track of a `getDisplayMedia` stream immediately revokes the associated tab/system audio track.
   - **Root Cause #2 Fixed (Chromium WebAudio Bug #933677):** Attached a hidden muted `HTMLAudioElement` (`A.streamSink = new Audio(); sink.muted = true; sink.srcObject = stream; sink.play()`) alongside `A.ctx.createMediaStreamSource(stream)` and connected a zero-gain pull node (`A.silentPull -> A.ctx.destination`) so Chromium's WebAudio graph continuously pulls real-time PCM samples from captured Chrome tabs.
   - **Non-Muting Tab Capture:** Added `systemAudio: 'include'`, `suppressLocalAudioPlayback: false`, and `selfBrowserSurface: 'exclude'` to `navigator.mediaDevices.getDisplayMedia()`.
2. **100% Clean Production Application (Zero Demo Clutter):**
   - Completely removed `Demo` synth track library (`TRACK_LIBRARY`, `startDemo`, `stopDemo`), `SHOWCASE_SCENES` (`toggleShowcase`), `NEURAL_TURN_BANK` fake voice turns, and demo walkthrough buttons.
3. **5-Branch 3D Quantum Topology Bar (`Keys Q, W, E, R, Y` + `⟳ Auto-Morph`):**
   - **`I · Eigen-Orb` (`Q`):** Spherical harmonic $Y_\ell^m(\theta,\phi)$ liquid drop with 144 radial spectrum bars.
   - **`II · Tokamak` (`W`):** Nested magnetic-confinement torus with poloidal/toroidal coils and 144 tokamak ribs.
   - **`III · Cymatic` (`E`):** Bessel $J_m(k_{mn}r)\cos(m\theta)$ acoustic standing-wave horizon disc + 6 concentric rings + 144 vertical pillars.
   - **`IV · Spinor Lattice` (`R`):** Icosahedral geodesic Dirac spinor cage + 144 radial crystalline spires.
   - **`V · Calabi-Yau` (`Y`):** Higher-dimensional 6D Kähler manifold cross-section with 3 intersecting $(p,q)$ torus-knot sheets, harmonic singularity core, 20 fiber loops, and 144 4-pigment spectrum prisms.
   - **`⟳ Auto-Morph`:** Automatically morphs through all 5 3D topologies every 16 seconds during live music playback.
4. **True 4-Pigment Sanzo Wada Spectrum Rendering (`THREE.NormalBlending`):**
   - Switched all 144 instanced spectrum geometries across all 5 branches from `AdditiveBlending` to `NormalBlending` so all 4 Sanzo Wada pigments remain vividly distinct without washing out to white against the volumetric background.
