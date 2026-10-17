/**
 * NOETHER // Standalone Variation Page Runner
 * Wires up dedicated full-screen 3D variation pages with Iteration 1->2->3 auditing,
 * Dual-Mode (AI Speech Orb vs. Music Visualizer) switching, and compact synth controls.
 */
(function () {
  'use strict';

  const VARIATION_META = {
    1: {
      id: 1,
      code: 'VARIATION I · SPHERICAL HARMONIC EIGEN-ORB',
      title: 'Orthonormal Spherical Harmonics Y_ℓ^m(θ,φ) & 3D Huygens Speech Shells',
      desc: 'Best for AI Speech Interface & Vocal Harmonics: Vowel formants (F₁, F₂, F₃) sculpt exact associated Legendre nodal lobes while 6 concentric Huygens wave shells radiate in 3D space.',
      defaultMode: 'speech',
      defaultTrack: 'speech_dialog',
      palette: 'cerenkov',
      scores: { 1: '64/100 (Perlin Blockout)', 2: '84/100 (Exact Y_ℓ^m)', 3: '96/100 ★ (Huygens + Thin-Film)' }
    },
    2: {
      id: 2,
      code: 'VARIATION II · HOPF FIBRATION GAUGE CATHEDRAL',
      title: '4D → 3D Stereographic Villarceau Circles on Nested Clifford Tori',
      desc: 'Best for Polyphonic Music & Harmonic Unity: Local U(1) gauge phase pulses race along 36 interlinked S³ → S² fibers that expand with musical chords without ever colliding.',
      defaultMode: 'music',
      defaultTrack: 'music_hopf',
      palette: 'gottingen',
      scores: { 1: '68/100 (Torus Knot)', 2: '87/100 (S³ Stereographic)', 3: '97/100 ★ (Free-Room Clifford Cathedral)' }
    },
    3: {
      id: 3,
      code: 'VARIATION III · GROSS-PITAEVSKII SUPERFLUID VORTEX LATTICE',
      title: '12,000 Advected Noether Current Particles & Quantized BEC Vortex Rings',
      desc: 'Best for Electronic Bass & High-Energy Music: Enforces ∂_t ρ + ∇·J = 0 via divergence-free curl streams and underdamped Hamiltonian radial containment.',
      defaultMode: 'music',
      defaultTrack: 'music_superfluid',
      palette: 'abyssal',
      scores: { 1: '61/100 (Unbounded Fountain)', 2: '86/100 (Curl Continuity)', 3: '95/100 ★ (Quantized BEC Vortex)' }
    },
    4: {
      id: 4,
      code: 'VARIATION IV · CHLADNI-LAGRANGIAN CYMATIC TENSOR MANIFOLD',
      title: '3D Standing-Wave Nodal Isosurfaces & Angular Momentum Precession Cone',
      desc: 'Best for Physics Exploration & Live Synth Patching: Visualizes the Action valley δS = 0, Chladni nodal troughs, and live L_z gyroscopic precession under symmetry breaking ε.',
      defaultMode: 'music',
      defaultTrack: 'music_gottingen',
      palette: 'helios',
      scores: { 1: '70/100 (Flat 2D Plate)', 2: '88/100 (3D Nodal Manifold)', 3: '96/100 ★ (Full Noether Vector HUD)' }
    }
  };

  function initStandaloneVariation(varId) {
    const meta = VARIATION_META[varId] || VARIATION_META[1];
    const canvas = document.getElementById('noether-webgl-canvas');
    const svgOverlay = document.getElementById('noether-svg-overlay');
    const scopeCanvas = document.getElementById('noether-scope-canvas');

    const engine = new window.NoetherStudio.NoetherQuantumFieldEngine(canvas, {
      svgOverlay,
      scopeCanvas,
      mode: meta.defaultMode,
      variation: varId,
      iteration: 3,
      onTelemetry: (tel, ac, params) => {
        const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setTxt('hud-q', `${tel.chargeQ.toFixed(4)} (CONSERVED)`);
        setTxt('hud-h', `${tel.energyH.toFixed(2)} E₀`);
        setTxt('hud-lz', `${tel.angularLz.toFixed(2)} ħ`);
        setTxt('hud-flux', `${tel.gaugeFlux.toFixed(2)} Φ₀`);
        setTxt('hud-f0', `${Math.round(ac.f0)} Hz`);
        setTxt('hud-fps', `${tel.fps}`);
      }
    });

    engine.setPalette(meta.palette);
    engine.applyVariationPreset(varId, 3);
    engine.start();

    // Populate variation header card
    const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setTxt('var-eyebrow', meta.code);
    setTxt('var-title', meta.title);
    setTxt('var-desc', meta.desc);
    setTxt('var-score-badge', meta.scores[3]);

    // Mode buttons
    const modeBtns = document.querySelectorAll('.mode-pill-btn');
    modeBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-mode') === meta.defaultMode);
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-mode');
        modeBtns.forEach(b => b.classList.toggle('is-active', b === btn));
        engine.setMode(m);
        engine.audio.startProceduralTrack(m === 'speech' ? 'speech_dialog' : meta.defaultTrack);
      });
    });

    // Iteration buttons
    const iterBtns = document.querySelectorAll('[data-iter-btn]');
    iterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const it = Number(btn.getAttribute('data-iter-btn'));
        iterBtns.forEach(b => b.classList.toggle('is-active', Number(b.getAttribute('data-iter-btn')) === it));
        engine.applyVariationPreset(varId, it);
        setTxt('var-score-badge', meta.scores[it]);
      });
    });

    // Play / Pause button
    const playBtn = document.getElementById('btn-var-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (engine.audio.isPlayingTrack) {
          engine.audio.stopProceduralTrack();
          playBtn.textContent = '▶ Play Generative Audio';
        } else {
          engine.audio.startProceduralTrack(meta.defaultTrack);
          playBtn.textContent = '⏸ Pause Audio';
        }
      });
    }

    // Sliders
    const bindS = (id, valId, prop, isInt = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = isInt ? parseInt(el.value, 10) : parseFloat(el.value);
        engine.params[prop] = v;
        setTxt(valId, isInt ? v : v.toFixed(2));
      });
    };
    bindS('sl-l', 'vl-l', 'l', true);
    bindS('sl-m', 'vl-m', 'm', true);
    bindS('sl-free', 'vl-free', 'freeRoom');
    bindS('sl-sym', 'vl-sym', 'symBreak');

    // Right rail symmetry presets
    document.querySelectorAll('[data-sym-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number(btn.getAttribute('data-sym-preset'));
        document.querySelectorAll('[data-sym-preset]').forEach(b => b.classList.toggle('is-active', b === btn));
        engine.applySymmetryLawPreset(p);
        engine.audio.playQuantumNote(164.81 * (1 + p * 0.2), 0.6, 0.5);
      });
    });
  }

  window.NoetherStudio.initStandaloneVariation = initStandaloneVariation;
})();
