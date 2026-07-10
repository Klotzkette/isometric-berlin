"""Serve the local Isometric Berlin viewer from disk.

This script uses only the Python standard library. It serves the
already-built static app from ``src/app/dist`` when present. If the
Vite build has not been generated yet, it falls back to the committed
single-image preview under ``src/app/public/dzi/regierungsviertel``.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import socket
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

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
  """Cache immutable static payloads while revalidating entry metadata."""
  suffix = Path(urlsplit(request_path).path).suffix.lower()
  if suffix in CACHEABLE_SUFFIXES:
    return "public, max-age=0, must-revalidate"
  return "no-cache"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
  """Static file handler with concise logging and asset-aware caching."""

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


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def viewer_directory(root: Path) -> tuple[Path, str]:
  dist = root / "src" / "app" / "dist"
  if (dist / "index.html").exists():
    return dist, "/"
  preview = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  if (preview / "preview.html").exists():
    return preview, "/preview.html"
  raise SystemExit(
    "No local viewer found. Build it with `cd src/app && bun run build`, "
    "or regenerate the DZI preview."
  )


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
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--port", type=int, default=8766)
  parser.add_argument("--host", default="127.0.0.1")
  parser.add_argument("--no-open", action="store_true")
  args = parser.parse_args()

  directory, start_path = viewer_directory(repo_root())
  handler = functools.partial(QuietHandler, directory=str(directory))
  port = first_available_port(args.host, args.port)
  if port != args.port:
    print(f"Port {args.port} is busy, using {port}.")
  with ReusableTCPServer((args.host, port), handler) as server:
    url = f"http://{args.host}:{port}{start_path}"
    print(f"Serving Isometric Berlin from {directory}")
    print(f"Open: {url}")
    if not args.no_open:
      webbrowser.open(url)
    try:
      server.serve_forever()
    except KeyboardInterrupt:
      print("\nStopped local viewer.")


if __name__ == "__main__":
  main()
