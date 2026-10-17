/**
 * @file services/ai-brain-service.js
 * @module NoetherAIBrainService
 *
 * Modular Conversational Reasoning Microservice for Noether Resonance Core.
 *
 * Provider Cascade:
 *   1. Google `gemini-2.5-flash` (via `GEMINI_API_KEY` in request or process.env)
 *   2. OpenAI `gpt-4o-mini` / xAI `grok-2-latest` (via `OPENAI_API_KEY` / `XAI_API_KEY` in process.env)
 *   3. Built-in Noether Symplectic Knowledge Graph (instant deterministic fallback)
 *
 * Returns a structured turn specification:
 *   {
 *     userPrompt,
 *     thinkingSummary,
 *     aiResponse,
 *     recommendedBranch: 'orb' | 'tokamak' | 'cymatic' | 'lattice',
 *     recommendedPalette: 'wada_auto' | 'wada_142' | 'wada_068' | 'wada_219' | 'wada_173',
 *     provider
 *   }
 */
'use strict';

const https = require('https');

const SYSTEM_INSTRUCTION = `You are Kore, the voice and intelligence of Noether Resonance Core — a real-time 3D WebGL2 quantum-field audio synthesizer and conversational AI visualizer inspired by Emmy Noether's 1918 symmetry theorem and Sanzo Wada's color combinations.
Keep your spoken response natural, warm, articulate, and concise (2 to 3 sentences, 35–55 words max) so it sounds compelling when spoken aloud in a live client demo. Never use markdown bullet points, raw LaTeX backslashes, or code blocks in your spoken text.
Also choose which of the 4 3D visualizers best matches the topic:
- "orb": Eigen-Orb (Spherical Harmonics Y_l^m + Hopf fibration filaments)
- "tokamak": Clifford Tokamak (Toroidal magnetic confinement plasma + Villarceau coils)
- "cymatic": Cymatic Horizon (Dual standing-wave membranes + 72 crystal monoliths)
- "lattice": Spinor Lattice (Nested SU(2) geodesic polyhedral shells + Fibonacci spires)
Respond strictly as JSON with keys: {"thinkingSummary": "...", "aiResponse": "...", "recommendedBranch": "orb|tokamak|cymatic|lattice", "recommendedPalette": "wada_auto|wada_142|wada_068|wada_219|wada_173"}`;

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

function parseStructuredReply(rawText, fallbackBranch = 'orb') {
  try {
    const cleaned = String(rawText).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const obj = JSON.parse(cleaned);
    if (obj && obj.aiResponse) {
      return {
        thinkingSummary: obj.thinkingSummary || 'Synthesizing quantum harmonic response across Noether symmetry invariants...',
        aiResponse: String(obj.aiResponse).replace(/[*#`_~]/g, '').trim(),
        recommendedBranch: ['orb', 'tokamak', 'cymatic', 'lattice'].includes(obj.recommendedBranch) ? obj.recommendedBranch : fallbackBranch,
        recommendedPalette: obj.recommendedPalette || 'wada_auto'
      };
    }
  } catch (_) {}
  return {
    thinkingSummary: 'Mapping acoustic formants and conserved Hamiltonian energy to 3D field geometry...',
    aiResponse: String(rawText).replace(/[*#`_~]/g, '').trim(),
    recommendedBranch: fallbackBranch,
    recommendedPalette: 'wada_auto'
  };
}

async function callGeminiFlash(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.65,
      responseMimeType: 'application/json'
    }
  };
  const data = await postJson(url, {}, payload);
  const text = data.candidates[0].content.parts[0].text;
  return { ...parseStructuredReply(text), provider: 'gemini-2.5-flash' };
}

async function callOpenAICompatible(prompt, apiKey, baseUrl = 'https://api.openai.com/v1/chat/completions', model = 'gpt-4o-mini') {
  const payload = {
    model,
    temperature: 0.65,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: prompt }
    ]
  };
  const data = await postJson(baseUrl, { Authorization: `Bearer ${apiKey}` }, payload);
  const text = data.choices[0].message.content;
  return { ...parseStructuredReply(text), provider: model };
}

