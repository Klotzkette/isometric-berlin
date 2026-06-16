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
PACKAGE_VERSION = "0.1.1"


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


def write_launchers(package_dir: Path) -> None:
  """Write cross-platform launchers that serve the folder locally."""
  mac = package_dir / "start-mac.command"
  mac.write_text(
    """#!/bin/sh
cd "$(dirname "$0")"
PORT=8766
URL="http://127.0.0.1:${PORT}/"
echo "Starting Isometric Berlin at ${URL}"
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "${URL}") &
  python3 -m http.server "${PORT}" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  (sleep 1; open "${URL}") &
  python -m http.server "${PORT}" --bind 127.0.0.1
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
PORT=8766
URL="http://127.0.0.1:${PORT}/"
echo "Starting Isometric Berlin at ${URL}"
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; xdg-open "${URL}" >/dev/null 2>&1 || true) &
  python3 -m http.server "${PORT}" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  (sleep 1; xdg-open "${URL}" >/dev/null 2>&1 || true) &
  python -m http.server "${PORT}" --bind 127.0.0.1
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
set PORT=8766
set URL=http://127.0.0.1:%PORT%/
echo Starting Isometric Berlin at %URL%
start "" "%URL%"
py -3 -m http.server %PORT% --bind 127.0.0.1
if errorlevel 1 (
  python -m http.server %PORT% --bind 127.0.0.1
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
Anzeigen brauchst du keine KI und keinen Google-Key. Die Daten stammen
aus kostenlosen/offenen Quellen: Berlin LoD2, OpenStreetMap, ALKIS,
DOP-Preview und DGM-Preview.

Start:

- macOS: Doppelklick auf start-mac.command
- Windows: Doppelklick auf start-windows.bat
- Linux: ./start-linux.sh

Danach öffnet sich http://127.0.0.1:8766/ im Browser. Das Terminalfenster
muss geöffnet bleiben, solange die Website laufen soll. Beenden mit
Ctrl+C oder Fenster schließen.

Falls der Browser eine Warnung beim direkten Öffnen von index.html
zeigt: Das ist normal. Für Deep-Zoom-Kacheln braucht die Website einen
kleinen lokalen Webserver; dafür sind die Startdateien da.

English
-------

This package is a local HTML website with all map data included. It
does not need an AI model or a Google key to run. Data sources are free
and open: Berlin LoD2, OpenStreetMap, ALKIS, DOP preview, and DGM
preview.

Start:

- macOS: double-click start-mac.command
- Windows: double-click start-windows.bat
- Linux: ./start-linux.sh

Then open http://127.0.0.1:8766/ in the browser. Keep the terminal
window open while the website is running. Stop with Ctrl+C or close the
window.

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
