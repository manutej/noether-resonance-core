#!/usr/bin/env node
/**
 * Noether Resonance Core — v7.0 Monorepo API Gateway & Microservices Host
 * ------------------------------------------------------------------------
 * Hosts:
 *   - Static 3D WebGL2 + WebAudio Studio (`/`, `/index.html`, `/sequencer.js`, `/audio/turns/*`)
 *   - `GET  /api/health`   (/health) — Microservice health & provider status
 *   - `POST /api/turn`     — Live Gemini 2.5 Flash reasoning + Real Neural Voice turn synthesis
 *   - `POST /api/tts`      — On-demand Gemini 2.5 Flash Preview TTS / Edge Multilingual Neural TTS
 *   - `GET  /api/events`   — Server-Sent Events (SSE) real-time control stream to connected browsers
 *   - `POST /api/control`  — Antigravity CLI (`agy`) & MCP remote-control endpoint
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const healthHandler = require('./api/health');
const turnHandler = require('./api/turn');
const ttsHandler = require('./api/tts');
const { generateTurnResponse } = require('./services/ai-brain-service');
const { synthesizeSpeech } = require('./services/voice-tts-service');

const PORT = parseInt(process.argv[2] || process.env.PORT || '3333', 10);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const sseClients = new Set();
function broadcastSse(eventObj) {
  const payload = `data: ${JSON.stringify(eventObj)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch (_) { sseClients.delete(client); }
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      req.rawBody = raw;
      try { req.body = JSON.parse(raw || '{}'); } catch (_) { req.body = {}; }
      resolve(req.body);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/health' || urlPath === '/api/health') {
    return healthHandler(req, res);
  }

  if (urlPath === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (urlPath === '/api/turn' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    await readJsonBody(req);
    return turnHandler(req, res);
  }

  if (urlPath === '/api/tts' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    await readJsonBody(req);
    return ttsHandler(req, res);
  }

  if (urlPath === '/api/control' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const action = body.action || '';
    try {
      if (action === 'noether_run_turn' && body.prompt) {
        const brainOut = await generateTurnResponse({ prompt: body.prompt, geminiApiKey: body.geminiApiKey });
        const aiAudio = await synthesizeSpeech({ text: brainOut.aiResponse, speaker: 'Kore', geminiApiKey: body.geminiApiKey });
        let userAudio = null;
        try {
          userAudio = await synthesizeSpeech({ text: body.prompt, speaker: 'Puck', geminiApiKey: body.geminiApiKey });
        } catch (_) {}
        const evt = {
          type: 'remote_turn',
          customTurn: {
            user_speaker: 'Puck',
            user_text: body.prompt,
            userAudio,
            thinking_summary: brainOut.thinkingSummary,
            ai_speaker: 'Kore',
            ai_text: brainOut.aiResponse,
            aiAudio,
            branch: body.branch || brainOut.recommendedBranch,
            palette: brainOut.recommendedPalette,
            provider: brainOut.provider
          }
        };
        broadcastSse(evt);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, broadcastedToClients: sseClients.size, turn: brainOut }));
      }

      if (action === 'noether_speak' && body.text) {
        const audio = await synthesizeSpeech({ text: body.text, speaker: body.speaker || 'Kore', geminiApiKey: body.geminiApiKey });
        broadcastSse({
          type: 'remote_speak',
          text: body.text,
          speaker: body.speaker || 'Kore',
          branch: body.branch,
          audio
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, broadcastedToClients: sseClients.size, engine: audio.engine }));
      }

      broadcastSse({ type: 'remote_control', ...body });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, broadcastedToClients: sseClients.size, command: body }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  const safeUrl = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, path.normalize(safeUrl).replace(/^(\.\.[\/\\])+/, ''));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Permissions-Policy': 'microphone=(self), display-capture=(self)'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localUrl = `http://localhost:${PORT}`;
  const lanUrl = `http://${getLanIp()}:${PORT}`;
  console.log('\n====================================================================');
  console.log('  NOETHER RESONANCE CORE — v7.0 GEMINI & NEURAL VOICE MICROSERVICES');
  console.log('====================================================================');
  console.log(`  Local Studio : ${localUrl}`);
  console.log(`  LAN Demo URL : ${lanUrl}`);
  console.log(`  Health API   : ${localUrl}/api/health`);
  console.log(`  AI Turn API  : POST ${localUrl}/api/turn`);
  console.log(`  Voice TTS API: POST ${localUrl}/api/tts`);
  console.log(`  AGY CLI / MCP: node bin/noether-cli.js <start|turn|speak|branch|mcp>`);
  console.log('====================================================================\n');

  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'darwin' ? `open "${localUrl}"`
              : process.platform === 'win32' ? `start "" "${localUrl}"`
              : `xdg-open "${localUrl}"`;
    exec(cmd);
  }
});
