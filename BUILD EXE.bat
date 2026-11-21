@echo off
rem Builds the portable exe folder (needs Node.js). First run downloads Electron (~100 MB), later runs are quick.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing build tools...
  call npm install
  if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
)
call node build.js
if errorlevel 1 ( pause & exit /b 1 )
echo.
echo Done. Open the dist folder.
start "" "%~dp0dist"
pause
