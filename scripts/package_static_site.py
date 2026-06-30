"""Package the static Isometric Berlin viewer for local download/use.

The output is a folder and ZIP archive under ``releases/``. It contains
the built React/OpenSeadragon app, all DZI tiles, a direct preview HTML,
and small launcher scripts for macOS/Linux and Windows.
"""

from __future__ import annotations

import argparse
import re
import shutil
import stat
import zipfile
from pathlib import Path

PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"
PACKAGE_VERSION = "0.1.23"
SERVE_SCRIPT_NAME = "serve-local.py"
DUPLICATE_COPY_RE = re.compile(r"^.+ [2-9](?:\.[^.]+)?$")
ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)
SERVE_LOCAL_SCRIPT = """#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import socket
import socketserver
import webbrowser
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766


class QuietHandler(http.server.SimpleHTTPRequestHandler):
  def handle(self) -> None:
    try:
      super().handle()
    except (BrokenPipeError, ConnectionResetError):
      pass

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


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Serve the local Isometric Berlin package.")
  parser.add_argument("--host", default=DEFAULT_HOST, help="Host/interface to bind.")
  parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Preferred local port.")
  parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically.")
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  root = Path(__file__).resolve().parent
  port = first_available_port(args.host, args.port)
  if port != args.port:
    print(f"Port {args.port} is busy, using {port}.")

  handler = functools.partial(QuietHandler, directory=str(root))
  with ReusableTCPServer((args.host, port), handler) as server:
    url = f"http://{args.host}:{port}/"
    print(f"Serving Isometric Berlin from {root}")
    print(f"Open: {url}")
    if not args.no_open:
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


def should_package_file(path: Path) -> bool:
  """Return whether ``path`` belongs in the downloadable package."""
  for part in path.parts:
    if part == "__MACOSX":
      return False
    if part.startswith("."):
      return False
    if DUPLICATE_COPY_RE.match(part):
      return False
  return True


def copy_static_site(source: Path, target: Path) -> None:
  """Copy the built static site, excluding development-only sourcemaps."""
  if target.exists():
    shutil.rmtree(target)
  target.mkdir(parents=True)
  for path in source.rglob("*"):
    if not should_package_file(path):
      continue
    relative = path.relative_to(source)
    destination = target / relative
    if path.is_dir():
      destination.mkdir(parents=True, exist_ok=True)
      continue
    if path.suffix == ".map":
      continue
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def remove_unwanted_package_paths(package_dir: Path) -> None:
  for path in sorted(
    package_dir.rglob("*"), key=lambda item: len(item.parts), reverse=True
  ):
    if should_package_file(path):
      continue
    if path.is_dir():
      shutil.rmtree(path)
    else:
      path.unlink()


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
Anzeigen brauchst du keine KI und keinen Google-Key. Version 0.1.23
ergänzt kopierbare Ansicht-Links für Landmarke, Ausrichtung und Spiegelung,
stellt solche Hash-Links beim Öffnen wieder her und hält die erweiterte
Toolbar auf kleinen Bildschirmen zweizeilig. Sie enthält außerdem ein
Tastenkürzel-Hilfefenster (Taste ?), behebt das Anhäufen von
Marker-Klick-Listenern bei der Landmarken-Tour und erlaubt Remote-DZI-Hosting
über VITE_DZI_BASE_URL. Sie
verbessert die Viewer-Workflows mit sichtbaren Vor/Zurück-Controls für
Landmarken, deaktivierten Controls während des Ladens, wiederhergestelltem
Fokus nach dem Schließen der Referenzkarte und einer engeren Mobile-Toolbar.
Sie schließt die Top-down-Referenzkarte zuverlässig mit Escape, auch wenn
ein Button fokussiert ist. Sie enthält außerdem eine Landmarken-Tour,
Tastatursteuerung für vorige/nächste Landmarke, Tourstart, Gesamtansicht und
Ansicht-Link, klarere rollenfarbige Landmark-Pins und stärkere Fokuszustände. Die Version
enthält außerdem dichtere
Fassaden- und Fensterdetails der Gebäude, blockierende QA bei
relativen Landmarken-Fehllagen, strengere Landmarken-Lagechecks,
sauberer gefilterte aktuelle Wikimedia/Wikipedia-Referenzen, reichere
Gebäudeflächen aus LoD2-Höhen, Dachtypen und OSM-Kontext, korrigierte
Landmarken für Paul-Löbe-Haus und Marie-Elisabeth-Lüders-Haus, einen
OSM/LoD2-Lagecheck und Ansichtssteuerungen für Nord/Ost/Süd/West,
Drehen und Spiegeln. Sie enthält außerdem eine schärfere lokale
Pixel-Art-Stilisierung, eine Nord-oben-Startansicht, beschriftete
Landmark-Pins und eine Top-down-Referenzkarte aus OSM und LoD2 mit
Nordpfeil und Maßstab direkt im Viewer. Die Landmark-Materialfarben
nutzen zusätzlich frei lizenzierte Wikimedia/Wikipedia-Referenzen. Das
Paket startet auf dem ersten freien lokalen Port ab 8766, erlaubt
optionale Startparameter für Skripte oder feste Ports und erzeugt das
Download-ZIP mit stabilen Metadaten. Die Daten stammen aus
kostenlosen/offenen Quellen: Berlin LoD2, OpenStreetMap, ALKIS,
DOP-Preview, DGM-Preview und Wikimedia Commons/Wikipedia.

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

Erweitert: `python3 serve-local.py --no-open --port 8770`

English
-------

This package is a local HTML website with all map data included. It
does not need an AI model or a Google key to run. Version 0.1.23 adds
copyable view links for the selected landmark, orientation, and mirror
state, restores those hash links on open, and keeps the expanded toolbar
to two rows on small screens. It also adds a keyboard-shortcut help panel
(press ?), fixes marker-overlay click-listener accumulation during the
landmark tour, and supports remote DZI hosting via VITE_DZI_BASE_URL. It improves
viewer workflows with visible previous/next landmark controls, disabled
controls while loading, restored focus after closing the reference map,
and a tighter mobile toolbar. It closes the top-down reference map reliably
with Escape, even when a button has focus. It also adds a landmark tour,
keyboard controls for previous/next/tour/home/link, clearer role-colored
landmark pins, and stronger focus states. It also keeps
denser building facade/window details, makes relative landmark-placement
failures block QA status, keeps stricter landmark-placement QA, cleaner
current-day Wikimedia/Wikipedia references, richer building surfaces
from LoD2 heights, roof types, and OSM context, corrected Paul-Löbe-Haus
and Marie-Elisabeth-Lüders-Haus landmarks, an OSM/LoD2 placement QA
report, and view controls for north/east/south/west, rotation, and
mirror views. It also includes crisper local pixel-art styling and a
top-down OSM/LoD2 reference map with north arrow and scale inside the
viewer, plus a north-up start view and labeled landmark pins. Landmark
material colours additionally use freely licensed Wikimedia/Wikipedia
references. It starts on the first free local port at or above 8766,
supports optional server flags for scripts or fixed ports, and writes
the downloadable ZIP with stable metadata. Data sources are free and
open: Berlin LoD2, OpenStreetMap, ALKIS, DOP preview, DGM preview, and
Wikimedia Commons/Wikipedia.

Start:

- macOS: double-click start-mac.command
- Windows: double-click start-windows.bat
- Linux: ./start-linux.sh

Then a local address opens in the browser, usually
http://127.0.0.1:8766/. If that port is busy, the launcher
automatically uses the next free port. Keep the terminal window open
while the website is running. Stop with Ctrl+C or close the window.

Advanced: `python3 serve-local.py --no-open --port 8770`

Attribution:
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia

Per-file Wikimedia credits are bundled at
dzi/regierungsviertel/wikimedia_attribution.json.
""",
    encoding="utf-8",
  )


def zip_info_for(path: Path, arcname: Path) -> zipfile.ZipInfo:
  info = zipfile.ZipInfo(str(arcname), ZIP_TIMESTAMP)
  info.compress_type = zipfile.ZIP_DEFLATED
  info.create_system = 3
  info.external_attr = stat.S_IMODE(path.stat().st_mode) << 16
  return info


def zip_package(package_dir: Path, zip_path: Path) -> None:
  if zip_path.exists():
    zip_path.unlink()
  with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(package_dir.rglob("*")):
      if path.is_file() and should_package_file(path):
        archive.writestr(
          zip_info_for(path, path.relative_to(package_dir.parent)),
          path.read_bytes(),
        )


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
  remove_unwanted_package_paths(package_dir)
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
