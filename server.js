#!/usr/bin/env node
/**
 * Noether Resonance Core — v3.0 Operadic Diamond Live Deployment Server
 * ---------------------------------------------------------------------
 * Zero-dependency Node.js HTTP server that hosts the live WebGL + WebAudio
 * application on localhost & LAN IP so you can view, test, and demo it across
 * devices with full Microphone (getUserMedia), Tab/System Audio (getDisplayMedia),
 * and local file playback permissions.
 *
 * Usage:
 *   node server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

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

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'ok',
      version: '3.0.0-operadic-diamond',
      app: 'Noether Resonance Core',
      port: PORT,
      lanIp: getLanIp(),
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
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
  console.log('  NOETHER RESONANCE CORE — v3.0 OPERADIC DIAMOND LIVE DEPLOYMENT');
  console.log('====================================================================');
  console.log(`  Local URL    : ${localUrl}`);
  console.log(`  LAN Demo URL : ${lanUrl}`);
  console.log(`  Health Check : ${localUrl}/health`);
  console.log('  Audio Modes  : Live Mic (Auto-VAD) | System/Tab Audio | Local File');
  console.log('  Demo Studio  : 1-Click Showcase | PNG Snapshot | 60fps WebM Video');
  console.log('====================================================================\n');

  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'darwin' ? `open "${localUrl}"`
              : process.platform === 'win32' ? `start "${localUrl}"`
              : `xdg-open "${localUrl}"`;
    exec(cmd);
  }
});
