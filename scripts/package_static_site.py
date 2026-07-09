"""Package the static Isometric Berlin viewer for local download/use.

The output is a folder and ZIP archive under ``releases/``. It contains
the built React/OpenSeadragon app, all DZI tiles, a double-clickable
HTML entry point, and optional local-server fallbacks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import zipfile
from pathlib import Path

PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"
PACKAGE_VERSION = "0.1.55"
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
START_PAGE = "START-HERE.html"
REQUIRED_PACKAGE_FILES = (
  START_PAGE,
  "README.txt",
  "dzi/regierungsviertel/overview_source.png",
  "dzi/regierungsviertel/regierungsviertel.dzi",
)


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
    print(f"[viewer] {self.address_string()} - {format % args}", flush=True)


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


def require_package_files(root: Path) -> None:
  missing = [relative for relative in REQUIRED_PACKAGE_FILES if not (root / relative).exists()]
  if not missing:
    return
  for relative in missing:
    print(f"Missing package file: {relative}", flush=True)
  raise SystemExit("This local viewer package is incomplete. Download the ZIP again.")


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
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
      overflow: hidden;
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
      min-height: 100vh;
    }
    .stage {
      position: relative;
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
      transform-origin: 50% 50%;
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
      width: 86px;
      height: 86px;
      margin-left: -43px;
      margin-top: -43px;
      border: 2px solid var(--gold);
      border-radius: 50%;
      box-shadow:
        0 0 0 1px rgba(16, 22, 22, .55),
        0 0 0 12px rgba(241, 200, 75, .15),
        0 0 28px rgba(31, 138, 165, .42);
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
      width: 116px;
      height: 1px;
      margin-left: -58px;
      background: rgba(241, 200, 75, .74);
    }
    .focus-ring::after {
      width: 1px;
      height: 116px;
      margin-left: 0;
      margin-top: -58px;
    }
    @keyframes focusPulse {
      0%, 100% { transform: scale(.96); opacity: .82; }
      50% { transform: scale(1.06); opacity: 1; }
    }
    .marker {
      position: absolute;
      width: 18px;
      height: 18px;
      margin-left: -9px;
      margin-top: -9px;
      border: 2px solid #fff8e7;
      border-radius: 50%;
      background: #9f3434;
      box-shadow: 0 2px 6px rgba(0, 0, 0, .28);
      cursor: pointer;
    }
    .marker[data-role="hero_tile"] { background: #155d73; }
    .marker[data-role="owner_added"] { background: #5f6d39; }
    .marker[data-priority="true"] {
      width: 22px;
      height: 22px;
      margin-left: -11px;
      margin-top: -11px;
      border-color: #fff8e7;
      background: #155d73;
      box-shadow:
        0 0 0 4px rgba(21, 93, 115, .32),
        0 0 0 9px rgba(192, 138, 70, .16),
        0 8px 18px rgba(0, 0, 0, .36);
    }
    .marker.active {
      background: var(--gold);
      border-color: #1b2422;
      box-shadow:
        0 0 0 4px rgba(255, 255, 255, .7),
        0 0 0 10px rgba(241, 200, 75, .32),
        0 10px 22px rgba(0, 0, 0, .38);
    }
    .marker:focus-visible { outline: 3px solid #111; outline-offset: 2px; }
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
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 12px;
      padding: 16px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, .9), rgba(255, 250, 240, .96)),
        var(--panel-bg);
      min-height: 100vh;
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
    body[data-theme="night"] .notice {
      color: #c5d0c8;
      border-top-color: rgba(247, 215, 122, .22);
    }
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
      .shell { grid-template-columns: 1fr; grid-template-rows: minmax(65vh, 1fr) auto; }
      aside { min-height: 0; max-height: none; }
      .list { max-height: 280px; }
      .hud {
        max-width: calc(100% - 28px);
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
        <div id="markers"></div>
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
        <p class="sub" id="subtitle">Offline-Start ohne Terminal. Verschieben, zoomen, drehen und swiveln direkt mit Maus oder Buttons.</p>
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
        <a class="button wide" id="advanced-link" href="index.html">Advanced Viewer nur mit Server-Fallback</a>
      </div>
      <p class="hint" id="hint"><strong>Direktsteuerung:</strong> Maus ziehen verschiebt. Shift+ziehen oder Modus „Drehen/Swivel“ dreht und kippt. Atlas/Cinematic/Lab ändern Kontrast, Bühne und Lesbarkeit.</p>
      <div class="list" id="landmarks" aria-label="Landmarken"></div>
      <p class="notice" id="notice">
        Diese START-HERE-Datei ist der robuste Offline-Viewer. Der Advanced Viewer ist
        nur Plan B für Serverstart und kann beim direkten Öffnen aus dem Ordner blockieren.
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
    const image = payload.image || { width: 2157, height: 1529 };
    const landmarks = [...(payload.landmarks || [])].sort((a, b) => {
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
    const markerRoot = document.getElementById("markers");
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
      quality: document.getElementById("quality"),
      reset: document.getElementById("reset"),
      reference: document.getElementById("reference"),
      advancedLink: document.getElementById("advanced-link"),
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
        subtitle: "Offline-Start ohne Terminal. Verschieben, zoomen, drehen und swiveln direkt mit Maus oder Buttons.",
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
        pixelArt: "Pixel-Art",
        detailImage: "Detailbild",
        reset: "Reset",
        reference: "Top-down-Referenzkarte",
        advanced: "Advanced Viewer nur mit Server-Fallback",
        hintPan: "<strong>Direktsteuerung:</strong> Maus ziehen verschiebt. Shift+ziehen oder Modus „Drehen/Swivel“ dreht und kippt. G schaltet Details, C schaltet Wolken. Tag/Nacht schaltet beleuchtete Fenster, Laternen, Denkmäler und Tunnellicht.",
        hintRotate: "<strong>Drehmodus:</strong> Maus gedrückt halten und bewegen. Links/rechts dreht, hoch/runter swivelt. Unterseite zeigt den Tiergartentunnel von unten. Beim Ziehen reduziert der Viewer teure Detailfilter.",
        notice: "Diese START-HERE-Datei ist der robuste Offline-Viewer. Der Advanced Viewer ist nur Plan B für Serverstart und kann beim direkten Öffnen aus dem Ordner blockieren.",
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
        landmarkFallback: "Landmarke",
        zoom: "Zoom",
        swivel: "Swivel",
      },
      en: {
        documentTitle: "Start Isometric Berlin",
        stageLabel: "Isometric map",
        subtitle: "Offline start without Terminal. Pan, zoom, rotate and swivel with the mouse or buttons.",
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
        pixelArt: "Pixel art",
        detailImage: "Detail image",
        reset: "Reset",
        reference: "Top-down reference map",
        advanced: "Advanced viewer, server fallback only",
        hintPan: "<strong>Direct control:</strong> Drag to pan. Shift-drag or Rotate/Swivel mode rotates and tilts. G toggles details, C toggles clouds. Day/Night toggles lit windows, street lamps, monuments and tunnel lighting.",
        hintRotate: "<strong>Rotate mode:</strong> Hold the mouse button and move. Left/right rotates, up/down swivels. Underside shows the Tiergarten tunnel from below. While dragging, the viewer reduces costly detail filters.",
        notice: "This START-HERE file is the robust offline viewer. The Advanced Viewer is only a fallback for server start and may be blocked when opened directly from the folder.",
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
    const savedPreferences = readPreferences();
    const DEFAULT_FOCUS_LANDMARK = "Bundeskanzleramt";
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
      viewKey: savedChoice(savedPreferences, "viewKey", ["top", "north", "east", "south", "west", "free"], "top"),
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
      pixel: savedPreferences.pixel === true,
      profile: savedChoice(savedPreferences, "profile", ["atlas", "cinematic", "lab"], "atlas"),
      lang: savedChoice(savedPreferences, "lang", ["de", "en"], "de"),
      theme: savedChoice(savedPreferences, "theme", ["day", "night"], "day"),
      details: savedPreferences.details !== false,
      clouds: savedPreferences.clouds !== false,
    };
    document.body.dataset.profile = state.profile;
    document.body.dataset.under = "false";
    document.body.dataset.theme = state.theme;
    document.body.dataset.details = state.details ? "true" : "false";
    document.body.dataset.clouds = state.clouds ? "true" : "false";

    let renderQueued = false;
    let resizeTimer = 0;
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
      mapImage.src = state.pixel ? "dzi/regierungsviertel/overview.png" : "dzi/regierungsviertel/overview_source.png";
      mapImage.classList.toggle("pixelated", state.pixel);
      ui.quality.textContent = state.pixel ? t("detailImage") : t("pixelArt");
    }
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
      ui.quality.textContent = state.pixel ? t("detailImage") : t("pixelArt");
      ui.reset.textContent = t("reset");
      ui.reference.textContent = t("reference");
      ui.advancedLink.textContent = t("advanced");
      ui.notice.textContent = t("notice");
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
    function displayY(y) {
      return state.under ? image.height - y : y;
    }
    function applyRender() {
      layer.style.width = `${image.width}px`;
      layer.style.height = `${image.height}px`;
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
      state.x = (rect.width - image.width * state.scale) / 2;
      state.y = (rect.height - image.height * state.scale) / 2;
      state.rotation = 0;
      state.tilt = 0;
      state.under = false;
      state.viewKey = "top";
      render();
    }
    function resetView() {
      fit();
      const defaultLandmark = landmarks.find((landmark) => landmark.name === DEFAULT_FOCUS_LANDMARK) || landmarks[0];
      if (defaultLandmark) focusLandmark(defaultLandmark);
      setViewPreset("top");
      savePreferences();
    }
    function zoomBy(factor) {
      const rect = stage.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const imageX = (cx - state.x) / state.scale;
      const imageY = (cy - state.y) / state.scale;
      state.scale = Math.max(state.fitScale * 0.45, Math.min(state.scale * factor, state.fitScale * 6));
      state.x = cx - imageX * state.scale;
      state.y = cy - imageY * state.scale;
      render();
    }
    function focusLandmark(landmark) {
      const rect = stage.getBoundingClientRect();
      const maxScale = landmark.name === DEFAULT_FOCUS_LANDMARK ? 4.85 : 3.4;
      const minScale = landmark.name === DEFAULT_FOCUS_LANDMARK ? 2.85 : 2.25;
      selectedLandmarkName = landmark.name;
      state.scale = Math.max(state.fitScale * minScale, Math.min(state.fitScale * 5.4, maxScale));
      state.x = rect.width / 2 - landmark.x * state.scale;
      state.y = rect.height / 2 - displayY(landmark.y) * state.scale;
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
      const ys = points.map((point) => displayY(point.y));
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
      state.x = rect.width / 2 - ((minX + maxX) / 2) * state.scale;
      state.y = rect.height / 2 - ((minY + maxY) / 2) * state.scale;
      selectedLandmarkName = "Kemperplatz / Tiergartentunnel";
      savePreferences();
      render();
    }
    function setUnderView(enabled) {
      state.under = enabled;
      if (enabled) {
        state.rotation = 180;
        state.tilt = 22;
        state.viewKey = "free";
        focusTunnelRoute();
        return;
      }
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
      state.rotation = ((state.rotation + delta) % 360 + 360) % 360;
      state.viewKey = "free";
      savePreferences();
      render();
    }
    function tiltBy(delta) {
      state.tilt = Math.max(-28, Math.min(28, state.tilt + delta));
      state.viewKey = "free";
      savePreferences();
      render();
    }
    function setViewPreset(key) {
      const preset = VIEW_PRESETS[key];
      if (!preset) return;
      state.rotation = preset.rotation;
      state.tilt = preset.tilt;
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
    function addMarkers() {
      markerRoot.innerHTML = "";
      list.innerHTML = "";
      landmarks.forEach((landmark, index) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "marker";
        marker.style.left = `${landmark.x}px`;
        marker.style.top = `${landmark.y}px`;
        marker.dataset.role = landmark.role || "";
        marker.dataset.priority = PRIORITY_LANDMARKS.has(landmark.name) ? "true" : "false";
        marker.dataset.landmarkIndex = String(index);
        marker.title = landmark.name;
        marker.setAttribute("aria-label", landmark.name);
        marker.addEventListener("click", () => focusLandmark(landmark));
        markerRoot.appendChild(marker);

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
    function addTunnelTube(points, volume) {
      if (points.length < 2) return;
      const halfWidth = Number(volume.width_px) || 30;
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
      const halfWidth = Number(volume.width_px) || 30;
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
      const halfWidth = Number(volume.width_px) || 30;
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
      const halfWidth = Number(volume.width_px) || 30;
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
        transform: `translate(${x} ${y}) rotate(${rotation})`,
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
        transform: `translate(${x} ${y}) rotate(${rotation})`,
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
        transform: `translate(${x} ${y}) rotate(${rotation})`,
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
        transform: `translate(${x} ${y}) rotate(${rotation})`,
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
        transform: `translate(${x} ${y}) rotate(${rotation})`,
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
      const group = addSceneNode("g", { transform: `translate(${x} ${y}) rotate(-15)` });
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
      addCloud(1190, 188, 1.02, "Große transparente Cumulus-Wolke über Spreebogen und Kanzleramt");
      addCloud(1665, 418, .58, "Kleine transparente Cumulus-Wolke über Hauptbahnhof / Humboldthafen");
    }

    stage.addEventListener("pointerdown", (event) => {
      if (event.target.classList.contains("marker")) return;
      event.preventDefault();
      state.dragging = true;
      state.rotateDrag = state.mode === "rotate" || event.shiftKey || event.button === 2;
      state.sx = event.clientX;
      state.sy = event.clientY;
      state.ox = state.x;
      state.oy = state.y;
      state.or = state.rotation;
      state.ot = state.tilt;
      document.body.dataset.dragging = "true";
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      if (state.rotateDrag) {
        state.rotation = state.or + (event.clientX - state.sx) * 0.22;
        state.tilt = Math.max(-28, Math.min(28, state.ot + (event.clientY - state.sy) * 0.08));
        state.viewKey = "free";
      } else {
        state.x = state.ox + event.clientX - state.sx;
        state.y = state.oy + event.clientY - state.sy;
      }
      render();
    });
    function endPointerDrag() {
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
    document.getElementById("tunnel-focus").addEventListener("click", focusTunnelRoute);
    document.getElementById("details-toggle").addEventListener("click", toggleDetails);
    document.getElementById("clouds-toggle").addEventListener("click", toggleClouds);
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
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") referencePanel.classList.remove("open");
      if (event.key === "+" || event.key === "=") zoomBy(1.25);
      if (event.key === "-") zoomBy(0.8);
      if (event.key === "0" || event.key === "Home") resetView();
      if (event.key.toLowerCase() === "r") setMode(state.mode === "rotate" ? "pan" : "rotate");
      if (event.key.toLowerCase() === "u") toggleUnderView();
      if (event.key.toLowerCase() === "f") focusTunnelRoute();
      if (event.key.toLowerCase() === "g") toggleDetails();
      if (event.key.toLowerCase() === "c") toggleClouds();
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
      resizeTimer = window.setTimeout(fit, 80);
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
    addMarkers();
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


def copy_static_site(source: Path, target: Path) -> None:
  """Copy the built static site, excluding development-only sourcemaps."""
  if target.exists():
    shutil.rmtree(target)
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

First try this: double-click START-HERE.html. It is the normal offline viewer.

Only use Terminal for the server fallback:

1. Open Terminal.
2. Type exactly `cd ` including the trailing space.
3. Drag the whole unzipped folder into the Terminal window and press Return.
   The command line must start with `cd `. Do not run the folder path alone.
4. Run: python3 serve-local.py
5. Open the printed http://127.0.0.1:.../START-HERE.html address.

This package does not include start-mac.command because macOS Gatekeeper
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


def write_readme(package_dir: Path) -> None:
  (package_dir / "README.txt").write_text(
    f"""Isometric Berlin - Regierungsviertel {PACKAGE_VERSION}
