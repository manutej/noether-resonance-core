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
      peaks: [0.25, 0.25, 0.25],
      level: 0,
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
        t1: 0
      });
    }

    function triggerPulse(strength, isLockedBeat, isDownbeat) {
      state.beatEnv = Math.max(state.beatEnv, strength);
      state.burst = Math.max(state.burst, strength);
      state.punch = Math.max(state.punch, strength * (isDownbeat ? 1.35 : 1.0));
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
      if (total <= 0 || o.length < 5) {
        state.conf *= 0.9;
        state.locked = state.bpm > 0 && state.conf > 0.14;
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
        if (state.conf > 0.16) {
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
        } else if (now - state.candSince > 1.4) {
          state.bpm = est;
          state.cand = 0;
          state.nextBeat = now + 60 / est;
        }
      }
      const recent = o.filter(x => now - x.t < 3.0).length;
      state.locked = state.bpm > 0 && state.conf > 0.14 && recent >= 3;
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
        if (Math.abs(e) < 0.3 * p) state.nextBeat += e * 0.32;
      } else {
        triggerPulse(strength * 0.85, false, false);
      }
    }

    function beatClock(now) {
      if (state.deterministicLock) return;
      if (state.locked && now - state.lastOnset > 2.5) state.locked = false;
      if (!state.locked || !state.bpm) return;
      state.period = 60 / state.bpm;
      if (now - state.nextBeat > state.period * 2) state.nextBeat = state.lastOnset + state.period;
      while (now >= state.nextBeat) {
        const slot = state.beatCount % 4;
        state.accent[slot] = state.accent[slot] * 0.8 + (state.fullFlux + state.bands[0] * 0.5) * 0.2;
        state.downOff = state.accent.indexOf(Math.max(...state.accent));
        state.beatInBar = ((state.beatCount - state.downOff) % 4 + 4) % 4;
        const down = state.beatInBar === 0;
        if (down) state.barCount++;
        triggerPulse(down ? 1.0 : 0.75, true, down);
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
      const bandAvg = (lo, hi) => {
        const a = binOf(lo), b = binOf(hi);
        let s = 0;
        for (let i = a; i <= b; i++) s += freqBuf[i];
        return s / ((b - a + 1) * 255);
      };

      const raw = [bandAvg(25, 180), bandAvg(180, 2200), bandAvg(2200, 12000)];
      const decay = Math.pow(0.5, dt / 4);
      for (let i = 0; i < 3; i++) {
        state.peaks[i] = Math.max(raw[i], state.peaks[i] * decay, 0.11);
        const v = clamp((raw[i] / state.peaks[i]) * gain, 0, 1.45);
        state.bands[i] += (v - state.bands[i]) * (v > state.bands[i] ? 0.55 : 0.13);
      }

      let rms = 0;
      for (let i = 0; i < timeBuf.length; i += 4) rms += timeBuf[i] * timeBuf[i];
      rms = Math.sqrt(rms / (timeBuf.length / 4));
      state.level += (clamp(rms * 4.2 * gain, 0, 1.25) - state.level) * 0.32;

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
      if (maxF1 > 18) state.formantF1 = lerp(state.formantF1, binF1 * hzPerBin, 0.22);
      if (maxF2 > 14) state.formantF2 = lerp(state.formantF2, binF2 * hzPerBin, 0.22);

      const bLo = binOf(200), bHi = binOf(3400);
      let num = 0, den = 0.001;
      for (let i = bLo; i <= bHi; i++) {
        const w = freqBuf[i] / 255;
        num += ((i - bLo) / (bHi - bLo)) * w;
        den += w;
      }
      state.centroid = lerp(state.centroid, clamp(num / den, 0, 1), 0.16);

      const loEnd = binOf(220), midEnd = binOf(2400);
      let flux = 0, full = 0;
      for (let i = 1; i < midEnd; i++) {
        const d = freqBuf[i] - prevBuf[i];
        if (d > 0) { flux += d * (i < loEnd ? 1 : 0.32); full += d; }
        prevBuf[i] = freqBuf[i];
      }
      flux /= (loEnd + (midEnd - loEnd) * 0.32) * 255;
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
      const thr = m + 1.35 * sd + 0.012;
      if (state.f1 > thr && state.f1 >= flux && state.f1 > state.f2 && state.t1 - state.lastOnset > 0.17) {
        onOnset(state.t1, clamp((state.f1 - m) / (sd * 4 + 1e-4), 0.25, 1));
      }
      state.f2 = state.f1;
      state.f1 = flux;
      state.t1 = now;

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
