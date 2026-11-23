#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import re
import socket
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766
START_PAGE = "index.html"
ROAD_BINARY = re.compile(r"/assets/restoredRoadSurfaces-v376-[A-Za-z0-9_-]+[.]bin")
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
  "mesh/surrounding-berlin-v159/manifest.json",
)
CACHEABLE_SUFFIXES = {
  ".bin",
  ".css",
  ".gz",
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


def single_byte_range(header: str, size: int):
  match = re.fullmatch(r"bytes=([0-9]*)-([0-9]*)", header.strip(), re.IGNORECASE | re.ASCII)
  if not match or not size:
    return None
  first, last = match.groups()
  if not first and not last:
    return None

  def offset(digits: str) -> int:
    # Very large decimal positions can be clamped without constructing a huge integer.
    digits = digits.lstrip("0")
    return size if len(digits) > len(str(size)) else min(size, int(digits or "0"))

  if first:
    start = offset(first)
    end = min(size - 1, offset(last)) if last else size - 1
  else:
    start, end = size - offset(last), size - 1
  return (start, end) if start <= end else None


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

  def do_GET(self) -> None:
    ranges = self.headers.get_all("Range", [])
    if (not ranges or not ROAD_BINARY.fullmatch(urlsplit(self.path).path)
        or "If-Range" in self.headers or "If-Modified-Since" in self.headers
        or not ranges[0].lower().startswith("bytes=")):
      return super().do_GET()
    try:
      source = open(self.translate_path(self.path), "rb")
    except OSError:
      self.send_error(404, "File not found")
      return
    with source:
      info = os.fstat(source.fileno())
      bounds = single_byte_range(",".join(ranges), info.st_size)
      if bounds is None:
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{info.st_size}")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return
      start, end = bounds
      remaining = end - start + 1
      source.seek(start)
      self.send_response(206)
      self.send_header("Content-Type", "application/octet-stream")
      self.send_header("Content-Range", f"bytes {start}-{end}/{info.st_size}")
      self.send_header("Content-Length", str(remaining))
      self.send_header("Last-Modified", self.date_time_string(info.st_mtime))
      self.end_headers()
      while remaining:
        block = source.read(min(64 * 1024, remaining))
        if not block:
          self.close_connection = True
          return
        self.wfile.write(block)
        remaining -= len(block)

  def end_headers(self) -> None:
    if ROAD_BINARY.fullmatch(urlsplit(self.path).path):
      self.send_header("Accept-Ranges", "bytes")
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
