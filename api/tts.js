'use strict';

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
    const text = body.text || '';
    const speaker = body.speaker || 'Kore';
    const geminiApiKey = body.geminiApiKey || '';

    const audio = await synthesizeSpeech({ text, speaker, geminiApiKey });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...audio }));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
