@echo off
REM ===========================================================================
REM  Braelinn Poker League — one-click publish
REM  Double-click this file after editing data.js. It commits and pushes,
REM  and GitHub Pages redeploys in about a minute.
REM ===========================================================================
cd /d "%~dp0"

echo.
echo  Braelinn Poker League - publishing changes...
echo.

git add -A

set MSG=%*
if "%MSG%"=="" set MSG=Update league data

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo  Nothing to commit - already up to date.
  echo.
  pause
  exit /b 0
)

git push
if errorlevel 1 (
  echo.
  echo  PUSH FAILED. Check your internet connection and GitHub login.
  echo.
  pause
  exit /b 1
)

echo.
echo  Done. Live in ~60 seconds.
echo.
pause