==============================================

Deutsch
-------

Dieses Paket ist eine lokale HTML-Website mit allen Kartendaten. Zum
Anzeigen brauchst du keine KI und keinen Google-Key. Version {PACKAGE_VERSION}
ist ausdrücklich macOS-/Windows-downloadfreundlich: der normale Startweg ist
eine HTML-Datei, kein ausführbares macOS-.command-Skript und kein Terminal.
START-HERE.html ist ein einfacher Offline-Viewer mit Karte, Zoom/Verschieben,
Referenzkarte und Landmarkenliste. Er startet mit der schärferen Detailansicht
und hat große Buttons für Zoom, Drehen, Swivel/Kippen, Reset und Pixel-Art.
Version {PACKAGE_VERSION} hat zusätzlich Atlas/Cinematic/Lab-Grafikprofile,
eine technische Kartenbühne, Fokus-Ring und HUD für Landmarke/Zoom/Kamera.
Neu ist ein zweisprachiger Deutsch/English-Schalter und ein Tag-/Nachtmodus.
Im Nachtmodus legt der Offline-Viewer beleuchtete Fenster für Reichstag,
Bundeskanzleramt und Hauptbahnhof, Lichtkegel am Brandenburger Tor,
Denkmal-Akzente, Tiergarten-/Pariser-Platz-Laternen und verstärkte
Tunnelbeleuchtung über die Karte.
Version {PACKAGE_VERSION} ergänzt außerdem eine Szenen-Detail-Ebene mit drei
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
Sprache, Tag/Nacht, Grafikprofil, Pixel-/Detailbild-Auswahl, zuletzt fokussierte
Landmarke und Blickwinkel werden lokal im Browser gespeichert und beim nächsten
Öffnen wiederhergestellt. Falls ein Browser localStorage sperrt, startet
START-HERE.html trotzdem mit Defaults.
Der Tiergartentunnel ist als sichtbares unterirdisches Rechteckbauwerk mit
zwei Röhren, Seitenwänden, Mittelwand, warmen Lichtpunkten,
Lüftungs-/Schachtmarkern und Querschnittsmarken sichtbar. Die Geometrie nutzt
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

