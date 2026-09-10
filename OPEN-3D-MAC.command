#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 serve-local.py
elif command -v python >/dev/null 2>&1; then
  exec python serve-local.py
else
  osascript -e 'display dialog "Python 3 wird zum Start des lokalen 3D-Viewers benötigt." buttons {"OK"} default button 1'
fi
