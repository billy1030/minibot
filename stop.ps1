$conns = Get-NetTCPConnection -LocalPort 7009 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        $p = $c.OwningProcess
        if ($p -and $p -ne 0) {
            Write-Host "Terminating process tree for PID $p holding port 7009..." -ForegroundColor Yellow
            cmd /c "taskkill /PID $p /T /F" 2>$null
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "Port 7009 has been freed successfully." -ForegroundColor Green
} else {
    Write-Host "Port 7009 is already free (no listening process found)." -ForegroundColor Cyan
}

# Also kill any remaining minibot or minibot-backend processes
Get-Process -Name "minibot*", "minibot-backend*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping $($_.ProcessName) (PID $($_.Id))..." -ForegroundColor Yellow
    cmd /c "taskkill /PID $($_.Id) /T /F" 2>$null
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Sweep and terminate any orphaned MCP child processes spawned by stdio
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -match "mini-news/dist/index.js --mcp-only|rea-agent|mcp-chrome-bridge" 
} | ForEach-Object {
    Write-Host "Cleaning orphan MCP child process PID $($_.ProcessId)..." -ForegroundColor Yellow
    cmd /c "taskkill /PID $($_.ProcessId) /T /F" 2>$null
}
