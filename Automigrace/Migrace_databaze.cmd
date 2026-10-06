@echo off
setlocal EnableExtensions DisableDelayedExpansion

chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%~dp0.."
set "PS1=%SCRIPT_DIR%Migrace_databaze.ps1"

if not exist "%PS1%" (
  echo [CHYBA] PS1 skript nebyl nalezen: %PS1%
  exit /b 2
)

pushd "%REPO_ROOT%"
set "PUSHED=1"

powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%PS1%"
set "EC=%ERRORLEVEL%"

if defined PUSHED popd

if not "%EC%"=="0" (
  echo.
  echo [CHYBA] Migrace selhaly ^(exit code=%EC%^)
  echo         Podivej se do logu: %SCRIPT_DIR%logs\
  echo         Nejdrive zkontroluj:
  echo           1. .env.local obsahuje spravne SUPABASE_DB_PASSWORD a DATABASE_URL
  echo           2. Mas nastaveny Supabase CLI token: supabase login
  echo           3. Project-ref odpovida instance v .env / .env.local
  echo.
  pause
) else (
  echo.
  echo [OK] Migrace probehly uspesne.
)

endlocal & exit /b %EC%

