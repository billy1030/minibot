@echo off
chcp 65001 >nul
title MiniBot (Port 7009)

echo ===================================================
echo               MiniBot Launcher
echo   Model Context Protocol (MCP) + React 19 + Vite 8
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Check if node_modules exists in root
if not exist "node_modules\" (
    echo [Setup] Installing root dependencies...
    call npm install
)

:: 2. Build frontend production bundle (only if not already built or requested)
if "%1"=="--rebuild" goto BUILD_FRONTEND
if not exist "frontend\dist\index.html" goto BUILD_FRONTEND
echo [Build] Frontend bundle found (skipping rebuild for instant startup).
goto AFTER_BUILD

:BUILD_FRONTEND
echo [Build] Building frontend production bundle...
cd frontend
if not exist "node_modules\" (
    call npm install
)
if exist "node_modules\.bin\vite.cmd" (
    call node_modules\.bin\vite.cmd build
) else (
    call npm run build
)
cd ..

:AFTER_BUILD

:: Ensure PORT is explicitly set to 7009 for MiniBot
set PORT=7009

:: 3. Clean up any existing process holding Port 7009 (and its child process tree)
echo [Port Check] Ensuring Port 7009 is free...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 7009 -ErrorAction SilentlyContinue | ForEach-Object { cmd /c \"taskkill /PID $($_.OwningProcess) /T /F\" 2>`$null; Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" -ErrorAction SilentlyContinue | Where-Object { `$_.CommandLine -match 'mini-news/dist/index.js --mcp-only|rea-agent|mcp-chrome-bridge' } | ForEach-Object { cmd /c \"taskkill /PID $($_.ProcessId) /T /F\" 2>`$null }"

:: 4. Launch browser automatically in background after 2 seconds
start /min powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:7009'"

:: 5. Start Backend Server
echo.
echo [Running] Starting MiniBot on http://localhost:7009 ...
echo [Tip] Press Ctrl+C in this terminal window to stop the server.
echo.

if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd src/server.ts
) else (
    call npx tsx src/server.ts
)

pause
