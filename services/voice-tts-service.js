/**
 * @file services/voice-tts-service.js
 * @module NoetherVoiceTTSService
 *
 * Real Neural Voice Synthesis Microservice for Noether Resonance Core.
 *
 * Engine Cascade:
 *   1. Google `gemini-2.5-flash-preview-tts` (24kHz PCM -> RIFF WAV, voices: `Kore`, `Puck`, `Aoede`, `Fenrir`, `Charon`)
 *   2. OpenAI `tts-1` (`nova` for Kore, `onyx` for Puck) when `OPENAI_API_KEY` is set
 *   3. Microsoft Edge Multilingual Neural TTS (`en-US-AvaMultilingualNeural` for Kore,
 *      `en-US-AndrewMultilingualNeural` for Puck) via `uv run --with edge-tts` on local server
 */
'use strict';

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

function pcm16ToWavBuffer(pcmBuffer, sampleRate = 24000) {
  const numBytes = pcmBuffer.length;
  const wav = Buffer.alloc(44 + numBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + numBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // Mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(numBytes, 40);
  pcmBuffer.copy(wav, 44);
  return wav;
}

function callGemini25FlashTTS(text, voiceName = 'Kore', apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`);
    const payload = JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' }
          }
        }
      }
    });

    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 25000
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error((parsed.error && parsed.error.message) || `Gemini TTS HTTP ${res.statusCode}`));
          }
          const b64 = parsed.candidates[0].content.parts[0].inlineData.data;
          const pcm = Buffer.from(b64, 'base64');
          const wav = pcm16ToWavBuffer(pcm, 24000);
          resolve({
            mimeType: 'audio/wav',
            audioBase64: wav.toString('base64'),
            engine: `gemini-2.5-flash-preview-tts (${voiceName})`
          });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini TTS timeout')); });
    req.write(payload);
    req.end();
  });
}

function callOpenAITTS(text, speaker = 'Kore', apiKey) {
  return new Promise((resolve, reject) => {
    const voice = speaker === 'Puck' ? 'onyx' : 'nova';
    const payload = JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3'
    });
    const req = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 20000
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300 && buf.length > 500) {
          resolve({
            mimeType: 'audio/mpeg',
            audioBase64: buf.toString('base64'),
            engine: `neural-tts (${voice})`
          });
        } else {
          reject(new Error(`OpenAI TTS HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI TTS timeout')); });
    req.write(payload);
    req.end();
  });
}

function callEdgeNeuralTTS(text, speaker = 'Kore') {
  return new Promise((resolve, reject) => {
    const edgeVoice = speaker === 'Puck' ? 'en-US-AndrewMultilingualNeural' : 'en-US-AvaMultilingualNeural';
    const rate = speaker === 'Puck' ? '+4%' : '+2%';
    const tmpFile = path.join(os.tmpdir(), `noether_tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`);
    const uvBin = fs.existsSync('/Users/cairo/.local/bin/uv') ? '/Users/cairo/.local/bin/uv' : 'uv';

    const pyCode = [
      'import asyncio, sys, edge_tts',
      'async def run():',
      '    c = edge_tts.Communicate(sys.argv[1], sys.argv[2], rate=sys.argv[3])',
      '    await c.save(sys.argv[4])',
      'asyncio.run(run())'
    ].join('\n');

    execFile(uvBin, ['run', '--with', 'edge-tts', 'python3', '-c', pyCode, text, edgeVoice, rate, tmpFile], { timeout: 18000 }, (err) => {
      if (err || !fs.existsSync(tmpFile)) {
        return reject(err || new Error('edge-tts output missing'));
      }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve({
          mimeType: 'audio/mpeg',
          audioBase64: buf.toString('base64'),
          engine: `edge-neural (${edgeVoice})`
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function synthesizeSpeech({ text, speaker = 'Kore', geminiApiKey }) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('Empty text for speech synthesis');

  const gKey = (geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (gKey) {
    try {
      return await callGemini25FlashTTS(cleanText, speaker === 'Puck' ? 'Puck' : 'Kore', gKey);
    } catch (_) {}
  }

  try {
    return await callEdgeNeuralTTS(cleanText, speaker);
  } catch (_) {}

  const oKey = (process.env.OPENAI_API_KEY || '').trim();
  if (oKey) {
    try {
      return await callOpenAITTS(cleanText, speaker, oKey);
    } catch (_) {}
  }

  throw new Error('No neural TTS engine available');
}

module.exports = {
  synthesizeSpeech,
  pcm16ToWavBuffer
};
