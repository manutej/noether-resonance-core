@echo off
title Noether Resonance Core (Windows Studio Server)
cd /d "%~dp0"
echo Starting Noether Resonance Core on http://localhost:3333 ...
node server.js 3333 --open
pause
