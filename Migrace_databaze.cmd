@echo off
setlocal
call "%~dp0Automigrace\\Migrace_databaze.cmd"
exit /b %ERRORLEVEL%

