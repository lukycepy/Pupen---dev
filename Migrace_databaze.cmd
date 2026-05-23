@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Migrace_databaze.ps1"
if errorlevel 1 (
  echo.
  echo Migrace selhaly (errorlevel=%ERRORLEVEL%).
  echo Zavri okno nebo stiskni libovolnou klavesu pro ukonceni...
  pause >nul
  exit /b %ERRORLEVEL%
)
echo.
echo Migrace dokonceny.
exit /b 0
