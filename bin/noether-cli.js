#!/usr/bin/env node
/**
 * @file bin/noether-cli.js
 *
 * Unified CLI & Antigravity (`agy`) Bridge for Noether Resonance Core.
 *
 * Commands:
 *   noether start [--port 3333] [--open]       Start the unified microservice gateway & 3D studio
 *   noether turn [prompt] [--branch <id>]      Trigger a real neural voice AI turn on the live 3D studio
 *   noether speak "<text>" [--speaker Kore]    Synthesize & speak custom text through the 3D orb
 *   noether branch <orb|tokamak|cymatic|lattice> Switch the active 3D Exploration Tree visualizer
 *   noether status                             Check microservice health & active voice engines
 *   noether mcp                                Start the JSON-RPC 2.0 MCP stdio server for Antigravity CLI (agy)
 *   noether rebuild-voices                     Re-synthesize the 24kHz neural voice bank (audio/turns/*.mp3)
 */
'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { postLocalControl, startMcpStdioServer } = require('../services/agy-mcp-bridge');

const args = process.argv.slice(2);
const cmd = (args[0] || 'help').toLowerCase();
const portIdx = args.indexOf('--port');
const PORT = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : (parseInt(process.env.PORT || '3333', 10));

function getFlag(name, def = null) {
  const i = args.indexOf(name);
  return (i !== -1 && args[i + 1]) ? args[i + 1] : def;
}

async function run() {
  if (cmd === 'mcp') {
    startMcpStdioServer(PORT);
    return;
  }

  if (cmd === 'start' || cmd === 'serve') {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const childArgs = [serverPath, String(PORT)];
    if (args.includes('--open')) childArgs.push('--open');
    const child = spawn(process.execPath, childArgs, { stdio: 'inherit' });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  if (cmd === 'rebuild-voices') {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'build_neural_voice_bank.py');
    const child = spawn('/Users/cairo/.local/bin/uv', ['run', '--with', 'edge-tts', 'python3', scriptPath], { stdio: 'inherit' });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  if (cmd === 'status' || cmd === 'health') {
    http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        console.log(raw);
      });
    }).on('error', err => {
      console.error(`Noether server not running on port ${PORT}: ${err.message}`);
      process.exit(1);
    });
    return;
  }

  if (cmd === 'turn') {
    const branch = getFlag('--branch');
    const scenario = getFlag('--scenario');
    const positional = args.slice(1).filter((a, idx, arr) => !a.startsWith('--') && (idx === 0 || !arr[idx - 1].startsWith('--')));
    const prompt = positional.join(' ').trim();
    const out = await postLocalControl(PORT, {
      action: 'noether_run_turn',
      prompt: prompt || undefined,
      scenarioIndex: scenario !== null ? parseInt(scenario, 10) : undefined,
      branch: branch || undefined
    });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === 'speak' || cmd === 'say') {
    const speaker = getFlag('--speaker', 'Kore');
    const branch = getFlag('--branch');
    const positional = args.slice(1).filter((a, idx, arr) => !a.startsWith('--') && (idx === 0 || !arr[idx - 1].startsWith('--')));
    const text = positional.join(' ').trim() || 'Harmony in continuous symmetry generates conservation across the quantum field.';
    const out = await postLocalControl(PORT, {
      action: 'noether_speak',
      text,
      speaker,
      branch: branch || undefined
    });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === 'branch' || cmd === 'tree') {
    const branch = args[1] || 'orb';
    const camera = getFlag('--camera');
    const palette = getFlag('--palette');
    const out = await postLocalControl(PORT, {
      action: 'noether_set_visualizer',
      branch,
      camera: camera || undefined,
      palette: palette || undefined
    });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(`
===========================================================================
  NOETHER RESONANCE CORE — UNIFIED CLI & ANTIGRAVITY (AGY) BRIDGE (v7.0)
===========================================================================
  Usage:
    node bin/noether-cli.js start [--port 3333] [--open]
    node bin/noether-cli.js turn "How does the Clifford Tokamak work?" --branch tokamak
    node bin/noether-cli.js turn --scenario 0
    node bin/noether-cli.js speak "Welcome to Noether Resonance Core." --speaker Kore
    node bin/noether-cli.js branch <orb|tokamak|cymatic|lattice> [--palette wada_142]
    node bin/noether-cli.js status
    node bin/noether-cli.js mcp
    node bin/noether-cli.js rebuild-voices

  Antigravity CLI (~/.gemini/antigravity-cli/settings.json) MCP Registration:
    {
      "mcpServers": {
        "noether-resonance": {
          "command": "node",
          "args": ["${path.resolve(__dirname, 'noether-cli.js')}", "mcp"]
        }
      }
    }
===========================================================================
`);
}

run().catch(err => {
  console.error('Noether CLI error:', err.message);
  process.exit(1);
});
