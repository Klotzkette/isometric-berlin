"""Smoke-test the downloadable local viewer package over HTTP."""

from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACKAGE_DIR = ROOT / "releases" / "isometric-berlin-regierungsviertel-local"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8876
REQUEST_TIMEOUT_SECONDS = 8
SERVER_START_TIMEOUT_SECONDS = 12
REQUIRED_START_SNIPPETS = (
  "requestAnimationFrame",
  "renderQueued",
  "resizeTimer",
  "lostpointercapture",
  "tunnelPayload",
  "tunnel-light",
  "tunnel-vent",
  "tunnel-volume",
  "tunnel-center-wall",
  "addTunnelTube",
  "addTunnelVentilation",
  "Drehen/Swivel",
)


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Start the packaged local viewer and verify its core assets."
  )
  parser.add_argument(
    "--package-dir",
    type=Path,
    default=DEFAULT_PACKAGE_DIR,
    help="Unzipped local package directory.",
  )
  parser.add_argument("--host", default=DEFAULT_HOST)
  parser.add_argument("--port", type=int, default=DEFAULT_PORT)
  parser.add_argument(
    "--expected-version",
    default=None,
    help="Expected package version. Defaults to pyproject.toml version.",
  )
  return parser.parse_args()


def project_version() -> str:
  text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
  for line in text.splitlines():
    if line.startswith("version = "):
      return line.split('"', maxsplit=2)[1]
  raise RuntimeError("Could not determine project version from pyproject.toml")


def first_available_port(host: str, start_port: int, attempts: int = 40) -> int:
  for port in range(start_port, start_port + attempts):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
      probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
      try:
        probe.bind((host, port))
      except OSError:
        continue
      return port
  raise RuntimeError(f"No free local port found from {start_port}")


def read_url(url: str) -> bytes:
  with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
    if response.status != 200:
      raise RuntimeError(f"HTTP {response.status} for {url}")
    return response.read()


def read_json_url(url: str) -> dict[str, Any]:
  return json.loads(read_url(url).decode("utf-8"))


def wait_for_http(base_url: str, process: subprocess.Popen[bytes]) -> None:
  deadline = time.monotonic() + SERVER_START_TIMEOUT_SECONDS
  last_error: Exception | None = None
  while time.monotonic() < deadline:
    if process.poll() is not None:
      raise RuntimeError(f"Packaged server exited with code {process.returncode}")
    try:
      read_url(f"{base_url}/START-HERE.html")
      return
    except Exception as exc:  # noqa: BLE001 - report the last startup failure.
      last_error = exc
      time.sleep(0.2)
  raise RuntimeError(f"Packaged server did not start in time: {last_error}")


def require_package_files(package_dir: Path) -> None:
  required = [
    "START-HERE.html",
    "README.txt",
    "package-manifest.json",
    "serve-local.py",
    "dzi/regierungsviertel/regierungsviertel.dzi",
    "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg",
    "dzi/regierungsviertel/tiergartentunnel.json",
    "dzi/regierungsviertel/landmarks.json",
  ]
  missing = [relative for relative in required if not (package_dir / relative).exists()]
  if missing:
    raise RuntimeError("Missing package files: " + ", ".join(missing))
  forbidden = package_dir / "start-mac.command"
  if forbidden.exists():
    raise RuntimeError(f"Forbidden Gatekeeper-blocked launcher exists: {forbidden}")


def verify_package_http(base_url: str, expected_version: str) -> None:
  start_html = read_url(f"{base_url}/START-HERE.html").decode("utf-8")
  missing = [
    snippet for snippet in REQUIRED_START_SNIPPETS if snippet not in start_html
  ]
  if missing:
    raise RuntimeError("START-HERE.html missing snippets: " + ", ".join(missing))

  manifest = read_json_url(f"{base_url}/package-manifest.json")
  if manifest.get("package_version") != expected_version:
    raise RuntimeError(
      "Package manifest version "
      f"{manifest.get('package_version')!r} != {expected_version!r}"
    )
  assets = manifest.get("assets")
  if not isinstance(assets, dict) or "tiergartentunnel_overlay" not in assets:
    raise RuntimeError("Package manifest lacks tiergartentunnel_overlay asset")

  dzi = read_url(f"{base_url}/dzi/regierungsviertel/regierungsviertel.dzi")
  if b"<Image" not in dzi or b"<Size" not in dzi:
    raise RuntimeError("DZI descriptor does not look valid")

  tile = read_url(
    f"{base_url}/dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg"
  )
  if len(tile) < 100 or not tile.startswith(b"\xff\xd8"):
    raise RuntimeError("DZI tile 12/0_0.jpg does not look like a JPEG")

  tunnel = read_json_url(f"{base_url}/dzi/regierungsviertel/tiergartentunnel.json")
  routes = tunnel.get("routes")
  if not isinstance(routes, list) or not routes or len(routes[0].get("points", [])) < 2:
    raise RuntimeError("Tiergartentunnel overlay has no usable route")
  route = routes[0]
  if len(route.get("ventilation", [])) < 3:
    raise RuntimeError("Tiergartentunnel overlay lacks ventilation markers")
  if int(route.get("lighting", {}).get("spacing_px", 0)) <= 0:
    raise RuntimeError("Tiergartentunnel overlay lacks lighting spacing")
  volume = route.get("volume")
  if not isinstance(volume, dict) or int(volume.get("width_px", 0)) <= 0:
    raise RuntimeError("Tiergartentunnel overlay lacks tunnel volume metadata")
  if float(volume.get("assumed_depth_m", 0)) >= 0:
    raise RuntimeError("Tiergartentunnel overlay depth is not underground")
  if len(route.get("points", [])) < 8:
    raise RuntimeError("Tiergartentunnel overlay route is too coarse")

  landmarks = read_json_url(f"{base_url}/dzi/regierungsviertel/landmarks.json")
  if len(landmarks.get("landmarks", [])) < 30:
    raise RuntimeError("Landmark payload is unexpectedly small")


def main() -> int:
  args = parse_args()
  package_dir = args.package_dir.resolve()
  expected_version = args.expected_version or project_version()
  require_package_files(package_dir)
  port = first_available_port(args.host, args.port)
  process = subprocess.Popen(
    [
      sys.executable,
      "serve-local.py",
      "--no-open",
      "--host",
      args.host,
      "--port",
      str(port),
    ],
    cwd=package_dir,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.STDOUT,
  )
  try:
    base_url = f"http://{args.host}:{port}"
    wait_for_http(base_url, process)
    verify_package_http(base_url, expected_version)
  finally:
    process.terminate()
    try:
      process.wait(timeout=5)
    except subprocess.TimeoutExpired:
      process.kill()
      process.wait(timeout=5)
  print(f"Local package smoke OK for {package_dir} ({expected_version})")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
