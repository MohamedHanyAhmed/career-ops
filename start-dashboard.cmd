@echo off
setlocal
cd /d "%~dp0web"
call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%
call npm.cmd run start -- -p 3000
