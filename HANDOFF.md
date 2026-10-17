# HANDOFF.md — Noether Resonance Core (`v3.0 Operadic Diamond`)

**Project:** Noether Resonance Core — Quantum Field Audio Synthesizer & AI Voice Interface  
**Application Root:** `/Users/cairo/Documents/CETI/ACCENTURE/content-factory v2/noether-resonance-app/`  
**Standalone Bundle:** `/Users/cairo/Documents/CETI/ACCENTURE/content-factory v2/Noether Resonance Core.html`  
**Live Server:** `http://localhost:3333` (Local) · `http://192.168.4.30:3333` (LAN / Wi-Fi Demo)

---

## 1. Quick Start & Live Demo Guide

### A. Instant Live Browser Access (Already Running)
The live deployment server is running as a background daemon on port `3333`:
- **On this Mac:** Open **`http://localhost:3333`** in Chrome, Arc, Edge, or Safari.
- **On another laptop/tablet/phone on the same Wi-Fi:** Open **`http://192.168.4.30:3333`**.
- **Health Check:** `curl http://localhost:3333/health` returns JSON status and version (`3.0.0-operadic-diamond`).

If you ever need to restart the server from the CLI:
```bash
node "/Users/cairo/Documents/CETI/ACCENTURE/content-factory v2/noether-resonance-app/server.js" 3333 --open
```

### B. 1-Click Demo & Export Workflow (How to Demo to Others)
1. **1-Click `Showcase` Mode (Bottom Dock or Key `0`):** Automatically cycles through **5 curated signature scenes** every 9 seconds, pairing each of the 5 Quantum Field physics topologies with a bespoke Sanzo Wada / Monotone palette, camera angle, and procedural composition.
2. **Jump Directly to Any Showcase Scene (`Keys 5–9`):**
   - `5` — **Scene I:** DeepMind Eigen-Orb ($Y_\ell^m$) · Sanzo Wada `#142` · `Front` Camera
   - `6` — **Scene II:** Cymatic Chladni Lattice · `Mono Silver` · `3/4 Iso` Camera
   - `7` — **Scene III:** 3D Hopf Toroidal Vortex · Sanzo Wada `#068` · `3/4 Iso` Camera
   - `8` — **Scene IV:** Dirac Spinor Ferrofluid · Sanzo Wada `#219` · `Orbit` Camera
   - `9` — **Scene V:** Superfluid Gross-Pitaevskii Vortex · Sanzo Wada `#091` · `Macro` Camera
3. **Export Stills & Video (`Tweaks ▴` $\to$ Row 3):**
   - **`PNG` Button:** Captures an instant high-DPI PNG still (including the Sanzo Wada atmospheric background) to your Downloads folder.
   - **`Rec` Button:** Records a **60fps WebM video multiplexed with live WebAudio** directly from the canvas and audio bus. Click `Rec` to start (`Stop Rec` to finish and download).
   - **`Save / Link` Button:** Encodes your exact visualizer mode, camera mode, palette, harmonic $\ell$, free room, symmetry $\varepsilon$, and fibroid settings into the URL hash (`#m=...&cam=...&p=...`) and copies the shareable link to your clipboard.

---

## 2. Operadic Meta-Suite (`v3.0`) Architecture

Using `/operadic-meta-suite` (`TREE` $\to$ `COMPOSE` $\to$ `OC` Consistency Gate), `v2.0 Gold Standard` was elevated along four orthogonal morphisms:
$$f_{\text{Operad}} : (c_{\text{Design}},\, c_{\text{Practical}},\, c_{\text{Demo}},\, c_{\text{Deploy}}) \longrightarrow c_{\text{v3.0 Operadic Diamond}}$$

1. **Design Morphism ($c_{\text{Design}}$):**
   - **4-Mode 3D Camera Choreography (`Front`, `3/4 Iso`, `Orbit`, `Macro`) + Scroll-Wheel Zoom:** Lets users inspect the 3D sculpture from an isometric gallery angle, a continuous $360^\circ$ orbital cinema sweep, or a macro close-up of the surface fibroid veins—while automatically adjusting vertical offset and scale so the open Tweak Drawer never overlaps the visual.
   - **Sanzo Wada #091 (`Kyoto Moss · Persimmon Silk · Pale Gold · Bamboo`) & Dynamic Room Tone:** Added a 9th palette option and synchronized the WebGL canvas clear color (`pal.core * 0.22`) to breathe with the active Sanzo Wada combination.
2. **Practicality Morphism ($c_{\text{Practical}}$):**
   - **Hands-Free Microphone Voice-Activity Auto-Turn (`Auto-VAD`):** When `Mic` is active and `Auto-VAD` is enabled, speaking above the adaptive noise floor automatically switches the orb to `Listening`; pausing for $0.95\text{ s}$ triggers a brief `Thinking` harmonic fold ($1.1\text{ s}$) followed by a `Speaking` resonance response.
   - **Local Audio File Scrubber & Pause/Play Control:** Dropping or selecting an audio file reveals a compact, non-overlapping progress scrubber and `Pause/Play` button in the top-left HUD.
3. **Demoability Morphism ($c_{\text{Demo}}$):**
   - **1-Click `Showcase` Director + `PNG` Snapshot + `60fps WebM` Video+Audio Recorder.**
4. **Deployment Morphism ($c_{\text{Deploy}}$):**
   - **Live Zero-Dependency HTTP Server (`server.js`)** bound to `0.0.0.0:3333` with LAN IP discovery, `/health` JSON endpoint, and full `Permissions-Policy` headers for microphone and system audio capture.
