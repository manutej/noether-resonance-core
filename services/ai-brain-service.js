/**
 * @file services/ai-brain-service.js
 * @module NoetherAIBrainService
 *
 * Live Conversational AI Brain Microservice ("Noether // Jarvis") for Noether Resonance Core.
 *
 * Provider Cascade:
 *   1. Google `gemini-2.5-flash` (via `GEMINI_API_KEY` in request or process.env)
 *   2. xAI `grok-4.20-0309-non-reasoning` / `grok-4.5` (via `XAI_API_KEY` or `xai-...` key in `OPENAI_API_KEY`)
 *   3. OpenAI `gpt-4o-mini` / `gpt-4o` (via `OPENAI_API_KEY` starting with `sk-`)
 *   4. Context-Aware Conversational Noether Intelligence Engine (multi-intent offline fallback)
 *
 * Supports multi-turn conversation history (`history: [{ role, content }]`) and returns live
 * visual state directives (`recommendedBranch`, `recommendedPalette`, `recommendedMode`, `recommendedCamera`)
 * so talking to Noether dynamically controls the 3D quantum field when requested.
 */
'use strict';

const https = require('https');

const SYSTEM_INSTRUCTION = `You are Noether (voiced by Kore), a live Jarvis-class executive AI and quantum-field intelligence interface built on Emmy Noether's 1918 symmetry theorem and Sanzo Wada's chromatic combinations.
You are speaking live in a real-time conversational voice interface (including high-stakes executive Summit presentations).

Rules for your spoken response ("aiResponse"):
1. Directly, intelligently, and naturally answer whatever the user just said or asked — whether it is an executive strategy question, a live Summit greeting, a physics/AI architecture question, a brainstorming prompt, or a voice command to change the 3D visualization.
2. Keep "aiResponse" conversational, crisp, warm, and natural for spoken voice (2 to 3 sentences, 25–55 words). Never use markdown bullets, asterisks, raw LaTeX backslashes, or code blocks in "aiResponse".
3. You can actively control the 3D quantum visualizer in response to the user's request or topic:
   - "recommendedBranch":
     * "orb" — Eigen-Orb (Organic liquid-light spherical harmonics Y_l^m)
     * "tokamak" — Clifford Tokamak (Toroidal magnetic plasma confinement)
     * "cymatic" — Cymatic Horizon (Dual Bessel standing-wave acoustic membranes)
     * "lattice" — Spinor Lattice (Nested SU(2) geodesic polyhedral shells)
     * "calabi" — Calabi-Yau 6D Manifold (Higher-dimensional quintic cross-section)
   - "recommendedPalette":
     * "wada_auto" (Turn-adaptive), "wada_142" (Prussian Indigo & Verdigris Jade), "wada_068" (Imperial Violet & Cinnabar), "wada_219" (Abyssal Peacock & Hermosa Rose), "wada_284" (Cobalt Night & Citrine Gold), "wada_091" (Kyoto Pine & Persimmon), "wada_173" (Aubergine & Cerulean), "mono_silver", "mono_sumi", "mono_ice"
   - "recommendedMode": 0 (Pure Eigen Y_lm smooth surface), 1 (Chladni contours), 2 (Hopf Torus), 3 (Ferrofluid spikes), 4 (Superfluid vortices)

Respond strictly as a JSON object with keys:
{
  "thinkingSummary": "1 short sentence describing your reasoning or action",
  "aiResponse": "Your natural spoken reply to the user",
  "recommendedBranch": "orb|tokamak|cymatic|lattice|calabi",
  "recommendedPalette": "wada_auto|wada_142|wada_068|wada_219|wada_284|wada_091|wada_173|mono_silver|mono_sumi|mono_ice",
  "recommendedMode": 0
}`;

function postJson(urlStr, headers, bodyObj, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = JSON.stringify(bodyObj);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      },
      timeout: timeoutMs
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error((parsed.error && parsed.error.message) || `HTTP ${res.statusCode}`));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${u.hostname}: ${raw.slice(0, 160)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(data);
    req.end();
  });
}

