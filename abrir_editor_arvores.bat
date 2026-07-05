@echo off
setlocal
for /f %%P in ('powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue; if ($conn) { $conn.OwningProcess }"') do (
  taskkill /PID %%P /F >nul 2>&1
)
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:8765'"
python editor_server.py
