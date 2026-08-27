@echo off
setlocal enabledelayedexpansion
REM ===========================================================================
REM  Braelinn Poker League - one-click publish
REM
REM  Double-click this file. It commits everything that changed and pushes it
REM  to GitHub, which redeploys the live site in about a minute.
REM
REM  Optional: drag a file onto it, or run it from a terminal with a message:
REM      push.bat Fixed the blind structure
REM ===========================================================================
cd /d "%~dp0"
title Braelinn Poker League - publish

REM --- Find git. GitHub Desktop does NOT put git on your PATH, so look in the
REM     usual places before giving up. ------------------------------------------
set "GIT="
where git >nul 2>&1 && set "GIT=git"
if not defined GIT if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "GIT=%ProgramFiles(x86)%\Git\cmd\git.exe"
if not defined GIT for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%D\resources\app\git\cmd\git.exe" set "GIT=%%D\resources\app\git\cmd\git.exe"
)
if not defined GIT (
  echo.
  echo   Could not find git on this computer.
  echo   Install Git for Windows from https://git-scm.com/download/win
  echo   ...or just use GitHub Desktop instead ^(Commit, then Push origin^).
  echo.
  pause
  exit /b 1
)

echo.
echo   Braelinn Poker League
echo   ---------------------
echo.

REM --- Show what is about to be published --------------------------------------
"%GIT%" status --short
echo.

REM --- Commit -------------------------------------------------------------------
set "MSG=%*"
if "%MSG%"=="" set "MSG=Update league data"

"%GIT%" add -A
"%GIT%" diff --cached --quiet
if not errorlevel 1 (
  echo   Nothing changed since the last publish.
  echo   Checking whether anything is waiting to go up anyway...
  echo.
  goto :push
)
"%GIT%" commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo   Commit failed. Nothing was published.
  echo.
  pause
  exit /b 1
)

:push
REM --- Bring down anything that landed on GitHub first, or the push is rejected.
"%GIT%" pull --rebase
if errorlevel 1 (
  echo.
  echo   Could not merge with GitHub automatically.
  echo   Open GitHub Desktop and sort it out there - nothing was published.
  echo.
  pause
  exit /b 1
)

"%GIT%" push
if errorlevel 1 (
  echo.
  echo   PUSH FAILED.
  echo   Usually this is the internet, or GitHub needing you to sign in again.
  echo   Opening GitHub Desktop once will refresh the login.
  echo.
  pause
  exit /b 1
)

echo.
echo   Published. Live in about a minute:
echo   https://bevier19jac.github.io/braelinn/
echo.
echo   Watch the deploy:
echo   https://github.com/Bevier19jac/braelinn/actions
echo.
pause
