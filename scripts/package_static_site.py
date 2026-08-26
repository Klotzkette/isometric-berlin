"""Package the static Isometric Berlin viewer for local download/use.

The output is a folder and ZIP archive under ``releases/``. It contains
the built React/OpenSeadragon app, all DZI tiles, a double-clickable
HTML entry point, and optional local-server fallbacks.
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
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"
PACKAGE_VERSION = "0.72.28"
SERVE_SCRIPT_NAME = "serve-local.py"
STATIC_ARCHIVE_NAME = f"isometric-berlin-viewer-v{PACKAGE_VERSION}.tar.gz"
EXECUTABLE_PACKAGE_FILES = frozenset({SERVE_SCRIPT_NAME, "start-linux.sh"})
DUPLICATE_COPY_RE = re.compile(r"^.+ [2-9](?:\.[^.]+)?$")
ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)
ARCHIVE_MTIME = 1_767_225_600
MAX_PACKAGED_DZI_DIMENSION = 8192
SERVE_LOCAL_SCRIPT = """#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import hashlib
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
  "README.txt",
  "dzi/regierungsviertel/overview_source.png",
  "dzi/regierungsviertel/regierungsviertel.dzi",
  "dzi/regierungsviertel/visual_reference_attribution.json",
  "mesh/regierungsviertel/scene.json",
  "mesh/regierungsviertel/ground-context.json",
  "mesh/regierungsviertel/street-details.json",
  "mesh/regierungsviertel/surface-polygons.json",
  "mesh/regierungsviertel/surface-pretriangulation.json",
)
CACHEABLE_SUFFIXES = {
  ".css",
  ".glb",
  ".jpg",
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
    ".glb": "model/gltf-binary",
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


def file_sha256(path: Path) -> str:
  digest = hashlib.sha256()
  with path.open("rb") as handle:
    while chunk := handle.read(1024 * 1024):
      digest.update(chunk)
  return digest.hexdigest()


def verify_webgl_scene(root: Path) -> None:
  scene_path = root / "mesh/regierungsviertel/scene.json"
  try:
    scene = json.loads(scene_path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError) as exc:
    raise SystemExit(f"Invalid 3D scene manifest: {exc}") from exc
  if not isinstance(scene, dict):
    raise SystemExit("Invalid 3D scene manifest: root must be an object.")
  base_tiles = scene.get("base_tiles")
  surface_tiles = scene.get("surface_detail_tiles")
  hero_details = scene.get("hero_details")
  if (
    not isinstance(base_tiles, list)
    or not isinstance(surface_tiles, list)
    or not isinstance(hero_details, list)
  ):
    raise SystemExit("Invalid 3D scene manifest: model inventories are missing.")
  if not base_tiles or not surface_tiles:
    raise SystemExit("The local 3D scene lacks a required surface quality tier.")
  entries = [*base_tiles, *surface_tiles]
  entries.extend(
    entry
    for detail in hero_details
    if isinstance(detail, dict)
    for entry in detail.get("files", [])
  )
  verified: set[str] = set()
  mesh_root = scene_path.parent.resolve()
  for entry in entries:
    if not isinstance(entry, dict):
      raise SystemExit("Invalid 3D model entry in scene manifest.")
    relative = str(entry.get("file", ""))
    path = (mesh_root / relative).resolve()
    if not relative or path.parent != mesh_root or path.suffix.lower() != ".glb":
      raise SystemExit(f"Unsafe 3D model path in package: {relative!r}")
    if relative in verified:
      continue
    verified.add(relative)
    if not path.is_file():
      raise SystemExit(f"Missing 3D model file: {relative}")
    expected_size = entry.get("bytes")
    if type(expected_size) is not int or path.stat().st_size != expected_size:
      raise SystemExit(f"3D model size mismatch: {relative}")
    expected_hash = str(entry.get("sha256", ""))
    if len(expected_hash) != 64 or file_sha256(path) != expected_hash:
      raise SystemExit(f"3D model hash mismatch: {relative}")


def require_package_files(root: Path) -> None:
  missing = [relative for relative in REQUIRED_PACKAGE_FILES if not (root / relative).exists()]
  if missing:
    for relative in missing:
      print(f"Missing package file: {relative}", flush=True)
    raise SystemExit("This local viewer package is incomplete. Download the ZIP again.")
  verify_webgl_scene(root)


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
  <title>Isometric Berlin starten</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101616;
      color: #202725;
      --stage-bg: #101616;
      --panel-bg: #fbf5e7;
      --panel-ink: #1f2825;
      --gold: #f1c84b;
      --cyan: #1f8aa5;
      --red: #9f3434;
      --map-filter: contrast(1.08) saturate(1.16) brightness(1.04);
      --map-shadow: 0 34px 90px rgba(0, 0, 0, .34);
      --grid-opacity: .26;
      --night-light-opacity: 0;
      --surface-night-opacity: 1;
      --cloud-opacity: .72;
      --cloud-shadow-opacity: .22;
      --sunbeam-opacity: .18;
      --vehicle-light-opacity: .16;
      --detail-opacity: 1;
      --glint-opacity: .72;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
      background:
        radial-gradient(circle at 20% 10%, rgba(31, 138, 165, .2), transparent 28%),
        radial-gradient(circle at 78% 18%, rgba(241, 200, 75, .18), transparent 24%),
        linear-gradient(135deg, #0e1515, #1b2422 54%, #2d2a20);
    }
    body[data-profile="atlas"] {
      --map-filter: contrast(1.11) saturate(1.18) brightness(1.05);
      --grid-opacity: .24;
    }
    body[data-profile="cinematic"] {
      --map-filter: contrast(1.2) saturate(1.34) brightness(1.02);
      --stage-bg: #0d1115;
      --grid-opacity: .18;
    }
    body[data-profile="lab"] {
      --map-filter: contrast(1.18) saturate(.96) brightness(1.08);
      --stage-bg: #0b1719;
      --grid-opacity: .34;
    }
    body[data-under="true"] {
      --map-filter: contrast(.9) saturate(.72) brightness(.72);
      --stage-bg: #070b0c;
      --grid-opacity: .46;
    }
    body[data-theme="night"] {
      --stage-bg: #05080b;
      --panel-bg: #101715;
      --panel-ink: #f4ead0;
      --map-filter: brightness(.34) contrast(1.18) saturate(.62);
      --map-shadow: 0 34px 100px rgba(0, 0, 0, .72);
      --grid-opacity: .34;
      --night-light-opacity: 1;
      --surface-night-opacity: .92;
      --cloud-opacity: .34;
      --cloud-shadow-opacity: .08;
      --sunbeam-opacity: 0;
      --vehicle-light-opacity: 1;
      --detail-opacity: .95;
      --glint-opacity: .42;
      background:
        radial-gradient(circle at 12% 12%, rgba(247, 215, 122, .08), transparent 24%),
        radial-gradient(circle at 82% 18%, rgba(79, 150, 178, .12), transparent 22%),
        linear-gradient(135deg, #020405, #071115 56%, #14100a);
    }
    body[data-theme="night"][data-under="true"] {
      --map-filter: brightness(.28) contrast(1.1) saturate(.48);
      --night-light-opacity: 1;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 336px;
      height: 100vh;
      height: 100dvh;
    }
    .stage {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255, 252, 236, .09), transparent 22%),
        var(--stage-bg);
      cursor: grab;
      touch-action: none;
      border-right: 1px solid rgba(241, 200, 75, .28);
    }
    .stage::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      opacity: var(--grid-opacity);
      background-image:
        linear-gradient(rgba(241, 200, 75, .16) 1px, transparent 1px),
        linear-gradient(90deg, rgba(31, 138, 165, .18) 1px, transparent 1px),
        linear-gradient(135deg, transparent 47%, rgba(255, 255, 255, .05) 50%, transparent 53%);
      background-size: 64px 64px, 64px 64px, 220px 220px;
      mix-blend-mode: screen;
    }
    .stage::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 44%, transparent 0 52%, rgba(0, 0, 0, .28) 100%),
        linear-gradient(180deg, rgba(255, 255, 255, .1), transparent 18%, rgba(0, 0, 0, .16));
    }
    .stage:active { cursor: grabbing; }
    .stage.mode-rotate { cursor: ew-resize; }
    .stage.mode-rotate:active { cursor: grabbing; }
    .map-layer {
      position: absolute;
      left: 0;
      top: 0;
      width: 2157px;
      height: 1529px;
      transform-origin: 0 0;
      transform-style: preserve-3d;
      contain: layout paint style;
      will-change: transform;
      z-index: 0;
      filter: var(--map-shadow);
    }
    .map-image {
      display: block;
      width: 2157px;
      height: 1529px;
      user-select: none;
      -webkit-user-drag: none;
      filter: var(--map-filter);
      opacity: var(--surface-night-opacity);
      transition: filter .18s ease;
    }
    body[data-under="true"] .map-image {
      opacity: .38;
      filter: var(--map-filter);
    }
    .map-image.pixelated { image-rendering: pixelated; }
    .tunnel-overlay {
      position: absolute;
      left: 0;
      top: 0;
      width: 2157px;
      height: 1529px;
      pointer-events: none;
      overflow: visible;
      visibility: hidden;
      opacity: 0;
      transition: opacity .18s ease, filter .18s ease;
    }
    .night-light-overlay {
      position: absolute;
      left: 0;
      top: 0;
      width: 2157px;
      height: 1529px;
      pointer-events: none;
      overflow: visible;
      opacity: var(--night-light-opacity);
      mix-blend-mode: screen;
      transition: opacity .22s ease;
    }
    .night-glow {
      fill: rgba(247, 215, 122, .2);
      stroke: none;
      filter: blur(.2px) drop-shadow(0 0 20px rgba(247, 215, 122, .48));
    }
    .night-window {
      fill: #ffe7a4;
      stroke: rgba(82, 56, 12, .7);
      stroke-width: 1;
      filter: drop-shadow(0 0 5px rgba(255, 221, 132, .72));
    }
    .night-cone {
      fill: rgba(255, 218, 132, .22);
      stroke: rgba(255, 234, 170, .2);
      stroke-width: 1;
      filter: drop-shadow(0 0 12px rgba(255, 210, 102, .32));
    }
    .night-street-lamp {
      fill: #fff1b6;
      stroke: rgba(61, 46, 12, .75);
      stroke-width: 2;
      filter: drop-shadow(0 0 9px rgba(255, 226, 139, .78));
    }
    .night-monument-gold {
      fill: #f8d970;
      stroke: #fff0b2;
      stroke-width: 2;
      filter: drop-shadow(0 0 12px rgba(248, 217, 112, .82));
    }
    .night-bronze {
      fill: #5f8e7d;
      stroke: #c9f0d7;
      stroke-width: 1.5;
      filter: drop-shadow(0 0 10px rgba(123, 189, 161, .62));
    }
    .scene-detail-overlay {
      position: absolute;
      left: 0;
      top: 0;
      width: 2157px;
      height: 1529px;
      pointer-events: none;
      overflow: visible;
      opacity: var(--detail-opacity);
      contain: paint;
      transition: opacity .16s ease;
    }
    body[data-details="false"] .scene-detail-overlay {
      display: none;
    }
    body[data-clouds="false"] .detail-cloud {
      display: none;
    }
    body[data-dragging="true"] .scene-detail-overlay {
      opacity: .74;
    }
    body[data-dragging="true"] .cloud-puff,
    body[data-dragging="true"] .detail-vehicle,
    body[data-dragging="true"] .detail-train-ice,
    body[data-dragging="true"] .detail-train-sbahn,
    body[data-dragging="true"] .detail-boat {
      filter: none;
    }
    body[data-performance="true"] {
      --map-shadow: none;
      --grid-opacity: .13;
      --cloud-opacity: .44;
      --cloud-shadow-opacity: .05;
      --glint-opacity: .34;
    }
    body[data-performance="true"] .map-layer,
    body[data-performance="true"] .cloud-puff,
    body[data-performance="true"] .detail-vehicle,
    body[data-performance="true"] .detail-train-ice,
    body[data-performance="true"] .detail-train-sbahn,
    body[data-performance="true"] .detail-boat,
    body[data-performance="true"] .detail-tree-cluster,
    body[data-performance="true"] .detail-glint,
    body[data-performance="true"] .tunnel-overlay {
      filter: none;
    }
    body[data-performance="true"] .cloud-drift {
      animation: none;
    }
    .cloud-drift {
      transform-box: fill-box;
      transform-origin: center;
      animation: cloudDrift 36s ease-in-out infinite alternate;
    }
    .detail-cloud:nth-of-type(2) .cloud-drift {
      animation-duration: 44s;
    }
    .detail-cloud:nth-of-type(3) .cloud-drift {
      animation-duration: 31s;
    }
    @keyframes cloudDrift {
      from { transform: translate(-5px, 3px); }
      to { transform: translate(17px, -7px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cloud-drift,
      .focus-ring {
        animation: none;
      }
    }
    .sunbeam {
      fill: rgba(255, 210, 126, .46);
      opacity: var(--sunbeam-opacity);
      mix-blend-mode: screen;
    }
    .cloud-shadow {
      fill: rgba(27, 39, 37, .36);
      opacity: var(--cloud-shadow-opacity);
      filter: blur(.35px);
    }
    .cloud-base {
      fill: rgba(230, 242, 244, .45);
      stroke: rgba(156, 180, 185, .48);
      stroke-width: 1.2;
      opacity: var(--cloud-opacity);
    }
    .cloud-puff {
      fill: rgba(255, 255, 255, .86);
      stroke: rgba(166, 187, 192, .58);
      stroke-width: 1.2;
      opacity: var(--cloud-opacity);
      filter: drop-shadow(0 10px 13px rgba(55, 66, 66, .18));
    }
    .detail-water-depth {
      fill: none;
      stroke: rgba(35, 150, 184, .26);
      stroke-width: 46;
      stroke-linecap: round;
      stroke-linejoin: round;
      mix-blend-mode: multiply;
    }
    .detail-water-highlight {
      fill: none;
      stroke: rgba(211, 249, 255, .5);
      stroke-width: 7;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 34 26;
    }
    .detail-island {
      fill: #668849;
      stroke: #e0e8a8;
      stroke-width: 2;
      filter: drop-shadow(0 4px 5px rgba(29, 44, 28, .26));
    }
    .detail-tunnel-branch {
      fill: none;
      stroke: rgba(247, 215, 122, .72);
      stroke-width: 8;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 15 13;
      filter: drop-shadow(0 0 8px rgba(247, 215, 122, .38));
    }
    .detail-portal {
      fill: rgba(8, 13, 14, .82);
      stroke: #f7d77a;
      stroke-width: 3;
      filter: drop-shadow(0 5px 10px rgba(0, 0, 0, .38));
    }
    .detail-vehicle,
    .detail-train-ice,
    .detail-train-sbahn,
    .detail-boat,
    .detail-pedicab {
      stroke: #273432;
      stroke-width: 1.2;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .24));
    }
    .detail-vehicle { fill: #f4efe1; }
    .detail-vehicle.dark { fill: #263238; }
    .vehicle-window,
    .detail-train-window {
      fill: #78adc1;
      stroke: rgba(255, 255, 255, .45);
      stroke-width: .8;
    }
    .vehicle-headlight,
    .vehicle-taillight,
    .vehicle-light-cone {
      opacity: var(--vehicle-light-opacity);
    }
    .vehicle-headlight {
      fill: #fff3ad;
      filter: drop-shadow(0 0 8px rgba(255, 226, 138, .9));
    }
    .vehicle-taillight {
      fill: #e33b30;
      filter: drop-shadow(0 0 7px rgba(240, 54, 43, .78));
    }
    .vehicle-light-cone {
      fill: rgba(255, 229, 135, .27);
      stroke: rgba(255, 240, 184, .18);
      stroke-width: 1;
      filter: drop-shadow(0 0 10px rgba(255, 221, 120, .38));
    }
    .detail-train-ice {
      fill: #f4f6f2;
    }
    .detail-train-sbahn {
      fill: #d63a31;
    }
    .detail-train-yellow {
      fill: #f1c84b;
      stroke: none;
    }
    .detail-ice-stripe {
      fill: #c73a32;
    }
    .detail-flag-pole {
      stroke: #39423e;
      stroke-width: 2.6;
      stroke-linecap: round;
    }
    .flag-black { fill: #151515; }
    .flag-red { fill: #d72b32; }
    .flag-gold { fill: #f3c542; }
    .flag-eu { fill: #2454a6; }
    .flag-star { fill: #f7d85a; stroke: none; }
    .flag-us-red { fill: #bf2d35; }
    .flag-us-white { fill: #fffaf0; }
    .flag-us-blue { fill: #24476f; }
    .flag-fr-blue { fill: #244d91; }
    .flag-fr-white { fill: #fffaf0; }
    .flag-fr-red { fill: #d33a38; }
    .detail-boat {
      fill: #f7f0d6;
    }
    .detail-chair {
      fill: #f1c84b;
      stroke: #77612d;
      stroke-width: 1;
    }
    .detail-person {
      fill: #26312f;
      stroke: #fff2cf;
      stroke-width: .9;
    }
    .detail-sign {
      fill: #0f6b4a;
      stroke: #edf8ef;
      stroke-width: 1.2;
    }
    .detail-label {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 800;
      fill: #fffaf0;
      stroke: #153429;
      stroke-width: 2;
      paint-order: stroke;
    }
    .detail-glint {
      fill: rgba(255, 255, 255, .8);
      stroke: rgba(247, 215, 122, .88);
      stroke-width: 1.2;
      opacity: var(--glint-opacity);
      filter: drop-shadow(0 0 8px rgba(255, 244, 191, .66));
    }
    .detail-ripple {
      fill: none;
      stroke: rgba(226, 251, 255, .56);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 20 18;
      opacity: .74;
    }
    .detail-tree-cluster {
      fill: #2f6e39;
      stroke: #d7e6b0;
      stroke-width: 1;
      filter: drop-shadow(0 2px 3px rgba(27, 48, 28, .24));
    }
    .detail-path-spark {
      fill: rgba(255, 245, 204, .72);
      stroke: rgba(101, 83, 36, .28);
      stroke-width: .7;
    }
    body[data-under="true"] .tunnel-overlay {
      visibility: visible;
      opacity: 1;
      filter: drop-shadow(0 0 18px rgba(247, 215, 122, .42));
    }
    .tunnel-under-glow {
      fill: none;
      stroke: rgba(247, 215, 122, .15);
      stroke-width: 92;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tunnel-volume {
      fill: rgba(31, 34, 36, .43);
      stroke: rgba(247, 215, 122, .26);
      stroke-width: 2;
      filter: drop-shadow(0 12px 18px rgba(0, 0, 0, .34));
    }
    body[data-under="true"] .tunnel-volume {
      fill: rgba(17, 21, 22, .78);
      stroke: rgba(247, 215, 122, .56);
    }
    .tunnel-floor {
      fill: none;
      stroke: rgba(205, 218, 220, .32);
      stroke-width: 7;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 18 24;
    }
    .tunnel-lane {
      fill: none;
      stroke: rgba(242, 235, 201, .64);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 12 16;
    }
    .tunnel-ceiling-rib {
      stroke: rgba(223, 232, 229, .72);
      stroke-width: 3;
      stroke-linecap: round;
      filter: drop-shadow(0 0 5px rgba(247, 215, 122, .38));
    }
    .tunnel-service-bay {
      fill: rgba(55, 62, 63, .92);
      stroke: #f7d77a;
      stroke-width: 2;
      filter: drop-shadow(0 4px 9px rgba(0, 0, 0, .42));
    }
    .tunnel-service-link {
      stroke: rgba(247, 215, 122, .58);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 6 8;
    }
    .tunnel-portal-ring {
      fill: rgba(9, 12, 12, .82);
      stroke: #f7d77a;
      stroke-width: 4;
      filter: drop-shadow(0 5px 12px rgba(0, 0, 0, .45));
    }
    .tunnel-sidewall {
      fill: none;
      stroke: rgba(247, 215, 122, .52);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 18 12;
    }
    .tunnel-center-wall {
      fill: none;
      stroke: rgba(235, 229, 204, .78);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 10 10;
    }
    .tunnel-section {
      fill: rgba(22, 25, 26, .72);
      stroke: #f7d77a;
      stroke-width: 3;
      filter: drop-shadow(0 5px 9px rgba(0, 0, 0, .38));
    }
    .tunnel-casing {
      fill: none;
      stroke: rgba(20, 24, 25, .72);
      stroke-width: 22;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 36 14;
    }
    .tunnel-halo {
      fill: none;
      stroke: rgba(247, 215, 122, .24);
      stroke-width: 10;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 12 18;
    }
    .tunnel-core {
      fill: none;
      stroke: rgba(205, 218, 220, .94);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 18 16;
    }
    .tunnel-light {
      fill: #f7d77a;
      stroke: rgba(73, 54, 18, .7);
      stroke-width: 2;
      filter: drop-shadow(0 0 8px rgba(247, 215, 122, .76));
    }
    body[data-theme="night"] .tunnel-light {
      fill: #fff1b6;
      filter: drop-shadow(0 0 14px rgba(255, 231, 164, .92));
    }
    body[data-theme="night"] .tunnel-under-glow {
      stroke: rgba(247, 215, 122, .3);
    }
    body[data-theme="night"] .tunnel-core {
      stroke: rgba(255, 244, 204, .96);
    }
    .tunnel-vent {
      fill: #2b3033;
      stroke: #f7d77a;
      stroke-width: 3;
      filter: drop-shadow(0 5px 8px rgba(0, 0, 0, .38));
    }
    .tunnel-vent-blade {
      stroke: #d9e4e5;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .focus-ring {
      position: absolute;
      left: 0;
      top: 0;
      width: 38px;
      height: 38px;
      margin-left: -19px;
      margin-top: -19px;
      border: 2px solid var(--gold);
      border-radius: 50%;
      box-shadow:
        0 0 0 1px rgba(16, 22, 22, .55),
        0 0 0 7px rgba(241, 200, 75, .15),
        0 0 20px rgba(31, 138, 165, .42);
      pointer-events: none;
      opacity: .94;
      transform: scale(1);
      animation: focusPulse 1.9s ease-in-out infinite;
    }
    .focus-ring::before,
    .focus-ring::after {
      content: "";
      position: absolute;
      inset: 50%;
      width: 58px;
      height: 1px;
      margin-left: -29px;
      background: rgba(241, 200, 75, .74);
    }
    .focus-ring::after {
      width: 1px;
      height: 58px;
      margin-left: 0;
      margin-top: -29px;
    }
    @keyframes focusPulse {
      0%, 100% { transform: scale(.96); opacity: .82; }
      50% { transform: scale(1.06); opacity: 1; }
    }
    .compass {
      position: absolute;
      left: 14px;
      bottom: 14px;
      z-index: 4;
      padding: 8px 11px;
      border: 1px solid rgba(241, 200, 75, .45);
      border-radius: 7px;
      background: rgba(13, 20, 20, .78);
      color: #fff6dc;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      box-shadow: 0 4px 16px rgba(0, 0, 0, .14);
      backdrop-filter: blur(10px);
    }
    .hud {
      position: absolute;
      left: 14px;
      top: 14px;
      z-index: 4;
      min-width: min(420px, calc(100% - 28px));
      max-width: 520px;
      display: grid;
      gap: 7px;
      padding: 12px 14px;
      border: 1px solid rgba(241, 200, 75, .34);
      border-radius: 8px;
      background: rgba(12, 18, 18, .74);
      color: #fff7df;
      box-shadow: 0 18px 46px rgba(0, 0, 0, .32);
      backdrop-filter: blur(13px);
    }
    .hud strong {
      color: var(--gold);
      font-size: 12px;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    .hud-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .hud-meter {
      height: 5px;
      border-radius: 99px;
      background: rgba(255, 255, 255, .13);
      overflow: hidden;
    }
    .hud-meter span {
      display: block;
      height: 100%;
      width: 50%;
      background: linear-gradient(90deg, var(--cyan), var(--gold));
    }
    aside {
      display: grid;
      grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
      gap: 12px;
      padding: 16px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, .9), rgba(255, 250, 240, .96)),
        var(--panel-bg);
      min-height: 0;
      overflow: hidden;
      color: var(--panel-ink);
      box-shadow: -14px 0 44px rgba(0, 0, 0, .18);
    }
    body[data-theme="night"] aside {
      background:
        linear-gradient(180deg, rgba(22, 31, 29, .97), rgba(8, 14, 14, .98)),
        var(--panel-bg);
      color: var(--panel-ink);
      box-shadow: -14px 0 54px rgba(0, 0, 0, .52);
    }
    h1 { margin: 0; font-size: 19px; line-height: 1.1; letter-spacing: 0; }
    .sub { margin: 5px 0 0; font-size: 13px; color: #59615a; line-height: 1.35; }
    body[data-theme="night"] .sub { color: #c5d0c8; }
    .top-toggles {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      margin-top: 10px;
    }
    .top-toggles button {
      min-width: 0;
      min-height: 31px;
      padding-inline: 5px;
      font-size: 12px;
    }
    .controls {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    button, a.button {
      border: 1px solid rgba(29, 39, 35, .22);
      border-radius: 7px;
      background: #fff;
      color: #202725;
      font: inherit;
      font-size: 13px;
      min-height: 34px;
      padding: 7px 9px;
      text-decoration: none;
      cursor: pointer;
    }
    button:hover, a.button:hover { background: #f0eadc; }
    a.repository-button {
      display: grid;
      gap: 3px;
      align-content: center;
      overflow: hidden;
    }
    a.repository-button code {
      overflow: hidden;
      color: #6d493a;
      font-size: 9px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    body[data-theme="night"] button,
    body[data-theme="night"] a.button {
      background: #182321;
      color: #f6efd8;
      border-color: rgba(247, 215, 122, .3);
    }
    body[data-theme="night"] button:hover,
    body[data-theme="night"] a.button:hover {
      background: #25302c;
    }
    body[data-theme="night"] a.repository-button code { color: #f1c84b; }
    button.active {
      background: #1d4d5b;
      color: #fffaf0;
      border-color: #1d4d5b;
    }
    body[data-theme="night"] button.active {
      background: #f1c84b;
      color: #17201d;
      border-color: #f1c84b;
    }
    .wide { grid-column: span 4; }
    .half { grid-column: span 2; }
    .presets {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    .presets button {
      min-width: 0;
      padding-inline: 5px;
    }
    .profile-controls {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 8px;
      border: 1px solid rgba(29, 39, 35, .14);
      border-radius: 8px;
      background: rgba(255, 255, 255, .52);
    }
    .profile-controls button {
      min-width: 0;
      font-size: 12px;
      padding-inline: 6px;
    }
    .hint {
      margin: 0;
      padding: 9px 10px;
      border-radius: 7px;
      background: #eef3ec;
      color: #344039;
      font-size: 12px;
      line-height: 1.35;
    }
    body[data-theme="night"] .hint {
      background: #182420;
      color: #e8dfc5;
    }
    body[data-theme="night"] .hint strong { color: #f1c84b; }
    .hint strong {
      color: #1d4d5b;
    }
    .list {
      overflow: auto;
      display: grid;
      gap: 6px;
      align-content: start;
      padding-right: 2px;
    }
    .list button {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 8px;
      align-items: center;
      text-align: left;
      min-height: 32px;
      padding: 6px 8px;
    }
    .list button.active {
      border-color: rgba(241, 200, 75, .82);
      background: linear-gradient(90deg, rgba(241, 200, 75, .26), #fff);
      box-shadow: inset 3px 0 0 var(--gold);
    }
    .list button.priority {
      border-color: rgba(21, 93, 115, .34);
      background: linear-gradient(90deg, rgba(21, 93, 115, .18), #fff);
      font-weight: 700;
    }
    .list button.priority.active {
      background: linear-gradient(90deg, rgba(31, 138, 165, .24), rgba(241, 200, 75, .22), #fff);
    }
    body[data-theme="night"] .list button.active {
      background: linear-gradient(90deg, rgba(241, 200, 75, .3), rgba(23, 32, 29, .96));
    }
    body[data-theme="night"] .list button.priority {
      background: linear-gradient(90deg, rgba(31, 138, 165, .24), rgba(23, 32, 29, .96));
    }
    .index {
      color: #6c776e;
      font-variant-numeric: tabular-nums;
      font-size: 12px;
    }
    .notice {
      font-size: 12px;
      color: #5d665f;
      line-height: 1.35;
      border-top: 1px solid rgba(30, 40, 35, .14);
      padding-top: 10px;
    }
    .notice.is-warning {
      color: #6f2d23;
      border: 1px solid rgba(159, 52, 52, .35);
      background: rgba(255, 232, 205, .78);
      padding: 10px;
    }
    body[data-theme="night"] .notice {
      color: #c5d0c8;
      border-top-color: rgba(247, 215, 122, .22);
    }
    body[data-theme="night"] .notice.is-warning {
      color: #ffe0b0;
      background: rgba(101, 42, 32, .5);
    }
    .source-credit {
      margin: 0;
      color: #6f766f;
      font-size: 9px;
      line-height: 1.3;
    }
    body[data-theme="night"] .source-credit { color: #aebbb3; }
    .reference {
      position: fixed;
      inset: 18px;
      z-index: 20;
      display: none;
      grid-template-rows: auto minmax(0, 1fr);
      background: #fffaf0;
      border: 1px solid rgba(30, 40, 35, .2);
      box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
    }
    body[data-theme="night"] .reference {
      background: #101715;
      color: #f4ead0;
      border-color: rgba(247, 215, 122, .32);
    }
    .reference.open { display: grid; }
    .reference header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(30, 40, 35, .12);
    }
    .reference img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #f8f4e9;
    }
    @media (max-width: 850px) {
      body { overflow: auto; }
      .shell {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(58dvh, 1fr) minmax(0, 42dvh);
        min-height: 100dvh;
      }
      .stage {
        min-height: 58dvh;
        border-right: 0;
        border-bottom: 1px solid rgba(241, 200, 75, .28);
      }
      aside {
        min-height: 0;
        max-height: 42dvh;
        overflow: auto;
        overscroll-behavior: contain;
        padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      }
      .list { max-height: 280px; }
      .hud {
        max-width: calc(100% - 28px);
      }
    }
    @media (pointer: coarse) {
      button,
      a.button {
        min-height: 44px;
        padding: 9px 11px;
      }
      .top-toggles button {
        min-height: 42px;
      }
      .list button {
        min-height: 44px;
      }
      .controls,
      .presets,
      .profile-controls {
        gap: 9px;
      }
    }
    @media (max-width: 520px) {
      .controls {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .half,
      .wide {
        grid-column: span 2;
      }
      .presets {
        grid-template-columns: repeat(5, minmax(84px, 1fr));
        overflow-x: auto;
        padding-bottom: 2px;
      }
      .top-toggles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .hud {
        left: 10px;
        top: 10px;
        font-size: 12px;
      }
      .compass {
        right: 10px;
        bottom: 10px;
        max-width: calc(100% - 20px);
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="stage" id="stage" aria-label="Isometrische Karte">
      <div class="map-layer" id="layer">
        <img class="map-image" id="map-image" src="dzi/regierungsviertel/overview_source.png" alt="Isometric Berlin Regierungsviertel">
        <svg class="tunnel-overlay" id="tunnel-overlay" viewBox="0 0 2157 1529" aria-hidden="true"></svg>
        <svg class="night-light-overlay" id="night-light-overlay" viewBox="0 0 2157 1529" aria-hidden="true"></svg>
        <svg class="scene-detail-overlay" id="scene-detail-overlay" viewBox="0 0 2157 1529" aria-hidden="true"></svg>
        <div class="focus-ring" id="focus-ring" aria-hidden="true"></div>
      </div>
      <div class="hud" aria-live="polite">
        <strong id="hud-title">Regierungsviertel Live View</strong>
        <div class="hud-row"><span id="hud-target">Bundeskanzleramt</span><span id="hud-zoom">Zoom 1.00x</span></div>
        <div class="hud-meter"><span id="hud-meter"></span></div>
      </div>
      <div class="compass" id="compass" aria-live="polite">Top · 0° · Swivel 0°</div>
    </section>
    <aside>
      <header>
        <h1>Isometric Berlin</h1>
        <p class="sub" id="subtitle">Kompatible 2D-Notansicht ohne Terminal. Für echte 3D-Geometrie den lokalen Server starten.</p>
        <div class="top-toggles" aria-label="Sprache und Darstellung">
          <button type="button" id="lang-de" class="active">Deutsch</button>
          <button type="button" id="lang-en">English</button>
          <button type="button" id="theme-day" class="active">Tag</button>
          <button type="button" id="theme-night">Nacht</button>
        </div>
      </header>
      <div class="controls" aria-label="Ansicht">
        <button type="button" id="mode-pan" class="active half">Verschieben</button>
        <button type="button" id="mode-rotate" class="half">Drehen/Swivel</button>
        <button type="button" id="zoom-in">Zoom +</button>
        <button type="button" id="zoom-out">Zoom -</button>
        <button type="button" id="rotate-left">↶</button>
        <button type="button" id="rotate-right">↷</button>
        <button type="button" id="tilt-left">Swivel ◀</button>
        <button type="button" id="tilt-right">Swivel ▶</button>
        <button type="button" id="under-view" class="half">Unterseite</button>
        <button type="button" id="tunnel-focus" class="half">Tunnel-Fokus</button>
        <button type="button" id="details-toggle" class="half active">Details</button>
        <button type="button" id="clouds-toggle" class="half active">Wolken</button>
        <button type="button" id="performance-toggle" class="half">Leicht</button>
        <button type="button" id="quality" class="half">Pixel-Art</button>
        <button type="button" id="reset" class="half">Reset</button>
        <div class="profile-controls wide" aria-label="Grafikprofil">
          <button type="button" id="profile-atlas" class="active">Atlas</button>
          <button type="button" id="profile-cinematic">Cinematic</button>
          <button type="button" id="profile-lab">Lab</button>
        </div>
        <div class="presets wide" aria-label="Blickrichtung">
          <button type="button" id="view-top" class="active">Top</button>
          <button type="button" id="view-north">Nord</button>
          <button type="button" id="view-east">Ost</button>
          <button type="button" id="view-south">Süd</button>
          <button type="button" id="view-west">West</button>
        </div>
        <button type="button" id="reference" class="wide">Top-down-Referenzkarte</button>
        <a class="button wide" id="advanced-link" href="index.html">Echtes 3D öffnen (lokaler Server)</a>
        <a class="button wide repository-button" id="repository-link" href="https://github.com/Klotzkette/isometric-berlin" target="_blank" rel="noreferrer">
          <span id="repository-label">Öffentliches Repository öffnen</span>
          <code>https://github.com/Klotzkette/isometric-berlin</code>
        </a>
        <a class="button wide" id="download-link" href="https://github.com/Klotzkette/isometric-berlin/releases/latest/download/isometric-berlin-regierungsviertel-local.zip">
          <span id="download-label">Aktuellen Viewer herunterladen</span>
        </a>
      </div>
      <p class="hint" id="hint"><strong>Direktsteuerung:</strong> Maus ziehen verschiebt. Shift+ziehen oder Modus „Drehen/Swivel“ dreht und kippt. Atlas/Cinematic/Lab ändern Kontrast, Bühne und Lesbarkeit.</p>
      <div class="list" id="landmarks" aria-label="Sehenswürdigkeiten"></div>
      <p class="notice" id="notice" role="status" aria-live="polite">
        Dies ist nur die 2D-Kompatibilitätsansicht. Für das maßstäbliche 3D-Modell
        unter Windows start-windows.bat öffnen, unter macOS/Linux python3 serve-local.py.
      </p>
      <p class="source-credit">
        © OpenStreetMap contributors · 3D building models: Geoportal Berlin
        (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia ·
        Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0) · 3D mesh: Berlin Partner für Wirtschaft und
        Technologie GmbH
      </p>
    </aside>
  </main>
  <section class="reference" id="reference-panel" aria-label="Top-down-Referenzkarte">
    <header>
      <strong id="reference-title">Top-down-Referenzkarte</strong>
      <button type="button" id="reference-close">Schließen</button>
    </header>
    <img src="dzi/regierungsviertel/reference_map.png" alt="Top-down reference map">
  </section>
  <script>
    const payload = __LANDMARK_PAYLOAD__;
    const tunnelPayload = __TUNNEL_PAYLOAD__;
    const image = Object.freeze({ width: 2157, height: 1529 });
    const sourceImage = payload.image || image;
    const landmarkScaleX = image.width / Math.max(1, Number(sourceImage.width) || image.width);
    const landmarkScaleY = image.height / Math.max(1, Number(sourceImage.height) || image.height);
    const landmarks = [...(payload.landmarks || [])].map((landmark) => ({
      ...landmark,
      x: Number.isFinite(landmark.nx) ? landmark.nx * image.width : landmark.x * landmarkScaleX,
      y: Number.isFinite(landmark.ny) ? landmark.ny * image.height : landmark.y * landmarkScaleY,
    })).sort((a, b) => {
      const left = Number.isFinite(a.tourOrder) ? a.tourOrder : 1000;
      const right = Number.isFinite(b.tourOrder) ? b.tourOrder : 1000;
      return left - right || String(a.name).localeCompare(String(b.name), "de");
    });
    const stage = document.getElementById("stage");
    const layer = document.getElementById("layer");
    const mapImage = document.getElementById("map-image");
    const tunnelOverlay = document.getElementById("tunnel-overlay");
    const nightOverlay = document.getElementById("night-light-overlay");
    const sceneOverlay = document.getElementById("scene-detail-overlay");
    const list = document.getElementById("landmarks");
    const referencePanel = document.getElementById("reference-panel");
    const underButton = document.getElementById("under-view");
    const compass = document.getElementById("compass");
    const focusRing = document.getElementById("focus-ring");
    const hudTarget = document.getElementById("hud-target");
    const hudZoom = document.getElementById("hud-zoom");
    const hudMeter = document.getElementById("hud-meter");
    const profileButtons = {
      atlas: document.getElementById("profile-atlas"),
      cinematic: document.getElementById("profile-cinematic"),
      lab: document.getElementById("profile-lab"),
    };
    const langButtons = {
      de: document.getElementById("lang-de"),
      en: document.getElementById("lang-en"),
    };
    const themeButtons = {
      day: document.getElementById("theme-day"),
      night: document.getElementById("theme-night"),
    };
    const ui = {
      subtitle: document.getElementById("subtitle"),
      modePan: document.getElementById("mode-pan"),
      modeRotate: document.getElementById("mode-rotate"),
      zoomIn: document.getElementById("zoom-in"),
      zoomOut: document.getElementById("zoom-out"),
      tiltLeft: document.getElementById("tilt-left"),
      tiltRight: document.getElementById("tilt-right"),
      tunnelFocus: document.getElementById("tunnel-focus"),
      detailsToggle: document.getElementById("details-toggle"),
      cloudsToggle: document.getElementById("clouds-toggle"),
      performanceToggle: document.getElementById("performance-toggle"),
      quality: document.getElementById("quality"),
      reset: document.getElementById("reset"),
      reference: document.getElementById("reference"),
      advancedLink: document.getElementById("advanced-link"),
      repositoryLabel: document.getElementById("repository-label"),
      downloadLabel: document.getElementById("download-label"),
      hint: document.getElementById("hint"),
      notice: document.getElementById("notice"),
      referenceTitle: document.getElementById("reference-title"),
      referenceClose: document.getElementById("reference-close"),
      hudTitle: document.getElementById("hud-title"),
    };
    const VIEW_PRESETS = {
      top: { labelKey: "viewTop", rotation: 0, tilt: 0 },
      north: { labelKey: "viewNorth", rotation: 0, tilt: -10 },
      east: { labelKey: "viewEast", rotation: 90, tilt: -10 },
      south: { labelKey: "viewSouth", rotation: 180, tilt: -10 },
      west: { labelKey: "viewWest", rotation: 270, tilt: -10 },
    };
    const TEXT = {
      de: {
        documentTitle: "Isometric Berlin starten",
        stageLabel: "Isometrische Karte",
        subtitle: "Kompatible 2D-Notansicht ohne Terminal. Für echte 3D-Geometrie den lokalen Server starten.",
        modePan: "Verschieben",
        modeRotate: "Drehen/Swivel",
        zoomIn: "Zoom +",
        zoomOut: "Zoom -",
        tiltLeft: "Swivel ◀",
        tiltRight: "Swivel ▶",
        underside: "Unterseite",
        tunnelFocus: "Tunnel-Fokus",
        detailsOn: "Details",
        detailsOff: "Details aus",
        cloudsOn: "Wolken",
        cloudsOff: "Wolken aus",
        performanceOn: "Leicht an",
        performanceOff: "Leicht",
        pixelArt: "Pixel-Art",
        detailImage: "Detailbild",
        reset: "Reset",
        reference: "Top-down-Referenzkarte",
        advanced: "Echtes 3D öffnen (lokaler Server)",
        repository: "Öffentliches Repository öffnen",
        download: "Aktuellen Viewer herunterladen",
        serverRequired: "Echtes 3D kann nicht direkt über file:// geladen werden. Windows: start-windows.bat doppelklicken. macOS/Linux: Terminal in diesem Ordner öffnen und python3 serve-local.py ausführen. Der Server öffnet danach automatisch das vollständige 3D-Modell.",
        hintPan: "<strong>Direktsteuerung:</strong> Maus ziehen verschiebt. Shift+ziehen oder Modus „Drehen/Swivel“ dreht und kippt. G schaltet Details, C Wolken, P Leichtmodus. Tag/Nacht schaltet beleuchtete Fenster, Laternen, Denkmäler und Tunnellicht.",
        hintRotate: "<strong>Drehmodus:</strong> Maus gedrückt halten und bewegen. Links/rechts dreht, hoch/runter swivelt. Unterseite zeigt den Tiergartentunnel von unten. Beim Ziehen reduziert der Viewer teure Detailfilter.",
        notice: "Dies ist nur die 2D-Kompatibilitätsansicht. Für das maßstäbliche 3D-Modell unter Windows start-windows.bat öffnen, unter macOS/Linux python3 serve-local.py.",
        referenceTitle: "Top-down-Referenzkarte",
        referenceClose: "Schließen",
        hudTitle: "Regierungsviertel Live View",
        day: "Tag",
        night: "Nacht",
        langDe: "Deutsch",
        langEn: "English",
        viewTop: "Top",
        viewNorth: "Nord",
        viewEast: "Ost",
        viewSouth: "Süd",
        viewWest: "West",
        free: "Frei",
        underSuffix: " · Unterseite",
        landmarkFallback: "Sehenswürdigkeit",
        zoom: "Zoom",
        swivel: "Swivel",
      },
      en: {
        documentTitle: "Start Isometric Berlin",
        stageLabel: "Isometric map",
        subtitle: "Compatible zero-server 2D fallback. Start the local server for true 3D geometry.",
        modePan: "Pan",
        modeRotate: "Rotate/Swivel",
        zoomIn: "Zoom +",
        zoomOut: "Zoom -",
        tiltLeft: "Swivel ◀",
        tiltRight: "Swivel ▶",
        underside: "Underside",
        tunnelFocus: "Tunnel focus",
        detailsOn: "Details",
        detailsOff: "Hide details",
        cloudsOn: "Clouds",
        cloudsOff: "Hide clouds",
        performanceOn: "Lite on",
        performanceOff: "Lite",
        pixelArt: "Pixel art",
        detailImage: "Detail image",
        reset: "Reset",
        reference: "Top-down reference map",
        advanced: "Open true 3D (local server)",
        repository: "Open public repository",
        download: "Download the current viewer",
        serverRequired: "True 3D cannot load directly over file://. Windows: double-click start-windows.bat. macOS/Linux: open Terminal in this folder and run python3 serve-local.py. The server then opens the complete 3D model automatically.",
        hintPan: "<strong>Direct control:</strong> Drag to pan. Shift-drag or Rotate/Swivel mode rotates and tilts. G toggles details, C clouds, P lite mode. Day/Night toggles lit windows, street lamps, monuments and tunnel lighting.",
        hintRotate: "<strong>Rotate mode:</strong> Hold the mouse button and move. Left/right rotates, up/down swivels. Underside shows the Tiergarten tunnel from below. While dragging, the viewer reduces costly detail filters.",
        notice: "This is only the compatible 2D fallback. For the metric 3D model, open start-windows.bat on Windows or run python3 serve-local.py on macOS/Linux.",
        referenceTitle: "Top-down reference map",
        referenceClose: "Close",
        hudTitle: "Government Quarter Live View",
        day: "Day",
        night: "Night",
        langDe: "Deutsch",
        langEn: "English",
        viewTop: "Top",
        viewNorth: "North",
        viewEast: "East",
        viewSouth: "South",
        viewWest: "West",
        free: "Free",
        underSuffix: " · underside",
        landmarkFallback: "Landmark",
        zoom: "Zoom",
        swivel: "Swivel",
      },
    };
    const PREFERENCE_STORAGE_KEY = "isometric-berlin-start-here-preferences-v1";
    function readPreferences() {
      try {
        const raw = window.localStorage?.getItem(PREFERENCE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    function savedChoice(preferences, key, allowed, fallback) {
      const value = preferences[key];
      return allowed.includes(value) ? value : fallback;
    }
    function savedNumber(preferences, key, fallback, min, max) {
      const value = Number(preferences[key]);
      if (!Number.isFinite(value)) return fallback;
      return Math.max(min, Math.min(max, value));
    }
    function readStartParams() {
      try {
        return new URLSearchParams(window.location.search);
      } catch {
        return new URLSearchParams();
      }
    }
    function paramChoice(params, key, allowed, fallback) {
      const value = params.get(key);
      return allowed.includes(value) ? value : fallback;
    }
    function paramFlag(params, key, fallback) {
      const value = params.get(key);
      if (value === null) return fallback;
      const lowered = value.toLowerCase();
      if (["1", "true", "yes", "on"].includes(lowered)) return true;
      if (["0", "false", "no", "off"].includes(lowered)) return false;
      return fallback;
    }
    const savedPreferences = readPreferences();
    const startParams = readStartParams();
    const DEFAULT_FOCUS_LANDMARK = "Reichstagsgebäude";
    const PRIORITY_LANDMARKS = new Set([
      "Bundeskanzleramt",
      "Reichstagsgebäude",
      "Berlin Hauptbahnhof",
    ]);
    function savedLandmarkName(preferences) {
      const name = String(preferences.landmark || "");
      return landmarks.some((landmark) => landmark.name === name) ? name : DEFAULT_FOCUS_LANDMARK;
    }
    let selectedLandmarkName = savedLandmarkName(savedPreferences);
    const viewButtons = Object.fromEntries(
      Object.keys(VIEW_PRESETS).map((key) => [key, document.getElementById(`view-${key}`)])
    );
    const state = {
      mode: "pan",
      viewKey: paramChoice(
        startParams,
        "view",
        ["top", "north", "east", "south", "west", "free"],
        savedChoice(savedPreferences, "viewKey", ["top", "north", "east", "south", "west", "free"], "top")
      ),
      scale: 1,
      fitScale: 1,
      x: 0,
      y: 0,
      rotation: savedNumber(savedPreferences, "rotation", 0, 0, 360),
      tilt: savedNumber(savedPreferences, "tilt", 0, -28, 28),
      under: savedPreferences.under === true,
      dragging: false,
      rotateDrag: false,
      sx: 0,
      sy: 0,
      ox: 0,
      oy: 0,
      or: 0,
      ot: 0,
      pixel: paramFlag(startParams, "pixel", savedPreferences.pixel === true),
      profile: paramChoice(startParams, "profile", ["atlas", "cinematic", "lab"], savedChoice(savedPreferences, "profile", ["atlas", "cinematic", "lab"], "atlas")),
      lang: paramChoice(startParams, "lang", ["de", "en"], savedChoice(savedPreferences, "lang", ["de", "en"], "de")),
      theme: paramChoice(startParams, "theme", ["day", "night"], savedChoice(savedPreferences, "theme", ["day", "night"], "day")),
      details: paramFlag(startParams, "details", savedPreferences.details !== false),
      clouds: paramFlag(startParams, "clouds", savedPreferences.clouds !== false),
      performance: paramFlag(startParams, "lite", paramFlag(startParams, "performance", savedPreferences.performance === true)),
    };
    document.body.dataset.profile = state.profile;
    document.body.dataset.under = "false";
    document.body.dataset.theme = state.theme;
    document.body.dataset.details = state.details ? "true" : "false";
    document.body.dataset.clouds = state.clouds ? "true" : "false";
    document.body.dataset.performance = state.performance ? "true" : "false";

    let renderQueued = false;
    let resizeTimer = 0;
    let lastStageSize = { width: 0, height: 0 };
    let imageFallbackAttempted = false;
    const activePointers = new Map();
    let pinchGesture = null;
    function t(key) {
      return (TEXT[state.lang] && TEXT[state.lang][key]) || TEXT.de[key] || key;
    }
    function updateHint() {
      ui.hint.innerHTML = state.mode === "rotate" ? t("hintRotate") : t("hintPan");
    }
    function savePreferences() {
      try {
        window.localStorage?.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify({
          lang: state.lang,
          theme: state.theme,
          profile: state.profile,
          pixel: state.pixel,
          details: state.details,
          clouds: state.clouds,
          performance: state.performance,
          landmark: selectedLandmarkName,
          viewKey: state.viewKey,
          rotation: state.rotation,
          tilt: state.tilt,
          under: state.under,
        }));
      } catch {
        // Some locked-down file:// contexts disable localStorage; the viewer still works.
      }
    }
    function applyQualityImage() {
      imageFallbackAttempted = false;
      mapImage.src = state.pixel ? "dzi/regierungsviertel/overview.png" : "dzi/regierungsviertel/overview_source.png";
      mapImage.classList.toggle("pixelated", state.pixel);
      ui.quality.textContent = state.pixel ? t("detailImage") : t("pixelArt");
    }
    mapImage.addEventListener("error", () => {
      if (state.pixel || imageFallbackAttempted) return;
      imageFallbackAttempted = true;
      state.pixel = true;
      mapImage.classList.add("pixelated");
      mapImage.src = "dzi/regierungsviertel/overview.png";
      ui.quality.textContent = t("detailImage");
      savePreferences();
    });
    function applyLanguage() {
      document.documentElement.lang = state.lang;
      document.title = t("documentTitle");
      stage.setAttribute("aria-label", t("stageLabel"));
      referencePanel.setAttribute("aria-label", t("reference"));
      ui.subtitle.textContent = t("subtitle");
      ui.modePan.textContent = t("modePan");
      ui.modeRotate.textContent = t("modeRotate");
      ui.zoomIn.textContent = t("zoomIn");
      ui.zoomOut.textContent = t("zoomOut");
      ui.tiltLeft.textContent = t("tiltLeft");
      ui.tiltRight.textContent = t("tiltRight");
      underButton.textContent = t("underside");
      ui.tunnelFocus.textContent = t("tunnelFocus");
      ui.detailsToggle.textContent = state.details ? t("detailsOn") : t("detailsOff");
      ui.cloudsToggle.textContent = state.clouds ? t("cloudsOn") : t("cloudsOff");
      ui.performanceToggle.textContent = state.performance ? t("performanceOn") : t("performanceOff");
      ui.quality.textContent = state.pixel ? t("detailImage") : t("pixelArt");
      ui.reset.textContent = t("reset");
      ui.reference.textContent = t("reference");
      ui.advancedLink.textContent = t("advanced");
      ui.repositoryLabel.textContent = t("repository");
      ui.downloadLabel.textContent = t("download");
      ui.notice.textContent = t(
        ui.notice.classList.contains("is-warning") ? "serverRequired" : "notice"
      );
      ui.referenceTitle.textContent = t("referenceTitle");
      ui.referenceClose.textContent = t("referenceClose");
      ui.hudTitle.textContent = t("hudTitle");
      langButtons.de.textContent = t("langDe");
      langButtons.en.textContent = t("langEn");
      themeButtons.day.textContent = t("day");
      themeButtons.night.textContent = t("night");
      Object.entries(VIEW_PRESETS).forEach(([key, preset]) => {
        viewButtons[key].textContent = t(preset.labelKey);
      });
      updateHint();
      Object.entries(langButtons).forEach(([key, button]) => {
        button.classList.toggle("active", key === state.lang);
        button.setAttribute("aria-pressed", key === state.lang ? "true" : "false");
      });
      render();
    }
    function setLanguage(lang) {
      if (!TEXT[lang]) return;
      state.lang = lang;
      applyLanguage();
      savePreferences();
    }
    function setTheme(theme) {
      if (!themeButtons[theme]) return;
      state.theme = theme;
      document.body.dataset.theme = theme;
      Object.entries(themeButtons).forEach(([key, button]) => {
        button.classList.toggle("active", key === theme);
        button.setAttribute("aria-pressed", key === theme ? "true" : "false");
      });
      savePreferences();
      render();
    }
    function transformedImageVector(imageX, imageY) {
      const vertical = state.under ? -1 : 1;
      let x = imageX * state.scale;
      let y = imageY * state.scale * vertical;
      x += Math.tan((state.tilt * Math.PI) / 180) * y;
      const radians = (state.rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return {
        x: cos * x - sin * y,
        y: sin * x + cos * y,
      };
    }
    function imagePointToStage(imageX, imageY) {
      const vector = transformedImageVector(imageX, imageY);
      return { x: state.x + vector.x, y: state.y + vector.y };
    }
    function stagePointToImage(stageX, stageY) {
      const radians = (-state.rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const translatedX = stageX - state.x;
      const translatedY = stageY - state.y;
      let x = cos * translatedX - sin * translatedY;
      let y = sin * translatedX + cos * translatedY;
      x -= Math.tan((state.tilt * Math.PI) / 180) * y;
      x /= state.scale;
      y /= state.scale;
      if (state.under) y *= -1;
      return { x, y };
    }
    function placeImagePointAt(imageX, imageY, stageX, stageY) {
      const vector = transformedImageVector(imageX, imageY);
      state.x = stageX - vector.x;
      state.y = stageY - vector.y;
    }
    function preserveStageCenter(update) {
      const rect = stage.getBoundingClientRect();
      const stageX = rect.width / 2;
      const stageY = rect.height / 2;
      const imagePoint = stagePointToImage(stageX, stageY);
      update();
      placeImagePointAt(imagePoint.x, imagePoint.y, stageX, stageY);
    }
    function constrainView() {
      const rect = stage.getBoundingClientRect();
      const corners = [
        imagePointToStage(0, 0),
        imagePointToStage(image.width, 0),
        imagePointToStage(0, image.height),
        imagePointToStage(image.width, image.height),
      ];
      const minX = Math.min(...corners.map((point) => point.x));
      const maxX = Math.max(...corners.map((point) => point.x));
      const minY = Math.min(...corners.map((point) => point.y));
      const maxY = Math.max(...corners.map((point) => point.y));
      const visible = Math.min(72, rect.width * 0.2, rect.height * 0.2);
      if (maxX < visible) state.x += visible - maxX;
      if (minX > rect.width - visible) state.x += rect.width - visible - minX;
      if (maxY < visible) state.y += visible - maxY;
      if (minY > rect.height - visible) state.y += rect.height - visible - minY;
    }
    function applyRender() {
      constrainView();
      layer.style.width = `${image.width}px`;
      layer.style.height = `${image.height}px`;
      mapImage.style.width = `${image.width}px`;
      mapImage.style.height = `${image.height}px`;
      layer.style.transform = `translate(${state.x}px, ${state.y}px) rotate(${state.rotation}deg) skewX(${state.tilt}deg) scale(${state.scale}) scaleY(${state.under ? -1 : 1})`;
      const rotation = Math.round(((state.rotation % 360) + 360) % 360);
      const viewName = VIEW_PRESETS[state.viewKey] ? t(VIEW_PRESETS[state.viewKey].labelKey) : t("free");
      const selected = landmarks.find((landmark) => landmark.name === selectedLandmarkName) || landmarks[0];
      const underText = state.under ? t("underSuffix") : "";
      compass.textContent = `${viewName}${underText} · ${rotation}° · ${t("swivel")} ${Math.round(state.tilt)}° · ${selected?.name || t("landmarkFallback")}`;
      if (selected) {
        focusRing.style.left = `${selected.x}px`;
        focusRing.style.top = `${selected.y}px`;
        hudTarget.textContent = selected.name;
      }
      const zoomRatio = state.fitScale ? state.scale / state.fitScale : 1;
      hudZoom.textContent = `${t("zoom")} ${zoomRatio.toFixed(2)}x`;
      hudMeter.style.width = `${Math.max(6, Math.min(100, zoomRatio * 18))}%`;
      document.body.dataset.profile = state.profile;
      document.body.dataset.details = state.details ? "true" : "false";
      document.body.dataset.clouds = state.clouds ? "true" : "false";
      document.body.dataset.performance = state.performance ? "true" : "false";
      Object.entries(viewButtons).forEach(([key, button]) => {
        button.classList.toggle("active", key === state.viewKey);
      });
      Object.entries(profileButtons).forEach(([key, button]) => {
        button.classList.toggle("active", key === state.profile);
      });
      document.querySelectorAll("[data-landmark-index]").forEach((node) => {
        const index = Number(node.dataset.landmarkIndex);
        node.classList.toggle("active", landmarks[index]?.name === selectedLandmarkName);
      });
      underButton.classList.toggle("active", state.under);
      ui.detailsToggle.classList.toggle("active", state.details);
      ui.detailsToggle.setAttribute("aria-pressed", state.details ? "true" : "false");
      ui.detailsToggle.textContent = state.details ? t("detailsOn") : t("detailsOff");
      ui.cloudsToggle.classList.toggle("active", state.clouds);
      ui.cloudsToggle.setAttribute("aria-pressed", state.clouds ? "true" : "false");
      ui.cloudsToggle.textContent = state.clouds ? t("cloudsOn") : t("cloudsOff");
      ui.performanceToggle.classList.toggle("active", state.performance);
      ui.performanceToggle.setAttribute("aria-pressed", state.performance ? "true" : "false");
      ui.performanceToggle.textContent = state.performance ? t("performanceOn") : t("performanceOff");
      document.body.dataset.under = state.under ? "true" : "false";
    }
    function render() {
      if (renderQueued) return;
      renderQueued = true;
      window.requestAnimationFrame(() => {
        renderQueued = false;
        applyRender();
      });
    }
    function setMode(mode) {
      state.mode = mode;
      document.getElementById("mode-pan").classList.toggle("active", mode === "pan");
      document.getElementById("mode-rotate").classList.toggle("active", mode === "rotate");
      stage.classList.toggle("mode-rotate", mode === "rotate");
      updateHint();
    }
    function fit() {
      const rect = stage.getBoundingClientRect();
      state.fitScale = Math.min(rect.width / image.width, rect.height / image.height) * 0.96;
      state.scale = state.fitScale;
      state.rotation = 0;
      state.tilt = 0;
      state.under = false;
      state.viewKey = "top";
      placeImagePointAt(image.width / 2, image.height / 2, rect.width / 2, rect.height / 2);
      lastStageSize = { width: rect.width, height: rect.height };
      render();
    }
    function refitPreservingView() {
      const rect = stage.getBoundingClientRect();
      const oldWidth = lastStageSize.width || rect.width;
      const oldHeight = lastStageSize.height || rect.height;
      const centerImage = stagePointToImage(oldWidth / 2, oldHeight / 2);
      const zoomRatio = state.fitScale ? state.scale / state.fitScale : 1;
      state.fitScale = Math.min(rect.width / image.width, rect.height / image.height) * 0.96;
      state.scale = clampScale(state.fitScale * zoomRatio);
      placeImagePointAt(
        centerImage.x,
        centerImage.y,
        rect.width / 2,
        rect.height / 2,
      );
      lastStageSize = { width: rect.width, height: rect.height };
      render();
    }
    function resetView() {
      fit();
      const defaultLandmark = landmarks.find((landmark) => landmark.name === DEFAULT_FOCUS_LANDMARK) || landmarks[0];
      if (defaultLandmark) focusLandmark(defaultLandmark);
      setViewPreset("top");
      savePreferences();
    }
    function clampScale(value) {
      return Math.max(state.fitScale * 0.45, Math.min(value, state.fitScale * 6));
    }
    function zoomBy(factor) {
      const rect = stage.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const imagePoint = stagePointToImage(cx, cy);
      state.scale = clampScale(state.scale * factor);
      placeImagePointAt(imagePoint.x, imagePoint.y, cx, cy);
      render();
    }
    function focusLandmark(landmark) {
      const rect = stage.getBoundingClientRect();
      const zoomRatio = landmark.name === DEFAULT_FOCUS_LANDMARK ? 3.6 : 2.8;
      selectedLandmarkName = landmark.name;
      state.scale = clampScale(state.fitScale * zoomRatio);
      placeImagePointAt(landmark.x, landmark.y, rect.width / 2, rect.height / 2);
      savePreferences();
      render();
    }
    function tunnelRoutePoints() {
      return (tunnelPayload.routes || [])
        .flatMap((route) => route.points || [])
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    }
    function focusTunnelRoute() {
      const points = tunnelRoutePoints();
      if (points.length < 2) return;
      const rect = stage.getBoundingClientRect();
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const routeWidth = Math.max(1, maxX - minX);
      const routeHeight = Math.max(1, maxY - minY);
      state.scale = Math.max(
        state.fitScale * 1.45,
        Math.min(rect.width / (routeWidth * 1.35), rect.height / (routeHeight * 1.35), state.fitScale * 4.8)
      );
      placeImagePointAt(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        rect.width / 2,
        rect.height / 2,
      );
      selectedLandmarkName = "Kemperplatz / Tiergartentunnel";
      savePreferences();
      render();
    }
    function setUnderView(enabled) {
      if (enabled) {
        state.under = true;
        state.rotation = 180;
        state.tilt = 22;
        state.viewKey = "free";
        focusTunnelRoute();
        return;
      }
      preserveStageCenter(() => {
        state.under = false;
      });
      savePreferences();
      render();
    }
    function toggleUnderView() {
      setUnderView(!state.under);
    }
    function panBy(dx, dy) {
      state.x += dx;
      state.y += dy;
      state.viewKey = "free";
      render();
    }
    function rotateBy(delta) {
      preserveStageCenter(() => {
        state.rotation = ((state.rotation + delta) % 360 + 360) % 360;
      });
      state.viewKey = "free";
      savePreferences();
      render();
    }
    function tiltBy(delta) {
      preserveStageCenter(() => {
        state.tilt = Math.max(-28, Math.min(28, state.tilt + delta));
      });
      state.viewKey = "free";
      savePreferences();
      render();
    }
    function setViewPreset(key) {
      const preset = VIEW_PRESETS[key];
      if (!preset) return;
      preserveStageCenter(() => {
        state.rotation = preset.rotation;
        state.tilt = preset.tilt;
      });
      state.viewKey = key;
      savePreferences();
      render();
    }
    function setProfile(profile) {
      if (!profileButtons[profile]) return;
      state.profile = profile;
      savePreferences();
      render();
    }
    function toggleQuality() {
      state.pixel = !state.pixel;
      applyQualityImage();
      savePreferences();
    }
    function setDetails(enabled) {
      state.details = enabled;
      savePreferences();
      render();
    }
    function toggleDetails() {
      setDetails(!state.details);
    }
    function setClouds(enabled) {
      state.clouds = enabled;
      savePreferences();
      render();
    }
    function toggleClouds() {
      setClouds(!state.clouds);
    }
    function setPerformance(enabled) {
      state.performance = enabled;
      savePreferences();
      render();
    }
    function togglePerformance() {
      setPerformance(!state.performance);
    }
    function addLandmarkList() {
      list.innerHTML = "";
      landmarks.forEach((landmark, index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = PRIORITY_LANDMARKS.has(landmark.name) ? "priority" : "";
        row.dataset.landmarkIndex = String(index);
        row.innerHTML = `<span class="index">${String(index + 1).padStart(2, "0")}</span><span>${landmark.name}</span>`;
        row.addEventListener("click", () => focusLandmark(landmark));
        list.appendChild(row);
      });
    }
    function addTunnelRoutes() {
      tunnelOverlay.innerHTML = "";
      (tunnelPayload.routes || []).forEach((route) => {
        const routePoints = (route.points || [])
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        const points = routePoints
          .map((point) => `${point.x},${point.y}`)
          .join(" ");
        if (!points) return;
        addTunnelTube(routePoints, route.volume || {});
        ["tunnel-casing", "tunnel-halo", "tunnel-core"].forEach((className) => {
          const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
          polyline.setAttribute("class", className);
          polyline.setAttribute("points", points);
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = route.name || "Tiergartentunnel";
          polyline.appendChild(title);
          tunnelOverlay.appendChild(polyline);
        });
        addTunnelLights(routePoints, route.lighting || {});
        addTunnelVentilation(route.ventilation || []);
        addTunnelServiceBays(route.service_bays || [], route.volume || {});
        addTunnelPortals(route.portals || [], route.volume || {});
      });
    }
    function normalizedNormal(start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: -dy / length, y: dx / length };
    }
    function normalAt(points, index) {
      const normals = [];
      if (index > 0) normals.push(normalizedNormal(points[index - 1], points[index]));
      if (index < points.length - 1) normals.push(normalizedNormal(points[index], points[index + 1]));
      if (!normals.length) return { x: 0, y: 1 };
      const x = normals.reduce((sum, normal) => sum + normal.x, 0) / normals.length;
      const y = normals.reduce((sum, normal) => sum + normal.y, 0) / normals.length;
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    }
    function offsetPolyline(points, distance) {
      return points.map((point, index) => {
        const normal = normalAt(points, index);
        return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
      });
    }
    function svgPointList(points) {
      return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    }
    function addPolyline(className, points) {
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.setAttribute("class", className);
      polyline.setAttribute("points", svgPointList(points));
      tunnelOverlay.appendChild(polyline);
    }
    function totalLength(points) {
      return points.slice(1).reduce((length, point, index) => {
        return length + Math.hypot(point.x - points[index].x, point.y - points[index].y);
      }, 0);
    }
    function pointFrameAtDistance(points, targetDistance) {
      let covered = 0;
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segment = Math.hypot(dx, dy);
        if (!segment) continue;
        if (covered + segment >= targetDistance) {
          const amount = (targetDistance - covered) / segment;
          const normal = normalizedNormal(start, end);
          return {
            x: start.x + dx * amount,
            y: start.y + dy * amount,
            nx: normal.x,
            ny: normal.y,
            angle: Math.atan2(dy, dx) * 180 / Math.PI,
          };
        }
        covered += segment;
      }
      const last = points[points.length - 1];
      const before = points[points.length - 2] || last;
      const normal = normalizedNormal(before, last);
      return {
        x: last.x,
        y: last.y,
        nx: normal.x,
        ny: normal.y,
        angle: Math.atan2(last.y - before.y, last.x - before.x) * 180 / Math.PI,
      };
    }
    function tunnelHalfWidth(volume) {
      return Math.max(8, (Number(volume.width_px) || 30) * 0.35);
    }
    function addTunnelTube(points, volume) {
      if (points.length < 2) return;
      const halfWidth = tunnelHalfWidth(volume);
      const sideInset = Number(volume.sidewall_px) || 8;
      const centerWall = Math.max(2, Number(volume.center_wall_px) || 4);
      const left = offsetPolyline(points, halfWidth);
      const right = offsetPolyline(points, -halfWidth);
      const leftFloor = offsetPolyline(points, Math.max(halfWidth - sideInset, 2));
      const rightFloor = offsetPolyline(points, -Math.max(halfWidth - sideInset, 2));
      addPolyline("tunnel-under-glow", points);
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("class", "tunnel-volume");
      polygon.setAttribute("points", svgPointList([...left, ...right.slice().reverse()]));
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${volume.label || "Tiergartentunnel"} · ca. ${volume.total_width_m || 23.4} m breit · ${volume.depth_status || "schematische Tiefe"}`;
      polygon.appendChild(title);
      tunnelOverlay.appendChild(polygon);
      addPolyline("tunnel-sidewall", left);
      addPolyline("tunnel-sidewall", right);
      addPolyline("tunnel-floor", leftFloor);
      addPolyline("tunnel-floor", rightFloor);
      addPolyline("tunnel-center-wall", points);
      addPolyline("tunnel-lane", offsetPolyline(points, halfWidth * 0.36));
      addPolyline("tunnel-lane", offsetPolyline(points, -halfWidth * 0.36));
      addTunnelRibs(points, volume);
      points
        .filter((_, index) => index === 0 || index === points.length - 1 || index % 3 === 0)
        .forEach((point, index) => {
          const section = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          section.setAttribute("class", "tunnel-section");
          section.setAttribute("x", (point.x - halfWidth * 0.52).toFixed(1));
          section.setAttribute("y", (point.y - centerWall * 2.2).toFixed(1));
          section.setAttribute("width", (halfWidth * 1.04).toFixed(1));
          section.setAttribute("height", (centerWall * 4.4).toFixed(1));
          section.setAttribute("rx", "4");
          section.setAttribute("transform", `rotate(-18 ${point.x} ${point.y})`);
          const label = document.createElementNS("http://www.w3.org/2000/svg", "title");
          label.textContent = index === 0 ? "Tunnelportal / Querschnitt" : "Tunnelquerschnitt / Notausstieg";
          section.appendChild(label);
          tunnelOverlay.appendChild(section);
        });
    }
    function addTunnelRibs(points, volume) {
      const spacing = Number(volume.ceiling_rib_spacing_px) || 54;
      const halfWidth = tunnelHalfWidth(volume);
      const total = totalLength(points);
      for (let distance = spacing * 0.4; distance < total; distance += spacing) {
        const frame = pointFrameAtDistance(points, distance);
        const rib = document.createElementNS("http://www.w3.org/2000/svg", "line");
        rib.setAttribute("class", "tunnel-ceiling-rib");
        rib.setAttribute("x1", (frame.x - frame.nx * halfWidth * 0.92).toFixed(1));
        rib.setAttribute("y1", (frame.y - frame.ny * halfWidth * 0.92).toFixed(1));
        rib.setAttribute("x2", (frame.x + frame.nx * halfWidth * 0.92).toFixed(1));
        rib.setAttribute("y2", (frame.y + frame.ny * halfWidth * 0.92).toFixed(1));
        tunnelOverlay.appendChild(rib);
      }
    }
    function addTunnelServiceBays(bays, volume) {
      const halfWidth = tunnelHalfWidth(volume);
      bays
        .filter((bay) => Number.isFinite(bay.x) && Number.isFinite(bay.y))
        .forEach((bay) => {
          const side = bay.side === "east" ? 1 : -1;
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          const x = bay.x + side * halfWidth * 0.86;
          const y = bay.y - 4;
          group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(-18)`);
          const link = document.createElementNS("http://www.w3.org/2000/svg", "line");
          link.setAttribute("class", "tunnel-service-link");
          link.setAttribute("x1", String(-side * halfWidth * 0.55));
          link.setAttribute("y1", "0");
          link.setAttribute("x2", "0");
          link.setAttribute("y2", "0");
          group.appendChild(link);
          const bayBody = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          bayBody.setAttribute("class", "tunnel-service-bay");
          bayBody.setAttribute("x", "-12");
          bayBody.setAttribute("y", "-8");
          bayBody.setAttribute("width", "24");
          bayBody.setAttribute("height", "16");
          bayBody.setAttribute("rx", "4");
          group.appendChild(bayBody);
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = bay.label || "Tunnel-Servicebucht";
          group.appendChild(title);
          tunnelOverlay.appendChild(group);
        });
    }
    function addTunnelPortals(portals, volume) {
      const halfWidth = tunnelHalfWidth(volume);
      portals
        .filter((portal) => Number.isFinite(portal.x) && Number.isFinite(portal.y))
        .forEach((portal) => {
          const portalShape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          portalShape.setAttribute("class", "tunnel-portal-ring");
          portalShape.setAttribute("x", (portal.x - halfWidth * 0.72).toFixed(1));
          portalShape.setAttribute("y", (portal.y - 11).toFixed(1));
          portalShape.setAttribute("width", (halfWidth * 1.44).toFixed(1));
          portalShape.setAttribute("height", "22");
          portalShape.setAttribute("rx", "6");
          portalShape.setAttribute("transform", `rotate(-18 ${portal.x} ${portal.y})`);
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = portal.label || "Tunnelportal";
          portalShape.appendChild(title);
          tunnelOverlay.appendChild(portalShape);
        });
    }
    function pointAtDistance(points, targetDistance) {
      let covered = 0;
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segment = Math.hypot(dx, dy);
        if (!segment) continue;
        if (covered + segment >= targetDistance) {
          const amount = (targetDistance - covered) / segment;
          return { x: start.x + dx * amount, y: start.y + dy * amount };
        }
        covered += segment;
      }
      return points[points.length - 1];
    }
    function addTunnelLights(points, lighting) {
      if (points.length < 2) return;
      const spacing = Number(lighting.spacing_px) || 92;
      const total = points.slice(1).reduce((length, point, index) => {
        return length + Math.hypot(point.x - points[index].x, point.y - points[index].y);
      }, 0);
      for (let distance = spacing * 0.55; distance < total; distance += spacing) {
        const point = pointAtDistance(points, distance);
        const light = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        light.setAttribute("class", "tunnel-light");
        light.setAttribute("cx", point.x.toFixed(1));
        light.setAttribute("cy", point.y.toFixed(1));
        light.setAttribute("r", "7");
        tunnelOverlay.appendChild(light);
      }
    }
    function addTunnelVentilation(vents) {
      vents
        .filter((vent) => Number.isFinite(vent.x) && Number.isFinite(vent.y))
        .forEach((vent) => {
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          group.setAttribute("transform", `translate(${vent.x} ${vent.y})`);
          const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          body.setAttribute("class", "tunnel-vent");
          body.setAttribute("r", "14");
          group.appendChild(body);
          [[-9, 0, 9, 0], [0, -9, 0, 9], [-6, -6, 6, 6], [-6, 6, 6, -6]].forEach((blade) => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "tunnel-vent-blade");
            line.setAttribute("x1", blade[0]);
            line.setAttribute("y1", blade[1]);
            line.setAttribute("x2", blade[2]);
            line.setAttribute("y2", blade[3]);
            group.appendChild(line);
          });
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = vent.label || "Tunnelbelüftung";
          group.appendChild(title);
          tunnelOverlay.appendChild(group);
        });
    }
    function addSvgTitle(node, title) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "title");
      label.textContent = title;
      node.appendChild(label);
    }
    function findLandmark(...needles) {
      const lowered = needles.map((needle) => needle.toLowerCase());
      return landmarks.find((landmark) => {
        const name = String(landmark.name || "").toLowerCase();
        return lowered.some((needle) => name.includes(needle));
      });
    }
    function landmarkPoint(names, fallback) {
      const found = findLandmark(...names);
      return found || fallback;
    }
    function addNightEllipse(x, y, rx, ry, className, title, rotation = 0) {
      const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      ellipse.setAttribute("class", className);
      ellipse.setAttribute("cx", x.toFixed(1));
      ellipse.setAttribute("cy", y.toFixed(1));
      ellipse.setAttribute("rx", rx.toFixed(1));
      ellipse.setAttribute("ry", ry.toFixed(1));
      if (rotation) ellipse.setAttribute("transform", `rotate(${rotation} ${x} ${y})`);
      addSvgTitle(ellipse, title);
      nightOverlay.appendChild(ellipse);
      return ellipse;
    }
    function addNightCircle(x, y, r, className, title) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", className);
      circle.setAttribute("cx", x.toFixed(1));
      circle.setAttribute("cy", y.toFixed(1));
      circle.setAttribute("r", r.toFixed(1));
      addSvgTitle(circle, title);
      nightOverlay.appendChild(circle);
      return circle;
    }
    function addNightRect(x, y, width, height, className, title, rotation = 0) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", className);
      rect.setAttribute("x", (x - width / 2).toFixed(1));
      rect.setAttribute("y", (y - height / 2).toFixed(1));
      rect.setAttribute("width", width.toFixed(1));
      rect.setAttribute("height", height.toFixed(1));
      rect.setAttribute("rx", "2.5");
      if (rotation) rect.setAttribute("transform", `rotate(${rotation} ${x} ${y})`);
      addSvgTitle(rect, title);
      nightOverlay.appendChild(rect);
      return rect;
    }
    function addWindowGrid(x, y, columns, rows, gapX, gapY, rotation, title) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("transform", `translate(${x} ${y}) rotate(${rotation})`);
      addSvgTitle(group, title);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if ((row + column) % 5 === 0) continue;
          const windowRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          windowRect.setAttribute("class", "night-window");
          windowRect.setAttribute("x", ((column - (columns - 1) / 2) * gapX - 3.8).toFixed(1));
          windowRect.setAttribute("y", ((row - (rows - 1) / 2) * gapY - 2.4).toFixed(1));
          windowRect.setAttribute("width", "7.6");
          windowRect.setAttribute("height", "4.8");
          windowRect.setAttribute("rx", "1.2");
          group.appendChild(windowRect);
        }
      }
      nightOverlay.appendChild(group);
    }
    function addLamp(x, y, title = "Street lamp") {
      addNightEllipse(x, y + 9, 21, 12, "night-cone", title, -16);
      addNightCircle(x, y, 4.6, "night-street-lamp", title);
    }
    function addLampRow(points, spacing, title) {
      points.slice(1).forEach((end, index) => {
        const start = points[index];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.floor(length / spacing));
        for (let step = 0; step <= steps; step += 1) {
          const amount = step / steps;
          addLamp(start.x + dx * amount, start.y + dy * amount, title);
        }
      });
    }
    function addNamedGlow(names, fallback, options) {
      const point = landmarkPoint(names, fallback);
      addNightEllipse(
        point.x,
        point.y,
        options.rx,
        options.ry,
        options.className || "night-glow",
        options.title,
        options.rotation || 0
      );
    }
    function addNightLights() {
      nightOverlay.innerHTML = "";
      addNightEllipse(1488, 742, 62, 24, "night-glow", "Reichstagskuppel mit transparenter Nachtbeleuchtung", -8);
      addWindowGrid(1488, 774, 9, 4, 13, 10, -8, "Beleuchtete Reichstagsfenster und Plenarsaal-Akzent");
      addNightEllipse(1488, 794, 46, 18, "night-cone", "Violetter Plenarsaal-Schimmer im Reichstag", -8);

      addNightEllipse(1225, 471, 102, 42, "night-glow", "Bundeskanzleramt nachts beleuchtet", -16);
      addWindowGrid(1225, 471, 10, 4, 15, 11, -16, "Fensterraster Bundeskanzleramt");
      addWindowGrid(1128, 452, 5, 3, 13, 10, -16, "Kanzleramtsflügel mit Arbeitslicht");

      addNightEllipse(1761, 231, 132, 31, "night-glow", "Glasdach Berlin Hauptbahnhof nachts", -18);
      addWindowGrid(1761, 231, 12, 2, 18, 12, -18, "Beleuchtetes halbrundes Hauptbahnhofdach");

      addNightEllipse(1342, 941, 112, 54, "night-cone", "Brandenburger Tor mit isometrischem Lichtkegel", -7);
      addNightEllipse(1342, 909, 36, 12, "night-bronze", "Quadriga in grünlicher Bronze-Färbung", -7);
      addWindowGrid(1342, 943, 6, 2, 13, 10, -7, "Toröffnungen und Akzentlicht Brandenburger Tor");

      addNamedGlow(["Haus der Kulturen", "HKW"], { x: 777, y: 369 }, {
        rx: 76,
        ry: 28,
        rotation: -10,
        title: "Haus der Kulturen der Welt mit Dachlicht",
      });
      addNamedGlow(["Holocaust"], { x: 1450, y: 1100 }, {
        rx: 92,
        ry: 36,
        rotation: -11,
        title: "Holocaust-Mahnmal mit niedriger Platzbeleuchtung",
      });
      addNamedGlow(["Homosexuellen"], { x: 928, y: 1043 }, {
        rx: 38,
        ry: 18,
        title: "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen",
      });
      addNamedGlow(["Sinti"], { x: 1346, y: 837 }, {
        rx: 42,
        ry: 20,
        title: "Denkmal für die ermordeten Sinti und Roma Europas",
      });
      addNamedGlow(["Sowjetisches"], { x: 1031, y: 735 }, {
        rx: 62,
        ry: 24,
        rotation: -8,
        title: "Sowjetisches Ehrenmal Tiergarten",
      });
      addNamedGlow(["Zeugen Jehovas"], { x: 717, y: 825 }, {
        rx: 34,
        ry: 16,
        title: "Mahnmal Zeugen Jehovas",
      });
      addNamedGlow(["Polen"], { x: 1262, y: 642 }, {
        rx: 36,
        ry: 18,
        title: "Gedenkort ermordete Polen",
      });
      addNamedGlow(["Chillida"], { x: 1180, y: 512 }, {
        rx: 32,
        ry: 15,
        title: "Eduardo-Chillida-Skulptur vor dem Kanzleramt",
      });
      addNamedGlow(["Non-Violence"], { x: 991, y: 381 }, {
        rx: 30,
        ry: 14,
        title: "Kanzlergarten / Non-Violence-Skulptur",
      });

      addNightCircle(623, 832, 12, "night-monument-gold", "Beethoven-Haydn-Mozart-Denkmal mit Goldakzent");
      addNightCircle(1000, 1023, 11, "night-monument-gold", "Goethe-Denkmal mit warmem Denkmallicht");
      addNightCircle(910, 496, 10, "night-glow", "TIPI / Skulpturengarten-Nachtakzent");
      addNightCircle(1324, 845, 8, "night-glow", "Reichstagsvorfeld / Berlin-Pavillon");

      addLampRow([{ x: 1280, y: 936 }, { x: 1342, y: 941 }, { x: 1423, y: 974 }, { x: 1510, y: 1002 }], 54, "Laternen Pariser Platz");
      addLampRow([{ x: 1761, y: 231 }, { x: 1608, y: 264 }, { x: 1488, y: 342 }, { x: 1225, y: 471 }], 68, "Laternen Hauptbahnhof-Spreebogen-Kanzleramt");
      addLampRow([{ x: 1488, y: 773 }, { x: 1346, y: 837 }, { x: 1324, y: 845 }, { x: 1225, y: 906 }], 58, "Laternen Platz der Republik");
      addLampRow([{ x: 623, y: 832 }, { x: 717, y: 825 }, { x: 928, y: 1043 }, { x: 1000, y: 1023 }], 62, "Tiergartenwege und Denkmäler");
      addLampRow([{ x: 405, y: 993 }, { x: 430, y: 1168 }, { x: 520, y: 1194 }], 48, "Kemperplatz und Tiergartentunnel-Südportal");
    }
    function addSceneNode(tag, attrs = {}, parent = sceneOverlay) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) node.setAttribute(key, String(value));
      });
      parent.appendChild(node);
      return node;
    }
    function addCloud(x, y, scale, title) {
      const group = addSceneNode("g", {
        class: "detail-cloud",
        transform: `translate(${x} ${y}) scale(${scale})`,
      });
      addSvgTitle(group, title);
      const drift = addSceneNode("g", { class: "cloud-drift" }, group);
      addSceneNode("ellipse", {
        class: "cloud-shadow",
        cx: 58,
        cy: 128,
        rx: 126,
        ry: 29,
        transform: "rotate(-18 58 128)",
      }, drift);
      addSceneNode("ellipse", { class: "cloud-base", cx: 0, cy: 0, rx: 92, ry: 19 }, drift);
      [
        [-58, -2, 34],
        [-26, -18, 43],
        [18, -23, 50],
        [63, -9, 36],
        [42, 6, 45],
        [-12, 9, 52],
      ].forEach(([cx, cy, radius]) => {
        addSceneNode("circle", { class: "cloud-puff", cx, cy, r: radius }, drift);
      });
    }
    function addVehicle(x, y, rotation, variant, title) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) rotate(${rotation}) scale(.16)`,
      });
      addSvgTitle(group, title);
      addSceneNode("polygon", {
        class: "vehicle-light-cone",
        points: "18,-8 78,-24 82,-2 18,2",
      }, group);
      addSceneNode("rect", {
        class: `detail-vehicle ${variant || ""}`.trim(),
        x: -20,
        y: -9,
        width: 40,
        height: 18,
        rx: 4,
      }, group);
      addSceneNode("rect", {
        class: "vehicle-window",
        x: -8,
        y: -7,
        width: 14,
        height: 14,
        rx: 2,
      }, group);
      addSceneNode("circle", { class: "vehicle-headlight", cx: 18, cy: -5, r: 3 }, group);
      addSceneNode("circle", { class: "vehicle-headlight", cx: 18, cy: 5, r: 3 }, group);
      addSceneNode("circle", { class: "vehicle-taillight", cx: -18, cy: -5, r: 2.8 }, group);
      addSceneNode("circle", { class: "vehicle-taillight", cx: -18, cy: 5, r: 2.8 }, group);
    }
    function addIceTrain(x, y, rotation) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) rotate(${rotation}) scale(.46)`,
      });
      addSvgTitle(group, "ICE auf einem oberen Hauptbahnhof-Gleis unter dem Glasdach");
      addSceneNode("polygon", {
        class: "detail-train-ice",
        points: "-132,-15 120,-15 150,0 120,15 -132,15 -152,0",
      }, group);
      addSceneNode("rect", { class: "detail-ice-stripe", x: -124, y: -2, width: 246, height: 4 }, group);
      for (let xWindow = -108; xWindow <= 92; xWindow += 22) {
        addSceneNode("rect", {
          class: "detail-train-window",
          x: xWindow,
          y: -11,
          width: 12,
          height: 6,
          rx: 1.5,
        }, group);
      }
      addSceneNode("text", {
        class: "detail-label",
        x: 38,
        y: 4,
      }, group).textContent = "ICE";
    }
    function addSbahnTrain(x, y, rotation) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) rotate(${rotation}) scale(.3)`,
      });
      addSvgTitle(group, "Rot-gelber S-Bahn-Zug aus Richtung Friedrichstraße");
      addSceneNode("rect", {
        class: "detail-train-sbahn",
        x: -128,
        y: -13,
        width: 256,
        height: 26,
        rx: 9,
      }, group);
      addSceneNode("rect", { class: "detail-train-yellow", x: -118, y: -5, width: 236, height: 10, rx: 3 }, group);
      for (let xWindow = -104; xWindow <= 96; xWindow += 24) {
        addSceneNode("rect", {
          class: "detail-train-window",
          x: xWindow,
          y: -11,
          width: 13,
          height: 6,
          rx: 1.5,
        }, group);
      }
    }
    function addFlag(x, y, kind, scale, title) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) scale(${scale})`,
      });
      addSvgTitle(group, title);
      addSceneNode("line", { class: "detail-flag-pole", x1: 0, y1: 32, x2: 0, y2: -34 }, group);
      if (kind === "eu") {
        addSceneNode("path", { class: "flag-eu", d: "M0,-34 C22,-41 35,-27 58,-34 L58,-8 C35,-1 21,-15 0,-8 Z" }, group);
        for (let index = 0; index < 10; index += 1) {
          const angle = (Math.PI * 2 * index) / 10;
          addSceneNode("circle", {
            class: "flag-star",
            cx: (31 + Math.cos(angle) * 13).toFixed(1),
            cy: (-21 + Math.sin(angle) * 8).toFixed(1),
            r: 1.7,
          }, group);
        }
        return;
      }
      if (kind === "us") {
        addSceneNode("path", { class: "flag-us-white", d: "M0,-34 C23,-41 35,-27 60,-34 L60,-8 C35,-1 22,-15 0,-8 Z" }, group);
        [-31, -23, -15].forEach((stripeY) => {
          addSceneNode("path", {
            class: "flag-us-red",
            d: `M0,${stripeY} C23,${stripeY - 7} 35,${stripeY + 7} 60,${stripeY} L60,${stripeY + 4} C35,${stripeY + 11} 23,${stripeY - 3} 0,${stripeY + 4} Z`,
          }, group);
        });
        addSceneNode("path", { class: "flag-us-blue", d: "M0,-34 C11,-37 20,-36 29,-32 L29,-20 C19,-24 10,-24 0,-21 Z" }, group);
        return;
      }
      if (kind === "fr") {
        addSceneNode("path", { class: "flag-fr-blue", d: "M0,-34 C9,-37 18,-36 25,-31 L25,-8 C16,-12 8,-12 0,-8 Z" }, group);
        addSceneNode("path", { class: "flag-fr-white", d: "M25,-31 C34,-26 42,-27 50,-31 L50,-8 C42,-4 34,-3 25,-8 Z" }, group);
        addSceneNode("path", { class: "flag-fr-red", d: "M50,-31 C55,-33 59,-34 64,-34 L64,-8 C59,-8 55,-7 50,-8 Z" }, group);
        return;
      }
      const width = kind === "de-large" ? 86 : 58;
      const height = kind === "de-large" ? 33 : 25;
      addSceneNode("path", { class: "flag-black", d: `M0,-34 C${width * .42},-42 ${width * .68},-27 ${width},-34 L${width},${-34 + height / 3} C${width * .68},${-27 + height / 3} ${width * .42},${-42 + height / 3} 0,${-34 + height / 3} Z` }, group);
      addSceneNode("path", { class: "flag-red", d: `M0,${-34 + height / 3} C${width * .42},${-42 + height / 3} ${width * .68},${-27 + height / 3} ${width},${-34 + height / 3} L${width},${-34 + 2 * height / 3} C${width * .68},${-27 + 2 * height / 3} ${width * .42},${-42 + 2 * height / 3} 0,${-34 + 2 * height / 3} Z` }, group);
      addSceneNode("path", { class: "flag-gold", d: `M0,${-34 + 2 * height / 3} C${width * .42},${-42 + 2 * height / 3} ${width * .68},${-27 + 2 * height / 3} ${width},${-34 + 2 * height / 3} L${width},${-34 + height} C${width * .68},${-27 + height} ${width * .42},${-42 + height} 0,${-34 + height} Z` }, group);
    }
    function addBoat(x, y, rotation) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) rotate(${rotation}) scale(.3)`,
      });
      addSvgTitle(group, "Ausflugsdampfer auf der Spree beim Reichstag / Jakob-Kaiser-Haus");
      addSceneNode("path", {
        class: "detail-boat",
        d: "M-70,-14 L56,-14 L76,0 L58,16 L-62,16 L-78,1 Z",
      }, group);
      addSceneNode("rect", { class: "vehicle-window", x: -34, y: -24, width: 65, height: 16, rx: 4 }, group);
      addSceneNode("rect", { class: "detail-boat", x: 16, y: -34, width: 25, height: 13, rx: 3 }, group);
    }
    function addPedicab(x, y, rotation) {
      const group = addSceneNode("g", {
        transform: `translate(${x} ${y}) rotate(${rotation}) scale(.14)`,
      });
      addSvgTitle(group, "Rikscha / Pedicab mit Besucherinnen auf dem Pariser Platz");
      addSceneNode("rect", { class: "detail-pedicab", x: -16, y: -8, width: 34, height: 16, rx: 4 }, group);
      addSceneNode("circle", { class: "detail-pedicab", cx: -18, cy: 10, r: 6 }, group);
      addSceneNode("circle", { class: "detail-pedicab", cx: 18, cy: 10, r: 6 }, group);
      addSceneNode("line", { class: "detail-flag-pole", x1: 18, y1: 0, x2: 42, y2: -5 }, group);
    }
    function addPeopleCluster(points, title) {
      const group = addSceneNode("g", {});
      addSvgTitle(group, title);
      points.forEach(([x, y, radius]) => {
        addSceneNode("circle", { class: "detail-person", cx: x, cy: y, r: radius }, group);
        addSceneNode("line", { class: "detail-flag-pole", x1: x, y1: y + radius, x2: x, y2: y + radius + 8 }, group);
      });
    }
    function addSign(x, y, text, title) {
      const group = addSceneNode("g", { transform: `translate(${x} ${y}) rotate(-8)` });
      addSvgTitle(group, title);
      addSceneNode("rect", { class: "detail-sign", x: -16, y: -9, width: 32, height: 18, rx: 3 }, group);
      addSceneNode("text", { class: "detail-label", x: -10, y: 5 }, group).textContent = text;
    }
    function addBeerGarden(x, y) {
      const group = addSceneNode("g", { transform: `translate(${x} ${y}) rotate(-15) scale(.22)` });
      addSvgTitle(group, "Zollpackhof / Ausflugslokal an der Gustav-Heinemann-Brücke mit Liegestühlen");
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          addSceneNode("rect", {
            class: "detail-chair",
            x: column * 16 - 32,
            y: row * 14 - 8,
            width: 12,
            height: 7,
            rx: 2,
          }, group);
        }
      }
      addSceneNode("circle", { class: "night-monument-gold", cx: 4, cy: -19, r: 9 }, group);
    }
    function addGlassGlint(x, y, width, rotation, title) {
      const group = addSceneNode("g", { transform: `translate(${x} ${y}) rotate(${rotation})` });
      addSvgTitle(group, title);
      addSceneNode("path", {
        class: "detail-glint",
        d: `M${-width / 2},-6 L${width / 2},-18 L${width / 2 - 18},-6 L${-width / 2 + 16},7 Z`,
      }, group);
      addSceneNode("path", {
        class: "detail-glint",
        d: `M${-width / 3},8 L${width / 3},-2 L${width / 3 - 16},8 L${-width / 3 + 12},17 Z`,
      }, group);
    }
    function addTreeCluster(x, y, scale, title) {
      const group = addSceneNode("g", { transform: `translate(${x} ${y}) scale(${scale})` });
      addSvgTitle(group, title);
      [
        [-18, -4, 11],
        [-5, -13, 13],
        [12, -6, 12],
        [4, 10, 10],
        [-17, 12, 9],
      ].forEach(([cx, cy, radius]) => {
        addSceneNode("circle", { class: "detail-tree-cluster", cx, cy, r: radius }, group);
      });
    }
    function addPathSparkles(points, title) {
      const group = addSceneNode("g", {});
      addSvgTitle(group, title);
      points.forEach(([x, y, radius]) => {
        addSceneNode("circle", { class: "detail-path-spark", cx: x, cy: y, r: radius }, group);
      });
    }
    function addSceneDetails() {
      sceneOverlay.innerHTML = "";
      addSceneNode("polygon", {
        class: "sunbeam",
        points: "0,1235 0,1485 860,760 900,680",
      });
      addSceneNode("polygon", {
        class: "sunbeam",
        points: "0,1010 0,1150 1370,500 1420,430",
      });

      addSceneNode("polyline", {
        class: "detail-water-depth",
        points: "690,646 842,604 1040,570 1220,520 1480,410 1720,270 1852,230",
      });
      addSceneNode("polyline", {
        class: "detail-water-highlight",
        points: "690,646 842,604 1040,570 1220,520 1480,410 1720,270 1852,230",
      });
      [
        "760,631 836,610 930,588",
        "1130,544 1215,518 1306,484",
        "1492,402 1586,358 1680,292",
      ].forEach((points) => addSceneNode("polyline", {
        class: "detail-ripple",
        points,
      }));
      addSceneNode("ellipse", {
        class: "detail-water-depth",
        cx: 623,
        cy: 832,
        rx: 68,
        ry: 28,
        transform: "rotate(-17 623 832)",
      });
      addSceneNode("ellipse", {
        class: "detail-water-highlight",
        cx: 623,
        cy: 832,
        rx: 52,
        ry: 16,
        transform: "rotate(-17 623 832)",
      });
      addSceneNode("ellipse", {
        class: "detail-island",
        cx: 626,
        cy: 829,
        rx: 17,
        ry: 8,
        transform: "rotate(-17 626 829)",
      });
      addSceneNode("circle", {
        class: "night-monument-gold",
        cx: 626,
        cy: 825,
        r: 5,
      });
      addSceneNode("path", {
        class: "detail-ripple",
        d: "M582,830 C610,815 641,815 672,832",
      });

      [
        "432,1168 386,1212 334,1270",
        "432,1168 512,1208 602,1228",
        "470,1092 560,1054 636,1017",
        "772,951 700,1010 628,1054",
      ].forEach((points) => addSceneNode("polyline", {
        class: "detail-tunnel-branch",
        points,
      }));
      addSceneNode("rect", {
        class: "detail-portal",
        x: 401,
        y: 1151,
        width: 70,
        height: 28,
        rx: 7,
        transform: "rotate(-16 436 1165)",
      });
      addSceneNode("rect", {
        class: "detail-portal",
        x: 535,
        y: 1211,
        width: 58,
        height: 22,
        rx: 6,
        transform: "rotate(12 564 1222)",
      });

      addIceTrain(1740, 248, -18);
      addSbahnTrain(1556, 337, -18);
      addBoat(1186, 575, -17);
      addBeerGarden(1546, 333);
      addGlassGlint(1488, 742, 112, -8, "Glasglanz auf Reichstagskuppel / Plenarsaal");
      addGlassGlint(1761, 231, 178, -18, "Glasglanz auf dem langen Hauptbahnhofdach");
      addGlassGlint(1225, 471, 148, -16, "Glasglanz und Fassadenkante am Bundeskanzleramt");
      addTreeCluster(715, 820, .86, "Verdichtete Tiergarten-Baumgruppe am Denkmalpfad");
      addTreeCluster(912, 1005, .94, "Verdichtete Tiergarten-Baumgruppe beim Goethe-Denkmal");
      addTreeCluster(1044, 744, .82, "Baumgruppe am Sowjetischen Ehrenmal / Straße des 17. Juni");
      addTreeCluster(525, 908, .9, "Baumgruppe und Parkkante beim Venusbassin");
      addPathSparkles([
        [1310, 942, 2.5],
        [1342, 941, 2.2],
        [1381, 956, 2.4],
        [1422, 975, 2.1],
        [1465, 993, 2.3],
        [620, 828, 1.9],
        [675, 825, 2],
        [735, 837, 1.8],
        [932, 1040, 2.1],
        [1000, 1023, 2.2],
      ], "Kleine helle Wegpunkte für Pariser Platz und Tiergartenpfade");

      addVehicle(1382, 990, -8, "", "Auto am Pariser Platz mit Nachtlicht");
      addVehicle(1448, 1054, -10, "dark", "Auto am Holocaust-Mahnmal mit Nachtlicht");
      addVehicle(507, 1164, 18, "", "Auto am Tiergartentunnel-Südportal stadteinwärts");
      addVehicle(385, 1192, -18, "dark", "Auto am Tiergartentunnel-Südportal stadtauswärts");
      addVehicle(1518, 1010, -8, "", "Diplomatenfahrzeug an der Amerikanischen Botschaft");

      addPedicab(1388, 964, -8);
      addPeopleCluster([
        [1328, 955, 4],
        [1348, 969, 4],
        [1366, 952, 3.6],
        [1406, 985, 4],
        [1420, 963, 3.8],
      ], "Besucherinnen und Besucher auf dem Pariser Platz");
      addSign(1287, 972, "SB", "Starbucks-Ecke am Pariser Platz als Orientierungssignal");

      addFlag(1450, 727, "de", .42, "Reichstag-Turmflagge: Bundesflagge");
      addFlag(1483, 718, "de", .42, "Reichstag-Turmflagge: Bundesflagge");
      addFlag(1517, 725, "de", .42, "Reichstag-Turmflagge: Bundesflagge");
      addFlag(1551, 719, "eu", .42, "Reichstag-Turmflagge: Europaflagge");
      addFlag(1320, 858, "de-large", 1.05, "Flagge der Einheit vor dem Reichstag");
      addFlag(1506, 1000, "us", .55, "Amerikanische Botschaft mit US-Flagge am Pariser Platz");
      addFlag(1262, 922, "fr", .52, "Französische Botschaft am Pariser Platz");

      addCloud(720, 238, .72, "Kleine transparente Cumulus-Wolke mit isometrischem Schatten");
      addCloud(1665, 418, .58, "Kleine transparente Cumulus-Wolke über Hauptbahnhof / Humboldthafen");
    }

    function pointerSnapshot(event) {
      return {
        id: event.pointerId,
        type: event.pointerType,
        x: event.clientX,
        y: event.clientY,
      };
    }
    function touchPointers() {
      return [...activePointers.values()].filter((pointer) => pointer.type === "touch");
    }
    function pointerPair() {
      return touchPointers().slice(0, 2);
    }
    function pointerDistance(pair) {
      return Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
    }
    function pointerAngle(pair) {
      return Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);
    }
    function pointerCenter(pair) {
      return {
        x: (pair[0].x + pair[1].x) / 2,
        y: (pair[0].y + pair[1].y) / 2,
      };
    }
    function startPinchGesture() {
      const pair = pointerPair();
      if (pair.length < 2) return false;
      const rect = stage.getBoundingClientRect();
      const center = pointerCenter(pair);
      const stageX = center.x - rect.left;
      const stageY = center.y - rect.top;
      pinchGesture = {
        distance: Math.max(1, pointerDistance(pair)),
        angle: pointerAngle(pair),
        startScale: state.scale,
        startRotation: state.rotation,
        imagePoint: stagePointToImage(stageX, stageY),
      };
      state.dragging = false;
      state.rotateDrag = false;
      document.body.dataset.dragging = "true";
      return true;
    }
    function updatePinchGesture() {
      const pair = pointerPair();
      if (pair.length < 2 || !pinchGesture) return;
      const rect = stage.getBoundingClientRect();
      const center = pointerCenter(pair);
      const stageX = center.x - rect.left;
      const stageY = center.y - rect.top;
      const factor = pointerDistance(pair) / pinchGesture.distance;
      const angleDelta =
        ((pointerAngle(pair) - pinchGesture.angle) * 180) / Math.PI;
      state.scale = clampScale(pinchGesture.startScale * factor);
      state.rotation =
        ((pinchGesture.startRotation + angleDelta) % 360 + 360) % 360;
      placeImagePointAt(
        pinchGesture.imagePoint.x,
        pinchGesture.imagePoint.y,
        stageX,
        stageY,
      );
      state.viewKey = "free";
      render();
    }
    function resumeSingleTouchDrag() {
      const [pointer] = touchPointers();
      if (!pointer) return false;
      state.dragging = true;
      state.rotateDrag = false;
      state.sx = pointer.x;
      state.sy = pointer.y;
      state.ox = state.x;
      state.oy = state.y;
      state.or = state.rotation;
      state.ot = state.tilt;
      document.body.dataset.dragging = "true";
      return true;
    }
    stage.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activePointers.set(event.pointerId, pointerSnapshot(event));
      stage.setPointerCapture(event.pointerId);
      if (event.pointerType === "touch" && pointerPair().length >= 2) {
        startPinchGesture();
        return;
      }
      state.dragging = true;
      state.rotateDrag = state.mode === "rotate" || event.shiftKey || event.button === 2;
      state.sx = event.clientX;
      state.sy = event.clientY;
      state.ox = state.x;
      state.oy = state.y;
      state.or = state.rotation;
      state.ot = state.tilt;
      document.body.dataset.dragging = "true";
    });
    stage.addEventListener("pointermove", (event) => {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, pointerSnapshot(event));
      }
      if (event.pointerType === "touch" && pointerPair().length >= 2) {
        event.preventDefault();
        updatePinchGesture();
        return;
      }
      if (!state.dragging) return;
      event.preventDefault();
      if (state.rotateDrag) {
        preserveStageCenter(() => {
          state.rotation = state.or + (event.clientX - state.sx) * 0.22;
          state.tilt = Math.max(-28, Math.min(28, state.ot + (event.clientY - state.sy) * 0.08));
        });
        state.viewKey = "free";
      } else {
        state.x = state.ox + event.clientX - state.sx;
        state.y = state.oy + event.clientY - state.sy;
      }
      render();
    });
    function endPointerDrag(event) {
      if (event && !activePointers.has(event.pointerId)) return;
      if (event) activePointers.delete(event.pointerId);
      if (pinchGesture) {
        pinchGesture = null;
        const cardinal = Math.round(state.rotation / 90) * 90;
        const distance = Math.abs(
          ((state.rotation - cardinal + 540) % 360) - 180
        );
        if (distance <= 4) state.rotation = ((cardinal % 360) + 360) % 360;
        savePreferences();
        render();
        if (resumeSingleTouchDrag()) return;
      }
      const shouldSaveView = state.rotateDrag;
      state.dragging = false;
      state.rotateDrag = false;
      document.body.dataset.dragging = "false";
      if (shouldSaveView) savePreferences();
    }
    stage.addEventListener("pointerup", endPointerDrag);
    stage.addEventListener("pointercancel", endPointerDrag);
    stage.addEventListener("lostpointercapture", endPointerDrag);
    stage.addEventListener("contextmenu", (event) => event.preventDefault());
    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.16 : 0.86);
    }, { passive: false });
    document.getElementById("zoom-in").addEventListener("click", () => zoomBy(1.25));
    document.getElementById("zoom-out").addEventListener("click", () => zoomBy(0.8));
    document.getElementById("rotate-left").addEventListener("click", () => rotateBy(-18));
    document.getElementById("rotate-right").addEventListener("click", () => rotateBy(18));
    document.getElementById("tilt-left").addEventListener("click", () => tiltBy(-5));
    document.getElementById("tilt-right").addEventListener("click", () => tiltBy(5));
    document.getElementById("mode-pan").addEventListener("click", () => setMode("pan"));
    document.getElementById("mode-rotate").addEventListener("click", () => setMode("rotate"));
    underButton.addEventListener("click", toggleUnderView);
    document.getElementById("tunnel-focus").addEventListener("click", () => {
      setUnderView(true);
    });
    document.getElementById("details-toggle").addEventListener("click", toggleDetails);
    document.getElementById("clouds-toggle").addEventListener("click", toggleClouds);
    document.getElementById("performance-toggle").addEventListener("click", togglePerformance);
    document.getElementById("quality").addEventListener("click", toggleQuality);
    Object.entries(profileButtons).forEach(([key, button]) => {
      button.addEventListener("click", () => setProfile(key));
    });
    Object.entries(viewButtons).forEach(([key, button]) => {
      button.addEventListener("click", () => setViewPreset(key));
    });
    Object.entries(langButtons).forEach(([key, button]) => {
      button.addEventListener("click", () => setLanguage(key));
    });
    Object.entries(themeButtons).forEach(([key, button]) => {
      button.addEventListener("click", () => setTheme(key));
    });
    document.getElementById("reset").addEventListener("click", resetView);
    document.getElementById("reference").addEventListener("click", () => referencePanel.classList.add("open"));
    document.getElementById("reference-close").addEventListener("click", () => referencePanel.classList.remove("open"));
    ui.advancedLink.addEventListener("click", (event) => {
      if (window.location.protocol !== "file:") return;
      event.preventDefault();
      ui.notice.classList.add("is-warning");
      ui.notice.textContent = t("serverRequired");
      ui.notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") referencePanel.classList.remove("open");
      if ((event.metaKey || event.ctrlKey || event.altKey) && event.key !== "Escape") return;
      const targetTag = String(event.target?.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(targetTag)) return;
      if (event.key === "+" || event.key === "=") zoomBy(1.25);
      if (event.key === "-") zoomBy(0.8);
      if (event.key === "0" || event.key === "Home") resetView();
      if (event.key.toLowerCase() === "r") setMode(state.mode === "rotate" ? "pan" : "rotate");
      if (event.key.toLowerCase() === "u") toggleUnderView();
      if (event.key.toLowerCase() === "f") focusTunnelRoute();
      if (event.key.toLowerCase() === "g") toggleDetails();
      if (event.key.toLowerCase() === "c") toggleClouds();
      if (event.key.toLowerCase() === "p") togglePerformance();
      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        const index = Math.max(0, landmarks.findIndex((landmark) => landmark.name === selectedLandmarkName));
        const direction = event.key === "PageDown" ? 1 : -1;
        focusLandmark(landmarks[(index + direction + landmarks.length) % landmarks.length] || landmarks[0]);
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const rotateMode = state.mode === "rotate" || event.shiftKey;
        if (rotateMode && event.key === "ArrowLeft") rotateBy(-10);
        if (rotateMode && event.key === "ArrowRight") rotateBy(10);
        if (rotateMode && event.key === "ArrowUp") tiltBy(-4);
        if (rotateMode && event.key === "ArrowDown") tiltBy(4);
        if (!rotateMode && event.key === "ArrowLeft") panBy(44, 0);
        if (!rotateMode && event.key === "ArrowRight") panBy(-44, 0);
        if (!rotateMode && event.key === "ArrowUp") panBy(0, 44);
        if (!rotateMode && event.key === "ArrowDown") panBy(0, -44);
      }
      if (event.key === "[") rotateBy(-12);
      if (event.key === "]") rotateBy(12);
      if (event.key.toLowerCase() === "l") setLanguage(state.lang === "de" ? "en" : "de");
      if (event.key.toLowerCase() === "d") setTheme("day");
      if (event.key.toLowerCase() === "m") setTheme("night");
      if (event.key.toLowerCase() === "t") setViewPreset("top");
      if (event.key.toLowerCase() === "n") setViewPreset("north");
      if (event.key.toLowerCase() === "e") setViewPreset("east");
      if (event.key.toLowerCase() === "s") setViewPreset("south");
      if (event.key.toLowerCase() === "w") setViewPreset("west");
      if (event.key === "1") setProfile("atlas");
      if (event.key === "2") setProfile("cinematic");
      if (event.key === "3") setProfile("lab");
    });
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refitPreservingView, 80);
    });
    const initialViewState = {
      viewKey: state.viewKey,
      rotation: state.rotation,
      tilt: state.tilt,
      under: state.under,
    };
    function restoreInitialView() {
      fit();
      const landmark = landmarks.find((item) => item.name === selectedLandmarkName)
        || landmarks.find((item) => item.name === DEFAULT_FOCUS_LANDMARK)
        || landmarks[0];
      if (landmark) focusLandmark(landmark);
      if (initialViewState.under) {
        setUnderView(true);
        return;
      }
      if (VIEW_PRESETS[initialViewState.viewKey]) {
        setViewPreset(initialViewState.viewKey);
        return;
      }
      state.rotation = initialViewState.rotation;
      state.tilt = initialViewState.tilt;
      state.viewKey = "free";
      savePreferences();
      render();
    }
    addTunnelRoutes();
    addNightLights();
    addSceneDetails();
    addLandmarkList();
    applyQualityImage();
    applyLanguage();
    setTheme(state.theme);
    restoreInitialView();
  </script>
</body>
</html>
"""


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def should_package_file(path: Path) -> bool:
  """Return whether ``path`` belongs in the downloadable package."""
  if path.is_symlink():
    return False
  for part in path.parts:
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
    if not should_package_file(path):
      continue
    relative = path.relative_to(source)
    if "regierungsviertel_files" in relative.parts:
      continue
    destination = target / relative
    if path.is_dir():
      destination.mkdir(parents=True, exist_ok=True)
      continue
    if path.suffix == ".map":
      continue
    destination.parent.mkdir(parents=True, exist_ok=True)
    copy_file_contents(path, destination)


def ensure_dzi_tiles_copied(source: Path, target: Path) -> None:
  """Make the packaged DZI tile tree byte-complete after copy quirks."""
  source_tiles = source / "dzi" / "regierungsviertel" / "regierungsviertel_files"
  if not source_tiles.is_dir():
    return

  for path in source_tiles.rglob("*"):
    if not path.is_file() or not should_package_file(path):
      continue
    relative = path.relative_to(source)
    destination = target / relative
    if destination.exists() and destination.stat().st_size == path.stat().st_size:
      continue
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)


def ensure_public_dzi_metadata_copied(source: Path, target: Path) -> None:
  """Overlay current public DZI descriptors/metadata after a stale dist copy."""
  source_root = source / "dzi" / "regierungsviertel"
  if not source_root.is_dir():
    return

  for path in source_root.rglob("*"):
    if not path.is_file() or not should_package_file(path):
      continue
    relative = path.relative_to(source)
    if "regierungsviertel_files" in relative.parts:
      continue
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    copy_file_contents(path, destination)


def compact_packaged_dzi(package_dir: Path) -> None:
  """Drop only redundant top DZI levels from downloadable archives.

  The full hosted pyramid remains in ``src/app/dist``.  A power-of-two
  descriptor reduction lets the package reuse the already generated lower
  levels byte-for-byte, while retaining more fallback detail than the 6144 px
  double-click overview and leaving the 3D mesh completely untouched.
  """
  root = package_dir / "dzi" / "regierungsviertel"
  descriptor = root / "regierungsviertel.dzi"
  tiles = root / "regierungsviertel_files"
  if not descriptor.is_file() or not tiles.is_dir():
    return

  try:
    tree = ET.parse(descriptor)
    image = tree.getroot()
    size = next(child for child in image if child.tag.endswith("Size"))
    width = int(size.attrib["Width"])
    height = int(size.attrib["Height"])
  except (ET.ParseError, KeyError, StopIteration, ValueError) as exc:
    raise SystemExit(f"Invalid packaged DZI descriptor: {descriptor}: {exc}") from exc

  old_max_level = (max(width, height) - 1).bit_length()
  new_max_level = old_max_level
  scale = 1
  while max(width, height) / scale > MAX_PACKAGED_DZI_DIMENSION:
    scale *= 2
    new_max_level -= 1
  if scale == 1:
    return

  size.set("Width", str((width + scale - 1) // scale))
  size.set("Height", str((height + scale - 1) // scale))
  packaged_width = int(size.attrib["Width"])
  packaged_height = int(size.attrib["Height"])
  namespace = image.tag.partition("}")[0].removeprefix("{")
  if namespace:
    ET.register_namespace("", namespace)
  tree.write(descriptor, encoding="utf-8", xml_declaration=True)

  landmarks_path = root / "landmarks.json"
  if landmarks_path.is_file():
    try:
      landmarks = json.loads(landmarks_path.read_text(encoding="utf-8"))
      image_metadata = landmarks["image"]
      entries = landmarks["landmarks"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
      raise SystemExit(
        f"Invalid packaged landmark coordinates: {landmarks_path}: {exc}"
      ) from exc
    image_metadata["width"] = packaged_width
    image_metadata["height"] = packaged_height
    for landmark in entries:
      nx = landmark.get("nx")
      ny = landmark.get("ny")
      landmark["x"] = round(
        float(nx) * packaged_width
        if isinstance(nx, int | float)
        else float(landmark["x"]) / scale
      )
      landmark["y"] = round(
        float(ny) * packaged_height
        if isinstance(ny, int | float)
        else float(landmark["y"]) / scale
      )
    landmarks_path.write_text(
      json.dumps(landmarks, ensure_ascii=False, indent=2) + "\n",
      encoding="utf-8",
    )

  for level_dir in tiles.iterdir():
    if level_dir.is_dir() and level_dir.name.isdigit():
      if int(level_dir.name) > new_max_level:
        shutil.rmtree(level_dir)


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


def start_here_landmarks(package_dir: Path) -> dict:
  """Load bundled landmark coordinates for the zero-server HTML viewer."""
  landmarks_path = package_dir / "dzi" / "regierungsviertel" / "landmarks.json"
  if not landmarks_path.exists():
    raise SystemExit(f"Missing packaged landmarks: {landmarks_path}")
  return json.loads(landmarks_path.read_text(encoding="utf-8"))


def start_here_tunnel_routes(package_dir: Path) -> dict:
  """Load optional tunnel overlay coordinates for the zero-server viewer."""
  route_path = package_dir / "dzi" / "regierungsviertel" / "tiergartentunnel.json"
  if not route_path.exists():
    return {"routes": []}
  return json.loads(route_path.read_text(encoding="utf-8"))


def write_start_here(package_dir: Path) -> None:
  """Write a double-click HTML viewer that needs no server or executable."""
  overview = package_dir / "dzi" / "regierungsviertel" / "overview.png"
  overview_source = package_dir / "dzi" / "regierungsviertel" / "overview_source.png"
  reference = package_dir / "dzi" / "regierungsviertel" / "reference_map.png"
  index = package_dir / "index.html"
  if not overview.exists():
    raise SystemExit(f"Missing packaged overview image: {overview}")
  if not overview_source.exists():
    raise SystemExit(f"Missing packaged source overview image: {overview_source}")
  if not reference.exists():
    raise SystemExit(f"Missing packaged reference map: {reference}")
  if not index.exists():
    raise SystemExit(f"Missing packaged advanced viewer entry point: {index}")

  payload_json = json.dumps(
    start_here_landmarks(package_dir), ensure_ascii=False, separators=(",", ":")
  )
  tunnel_json = json.dumps(
    start_here_tunnel_routes(package_dir), ensure_ascii=False, separators=(",", ":")
  )
  html = START_HERE_HTML.replace("__LANDMARK_PAYLOAD__", payload_json)
  html = html.replace("__TUNNEL_PAYLOAD__", tunnel_json)
  (package_dir / "START-HERE.html").write_text(html, encoding="utf-8")


def write_launchers(package_dir: Path) -> None:
  """Write optional local-server fallbacks.

  The primary package entry point is START-HERE.html. A downloaded macOS
  .command file is intentionally not emitted, because Gatekeeper blocks
  unsigned executable scripts from ZIP downloads before our code can run.
  """
  write_serve_script(package_dir)
  mac_notes = package_dir / "start-mac-if-needed.txt"
  mac_notes.write_text(
    """macOS fallback, only if START-HERE.html does not open correctly.

For the 2D compatibility fallback, double-click START-HERE.html.

Only use Terminal for the server fallback:

1. Open Terminal.
2. Type exactly `cd ` including the trailing space.
3. Drag the whole unzipped folder into the Terminal window and press Return.
   The command line must start with `cd `. Do not run the folder path alone.
4. Run: python3 serve-local.py
5. The server opens the full 3D viewer at the printed
   http://127.0.0.1:.../index.html address.

The command below opens the true 3D viewer directly. This package does not
include start-mac.command because macOS Gatekeeper
blocks unsigned downloaded .command files before the viewer can start.
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


def packaged_scene_counts(package_dir: Path) -> dict[str, int]:
  """Read release-copy mesh counts so README claims cannot go stale."""
  scene_path = package_dir / "mesh" / "regierungsviertel" / "scene.json"
  scene = json.loads(scene_path.read_text(encoding="utf-8"))
  base_tiles = scene.get("base_tiles", [])
  settled_tiles = scene.get("surface_detail_tiles", [])
  hero_files = [
    file
    for hero in scene.get("hero_details", [])
    if isinstance(hero, dict)
    for file in hero.get("files", [])
    if isinstance(file, dict)
  ]
  return {
    "base_faces": sum(int(tile.get("faces", 0)) for tile in base_tiles),
    "base_files": len(base_tiles),
    "glb_files": len(base_tiles) + len(settled_tiles) + len(hero_files),
    "settled_faces": sum(int(tile.get("faces", 0)) for tile in settled_tiles),
  }


def write_readme(package_dir: Path) -> None:
  scene_counts = packaged_scene_counts(package_dir)
  base_faces_de = f"{scene_counts['base_faces']:,}".replace(",", ".")
  settled_faces_de = f"{scene_counts['settled_faces']:,}".replace(",", ".")
  base_faces_en = f"{scene_counts['base_faces']:,}"
  settled_faces_en = f"{scene_counts['settled_faces']:,}"
  (package_dir / "README.txt").write_text(
    f"""Isometric Berlin - Regierungsviertel {PACKAGE_VERSION}
==============================================

Deutsch
-------

Dieses Paket ist eine lokale Website mit allen Kartendaten. Zum Anzeigen
brauchst du keine KI und keinen Google-Key. START-HERE.html ist die klar
gekennzeichnete 2D-Kompatibilitätsansicht ohne Server, nicht das vollständige
Modell. Echtes 3D startet unter Windows per start-windows.bat und unter
macOS/Linux per `python3 serve-local.py`; ein unsigniertes macOS-.command-Skript
wird nicht ausgeliefert. Die 2D-Notansicht enthält Karte, Zoom/Verschieben,
Referenzkarte und Sehenswürdigkeiten-Liste. Er startet mit der schärferen Detailansicht
und hat große Buttons für Zoom, Drehen, Swivel/Kippen, Reset und Pixel-Art.
Version {PACKAGE_VERSION} hat zusätzlich Atlas/Cinematic/Lab-Grafikprofile,
eine technische Kartenbühne, Fokus-Ring und HUD für Sehenswürdigkeit/Zoom/Kamera.
Bei jedem frischen Browserladen wechselt der Start deterministisch zwischen
Reichstag, Bundeskanzleramt, Hauptbahnhof und Siegessäule; ein Sehenswürdigkeits-
Link hat Vorrang, und auch der einmalige saubere WebGL-Neustart nimmt den
nächsten Punkt. Im Fußgängermodus ist kartiertes Wasser eine feste Ufergrenze:
Man kann nicht hindurchgehen, stirbt aber nie und wird nicht zurückgesetzt.
OpenSeadragon hält mobil höchstens 32 Kacheln bei drei Ladern und am Desktop 64
bei sechs. Beim Wechsel zur 2D-Karte wird WebGL überall freigegeben; die
Renderziele bleiben mobil bei 1,35x / 3,2 MP und am Desktop bei 1,75x / 8,5 MP.
Version {PACKAGE_VERSION} setzt den Fußgängermodus exakt auf den aktuellen
Kamera-Fokus; nur bei einem ungültigen Fokus dient die Kameraposition als
Rückfall. Das Bundeswirtschaftsministerium an Sandkrugbrücke und
Berlin-Spandauer Schifffahrtskanal erhält auf seinen amtlichen LoD2-Hüllen
Kanalraster, historische Invalidenhaus-Fenster, Gesimse und Eingänge. Auf dem
Desktop lädt der Progressive-Worker seine unveränderten Welt-URLs selbst,
liefert den nächstgelegenen Detailblock zuerst und überträgt Bounding-Spheres
direkt mit den Geometrien.
Version {PACKAGE_VERSION} rekonstruiert das Sozialgericht Berlin anhand der
sechs bereitgestellten Fassadenfotos als warme ockerfarbene 4 + 3 + 4-Front.
Die 58,038 m lange OSM-Arealgrenze bleibt ausdrücklich getrennt von der
48,905 m langen LoD2-Gebäudewand und ihrem 15,392 m breiten Mittelrisalit.
Rundbogenfenster, Biforien, Fensterbänke, Dreiecksgiebel, Okuli, Säulen,
Gesimse, Zahnschnitt, florale Reliefs und Portal 52 mit sechs Granitstufen
folgen der fotografierten Hierarchie. Drei getrennte Dachfigurengruppen und
der leere Mast bilden die Silhouette. Die Fotos bleiben reine Referenzen und
werden weder gebündelt noch geladen. Smooth nutzt 3 Renderables / 30.005
Vertices in Full und 3 / 19.338 mobil; Minecraft ergänzt ein einziges
Instanz-Batch mit 244 beziehungsweise 196 Blöcken und vollständiger
3-x-5-Pixel-Hausnummer 52.
Version {PACKAGE_VERSION} baut das Beethoven-Haydn-Mozart-Denkmal als zehn
Meter hohen, dreiseitigen und an den Ecken abgestumpften „Musikerofen“ mit
Granitunterbau, getöntem Marmor, drei Rundbogennischen und weißen Halbfiguren,
Pilastern, Masken und Instrumenten, Schwänen, vergoldetem Schuppendach,
Pinienzapfen sowie drei Putten mit Lorbeerkranz. Veröffentlichte Merkmale und
prozedurale lokale Unterteilungen bleiben in den Metadaten getrennt. Das
Modell bleibt bei 30 Renderables / 2.847 gespeicherten / 7.137 gerenderten
Vertices. Eine erhöhte Südansicht hält Nischen, Halbfiguren und Kuppel beim
Fokussieren frei vom dichten Kronendach.
Im Minecraft-Modus schützt eine gemeinsame gedrehte Ausschlussfläche das
Holocaust-Mahnmal vollständig vor Voxelbäumen und vor Spawn, Wegfindung und
Bewegung von Creepern, Zombies und Skeletten. Außerhalb davon behält die
gestreamte deterministische Auswahl im Vollprofil zwei Drittel und mobil ein
Drittel der zulässigen Voxelbäume, ohne eine große Zwischenliste aufzubauen.
Ein einziges Mob-Batch enthält voll vier Creeper, sechs Zombies und drei
Skelette, mobil drei, fünf und zwei. Vier beziehungsweise zwei Lootboxen
benötigen zwei zusätzliche Instanz-Batches, öffnen einmalig bei Kontakt im
Fußgängermodus und zeigen 1,35 Sekunden lang begrenztes Feuerwerk. Das
geschützte Mahnmal bleibt in jedem Profil frei von Bäumen, Mobs und Loot.
Version {PACKAGE_VERSION} gibt Europa-Center, Allianz-Haus, altem Café Kranzler
und Neuem Kranzler Eck, Bahnhof Zoo, Gedächtniskirche/Breitscheidplatz und
Urania eigene quellengebundene Silhouetten und Fassadenrhythmen. Der
City-West-Block nutzt vier zusammengeführte Ensembles mit 11 Renderables /
14.634 Vertices im Vollprofil und 11 / 8.427 mobil. Der
Friedrichstadt-Palast erhält seinen dokumentierten Hauptbau, Bühnenturm,
Foyer-Risalit, Stufen, Lisenen und zweigeschossige Betonglasfelder; der
Tränenpalast bleibt separat als niedriger Stahl-Glas-Pavillon am Bahnhof
Friedrichstraße. Alle neuen Details sind foto- und texturfrei gebündelt und
besitzen begrenzte Voll-/Mobilprofile. Friedrichstadt- und Tränenpalast nutzen
zusammen voll 8 Renderables / 439 Instanzen / 5.329 gespeicherte / 16.873
gerenderte Vertices und mobil 8 / 393 / 3.477 / 13.365.
Version {PACKAGE_VERSION} hält die temporäre FUNBOX vollständig auf ihrer
Darstellungsfläche zwischen Heidestraße, Minna-Cauer-Straße und Döberitzer
Straße. Gezeichnete und Minecraft-Hülle haben mindestens 2,553 m Abstand zu
den ausgelieferten OSM-basierten Straßenflächen, bleiben vom Nordportal des
Tiergartentunnels sowie allen Quell-Voxelgebäuden frei und teilen in Voll- und
Mobilprofil dasselbe tragende Minecraft-Fundament. FUNBOX bleibt bei genau 5
gezeichneten Renderables mit 7.921 gerenderten Vertices und 62
Minecraft-Blöcken. Offizielle Lage, Zeitraum, Größenordnung und Programm
stammen von visitBerlin; die eingepasste Hülle ist nicht vermessene,
prozedurale Darstellungsgeometrie.
Version {PACKAGE_VERSION} gibt dem Geschichtspark Zellengefängnis Moabit ein
quellengebundenes, heutiges Gedenkstättenmodell mit roten Backsteinmauern. Der
22-Punkt-Parkring, 19 Mauersegmente und das Panoptikum folgen exakten OSM-
Geometrien. Vier Segmente behalten die expliziten 4 m von OSM-Weg 105495351;
die übrigen 15 nutzen Berlins allgemeine 5-m-Mauerangabe nur als
Darstellungswert. Die amtliche LoD2-Zelle DEBE01AL2yz00000 bleibt erhalten und
wird nicht von einer zweiten Hülle verdeckt; vorhandene Rasen-, Wege- und
Baumdaten werden nicht dupliziert. Smooth nutzt voll 5 Renderables / 7.818
Vertices und mobil 5 / 5.448. Minecraft nutzt je ein Batch: voll 3.882 Blöcke
/ 93.168 Instanz-Vertices, mobil 2.093 / 50.232. Tag, Nacht, Schneesturm und
Schwellenraum teilen das gezeichnete Modell, Minecraft ersetzt es blockeigen.
Normale Geh-Kollision lässt die drei kartierten Eingangslücken und den
Zellenzugang offen; Schwellenraum behält den ganzen Park geschützt.
Feine Binnenmaße sind prozedural und nicht vermessen. Der geschützte
Landschaftsplan wird weder nachgezeichnet noch gebündelt; Foto, Canvas-Bild,
Thumbnail und Fototextur werden nicht geladen. Der Quellenkontext zu den im
Nationalsozialismus inhaftierten Gegnern, darunter Albrecht Haushofer, bleibt
dem heutigen Gedenkpark zugeordnet, ohne das abgerissene Gefängnis nachzubauen.
Version {PACKAGE_VERSION} verankert das Richard-Wagner-Denkmal als 90.
navigierbare Sehenswürdigkeit am exakten OSM-Knoten 243487615 und bindet seine
Identität an das Landesdenkmalamt-Teilobjekt 09046318,T,041. Der fehlerhaft
geschlossene LoD2-Schutzdachkörper SR00009n und seine sechs massiven
Minecraft-Säulen sind entfernt. Tag, Nacht, Schneesturm und Schwellenraum
nutzen stattdessen ein eigenes offenes, texturfreies Denkmalmodell; Minecraft
ersetzt es durch eine blockeigene Variante. Smooth sind es genau 6 Renderables
mit 12.167 gerenderten Vertices, Minecraft ist genau ein Batch mit 514
Blöcken. Front-, Rück-, Seiten- und hohe Unterdachzugänge bleiben offen;
granulare Kollision folgt nur den dargestellten Marmor- und Stahlkörpern.
Quellfakten sind Lage, amtliche Identität und veröffentlichte Gesamt- und
Figurenhöhe. Lokale Figurengliederung, Dachquerschnitt, Bauteilabstände,
Ausrichtung und Kollisionskörper sind nicht vermessene Darstellungswerte.
Es werden weder Referenzfoto noch Thumbnail oder Fototextur gebündelt oder
geladen.
Version {PACKAGE_VERSION} macht die Weidendammer Brücke als 91.
Sehenswürdigkeit anwählbar. Exakter OSM-Weg 6228081 bestimmt Mitte und Achse;
das Berliner Brückeninventar bestimmt die heutige Hülle von 69,48 x 25,17 m,
das Landesdenkmalamt-Objekt 09030074 das geschützte Dreifeld- und
Ornamentsystem. Genau ein neobarockes Geländersystem trägt zwei geschmiedete
Adlerreliefs in Brückenmitte und acht Laternenständer. Die vielen
Liebesschlösser sind eine deterministische heutige Darstellung, keine
Einzelinventur: 192 im Voll- und 96 im Mobilprofil. Smooth nutzt voll 5
Renderables / 46.568 gespeicherte / 90.116 gerenderte Vertices und mobil 5 /
32.744 / 54.404. Minecraft ersetzt das glatte Ornament durch ein Batch mit 344
Blöcken / 8.256 Instanz-Vertices beziehungsweise mobil 224 / 5.376. Fahrbahn,
Gehwege und Zufahrten bleiben begehbar. Die kulturelle Biermann-Verbindung zum
Brückenadler bleibt Metadatum; weder Liedtext noch Foto, Plan oder Textur wird
kopiert oder geladen.
Version {PACKAGE_VERSION} gibt dem Max-Liebermann-Haus, der Französischen und
der US-Botschaft sowie der Akademie der Künste vier getrennte, quellengebundene
Fassaden über den erhaltenen LoD2-/OSM-Körpern. Die gezeichneten Varianten
zeigen ihre charakteristischen Fenster-, Stein-, Eingangs-, Glas- und
Erschließungsrhythmen in Tag, Nacht, Schneesturm und Schwellenraum; Minecraft
nutzt dafür eine einzige grobe, opake Blocksignatur. Alle Details sind
codebasiert, nicht vermessen und enthalten keine Fototextur.
Version {PACKAGE_VERSION} rekonstruiert außerdem Goethe und Lessing an ihren
exakten OSM-Knoten als getrennte quellengebundene Tiergarten-Denkmäler. Goethe
ist schneefrei 6,08 m hoch und behält 42 Zaunfelder sowie drei Zweiergruppen
mit sechs Allegoriefiguren. Lessing ist schneefrei 7,00 m hoch und behält fünf
Stufen, zwei Becken mit Delphinausläufen, drei Porträts und zwei große
Bronzeallegorien. Sichtbares Modell, Minecraft und physische Kollision teilen
für Lessing denselben abgeschrägten Achtkant mit 28 Zaunfeldern auf acht
Segmenten. Tag, Nacht, Schneesturm und Schwellenraum nutzen die gezeichneten
Modelle; Minecraft unterdrückt sie zugunsten einer blockeigenen Lesart. Im
Schneesturm sind es zusammen genau 8 Renderables mit 24.870 gerenderten
Vertices; Minecraft nutzt ein InstancedMesh mit 557 Blöcken und 13.368
gerenderten Vertices, insgesamt sind 9 Renderables gespeichert. Schutzradien
von 4,3 m und 2,95 m halten die Denkmäler geschlossen, während Core- und
Zaunseiten-Kollision alle acht geprüften Anlaufrichtungen frei lässt.
Version {PACKAGE_VERSION} verfeinert außerdem das Forum des ehemaligen Sony
Center mit dem 24-teiligen Dachplan, Ringfachwerk, Seilen, geneigter Mittelstütze,
sieben Auflagern, Klemmen, Licht, gegliederten Glasfassaden und Brunnen. Das
TIPI am Kanzleramt behält die veröffentlichte 32 x 26 m Hülle, erhält aber ein
achtgipfliges Zeltdach, 48 Rippen, Eingang, Foyer und Seitenbauten. Die
vom Nutzer und Projekt-Eigentümer für den Viewer erfundene Zeile `PIGOR &
EICHHORN` bleibt in allen fünf Modi gut lesbar, in Minecraft als eigene
Blockschrift. Die reine Anzeigezeile `NUR HEUTE ABEND` bleibt nur in den vier
gezeichneten Modi sichtbar und wird in Minecraft nicht dupliziert. Beide Zeilen
stammen nicht vom TIPI-Betreiber und behaupten kein aktuelles Programm.
Version {PACKAGE_VERSION} verkleinert den offenen Dachring des Berliner
Ensemble auf fotoeingegrenzte 4,8 m und dreht ihn in allen fünf Modi einmal in
120 Sekunden. Die Bewegung ist auf 12 Hz ohne Touch oder 8 Hz im
mobilähnlichen Touch-Profil begrenzt und bleibt bei reduzierter Bewegung sowie
in fernen, ausgeblendeten, unsichtbaren oder unterirdischen Ansichten stehen.
Das als 92. Sehenswürdigkeit anwählbare Brecht-Denkmal erhält die komplette
leicht überlebensgroße Sitzfigur mit
Mantelfalten, Händen und Füßen auf der asymmetrischen offenen Metallbank, die
sechs Meter große runde Pflasterplattform und drei zylindrische, horizontal
gefugte Schwarzsteinstelen. Peter Flierl wird für die Installationsgestaltung,
Fritz Cremer für die Skulptur und Carlo Wloch für Steinarbeit/Stelen genannt.
Außerhalb von Figur, Bank und Stelen bleibt die Plattform begehbar; Minecraft
nutzt eine eigene deterministische 4-Batch-/197-Block-Lesart ohne glatte
Doppelung. Smooth nutzt voll und mobil 3 Renderables / 24.840 gespeicherte und
gerenderte Vertices; Minecraft rendert 4.728 Instanz-Vertices. Die 14-m-Kamera
zielt auf den exakten Anker, Feinanatomie blendet bei 34/105 m. Gedicht und
Zitate werden nicht wiedergegeben; Einschnittspuren
bleiben unlesbar. `Eine Skulptur für Helene Weigel`, enthüllt am 10. Mai 2026,
erscheint als transparenter Glaskubus auf weißem Sockel. Im Zentrum steht der
rote klappbare Regiestuhl mit zwei deutlich sichtbaren gekreuzten
Scherenrahmen; ihn umgeben die gefaltete rote Stuhl-/Objektlandschaft,
Licht-/Audioelemente und sichtbare Kabel. Ein großes schwarzes prozedurales
Rasterporträt liegt auf dem Glas. Es werden weder Pressefoto noch
Porträtausschnitt oder Porträttextur gebündelt oder geladen.
Minecraft lässt im Vollprofil genau vier Creeper, sechs Zombies und drei
Skelette mit Bogen auf deterministischen, von behaltenen Bäumen freien und
gedenkstättengeschützten Grasrouten laufen; mobil sind es drei, fünf und zwei.
Das Mob-Feld bleibt in jedem Profil ein Renderdurchlauf und verschwindet
außerhalb des Minecraft-Modus.
Version {PACKAGE_VERSION} ergänzt außerdem die neue, vom vorhandenen
Queer-Rainbow-Gedenkmodell getrennte CSD-Gedenkstelle am exakten OSM-Knoten
14076715427. Französischer Ahorn, belaubte junge Krone, rundes Metallschutzgitter,
wenige statische Pride-Fahnen, Kränze und Karten sowie die Regenbogenbank bleiben
in Tag, Nacht, Minecraft, Schneesturm und Schwellenraum sichtbar. Nur der
Quellanker und die veröffentlichten Sachmerkmale sind fest; alle örtlichen Maße
und Anordnungen sind fotoeingrenzte, nicht vermessene Darstellungswerte. Es wird
kein Foto oder Screenshot gebündelt. Sie bleibt außerhalb des 93-Orte-Katalogs
und ist keine 94. Tourstation.
Version {PACKAGE_VERSION} versetzt 1.093 Ampelmasten an deterministische äußere
Straßenränder: 1.092 Quellpunkte in der modellierten Fahrbahn sowie einen
Dezimeter-Randfall. 227 bereits sichere Masten bleiben am Quellort. Schema 7
behält alle 1.328 OSM-Quellknoten samt
abwärtskompatiblen Rohkoordinaten. Acht direkt mit crossing:island=yes belegte
Inselampeln bleiben quellengetreu auf einem sichtbaren kleinen Inselsockel;
unbelegte Lücken im Straßennetz gelten nie als Insel. Nach
Dezimeterquantisierung halten versetzte Masten mindestens 0,5 m Abstand zur
Fahrbahn. Keine Ampel wird entfernt. Eine schemaspezifische Cache-Abfrage
verhindert, dass alte Schema-6-Daten die Korrektur verdecken.
Version {PACKAGE_VERSION} lässt genau neun amtliche Staatsfahnen in Tag, Nacht,
Minecraft, Schneesturm und Schwellenraum leicht flattern: drei deutsche und
eine europäische Fahne auf dem Reichstag, die deutsche und europäische
Protokollfahne am Kanzleramt, die Fahne der Einheit, die Schweizer Fahne und
die Standarte des Bundespräsidenten. Ihre 30 Tuch- und Emblem-Ebenen bewegen
sich am freien Rand höchstens 0,28 m, mit maximal 12 Hz ohne Touch und 8 Hz im
mobilähnlichen Touch-Profil. Bei reduzierter Bewegung sowie in fernen,
unterirdischen oder ausgeblendeten Ansichten bleibt die Pose fest. Im
Schneesturm erhalten die Farben einen reversiblen Frostüberzug; genau 27
gebündelte Eiszapfen bewegen sich mit demselben sanften Wind. Minecraft behält
blockige Masten, zeigt darüber aber das bewegte Tuch ohne statische
Block-Doppelung. Die frühere zusätzliche Denkmal-Kopie der Fahne der Einheit
ist entfernt, ihr OSM-Quellbezug bleibt im eigenen maßstäblichen Modell
erhalten.
Version {PACKAGE_VERSION} richtet Hotel Adlon und Starbucks an ihren echten
Pariser-Platz-Fassaden aus. Adlon folgt OSM-Relation 4582978, Außenweg 26041943
und LoD2-Körper K00006ot; Rundbögen, Rustika, rotes Eingangsvordach,
Balkonbänder, patiniertes Mansarddach, Gauben, Flaggen und offene Dachschrift
bilden eine statische, quellengebundene Erkennungsschicht. Starbucks folgt
OSM-Knoten 66917229 um die Südwestecke von LoD2-Körper K00005Hq: zwei flache
Glasfronten, graue Fassadenschrift und freistehende schwarze Terrassenelemente
ersetzen die frühere diagonale grüne Blende. Minecraft verwendet dafür eine
gemeinsame grobe, opake Blocksignatur. Vier frei lizenzierte Referenzen sind im
öffentlichen Quellenpaket attribuiert; kein Foto wird als Fassadentextur
gebündelt oder projiziert.
Version {PACKAGE_VERSION} zeigt das als 93. Sehenswürdigkeit anwählbare
Scharnhorst-Grab am exakten OSM-Knoten 273120316 mit der im Berlin-Lexikon
veröffentlichten Gesamthöhe von 5,60 m: Schinkels zwei
Architekturpfeiler und Eisengitter fassen den hohen Carrara-Marmorsarkophag,
Tiecks Relieffries und einen wirklich liegenden Bronzelöwen statt eines
Ellipsoids. Christian Daniel Rauch modellierte den Löwen, Theodor Kalide
führte ihn aus; das Schinkelportal kennzeichnet den heutigen Sarkophag und Fries
als konservatorische Kopien. Der tragende Löwenkörper bleibt nach dem Ausblenden naher
Mähnen-, Gesichts- und Krallendetails lesbar. Smooth nutzt voll und mobil 8
Renderables / 554 gespeicherte / 15.539 gerenderte Vertices; Minecraft steuert
4 Batches / 566 Blöcke / 13.584 Instanz-Vertices bei. Die 18-m-Kamera zielt auf
den exakten Anker, der Raum zwischen den Pfeilern bleibt begehbar. Außerdem unterscheidet der
Invalidenfriedhof die charakteristischen Grabmale Witzleben, Winterfeld,
Kessel und Rauch, die Auguste-Viktoria-Glocke im offenen Stahlrahmen sowie
Kanal- und Hinterlandmauer. Der separate ehemalige DDR-Führungsturm Kieler Eck
ist als Gedenkstätte Günter Litfin aus amtlichen Denkmal-, OSM- und
LoD2-Ankern rekonstruiert. Alle neuen Details bleiben statisch; Minecraft nutzt
eigene Blockformen. Wege und offene Glockenturmfelder bleiben begehbar,
wiederholte Feinteile sind gebündelt, und die gelieferten Fotos bleiben
ungebündelte Referenzbilder statt Texturen oder Vermessungsdaten.
Die vier ausgelieferten Landmark-Kataloge enthalten synchron 93 Orte. Alle 41
Relativlagen-Verträge und die drei etablierten manuellen Prüfanker bleiben
erhalten; die Nummern 90–93 sind Richard Wagner, Weidendammer Brücke, Bertolt
Brecht und Scharnhorst.
Neu ist ein zweisprachiger Deutsch/English-Schalter und ein Tag-/Nachtmodus.
Im Nachtmodus legt der Offline-Viewer beleuchtete Fenster für Reichstag,
Bundeskanzleramt und Hauptbahnhof, Lichtkegel am Brandenburger Tor,
Denkmal-Akzente, Tiergarten-/Pariser-Platz-Laternen und verstärkte
Tunnelbeleuchtung über die Karte.
Version {PACKAGE_VERSION} ergänzt außerdem eine Szenen-Detail-Ebene mit zwei
transparenten isometrischen Wolken, Südwest-Sonnenlicht am späten Nachmittag,
Wolkenschatten, Wasser-Tiefenakzenten, Tunnel-Zusatzästen, ICE, S-Bahn,
Autos mit Nachtlichtkegeln, Flaggen, Spree-Ausflugsboot, Pariser-Platz-
Besuchern/Rikscha und Zollpackhof-/Gustav-Heinemann-Brücke-Details.
Details und Wolken lassen sich jetzt separat abschalten; die Auswahl wird mit
den anderen Offline-Einstellungen gespeichert. Die Tasten G und C schalten
diese Ebenen direkt. Beim Ziehen reduziert der Viewer teure SVG-Filter, damit
sich Pan/Rotate/Swivel leichter anfühlen. Neu sind außerdem Glasglanz auf
Reichstag, Hauptbahnhof und Kanzleramt, Wasser-Ripples, Tiergarten-Baumgruppen
und kleine Wegakzente.
Version {PACKAGE_VERSION} ergänzt einen gespeicherten Leichtmodus mit Taste P.
Er schaltet teure Schatten, Filter und Wolkenanimationen herunter. Außerdem
behält der Viewer beim Ändern der Fenstergröße Fokus, Zoom, Drehung, Swivel
und Unterseitenansicht, statt auf die Übersicht zurückzuspringen.
Version {PACKAGE_VERSION} kann außerdem gezielt mit URL-Parametern gestartet
werden, etwa `START-HERE.html?lite=1&details=0&clouds=0` oder
`START-HERE.html?lang=en&theme=night`. Wenn die schärfere Detailgrafik lokal
nicht geladen werden kann, fällt der Viewer automatisch auf die Pixelgrafik
zurück.
Sprache, Tag/Nacht, Grafikprofil, Pixel-/Detailbild-Auswahl, zuletzt fokussierte
Sehenswürdigkeit und Blickwinkel werden lokal im Browser gespeichert und beim nächsten
Öffnen wiederhergestellt. Falls ein Browser localStorage sperrt, startet
START-HERE.html trotzdem mit Defaults.
Der Tiergartentunnel ist ein unterirdisches Rechteckbauwerk mit zwei Röhren,
Seitenwänden, Mittelwand, warmen Lichtpunkten, Lüftungs-/Schachtmarkern und
Querschnittsmarken. Von oben bleibt er verborgen; sichtbar wird er erst in der
Unterseitenansicht. Die Geometrie nutzt
ab v0.1.49 abgeleitete OSM-B96-Tunnel-Ways als Carriageway-Evidenz und bleibt
eine Ingenieurannäherung; sie ist noch keine amtliche Bestandsvermessung.
Version {PACKAGE_VERSION} formt den Tunnel weiter aus: Unterseitenmodus,
Portalrahmen, Deckenrippen, Fahrbahn-/Röhrenmarken und Servicebuchten laufen
beim Drehen, Swiveln und Verschieben mit.
Maus: ziehen verschiebt; im Modus "Drehen/Swivel", mit Shift+Ziehen oder
Rechtsziehen drehst und swivelst du die Karte. Top/Nord/Ost/Süd/West-Presets
und eine Kompasszeile machen Blickwinkel reproduzierbar. Unterseite fokussiert
den Tunnel von unten; Tunnel-Fokus zoomt auf den Verlauf. Die Tasten U und F
schalten diese Ansichten, 1/2/3 wechseln die Grafikprofile. L wechselt die
Sprache, D schaltet Tagmodus, M schaltet Nachtmodus. Der Advanced Viewer
bleibt zusätzlich dabei, braucht aber je nach Browser den lokalen Server-Fallback.
Touchscreen: Ein Finger verschiebt die Karte, zwei Finger zoomen, drehen und
verschieben um den Fingermittelpunkt. Nahe 0/90/180/270 Grad rastet die
Ansicht ein. Auf iPhone, iPad, Android-Tablets und
anderen Touch-Geräten nutzt der Viewer größere Buttons, sichere
Viewport-Höhen und ein kompaktes unteres Bedienfeld.

Der Advanced Viewer startet mit einem echten Three.js-3D-Modell aus dem
amtlichen Berlin 3D Mesh 2025. Die linke Maustaste verschiebt direkt, ein
gerastertes Mausrad zoomt am Zeiger und die rechte Maustaste dreht. Auf dem
Trackpad verschiebt Zwei-Finger-Scroll, Pinch zoomt am Fingermittelpunkt. Auf
Touch-Geräten verschieben zwei Finger per Swipe und zoomen per Pinch; drei
Finger steuern Drehung und Neigung bis in die echte Untersicht. Pfeiltasten
verschieben in der sichtbaren Ebene; WASD fliegt relativ zur Blickrichtung,
Leertaste steigt und Shift sinkt. Alt/Option plus Pfeiltasten dreht oder neigt.
Im Spaziergang bewegt WASD; einmal Leertaste springt bis 6,2 m, zweimal binnen
320 ms hebt denselben Sprung einmalig bis 10,5 m an. Drei schnelle Anschläge
derselben Pfeil- oder WASD-Taste schalten den eigenen 8×-Schnelllauf ein und
wieder aus; Shift beziehungsweise zweimal Vorwärts bleiben der 4×-Sprint.
In der Untersicht wird die Oberfläche transparent und der technische
Tiergartentunnel-Cutaway mit zwei Röhren, Beleuchtung und Lüftung sichtbar.
Nur die ausgewählte Sehenswürdigkeit erhält kurz einen Leuchtring; permanente
Farbpunkte über den Gebäuden gibt es nicht mehr. Der Advanced Viewer besitzt
direkte Tag-, Nacht- und Minecraft-Schalter. Die Oberfläche ist vollständig
Deutsch/Englisch umschaltbar. Taste B oder der Lautsprecherknopf startet und
stoppt sieben lokal erzeugte 8-Bit-Musikvarianten; Musik bleibt standardmäßig
aus. Taste D schaltet Tag/Nacht, Taste M Minecraft.

In Version {PACKAGE_VERSION} ist die Minecraft-Hauptarchitektur bewusst gröber
und blockiger: weniger als 5.000 Signaturblöcke folgen einem 8-m-Hero-Raster.
Beibehaltene Quellkörper von Reichstag, Kanzleramt und Parlamentsbauten werden
vertikal in höchstens 8 m hohe Blockkurse geteilt; glatte Architektur-Overlays
bleiben im Minecraft-Modus ausgeblendet. Vorhandene Eingangsportale, offene
Passagen sowie freie Dreh-, Schwenk-, Zoom-, Flug- und Fußgängernavigation
bleiben erhalten.

Im mobilen Touch-Profil begrenzt Version {PACKAGE_VERSION} den Minecraft-
Speicher. Es gilt bei primärem oder beliebigem groben Zeiger sowie bei
navigator.maxTouchPoints > 0. Der frühere Benchmark vor der Baum-Auswahl maß
845,561 Instanzen / 63.265 MiB Instanzpuffer mobil und 3,419,412 / 249.815 MiB
voll; die aktuelle 1/3- beziehungsweise 2/3-Retention macht diese Werte zu
konservativen Obergrenzen. Nur im mobilen Profil entfallen generische
Fassadenscheiben und Wiesenblumen; Nicht-Hero-
Quellspalten werden zusammengefasst, während Hero-Kurse bis 8 m, Signaturen und
Navigation erhalten bleiben. Jedes WebGL-Profil nutzt kein Renderer-MSAA,
einen 0x-UnsignedByte-Composer und einen abschließenden SMAA-Durchlauf.
Inaktive
Weltaufbauten werden abgebrochen, fehlgeschlagene Voxel-Anbindungen
zurückgerollt und glatte Parkdetails bleiben im Voxelmodus ohne Toon-Klone
verborgen. Dies ist Benchmark-/Browser-QA, keine Prüfung auf einem physischen
iOS-Gerät.

Dasselbe mobile Touch-Profil behält für die nächsten 5.000 LoD2-Gebäude exakte
Geometrie. Nach dem ersten Bild aus 320 Gebäuden erhält der verzögert gestartete
Worker nur Quell-URL und Startanzahl, lädt die Quelle selbst, überträgt zuerst
alle geeigneten ferneren Gebäude als vermessene, ausgerichtete und quellfarbene
Instanzhüllen in einem Draw Call und deckt danach auch die übrigen 4.680
Nahfeldkörper sofort durch kleine ausgerichtete Instanzvorschauen ab. Jeder
exakte Gebäudebatch ersetzt nur seine eigene Vorschau. Die Hauptschleife klont
weder Stadt-, Gelände- noch Flächendaten; der Worker erzeugt keine exakten
`surface-*`-Flächenfamilien.
Rastergelände, -wasser und -asphalt sowie das
vollständige modellierte Parkwegenetz erhalten den Kartenkontext. ParkDetails
startet erst danach. Mit Tunnel in der Produktionsszene misst das Touch-Profil
107.201 Instanzen und 11.422.846 Byte Geometrie- plus Instanzpuffer; das
Nicht-Touch-Produktionsprofil mit Settled-Detail misst 499.963 Instanzen und
42.937.418 Byte. Der eingefrorene Vergleichsvertrag ohne Tunnel und
Settled-Detail bleibt bei
107.239 Instanzen / 66 Drawables / 11.425.374 Byte für Touch gegenüber 450.038 /
1.471 / 39.096.522 Byte im Vollprofil. Verborgene Tabs
stoppen Teilverfeinerungen und starten sie sichtbar sauber neu. Ein
kalter Minecraft-Start baut oder lädt ParkDetails in keinem Profil und fordert
surface-polygons.json nicht an. Die Datei bleibt bis zum Wechsel in einen
gezeichneten Modus oder bis zum Wasser-Kollisionsbedarf des Fußgängermodus
zurückgestellt. Erst ein tatsächlicher Wechsel in einen beliebigen gezeichneten
Modus startet die idempotente Parkdetail-Erzeugung. Im Touch-Profil bleibt
jeweils nur die aktive
gezeichnete oder Minecraft-Weltfamilie im Speicher. Profilunabhängig erhält ein
WebGL-Laufzeitfehler genau einen sauberen Neustart; beim zweiten Fehler
erscheinen Wiederherstellung und 2D-Karte als ausdrückliche Auswahl.
Nicht-Touch-Desktop behält die vollständige Architektur, reduziert aber seine
Minecraft-Bäume ebenfalls deterministisch auf zwei Drittel.

Version {PACKAGE_VERSION} startet Tag, Nacht und Schnee mit einem kompakten
Geländekontext statt mit den fotografischen GLBs. Auf Nicht-Touch-Desktop lädt
die amtliche
{base_faces_de}-Flächen-Stufe nur noch als echte Fehlerreserve; jede Untersicht
und jede mobileähnliche Touch-Sitzung bleibt vollständig foto-frei. Die
archivierte {settled_faces_de}-Flächen-Stufe wird bei der normalen
Navigation nicht im Hintergrund angefordert. Minecraft-Gebäude und -Bäume
bleiben bis zum Wechsel in diesen Modus ebenfalls ungeladen.
Fehlgeschlagene JSON-Dateien werden einmal wiederholt und nach 45 Sekunden
sauber abgebrochen. Beim Wechsel zur 2D-Karte gibt jedes Gerät die inaktive
3D-Szene vollständig frei; Desktop hält sie nur beim Wechsel zwischen Live-
3D-Modi warm. Verlorene Pointer-Captures, Fensterwechsel, globale
Pointer-Releases und ein zehnsekündiger Watchdog verhindern ein Festhängen.
Die interne Renderauflösung bleibt vom Beginn einer Geste bis nach dem
Ausrollen unverändert.
Vor dem Browserstart prüft serve-local.py außerdem Bytezahl und SHA-256 aller
{scene_counts["glb_files"]} GLB-Dateien und meldet eine unvollständige Entpackung mit genauem Dateinamen.
Der lokale HTTP/1.1-Server cached unveränderliche GLBs, Kartenkacheln und
Programmdateien, sodass ein erneuter 3D-Start nicht wieder alle Modelldaten
übertragen muss.

Diese Version verfeinert außerdem die metrisch-architektonische Darstellung:
LoD2-Grundrisse bleiben der Metermaßstab. Zusätzlich liefert die Berliner
Befliegung vom Juni 2025 echte photogrammetrische Dach-, Gelände- und
Fassadenoberflächen. Reichstag, Kanzleramt, Hauptbahnhof und Brandenburger Tor
haben separate hochauflösende, LoD2-maskierte Texturmodelle bis 1600 px pro
Materialsegment. Maßhaltige Erkennungsmodelle ergänzen das Fotomesh: Reichstag
mit Westportal, Ecktürmen und 40 x 23,5 m Kuppel; Kanzleramt mit 36-m-Kubus und
LoD2-ausgerichteten 18-m-Bändern; Hauptbahnhof mit 321-m-Glasdach, 180 x 42 m
Querhalle und 46-m-Bügeln; Brandenburger Tor mit 62,5 x 11 x 26 m, zwölf Säulen
und grün patinierter Quadriga. Die Fototextur bleibt darunter erhalten.

Das zentrale Kanzleramtsgebäude zeigt jetzt hinter seinen kühlen, transparenten
Glasflächen die von außen erkennbare Raumfolge: geteilte Galerieplatten um ein
14,4 m breites Atrium, drei Brücken, eine zweiläufige Treppe, Geländer sowie
wenige abstrahierte Möbel- und Pflanzengruppen. Nachts leuchten nur einzelne
Innenfelder, lineare Galerie-, Lobby-, Decken- und Dachuntersichtsleuchten warm;
das Glas selbst bleibt dunkel und durchsichtig. Diese Innendetails folgen den
sechs gelieferten Außenansichten, sind aber keine vermessene oder
sicherheitsrelevante Grundrissdarstellung. Die Fotos sind nicht im Paket und
werden nicht als Textur projiziert.

Die amtliche Berliner Vorderlandmauer-Geometrie bleibt unverändert, wird aber
als zwei sichtbare Reihen einzelner dunkler Granitsteine über den gezeichneten
Straßen- und Platzflächen geführt. So ist insbesondere der dokumentierte
Halbkreis westlich des Brandenburger Tors lesbar. Gebogene, vollständig in den
kartierten Wasserflächen liegende Linien ersetzen zugleich die früheren geraden
Wasserstriche; beide Details sind statisch und erzeugen kein Flackern.

Am Spreebogen führen die exakten OSM-Achsen nun steinerne Uferkanten, den
angehobenen Panoramaweg auf rechteckigen Stützen und die versetzten Platten der
Gartenspur. Gustav-Heinemann-Brücke zeigt ihren hell salbeigrünen, 2,25 m hohen
Vierendeelrahmen um den Holzweg; Hugo-Preuß-Brücke ihren tiefen, gekrümmten und
mittig pfeilerfreien Stahlkasten. Am Potsdamer Platz verankern 28 amtliche
Leuchtenpositionen eine heutige Fußgängerachse mit gebündelten Belags- und
Möblierungsdetails, ohne die vorhandene Leuchtenschicht zu duplizieren.

Version {PACKAGE_VERSION} erweitert den sichtbaren Radius auf 6.450 m und
ergänzt den rundum nochmals um 500 m erweiterten Datenring mit
{scene_counts["base_files"]} amtlichen
Interaktionskacheln. Tram und Haltestelle am Hauptbahnhof, S15-Zugang,
Washingtonplatz-Taxis, Futurium, die Bundesministerien, Parlament der Bäume,
Berliner Ensemble, Bahnhof Friedrichstraße, Detlev-Rohwedder-Haus, Gropius
Bau, Abgeordnetenhaus und Topographie des Terrors bleiben in allen
Oberflächenmodi an denselben verifizierten Koordinaten. Fahrzeuge,
Fassadenrhythmen und die beschädigte Mauerkronen-Lesart sind ausdrücklich
maßstäbliche Darstellungsannäherungen.

Der aktuelle Erweiterungsbau des Bundeskanzleramts auf der anderen Spreeseite
folgt seinen OSM-Baugrundrissen und der amtlich veröffentlichten Bauphase vom
April 2026. Der weitgehend fertige Rohbau, die installierte Südbrücke und der
technische Ausbau sind quellengebunden; Gerüst, Kräne, Zäune, Sperren und
Materiallager bleiben ausdrücklich statische Darstellungsannäherungen.

Die Untersicht zeigt zusätzlich das reale OSM-Plannetz der unterirdischen
Fern-, S- und U-Bahn-Gleise, Bahnsteige und Zugänge. U5 sowie der gemeinsame
Nord-Süd-Korridor von S1/S2/S25/S26 sind farblich lesbar; Tiefen,
Tunnelquerschnitte und gerade Zugangsschächte bleiben ausdrücklich schematisch.
Es werden keine erfundenen Versorgungsleitungen dargestellt. Oberirdische
Tram-Fahrdrähte folgen OSM-Trassen; ihre Höhe und Mastteilung sind angenähert.
Wenige statische Personen, BVG-Busse, Autos, Fahrräder, E-Scooter und
Kinderwagen geben Maßstab, ohne beobachteten Verkehr zu behaupten.

Der vollständige begrenzte OSM-Wegebestand wird als echte Geländeoberfläche
gezeichnet: 20.782 Geh-, Rad-, Stufen-, Feld- und Trampelpfad-Abschnitte, davon
18.848 mit eingetragener Oberfläche und 2.574 mit eingetragener Breite. Asphalt,
Pflasterplatten, Setz-/Kopfstein, Feinkies, wassergebundene Decke, Sand, Erde,
Holz und Metall bleiben unterscheidbar. Am Floraplatz
stehen genau die acht dokumentierten Tierbronzen auf Granitsockeln. Hotel AMANO
Grand Central behält OSM-Grundriss und amtliche LoD2-Höhe; der Geschichtspark
Zellengefängnis Moabit behält Parkring, rote Backsteinmauern und Panoptikum auf
ihren exakten OSM-Geometrien sowie die amtliche LoD2-Zelle. Flügel-, Hof-,
Pflanz- und Informationsdetails lesen den heutigen Gedenkpark prozedural, ohne
eine historische Gefängnisanlage oder den geschützten Landschaftsplan zu
rekonstruieren.

2D-Kompatibilitätsansicht ohne Terminal:

1. ZIP entpacken.
2. Doppelklick auf START-HERE.html.
3. Der Viewer öffnet sich im Browser.

Für vollständiges lokales 3D beziehungsweise falls der Browser lokale
Deep-Zoom-Dateien blockiert:

- macOS: siehe start-mac-if-needed.txt und starte `python3 serve-local.py`.
- Windows: Doppelklick auf start-windows.bat.
- Linux: ./start-linux.sh

Der Server-Fallback öffnet eine lokale Adresse im Browser, normalerweise
http://127.0.0.1:8766/index.html. Wenn dieser Port belegt ist, nimmt
er automatisch den nächsten freien Port. Die Terminal-Ausgabe erscheint
sofort und nennt die genaue Adresse. Das Terminalfenster muss geöffnet
bleiben, solange die Website laufen soll. Beenden mit Ctrl+C oder Fenster
schließen.

Warum kein start-mac.command mehr? Apple Gatekeeper blockiert unsignierte,
aus dem Internet geladene .command-Dateien oft mit "Not Opened", bevor sie
überhaupt laufen können. START-HERE.html vermeidet genau diese Falle.

Erweitert: `python3 serve-local.py --no-open --port 8770`

Die Daten stammen aus kostenlosen/offenen Quellen: Berlin LoD2,
Berlin 3D Mesh 2025 (Berlin Partner für Wirtschaft und Technologie GmbH),
OpenStreetMap, ALKIS, DOP-Preview, DGM-Preview und Wikimedia
Commons/Wikipedia. Google/Apple-Kartenprodukte dienen nur als visuelle
QA-Referenz; daraus wird nichts kopiert.

English
-------

This package is a local website with all map data included. It does not need an
AI model or a Google key to run. START-HERE.html is the clearly labelled
zero-server 2D compatibility view, not the complete model. True 3D starts with
start-windows.bat on Windows or `python3 serve-local.py` on macOS/Linux; no
unsigned macOS .command script is shipped. The 2D fallback has the map, zoom/pan,
reference map, and landmark list. It starts with the sharper detail render
and has large buttons for zoom, rotate, swivel/tilt, reset, and Pixel-Art.
Version {PACKAGE_VERSION} also adds Atlas/Cinematic/Lab visual profiles, a
technical map stage, focus ring, and HUD for landmark/zoom/camera state.
Every fresh browser load deterministically advances among the Reichstag,
Federal Chancellery, Hauptbahnhof and Victory Column; an explicit landmark link
wins, and the single clean WebGL restart advances again. In pedestrian mode,
mapped water is a solid shoreline: it cannot be crossed, but it never kills or
resets the walker. OpenSeadragon keeps at most 32 tiles with three loaders on
mobile and 64 with six on desktop. Switching to the 2D map releases WebGL
everywhere; render targets stay within 1.35x / 3.2 MP on touch and 1.75x /
8.5 MP on desktop.
Version {PACKAGE_VERSION} enters pedestrian mode at the exact current camera
focus; the camera position is only a fallback for an invalid focus. The Federal
Ministry for Economic Affairs at Sandkrugbrücke and the Berlin-Spandauer
Schifffahrtskanal gains canal grids, historic Invalidenhaus windows, cornices
and entrances on its official LoD2 shells. On desktop, the progressive Worker
fetches immutable world URLs itself, returns the nearest detail batch first
and transfers bounding spheres together with geometry.
Version {PACKAGE_VERSION} reconstructs Sozialgericht Berlin from the six
supplied facade photographs as a warm ochre 4 + 3 + 4 elevation. The 58.038 m
OSM site boundary remains explicitly separate from the actual 48.905 m LoD2
building wall and its 15.392 m central risalit. Arched windows, biforia, sills,
triangular pediments, oculi, columns, cornices, dentils, floral reliefs and
Portal 52 with six granite steps follow the photographed hierarchy. Three
separate roof-sculpture groups and the bare mast complete the silhouette. The
photographs remain reference-only and are neither bundled nor loaded. Smooth
uses 3 renderables / 30,005 vertices in full and 3 / 19,338 on mobile;
Minecraft adds one instanced batch with 244 or 196 blocks and a complete
3-by-5-pixel address 52.
Version {PACKAGE_VERSION} rebuilds the Beethoven-Haydn-Mozart memorial as its
ten-metre, three-sided, corner-chamfered “Musikerofen”, with granite base,
tinted marble, three round-arched niches and white half figures, pilasters,
masks and instruments, swans, a scaled gilded roof, pinecones and three putti
holding the laurel wreath. Published evidence and procedural local
subdivision remain separate in metadata. The model remains bounded at 30
renderables / 2,847 stored / 7,137 rendered vertices. A dedicated elevated
southern focus keeps the niches, figures and cupola clear of the dense canopy.
In Minecraft, one shared rotated exclusion protects the entire Holocaust
Memorial from voxel trees and from hostile-mob spawn, walkability and motion.
Outside it, streamed deterministic retention keeps two thirds of eligible
voxel trees in the full profile and one third on mobile without expanding a
large intermediate tree list. The single mob instance batch contains four
Creepers, six Zombies and three bow-carrying Skeletons in full, or three, five
and two respectively on mobile. Four full-profile or two mobile loot boxes use
two additional instance batches, open once on pedestrian contact and show a
bounded 1.35-second firework. The protected memorial stays free of trees,
hostile mobs and loot in every profile.
Version {PACKAGE_VERSION} gives Europa-Center, Allianz-Haus, the historic Café
Kranzler and New Kranzler Eck, Bahnhof Zoo, Memorial Church/Breitscheidplatz
and Urania their own source-anchored silhouettes and facade rhythms.
The City-West layer uses four merged ensembles with 11 renderables / 14,634
vertices in full and 11 / 8,427 on mobile.
Friedrichstadt-Palast gains its documented main body, taller stage tower,
projecting foyer, steps, fins and two-storey concrete-glass fields; the
Tränenpalast remains separate as a low steel-and-glass pavilion beside
Friedrichstraße station. Every new detail is batched, image-free and bounded
by separate full/mobile profiles. Friedrichstadt-Palast and Tränenpalast
together use 8 renderables / 439 instances / 5,329 stored / 16,873 rendered
vertices in full and 8 / 393 / 3,477 / 13,365 on mobile.
Version {PACKAGE_VERSION} keeps the temporary FUNBOX completely on its display
lot between Heidestraße, Minna-Cauer-Straße and Döberitzer Straße. Its drawn
and Minecraft envelopes retain at least 2.553 m clearance from the delivered
OSM-derived road surfaces, stay clear of the northern Tiergartentunnel portal
and every source voxel building, and use the same structural Minecraft
footprint in full and mobile profiles. FUNBOX remains exactly 5 drawn
renderables / 7,921 rendered vertices and 62 Minecraft blocks. visitBerlin
supplies the official location, dates, scale and programme; the fitted envelope
is procedural, non-surveyed display geometry.
Version {PACKAGE_VERSION} gives the Geschichtspark Zellengefängnis Moabit a
source-bound present-day memorial model with red-brick walls. Its 22-point park
ring, 19 wall segments and Panoptikum follow exact OSM geometry. Four segments
retain the explicit 4 m from OSM way 105495351; the other 15 use Berlin's
general 5 m wall statement only as a display value. Official LoD2 cell
DEBE01AL2yz00000 remains visible without a second shell, and existing lawn,
path and tree data are not duplicated. Smooth uses 5 renderables / 7,818
vertices in full and 5 / 5,448 on mobile. Minecraft uses one batch in each
profile: full 3,882 blocks / 93,168 rendered instance vertices, mobile 2,093 /
50,232. Day, Night, Snowstorm and Schwellenraum share the drawn model;
Minecraft substitutes its block-native counterpart. Fine internal dimensions
are procedural and non-surveyed. Normal walking collision keeps all three
mapped entrance gaps and the cell approach open; Schwellenraum retains
whole-park protection. The protected landscape plan is neither
traced nor bundled; no photograph, canvas image, thumbnail or photographic
texture is loaded. The sourced remembrance context for opponents imprisoned
during National Socialism, including Albrecht Haushofer, remains attached to
the present-day park without rebuilding the demolished prison.
Version {PACKAGE_VERSION} anchors the Richard-Wagner-Denkmal as the 90th
navigable sight at exact OSM node 243487615 and binds its identity to
Landesdenkmalamt part object 09046318,T,041. The false closed LoD2 shelter
SR00009n and its six solid Minecraft columns are removed. Day, Night,
Snowstorm and Schwellenraum instead use a dedicated open, texture-free
memorial model; Minecraft substitutes a block-native counterpart. Smooth uses
exactly 6 renderables and 12,167 rendered vertices, while Minecraft is exactly
one batch with 514 blocks. Front, rear, side and high under-roof approaches
remain open; granular collision follows only the represented marble and steel
solids. Source facts are the position, official identity and published overall
and figure heights. Local figure segmentation, roof section, component
spacing, orientation and collision volumes are non-surveyed display values.
No reference photograph, thumbnail or photographic texture is bundled or
loaded.
Version {PACKAGE_VERSION} makes Weidendammer Brücke selectable as sight 91.
Exact OSM way 6228081 controls its centre and axis; Berlin's bridge inventory
controls the current 69.48 x 25.17 m envelope, and Landesdenkmalamt object
09030074 controls the protected three-opening and ornamental system. Exactly
one neo-Baroque railing system carries two forged central eagle reliefs and
eight lamp standards. The many love locks are a deterministic present-day
display, not an individual inventory: 192 in full and 96 on mobile. Smooth
uses 5 renderables / 46,568 stored / 90,116 rendered vertices in full and 5 /
32,744 / 54,404 on mobile. Minecraft replaces the smooth ornament with one
batch using 344 blocks / 8,256 rendered instance vertices, or 224 / 5,376 on
mobile. Roadway, pavements and approaches stay walkable. Biermann's cultural
association with the bridge eagle remains metadata; no song lyric, photograph,
plan or texture is copied or loaded.
Version {PACKAGE_VERSION} gives the Max-Liebermann-Haus, French Embassy, US
Embassy and Akademie der Künste four separate source-bounded facades over their
retained LoD2/OSM bodies. Drawn variants carry their characteristic window,
stone, entrance, glass and circulation rhythms in Day, Night, Snowstorm and
Schwellenraum; Minecraft uses one coarse opaque block signature. Every detail
is code-native, non-surveyed and free of photographic facade textures.
Version {PACKAGE_VERSION} also reconstructs Goethe and Lessing at their exact
OSM nodes as separate, source-bound Tiergarten memorials. Snow-free Goethe is
6.08 m high and retains 42 fence fields plus three paired groups with six
allegorical figures. Snow-free Lessing is 7.00 m high and retains five steps,
two basins with dolphin spouts, three portraits and two principal bronze
allegories. Its visible model, Minecraft reading and physical collision share
the same chamfered octagon with 28 fence fields across eight segments. Day,
Night, Snowstorm and Schwellenraum use the drawn models; Minecraft suppresses
them in favour of a block-native reading. Together, Smooth Snowstorm uses
exactly 8 renderables and 24,870 rendered vertices; Minecraft uses one
InstancedMesh with 557 blocks and 13,368 rendered vertices, for 9 stored
renderables overall. Protection radii of 4.3 m and 2.95 m keep the memorials
closed while core and fence-side collision leaves all eight sampled approach
directions open.
Version {PACKAGE_VERSION} also deepens the former Sony Center Forum with its
24-part roof plan, ring lattice, cables, tilted kingpost, seven supports,
clamps, light, articulated glass facades and fountain. TIPI am Kanzleramt keeps
the published 32 x 26 m envelope but gains an eight-peak roof, 48 ribs,
entrance, foyer and side pavilions. The fictional `PIGOR & EICHHORN` viewer
headline was authored by the user/project owner, not by the venue, and stays
legible in all five modes, including separate Minecraft block lettering. The
presentation-only `NUR HEUTE ABEND` line remains in the four drawn modes and is
not duplicated in Minecraft.
Version {PACKAGE_VERSION} reduces the Berliner Ensemble open roof ring to a
photo-bounded 4.8 m and turns it once every 120 seconds in all five modes.
Motion is capped at 12 Hz without touch or 8 Hz in the mobile-like touch
profile and freezes for reduced-motion, distant, hidden, off-screen or
underside views. The Brecht memorial, selectable as sight 92, gains the complete
slightly over-life-size seated figure with coat folds, hands and feet on its asymmetric open metal
bench, the six-metre circular sett platform and three cylindrical,
horizontally jointed black-stone steles. Peter Flierl is credited for the
installation design, Fritz Cremer for the sculpture and Carlo Wloch for
stonework/steles. The platform stays walkable outside the figure, bench and
steles; Minecraft uses a separate deterministic 4-batch / 197-block reading
without a smooth double. Full and mobile Smooth use 3 renderables / 24,840
stored and rendered vertices; Minecraft renders 4,728 instance vertices. The
14 m camera targets the exact anchor and fine anatomy fades at 34/105 m. The
poem and quotations are not reproduced;
incision cues remain non-legible. `Eine Skulptur für Helene Weigel`, unveiled
on 10 May 2026, appears as a transparent glass cube on a white plinth. Its
central red folding director's chair retains two clearly visible crossed
scissor frames, surrounded by the folded red chair/object landscape,
light/audio elements and visible cable runs. A large black procedural raster
portrait sits on the glass. No press photograph, portrait crop or portrait
texture is bundled or loaded.
Minecraft lets exactly four Creepers, six Zombies and three bow-carrying
Skeletons roam deterministic, retained-tree-cleared and memorial-protected
grass routes in the full profile; mobile uses three, five and two. Every
profile keeps the mob field to one draw call and hides it outside Minecraft.
Version {PACKAGE_VERSION} also adds the new CSD memorial place at exact OSM
node 14076715427, separately from the existing Queer Rainbow memorial model.
Its French maple, already leafed young crown, round metal guard, sparse static
Pride flags, wreaths and cards, and rainbow bench remain visible in Day, Night,
Minecraft, Snowstorm and Schwellenraum. Only the source anchor and published
descriptive facts are fixed; all local dimensions and arrangements are
photo-bounded, non-surveyed display values. No photograph or screenshot is
bundled. It remains outside the 93-place catalogue and is not a 94th tour stop.
Version {PACKAGE_VERSION} moves 1,093 traffic-signal poles to deterministic
exterior verges: 1,092 source points in the modelled carriageway plus one
decimetre edge case. 227 already-safe poles stay at source. Schema 7 retains
all 1,328 source OSM nodes and their
backwards-compatible raw coordinates. Eight directly sourced
crossing:island=yes signals remain source-exact on a visible small refuge base;
unverified road-network gaps never count as islands. After decimetre
quantisation, every moved pole stays at least 0.5 m clear of the road. No
signal is removed. A schema-specific cache query prevents stale schema-6 data
from masking the correction.
Version {PACKAGE_VERSION} gives exactly nine official state flags a gentle
flutter in Day, Night, Minecraft, Snowstorm and Schwellenraum: three German
and one European flag on the Reichstag, the German and European protocol flags
at the Chancellery, the Flag of Unity, the Swiss flag and the Federal
President's standard. Their 30 cloth and emblem layers move no more than 0.28 m
at the free edge, at most 12 Hz without touch or 8 Hz in the mobile-like touch
profile. Reduced-motion, distant, underside and hidden-page views hold one
authored pose. Snowstorm applies reversible frost while exactly 27 batched
icicles follow the same gentle wind. Minecraft retains blocky masts but shows
the moving cloth without static block duplicates. The former extra monument
copy of the Flag of Unity is removed while its OSM source identity remains in
the dedicated metric model.
Version {PACKAGE_VERSION} aligns Hotel Adlon and Starbucks to their real
Pariser-Platz frontages. Adlon follows OSM relation 4582978, outer way
26041943 and LoD2 body K00006ot; arches, rustication, wine-red entrance canopy,
balcony bands, patinated mansard, dormers, flags and open roof lettering form
a static, source-bound recognition layer. Starbucks follows OSM node 66917229
around the south-west corner of LoD2 body K00005Hq: two shallow glass fronts,
grey facade lettering and freestanding black terrace cues replace the former
diagonal green fascia. Minecraft uses one shared coarse, opaque block
signature. Four openly licensed references are attributed in the public source
package; no photograph is bundled or projected as a facade texture.
Version {PACKAGE_VERSION} renders Scharnhorst's grave, selectable as sight 93,
at exact OSM node 273120316 to the 5.60 m overall height published by the
Berlin-Lexikon: Schinkel's two architectural piers and iron railing frame the
high Carrara-marble sarcophagus, Tieck relief
frieze and a genuinely reclining bronze lion instead of an ellipsoid. Christian
Daniel Rauch modelled the lion and Theodor Kalide executed it; the Schinkel
portal identifies the present sarcophagus and frieze as conservation copies.
The structural lion remains legible after close-only mane, face and claw detail fades. Full
and mobile Smooth use 8 renderables / 554 stored / 15,539 rendered vertices;
Minecraft contributes 4 batches / 566 blocks / 13,584 rendered instance
vertices. The 18 m camera targets the exact anchor and the space between the
piers stays walkable. The
Invalidenfriedhof also distinguishes the characteristic Witzleben, Winterfeld, Kessel and Rauch
monuments, open-framed Auguste-Viktoria bell, and separate canal and Hinterland
Wall layers. The independent former GDR command tower at Kieler Eck is
reconstructed as the Günter Litfin memorial from official monument, OSM and
LoD2 anchors. Every new detail remains static; Minecraft uses separate block
forms. Paths and open bell-frame bays remain walkable, repeated fine members
are batched, and the supplied photographs remain unbundled references rather
than textures or survey evidence.
The four shipped landmark catalogues synchronously contain 93 places. All 41
relative-placement contracts and the three established manual-review anchors
remain intact; records 90–93 are Richard Wagner, Weidendammer Brücke, Bertolt
Brecht and Scharnhorst.
It now includes a bilingual German/English switch and a Day/Night mode.
Night mode overlays lit windows for the Reichstag, Federal Chancellery and
Hauptbahnhof, a light cone at Brandenburg Gate, monument accents,
Tiergarten/Pariser Platz street lamps and stronger tunnel lighting.
Version {PACKAGE_VERSION} also adds a scene-detail layer with two translucent
isometric clouds, southwest late-afternoon sunlight, cloud shadows, water-depth
accents, tunnel branch hints, an ICE, an S-Bahn, cars with night light beams,
flags, a Spree tour boat, Pariser Platz visitors / pedicab cues and
Zollpackhof / Gustav-Heinemann-Brücke beer-garden details.
Details and clouds can now be toggled separately and the choices are saved with
the other offline preferences. Keys G and C switch those layers directly. While
dragging, the viewer reduces costly SVG filters so pan/rotate/swivel feels
lighter. This version also adds glass glints for the Reichstag, Hauptbahnhof
and Chancellery, water ripples, Tiergarten tree clusters and small path accents.
Version {PACKAGE_VERSION} adds a saved Lite mode on key P. It reduces expensive
shadows, filters and cloud animation. Window resizing now preserves focus, zoom,
rotation, swivel and underside view instead of snapping back to the overview.
Version {PACKAGE_VERSION} can also start with URL parameters such as
`START-HERE.html?lite=1&details=0&clouds=0` or
`START-HERE.html?lang=en&theme=night`. If the sharper detail image cannot be
loaded locally, the viewer automatically falls back to the pixel image.
Language, Day/Night, visual profile, Pixel-Art/detail-image selection, last
focused landmark and view angle are stored locally in the browser and restored
on the next open. If a browser blocks localStorage, START-HERE.html still
starts with defaults.
The Tiergartentunnel is an underground rectangular structure with two tubes,
side walls, a centre wall, warm lighting dots, ventilation / shaft markers,
and cross-section markers. It stays hidden from above and appears only in the
underside view. Starting with v0.1.49, the geometry uses
derived OSM B96 tunnel ways as carriageway evidence and remains an engineering
approximation; it is not yet official surveyed as-built geometry.
Version {PACKAGE_VERSION} further shapes the tunnel with an underside mode,
portal frames, ceiling ribs, lane/tube marks and service bays that stay attached
while the map is rotated, swivelled and panned.
Mouse: drag to pan; in "Drehen/Swivel" mode, with Shift-drag, or with
right-drag you rotate and swivel the map. Top/North/East/South/West presets
and a compass line make viewpoints reproducible. Unterseite focuses the tunnel
from below; Tunnel-Fokus zooms onto the route. Keys U and F switch these views,
and 1/2/3 switch the visual profiles. L toggles language, D selects Day and M
selects Night. The Advanced Viewer is still included,
but may need the local-server fallback depending on the browser.
Touchscreen: one finger pans the map; two fingers pinch-zoom, twist-rotate and
pan around the touch midpoint. Views within four degrees of 0/90/180/270 snap
to the exact cardinal. On iPhone, iPad, Android tablets and other touch devices
the viewer uses larger controls, safe viewport heights and a compact lower
control sheet.

The Advanced Viewer starts with a true Three.js scene derived from the
official Berlin 3D Mesh 2025. Left-drag pans directly, a stepped mouse wheel
zooms at the pointer, and right-drag orbits. On a trackpad, two-finger scroll
pans while pinch zooms around its midpoint. On touch devices, a two-finger
centre swipe pans while pinch zooms around that midpoint; three fingers
control azimuth and polar tilt into a real below-ground view. Arrows pan in the
visible screen plane; WASD flies relative to the view heading, Space rises and
Shift descends, while Alt/Option plus arrows orbits and tilts. Walking also uses
WASD; one Space jumps to 6.2 m and a second press within 320 ms raises that same
jump once to 10.5 m. Three quick presses of the same arrow or WASD key toggle
the dedicated 8x fast run; Shift or two forward presses retain the 4x sprint.
In underside mode the
surface becomes transparent and reveals the two-tube Tiergartentunnel cutaway
with lighting and ventilation. Only the selected landmark gets a brief focus
ring; permanent coloured dots no longer cover the buildings. The Advanced
Viewer has direct Day, Night and Minecraft controls and a complete DE/EN
switch. B or the speaker button starts/stops seven locally synthesized 8-bit
ambient variants. T or the note button controls the independent procedural
`Dusk Republic` soundtrack, whose enabled intent resets on each reload. Modern
browsers may require the first click, touch or key gesture before either layer
becomes audible. D toggles Day/Night and M toggles Minecraft.

In version {PACKAGE_VERSION}, Minecraft's principal architecture is
deliberately coarser and more block-like: fewer than 5,000 signature blocks
follow an 8 m hero raster. Retained Reichstag, Chancellery and parliamentary
source bodies are split vertically into block courses no taller than 8 m;
smooth architectural overlays stay hidden in Minecraft. Existing entrance
portals, open passages and free orbit, pan, zoom, flight and pedestrian
navigation remain available.

Version {PACKAGE_VERSION} bounds Minecraft in the mobile-like touch profile,
which applies when the primary or any pointer is coarse or
navigator.maxTouchPoints > 0. The earlier pre-retention benchmark measured
845,561 instances / 63.265 MiB of instance buffers on mobile and 3,419,412 /
249.815 MiB in full; current 1/3 and 2/3 tree retention makes these conservative
upper bounds. Only the mobile profile omits generic facade panes and meadow
flowers and collapses non-Hero source columns; Hero courses up to 8 m,
signatures and navigation remain. Every WebGL profile uses no renderer MSAA, a
0x UnsignedByte composer and one final SMAA pass. Inactive world builds are canceled, failed
voxel attachment rolls back, and smooth park details remain hidden without
toon clones in voxel mode. This is benchmark/browser QA, not validation on a
physical iOS device.

The same mobile-like touch drawn profile keeps exact geometry for the nearest
5,000 LoD2 buildings. After the first 320-building frame, its delayed Worker
receives only the source URL and initial count, fetches the source itself,
transfers all eligible farther buildings first as measured, oriented,
source-coloured instance shells in one draw call, and then immediately covers
the remaining 4,680 near-field records with small oriented instance previews.
Each exact building batch replaces only its own preview. The main thread clones
no city, ground or surface payload, and the Worker creates no exact
`surface-*` families.
Raster ground,
water and asphalt plus the complete authored park-path network preserve the map
context. ParkDetails starts afterwards. With the tunnel in production, the touch
profile measures 107,199 instances and 11,639,110 bytes of geometry plus
instance buffers; the non-touch settled production profile measures 499,952
instances and 44,062,710 bytes. The frozen comparison contract excludes tunnel
and settled detail and remains 107,237 instances / 72 drawables / 11,641,638
bytes touch versus 450,029 / 1,478 / 40,221,966 bytes full.
Hidden tabs stop partial refinement and restart it cleanly when visible. A cold
Minecraft start neither builds nor loads ParkDetails in either profile and does not request
surface-polygons.json. That file remains deferred until a transition to a drawn
mode or until pedestrian mode needs water collision. The
first actual switch to any drawn mode starts the idempotent park-detail
construction. The touch profile retains only the active drawn or Minecraft
world family.
In every profile, a WebGL runtime failure receives exactly one clean restart; a
second failure shows Recovery and 2D-map choices explicitly. Non-touch desktop
keeps complete architecture while deterministically retaining two thirds of
its Minecraft trees as well.

Version {PACKAGE_VERSION} starts Day, Night and Snow from a compact terrain
context instead of photographic GLBs. On non-touch desktop, the official
{base_faces_en}-face shell loads only for real failure recovery; every
underside view and every mobile-like touch session remains photo-free. The
archived {settled_faces_en}-face tier is not requested during
normal navigation. Minecraft buildings and trees remain lazy until that mode
is selected. Failed
JSON transfers retry once and stop cleanly after 45 seconds. Every device
releases inactive 3D when switching to the 2D map; desktop keeps it warm only
while moving between live 3D modes. Lost pointer capture, window
focus, global pointer release and a ten-second watchdog prevent stuck input.
The backing-store resolution likewise stays unchanged throughout input and
momentum. Before opening the browser,
serve-local.py checks all {scene_counts["glb_files"]} GLB hashes. Its HTTP/1.1 cache reuses immutable
models, map tiles and app assets
instead of transferring the complete scene again.

This version also refines the metric architectural rendering pass: LoD2
footprints remain the metre-scale anchor. The June 2025 Berlin aerial survey
now adds real photogrammetric roof, terrain and facade surfaces. Reichstag,
Chancellery, Hauptbahnhof and Brandenburg Gate use separate high-resolution,
LoD2-masked texture models up to 1600 px per material segment. Metre-scale
recognition models add the Reichstag west portico, towers and 40 x 23.5 m dome;
the Chancellery 36 m cube and LoD2-aligned 18 m bands; Hauptbahnhof's 321 m
glass roof, 180 x 42 m crossing hall and 46 m frames; and the 62.5 x 11 x 26 m
Brandenburg Gate with twelve columns and a patinated Quadriga. The official
photographic shell remains bundled as a failure-only fallback for non-touch
desktop rather than loading underneath the ordinary drawn city; every
underside view and every mobile-like touch session stays photo-free.

The central Chancellery building now reveals its externally visible spatial
sequence behind cool transparent glass: split gallery plates around a 14.4 m
atrium, three bridges, a two-flight stair, rails and a few abstract furniture
and planting groups. At night, only sparse interior panels plus linear gallery,
lobby, ceiling and roof-soffit lights glow warm; the glass itself remains dark
and transparent. These cues follow the six supplied exterior views but are not
a surveyed or security-relevant floor plan. The photographs are neither
bundled nor projected as textures.

The official Berlin Vorderlandmauer geometry remains unchanged but now reads
as two visible rows of individual dark granite setts above the drawn road and
plaza plates. This makes the documented semicircle west of Brandenburg Gate
legible. Curved strokes that remain wholly inside mapped water polygons also
replace the former straight water dashes; both details are static and cannot
introduce shimmer.

At Spreebogen, exact OSM axes now carry stone river edges, the raised
Panoramaweg on rectangular supports and the staggered Gartenspur slabs.
Gustav-Heinemann-Brücke shows its pale-sage 2.25 m Vierendeel frame around the
timber path; Hugo-Preuß-Brücke its deep, curved and centre-pier-free steel box.
At Potsdamer Platz, 28 official light positions anchor a present-day pedestrian
axis with batched paving and furniture details without duplicating the existing
lamp layer.

Version {PACKAGE_VERSION} extends the visible radius to 6,450 m and carries the
additional 500 m data ring on every side in {scene_counts["base_files"]} official interaction
tiles. Futurium now follows its exact Berlin LoD2 footprint and height, while
its cassette skin, panoramic end windows, roof basin, solar field, Skywalk and
Drehmoment are source-bounded recognition details. Moltkebrücke follows its
OSM centreline and published 77.58 x 25.70 m dimensions. Detailed OSM path
ribbons now cover every bounded park area, including Spreebogenpark,
Futurium's public realm and Nordhafenpark. Recognition details remain
explicitly labelled metric display approximations.

The current Federal Chancellery extension across the Spree follows its OSM
construction footprints and the officially published April 2026 stage. The
largely completed shell, installed South Bridge and technical fit-out are
source-bounded; scaffold, cranes, fencing, barriers and material storage remain
explicitly labelled static display approximations.

The underside also reveals the real OSM plan network of underground mainline,
S-Bahn and U-Bahn tracks, platforms and entrances. U5 and the shared
S1/S2/S25/S26 North-South corridor carry restrained route colours; depths,
tunnel sections and straight entrance shafts remain explicitly schematic. No
invented utility pipes are shown. Surface tram contact wires follow OSM
courses, with approximate height and mast rhythm. A few static people, BVG
buses, cars, bicycles, e-scooters and strollers provide scale without claiming
observed traffic.

The complete bounded OSM path network is also drawn as terrain-following
surface geometry: 20,782 footway, cycleway, path, pedestrian, step and track
parts, including 18,848 mapped surfaces and 2,574 mapped widths. Asphalt,
paving slabs, granite setts, fine gravel, compacted cover, sand, earth, timber
and metal remain distinct. Floraplatz contains the
documented eight animal bronzes on granite plinths. Hotel AMANO Grand Central
retains its OSM plan and official LoD2 height, while the former Moabit prison
park keeps its ring, red-brick walls and Panoptikum on exact OSM geometry and
retains the official LoD2 cell. Wing, yard, planting and information details
read the present-day memorial park procedurally without reconstructing the
historic prison or the protected landscape plan.

2D compatibility view without Terminal:

1. Unzip the package.
2. Double-click START-HERE.html.
3. The viewer opens in your browser.

For full local 3D, or if your browser blocks local Deep Zoom files:

- macOS: read start-mac-if-needed.txt and run `python3 serve-local.py`.
- Windows: double-click start-windows.bat.
- Linux: ./start-linux.sh

The server fallback opens a local browser address, usually
http://127.0.0.1:8766/index.html. If that port is busy, it automatically
uses the next free port. Terminal output is flushed immediately and prints the
exact address. Keep the terminal window open while the website is running.
Stop with Ctrl+C or close the window.

Why no start-mac.command? Apple Gatekeeper often blocks unsigned
downloaded .command files with "Not Opened" before they can run.
START-HERE.html avoids that trap.

Advanced: `python3 serve-local.py --no-open --port 8770`

Data sources are free and open: Berlin LoD2, Berlin 3D Mesh 2025 (Berlin
Partner für Wirtschaft und Technologie GmbH), OpenStreetMap, ALKIS, DOP
preview, DGM preview, and Wikimedia Commons/Wikipedia. Google/Apple map
products are used only as visual QA references; nothing from them is copied.

Attribution:
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0) · 3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH

Per-file Wikimedia credits are bundled at
dzi/regierungsviertel/wikimedia_attribution.json.
The five Kindertransport reference-photo credits are bundled at
dzi/regierungsviertel/visual_reference_attribution.json.
""",
    encoding="utf-8",
  )


def write_package_manifest(package_dir: Path) -> None:
  """Write machine-readable release metadata for local package QA."""
  dzi_root = package_dir / "dzi" / "regierungsviertel"
  mesh_root = package_dir / "mesh" / "regierungsviertel"
  surface_manifest_path = mesh_root / "surface-pretriangulation.json"
  try:
    surface_manifest = json.loads(surface_manifest_path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError) as exc:
    raise SystemExit(f"Cannot inventory progressive surface assets: {exc}") from exc
  if not isinstance(surface_manifest, dict):
    raise SystemExit("Cannot inventory progressive surface assets: invalid manifest")
  source_file = surface_manifest.get("source_file")
  plates = surface_manifest.get("plates")
  if (
    source_file != "surface-polygons.json" or not isinstance(plates, list) or not plates
  ):
    raise SystemExit("Cannot inventory progressive surface assets: incomplete manifest")
  surface_asset_paths: dict[str, Path] = {}
  seen_surface_kinds: set[str] = set()
  for entry in plates:
    if not isinstance(entry, dict):
      raise SystemExit("Cannot inventory progressive surface assets: invalid plate")
    kind = entry.get("kind")
    relative = entry.get("file")
    if (
      not isinstance(kind, str)
      or kind in seen_surface_kinds
      or not isinstance(relative, str)
      or Path(relative).name != relative
      or not relative.endswith(".plate.gz")
    ):
      raise SystemExit("Cannot inventory progressive surface assets: unsafe plate")
    seen_surface_kinds.add(kind)
    surface_asset_paths[f"surface_plate_{kind}"] = mesh_root / relative
  asset_paths = {
    "detail_image": dzi_root / "overview_source.png",
    "pixel_image": dzi_root / "overview.png",
    "dzi_descriptor": dzi_root / "regierungsviertel.dzi",
    "reference_map": dzi_root / "reference_map.png",
    "landmarks": dzi_root / "landmarks.json",
    "tiergartentunnel_overlay": dzi_root / "tiergartentunnel.json",
    "visual_reference_attribution": (dzi_root / "visual_reference_attribution.json"),
    "wikimedia_attribution": dzi_root / "wikimedia_attribution.json",
    "webgl_scene": mesh_root / "scene.json",
    "ground_context": mesh_root / "ground-context.json",
    "surface_source": mesh_root / str(source_file),
    "surface_pretriangulation": surface_manifest_path,
    **surface_asset_paths,
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
    "start_page_mode": "2d-compatibility-fallback",
    "full_3d_start_page": "index.html",
    "preferred_image": "dzi/regierungsviertel/overview_source.png",
    "optional_pixel_image": "dzi/regierungsviertel/overview.png",
    "dzi_descriptor": "dzi/regierungsviertel/regierungsviertel.dzi",
    "uses_google_content": False,
    "scope": "Berlin Regierungsviertel bounds only",
    "render_mode": (
      "drawn LoD2 city with demand-only official WebGL and source-detail DZI fallback"
    ),
    "controls": [
      "mouse-pan",
      "mouse-rotate-swivel",
      "touch-pinch-pan-rotate",
      "touch-three-finger-underside-orbit",
      "touch-two-finger-direct-pan-midpoint-pinch-zoom",
      "true-threejs-3d-orbit",
      "exact-current-view-pedestrian-spawn",
      "cancelable-progressive-model-loading",
      "demand-only-photogrammetry-fallback",
      "mobile-like-touch-no-photogrammetry-fallback",
      "touch-capability-mobile-profile",
      "mobile-complete-building-progressive-worker",
      "desktop-worker-url-payloads-spatial-batches",
      "hidden-tab-progressive-pause-and-restart",
      "sequential-mobile-progressive-and-park-build",
      "mobile-family-keyed-single-world-residency",
      "single-clean-webgl-runtime-recovery",
      "explicit-recovery-or-2d-after-repeat-failure",
      "minecraft-defers-surface-polygons-until-drawn-or-pedestrian",
      "economic-ministry-canal-invalidenhaus-details",
      "timeout-and-retry-json-loading",
      "http11-immutable-heavy-asset-cache",
      "keyboard-arrow-screen-plane-pan",
      "keyboard-wasd-heading-flight",
      "keyboard-space-rise-shift-descend",
      "pedestrian-space-jump-double-space-high-jump",
      "alt-arrow-orbit-tilt",
      "fallback-shift-drag-rotate-swivel",
      "top-north-east-south-west-presets",
      "atlas-cinematic-lab-visual-profiles",
      "bilingual-de-en-ui",
      "direct-day-night-minecraft-snowstorm-modes",
      "contextual-rain-or-snowfall-toggle-in-all-surface-modes",
      "native-and-ios-safe-pseudo-fullscreen",
      "manual-tiergartentunnel-entry-both-directions",
      "minecraft-roaming-creepers-zombies-and-skeletons",
      "opt-in-seven-variant-procedural-audio",
      "persistent-offline-viewer-preferences",
      "persistent-last-landmark-and-view",
      "selected-landmark-focus-ring",
      "selected-landmark-only-marker",
      "instrument-hud",
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
      "Bildhauerei in Berlin (CC BY 4.0) · "
      "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH"
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
      if path.is_file() and should_package_file(path):
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
          if not path.is_file() or not should_package_file(path):
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
  ensure_public_dzi_metadata_copied(public_source, package_dir)
  ensure_dzi_tiles_copied(source, package_dir)
  ensure_dzi_tiles_copied(public_source, package_dir)
  compact_packaged_dzi(package_dir)
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
