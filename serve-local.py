#!/usr/bin/env python3
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
  "dzi/regierungsviertel/overview_source.png",
  "dzi/regierungsviertel/regierungsviertel.dzi",
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
      print("\nStopped local viewer.", flush=True)


if __name__ == "__main__":
  main()
