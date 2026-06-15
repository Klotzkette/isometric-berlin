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
import socketserver
import webbrowser
from pathlib import Path


class QuietHandler(http.server.SimpleHTTPRequestHandler):
  """Static file handler with concise logging and no stale cache."""

  def end_headers(self) -> None:
    self.send_header("Cache-Control", "no-store")
    super().end_headers()

  def log_message(self, format: str, *args: object) -> None:
    print(f"[viewer] {self.address_string()} - {format % args}")


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


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--port", type=int, default=8766)
  parser.add_argument("--host", default="127.0.0.1")
  parser.add_argument("--no-open", action="store_true")
  args = parser.parse_args()

  directory, start_path = viewer_directory(repo_root())
  handler = functools.partial(QuietHandler, directory=str(directory))
  with socketserver.ThreadingTCPServer((args.host, args.port), handler) as server:
    server.allow_reuse_address = True
    url = f"http://{args.host}:{args.port}{start_path}"
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
