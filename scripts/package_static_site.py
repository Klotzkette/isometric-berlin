"""Package the static Isometric Berlin viewer for local download/use.

The output is a folder and ZIP archive under ``releases/``. It contains
the built React/Three.js app, its complete local scene assets, and
a double-clickable launch guide with local HTTP launchers.
"""

from __future__ import annotations

import argparse
import errno
import gzip
import hashlib
import json
import re
import shutil
import stat
import tarfile
import zipfile
from pathlib import Path

PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"
PACKAGE_VERSION = "1.0.32"
SERVE_SCRIPT_NAME = "serve-local.py"
STATIC_ARCHIVE_NAME = f"isometric-berlin-viewer-v{PACKAGE_VERSION}.tar.gz"
EXECUTABLE_PACKAGE_FILES = frozenset(
  {SERVE_SCRIPT_NAME, "start-linux.sh", "OPEN-3D-MAC.command"}
)
DUPLICATE_COPY_RE = re.compile(r"^.+ [2-9](?:\.[^.]+)?$")
ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)
ARCHIVE_MTIME = 1_767_225_600
SERVE_LOCAL_SCRIPT = """#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import json
import socket
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766
START_PAGE = "index.html"
REQUIRED_PACKAGE_FILES = (
  START_PAGE,
  "START-HERE.html",
  "OPEN-3D-MAC.command",
  "OPEN-3D-WINDOWS.bat",
  "README.txt",
  "dzi/regierungsviertel/pedestrian_map.png",
  "dzi/regierungsviertel/startup-map.jpg",
  "dzi/regierungsviertel/visual_reference_attribution.json",
  "mesh/regierungsviertel/scene.json",
  "mesh/regierungsviertel/ground-context.json",
  "mesh/regierungsviertel/lod2-prisms.json",
  "mesh/regierungsviertel/minecraft-voxels.json",
  "mesh/regierungsviertel/park-details.json",
  "mesh/regierungsviertel/street-details.json",
  "mesh/regierungsviertel/surface-polygons.json",
)
CACHEABLE_SUFFIXES = {
  ".css",
  ".jpg",
  ".json",
  ".js",
  ".png",
  ".svg",
  ".wasm",
  ".webp",
  ".woff2",
}


def cache_control_for_path(request_path: str) -> str:
  suffix = Path(urlsplit(request_path).path).suffix.lower()
  if suffix in CACHEABLE_SUFFIXES:
    return "public, max-age=31536000, immutable"
  return "no-cache"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
  extensions_map = {
    **http.server.SimpleHTTPRequestHandler.extensions_map,
    ".dzi": "application/xml",
  }
  protocol_version = "HTTP/1.1"

  def handle(self) -> None:
    try:
      super().handle()
    except (BrokenPipeError, ConnectionResetError):
      pass

  def end_headers(self) -> None:
    self.send_header("Cache-Control", cache_control_for_path(self.path))
    super().end_headers()

  def log_message(self, format: str, *args: object) -> None:
    print(f"[viewer] {self.address_string()} - {format % args}", flush=True)


class ReusableTCPServer(socketserver.ThreadingTCPServer):
  allow_reuse_address = True
  daemon_threads = True
  request_queue_size = 32


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


def verify_procedural_scene(root: Path) -> None:
  scene_path = root / "mesh/regierungsviertel/scene.json"
  try:
    scene = json.loads(scene_path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError) as exc:
    raise SystemExit(f"Invalid 3D scene manifest: {exc}") from exc
  if not isinstance(scene, dict):
    raise SystemExit("Invalid 3D scene manifest: root must be an object.")
  strategy = scene.get("render_strategy")
  if scene.get("schema_version") != 3 or not isinstance(strategy, dict):
    raise SystemExit("Invalid 3D scene manifest: procedural strategy is missing.")
  if strategy.get("kind") != "procedural-drawn":
    raise SystemExit("Invalid 3D scene manifest: unexpected render strategy.")
  if strategy.get("legacy_photogrammetry_removed") is not True:
    raise SystemExit("Invalid 3D scene manifest: retired photo assets are enabled.")
  limits = strategy.get("exact_building_limits")
  if limits != {"desktop": 12000, "mobile": 5000}:
    raise SystemExit("Invalid 3D scene manifest: exact-building limits differ.")
  for inventory in ("base_tiles", "surface_detail_tiles", "hero_details"):
    if scene.get(inventory) != []:
      raise SystemExit(f"Invalid 3D scene manifest: {inventory} must be empty.")
  retired = sorted(
    path.name
    for path in scene_path.parent.iterdir()
    if path.is_file() and (path.suffix.lower() == ".glb" or path.name.endswith(".plate.gz"))
  )
  if retired:
    raise SystemExit(f"Retired binary assets remain in package: {', '.join(retired)}")


def require_package_files(root: Path) -> None:
  missing = [relative for relative in REQUIRED_PACKAGE_FILES if not (root / relative).exists()]
  if missing:
    for relative in missing:
      print(f"Missing package file: {relative}", flush=True)
    raise SystemExit("This local viewer package is incomplete. Download the ZIP again.")
  verify_procedural_scene(root)


def main() -> None:
  args = parse_args()
  root = Path(__file__).resolve().parent
  require_package_files(root)
  port = first_available_port(args.host, args.port)
  if port != args.port:
    print(f"Port {args.port} is busy, using {port}.", flush=True)

  handler = functools.partial(QuietHandler, directory=str(root))
  with ReusableTCPServer((args.host, port), handler) as server:
    url = f"http://{args.host}:{port}/{START_PAGE}"
    print(f"Serving Isometric Berlin from {root}", flush=True)
    print(f"Open: {url}", flush=True)
    if not args.no_open:
      webbrowser.open(url)
    try:
      server.serve_forever()
    except KeyboardInterrupt:
      print("\\nStopped local viewer.", flush=True)


if __name__ == "__main__":
  main()
"""

