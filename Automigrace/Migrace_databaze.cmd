@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "PS1=%~dp0Migrace_databaze.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "EC=%ERRORLEVEL%"

if not "%EC%"=="0" (
  echo.
  echo Migrace selhaly ^(code=%EC%^). Podivej se do slozky Automigrace\logs\
  echo.
  pause
)

exit /b %EC%