function generateLocalKnowledgeReply(prompt) {
  const q = String(prompt || '').toLowerCase();
  if (q.includes('tokamak') || q.includes('torus') || q.includes('plasma') || q.includes('magnetic')) {
    return {
      thinkingSummary: 'Computing helical safety-factor winding q = l/m and Villarceau coil torsion on the Clifford Tokamak...',
      aiResponse: 'Switching to the Clifford Tokamak. Here, sound vibrations drive helical magnetic flux lines around a toroidal plasma chamber, while thirty-six Villarceau coils and a central Z-pinch column pulse in lockstep with the beat.',
      recommendedBranch: 'tokamak',
      recommendedPalette: 'wada_142',
      provider: 'noether-knowledge-engine'
    };
  }
  if (q.includes('cymatic') || q.includes('chladni') || q.includes('horizon') || q.includes('monolith') || q.includes('standing')) {
    return {
      thinkingSummary: 'Solving 3D Bessel-Chladni standing-wave nodal contours across upper and lower acoustic horizons...',
      aiResponse: 'Activating the Cymatic Horizon. Upper and lower Bessel standing-wave membranes project glowing Chladni nodal contours, while seventy-two harmonic crystal monoliths rise in three concentric rings with the live frequency spectrum.',
      recommendedBranch: 'cymatic',
      recommendedPalette: 'wada_068',
      provider: 'noether-knowledge-engine'
    };
  }
  if (q.includes('lattice') || q.includes('spinor') || q.includes('geodesic') || q.includes('dirac') || q.includes('spire')) {
    return {
      thinkingSummary: 'Exciting counter-rotating SU(2) geodesic polyhedral shells and 72 Fibonacci-sphere spectrum spires...',
      aiResponse: 'Transitioning to the Spinor Lattice. Three nested geodesic gauge shells counter-rotate at SU-2 spinor rates, woven together by sixteen Dirac double-helix ribbons and seventy-two radial Fibonacci spires.',
      recommendedBranch: 'lattice',
      recommendedPalette: 'wada_173',
      provider: 'noether-knowledge-engine'
    };
  }
  if (q.includes('cli') || q.includes('antigravity') || q.includes('agy') || q.includes('microservice') || q.includes('mcp')) {
    return {
      thinkingSummary: 'Connecting Antigravity CLI MCP stdio bridge, SSE event bus, and modular voice microservices...',
      aiResponse: 'Our monorepo exposes dedicated microservices for Gemini 2.5 reasoning, neural voice synthesis, and symplectic clock synchronization. From the Antigravity CLI, you can invoke our MCP tools or CLI commands to speak through the orb and switch 3D topologies from one terminal.',
      recommendedBranch: 'lattice',
      recommendedPalette: 'wada_219',
      provider: 'noether-knowledge-engine'
    };
  }
  return {
    thinkingSummary: 'Integrating Emmy Noether symmetry invariants, vocal formants F1 and F2, and Velocity-Verlet Hamiltonian oscillators...',
    aiResponse: 'In Noether Resonance Core, every sound wave couples into a second-order symplectic Hamiltonian field. Continuous rotational and time symmetries conserve angular momentum and energy, allowing the 3D quantum geometry to breathe naturally with your voice and music.',
    recommendedBranch: 'orb',
    recommendedPalette: 'wada_auto',
    provider: 'noether-knowledge-engine'
  };
}

async function generateTurnResponse({ prompt, geminiApiKey }) {
  const cleanPrompt = String(prompt || 'Explain how Noether Resonance Core visualizes voice and music through quantum symmetry.').trim();
  const gKey = (geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  if (gKey) {
    try {
      const res = await callGeminiFlash(cleanPrompt, gKey);
      return { userPrompt: cleanPrompt, ...res };
    } catch (e) {
      // Fall through to secondary provider or deterministic knowledge engine
    }
  }

  const oKey = (process.env.OPENAI_API_KEY || '').trim();
  if (oKey) {
    try {
      const res = await callOpenAICompatible(cleanPrompt, oKey, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini');
      return { userPrompt: cleanPrompt, ...res };
    } catch (e) {}
  }

  return { userPrompt: cleanPrompt, ...generateLocalKnowledgeReply(cleanPrompt) };
}

module.exports = {
  generateTurnResponse,
  generateLocalKnowledgeReply
};
