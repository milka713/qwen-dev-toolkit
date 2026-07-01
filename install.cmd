@echo off
REM Windows wrapper — installs/updates qwen-dev-toolkit via the cross-platform install.js.
REM INSTALL and UPDATE are the same command: run it again to update in place.
node "%~dp0install.js" %*