START_HERE_HTML = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Isometric Berlin · 3D starten / Start 3D</title>
<style>
:root { color-scheme: dark; font: 17px/1.55 system-ui, sans-serif; background: #17211e; color: #f3eddc; }
body { min-height: 100dvh; margin: 0; display: grid; place-items: center; }
main { box-sizing: border-box; width: min(100%, 760px); padding: clamp(24px, 5vw, 56px); }
h1 { font-size: clamp(32px, 7vw, 50px); line-height: 1.05; margin-bottom: 16px; }
h2 { font-size: 20px; margin-top: 30px; }
a { color: #eab966; }
.launch { display: inline-flex; align-items: center; min-height: 44px; padding: 4px 18px; background: #eab966; color: #17211e; border-radius: 8px; text-decoration: none; font-weight: 700; }
code { background: #29352e; padding: 3px 7px; border-radius: 4px; overflow-wrap: anywhere; }
footer { margin-top: 36px; color: #c2c8b9; font-size: 12px; }
[hidden] { display: none !important; }
</style>
</head>
<body><main>
<p>BERLIN · REGIERUNGSVIERTEL</p>
<h1>Isometric Berlin</h1>
<p>Die vollständige isometrische Stadt. Alle fünf Darstellungen, Gebäude und Wege sind im Download enthalten.</p>
<p lang="en">The complete isometric city. All five visual styles, buildings and paths are included in this download.</p>
<p id="http-launch" hidden><a class="launch" id="open-viewer" href="index.html">3D öffnen / Open 3D</a></p>
<section id="local-help">
<h2>Deutsch · Lokal starten</h2>
<p>Entpacke den gesamten Download. Starte dann <a href="OPEN-3D-WINDOWS.bat">OPEN-3D-WINDOWS.bat</a> unter Windows oder <a href="OPEN-3D-MAC.command">OPEN-3D-MAC.command</a> unter macOS. Auf Linux: <code>sh start-linux.sh</code>.</p>
<p>Falls macOS den Start blockiert: Rechtsklick auf die Datei, dann „Öffnen“. Alternativ im entpackten Ordner <code>python3 serve-local.py</code> ausführen. Benötigt wird <a href="https://www.python.org/downloads/">Python 3</a>. Der Browser öffnet die Stadt automatisch. Lass das Terminal offen, solange du den Viewer nutzt.</p>
<p>Ein Doppelklick auf index.html kann die Stadt wegen der Dateizugriffsregeln des Browsers nicht laden. Die Startprogramme richten den nötigen lokalen HTTP-Zugriff ein; ein Internetzugang ist danach nicht nötig.</p>
<h2 lang="en">English · Start locally</h2>
<p lang="en">Extract the entire download, then run OPEN-3D-WINDOWS.bat on Windows or OPEN-3D-MAC.command on macOS. On Linux, run <code>sh start-linux.sh</code>. If macOS blocks the launcher, right-click it and choose Open. Alternatively, run <code>python3 serve-local.py</code> in the extracted folder. Python 3 is required. Keep the terminal open while using the viewer.</p>
<p lang="en">Opening index.html directly cannot load the city because of browser file-access rules. The launchers provide local HTTP access and open the browser automatically. No internet connection is needed afterward.</p>
</section>
<p><a href="https://github.com/Klotzkette/isometric-berlin">Repository</a> · <a href="https://klotzkette.github.io/isometric-berlin/">Online-Viewer / Online viewer</a> · <a href="README.txt">Hilfe / Help</a></p>
<footer>© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)<br>Visual references: Wikimedia Commons/Wikipedia · Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)</footer>
</main>
<script>
// File URLs show usable launch instructions; HTTP opens the same 3D app.
if (window.location.protocol === "http:" || window.location.protocol === "https:") {
  const viewer = new URL("index.html", window.location.href);
  viewer.search = window.location.search;
  viewer.hash = window.location.hash;
  document.getElementById("http-launch").hidden = false;
  document.getElementById("open-viewer").href = viewer.href;
  window.location.replace(viewer.href);
}
</script>
</body></html>
"""


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def should_package_file(path: Path, root: Path | None = None) -> bool:
  """Return whether ``path`` belongs in the downloadable package."""
  if path.is_symlink():
    return False
  inspected_path = path
  if root is not None:
    try:
      inspected_path = path.relative_to(root)
    except ValueError:
      return False
  # These are retired presentation exports, never source geometry. Keep the
  # walking minimap, startup backdrop, navigation metadata and every 3D asset.
  if "regierungsviertel_files" in inspected_path.parts:
    return False
  if inspected_path.parent.as_posix().endswith(
    "dzi/regierungsviertel"
  ) and inspected_path.name in {
    "overview.png",
    "overview_source.png",
    "reference_map.png",
    "regierungsviertel.dzi",
    "preview.html",
  }:
    return False
  for part in inspected_path.parts:
    if part == "__MACOSX":
      return False
    if part.startswith("."):
      return False
    if DUPLICATE_COPY_RE.match(part):
      return False
  return True


def copy_file_contents(source: Path, destination: Path) -> None:
  """Copy file bytes without macOS ``fcopyfile`` metadata fast paths."""
  with source.open("rb") as src, destination.open("wb") as dst:
    while chunk := src.read(1024 * 1024):
      dst.write(chunk)


def file_digest(path: Path) -> dict[str, int | str]:
  """Return stable package-file size and SHA-256 metadata."""
  digest = hashlib.sha256()
  size = 0
  with path.open("rb") as handle:
    while chunk := handle.read(1024 * 1024):
      size += len(chunk)
      digest.update(chunk)
  return {"bytes": size, "sha256": digest.hexdigest()}


def remove_generated_tree(path: Path, attempts: int = 5) -> None:
  """Remove an old generated tree despite Finder metadata creation races."""
  for attempt in range(attempts):
    if not path.exists():
      return
    try:
      shutil.rmtree(path)
      return
    except OSError as error:
      if error.errno != errno.ENOTEMPTY or attempt == attempts - 1:
        raise
      for finder_metadata in path.rglob(".DS_Store"):
        finder_metadata.unlink(missing_ok=True)


def copy_static_site(source: Path, target: Path) -> None:
  """Copy the built static site, excluding development-only sourcemaps."""
  if target.exists():
    remove_generated_tree(target)
  target.mkdir(parents=True)
  for path in source.rglob("*"):
    if not should_package_file(path, source):
      continue
    relative = path.relative_to(source)
    destination = target / relative
    if path.is_dir():
      destination.mkdir(parents=True, exist_ok=True)
      continue
    if path.suffix == ".map":
      continue
    destination.parent.mkdir(parents=True, exist_ok=True)
    copy_file_contents(path, destination)


def ensure_public_viewer_support_copied(source: Path, target: Path) -> None:
  """Copy retained viewer support images and metadata from the public source."""
  source_root = source / "dzi" / "regierungsviertel"
  if not source_root.is_dir():
    return

  for path in source_root.rglob("*"):
    if not path.is_file() or not should_package_file(path, source):
      continue
    relative = path.relative_to(source)
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    copy_file_contents(path, destination)


def remove_unwanted_package_paths(package_dir: Path) -> None:
  for path in sorted(
    package_dir.rglob("*"), key=lambda item: len(item.parts), reverse=True
  ):
    if should_package_file(path, package_dir):
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


def write_start_here(package_dir: Path) -> None:
  """Write an HTTP redirect and file-safe bilingual 3D launch guide."""
  if not (package_dir / "index.html").is_file():
    raise SystemExit(
      f"Missing packaged 3D viewer entry point: {package_dir / 'index.html'}"
    )
  (package_dir / "START-HERE.html").write_text(START_HERE_HTML, encoding="utf-8")


def write_launchers(package_dir: Path) -> None:
  """Write local HTTP launchers for the complete isometric viewer.

  START-HERE explains the required local HTTP origin. Platform launchers make
  the complete 3D viewer the obvious path after extracting the ZIP.
  """
  write_serve_script(package_dir)
  mac_notes = package_dir / "start-mac-if-needed.txt"
  mac_notes.write_text(
    """macOS 3D viewer launch instructions.

First try double-clicking OPEN-3D-MAC.command. If macOS warns about the
download, right-click it and choose Open. START-HERE.html provides the same
local HTTP launch instructions.

Only use Terminal for the server fallback:

1. Open Terminal.
2. Type exactly `cd ` including the trailing space.
3. Drag the whole unzipped folder into the Terminal window and press Return.
   The command line must start with `cd `. Do not run the folder path alone.
4. Run: python3 serve-local.py
5. The server opens the full 3D viewer at the printed
   http://127.0.0.1:.../index.html address.

OPEN-3D-MAC.command runs this same command for you.
""",
    encoding="utf-8",
  )

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

  mac = package_dir / "OPEN-3D-MAC.command"
  mac.write_text(
    """#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 serve-local.py
elif command -v python >/dev/null 2>&1; then
  exec python serve-local.py
else
  osascript -e 'display dialog "Python 3 wird zum Start des lokalen 3D-Viewers benötigt." buttons {"OK"} default button 1'
fi
""",
    encoding="utf-8",
  )
  mac.chmod(mac.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

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
  (package_dir / "OPEN-3D-WINDOWS.bat").write_text(
    """@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve-local.py & goto :eof)
where python >nul 2>nul && (python serve-local.py & goto :eof)
echo Python 3 is required to start the local 3D viewer.
echo Install it from https://www.python.org/downloads/ and run this file again.
pause
""",
    encoding="utf-8",
  )


def packaged_scene_counts(package_dir: Path) -> dict[str, int]:
  """Read the release-copy procedural limits so README claims cannot go stale."""
  scene_path = package_dir / "mesh" / "regierungsviertel" / "scene.json"
  scene = json.loads(scene_path.read_text(encoding="utf-8"))
  strategy = scene.get("render_strategy", {})
  limits = strategy.get("exact_building_limits", {})
  return {
    "desktop_exact": int(limits.get("desktop", 0)),
    "mobile_exact": int(limits.get("mobile", 0)),
    "source_buildings": int(strategy.get("source_building_count", 0)),
  }


def write_readme(package_dir: Path) -> None:
  """Write current local setup instructions, without retired renderer controls."""
  counts = packaged_scene_counts(package_dir)
  (package_dir / "README.txt").write_text(
    f"""Isometric Berlin - Regierungsviertel {PACKAGE_VERSION}

DEUTSCH

Dieses Paket enthält die vollständige isometrische 3D-Stadt mit Tag, Nacht,
Schnee, Minecraft und Schwellenraum. Standort, Blickrichtung und Geh-/Flugzustand
bleiben beim Wechsel der Darstellung erhalten. Alle benötigten Daten sind lokal
enthalten; kein AI-Modell, Google-Schlüssel oder kostenpflichtiger Dienst nötig.

1. Den gesamten Download entpacken.
2. Windows: OPEN-3D-WINDOWS.bat oder start-windows.bat doppelklicken.
   macOS: OPEN-3D-MAC.command starten; bei Bedarf Rechtsklick > Öffnen.
   Linux: sh start-linux.sh
3. Alternativ im entpackten Ordner: python3 serve-local.py
4. Den automatisch geöffneten Browser verwenden und das Terminal offen lassen.

Python 3 wird benötigt: https://www.python.org/downloads/
START-HERE.html erklärt diese Schritte auch ohne laufenden Server. Über HTTP
führt die Seite direkt zum selben 3D-Viewer weiter. index.html benötigt HTTP;
ein direktes file://-Öffnen kann die Szenendaten nicht laden.
Ist Port 8766 belegt, wählt der Server den nächsten freien Port. Einen eigenen
Port ohne automatischen Browserstart wählen: python3 serve-local.py --no-open --port 8770

Bedienung: Im Hilfemenü stehen die aktuellen Maus-, Tastatur- und Touch-Gesten.
„Zu Fuß“ erlaubt Gehen und Springen; „Freikommen“ hilft an engen Stellen.
Der deutsche/englische Sprachschalter und die fünf Darstellungen bleiben im Viewer.
Bei Ladeproblemen zuerst die gesamte ZIP neu entpacken, den lokalen Server
neu starten und die angezeigte HTTP-Adresse öffnen. Der Browser benötigt WebGL.
„Neu laden“ erlaubt bei einem Fehler einen sauberen Neustart der 3D-Szene.

ENGLISH

This package contains the complete isometric 3D city in Day, Night, Snowstorm,
Minecraft and Schwellenraum. Visual changes preserve location, view and walking
or flight state. Every required asset is included locally. No AI model, Google
key or paid service is required.

Extract the whole archive. On Windows run OPEN-3D-WINDOWS.bat or start-windows.bat.
On macOS run OPEN-3D-MAC.command; if needed, right-click > Open. On Linux run
sh start-linux.sh. Alternatively run python3 serve-local.py in the extracted
folder. Python 3 is required. The browser opens automatically; keep the terminal
open while viewing. An occupied port automatically advances to the next free port.
Use python3 serve-local.py --no-open --port 8770 to select a port manually.

START-HERE.html is a file-safe launch guide. Over HTTP it redirects to the same
3D viewer, preserving URL settings. Opening index.html as a file cannot load the
scene. Use the local HTTP address printed by the server. The Help menu describes
current mouse, keyboard and Touchscreen gestures. Walk and Get unstuck remain
available. The interface supports German/English. For loading problems, extract
a fresh complete ZIP, restart the local server and reopen its HTTP address.
The browser requires WebGL; Reload starts a clean 3D scene after an error.

DATA / DATEN

The source inventory contains {counts["source_buildings"]:,} buildings. Exact
near-field budgets are {counts["desktop_exact"]:,} on desktop and
{counts["mobile_exact"]:,} on mobile, with complete instanced background coverage.
Procedural LoD2/OSM geometry, source-derived JSON, the walking minimap, startup
backdrop and all credits are retained. Retired flat-map tiles are not bundled.
The original data/generation pipeline remains available in the repository.

© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)
Visual references: Wikimedia Commons/Wikipedia
Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)
Per-file credits: dzi/regierungsviertel/wikimedia_attribution.json and
  dzi/regierungsviertel/visual_reference_attribution.json
