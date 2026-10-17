/**
 * @file services/agy-mcp-bridge.js
 * @module NoetherAgyMcpBridge
 *
 * Antigravity CLI (`agy`) Model Context Protocol (MCP) JSON-RPC 2.0 Server
 * & Server-Sent Events (SSE) Live Control Bus for Noether Resonance Core.
 *
 * Exposes MCP tools for Antigravity CLI (`~/.gemini/antigravity-cli/settings.json`)
 * and Antigravity IDE:
 *   - `noether_run_turn`: Run a full conversational AI turn (Listening -> Thinking -> Speaking) with real neural voice
 *   - `noether_speak`: Synthesize and speak any text through Kore's neural voice & 3D quantum field
 *   - `noether_set_visualizer`: Switch the active 3D Exploration Tree branch (`orb`, `tokamak`, `cymatic`, `lattice`)
 *   - `noether_set_palette`: Switch the active Sanzo Wada or Monotone palette
 *   - `noether_status`: Query live microservice & visualizer status
 */
'use strict';

const http = require('http');

const MCP_TOOLS = [
  {
    name: 'noether_run_turn',
    description: 'Trigger a conversational AI turn (Listening -> Thinking -> Speaking) on the Noether Resonance Core 3D visualizer using Gemini 2.5 Flash + Real Neural Voice (Kore & Puck).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Optional user question or topic for Kore to answer.' },
        scenarioIndex: { type: 'integer', description: 'Optional pre-baked client demo scenario index (0 to 4).' },
        branch: { type: 'string', enum: ['orb', 'tokamak', 'cymatic', 'lattice'], description: 'Optional 3D visualizer branch to activate.' }
      }
    }
  },
  {
    name: 'noether_speak',
    description: 'Synthesize and speak custom text aloud through Kore or Puck neural voice on the Noether 3D Quantum Visualizer.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to speak aloud.' },
        speaker: { type: 'string', enum: ['Kore', 'Puck'], description: 'Voice persona (Kore or Puck).' },
        branch: { type: 'string', enum: ['orb', 'tokamak', 'cymatic', 'lattice'] }
      },
      required: ['text']
    }
  },
  {
    name: 'noether_set_visualizer',
    description: 'Switch the active 3D Exploration Tree visualizer branch or camera mode.',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', enum: ['orb', 'tokamak', 'cymatic', 'lattice'] },
        camera: { type: 'string', enum: ['front', 'iso', 'orbit', 'macro'] },
        palette: { type: 'string', description: 'Wada palette ID (e.g., wada_auto, wada_142, wada_068, wada_219, wada_173, mono_silver).' }
      },
      required: ['branch']
    }
  }
];

function postLocalControl(port, cmdObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(cmdObj);
    const req = http.request({
      hostname: '127.0.0.1',
      port: port || 3333,
      path: '/api/control',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({ ok: true, raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function startMcpStdioServer(port = 3333) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async chunk => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      const { id, method, params } = msg;

      if (method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'noether-resonance-mcp', version: '7.0.0' }
          }
        }) + '\n');
      } else if (method === 'tools/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { tools: MCP_TOOLS }
        }) + '\n');
      } else if (method === 'tools/call') {
        const name = params && params.name;
        const args = (params && params.arguments) || {};
        try {
          const out = await postLocalControl(port, { action: name, ...args });
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
            }
          }) + '\n');
        } catch (err) {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [{ type: 'text', text: `Noether MCP error: ${err.message}` }]
            }
          }) + '\n');
        }
      } else if (id !== undefined) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
      }
    }
  });
}

module.exports = {
  MCP_TOOLS,
  postLocalControl,
  startMcpStdioServer
};
