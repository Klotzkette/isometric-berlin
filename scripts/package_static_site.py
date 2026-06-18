"""Package the static Isometric Berlin viewer for local download/use.

The output is a folder and ZIP archive under ``releases/``. It contains
the built React/OpenSeadragon app, all DZI tiles, a direct preview HTML,
and small launcher scripts for macOS/Linux and Windows.
"""

from __future__ import annotations

import argparse
import shutil
import stat
import zipfile
from pathlib import Path

PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"
PACKAGE_VERSION = "0.1.6"
SERVE_SCRIPT_NAME = "serve-local.py"
SERVE_LOCAL_SCRIPT = """#!/usr/bin/env python3
from __future__ import annotations

import functools
import http.server
import socket
import socketserver
import webbrowser
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766


class QuietHandler(http.server.SimpleHTTPRequestHandler):
  def end_headers(self) -> None:
    self.send_header("Cache-Control", "no-store")
    super().end_headers()

  def log_message(self, format: str, *args: object) -> None:
    print(f"[viewer] {self.address_string()} - {format % args}")


class ReusableTCPServer(socketserver.ThreadingTCPServer):
  allow_reuse_address = True


def first_available_port(host: str, start_port: int, attempts: int = 50) -> int:
  for port in range(start_port, start_port + attempts):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
      probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
      try:
        probe.bind((host, port))
      except OSError:
        continue
      return port
  raise SystemExit(f"No free local port found from {start_port}.")


def main() -> None:
  root = Path(__file__).resolve().parent
  port = first_available_port(DEFAULT_HOST, DEFAULT_PORT)
  if port != DEFAULT_PORT:
    print(f"Port {DEFAULT_PORT} is busy, using {port}.")

  handler = functools.partial(QuietHandler, directory=str(root))
  with ReusableTCPServer((DEFAULT_HOST, port), handler) as server:
    url = f"http://{DEFAULT_HOST}:{port}/"
    print(f"Serving Isometric Berlin from {root}")
    print(f"Open: {url}")
    webbrowser.open(url)
    try:
      server.serve_forever()
    except KeyboardInterrupt:
      print("\\nStopped local viewer.")


if __name__ == "__main__":
  main()
"""


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def copy_static_site(source: Path, target: Path) -> None:
  """Copy the built static site, excluding development-only sourcemaps."""
  if target.exists():
    shutil.rmtree(target)
  target.mkdir(parents=True)
  for path in source.rglob("*"):
    relative = path.relative_to(source)
    destination = target / relative
    if path.is_dir():
      destination.mkdir(parents=True, exist_ok=True)
      continue
    if path.suffix == ".map":
      continue
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def write_serve_script(package_dir: Path) -> None:
  """Write the shared local web server used by every launcher."""
  serve_script = package_dir / SERVE_SCRIPT_NAME
  serve_script.write_text(SERVE_LOCAL_SCRIPT, encoding="utf-8")
  serve_script.chmod(
    serve_script.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
  )


def write_launchers(package_dir: Path) -> None:
  """Write cross-platform launchers for the shared local server."""
  write_serve_script(package_dir)
  mac = package_dir / "start-mac.command"
  mac.write_text(
    """#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 serve-local.py
elif command -v python >/dev/null 2>&1; then
  python serve-local.py
else
  echo "Python 3 is required. Install it from https://www.python.org/downloads/"
  read -r _
fi
""",
    encoding="utf-8",
  )
  mac.chmod(mac.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

  linux = package_dir / "start-linux.sh"
  linux.write_text(
    """#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 serve-local.py
elif command -v python >/dev/null 2>&1; then
  python serve-local.py
else
  echo "Python 3 is required. Install it from https://www.python.org/downloads/"
fi
""",
    encoding="utf-8",
  )
  linux.chmod(linux.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

  windows = package_dir / "start-windows.bat"
  windows.write_text(
    """@echo off
cd /d "%~dp0"
py -3 serve-local.py
if errorlevel 1 (
  python serve-local.py
)
pause
""",
    encoding="utf-8",
  )


def write_readme(package_dir: Path) -> None:
  (package_dir / "README.txt").write_text(
    f"""Isometric Berlin - Regierungsviertel {PACKAGE_VERSION}
==============================================

Deutsch
-------

Dieses Paket ist eine lokale HTML-Website mit allen Kartendaten. Zum
Anzeigen brauchst du keine KI und keinen Google-Key. Version 0.1.6
nutzt die korrigierte isometrische Orientierung plus einen kleinen
Nordindikator und startet auf dem ersten freien lokalen Port ab 8766.
Die Daten stammen aus kostenlosen/offenen Quellen: Berlin LoD2,
OpenStreetMap, ALKIS, DOP-Preview und DGM-Preview.

Start:

- macOS: Doppelklick auf start-mac.command
- Windows: Doppelklick auf start-windows.bat
- Linux: ./start-linux.sh

Danach öffnet sich eine lokale Adresse im Browser, normalerweise
http://127.0.0.1:8766/. Wenn dieser Port belegt ist, nimmt der Starter
automatisch den nächsten freien Port. Das Terminalfenster muss geöffnet
bleiben, solange die Website laufen soll. Beenden mit Ctrl+C oder
Fenster schließen.

Falls der Browser eine Warnung beim direkten Öffnen von index.html
zeigt: Das ist normal. Für Deep-Zoom-Kacheln braucht die Website einen
kleinen lokalen Webserver; dafür sind die Startdateien da.

English
-------

This package is a local HTML website with all map data included. It
does not need an AI model or a Google key to run. Version 0.1.6 uses
the corrected isometric orientation plus a small north indicator and
starts on the first free local port at or above 8766. Data sources are
free and open: Berlin LoD2, OpenStreetMap, ALKIS, DOP preview, and DGM
preview.

Start:

- macOS: double-click start-mac.command
- Windows: double-click start-windows.bat
- Linux: ./start-linux.sh

Then a local address opens in the browser, usually
http://127.0.0.1:8766/. If that port is busy, the launcher
automatically uses the next free port. Keep the terminal window open
while the website is running. Stop with Ctrl+C or close the window.

Attribution:
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)
""",
    encoding="utf-8",
  )


def zip_package(package_dir: Path, zip_path: Path) -> None:
  if zip_path.exists():
    zip_path.unlink()
  with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(package_dir.rglob("*")):
      if path.is_file():
        archive.write(path, path.relative_to(package_dir.parent))


def package_static_site(root: Path, out_dir: Path) -> tuple[Path, Path]:
  source = root / "src" / "app" / "dist"
  if not (source / "index.html").exists():
    raise SystemExit(
      "Missing src/app/dist/index.html. Run `cd src/app && bun run build`."
    )
  package_dir = out_dir / PACKAGE_NAME
  copy_static_site(source, package_dir)
  write_launchers(package_dir)
  write_readme(package_dir)
  zip_path = out_dir / f"{PACKAGE_NAME}.zip"
  zip_package(package_dir, zip_path)
  return package_dir, zip_path


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out-dir", type=Path, default=Path("releases"))
  args = parser.parse_args()

  package_dir, zip_path = package_static_site(repo_root(), args.out_dir)
  print(f"Wrote local website folder: {package_dir}")
  print(f"Wrote downloadable ZIP: {zip_path}")


if __name__ == "__main__":
  main()
