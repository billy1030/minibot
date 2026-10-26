#!/usr/bin/env bash

# MiniBot Launcher for macOS / Linux
# Model Context Protocol (MCP) + React 19 + Vite 8

set -e

# Change to script directory
cd "$(cd "$(dirname "$0")" && pwd)"

PORT="${PORT:-7009}"

echo "==================================================="
echo "                MiniBot Launcher"
echo "  Model Context Protocol (MCP) + React 19 + Vite 8"
echo "==================================================="
echo ""

# 1. Check if root node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[Setup] Installing root dependencies..."
    npm install
fi

# 2. Check if frontend dist exists, build if missing
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[Build] Building frontend production bundle..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run build
    cd ..
fi

# 3. Clean up port and any leftover orphan MCP processes on macOS/Linux
if lsof -ti :${PORT} >/dev/null 2>&1; then
    echo "[Port Check] Freeing port ${PORT}..."
    PIDS=$(lsof -ti :${PORT})
    for PID in $PIDS; do
        pkill -P "$PID" 2>/dev/null || true
        kill -9 "$PID" 2>/dev/null || true
    done
fi
pkill -f "mini-news/dist/index.js --mcp-only" 2>/dev/null || true
pkill -f "mcp-chrome-bridge" 2>/dev/null || true
pkill -f "rea-agent" 2>/dev/null || true

# 4. Open browser after short delay
(
    sleep 2
    if which open >/dev/null 2>&1; then
        open "http://localhost:${PORT}"
    elif which xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:${PORT}"
    fi
) &

# 5. Start Backend Server
echo ""
echo "[Running] Starting Mini Chat Bot on http://localhost:${PORT} ..."
echo "[Tip] Press Ctrl+C in this terminal window to stop the server."
echo ""

PORT="${PORT}" npx tsx src/server.ts
