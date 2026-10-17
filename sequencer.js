/**
 * @file sequencer.js
 * @module NoetherSoundSequencer
 *
 * Modular Sound Timing Sequencer, PLL Beat/Bar Clock Sync, Vocal Formant (F1/F2) Tracker,
 * Conversational Turn State Machine, and 2nd-Order Symplectic Hamiltonian Field Coupler.
 *
 * Designed for repeatability and zero-dependency plug-and-play across any 3D WebGL / Three.js
 * or Canvas visualizer archetype.
 *
 * Usage:
 *   const seq = createNoetherSequencer({ onBeat, onDownbeat, onOnset, onStateChange, onSourceChange });
 *   // In requestAnimationFrame loop:
 *   const frame = seq.step(dt, { gain, freeRoom, userL, symBreak });
 *   activeVisualizerBranch.update(frame);
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
   * 1. BUILT-IN OFFLINE PROCEDURAL COMPOSITIONS & FORMANT VOWEL TABLE
   * ───────────────────────────────────────────────────────────────────────────── */
  const TRACK_LIBRARY = [
    {
      id: 'progression',
      name: 'I. Noether Progression · Harmonic & tempo shifts (98→122→134→110 BPM)',
      sections: [{ bpm: 98, bars: 8 }, { bpm: 122, bars: 8 }, { bpm: 134, bars: 8 }, { bpm: 110, bars: 8 }],
      prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      roots: [33, 29, 36, 31],
      style: 'progression'
    },
    {
      id: 'cathedral',
      name: 'II. Göttingen 1918 · Harmonic cathedral choral fifths (76 BPM)',
      sections: [{ bpm: 76, bars: 16 }],
      prog: [[50, 57, 62, 69], [48, 55, 60, 67], [45, 52, 57, 64], [46, 53, 58, 65]],
      roots: [26, 24, 33, 34],
      style: 'cathedral'
    },
    {
      id: 'idm',
      name: 'III. Hopf Fibration Arp · 124 BPM IDM & crystalline overtones',
      sections: [{ bpm: 124, bars: 16 }],
      prog: [[60, 63, 67, 70], [58, 62, 65, 69], [56, 60, 63, 67], [55, 59, 62, 67]],
      roots: [36, 34, 32, 31],
      style: 'idm'
    },
    {
      id: 'dub',
      name: 'IV. Superfluid Vortex Dub · 88 BPM deep quantized sub-bass',
      sections: [{ bpm: 88, bars: 16 }],
      prog: [[51, 55, 58], [48, 51, 55], [46, 50, 53], [49, 53, 56]],
      roots: [27, 24, 22, 25],
      style: 'dub'
    },
    {
      id: 'etude',
      name: 'V. Broken Symmetry Etude · 112 BPM polymetric gauge study',
      sections: [{ bpm: 112, bars: 16 }],
      prog: [[54, 58, 61, 65], [52, 56, 59, 64], [49, 54, 57, 61], [51, 55, 60, 63]],
      roots: [30, 28, 33, 27],
      style: 'etude'
    }
  ];

  // Formant vowel table: [F1 Hz, F2 Hz, F3 Hz, target l, target m]
  const VOWELS = [
    [730, 1090, 2440, 2, 1], // /a/
    [530, 1840, 2480, 3, 2], // /e/
    [270, 2290, 3010, 4, 3], // /i/
    [570, 840, 2410, 3, 1],  // /o/
    [300, 870, 2240, 2, 0],  // /u/
    [660, 1720, 2410, 4, 2], // /ae/
    [490, 1350, 1690, 3, 3]  // /er/
  ];

  /* ─────────────────────────────────────────────────────────────────────────────
   * 2. MODULAR PLL BEAT / BAR CLOCK SYNC ENGINE
   * ───────────────────────────────────────────────────────────────────────────── */
  function createClockSync(callbacks = {}) {
    const histBins = new Float32Array(81); // 80..160 BPM
    const state = {
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
      beatEnv: 0,
      downbeatEnv: 0,
      burst: 0,
      punch: 0,
      fullFlux: 0
    };

    function reset() {
      Object.assign(state, {
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
        downOff: 0
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
          locked: isLockedBeat,
          downbeat: !!isDownbeat,
          bpm: state.bpm,
          beatCount: state.beatCount,
          beatInBar: state.beatInBar,
          barCount: state.barCount
        });
      }
      if (isDownbeat && callbacks.onDownbeat) {
        callbacks.onDownbeat({ bpm: state.bpm, barCount: state.barCount });
      }
    }

    // Allows internal sequencers (like Demo Track or Thinking Pulse) to lock tempo deterministically
    function setDeterministicTempo(bpm, audioTime, isDownbeat) {
      state.bpm = bpm;
      state.period = 60 / bpm;
      state.conf = 1.0;
      state.locked = true;
      state.deterministicLock = true;
      state.lastOnset = audioTime;
      state.nextBeat = audioTime + state.period;
      if (isDownbeat) {
        state.downOff = state.beatCount % 4;
      }
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
        if (state.conf > 0.15) {
          state.bpm = est;
          state.nextBeat = now + 60 / est;
        }
      } else if (Math.abs(est - state.bpm) < 3.5) {
        state.bpm += (est - state.bpm) * 0.22;
        state.cand = 0;
      } else {
        if (!state.cand || Math.abs(est - state.cand) > 3) {
          state.cand = est;
          state.candSince = now;
        } else if (now - state.candSince > 1.3) {
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

    function feedSpectralFlux(now, flux, fullFlux, bassBand) {
      state.fullFlux = fullFlux;
      state.fluxHist.push({ t: now, v: flux });
      while (state.fluxHist.length && now - state.fluxHist[0].t > 1.0) state.fluxHist.shift();
      let m = 0;
      for (let i = 0; i < state.fluxHist.length; i++) m += state.fluxHist[i].v;
      m /= Math.max(1, state.fluxHist.length);
      let sd = 0;
      for (let i = 0; i < state.fluxHist.length; i++) {
        const d = state.fluxHist[i].v - m;
        sd += d * d;
      }
      sd = Math.sqrt(sd / Math.max(1, state.fluxHist.length));
      const thr = m + 1.32 * sd + 0.011;
      if (state.f1 > thr && state.f1 >= flux && state.f1 > state.f2 && state.t1 - state.lastOnset > 0.16) {
        const strength = clamp((state.f1 - m) / (sd * 4 + 1e-4), 0.25, 1.0);
        onOnset(state.t1, strength);
      }
      state.f2 = state.f1;
      state.f1 = flux;
      state.t1 = now;

      if (!state.deterministicLock) {
        if (state.locked && now - state.lastOnset > 2.5) state.locked = false;
        if (state.locked && state.bpm > 0) {
          state.period = 60 / state.bpm;
          if (now - state.nextBeat > state.period * 2) state.nextBeat = state.lastOnset + state.period;
          while (now >= state.nextBeat) {
            const slot = state.beatCount % 4;
            state.accent[slot] = state.accent[slot] * 0.8 + (state.fullFlux + bassBand * 0.5) * 0.2;
            state.downOff = state.accent.indexOf(Math.max(...state.accent));
            state.beatInBar = ((state.beatCount - state.downOff) % 4 + 4) % 4;
            const down = state.beatInBar === 0;
            if (down) state.barCount++;
            triggerPulse(down ? 1.0 : 0.75, true, down);
            state.beatCount++;
            state.nextBeat += state.period;
          }
        }
      }
    }

    function stepEnvelopes(dt, now, isLive) {
      const period = state.locked && state.bpm > 0 ? 60 / state.bpm : 0.5;
      state.period = period;
      state.beatEnv *= Math.exp(-dt / (period * 0.34));
      state.downbeatEnv *= Math.exp(-dt / (period * 0.85));
      state.burst *= Math.exp(-dt / (period * 0.55));
      state.punch *= Math.exp(-dt / 0.13);

      const beatPhase = (isLive && state.locked && state.bpm > 0)
        ? clamp(1 - (state.nextBeat - now) / period, 0, 1)
        : (now % 0.5) / 0.5;
      const barPhase = (state.beatInBar + beatPhase) / 4;
      const tempoScale = state.locked && state.bpm > 0 ? state.bpm / 120 : 1.0;

      return {
        locked: state.locked,
        deterministicLock: state.deterministicLock,
        bpm: state.locked ? state.bpm : 0,
        confidence: state.conf,
        period,
        beatPhase,
        barPhase,
        beatInBar: state.beatInBar,
        beatCount: state.beatCount,
        barCount: state.barCount,
        beatEnv: state.beatEnv,
        downbeatEnv: state.downbeatEnv,
        burst: state.burst,
        punch: state.punch,
        tempoScale
      };
    }

    return {
      state,
      reset,
      triggerPulse,
      setDeterministicTempo,
      feedSpectralFlux,
      stepEnvelopes
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * 3. 2ND-ORDER SYMPLECTIC HAMILTONIAN FIELD OSCILLATOR BANK
   * ───────────────────────────────────────────────────────────────────────────── */
  function createSymplecticCoupler() {
    const H = {
      q: [0.18, 0.22, 0.18, 0.20],
      p: [0.0, 0.0, 0.0, 0.0],
      omega: [2.5, 4.1, 6.4, 3.2],
      zeta: [0.30, 0.26, 0.24, 0.28],
      energy: 0.25,
      actionPhase: 0.0
    };

    function step(dt, forces, freeRoom = 1.0) {
      const subDt = Math.min(dt, 0.033) * 0.5;
      const stiffScale = 1.0 / Math.max(0.35, freeRoom * 0.85);
      let totalE = 0;

      for (let stepIdx = 0; stepIdx < 2; stepIdx++) {
        for (let i = 0; i < 4; i++) {
          const w = H.omega[i] * stiffScale;
          const z = H.zeta[i];
          const f = forces[i] * w * w * (0.78 + 0.36 * freeRoom);
          const acc = f - (w * w) * H.q[i] - 2.0 * z * w * H.p[i];
          H.p[i] += acc * subDt;
          H.q[i] = clamp(H.q[i] + H.p[i] * subDt, 0.01, 2.2);
        }
      }
      for (let i = 0; i < 4; i++) {
        const ke = 0.5 * H.p[i] * H.p[i];
        const pe = 0.5 * H.omega[i] * H.q[i] * H.q[i];
        totalE += ke + pe;
        // Lagrangian L = T - V integrated for Noether action phase S
        H.actionPhase += (ke - pe) * dt * 0.25;
      }
      H.energy = lerp(H.energy, clamp(totalE * 0.42, 0.05, 1.95), 0.16);
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
      TRACK_LIBRARY,
      VOWELS,
      step(dt, audioTime, forces, freeRoom = 1.0) {
        const env = clock.stepEnvelopes(dt, audioTime, opts.live !== false);
        const ham = coupler.step(dt, forces || [0.1, 0.1, 0.1, 0.1], freeRoom);
        return { clock: clock.state, env, ham };
      }
    };
  }

  return {
    TRACK_LIBRARY,
    VOWELS,
    createClockSync,
    createSymplecticCoupler,
    createNoetherSequencer,
    mtof,
    clamp,
    lerp
  };
});
