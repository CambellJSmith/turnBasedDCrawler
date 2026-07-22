@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20 or newer is required to run ashfall depths.
  pause
  exit /b 1
)

set "url=http://127.0.0.1:5173"

start "ashfall depths server" /D "%~dp0" cmd /c "node server.js"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%url%'; for ($attempt = 0; $attempt -lt 50; $attempt++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 -ErrorAction Stop; if ($response.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {} Start-Sleep -Milliseconds 100 }; Start-Process $url"

endlocal
