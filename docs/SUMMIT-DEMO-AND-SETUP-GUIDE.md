# Noether Resonance Core `v9.0` — Summit Demo Runbook, Plugin SDK & Audio Setup Guide

## 1. Quick-Start for Tomorrow's Summit Demo

### Option A: Live Cloud URL (Zero Setup)
Open **[https://noether-resonance-core.vercel.app](https://noether-resonance-core.vercel.app)** in Chrome, Edge, or Arc.

### Option B: Local Stage Server (Ultra-Low Latency + Antigravity CLI Remote Control)
```bash
cd noether-resonance-app
npm start
# Opens on http://localhost:3333
```

---

## 2. Two Separate Workspaces (`✦ Noether AI` vs. `♫ Music Lab`)

The header bar provides a dedicated workspace switcher so the primary interface is a pure, working **Jarvis Conversational AI** without demo buttons or walkthrough clutter:

1. **`✦ Noether AI` (Default Primary Workspace):**
   - **Click `🎙 Talk to Noether` (or press `Spacebar`):** Immediately activates your live microphone (`getUserMedia`) so your voice drives the 3D quantum orb and transcribes your speech in real time. When you finish speaking, Noether thinks (`Grok 4.20` / `Gemini 2.5 Flash` / `OpenAI`) and speaks back in real neural voice (`Kore` or `Puck`) while dynamically morphing the 3D topology and Sanzo Wada 4-pigment palette.
   - **`∞ Hands-Free` Toggle (On by Default):** Automatically re-enters listening mode after Noether finishes speaking so you can carry on a natural multi-turn back-and-forth conversation on stage without touching the mouse.
   - **Type or Click a Quick-Prompt Chip:** Type any question in the bottom prompt bar (or click one of the stage-ready quick chips) and press `Enter`.
   - **Clean, Line-Free Liquid-Light Orb by Default:** Both `Surface Veins` and `3D Coils` are **OFF by default** so the orb renders as a smooth, luminous 4-pigment Sanzo Wada liquid-light sphere. (You can optionally toggle `Surface Veins` or `3D Coils` on inside `Controls ▴ -> Card II`).

2. **`♫ Music Lab` (Separate Acoustic & Music Exploration Workspace):**
   - Click **`♫ Music Lab`** in the top header (or open `?workspace=music`) to switch to the dedicated music synthesizer and acoustic visualization studio:
     - **5 Harmonic Synth Tracks** (`▶ Play Synth`)
     - **Drag-and-Drop Audio File Deck** (`Upload Audio`)
     - **Microphone / Virtual Audio Loopback Selector** (`🎙 Audio Input`)
     - **Auto-Director** (`✦ Auto-Director`)

---

## 3. Why Did "System Audio" Prompt to Share a Window? (And How to Route Audio Without Any Popup)

### Why Browser "System Audio" Triggered a Window-Share Dialog
In modern browsers (Chrome, Edge, Safari, Firefox), the WebRTC security sandbox **does not allow websites to tap desktop/system audio via `navigator.mediaDevices.getUserMedia()`**. The only browser API that exposes desktop or tab audio is `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`—which is the browser's Screen/Window Share API and **mandatory-prompts the user to pick a window or tab**.

### How We Fixed It for Your Summit Demo
1. **Removed `System Audio` from the Jarvis Interface:** `🎙 Talk to Noether` uses `navigator.mediaDevices.getUserMedia({ audio: true })`, which connects directly to your microphone and **never prompts to share a window or screen**.
2. **How to Route External Apps (Spotify, Ableton, Zoom, Keynote, or External AI Voice) with ZERO Window-Share Popup:**
   - Install a free virtual audio loopback driver on macOS such as **[BlackHole 2ch](https://existential.audio/blackhole/)** (`brew install blackhole-2ch`) or **Rogue Amoeba Loopback**.
   - Switch to **`♫ Music Lab`** (or use the mic selector), open the input dropdown next to `🎙 Audio Input`, and select **`BlackHole 2ch`**.
   - Because macOS presents `BlackHole 2ch` as a standard audio input device via `getUserMedia()`, it streams 60fps lossless stereo audio into the 3D orb **without ever opening a screen-share or window-share prompt**.

---

## 4. Embedding as a Plugin (`NoetherJarvisPlugin` SDK)

You can embed Noether into any web application, slide deck, or client portal using `sdk/noether-jarvis-plugin.js`:

```html
<div id="jarvis-stage" style="width: 100%; height: 640px;"></div>
<script src="https://noether-resonance-core.vercel.app/sdk/noether-jarvis-plugin.js"></script>
<script>
  const jarvis = NoetherJarvisPlugin.mount('#jarvis-stage', {
    workspace: 'jarvis',       // 'jarvis' (Conversational AI) or 'music' (Music Lab)
    branch: 'orb',             // 'orb' | 'tokamak' | 'cymatic' | 'lattice'
    palette: 'wada159',        // 'wada159' | 'wada173' | 'wada92' | 'wada241' | 'wada_auto'
    speaker: 'Kore',           // 'Kore' | 'Puck'
    handsFree: true
  });

  // Trigger a live spoken response programmatically from your host app:
  await jarvis.ask('Welcome everyone to the Summit! Give us a 20-second executive overview.');
</script>
```

---

## 5. Stage Remote Control via Antigravity CLI (`noether-cli`)

While the browser is projected on the Summit screen, you can trigger spoken responses or shift 3D topologies from a separate terminal window via Server-Sent Events (`/api/events`):

```bash
# Check microservice health & active LLM/TTS engines
node bin/noether-cli.js status

# Trigger a live conversational turn on the main stage screen
node bin/noether-cli.js turn "Welcome to the Summit! Explain how Noether's theorem governs this 3D orb."

# Make Noether speak any announcement directly on stage
node bin/noether-cli.js speak "Welcome to the afternoon keynote session." Kore

# Switch 3D topology, Sanzo Wada palette, or workspace remotely
node bin/noether-cli.js control --branch=tokamak --palette=wada173 --state=speaking
```