const VALID_BRANCHES = ['orb', 'tokamak', 'cymatic', 'lattice', 'calabi'];
const VALID_PALETTES = ['wada_auto', 'wada_142', 'wada_068', 'wada_219', 'wada_284', 'wada_091', 'wada_173', 'mono_silver', 'mono_sumi', 'mono_ice'];

function parseStructuredReply(rawText, fallbackBranch = 'orb') {
  try {
    const cleaned = String(rawText)
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const jsonSlice = (firstBrace !== -1 && lastBrace > firstBrace)
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
    const obj = JSON.parse(jsonSlice);
    if (obj && obj.aiResponse) {
      return {
        thinkingSummary: obj.thinkingSummary || 'Synthesizing quantum harmonic response across Noether symmetry invariants...',
        aiResponse: String(obj.aiResponse).replace(/[*#`_~]/g, '').trim(),
        recommendedBranch: VALID_BRANCHES.includes(obj.recommendedBranch) ? obj.recommendedBranch : fallbackBranch,
        recommendedPalette: VALID_PALETTES.includes(obj.recommendedPalette) ? obj.recommendedPalette : 'wada_auto',
        recommendedMode: typeof obj.recommendedMode === 'number' ? Math.max(0, Math.min(4, Math.round(obj.recommendedMode))) : 0
      };
    }
  } catch (_) {}
  return {
    thinkingSummary: 'Mapping acoustic formants and conserved Hamiltonian energy to 3D field geometry...',
    aiResponse: String(rawText).replace(/[*#`_~{}]/g, '').trim(),
    recommendedBranch: fallbackBranch,
    recommendedPalette: 'wada_auto',
    recommendedMode: 0
  };
}

function formatHistoryForGemini(history, prompt) {
  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (!h || !h.content) continue;
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(h.content) }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  return contents;
}

function formatHistoryForChatCompletions(history, prompt) {
  const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (!h || !h.content) continue;
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: String(h.content)
      });
    }
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
}

async function callGeminiFlash(prompt, apiKey, history = []) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: formatHistoryForGemini(history, prompt),
    generationConfig: {
      temperature: 0.65,
      responseMimeType: 'application/json'
    }
  };
  const data = await postJson(url, {}, payload);
  const text = data.candidates[0].content.parts[0].text;
  return { ...parseStructuredReply(text), provider: 'gemini-2.5-flash' };
}

async function callChatCompletion(prompt, apiKey, baseUrl, model, history = []) {
  const payload = {
    model,
    temperature: 0.65,
    messages: formatHistoryForChatCompletions(history, prompt)
  };
  const data = await postJson(baseUrl, { Authorization: `Bearer ${apiKey}` }, payload);
  const text = data.choices[0].message.content;
  return { ...parseStructuredReply(text), provider: model };
}

