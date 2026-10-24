/**
 * @file sequencer.js
 * @module NoetherSoundSequencer
 * @version 11.0.0
 *
 * Modular Sound Timing Sequencer, PLL Beat/Bar Clock Sync, 2048-Point Spectral/Formant (F1/F2)
 * Analyser, and 2nd-Order Symplectic Hamiltonian Field Coupler for Noether Resonance Core.
 *
 * Zero-dependency UMD module usable across browser (`window.NoetherSoundSequencer`),
 * Node.js (`require('./sequencer.js')`), or external visualizers.
 *
 * Public Factory API:
 *   const seq = NoetherSoundSequencer.createNoetherSequencer({ onBeat, onDownbeat, onOnset });
 *   seq.analyseAudio(audioTime, dt, gain, analyserNode, freqBuf, prevBuf, timeBuf, sampleRate);
 *   const frame = seq.step(dt, audioTime, forces, freeRoom);
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoetherSoundSequencer = factory();
    root.createNoetherSequencer = root.NoetherSoundSequencer.createNoetherSequencer;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ─────────────────────────────────────────────────────────────────────────────
   * 1. CANONICAL VOWEL FORMANT TABLE (F1 Hz, F2 Hz, F3 Hz, target l, target m)
   *    Used by Speech Mode & Interactive Vowel Formant Articulator (/a/ /e/ /i/ /o/ /u/)
   * ───────────────────────────────────────────────────────────────────────────── */
  const VOWEL_PRESETS = {
    a: { id: 'a', label: '/a/', f1: 730, f2: 1090, f3: 2440, l: 2.2, m: 1.0 },
    e: { id: 'e', label: '/e/', f1: 530, f2: 1840, f3: 2480, l: 3.4, m: 2.0 },
    i: { id: 'i', label: '/i/', f1: 270, f2: 2290, f3: 3010, l: 4.8, m: 3.2 },
    o: { id: 'o', label: '/o/', f1: 570, f2: 840,  f3: 2410, l: 3.0, m: 1.2 },
    u: { id: 'u', label: '/u/', f1: 300, f2: 870,  f3: 2240, l: 2.0, m: 0.6 }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
   * 2. MODULAR PLL BEAT / BAR CLOCK SYNC & SPECTRAL / FORMANT ANALYSER
   * ───────────────────────────────────────────────────────────────────────────── */
  function createClockSync(callbacks = {}) {
    const histBins = new Float32Array(81); // 80..160 BPM histogram
    const state = {
      bands: [0, 0, 0],
      rawBands: [0, 0, 0],
      floors: [0.02, 0.02, 0.015],
      peaks: [0.35, 0.30, 0.25],
      subBass: 0,
      kickPunch: 0,
      depth: 0.35,
      crest: 1.0,
      style: 'harmonic',
      styleLabel: 'Harmonic',
      styleTargetVis: 0.0,
      level: 0,
      rmsAvg: 0.04,
      fullFlux: 0,
      fluxHist: [],
      f1: 0,
      f2: 0,
      t1: 0,
      lastOnset: -1,
      onsets: [],
      bpm: 0,
      cand: 0,
      candSince: 0,
      conf: 0,
      locked: false,
      deterministicLock: false,
      nextBeat: 0,
      period: 0.5,
      beatCount: 0,
      barCount: 0,
      beatInBar: 0,
      accent: [0, 0, 0, 0],
      downOff: 0,
      centroid: 0.35,
      formantF1: 500,
      formantF2: 1500,
      beatEnv: 0,
      downbeatEnv: 0,
      burst: 0,
      punch: 0
    };

    function reset() {
      Object.assign(state, {
        fluxHist: [],
        onsets: [],
        bpm: 0,
        cand: 0,
        candSince: 0,
        conf: 0,
        locked: false,
        deterministicLock: false,
        nextBeat: 0,
        beatCount: 0,
        barCount: 0,
        beatInBar: 0,
        accent: [0, 0, 0, 0],
        downOff: 0,
        lastOnset: -1,
        f1: 0,
        f2: 0,
        t1: 0,
        subBass: 0,
        kickPunch: 0,
        depth: 0.35,
        style: 'harmonic',
        styleLabel: 'Harmonic',
        styleTargetVis: 0.0
      });
    }

    function triggerPulse(strength, isLockedBeat, isDownbeat) {
      state.beatEnv = Math.max(state.beatEnv, strength);
      state.burst = Math.max(state.burst, strength);
      state.punch = Math.max(state.punch, strength * (isDownbeat ? 1.45 : 1.05));
      if (isDownbeat) state.downbeatEnv = 1.0;
      if (callbacks.onBeat) {
        callbacks.onBeat({
          strength,
          locked: !!isLockedBeat,
          downbeat: !!isDownbeat,
          bpm: state.bpm,
          period: state.period,
          beatCount: state.beatCount,
          beatInBar: state.beatInBar,
          barCount: state.barCount
        });
      }
      if (isDownbeat && callbacks.onDownbeat) {
        callbacks.onDownbeat({ bpm: state.bpm, barCount: state.barCount });
      }
    }

    function setDeterministicTempo(bpm, audioTime, isDownbeat) {
      state.bpm = bpm;
      state.period = 60 / bpm;
      state.conf = 1.0;
      state.locked = true;
      state.deterministicLock = true;
      state.lastOnset = audioTime;
      state.nextBeat = audioTime + state.period;
      if (isDownbeat) state.downOff = state.beatCount % 4;
      state.beatInBar = ((state.beatCount - state.downOff) % 4 + 4) % 4;
      if (state.beatInBar === 0) state.barCount++;
      triggerPulse(isDownbeat ? 1.0 : 0.78, true, isDownbeat);
      state.beatCount++;
    }

    function estimateTempo(now) {
      if (state.deterministicLock) return;
      histBins.fill(0);
      const o = state.onsets;
      let total = 0;
      for (let i = 0; i < o.length; i++) {
        for (let j = i + 1; j < o.length; j++) {
          const d = o[j].t - o[i].t;
          if (d < 0.25 || d > 3.2) continue;
          let bpm = 60 / d;
          while (bpm < 80) bpm *= 2;
          while (bpm >= 160) bpm /= 2;
          const n = Math.max(1, Math.round((d * bpm) / 60));
          const age = Math.exp(-(now - o[j].t) / 4);
          const w = (o[i].s * o[j].s * age) / (1 + 0.45 * (n - 1));
          const x = bpm - 80;
          const k = Math.floor(x);
          const f = x - k;
          if (k >= 0 && k < 81) histBins[k] += w * (1 - f);
          if (k + 1 >= 0 && k + 1 < 81) histBins[k + 1] += w * f;
          total += w;
        }
      }
      if (total <= 0 || o.length < 4) {
        state.conf *= 0.9;
        state.locked = state.bpm > 0 && state.conf > 0.13;
        return;
      }
      let best = 0, bi = 0;
      for (let i = 1; i < 80; i++) {
        const v = histBins[i - 1] * 0.25 + histBins[i] * 0.5 + histBins[i + 1] * 0.25;
        if (v > best) { best = v; bi = i; }
      }
      const a = histBins[bi - 1], b = histBins[bi], c = histBins[bi + 1] || 0;
      const off = (a - c) / (2 * (a - 2 * b + c) || 1);
      const est = 80 + bi + clamp(off, -0.5, 0.5);
      let win = 0;
      for (let i = Math.max(0, bi - 2); i <= Math.min(80, bi + 2); i++) win += histBins[i];
      state.conf = state.conf * 0.6 + (win / total) * 0.4;

      if (!state.bpm) {
        if (state.conf > 0.14) {
          state.bpm = est;
          state.nextBeat = now + 60 / est;
        }
      } else if (Math.abs(est - state.bpm) < 3.5) {
        state.bpm += (est - state.bpm) * 0.2;
        state.cand = 0;
      } else {
        if (!state.cand || Math.abs(est - state.cand) > 3) {
          state.cand = est;
          state.candSince = now;
        } else if (now - state.candSince > 1.2) {
          state.bpm = est;
          state.cand = 0;
          state.nextBeat = now + 60 / est;
        }
      }
      const recent = o.filter(x => now - x.t < 3.2).length;
      state.locked = state.bpm > 0 && state.conf > 0.13 && recent >= 3;
    }

    function onOnset(t, strength) {
      state.lastOnset = t;
      state.onsets.push({ t, s: strength });
      while (state.onsets.length && t - state.onsets[0].t > 8) state.onsets.shift();
      if (callbacks.onOnset) callbacks.onOnset({ time: t, strength });
      if (state.deterministicLock) return;
      estimateTempo(t);
      if (state.locked) {
        const p = state.period, prev = state.nextBeat - p;
        const near = Math.abs(t - prev) < Math.abs(t - state.nextBeat) ? prev : state.nextBeat;
        const e = t - near;
        if (Math.abs(e) < 0.32 * p) state.nextBeat += e * 0.34;
        // Also fire an immediate transient micro-pulse on strong off-grid kicks/snares so heavy rhythms feel tight!
        if (strength > 0.55) triggerPulse(strength * 0.72, false, false);
      } else {
        triggerPulse(strength * 0.95, false, false);
      }
    }

    function beatClock(now) {
      if (state.deterministicLock) return;
      if (state.locked && now - state.lastOnset > 2.8) state.locked = false;
      if (!state.locked || !state.bpm) return;
      state.period = 60 / state.bpm;
      if (now - state.nextBeat > state.period * 2) state.nextBeat = state.lastOnset + state.period;
      while (now >= state.nextBeat) {
        const slot = state.beatCount % 4;
        state.accent[slot] = state.accent[slot] * 0.8 + (state.fullFlux + state.bands[0] * 0.65) * 0.2;
        state.downOff = state.accent.indexOf(Math.max(...state.accent));
        state.beatInBar = ((state.beatCount - state.downOff) % 4 + 4) % 4;
        const down = state.beatInBar === 0;
        if (down) state.barCount++;
        const dynStrength = clamp((down ? 0.85 : 0.62) + state.bands[0] * 0.38, 0.45, 1.35);
        triggerPulse(dynStrength, true, down);
        state.beatCount++;
        state.nextBeat += state.period;
      }
    }

    function beatPhase(now) {
      if (state.locked && state.bpm) return clamp(1 - (state.nextBeat - now) / state.period, 0, 1);
      return (now % 0.5) / 0.5;
    }

    function analyseAudio(now, dt, gain, analyser, freqBuf, prevBuf, timeBuf, sampleRate) {
      analyser.getByteFrequencyData(freqBuf);
      analyser.getFloatTimeDomainData(timeBuf);

      const fftSize = analyser.fftSize;
      const binLen = freqBuf.length;
      const binOf = hz => clamp(Math.round(hz / (sampleRate / fftSize)), 1, binLen - 1);

      // Power-law acoustic energy integral (expands logarithmic dB bytes into true dynamic range!)
      const bandPower = (lo, hi, exp = 2.15) => {
        const a = binOf(lo), b = Math.max(a, binOf(hi));
        let sum = 0, peak = 0;
        for (let i = a; i <= b; i++) {
          const norm = freqBuf[i] / 255;
          const p = Math.pow(norm, exp);
          sum += p;
          if (p > peak) peak = p;
        }
        const avg = sum / (b - a + 1);
        return avg * 0.65 + peak * 0.35;
      };

      const subRaw  = bandPower(20, 75, 2.25);
      const kickRaw = bandPower(65, 155, 2.15);
      const raw = [
        bandPower(24, 185, 2.10),   // Low: Sub-bass + Kick + Bassline
        bandPower(185, 2400, 1.95), // Mid: Vocals, Snare body, Synths, Guitars
        bandPower(2400, 13000, 1.80) // High: Hi-hats, Cymbals, Transients, Air
      ];

      // Hybrid Dynamic Envelope: preserves true loudness difference between quiet & heavy music
      // while subtracting ambient room floor and boosting transient attacks!
      const floorDecay = Math.pow(0.5, dt / 6.0);
      const peakDecay  = Math.pow(0.5, dt / 2.2);
      for (let i = 0; i < 3; i++) {
        state.rawBands[i] = raw[i];
        state.floors[i] = Math.min(raw[i], lerp(state.floors[i], raw[i], 0.02)) * floorDecay + 0.008;
        state.peaks[i]  = Math.max(raw[i], state.peaks[i] * peakDecay, 0.16);

        const aboveFloor = Math.max(0, raw[i] - state.floors[i] * 0.85);
        const span = Math.max(0.12, state.peaks[i] - state.floors[i] * 0.85);
        const normContrast = aboveFloor / span; // 0..1 transient contrast within current passage
        const absPower = raw[i] * (i === 0 ? 1.55 : (i === 1 ? 1.75 : 2.10)); // true absolute weight

        // Combine 58% absolute power + 42% dynamic contrast so heavy loud music hits MUCH harder
        // AND rhythmic drops/transients always pop with deep relief!
        const targetV = clamp((absPower * 0.58 + normContrast * 0.52) * gain, 0, 1.75);
        const attackRate = targetV > state.bands[i] ? 0.72 : 0.18;
        state.bands[i] += (targetV - state.bands[i]) * attackRate;
      }

      const targetSub = clamp(subRaw * 1.75 * gain, 0, 1.8);
      state.subBass += (targetSub - state.subBass) * (targetSub > state.subBass ? 0.75 : 0.16);
      const prevKick = state.kickPunch;
      const targetKick = clamp(kickRaw * 1.65 * gain, 0, 1.8);
      state.kickPunch += (targetKick - state.kickPunch) * (targetKick > state.kickPunch ? 0.80 : 0.22);

      // Immediate sub-bass / kick impulse detector (even before PLL tempo lock!)
      if (targetKick - prevKick > 0.22 && now - state.lastOnset > 0.13) {
        onOnset(now, clamp((targetKick - prevKick) * 1.8 + state.subBass * 0.4, 0.35, 1.25));
      }

      let rms = 0, peakSample = 0;
      for (let i = 0; i < timeBuf.length; i += 2) {
        const s = Math.abs(timeBuf[i]);
        rms += s * s;
        if (s > peakSample) peakSample = s;
      }
      rms = Math.sqrt(rms / (timeBuf.length / 2));
      state.rmsAvg = lerp(state.rmsAvg, rms, 0.05);
      state.crest = clamp(peakSample / Math.max(0.015, rms), 1.0, 6.0);

      // Combine time-domain RMS and spectral energy so even cross-origin / compressed streams drive level accurately
      const spectralLvl = (state.bands[0] * 0.48 + state.bands[1] * 0.34 + state.bands[2] * 0.18);
      const timeLvl = clamp(rms * 4.8 * gain, 0, 1.6);
      const combinedLvl = Math.max(timeLvl, spectralLvl * 0.92);
      state.level += (combinedLvl - state.level) * (combinedLvl > state.level ? 0.62 : 0.20);

      // Extract Live Speech Formants F1 (250–900 Hz) & F2 (900–2800 Hz) + Spectral Centroid
      const hzPerBin = sampleRate / fftSize;
      const f1Lo = binOf(250), f1Hi = binOf(900);
      let maxF1 = 0, binF1 = f1Lo;
      for (let i = f1Lo; i <= f1Hi; i++) {
        if (freqBuf[i] > maxF1) { maxF1 = freqBuf[i]; binF1 = i; }
      }
      const f2Lo = binOf(900), f2Hi = binOf(2800);
      let maxF2 = 0, binF2 = f2Lo;
      for (let i = f2Lo; i <= f2Hi; i++) {
        if (freqBuf[i] > maxF2) { maxF2 = freqBuf[i]; binF2 = i; }
      }
      if (maxF1 > 18) state.formantF1 = lerp(state.formantF1, binF1 * hzPerBin, 0.25);
      if (maxF2 > 14) state.formantF2 = lerp(state.formantF2, binF2 * hzPerBin, 0.25);

      const bLo = binOf(120), bHi = binOf(6400);
      let num = 0, den = 0.001;
      for (let i = bLo; i <= bHi; i++) {
        const w = Math.pow(freqBuf[i] / 255, 1.6);
        num += ((i - bLo) / (bHi - bLo)) * w;
        den += w;
      }
      state.centroid = lerp(state.centroid, clamp(num / den, 0, 1), 0.22);

      // Spectral Flux Onset Detector across Sub-Bass, Kick, Snare & Hi-Hat bands
      const loEnd = binOf(220), midEnd = binOf(3200);
      let flux = 0, full = 0;
      for (let i = 1; i < midEnd; i++) {
        const d = freqBuf[i] - prevBuf[i];
        if (d > 0) {
          const weight = i < loEnd ? 1.35 : 0.42;
          flux += d * weight;
          full += d;
        }
        prevBuf[i] = freqBuf[i];
      }
      flux /= (loEnd * 1.35 + (midEnd - loEnd) * 0.42) * 255;
      state.fullFlux = full / (midEnd * 255);

      state.fluxHist.push({ t: now, v: flux });
      while (state.fluxHist.length && now - state.fluxHist[0].t > 1.0) state.fluxHist.shift();
      let m = 0;
      for (let i = 0; i < state.fluxHist.length; i++) m += state.fluxHist[i].v;
      m /= Math.max(1, state.fluxHist.length);
      let sd = 0;
      for (let i = 0; i < state.fluxHist.length; i++) {
        const diff = state.fluxHist[i].v - m;
        sd += diff * diff;
      }
      sd = Math.sqrt(sd / Math.max(1, state.fluxHist.length));
      const thr = m + 1.15 * sd + 0.008;
      if (state.f1 > thr && state.f1 >= flux && state.f1 > state.f2 && state.t1 - state.lastOnset > 0.14) {
        onOnset(state.t1, clamp((state.f1 - m) / (sd * 3.2 + 1e-4), 0.30, 1.25));
      }
      state.f2 = state.f1;
      state.f1 = flux;
      state.t1 = now;

      // Real-Time Musical Depth & Style Classifier
      const targetDepth = clamp(
        state.subBass * 0.48 + state.bands[0] * 0.35 + state.bands[1] * 0.25 + state.fullFlux * 2.2,
        0.15,
        1.65
      );
      state.depth = lerp(state.depth, targetDepth, 0.18);

      if (state.subBass > 0.52 || (state.bands[0] > 0.62 && state.bands[0] > state.bands[1] * 1.12)) {
        state.style = 'heavy';
        state.styleLabel = 'Heavy Bass';
        state.styleTargetVis = 3.0; // Dirac Ferrofluid Crown
      } else if (state.fullFlux > 0.032 || (state.bands[2] > 0.48 && state.bands[1] > 0.45)) {
        state.style = 'rhythmic';
        state.styleLabel = 'High Energy';
        state.styleTargetVis = 1.0; // Cymatic Chladni Standing Wave
      } else if (state.bands[1] > 0.38 && state.bands[1] > state.bands[0] * 1.15) {
        state.style = 'harmonic';
        state.styleLabel = 'Melodic / Vocal';
        state.styleTargetVis = 2.0; // Hopf Torus / Villarceau Spiral
      } else if (state.level > 0.08) {
        state.style = 'ambient';
        state.styleLabel = 'Deep Resonance';
        state.styleTargetVis = 4.0; // Superfluid Vortex
      }

      beatClock(now);
    }

    return {
      state,
      reset,
      triggerPulse,
      setDeterministicTempo,
      analyseAudio,
      beatClock,
      beatPhase
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * 3. 2ND-ORDER SYMPLECTIC HAMILTONIAN FIELD OSCILLATOR BANK
   * ───────────────────────────────────────────────────────────────────────────── */
  function createSymplecticCoupler() {
    const H = {
      q: [0, 0, 0, 0], // Low, Mid, High, Radial Breathing canonical coordinates
      v: [0, 0, 0, 0], // Canonical conjugate velocities
      omega: [8.5, 13.0, 19.5, 5.2],
      zeta: [0.34, 0.38, 0.42, 0.26],
      energy: 0.42
    };

    function step(dt, forces, freeRoom = 1.0) {
      const subDt = Math.min(dt, 0.033) * 0.5;
      const invFree = 1.0 / Math.max(0.35, freeRoom);
      let totalH = 0;
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < 4; i++) {
          const w = H.omega[i] * Math.sqrt(invFree);
          const acc = forces[i] * w * w - 2.0 * H.zeta[i] * w * H.v[i] - w * w * H.q[i];
          H.v[i] += acc * subDt;
          H.q[i] += H.v[i] * subDt;
          H.q[i] = clamp(H.q[i], -0.45, 1.65);
        }
      }
      for (let i = 0; i < 4; i++) {
        const kinetic = 0.5 * Math.pow(H.v[i] / H.omega[i], 2);
        const potential = 0.5 * Math.pow(H.q[i], 2);
        totalH += (kinetic + potential) * 0.45;
      }
      H.energy = lerp(H.energy, clamp(0.18 + totalH, 0.12, 2.40), 0.18);
      return H;
    }

    return { state: H, step };
  }

  function createNoetherSequencer(opts = {}) {
    const clock = createClockSync(opts);
    const coupler = createSymplecticCoupler();
    return {
      clock,
      coupler,
      VOWEL_PRESETS,
      analyseAudio: clock.analyseAudio,
      stepHamiltonian: coupler.step,
      resetTempo: clock.reset,
      lockDeterministicClock: clock.setDeterministicTempo,
      beatPhase: clock.beatPhase
    };
  }

  return {
    version: '11.0.0',
    VOWEL_PRESETS,
    createClockSync,
    createSymplecticCoupler,
    createNoetherSequencer,
    mtof,
    clamp,
    lerp
  };
});
