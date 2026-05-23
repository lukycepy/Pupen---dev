@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Migrace_databaze.ps1"
set "EC=%ERRORLEVEL%"

echo.
if not "%EC%"=="0" (
  echo Migrace selhaly ^(code=%EC%^). Podivej se do slozky Automigrace\logs\
) else (
  echo Migrace dokonceny.
)

echo Stiskni libovolnou klavesu pro ukonceni...
pause >nul
exit /b %EC%