Diese Version verfeinert außerdem die metrisch-architektonische Darstellung:
LoD2-Grundrisse bleiben der Metermaßstab, Innenringe werden als Höfe/Ausschnitte
sichtbar, Fassaden bekommen dichtere Rücksprung-/Fensterbänder und Dächer
feinere Rippen/Aufbauten. Echte fotogrammetrische Fassadenreliefs sind noch
nicht behauptet; dafür braucht der nächste große Schritt ein lizenziertes
texturiertes 3D-Mesh/OBJ.

Start ohne Terminal:

1. ZIP entpacken.
2. Doppelklick auf START-HERE.html.
3. Der Viewer öffnet sich im Browser.

Falls dein Browser lokale Deep-Zoom-Dateien blockiert:

- macOS: siehe start-mac-if-needed.txt und starte `python3 serve-local.py`.
- Windows: Doppelklick auf start-windows.bat.
- Linux: ./start-linux.sh

Der Server-Fallback öffnet eine lokale Adresse im Browser, normalerweise
http://127.0.0.1:8766/START-HERE.html. Wenn dieser Port belegt ist, nimmt
er automatisch den nächsten freien Port. Die Terminal-Ausgabe erscheint
sofort und nennt die genaue Adresse. Das Terminalfenster muss geöffnet
bleiben, solange die Website laufen soll. Beenden mit Ctrl+C oder Fenster
schließen.

