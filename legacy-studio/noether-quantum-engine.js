/**
 * ════════════════════════════════════════════════════════════════════════════
 * NOETHER // QUANTUM FIELD AUDIO SYNTHESIZER & DUAL-MODE 3D VISUALIZER ENGINE
 * Google Data Arts Lab × Google DeepMind Architecture
 * 100% Offline-Capable Three.js / WebGL2 + WebAudio Polyphonic Quantum Synth
 * ════════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────────────────
     0. SELF-CONTAINED FALLBACK THREE.JS SHIM (If three.global.js is absent)
     ────────────────────────────────────────────────────────────────────────── */
  if (typeof window.THREE === 'undefined') {
    console.info('[NoetherEngine] Initializing built-in offline WebGL/Canvas 3D projection shim.');
    class Vector3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    }
    class Color {
      constructor(c) { this.set(c || '#ffffff'); }
      set(c) {
        if (typeof c === 'number') {
          this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255;
        } else if (typeof c === 'string') {
          const m = c.trim().replace('#', '');
          const n = parseInt(m.length === 3 ? m.split('').map(x => x + x).join('') : m.slice(0, 6), 16) || 0;
          this.r = ((n >> 16) & 255) / 255; this.g = ((n >> 8) & 255) / 255; this.b = (n & 255) / 255;
        }
        return this;
      }
      getHexString() {
        const h = n => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, '0');
        return h(this.r) + h(this.g) + h(this.b);
      }
    }
    class Object3D {
      constructor() { this.children = []; this.position = new Vector3(); this.rotation = new Vector3(); this.scale = new Vector3(1, 1, 1); this.visible = true; }
      add(o) { if (o) this.children.push(o); return this; }
    }
    class Float32BufferAttribute {
      constructor(arr, itemSize) { this.array = arr instanceof Float32Array ? arr : new Float32Array(arr); this.itemSize = itemSize; this.needsUpdate = false; }
    }
    class BufferGeometry {
      constructor() { this.attributes = {}; this.index = null; }
      setAttribute(n, a) { this.attributes[n] = a; return this; }
      setIndex(i) { this.index = i instanceof Uint16Array ? i : new Uint16Array(i); return this; }
      computeVertexNormals() {}
    }
    class Material {
      constructor(o = {}) { Object.assign(this, o); this.color = new Color(o.color != null ? o.color : 0xffffff); }
    }
    class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this._k = 'mesh'; } }
    class Line extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this._k = 'line'; } }
    class LineSegments extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this._k = 'segs'; } }
    class Points extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this._k = 'pts'; } }
    class PerspectiveCamera extends Object3D {
      constructor(fov = 45, aspect = 1.77, near = 0.1, far = 200) { super(); this.fov = fov; this.aspect = aspect; this.near = near; this.far = far; this.target = new Vector3(); }
      lookAt(x, y, z) { if (x instanceof Vector3) this.target.copy(x); else this.target.set(x, y, z); }
      updateProjectionMatrix() {}
    }
    class WebGLRenderer {
      constructor(o = {}) {
        this.domElement = o.canvas || document.createElement('canvas');
        this.gl = this.domElement.getContext('webgl2', { antialias: true, alpha: false }) ||
                  this.domElement.getContext('webgl', { antialias: true, alpha: false });
        this.w = 1280; this.h = 720; this.pr = 1;
        this.clearColor = new Color(0x06080e);
        if (this.gl) this._initGL();
        else this.ctx = this.domElement.getContext('2d');
      }
      _initGL() {
        const gl = this.gl;
        const vsSrc = `
          attribute vec3 aPos;
          attribute vec3 aCol;
          uniform mat4 uProj;
          uniform mat4 uView;
          uniform mat4 uModel;
          uniform float uPtSize;
          varying vec3 vCol;
          void main() {
            vec4 mv = uView * uModel * vec4(aPos, 1.0);
            gl_Position = uProj * mv;
            gl_PointSize = max(1.5, uPtSize * (260.0 / max(1.0, -mv.z)));
            vCol = aCol;
          }
        `;
        const fsSrc = `
          precision mediump float;
          varying vec3 vCol;
          uniform float uOpacity;
          uniform int uIsPoint;
          void main() {
            if (uIsPoint == 1) {
              vec2 c = gl_PointCoord - vec2(0.5);
              float r2 = dot(c, c);
              if (r2 > 0.25) discard;
              float glow = exp(-r2 * 10.0);
              gl_FragColor = vec4(vCol * (0.65 + 0.55 * glow), uOpacity * glow);
            } else {
              gl_FragColor = vec4(vCol, uOpacity);
            }
          }
        `;
        const compile = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
        gl.linkProgram(prog);
        this.prog = prog;
        this.locPos = gl.getAttribLocation(prog, 'aPos');
        this.locCol = gl.getAttribLocation(prog, 'aCol');
        this.uProj = gl.getUniformLocation(prog, 'uProj');
        this.uView = gl.getUniformLocation(prog, 'uView');
        this.uModel = gl.getUniformLocation(prog, 'uModel');
        this.uPtSize = gl.getUniformLocation(prog, 'uPtSize');
        this.uOpacity = gl.getUniformLocation(prog, 'uOpacity');
        this.uIsPoint = gl.getUniformLocation(prog, 'uIsPoint');
      }
      setPixelRatio(r) { this.pr = Math.min(2, r || 1); }
      setSize(w, h) {
        this.w = w; this.h = h;
        this.domElement.width = w * this.pr;
        this.domElement.height = h * this.pr;
        if (this.gl) this.gl.viewport(0, 0, this.domElement.width, this.domElement.height);
      }
      setClearColor(c) { this.clearColor.set(c); }
      _perspMat(fov, asp, n, f) {
        const t = 1.0 / Math.tan((fov * Math.PI) / 360.0);
        const nf = 1.0 / (n - f);
        return new Float32Array([
          t / asp, 0, 0, 0,
          0, t, 0, 0,
          0, 0, (f + n) * nf, -1,
          0, 0, 2 * f * n * nf, 0
        ]);
      }
      _lookAtMat(ex, ey, ez, tx, ty, tz) {
        let zx = ex - tx, zy = ey - ty, zz = ez - tz;
        let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
        let xx = zz, xy = 0, xz = -zx;
        let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
        const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        return new Float32Array([
          xx, yx, zx, 0,
          xy, yy, zy, 0,
          xz, yz, zz, 0,
          -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1
        ]);
      }
      _modelMat(rx, ry, rz) {
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const cy = Math.cos(ry), sy = Math.sin(ry);
        const cz = Math.cos(rz), sz = Math.sin(rz);
        return new Float32Array([
          cy * cz, cx * sz + sx * sy * cz, sx * sz - cx * sy * cz, 0,
          -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz, 0,
          sy, -sx * cy, cx * cy, 0,
          0, 0, 0, 1
        ]);
      }
      render(scene, cam) {
        const gl = this.gl;
        if (!gl) return;
        gl.ClearColor ? gl.ClearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, 1) : gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.prog);

        const proj = this._perspMat(cam.fov || 40, this.w / Math.max(1, this.h), cam.near || 0.1, cam.far || 200);
        const view = this._lookAtMat(cam.position.x, cam.position.y, cam.position.z, cam.target.x, cam.target.y, cam.target.z);
        gl.uniformMatrix4fv(this.uProj, false, proj);
        gl.uniformMatrix4fv(this.uView, false, view);

        const walk = (obj, prx = 0, pry = 0, prz = 0) => {
          if (!obj || !obj.visible) return;
          const rx = prx + (obj.rotation ? obj.rotation.x : 0);
          const ry = pry + (obj.rotation ? obj.rotation.y : 0);
          const rz = prz + (obj.rotation ? obj.rotation.z : 0);
          if (obj.geometry && obj.geometry.attributes.position) {
            const g = obj.geometry;
            const m = obj.material || {};
            const posAttr = g.attributes.position;
            const colAttr = g.attributes.color;
            if (!g._glPosBuf) g._glPosBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, g._glPosBuf);
            gl.bufferData(gl.ARRAY_BUFFER, posAttr.array, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(this.locPos);
            gl.vertexAttribPointer(this.locPos, 3, gl.FLOAT, false, 0, 0);

            if (colAttr) {
              if (!g._glColBuf) g._glColBuf = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, g._glColBuf);
              gl.bufferData(gl.ARRAY_BUFFER, colAttr.array, gl.DYNAMIC_DRAW);
              gl.enableVertexAttribArray(this.locCol);
              gl.vertexAttribPointer(this.locCol, 3, gl.FLOAT, false, 0, 0);
            }

            if (m.blending === 2) {
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
              gl.depthMask(false);
            } else {
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
              gl.depthMask(true);
            }

            gl.uniformMatrix4fv(this.uModel, false, this._modelMat(rx, ry, rz));
            gl.uniform1f(this.uOpacity, m.opacity != null ? m.opacity : 1.0);
            gl.uniform1f(this.uPtSize, m.size || 0.05);
            gl.uniform1i(this.uIsPoint, obj._k === 'pts' ? 1 : 0);

            const vCount = posAttr.array.length / 3;
            if (obj._k === 'mesh' && g.index) {
              if (!g._glIdxBuf) {
                g._glIdxBuf = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g._glIdxBuf);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.index, gl.STATIC_DRAW);
              } else {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g._glIdxBuf);
              }
              gl.drawElements(gl.TRIANGLES, g.index.length, g.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
            } else if (obj._k === 'segs') {
              if (g.index) {
                if (!g._glIdxBuf) {
                  g._glIdxBuf = gl.createBuffer();
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g._glIdxBuf);
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.index, gl.STATIC_DRAW);
                } else {
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g._glIdxBuf);
                }
                gl.drawElements(gl.LINES, g.index.length, g.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
              } else {
                gl.drawArrays(gl.LINES, 0, vCount);
              }
            } else if (obj._k === 'line') {
              gl.drawArrays(gl.LINE_STRIP, 0, vCount);
            } else if (obj._k === 'pts') {
              gl.drawArrays(gl.POINTS, 0, vCount);
            }
            gl.depthMask(true);
          }
          for (const ch of obj.children) walk(ch, rx, ry, rz);
        };
        walk(scene);
      }
    }
    window.THREE = {
      Vector3, Color, Object3D, Group: Object3D, Scene: Object3D, PerspectiveCamera,
      Float32BufferAttribute, BufferGeometry, MeshBasicMaterial: Material, MeshStandardMaterial: Material,
      MeshPhongMaterial: Material, LineBasicMaterial: Material, PointsMaterial: Material,
      Mesh, Line, LineSegments, Points, WebGLRenderer, DoubleSide: 2, AdditiveBlending: 2,
      AmbientLight: Object3D, DirectionalLight: Object3D, PointLight: Object3D
    };
  }

  const THREE = window.THREE;

  /* ──────────────────────────────────────────────────────────────────────────
     1. CURATED COLOR PALETTES & DESIGN TOKENS
     ────────────────────────────────────────────────────────────────────────── */
  const PALETTES = {
    cerenkov: {
      id: 'cerenkov',
      name: 'Cerenkov Brass & Obsidian',
      bg: 0x06080e,
      cyan: [0.345, 0.768, 0.867],   // #58C4DD - Phase 0 / Wavefront
      gold: [0.961, 0.722, 0.318],   // #F5B851 - Conserved Charge Q
      mint: [0.486, 0.890, 0.545],   // #7CE38B - Noether Current J
      coral: [1.000, 0.420, 0.357],  // #FF6B5B - Symmetry Breaking ε
      violet: [0.780, 0.573, 0.918], // #C792EA - High Multipole Overtone
      hex: ['#06080E', '#58C4DD', '#F5B851', '#7CE38B', '#FF6B5B']
    },
    gottingen: {
      id: 'gottingen',
      name: 'Göttingen 1918 Monograph',
      bg: 0x0b0e17,
      cyan: [0.361, 0.643, 0.663],   // #5CA4A9 - Archival Teal
      gold: [0.784, 0.541, 0.396],   // #C88A65 - Brushed Copper
      mint: [0.961, 0.937, 0.890],   // #F5EFE3 - Warm Monograph Paper
      coral: [0.878, 0.478, 0.373],  // #E07A5F - Terracotta Flux
      violet: [0.635, 0.678, 0.776], // #A2ADC6 - Slate Mist
      hex: ['#0B0E17', '#C88A65', '#F5EFE3', '#5CA4A9', '#E07A5F']
    },
    abyssal: {
      id: 'abyssal',
      name: 'Bioluminescent Bathysphere',
      bg: 0x03070d,
      cyan: [0.000, 0.941, 1.000],   // #00F0FF - Abyssal Biolume
      gold: [1.000, 0.820, 0.400],   // #FFD166 - Aurelia Gold
      mint: [0.024, 0.839, 0.627],   // #06D6A0 - Pelagic Mint
      coral: [0.937, 0.278, 0.435],  // #EF476F - Deep Siphonophore
      violet: [0.447, 0.361, 0.965], // #725CF6 - Cherenkov Indigo
      hex: ['#03070D', '#00F0FF', '#06D6A0', '#FFD166', '#EF476F']
    },
    helios: {
      id: 'helios',
      name: 'Solar Magnetohydrodynamic',
      bg: 0x09050a,
      cyan: [0.227, 0.525, 1.000],   // #3A86FF - Magnetic Flux Tube
      gold: [1.000, 0.745, 0.043],   // #FFBE0B - Solar Corona Gold
      mint: [1.000, 0.925, 0.600],   // #FFEC99 - Photosphere White-Gold
      coral: [0.984, 0.337, 0.027],  // #FB5607 - Prominence Flare
      violet: [1.000, 0.000, 0.431], // #FF006E - Chromosphere Rose
      hex: ['#09050A', '#FFBE0B', '#FB5607', '#FF006E', '#3A86FF']
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     2. EXACT MATHEMATICAL PHYSICS KERNELS
        - Associated Legendre Polynomials P_l^m(x)
        - Real Orthonormal Spherical Harmonics Y_l^m(θ, φ)
        - 4D -> 3D Hopf Fibration Stereographic Projection
     ────────────────────────────────────────────────────────────────────────── */

  // Compute Associated Legendre Polynomial P_l^m(x) for x = cos(θ) ∈ [-1, 1]
  function legendreP(l, m, x) {
    const absM = Math.abs(m);
    if (absM > l) return 0;
    let pmm = 1.0;
    if (absM > 0) {
      const somx2 = Math.sqrt(Math.max(0, (1.0 - x) * (1.0 + x)));
      let fact = 1.0;
      for (let i = 1; i <= absM; i++) {
        pmm *= -fact * somx2;
        fact += 2.0;
      }
    }
    if (l === absM) return pmm;
    let pmmp1 = x * (2.0 * absM + 1.0) * pmm;
    if (l === absM + 1) return pmmp1;
    let pll = 0.0;
    for (let ll = absM + 2; ll <= l; ll++) {
      pll = (x * (2.0 * ll - 1.0) * pmmp1 - (ll + absM - 1.0) * pmm) / (ll - absM);
      pmm = pmmp1;
      pmmp1 = pll;
    }
    return pll;
  }

  // Precomputed factorial table for normalization N_lm
  const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000, 20922789888000];
  function factorial(n) {
    return FACT[Math.max(0, Math.min(16, n))] || 1;
  }

  function sphericalHarmonicNorm(l, m) {
    const absM = Math.abs(m);
    const num = (2 * l + 1) * factorial(l - absM);
    const den = 4 * Math.PI * factorial(l + absM);
    return Math.sqrt(num / Math.max(1e-9, den)) * (absM > 0 ? Math.SQRT2 : 1.0);
  }

  // Real Spherical Harmonic Y_l^m(theta, phi, phaseShift)
  function evalSphericalHarmonic(l, m, cosTheta, phi, phase = 0) {
    const absM = Math.abs(m);
    const norm = sphericalHarmonicNorm(l, absM);
    const P = legendreP(l, absM, cosTheta);
    if (m === 0) return norm * P;
    if (m > 0) return norm * P * Math.cos(m * phi + phase);
    return norm * P * Math.sin(absM * phi + phase);
  }

  // 4D -> 3D Hopf Fibration Stereographic Point on Clifford Torus
  // eta ∈ (0.15, 1.42) selects torus shell; xi1 ∈ [0, 2π) selects fiber; xi2 ∈ [0, 2π) traverses circle
  function hopfFiberPoint(eta, xi1, xi2, scale = 2.2) {
    const sinEta = Math.sin(eta);
    const cosEta = Math.cos(eta);
    const x4 = cosEta * Math.cos(xi2);
    const y4 = cosEta * Math.sin(xi2);
    const z4 = sinEta * Math.cos(xi1 + xi2);
    const w4 = sinEta * Math.sin(xi1 + xi2);
    // Stereographic projection from S^3 (pole w4 = 1) with smooth regularization
    const denom = Math.max(0.28, 1.0 - 0.72 * w4);
    const s = scale / denom;
    return [x4 * s, z4 * s, y4 * s, w4];
  }

  /* ──────────────────────────────────────────────────────────────────────────
     3. OFFLINE WEBAUDIO POLYPHONIC QUANTUM SYNTHESIZER & ACOUSTIC ANALYZER
     ────────────────────────────────────────────────────────────────────────── */
  class NoetherQuantumAudioSynth {
    constructor(onStateChange) {
      this.ctx = null;
      this.analyser = null;
      this.masterGain = null;
      this.formantFilters = [];
      this.delayNode = null;
      this.delayFeedback = null;
      this.freqData = new Uint8Array(1024);
      this.timeData = new Uint8Array(1024);

      this.isPlayingTrack = false;
      this.currentTrackId = 'speech_dialog';
      this.synthPreset = 'cerenkov_pad';
      this.micStream = null;
      this.micSource = null;
      this.fileAudioEl = null;
      this.fileSource = null;

      this.stepTimer = null;
      this.stepIndex = 0;
      this.prevSpectrumSum = 0;

      // Live extracted acoustic features
      this.features = {
        rms: 0.08,
        subBass: 0.12,
        lowMid: 0.15,
        highMid: 0.10,
        treble: 0.06,
        spectralFlux: 0.02,
        f0: 145,
        F1: 520,
        F2: 1480,
        F3: 2650,
        vowel: '/ɑ/ (Open Symmetry)',
        aiState: 'SPEAKING',
        captionSpeaker: 'NOETHER AI CORE',
        captionText: 'Every continuous symmetry of nature’s Action conserves an invariant charge in 3D phase space.'
      };

      // Physics feedback parameters that shape the synthesizer
      this.physicsParams = {
        l: 3,
        m: 2,
        freeRoom: 0.55,
        symBreak: 0.12,
        harmonicRichness: 0.7
      };

      this.onStateChange = onStateChange || function () {};
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.78;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.55;

        // Stereo Gauge Delay / Spatial Chorus
        this.delayNode = this.ctx.createDelay(1.0);
        this.delayNode.delayTime.value = 0.24;
        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.32;
        const delayWet = this.ctx.createGain();
        delayWet.gain.value = 0.26;

        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayNode.connect(delayWet);

        // Dynamics Compressor to prevent any clipping
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 18;
        comp.ratio.value = 4;

        this.masterGain.connect(comp);
        this.masterGain.connect(this.delayNode);
        delayWet.connect(comp);
        comp.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    }

    // Play a single polyphonic Quantum Field note shaped by (l, m, freeRoom, symBreak)
    playQuantumNote(freq = 220, duration = 0.65, velocity = 0.5, vowelOverride = null) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(velocity * 0.32, now + 0.025);
      voiceGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

      // Formant / Resonance filter shaped by Noether Free-Room & Quantum Numbers
      const filter = ctx.createBiquadFilter();
      filter.type = this.synthPreset === 'ai_formant' ? 'bandpass' : 'lowpass';
      const baseCutoff = vowelOverride ? vowelOverride.f2 : (650 + this.physicsParams.l * 260 + this.physicsParams.freeRoom * 1600);
      filter.frequency.setValueAtTime(Math.min(7500, baseCutoff), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(180, baseCutoff * 0.55), now + duration);
      filter.Q.value = 2.2 + this.physicsParams.freeRoom * 5.5;

      voiceGain.connect(filter);
      filter.connect(this.masterGain);

      // Carrier 1: Fundamental Wave
      const osc1 = ctx.createOscillator();
      osc1.type = this.synthPreset === 'bose_sub' ? 'sine' : 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      // Carrier 2: Spherical Harmonic Overtone (ratio determined by l, m, and Symmetry Breaking ε)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      const harmonicRatio = 1.0 + (this.physicsParams.l * 0.5) + (this.physicsParams.symBreak * 0.07);
      osc2.frequency.setValueAtTime(freq * harmonicRatio, now);
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.38;

      // FM Gauge Modulator (U(1) Local Phase Modulation)
      const fmOsc = ctx.createOscillator();
      fmOsc.type = 'sine';
      fmOsc.frequency.setValueAtTime(freq * (Math.abs(this.physicsParams.m) || 2), now);
      const fmGain = ctx.createGain();
      fmGain.gain.value = freq * (0.15 + this.physicsParams.freeRoom * 0.85);
      fmOsc.connect(fmGain);
      fmGain.connect(osc1.frequency);

      osc1.connect(voiceGain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(voiceGain);

      osc1.start(now);
      osc2.start(now);
      fmOsc.start(now);

      osc1.stop(now + duration + 0.04);
      osc2.stop(now + duration + 0.04);
      fmOsc.stop(now + duration + 0.04);
    }

    // Synthesize an expressive 3-Formant AI Vocal Syllable (100% offline WebAudio!)
    playAIVocalSyllable(f0 = 135, f1 = 650, f2 = 1550, f3 = 2650, duration = 0.36, sibilance = 0.1) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Update live formant readouts
      this.features.f0 = f0;
      this.features.F1 = f1;
      this.features.F2 = f2;
      this.features.F3 = f3;

      // Glottal pulse train approximation (sawtooth + triangle)
      const glottal = ctx.createOscillator();
      glottal.type = 'sawtooth';
      glottal.frequency.setValueAtTime(f0, now);
      glottal.frequency.linearRampToValueAtTime(f0 * (0.96 + Math.random() * 0.08), now + duration);

      const subGlottal = ctx.createOscillator();
      subGlottal.type = 'sine';
      subGlottal.frequency.setValueAtTime(f0 * 0.5, now);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.28, now + 0.035);
      env.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // 3 Parallel Bandpass Formant Resonators (F1, F2, F3)
      const formants = [
        { freq: f1, q: 6.5, amp: 1.0 },
        { freq: f2, q: 9.0, amp: 0.65 },
        { freq: f3, q: 11.0, amp: 0.35 }
      ];

      formants.forEach(fm => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(fm.freq, now);
        bp.Q.value = fm.q;
        const fg = ctx.createGain();
        fg.gain.value = fm.amp;
        glottal.connect(bp);
        bp.connect(fg);
        fg.connect(env);
      });

      const subGain = ctx.createGain();
      subGain.gain.value = 0.22;
      subGlottal.connect(subGain);
      subGain.connect(env);
      env.connect(this.masterGain);

      glottal.start(now);
      subGlottal.start(now);
      glottal.stop(now + duration + 0.03);
      subGlottal.stop(now + duration + 0.03);
    }

    // Synthesize Percussive Sub-Bass / Kick / Hi-Hat for Music Mode Tracks
    playQuantumPercussion(type = 'kick') {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      if (type === 'kick') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(125, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
        g.gain.setValueAtTime(0.55, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.34);
      } else if (type === 'hat') {
        // Metallic FM ratio burst
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'square';
        o2.type = 'sawtooth';
        o1.frequency.setValueAtTime(3420, now);
        o2.frequency.setValueAtTime(5180, now);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.065);
        o1.connect(g);
        o2.connect(g);
        g.connect(this.masterGain);
        o1.start(now); o2.start(now);
        o1.stop(now + 0.07); o2.stop(now + 0.07);
      }
    }

    // Start one of the 5 built-in procedural generative compositions / AI speech dialogs
    startProceduralTrack(trackId) {
      this.stopProceduralTrack();
      this.ensureContext();
      this.currentTrackId = trackId || this.currentTrackId;
      this.isPlayingTrack = true;
      this.stepIndex = 0;

      const VOWELS = [
        { name: '/ɑ/ (Open Symmetry)', f1: 730, f2: 1090, f3: 2440, l: 2, m: 0 },
        { name: '/eɪ/ (Dipole Gate)', f1: 530, f2: 1840, f3: 2480, l: 3, m: 2 },
        { name: '/i/ (High Tesseral)', f1: 270, f2: 2290, f3: 3010, l: 4, m: 3 },
        { name: '/oʊ/ (Toroidal Shell)', f1: 450, f2: 880, f3: 2540, l: 3, m: 1 },
        { name: '/u/ (Zonal Focusing)', f1: 300, f2: 870, f3: 2240, l: 2, m: 1 }
      ];

      const DIALOG_LINES = [
        { speaker: 'NOETHER AI CORE', state: 'SPEAKING', text: 'When continuous phase symmetry holds globally, total probability charge Q remains strictly invariant.' },
        { speaker: 'USER VOICE INPUT', state: 'LISTENING', text: 'Show me how local gauge freedom gives sound vibrations room to sculpt the 3D manifold.' },
        { speaker: 'NOETHER AI CORE', state: 'REASONING', text: 'Searching SO(3) × U(1) fiber bundle... exciting spherical harmonic multipoles (ℓ = 4, m = 3).' },
        { speaker: 'NOETHER AI CORE', state: 'SPEAKING', text: 'Notice how acoustic waves twist the Hopf fibration circles without breaking the continuity law.' }
      ];

      const tick = () => {
        if (!this.isPlayingTrack) return;
        const s = this.stepIndex++;

        if (this.currentTrackId === 'speech_dialog' || this.currentTrackId === 'speech_reasoning') {
          const lineIdx = Math.floor(s / 8) % DIALOG_LINES.length;
          const line = DIALOG_LINES[lineIdx];
          this.features.aiState = this.currentTrackId === 'speech_reasoning'
            ? ['CONTEMPLATING', 'LISTENING', 'REASONING', 'SPEAKING'][Math.floor(s / 5) % 4]
            : line.state;
          this.features.captionSpeaker = line.speaker;
          this.features.captionText = line.text;

          const v = VOWELS[s % VOWELS.length];
          this.features.vowel = v.name;
          const baseF0 = line.speaker === 'USER VOICE INPUT' ? 118 : 168;
          const f0 = baseF0 + Math.sin(s * 0.7) * 24 + (s % 3) * 11;
          this.playAIVocalSyllable(f0, v.f1, v.f2, v.f3, 0.28);
          this.onStateChange(this.features);
        } else if (this.currentTrackId === 'music_gottingen') {
          // D Dorian Harmonic Field Nocturne (D3, A3, C4, E4, F4, A4, C5, D5)
          const scale = [146.83, 220.00, 261.63, 329.63, 349.23, 440.00, 523.25, 587.33];
          const note = scale[(s * 3 + Math.floor(s / 4)) % scale.length];
          this.playQuantumNote(note, 1.35, 0.45);
          if (s % 4 === 0) this.playQuantumNote(73.42, 2.2, 0.55); // Deep D2 sub-bass pedal
          this.features.captionSpeaker = 'GÖTTINGEN 1918 NOCTURNE';
          this.features.captionText = `Harmonic Fifths in D Dorian · Active Eigenmode f = ${note.toFixed(1)} Hz`;
        } else if (this.currentTrackId === 'music_hopf') {
          // 122 BPM Polyrhythmic IDM + Hopf Arpeggio
          const arp = [196.00, 233.08, 293.66, 349.23, 392.00, 466.16, 587.33, 698.46];
          if (s % 4 === 0) this.playQuantumPercussion('kick');
          if (s % 2 === 1) this.playQuantumPercussion('hat');
          const f = arp[(s * 2 + (s % 3)) % arp.length];
          this.playQuantumNote(f, 0.26, 0.42);
          if (s % 8 === 0) this.playQuantumNote(98.0, 0.85, 0.6);
          this.features.captionSpeaker = 'HOPF CATHEDRAL · 122 BPM IDM';
          this.features.captionText = `Clifford Torus Arpeggiator · Sub-Bass Vortex Lock @ ${f.toFixed(1)} Hz`;
        } else if (this.currentTrackId === 'music_superfluid') {
          // 88 BPM Superfluid BEC Sub-Bass & Microtonal Symmetry Sweep
          if (s % 4 === 0 || s % 8 === 3) this.playQuantumPercussion('kick');
          const bassNotes = [55.0, 65.41, 73.42, 82.41, 110.0];
          const bf = bassNotes[Math.floor(s / 2) % bassNotes.length] * (1 + this.physicsParams.symBreak * 0.04 * Math.sin(s));
          this.playQuantumNote(bf, 0.65, 0.62);
          if (s % 2 === 0) this.playQuantumNote(bf * 3.0, 0.35, 0.3);
          this.features.captionSpeaker = 'SUPERFLUID BEC · QUANTUM BASS';
          this.features.captionText = `Gross-Pitaevskii Vortex Nucleation · Fundamental ${bf.toFixed(1)} Hz`;
        }
      };

      const intervalMs = this.currentTrackId === 'music_hopf' ? 195
        : this.currentTrackId === 'music_gottingen' ? 480
        : this.currentTrackId === 'music_superfluid' ? 310
        : 330;

      tick();
      this.stepTimer = setInterval(tick, intervalMs);
    }

    stopProceduralTrack() {
      this.isPlayingTrack = false;
      if (this.stepTimer) {
        clearInterval(this.stepTimer);
        this.stepTimer = null;
      }
      if (this.fileAudioEl) {
        this.fileAudioEl.pause();
      }
    }

    async toggleMicrophone() {
      const ctx = this.ensureContext();
      if (!ctx) return false;
      if (this.micStream) {
        this.micStream.getTracks().forEach(t => t.stop());
        this.micStream = null;
        this.micSource = null;
        return false;
      }
      try {
        this.stopProceduralTrack();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = stream;
        this.micSource = ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.analyser);
        this.features.aiState = 'LISTENING';
        this.features.captionSpeaker = 'LIVE MICROPHONE INPUT';
        this.features.captionText = 'Listening to live 3D acoustic waves... Speak or sing to sculpt the Noether manifold.';
        this.onStateChange(this.features);
        return true;
      } catch (err) {
        console.warn('[NoetherAudio] Microphone permission declined or unavailable:', err);
        return false;
      }
    }

    loadAudioFile(file) {
      if (!file) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      this.stopProceduralTrack();
      if (!this.fileAudioEl) {
        this.fileAudioEl = new Audio();
        this.fileAudioEl.crossOrigin = 'anonymous';
        this.fileSource = ctx.createMediaElementSource(this.fileAudioEl);
        this.fileSource.connect(this.masterGain);
      }
      const url = URL.createObjectURL(file);
      this.fileAudioEl.src = url;
      this.fileAudioEl.play();
      this.features.captionSpeaker = 'LOCAL AUDIO FILE';
      this.features.captionText = `Playing offline track: ${file.name}`;
      this.onStateChange(this.features);
    }

    // Sample FFT & Waveform every animation frame, with procedural harmonic fallback when idle
    updateAcousticTelemetry(timeSec, mode) {
      if (this.analyser && (this.isPlayingTrack || this.micStream || (this.fileAudioEl && !this.fileAudioEl.paused))) {
        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getByteTimeDomainData(this.timeData);

        const n = this.freqData.length;
        let sub = 0, low = 0, mid = 0, high = 0, total = 0;
        let maxBinVal = 0, maxBinIdx = 1;

        for (let i = 1; i < n; i++) {
          const v = this.freqData[i] / 255.0;
          total += v;
          if (i < 10) sub += v;
          else if (i < 36) low += v;
          else if (i < 140) mid += v;
          else if (i < 420) high += v;
          if (i >= 3 && i < 90 && this.freqData[i] > maxBinVal) {
            maxBinVal = this.freqData[i];
            maxBinIdx = i;
          }
        }

        const subNorm = Math.min(1, sub / 9);
        const lowNorm = Math.min(1, low / 24);
        const midNorm = Math.min(1, mid / 65);
        const highNorm = Math.min(1, high / 140);
        const rms = Math.min(1, (subNorm * 0.35 + lowNorm * 0.35 + midNorm * 0.2 + highNorm * 0.1) * 1.45);
        const flux = Math.max(0, total - this.prevSpectrumSum) / 45.0;
        this.prevSpectrumSum = total;

        this.features.subBass = this.features.subBass * 0.72 + subNorm * 0.28;
        this.features.lowMid = this.features.lowMid * 0.74 + lowNorm * 0.26;
        this.features.highMid = this.features.highMid * 0.74 + midNorm * 0.26;
        this.features.treble = this.features.treble * 0.70 + highNorm * 0.30;
        this.features.rms = this.features.rms * 0.75 + Math.max(0.06, rms) * 0.25;
        this.features.spectralFlux = Math.min(1, this.features.spectralFlux * 0.65 + flux * 0.35);

        if (this.micStream && this.ctx) {
          const binHz = this.ctx.sampleRate / this.analyser.fftSize;
          this.features.f0 = Math.max(85, Math.min(480, maxBinIdx * binHz));
          this.features.F1 = Math.round(320 + this.features.lowMid * 580);
          this.features.F2 = Math.round(920 + this.features.highMid * 1550);
        }
      } else {
        // Autonomous Cohesive Quantum Vacuum Breathing when audio is paused
        const b1 = 0.5 + 0.5 * Math.sin(timeSec * 1.35);
        const b2 = 0.5 + 0.5 * Math.cos(timeSec * 2.1 + 0.8);
        const b3 = 0.5 + 0.5 * Math.sin(timeSec * 3.4);
        this.features.subBass = 0.16 + 0.14 * b1;
        this.features.lowMid = 0.18 + 0.15 * b2;
        this.features.highMid = 0.12 + 0.12 * b3;
        this.features.treble = 0.08 + 0.07 * Math.abs(Math.sin(timeSec * 4.2));
        this.features.rms = 0.16 + 0.10 * b1;
        this.features.spectralFlux = 0.04 * b3;

        // Fill synthetic oscilloscope wave for UI display
        for (let i = 0; i < 256; i++) {
          const u = i / 256;
          this.freqData[i] = Math.max(4, Math.round(170 * Math.exp(-u * 4.5) * (0.55 + 0.45 * Math.sin(u * 18 - timeSec * 4))));
          this.timeData[i] = Math.round(128 + 48 * Math.sin(u * Math.PI * 6 + timeSec * 5) * Math.cos(u * Math.PI * 2 - timeSec * 2));
        }
      }
      return this.features;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     4. MASTER 3D WEBGL / THREE.JS NOETHER QUANTUM FIELD ENGINE
     ────────────────────────────────────────────────────────────────────────── */
  class NoetherQuantumFieldEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.svgOverlay = options.svgOverlay || null;
      this.scopeCanvas = options.scopeCanvas || null;
      this.onTelemetry = options.onTelemetry || function () {};

      // Primary Mode: 'speech' (AI Speech Orb) or 'music' (Music Visualizer & Quantum Synth)
      this.mode = options.mode || 'speech';

      // Variation: 0 = Converged Gold Standard, 1 = Eigen-Orb, 2 = Hopf Cathedral, 3 = Superfluid BEC, 4 = Chladni Cymatics
      this.variation = options.variation != null ? options.variation : 0;
      this.iteration = options.iteration || 3;

      // Physics & Visual Tweak State
      this.params = {
        l: 3,                  // Spherical harmonic degree l ∈ [1, 7]
        m: 2,                  // Azimuthal order m ∈ [-l, l]
        n: 2,                  // Radial shell quantum number n ∈ [1, 5]
        freeRoom: 0.58,        // Noether 2nd Theorem Gauge Slack η_free ∈ [0, 1]
        symBreak: 0.12,        // Symmetry-breaking warp ε ∈ [0, 1]
        stiffness: 0.65,       // Hamiltonian restorative spring ω_0 ∈ [0.1, 1.0]
        vortexCoupling: 0.62,  // Superfluid curl advection κ ∈ [0, 1]
        iridescence: 0.78,     // Thin-film phase shift intensity
        layerOrb: 0.92,        // Layer 1: Spherical Harmonic Eigen-Orb opacity
        layerHopf: 0.85,       // Layer 2: Hopf Fibration Gauge Fibers opacity
        layerParticles: 0.95,  // Layer 3: 14,000 Noether Current Particles opacity
        layerShells: 0.80,     // Layer 4: 3D Acoustic Huygens Wave Shells opacity
        layerCymatics: 0.60,   // Layer 5: Chladni Action Manifold Floor opacity
        autoOrbit: true,
        showVectors: true,
        paletteId: 'cerenkov'
      };

      this.palette = PALETTES.cerenkov;
      this.audio = new NoetherQuantumAudioSynth((feat) => {
        if (options.onAudioStateChange) options.onAudioStateChange(feat);
      });

      // Conserved Noether Telemetry State
      this.telemetry = {
        chargeQ: 1.0000,
        energyH: 2.420,
        angularLz: 2.000,
        gaugeFlux: 0.340,
        actionDeltaS: 0.000,
        fps: 60
      };

      // Camera Orbit State
      this.cameraState = {
        yaw: 0.42,
        pitch: 0.28,
        distance: 8.6,
        targetYaw: 0.42,
        targetPitch: 0.28,
        targetDistance: 8.6,
        dragging: false,
        lastX: 0,
        lastY: 0
      };

      this.time = 0;
      this.lastFrameTime = performance.now();
      this.fpsSmoothed = 60;

      // Damped Harmonic Oscillator State for multipoles c_lm(t)
      this.harmonicPhase = 0;
      this.radialExpansion = 0;
      this.radialVelocity = 0;
      this.precessionAngle = 0;

      this._initThreeScene();
      this._buildLayer1EigenOrb();
      this._buildLayer2HopfCathedral();
      this._buildLayer3SuperfluidParticles();
      this._buildLayer4HuygensWaveShells();
      this._buildLayer5ChladniCymatics();
      this._bindPointerControls();
      this.applyVariationPreset(this.variation, this.iteration);
    }

    _initThreeScene() {
      const w = this.canvas.clientWidth || window.innerWidth || 1280;
      const h = this.canvas.clientHeight || window.innerHeight || 720;

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1.5, 2));
      this.renderer.setSize(w, h);
      this.renderer.setClearColor(this.palette.bg, 1);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, w / Math.max(1, h), 0.1, 200);

      if (THREE.AmbientLight) {
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
        dir1.position.set(7, 12, 9);
        const dir2 = new THREE.DirectionalLight(0x58c4dd, 0.55);
        dir2.position.set(-8, -5, -6);
        this.scene.add(amb);
        this.scene.add(dir1);
        this.scene.add(dir2);
      }

      window.addEventListener('resize', () => {
        const nw = this.canvas.clientWidth || window.innerWidth;
        const nh = this.canvas.clientHeight || window.innerHeight;
        this.camera.aspect = nw / Math.max(1, nh);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw, nh);
      });
    }

    /* ── LAYER 1: SPHERICAL HARMONIC EIGEN-ORB (S² Quantum Wavefunction Shell) ── */
    _buildLayer1EigenOrb() {
      this.orbGroup = new THREE.Group();
      this.scene.add(this.orbGroup);

      const N_THETA = 64;
      const N_PHI = 96;
      this.orbTheta = N_THETA;
      this.orbPhi = N_PHI;

      const vCount = (N_THETA + 1) * (N_PHI + 1);
      this.orbPositions = new Float32Array(vCount * 3);
      this.orbColors = new Float32Array(vCount * 3);
      this.orbBaseDirs = new Float32Array(vCount * 3);
      this.orbSpherical = new Float32Array(vCount * 2); // [cosTheta, phi]

      let ptr = 0, sPtr = 0;
      for (let i = 0; i <= N_THETA; i++) {
        const theta = (i / N_THETA) * Math.PI;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        for (let j = 0; j <= N_PHI; j++) {
          const phi = (j / N_PHI) * Math.PI * 2;
          const ux = sinT * Math.cos(phi);
          const uy = cosT;
          const uz = sinT * Math.sin(phi);
          this.orbBaseDirs[ptr] = ux;
          this.orbBaseDirs[ptr + 1] = uy;
          this.orbBaseDirs[ptr + 2] = uz;
          this.orbSpherical[sPtr] = cosT;
          this.orbSpherical[sPtr + 1] = phi;
          ptr += 3;
          sPtr += 2;
        }
      }

      const indices = [];
      for (let i = 0; i < N_THETA; i++) {
        for (let j = 0; j < N_PHI; j++) {
          const a = i * (N_PHI + 1) + j;
          const b = a + 1;
          const c = a + (N_PHI + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      this.orbGeom = new THREE.BufferGeometry();
      this.orbGeom.setIndex(indices);
      this.orbGeom.setAttribute('position', new THREE.Float32BufferAttribute(this.orbPositions, 3));
      this.orbGeom.setAttribute('color', new THREE.Float32BufferAttribute(this.orbColors, 3));

      this.orbMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide
      });
      this.orbMesh = new THREE.Mesh(this.orbGeom, this.orbMat);
      this.orbGroup.add(this.orbMesh);

      // Precision Nodal Meridian & Parallel Contour Wireframe on the Orb
      const wireSegs = [];
      for (let i = 2; i < N_THETA; i += 4) {
        for (let j = 0; j < N_PHI; j++) {
          const a = i * (N_PHI + 1) + j;
          wireSegs.push(a, a + 1);
        }
      }
      for (let j = 0; j < N_PHI; j += 6) {
        for (let i = 0; i < N_THETA; i++) {
          const a = i * (N_PHI + 1) + j;
          wireSegs.push(a, a + (N_PHI + 1));
        }
      }
      this.orbWireGeom = new THREE.BufferGeometry();
      this.orbWireGeom.setIndex(wireSegs);
      this.orbWireGeom.setAttribute('position', this.orbGeom.attributes.position);
      this.orbWireGeom.setAttribute('color', this.orbGeom.attributes.color);
      this.orbWireMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55
      });
      this.orbWire = new THREE.LineSegments(this.orbWireGeom, this.orbWireMat);
      this.orbGroup.add(this.orbWire);
    }

    /* ── LAYER 2: HOPF FIBRATION GAUGE CATHEDRAL (S³ → S² Villarceau Circles) ── */
    _buildLayer2HopfCathedral() {
      this.hopfGroup = new THREE.Group();
      this.scene.add(this.hopfGroup);

      this.hopfFiberCount = 36;
      this.hopfSegsPerFiber = 72;
      const totalVerts = this.hopfFiberCount * this.hopfSegsPerFiber * 2;
      this.hopfPositions = new Float32Array(totalVerts * 3);
      this.hopfColors = new Float32Array(totalVerts * 3);

      this.hopfGeom = new THREE.BufferGeometry();
      this.hopfGeom.setAttribute('position', new THREE.Float32BufferAttribute(this.hopfPositions, 3));
      this.hopfGeom.setAttribute('color', new THREE.Float32BufferAttribute(this.hopfColors, 3));

      this.hopfMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending
      });
      this.hopfLines = new THREE.LineSegments(this.hopfGeom, this.hopfMat);
      this.hopfGroup.add(this.hopfLines);
    }

    /* ── LAYER 3: 12,000 ADVECTED NOETHER CURRENT & SUPERFLUID VORTEX PARTICLES ── */
    _buildLayer3SuperfluidParticles() {
      this.particleCount = 12000;
      this.ptPositions = new Float32Array(this.particleCount * 3);
      this.ptColors = new Float32Array(this.particleCount * 3);
      this.ptState = new Float32Array(this.particleCount * 4); // [theta, phi, radiusShell, phaseSeed]

      for (let i = 0; i < this.particleCount; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = Math.acos(2 * u - 1);
        const phi = 2 * Math.PI * v;
        const rShell = 1.15 + Math.pow(Math.random(), 1.3) * 2.6;
        const i4 = i * 4;
        this.ptState[i4] = theta;
        this.ptState[i4 + 1] = phi;
        this.ptState[i4 + 2] = rShell;
        this.ptState[i4 + 3] = Math.random() * Math.PI * 2;

        const i3 = i * 3;
        this.ptPositions[i3] = rShell * Math.sin(theta) * Math.cos(phi);
        this.ptPositions[i3 + 1] = rShell * Math.cos(theta);
        this.ptPositions[i3 + 2] = rShell * Math.sin(theta) * Math.sin(phi);
      }

      this.ptGeom = new THREE.BufferGeometry();
      this.ptGeom.setAttribute('position', new THREE.Float32BufferAttribute(this.ptPositions, 3));
      this.ptGeom.setAttribute('color', new THREE.Float32BufferAttribute(this.ptColors, 3));

      this.ptMat = new THREE.PointsMaterial({
        size: 0.048,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending
      });
      this.ptCloud = new THREE.Points(this.ptGeom, this.ptMat);
      this.scene.add(this.ptCloud);
    }

    /* ── LAYER 4: 3D ACOUSTIC HUYGENS WAVEFRONT SHELLS & PRECESSION RINGS ── */
    _buildLayer4HuygensWaveShells() {
      this.shellsGroup = new THREE.Group();
      this.scene.add(this.shellsGroup);

      this.shellCount = 6;
      this.shellSegs = 96;
      const totalPts = this.shellCount * this.shellSegs * 2 * 2; // Equatorial + Meridian wave rings
      this.shellPositions = new Float32Array(totalPts * 3);
      this.shellColors = new Float32Array(totalPts * 3);

      this.shellGeom = new THREE.BufferGeometry();
      this.shellGeom.setAttribute('position', new THREE.Float32BufferAttribute(this.shellPositions, 3));
      this.shellGeom.setAttribute('color', new THREE.Float32BufferAttribute(this.shellColors, 3));

      this.shellMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending
      });
      this.shellLines = new THREE.LineSegments(this.shellGeom, this.shellMat);
      this.shellsGroup.add(this.shellLines);
    }

    /* ── LAYER 5: CHLADNI-LAGRANGIAN CYMATIC MANIFOLD & ACTION CONTOURS ── */
    _buildLayer5ChladniCymatics() {
      this.cymaticGroup = new THREE.Group();
      this.scene.add(this.cymaticGroup);

      const GRID_N = 44;
      this.cymGridN = GRID_N;
      const segCount = GRID_N * (GRID_N - 1) * 4;
      this.cymPositions = new Float32Array(segCount * 3);
      this.cymColors = new Float32Array(segCount * 3);

      this.cymGeom = new THREE.BufferGeometry();
      this.cymGeom.setAttribute('position', new THREE.Float32BufferAttribute(this.cymPositions, 3));
      this.cymGeom.setAttribute('color', new THREE.Float32BufferAttribute(this.cymColors, 3));

      this.cymMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.45
      });
      this.cymLines = new THREE.LineSegments(this.cymGeom, this.cymMat);
      this.cymaticGroup.add(this.cymLines);
    }

    /* ── INTERACTIVE 3D CAMERA ORBIT & ZOOM ── */
    _bindPointerControls() {
      const el = this.canvas;
      el.addEventListener('pointerdown', (e) => {
        this.cameraState.dragging = true;
        this.cameraState.lastX = e.clientX;
        this.cameraState.lastY = e.clientY;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => {
        if (!this.cameraState.dragging) return;
        const dx = e.clientX - this.cameraState.lastX;
        const dy = e.clientY - this.cameraState.lastY;
        this.cameraState.lastX = e.clientX;
        this.cameraState.lastY = e.clientY;
        this.cameraState.targetYaw -= dx * 0.0065;
        this.cameraState.targetPitch = Math.max(-1.35, Math.min(1.35, this.cameraState.targetPitch + dy * 0.0065));
      });
      const stopDrag = () => { this.cameraState.dragging = false; };
      el.addEventListener('pointerup', stopDrag);
      el.addEventListener('pointercancel', stopDrag);
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.cameraState.targetDistance = Math.max(4.2, Math.min(16.5, this.cameraState.targetDistance + e.deltaY * 0.005));
      }, { passive: false });
    }

    /* ── VARIATION & ITERATION PRESET CONFIGURATOR ── */
    applyVariationPreset(variationId, iteration = 3) {
      this.variation = Number(variationId);
      this.iteration = Number(iteration);

      // Iteration 1 -> 2 -> 3 adjusts geometric richness and shader polish
      const iterScale = this.iteration === 1 ? 0.42 : this.iteration === 2 ? 0.75 : 1.0;
      this.ptMat.size = this.iteration === 1 ? 0.075 : this.iteration === 2 ? 0.055 : 0.046;

      if (this.variation === 1) {
        // Variation I: Spherical Harmonic Eigen-Orb Focus
        this.params.layerOrb = 0.98 * iterScale;
        this.params.layerHopf = this.iteration === 3 ? 0.28 : 0.0;
        this.params.layerParticles = 0.85 * iterScale;
        this.params.layerShells = this.iteration >= 2 ? 0.92 : 0.25;
        this.params.layerCymatics = 0.22;
      } else if (this.variation === 2) {
        // Variation II: Hopf Fibration Gauge Cathedral Focus
        this.params.layerOrb = 0.30;
        this.params.layerHopf = 1.00;
        this.params.layerParticles = 0.78 * iterScale;
        this.params.layerShells = 0.45;
        this.params.layerCymatics = 0.30;
      } else if (this.variation === 3) {
        // Variation III: Gross-Pitaevskii Superfluid BEC Vortex Lattice Focus
        this.params.layerOrb = 0.22;
        this.params.layerHopf = 0.42 * iterScale;
        this.params.layerParticles = 1.00;
        this.params.layerShells = 0.85 * iterScale;
        this.params.layerCymatics = 0.35;
      } else if (this.variation === 4) {
        // Variation IV: Chladni-Lagrangian Cymatic Tensor Manifold Focus
        this.params.layerOrb = 0.55;
        this.params.layerHopf = 0.25;
        this.params.layerParticles = 0.88;
        this.params.layerShells = 0.60;
        this.params.layerCymatics = 1.00;
      } else {
        // Variation 0: Converged Gold Standard Hybrid (All 5 Layers Harmonized)
        this.params.layerOrb = 0.88;
        this.params.layerHopf = 0.85;
        this.params.layerParticles = 0.95;
        this.params.layerShells = 0.82;
        this.params.layerCymatics = 0.62;
      }
    }

    setPalette(paletteId) {
      if (PALETTES[paletteId]) {
        this.params.paletteId = paletteId;
        this.palette = PALETTES[paletteId];
        this.renderer.setClearColor(this.palette.bg, 1);
      }
    }

    setMode(mode) {
      this.mode = mode === 'music' ? 'music' : 'speech';
      if (this.mode === 'speech') {
        this.cameraState.targetDistance = 7.6;
        this.cameraState.targetPitch = 0.22;
      } else {
        this.cameraState.targetDistance = 9.4;
        this.cameraState.targetPitch = 0.34;
      }
    }

    // Apply one of the 5 Right-Edge Noether Symmetry Presets
    applySymmetryLawPreset(presetNum) {
      const p = Number(presetNum);
      if (p === 1) {
        // 01: U(1) Global Phase Unity
        Object.assign(this.params, { l: 2, m: 0, freeRoom: 0.35, symBreak: 0.0, vortexCoupling: 0.45 });
      } else if (p === 2) {
        // 02: SO(3) Speech Multipole Resonance
        Object.assign(this.params, { l: 4, m: 3, freeRoom: 0.58, symBreak: 0.08, vortexCoupling: 0.55 });
      } else if (p === 3) {
        // 03: Hopf Gauge Cathedral (Local Fiber Freedom)
        Object.assign(this.params, { l: 3, m: 2, freeRoom: 0.82, symBreak: 0.14, vortexCoupling: 0.72 });
      } else if (p === 4) {
        // 04: Superfluid BEC Vortex Turbulence
        Object.assign(this.params, { l: 5, m: 4, freeRoom: 0.90, symBreak: 0.22, vortexCoupling: 0.95 });
      } else if (p === 5) {
        // 05: Broken Symmetry Precession (ε cos mθ)
        Object.assign(this.params, { l: 4, m: 2, freeRoom: 0.68, symBreak: 0.78, vortexCoupling: 0.65 });
      }
      this._syncAudioPhysics();
    }

    _syncAudioPhysics() {
      Object.assign(this.audio.physicsParams, {
        l: this.params.l,
        m: this.params.m,
        freeRoom: this.params.freeRoom,
        symBreak: this.params.symBreak
      });
    }

    /* ── MAIN 60FPS PHYSICS & WEBGL RENDERING LOOP ── */
    updateFrame(nowMs) {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameTime) * 0.001));
      this.lastFrameTime = nowMs;
      this.time += dt;
      this.fpsSmoothed = this.fpsSmoothed * 0.92 + (1.0 / dt) * 0.08;

      this._syncAudioPhysics();
      const ac = this.audio.updateAcousticTelemetry(this.time, this.mode);
      const pal = this.palette;

      // 1. Solve Damped Relativistic Harmonic Oscillator for Radial Expansion & Phase
      //    ddot(r) + 2*zeta*omega*dot(r) + omega^2 * r = F_audio * freeRoom
      const omega0 = 3.5 + this.params.stiffness * 6.5;
      const zeta = 0.38;
      const acousticForce = (ac.subBass * 1.4 + ac.rms * 0.9 + ac.spectralFlux * 1.6) * (0.35 + this.params.freeRoom * 1.35);
      const accel = acousticForce * 8.0 - 2.0 * zeta * omega0 * this.radialVelocity - (omega0 * omega0 * 0.18) * this.radialExpansion;
      this.radialVelocity += accel * dt;
      this.radialExpansion += this.radialVelocity * dt;

      // Phase velocity driven by U(1) current & pitch f0
      const phaseSpeed = 1.4 + (ac.f0 / 160.0) * 1.8 + ac.highMid * 3.2;
      this.harmonicPhase += dt * phaseSpeed;

      // Symmetry-breaking angular momentum precession angle
      this.precessionAngle += dt * (this.params.symBreak * 2.2 + ac.lowMid * 0.6);

      // In Speech Mode, allow vowel formants F1/F2 to subtly modulate effective multipole mix
      const lPrimary = Math.max(1, Math.min(7, Math.round(this.params.l)));
      const mPrimary = Math.max(-lPrimary, Math.min(lPrimary, Math.round(this.params.m)));
      const lSecondary = this.mode === 'speech'
        ? Math.max(1, Math.min(7, Math.round((ac.F1 - 250) / 130)))
        : Math.min(7, lPrimary + 2);
      const mSecondary = this.mode === 'speech'
        ? Math.max(0, Math.min(lSecondary, Math.round((ac.F2 - 700) / 420)))
        : Math.max(1, (Math.abs(mPrimary) + 1) % (lSecondary + 1));

      const freeRoomAmp = 0.22 + this.params.freeRoom * 0.95;
      const baseRadius = (this.mode === 'speech' ? 1.68 : 1.52) + this.radialExpansion * 0.42;

      /* ── UPDATE LAYER 1: SPHERICAL HARMONIC EIGEN-ORB ── */
      this.orbGroup.visible = this.params.layerOrb > 0.02;
      if (this.orbGroup.visible) {
        this.orbMat.opacity = this.params.layerOrb * 0.58;
        this.orbWireMat.opacity = this.params.layerOrb * 0.62;

        const vCount = (this.orbTheta + 1) * (this.orbPhi + 1);
        const pos = this.orbPositions;
        const col = this.orbColors;
        const dirs = this.orbBaseDirs;
        const sph = this.orbSpherical;

        const c1 = pal.cyan, c2 = pal.gold, c3 = pal.mint, c4 = pal.coral, c5 = pal.violet;
        const symBreak = this.params.symBreak;

        for (let k = 0; k < vCount; k++) {
          const k3 = k * 3;
          const k2 = k * 2;
          const cosT = sph[k2];
          const phi = sph[k2 + 1];

          // Primary Spherical Harmonic Y_l^m + Secondary Formant/Music Overtone Harmonic
          const y1 = evalSphericalHarmonic(lPrimary, mPrimary, cosT, phi, this.harmonicPhase);
          const y2 = evalSphericalHarmonic(lSecondary, mSecondary, cosT, phi, -this.harmonicPhase * 1.35);
          // Symmetry-breaking perturbation ε cos(m*phi)
          const symWarp = symBreak * 0.38 * Math.cos((Math.abs(mPrimary) || 2) * phi - this.precessionAngle) * (1.0 - cosT * cosT);

          const waveAmp = (y1 * (0.52 + ac.lowMid * 0.65) + y2 * (0.28 + ac.highMid * 0.72) + symWarp) * freeRoomAmp;
          const r = Math.max(0.45, baseRadius + waveAmp);

          // Tangential gauge twist along azimuthal direction proportional to local gauge potential A_phi
          const twist = this.params.freeRoom * 0.18 * ac.spectralFlux * Math.sin(lPrimary * Math.acos(cosT) + this.harmonicPhase);
          const ux = dirs[k3], uy = dirs[k3 + 1], uz = dirs[k3 + 2];

          pos[k3] = ux * r - uz * twist;
          pos[k3 + 1] = uy * r;
          pos[k3 + 2] = uz * r + ux * twist;

          // Thin-film quantum phase & nodal line coloring
          const absWave = Math.min(1, Math.abs(waveAmp) * 1.65);
          const nodalProximity = Math.exp(-absWave * absWave * 14.0); // Glowing nodal lines where Y_lm = 0!
          const posLobe = waveAmp >= 0 ? 1 : 0;

          const irid = 0.5 + 0.5 * Math.sin(waveAmp * 6.0 + this.time * 1.5);
          const rCol = nodalProximity * c2[0] + (1 - nodalProximity) * (posLobe ? c1[0] : c5[0]) * (0.65 + 0.55 * absWave) + symBreak * 0.25 * c4[0];
          const gCol = nodalProximity * c2[1] + (1 - nodalProximity) * (posLobe ? c1[1] : c3[1]) * (0.65 + 0.55 * absWave) + irid * 0.15 * c3[1];
          const bCol = nodalProximity * c2[2] + (1 - nodalProximity) * (posLobe ? c1[2] : c5[2]) * (0.75 + 0.45 * absWave);

          col[k3] = Math.min(1, rCol);
          col[k3 + 1] = Math.min(1, gCol);
          col[k3 + 2] = Math.min(1, bCol);
        }

        this.orbGeom.attributes.position.needsUpdate = true;
        this.orbGeom.attributes.color.needsUpdate = true;

        // Precess the Orb axis subtly when Symmetry Breaking ε > 0
        this.orbGroup.rotation.z = Math.sin(this.precessionAngle) * this.params.symBreak * 0.28;
        this.orbGroup.rotation.x = Math.cos(this.precessionAngle * 0.8) * this.params.symBreak * 0.18;
      }

      /* ── UPDATE LAYER 2: HOPF FIBRATION GAUGE CATHEDRAL ── */
      this.hopfGroup.visible = this.params.layerHopf > 0.02;
      if (this.hopfGroup.visible) {
        this.hopfMat.opacity = this.params.layerHopf * 0.82;
        const hPos = this.hopfPositions;
        const hCol = this.hopfColors;
        let ptr = 0;

        // Gauge Free-Room expands the Clifford torus angle eta and scale
        const hopfScale = 1.42 + this.params.freeRoom * 0.78 + ac.subBass * 0.45;
        const baseEta = 0.52 + 0.32 * Math.sin(this.time * 0.45) + this.params.freeRoom * 0.24;

        for (let f = 0; f < this.hopfFiberCount; f++) {
          const shellIdx = f % 3;
          const eta = Math.max(0.22, Math.min(1.36, baseEta + (shellIdx - 1) * (0.22 + ac.lowMid * 0.15)));
          const xi1 = (f / this.hopfFiberCount) * Math.PI * 2 + this.harmonicPhase * 0.22 * (shellIdx === 1 ? -1 : 1);

          for (let s = 0; s < this.hopfSegsPerFiber; s++) {
            const xi2A = (s / this.hopfSegsPerFiber) * Math.PI * 2;
            const xi2B = ((s + 1) / this.hopfSegsPerFiber) * Math.PI * 2;

            const pA = hopfFiberPoint(eta, xi1, xi2A, hopfScale);
            const pB = hopfFiberPoint(eta, xi1, xi2B, hopfScale);

            hPos[ptr] = pA[0]; hPos[ptr + 1] = pA[1]; hPos[ptr + 2] = pA[2];
            hPos[ptr + 3] = pB[0]; hPos[ptr + 4] = pB[1]; hPos[ptr + 5] = pB[2];

            // Luminous U(1) Noether phase pulse racing along the fiber
            const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(xi2A * lPrimary - this.harmonicPhase * 2.2 + f * 0.5), 3);
            const cA = shellIdx === 0 ? pal.cyan : shellIdx === 1 ? pal.gold : pal.mint;

            hCol[ptr] = cA[0] * pulse;
            hCol[ptr + 1] = cA[1] * pulse;
            hCol[ptr + 2] = cA[2] * pulse;
            hCol[ptr + 3] = cA[0] * pulse;
            hCol[ptr + 4] = cA[1] * pulse;
            hCol[ptr + 5] = cA[2] * pulse;

            ptr += 6;
          }
        }
        this.hopfGeom.attributes.position.needsUpdate = true;
        this.hopfGeom.attributes.color.needsUpdate = true;
        this.hopfGroup.rotation.y = this.time * 0.12;
      }

      /* ── UPDATE LAYER 3: 12,000 ADVECTED NOETHER CURRENT & SUPERFLUID PARTICLES ── */
      this.ptCloud.visible = this.params.layerParticles > 0.02;
      if (this.ptCloud.visible) {
        this.ptMat.opacity = this.params.layerParticles * 0.88;
        const pPos = this.ptPositions;
        const pCol = this.ptColors;
        const pSt = this.ptState;

        const vortexDrive = (0.25 + this.params.vortexCoupling * 1.45) * (0.4 + ac.rms * 1.5);
        const freeSpread = 0.35 + this.params.freeRoom * 1.25;

        for (let i = 0; i < this.particleCount; i++) {
          const i4 = i * 4;
          const i3 = i * 3;
          let theta = pSt[i4];
          let phi = pSt[i4 + 1];
          const rBase = pSt[i4 + 2];
          const seed = pSt[i4 + 3];

          const cosT = Math.cos(theta);
          const sinT = Math.max(0.05, Math.sin(theta));

          // Evaluate Spherical Harmonic potential & divergence-free Noether Curl Current J
          const yVal = evalSphericalHarmonic(lPrimary, mPrimary, cosT, phi, this.harmonicPhase * 0.6);
          const dTheta = Math.sin(lPrimary * theta + seed * 0.4) * Math.cos(mPrimary * phi + this.harmonicPhase);
          const dPhi = (mPrimary || 1) * Math.cos(lPrimary * theta) + this.params.symBreak * Math.sin(2 * phi - this.precessionAngle);

          // Incompressible Hamiltonian stream advection on (theta, phi)
          theta += (dTheta * 0.38 * vortexDrive) * dt;
          phi += (dPhi * 0.52 * vortexDrive / (0.35 + sinT)) * dt;

          // Keep theta softly wrapped in (0.04, π - 0.04)
          if (theta < 0.04) theta = Math.PI - 0.05;
          if (theta > Math.PI - 0.04) theta = 0.05;
          pSt[i4] = theta;
          pSt[i4 + 1] = phi;

          // Radial position combines shell radius + Spherical Harmonic nodal wave + Superfluid Vortex Ring modulation
          const vortexRingWave = Math.sin(rBase * 3.2 - this.harmonicPhase * 1.6 + seed) * ac.subBass * freeSpread * 0.55;
          const r = Math.max(0.55, rBase * (0.75 + 0.35 * freeSpread) + yVal * 0.55 * freeSpread + vortexRingWave + this.radialExpansion * 0.35);

          const sT = Math.sin(theta), cT = Math.cos(theta);
          pPos[i3] = r * sT * Math.cos(phi);
          pPos[i3 + 1] = r * cT;
          pPos[i3 + 2] = r * sT * Math.sin(phi);

          // Color by Noether Current velocity & quantum shell
          const speedNorm = Math.min(1, Math.abs(yVal) * 1.4 + ac.highMid * 0.8);
          const cShell = (i % 3 === 0) ? pal.cyan : (i % 3 === 1) ? pal.gold : pal.mint;
          pCol[i3] = Math.min(1, cShell[0] * (0.55 + 0.65 * speedNorm));
          pCol[i3 + 1] = Math.min(1, cShell[1] * (0.55 + 0.65 * speedNorm));
          pCol[i3 + 2] = Math.min(1, cShell[2] * (0.65 + 0.55 * speedNorm));
        }

        this.ptGeom.attributes.position.needsUpdate = true;
        this.ptGeom.attributes.color.needsUpdate = true;
      }

      /* ── UPDATE LAYER 4: 3D ACOUSTIC HUYGENS WAVEFRONT SHELLS ── */
      this.shellsGroup.visible = this.params.layerShells > 0.02;
      if (this.shellsGroup.visible) {
        this.shellMat.opacity = this.params.layerShells * 0.72;
        const sPos = this.shellPositions;
        const sCol = this.shellColors;
        let ptr = 0;

        // In Speech Mode LISTENING state, waves propagate inward; in SPEAKING / MUSIC, outward
        const dirSign = (this.mode === 'speech' && ac.aiState === 'LISTENING') ? -1.0 : 1.0;

        for (let s = 0; s < this.shellCount; s++) {
          const phaseProgress = ((s / this.shellCount) + dirSign * this.time * 0.28 + 100.0) % 1.0;
          const shellR = 1.85 + phaseProgress * (1.8 + this.params.freeRoom * 1.6);
          const fade = Math.sin(phaseProgress * Math.PI);
          const ringColor = (s % 2 === 0) ? pal.cyan : pal.gold;

          // Ring A: Tilted Equatorial Huygens Acoustic Wavefront
          const tilt = (s - 2.5) * 0.22 + this.params.symBreak * 0.35 * Math.sin(this.precessionAngle + s);
          const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);

          for (let j = 0; j < this.shellSegs; j++) {
            const a1 = (j / this.shellSegs) * Math.PI * 2;
            const a2 = ((j + 1) / this.shellSegs) * Math.PI * 2;

            const w1 = 1.0 + 0.08 * (ac.highMid + ac.rms) * Math.cos(lPrimary * a1 + this.harmonicPhase * 2);
            const w2 = 1.0 + 0.08 * (ac.highMid + ac.rms) * Math.cos(lPrimary * a2 + this.harmonicPhase * 2);

            const r1 = shellR * w1, r2 = shellR * w2;
            const x1 = r1 * Math.cos(a1), z1 = r1 * Math.sin(a1);
            const x2 = r2 * Math.cos(a2), z2 = r2 * Math.sin(a2);

            sPos[ptr] = x1 * cosTilt;
            sPos[ptr + 1] = x1 * sinTilt;
            sPos[ptr + 2] = z1;
            sPos[ptr + 3] = x2 * cosTilt;
            sPos[ptr + 4] = x2 * sinTilt;
            sPos[ptr + 5] = z2;

            for (let c = 0; c < 6; c += 3) {
              sCol[ptr + c] = ringColor[0] * fade;
              sCol[ptr + c + 1] = ringColor[1] * fade;
              sCol[ptr + c + 2] = ringColor[2] * fade;
            }
            ptr += 6;
          }

          // Ring B: Orthogonal Polar Standing-Wave Meridian
          for (let j = 0; j < this.shellSegs; j++) {
            const a1 = (j / this.shellSegs) * Math.PI * 2;
            const a2 = ((j + 1) / this.shellSegs) * Math.PI * 2;
            const rotPhi = (s / this.shellCount) * Math.PI + this.harmonicPhase * 0.15;

            const r1 = shellR * (1.0 + 0.07 * ac.lowMid * Math.sin(mPrimary * a1 - this.harmonicPhase));
            const r2 = shellR * (1.0 + 0.07 * ac.lowMid * Math.sin(mPrimary * a2 - this.harmonicPhase));

            sPos[ptr] = r1 * Math.sin(a1) * Math.cos(rotPhi);
            sPos[ptr + 1] = r1 * Math.cos(a1);
            sPos[ptr + 2] = r1 * Math.sin(a1) * Math.sin(rotPhi);

            sPos[ptr + 3] = r2 * Math.sin(a2) * Math.cos(rotPhi);
            sPos[ptr + 4] = r2 * Math.cos(a2);
            sPos[ptr + 5] = r2 * Math.sin(a2) * Math.sin(rotPhi);

            for (let c = 0; c < 6; c += 3) {
              sCol[ptr + c] = pal.mint[0] * fade * 0.75;
              sCol[ptr + c + 1] = pal.mint[1] * fade * 0.75;
              sCol[ptr + c + 2] = pal.mint[2] * fade * 0.75;
            }
            ptr += 6;
          }
        }

        this.shellGeom.attributes.position.needsUpdate = true;
        this.shellGeom.attributes.color.needsUpdate = true;
      }

      /* ── UPDATE LAYER 5: CHLADNI-LAGRANGIAN CYMATIC ACTION MANIFOLD ── */
      this.cymaticGroup.visible = this.params.layerCymatics > 0.02;
      if (this.cymaticGroup.visible) {
        this.cymMat.opacity = this.params.layerCymatics * 0.48;
        const cPos = this.cymPositions;
        const cCol = this.cymColors;
        const N = this.cymGridN;
        const span = 5.4;
        const yFloor = -2.85;
        let ptr = 0;

        const chladniHeight = (x, z) => {
          const r = Math.hypot(x, z);
          const th = Math.atan2(z, x);
          // Chladni Nodal Equation + Symmetry-Breaking Action Trough
          const cWave = Math.cos(lPrimary * x * 0.65) * Math.cos(mPrimary * z * 0.65) - Math.cos(mPrimary * x * 0.65) * Math.cos(lPrimary * z * 0.65);
          const symTerm = this.params.symBreak * 0.35 * Math.cos((Math.abs(mPrimary) || 2) * th - this.precessionAngle) * Math.exp(-r * 0.25);
          const ripple = Math.sin(r * 2.4 - this.harmonicPhase * 1.4) * (0.18 + ac.subBass * 0.45) * Math.exp(-r * 0.22);
          return yFloor + (cWave * 0.16 * (0.4 + ac.lowMid) + symTerm + ripple) * (0.5 + this.params.freeRoom * 0.7);
        };

        for (let i = 0; i < N; i++) {
          const u = (i / (N - 1)) * 2 - 1;
          const coordFixed = u * span;
          for (let j = 0; j < N - 1; j++) {
            const v1 = (j / (N - 1)) * 2 - 1;
            const v2 = ((j + 1) / (N - 1)) * 2 - 1;
            const c1 = v1 * span, c2 = v2 * span;

            // X-line segment
            const yA1 = chladniHeight(c1, coordFixed);
            const yA2 = chladniHeight(c2, coordFixed);
            cPos[ptr] = c1; cPos[ptr + 1] = yA1; cPos[ptr + 2] = coordFixed;
            cPos[ptr + 3] = c2; cPos[ptr + 4] = yA2; cPos[ptr + 5] = coordFixed;

            const nodalGlow = Math.exp(-Math.abs(yA1 - yFloor) * 5.0);
            const colRef = nodalGlow > 0.65 ? pal.gold : pal.cyan;
            const edgeFade = Math.max(0.08, 1.0 - Math.hypot(u, v1) * 0.62);
            for (let k = 0; k < 6; k += 3) {
              cCol[ptr + k] = colRef[0] * edgeFade;
              cCol[ptr + k + 1] = colRef[1] * edgeFade;
              cCol[ptr + k + 2] = colRef[2] * edgeFade;
            }
            ptr += 6;

            // Z-line segment
            const yB1 = chladniHeight(coordFixed, c1);
            const yB2 = chladniHeight(coordFixed, c2);
            cPos[ptr] = coordFixed; cPos[ptr + 1] = yB1; cPos[ptr + 2] = c1;
            cPos[ptr + 3] = coordFixed; cPos[ptr + 4] = yB2; cPos[ptr + 5] = c2;
            for (let k = 0; k < 6; k += 3) {
              cCol[ptr + k] = pal.cyan[0] * edgeFade * 0.75;
              cCol[ptr + k + 1] = pal.cyan[1] * edgeFade * 0.75;
              cCol[ptr + k + 2] = pal.cyan[2] * edgeFade * 0.75;
            }
            ptr += 6;
          }
        }

        this.cymGeom.attributes.position.needsUpdate = true;
        this.cymGeom.attributes.color.needsUpdate = true;
      }

      /* ── UPDATE CAMERA CHOREOGRAPHY ── */
      if (this.params.autoOrbit && !this.cameraState.dragging) {
        this.cameraState.targetYaw += dt * (0.14 + ac.lowMid * 0.08);
      }
      this.cameraState.yaw += (this.cameraState.targetYaw - this.cameraState.yaw) * 0.08;
      this.cameraState.pitch += (this.cameraState.targetPitch - this.cameraState.pitch) * 0.08;
      this.cameraState.distance += (this.cameraState.targetDistance - this.cameraState.distance) * 0.08;

      const d = this.cameraState.distance;
      const cp = Math.cos(this.cameraState.pitch);
      this.camera.position.set(
        d * cp * Math.sin(this.cameraState.yaw),
        d * Math.sin(this.cameraState.pitch),
        d * cp * Math.cos(this.cameraState.yaw)
      );
      this.camera.lookAt(0, -0.15, 0);

      this.renderer.render(this.scene, this.camera);

      /* ── UPDATE LIVE CONSERVED NOETHER TELEMETRY & 2D OSCILLOSCOPE ── */
      // Conserved Charge Q = ∫|ψ|²dV stays locked at 1.0000 despite wild local gauge undulations!
      this.telemetry.chargeQ = 1.0000;
      this.telemetry.energyH = 1.80 + ac.rms * 3.40 + 0.5 * this.radialVelocity * this.radialVelocity;
      // Angular Momentum L_z = m*ħ when symmetric (ε = 0), precesses when ε > 0
      this.telemetry.angularLz = mPrimary + this.params.symBreak * 0.85 * Math.sin(this.precessionAngle);
      this.telemetry.gaugeFlux = this.params.freeRoom * (0.45 + ac.spectralFlux * 1.8);
      this.telemetry.actionDeltaS = this.params.symBreak * 0.42 * Math.abs(Math.sin(this.harmonicPhase));
      this.telemetry.fps = Math.round(this.fpsSmoothed);

      this._renderSvgVectorOverlay(ac);
      this._renderScopeCanvas(ac);
      this.onTelemetry(this.telemetry, ac, this.params);
    }

    // Project 3D world point to 2D screen coordinates for crisp vector HUD overlays
    _project3DTo2D(x, y, z, w, h) {
      const ex = this.camera.position.x, ey = this.camera.position.y, ez = this.camera.position.z;
      const tx = 0, ty = -0.15, tz = 0;
      let zx = ex - tx, zy = ey - ty, zz = ez - tz, zl = Math.hypot(zx, zy, zz) || 1;
      zx /= zl; zy /= zl; zz /= zl;
      let xx = zz, xy = 0, xz = -zx, xl = Math.hypot(xx, xy, xz) || 1;
      xx /= xl; xy /= xl; xz /= xl;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const rx = x - ex, ry = y - ey, rz = z - ez;
      const xc = rx * xx + ry * xy + rz * xz, yc = rx * yx + ry * yy + rz * yz, d = -(rx * zx + ry * zy + rz * zz);
      if (d <= 0.1) return null;
      const f = 1 / Math.tan((this.camera.fov || 40) * Math.PI / 360), asp = w / Math.max(1, h);
      return [(1 + (f / asp) * xc / d) * w * 0.5, (1 - f * yc / d) * h * 0.5];
    }

    _renderSvgVectorOverlay(ac) {
      if (!this.svgOverlay) return;
      if (!this.params.showVectors) {
        this.svgOverlay.innerHTML = '';
        return;
      }
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.svgOverlay.setAttribute('viewBox', `0 0 ${w} ${h}`);

      const origin = this._project3DTo2D(0, 0, 0, w, h);
      if (!origin) return;

      // Project Angular Momentum Vector L_z (precesses with Symmetry Breaking ε)
      const lx = Math.sin(this.precessionAngle) * this.params.symBreak * 1.4;
      const ly = 2.55 + ac.rms * 0.5;
      const lz = Math.cos(this.precessionAngle) * this.params.symBreak * 1.4;
      const lTip = this._project3DTo2D(lx, ly, lz, w, h);

      // Project Noether Probability Current Vector J on equator
      const jAngle = this.harmonicPhase * 0.6;
      const jStart = this._project3DTo2D(1.85 * Math.cos(jAngle), 0, 1.85 * Math.sin(jAngle), w, h);
      const jEnd = this._project3DTo2D(
        1.85 * Math.cos(jAngle) - 0.95 * Math.sin(jAngle),
        0.25 * Math.sin(this.harmonicPhase),
        1.85 * Math.sin(jAngle) + 0.95 * Math.cos(jAngle),
        w, h
      );

      let svgHtml = '';
      if (lTip) {
        svgHtml += `
          <line x1="${origin[0].toFixed(1)}" y1="${origin[1].toFixed(1)}" x2="${lTip[0].toFixed(1)}" y2="${lTip[1].toFixed(1)}" stroke="#F5B851" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.85"/>
          <circle cx="${lTip[0].toFixed(1)}" cy="${lTip[1].toFixed(1)}" r="4" fill="#F5B851"/>
          <text x="${(lTip[0] + 8).toFixed(1)}" y="${(lTip[1] + 4).toFixed(1)}" fill="#F5B851" font-family="Space Mono, monospace" font-size="11" font-weight="700">L_z = ${this.telemetry.angularLz.toFixed(2)}ħ ${this.params.symBreak > 0.05 ? '(PRECESSING)' : '(CONSERVED)'}</text>
        `;
      }
      if (jStart && jEnd) {
        svgHtml += `
          <line x1="${jStart[0].toFixed(1)}" y1="${jStart[1].toFixed(1)}" x2="${jEnd[0].toFixed(1)}" y2="${jEnd[1].toFixed(1)}" stroke="#7CE38B" stroke-width="2" opacity="0.9"/>
          <circle cx="${jEnd[0].toFixed(1)}" cy="${jEnd[1].toFixed(1)}" r="3.5" fill="#7CE38B"/>
          <text x="${(jEnd[0] + 7).toFixed(1)}" y="${(jEnd[1] + 3).toFixed(1)}" fill="#7CE38B" font-family="Space Mono, monospace" font-size="10.5">J = ρ(∇S − qA)</text>
        `;
      }
      this.svgOverlay.innerHTML = svgHtml;
    }

    _renderScopeCanvas(ac) {
      if (!this.scopeCanvas) return;
      const ctx = this.scopeCanvas.getContext('2d');
      if (!ctx) return;
      const W = this.scopeCanvas.width;
      const H = this.scopeCanvas.height;
      ctx.clearRect(0, 0, W, H);

      // Draw FFT Spectrum Bars (Bottom)
      const fData = this.audio.freqData;
      const bars = 48;
      const bw = W / bars;
      ctx.fillStyle = 'rgba(88, 196, 221, 0.28)';
      for (let i = 0; i < bars; i++) {
        const val = (fData[i * 2] || 0) / 255.0;
        const bh = val * (H * 0.82);
        ctx.fillRect(i * bw + 1, H - bh, bw - 2, bh);
      }

      // Draw Time-Domain Quantum Phase Waveform
      const tData = this.audio.timeData;
      ctx.strokeStyle = '#F5B851';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 128; i++) {
        const x = (i / 127) * W;
        const v = ((tData[i * 2] || 128) - 128) / 128.0;
        const y = H * 0.5 + v * H * 0.42;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    start() {
      if (this._running) return;
      this._running = true;
      const loop = (now) => {
        if (!this._running) return;
        this.updateFrame(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  window.NoetherStudio = {
    PALETTES,
    NoetherQuantumAudioSynth,
    NoetherQuantumFieldEngine
  };
})();