Package hashes: package-manifest.json
Repository: https://github.com/Klotzkette/isometric-berlin
Viewer: https://klotzkette.github.io/isometric-berlin/
""",
    encoding="utf-8",
  )


def write_package_manifest(package_dir: Path) -> None:
  """Write machine-readable release metadata for local package QA."""
  dzi_root = package_dir / "dzi" / "regierungsviertel"
  mesh_root = package_dir / "mesh" / "regierungsviertel"
  asset_paths = {
    "pedestrian_map": dzi_root / "pedestrian_map.png",
    "startup_backdrop": dzi_root / "startup-map.jpg",
    "landmarks": dzi_root / "landmarks.json",
    "tiergartentunnel_overlay": dzi_root / "tiergartentunnel.json",
    "visual_reference_attribution": (dzi_root / "visual_reference_attribution.json"),
    "wikimedia_attribution": dzi_root / "wikimedia_attribution.json",
    "webgl_scene": mesh_root / "scene.json",
    "ground_context": mesh_root / "ground-context.json",
    "lod2_prisms": mesh_root / "lod2-prisms.json",
    "minecraft_voxels": mesh_root / "minecraft-voxels.json",
    "park_details": mesh_root / "park-details.json",
    "rail_lines": mesh_root / "rail-lines.json",
    "street_details": mesh_root / "street-details.json",
    "surface_source": mesh_root / "surface-polygons.json",
    "start_page": package_dir / "START-HERE.html",
  }
  missing = [label for label, path in asset_paths.items() if not path.exists()]
  if missing:
    raise SystemExit(f"Cannot write package manifest; missing: {', '.join(missing)}")

  manifest = {
    "schema_version": 1,
    "package_name": PACKAGE_NAME,
    "package_version": PACKAGE_VERSION,
    "start_page": "START-HERE.html",
    "start_page_mode": "3d-launch-guide",
    "full_3d_start_page": "index.html",
    "uses_google_content": False,
    "scope": "Berlin Regierungsviertel bounds only",
    "render_mode": "procedural LoD2/OpenStreetMap isometric city",
    "controls": [
      "mouse-pan",
      "mouse-rotate-swivel",
      "touch-pinch-pan-rotate",
      "touch-three-finger-underside-orbit",
      "touch-two-finger-direct-pan-midpoint-pinch-zoom",
      "true-threejs-3d-orbit",
      "exact-current-view-pedestrian-spawn",
      "cancelable-progressive-model-loading",
      "photogrammetry-assets-removed",
      "procedural-recovery-to-clean-remount",
      "desktop-and-mobile-exact-building-budgets",
      "instanced-complete-building-coverage",
      "raster-road-and-authored-path-memory-profile",
      "touch-capability-mobile-profile",
      "mobile-complete-building-progressive-worker",
      "desktop-worker-url-payloads-spatial-batches",
      "hidden-tab-progressive-pause-and-restart",
      "sequential-mobile-progressive-and-park-build",
      "mobile-family-keyed-single-world-residency",
      "single-clean-webgl-runtime-recovery",
      "explicit-recovery-after-repeat-failure",
      "minecraft-defers-surface-polygons-until-drawn-or-pedestrian",
      "economic-ministry-canal-invalidenhaus-details",
      "timeout-and-retry-json-loading",
      "http11-immutable-heavy-asset-cache",
      "keyboard-arrow-screen-plane-pan",
      "keyboard-wasd-heading-flight",
      "keyboard-space-rise-shift-descend",
      "pedestrian-space-jump-double-space-high-jump",
      "alt-arrow-orbit-tilt",
      "top-north-east-south-west-presets",
      "bilingual-de-en-ui",
      "direct-day-night-minecraft-snowstorm-modes",
      "contextual-rain-or-snowfall-toggle-in-all-surface-modes",
      "native-and-ios-safe-pseudo-fullscreen",
      "manual-tiergartentunnel-entry-both-directions",
      "minecraft-roaming-creepers-zombies-and-skeletons",
      "opt-in-seven-variant-procedural-audio",
      "selected-landmark-only-marker",
      "night-building-window-lights",
      "night-street-lamps",
      "night-monument-accents",
      "visible-tiergartentunnel-overlay",
      "visible-tiergartentunnel-volume",
      "visible-tiergartentunnel-center-wall",
      "visible-tiergartentunnel-underside-view",
      "visible-tiergartentunnel-ceiling-ribs",
      "visible-tiergartentunnel-service-bays",
      "visible-tiergartentunnel-osm-way-evidence",
      "visible-tiergartentunnel-lighting",
      "night-tiergartentunnel-lighting",
      "visible-tiergartentunnel-ventilation",
    ],
    "required_attribution": (
      "© OpenStreetMap contributors · 3D building models: Geoportal Berlin "
      "(dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · "
      "Kindertransport visual references: © Pauline Ahrens, 2021 / "
      "Bildhauerei in Berlin (CC BY 4.0)"
    ),
    "assets": {
      label: {
        "path": path.relative_to(package_dir).as_posix(),
        **file_digest(path),
      }
      for label, path in asset_paths.items()
    },
  }
  (package_dir / "package-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
  )


def zip_info_for(path: Path, arcname: Path) -> zipfile.ZipInfo:
  info = zipfile.ZipInfo(str(arcname), ZIP_TIMESTAMP)
  info.compress_type = zipfile.ZIP_DEFLATED
  info.create_system = 3
  # Windows cannot retain Unix execute bits on the staging filesystem. Encode
  # canonical portable modes explicitly so Linux launchers work after unzip.
  mode = 0o755 if arcname.name in EXECUTABLE_PACKAGE_FILES else 0o644
  info.external_attr = mode << 16
  return info


def zip_package(package_dir: Path, zip_path: Path) -> None:
  if zip_path.exists():
    zip_path.unlink()
  with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(package_dir.rglob("*")):
      if path.is_file() and should_package_file(path, package_dir):
        archive.writestr(
          zip_info_for(path, path.relative_to(package_dir.parent)),
          path.read_bytes(),
        )


def tar_static_site(source: Path, tar_path: Path) -> None:
  """Write a deterministic, link-free archive of the complete static viewer."""
  if tar_path.exists():
    tar_path.unlink()
  with tar_path.open("wb") as raw_output:
    with gzip.GzipFile(
      filename="", mode="wb", fileobj=raw_output, mtime=0
    ) as compressed:
      with tarfile.open(
        fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT
      ) as archive:
        for path in sorted(source.rglob("*")):
          if not path.is_file() or not should_package_file(path, source):
            continue
          if path.suffix == ".map":
            continue
          relative = path.relative_to(source).as_posix()
          info = archive.gettarinfo(str(path), arcname=relative)
          info.uid = 0
          info.gid = 0
          info.uname = ""
          info.gname = ""
          info.mtime = ARCHIVE_MTIME
          with path.open("rb") as handle:
            archive.addfile(info, handle)


def package_static_site(root: Path, out_dir: Path) -> tuple[Path, Path, Path]:
  source = root / "src" / "app" / "dist"
  public_source = root / "src" / "app" / "public"
  required_build_files = ("index.html", "favicon.svg")
  missing_build_files = [
    filename for filename in required_build_files if not (source / filename).exists()
  ]
  if missing_build_files:
    raise SystemExit(
      "Missing built viewer files: "
      f"{', '.join(missing_build_files)}. Run `cd src/app && bun run build`."
    )
  package_dir = out_dir / PACKAGE_NAME
  copy_static_site(source, package_dir)
  ensure_public_viewer_support_copied(public_source, package_dir)
  write_start_here(package_dir)
  write_launchers(package_dir)
  write_readme(package_dir)
  write_package_manifest(package_dir)
  remove_unwanted_package_paths(package_dir)
  zip_path = out_dir / f"{PACKAGE_NAME}.zip"
  zip_package(package_dir, zip_path)
  static_archive = out_dir / STATIC_ARCHIVE_NAME
  tar_static_site(package_dir, static_archive)
  return package_dir, zip_path, static_archive


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out-dir", type=Path, default=Path("releases"))
  args = parser.parse_args()

  package_dir, zip_path, static_archive = package_static_site(repo_root(), args.out_dir)
  print(f"Wrote local website folder: {package_dir}")
  print(f"Wrote downloadable ZIP: {zip_path}")
  print(f"Wrote static viewer archive: {static_archive}")


if __name__ == "__main__":
  main()