Warum kein start-mac.command mehr? Apple Gatekeeper blockiert unsignierte,
aus dem Internet geladene .command-Dateien oft mit "Not Opened", bevor sie
überhaupt laufen können. START-HERE.html vermeidet genau diese Falle.

Erweitert: `python3 serve-local.py --no-open --port 8770`

Die Daten stammen aus kostenlosen/offenen Quellen: Berlin LoD2,
OpenStreetMap, ALKIS, DOP-Preview, DGM-Preview und Wikimedia
Commons/Wikipedia. Google/Apple-Kartenprodukte dienen nur als visuelle
QA-Referenz; daraus wird nichts kopiert.

English
-------

This package is a local HTML website with all map data included. It
does not need an AI model or a Google key to run. Version {PACKAGE_VERSION}
is explicitly macOS-/Windows-download-friendly: the normal launch path is
an HTML file, not an executable macOS .command script, and not Terminal.
START-HERE.html is a simple offline viewer with the map, zoom/pan,
reference map, and landmark list. It starts with the sharper detail render
and has large buttons for zoom, rotate, swivel/tilt, reset, and Pixel-Art.
Version {PACKAGE_VERSION} also adds Atlas/Cinematic/Lab visual profiles, a
technical map stage, focus ring, and HUD for landmark/zoom/camera state.
It now includes a bilingual German/English switch and a Day/Night mode.
Night mode overlays lit windows for the Reichstag, Federal Chancellery and
Hauptbahnhof, a light cone at Brandenburg Gate, monument accents,
Tiergarten/Pariser Platz street lamps and stronger tunnel lighting.
Version {PACKAGE_VERSION} also adds a scene-detail layer with three translucent
isometric clouds, southwest late-afternoon sunlight, cloud shadows, water-depth
accents, tunnel branch hints, an ICE, an S-Bahn, cars with night light beams,
flags, a Spree tour boat, Pariser Platz visitors / pedicab cues and
Zollpackhof / Gustav-Heinemann-Brücke beer-garden details.
Details and clouds can now be toggled separately and the choices are saved with
the other offline preferences. Keys G and C switch those layers directly. While
dragging, the viewer reduces costly SVG filters so pan/rotate/swivel feels
lighter. This version also adds glass glints for the Reichstag, Hauptbahnhof
and Chancellery, water ripples, Tiergarten tree clusters and small path accents.
Language, Day/Night, visual profile, Pixel-Art/detail-image selection, last
focused landmark and view angle are stored locally in the browser and restored
on the next open. If a browser blocks localStorage, START-HERE.html still
starts with defaults.
The Tiergartentunnel is shown as an underground rectangular structure with
two tubes, side walls, a centre wall, warm lighting dots, ventilation / shaft
markers, and cross-section markers. Starting with v0.1.49, the geometry uses
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