function generateLocalKnowledgeReply(prompt) {
  const raw = String(prompt || '').trim();
  const q = raw.toLowerCase();

  if (q.includes('calabi') || q.includes('manifold') || q.includes('6d') || q.includes('dimension')) {
    return {
      thinkingSummary: 'Projecting 6D Fermat quintic Calabi-Yau cross-section manifold into 3D symplectic space...',
      aiResponse: 'Projecting the Calabi-Yau six-dimensional manifold now. Every vocal formant modulates the complex moduli of the quintic hypersurface, folding higher-dimensional string geometry directly into our live acoustic field.',
      recommendedBranch: 'calabi',
      recommendedPalette: 'wada_284',
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }
  if (q.includes('tokamak') || q.includes('torus') || q.includes('plasma') || q.includes('magnetic')) {
    return {
      thinkingSummary: 'Computing helical safety-factor winding q = l/m and Villarceau coil torsion on the Clifford Tokamak...',
      aiResponse: 'Switching to the Clifford Tokamak. Your voice now drives helical magnetic flux surfaces around a toroidal plasma chamber while thirty-six Villarceau coils pulse in phase with the acoustic envelope.',
      recommendedBranch: 'tokamak',
      recommendedPalette: 'wada_142',
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }
  if (q.includes('cymatic') || q.includes('chladni') || q.includes('horizon') || q.includes('standing')) {
    return {
      thinkingSummary: 'Solving 3D Bessel-Chladni standing-wave nodal contours across upper and lower acoustic horizons...',
      aiResponse: 'Activating the Cymatic Horizon. Upper and lower Bessel standing-wave membranes project resonant nodal geometry while seventy-two harmonic crystal monoliths track the real-time frequency spectrum.',
      recommendedBranch: 'cymatic',
      recommendedPalette: 'wada_068',
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }
  if (q.includes('lattice') || q.includes('spinor') || q.includes('geodesic') || q.includes('dirac')) {
    return {
      thinkingSummary: 'Exciting counter-rotating SU(2) geodesic polyhedral shells and 72 Fibonacci-sphere spectrum spires...',
      aiResponse: 'Transitioning to the Spinor Lattice. Three nested geodesic gauge shells counter-rotate at SU-2 spinor rates, surrounded by seventy-two radial Fibonacci spires.',
      recommendedBranch: 'lattice',
      recommendedPalette: 'wada_173',
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }
  if (q.includes('hello') || q.includes('hi ') || q.startsWith('hi') || q.includes('good morning') || q.includes('summit') || q.includes('welcome') || q.includes('ready')) {
    return {
      thinkingSummary: 'Initializing executive Summit presence and locking phase-coherent spherical harmonics...',
      aiResponse: 'Good morning. Noether is online, phase-locked, and listening. Welcome to the Summit—how would you like to begin our exploration today?',
      recommendedBranch: 'orb',
      recommendedPalette: 'wada_142',
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }
  if (q.includes('color') || q.includes('wada') || q.includes('palette') || q.includes('warm') || q.includes('cool')) {
    const pal = q.includes('warm') || q.includes('sunset') ? 'wada_068' : (q.includes('gold') ? 'wada_284' : 'wada_219');
    return {
      thinkingSummary: `Applying Sanzo Wada 4-pigment Kubelka-Munk chromatic combination (${pal})...`,
      aiResponse: 'Updating our four-pigment Sanzo Wada palette now. Using subtractive Kubelka-Munk mixing, the ground cavity, harmonic body, crest highlights, and counter-accents remain rich and distinct across every oscillation.',
      recommendedBranch: 'orb',
      recommendedPalette: pal,
      recommendedMode: 0,
      provider: 'noether-conversational-core'
    };
  }

  return {
    thinkingSummary: `Analyzing "${raw.slice(0, 48)}" across Noether symmetry invariants and symplectic field dynamics...`,
    aiResponse: `Regarding ${raw.replace(/[?.!]+$/, '')}: by coupling live vocal formants directly into a conserved Hamiltonian field, we turn raw information into a coherent three-dimensional physical state you can see, hear, and steer in real time.`,
    recommendedBranch: 'orb',
    recommendedPalette: 'wada_auto',
    recommendedMode: 0,
    provider: 'noether-conversational-core'
  };
}

async function generateTurnResponse({ prompt, geminiApiKey, history = [] }) {
  const cleanPrompt = String(prompt || 'Hello Noether, we are live at the Summit. Are you ready?').trim();
  const gKey = (geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  if (gKey) {
    try {
      const res = await callGeminiFlash(cleanPrompt, gKey, history);
      return { userPrompt: cleanPrompt, ...res };
    } catch (_) {}
  }

  const xKey = (process.env.XAI_API_KEY || (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('xai-') ? process.env.OPENAI_API_KEY : '') || '').trim();
  if (xKey) {
    try {
      const res = await callChatCompletion(
        cleanPrompt,
        xKey,
        'https://api.x.ai/v1/chat/completions',
        'grok-4.20-0309-non-reasoning',
        history
      );
      return { userPrompt: cleanPrompt, ...res };
    } catch (_) {}
  }

  const oKey = (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('xai-') ? process.env.OPENAI_API_KEY : '').trim();
  if (oKey) {
    try {
      const res = await callChatCompletion(
        cleanPrompt,
        oKey,
        'https://api.openai.com/v1/chat/completions',
        'gpt-4o-mini',
        history
      );
      return { userPrompt: cleanPrompt, ...res };
    } catch (_) {}
  }

  return { userPrompt: cleanPrompt, ...generateLocalKnowledgeReply(cleanPrompt) };
}

module.exports = {
  generateTurnResponse,
  generateLocalKnowledgeReply
};
