@echo off
setlocal
set "loaderDemo=%~dp0loader\dist\demo-white.html"

if not exist "%loaderDemo%" (
  echo [ERROR] Loader demo not found: "%loaderDemo%"
  pause
  exit /b 1
)

start "" "%loaderDemo%"
exit /b %errorlevel%
