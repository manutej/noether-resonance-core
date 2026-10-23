#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Noether Resonance Core on http://localhost:3333 ..."
node server.js 3333 --open
