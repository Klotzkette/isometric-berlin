@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve-local.py & goto :eof)
where python >nul 2>nul && (python serve-local.py & goto :eof)
echo Python 3 is required to start the local 3D viewer.
echo Install it from https://www.python.org/downloads/ and run this file again.
pause