This version also refines the metric architectural rendering pass: LoD2
footprints remain the metre-scale anchor, interior rings render as
courtyards/cut-outs, facades get denser recessed bay/window rhythm, and roofs
get finer ribs/equipment marks. It still does not claim true photogrammetric
facade relief; that needs a future licensed textured 3D mesh/OBJ ingest.

Start without Terminal:

1. Unzip the package.
2. Double-click START-HERE.html.
3. The viewer opens in your browser.

If your browser blocks local Deep Zoom files:

- macOS: read start-mac-if-needed.txt and run `python3 serve-local.py`.
- Windows: double-click start-windows.bat.
- Linux: ./start-linux.sh

The server fallback opens a local browser address, usually
http://127.0.0.1:8766/START-HERE.html. If that port is busy, it automatically
uses the next free port. Terminal output is flushed immediately and prints the
exact address. Keep the terminal window open while the website is running.
Stop with Ctrl+C or close the window.

Why no start-mac.command? Apple Gatekeeper often blocks unsigned
downloaded .command files with "Not Opened" before they can run.
START-HERE.html avoids that trap.

Advanced: `python3 serve-local.py --no-open --port 8770`

Data sources are free and open: Berlin LoD2, OpenStreetMap, ALKIS, DOP
preview, DGM preview, and Wikimedia Commons/Wikipedia. Google/Apple map
products are used only as visual QA references; nothing from them is
copied.

