'use strict';

const { generateTurnResponse } = require('../services/ai-brain-service');
const { synthesizeSpeech } = require('../services/voice-tts-service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.rawBody || '{}');
    const prompt = body.prompt || 'Hello Noether, we are live at the Summit. Are you ready?';
    const geminiApiKey = body.geminiApiKey || '';
    const history = Array.isArray(body.history) ? body.history : [];
    const aiSpeaker = body.speaker || 'Kore';
    const synthesizeUserVoice = Boolean(body.synthesizeUserVoice);

    const brainOut = await generateTurnResponse({ prompt, geminiApiKey, history });

    let userAudio = null;
    if (synthesizeUserVoice) {
      try {
        userAudio = await synthesizeSpeech({ text: prompt, speaker: 'Puck', geminiApiKey });
      } catch (_) {}
    }

    let aiAudio = null;
    try {
      aiAudio = await synthesizeSpeech({ text: brainOut.aiResponse, speaker: aiSpeaker, geminiApiKey });
    } catch (_) {}

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.end(JSON.stringify({
      ok: true,
      ...brainOut,
      userAudio,
      aiAudio
    }));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
