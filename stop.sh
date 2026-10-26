#!/usr/bin/env bash

# Stop MiniBot services and clean up orphan MCP processes on macOS / Linux
PORT="${PORT:-7009}"

echo "==================================================="
echo "            Stopping MiniBot Services"
echo "==================================================="
echo ""

# 1. Kill process holding port 7009
if lsof -ti :${PORT} >/dev/null 2>&1; then
    echo "[Port Check] Terminating process holding port ${PORT}..."
    PIDS=$(lsof -ti :${PORT})
    for PID in $PIDS; do
        # Kill child processes first
        pkill -P "$PID" 2>/dev/null || true
        kill -9 "$PID" 2>/dev/null || true
    done
    echo "Port ${PORT} has been freed successfully."
else
    echo "Port ${PORT} is already free."
fi

# 2. Sweep and clean any remaining minibot / minibot-backend
pkill -f "minibot-backend" 2>/dev/null || true

# 3. Sweep and terminate any orphaned MCP child processes
pkill -f "mini-news/dist/index.js --mcp-only" 2>/dev/null || true
pkill -f "mcp-chrome-bridge" 2>/dev/null || true
pkill -f "rea-agent" 2>/dev/null || true

echo ""
echo "==================================================="
echo "                 Done!"
echo "==================================================="
echo ""