Attribution:
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia

Per-file Wikimedia credits are bundled at
dzi/regierungsviertel/wikimedia_attribution.json.
""",
    encoding="utf-8",
  )


def write_package_manifest(package_dir: Path) -> None:
  """Write machine-readable release metadata for local package QA."""
  dzi_root = package_dir / "dzi" / "regierungsviertel"
  asset_paths = {
    "detail_image": dzi_root / "overview_source.png",
    "pixel_image": dzi_root / "overview.png",
    "dzi_descriptor": dzi_root / "regierungsviertel.dzi",
    "reference_map": dzi_root / "reference_map.png",
    "landmarks": dzi_root / "landmarks.json",
    "tiergartentunnel_overlay": dzi_root / "tiergartentunnel.json",
    "wikimedia_attribution": dzi_root / "wikimedia_attribution.json",
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
    "preferred_image": "dzi/regierungsviertel/overview_source.png",
    "optional_pixel_image": "dzi/regierungsviertel/overview.png",
    "dzi_descriptor": "dzi/regierungsviertel/regierungsviertel.dzi",
    "uses_google_content": False,
    "scope": "Berlin Regierungsviertel v0.1 bounds only",
    "render_mode": "source-detail DZI with optional pixel-art toggle",
    "controls": [
      "mouse-pan",
      "mouse-rotate-swivel",
      "keyboard-arrow-pan",
      "shift-arrow-rotate-swivel",
      "top-north-east-south-west-presets",
      "atlas-cinematic-lab-visual-profiles",
      "bilingual-de-en-ui",
      "day-night-mode",
      "persistent-offline-viewer-preferences",
      "persistent-last-landmark-and-view",
      "selected-landmark-focus-ring",
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
      "(dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia"
    ),
    "assets": {
      label: {
        "path": str(path.relative_to(package_dir)),
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
  public_source = root / "src" / "app" / "public"
  if not (source / "index.html").exists():
    raise SystemExit(
      "Missing src/app/dist/index.html. Run `cd src/app && bun run build`."
    )
  package_dir = out_dir / PACKAGE_NAME
  copy_static_site(source, package_dir)
  ensure_public_dzi_metadata_copied(public_source, package_dir)
  ensure_dzi_tiles_copied(source, package_dir)
  ensure_dzi_tiles_copied(public_source, package_dir)
  write_start_here(package_dir)
  write_launchers(package_dir)
  write_readme(package_dir)
  write_package_manifest(package_dir)
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
