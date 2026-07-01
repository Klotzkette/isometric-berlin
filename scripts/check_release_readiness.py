"""Check release metadata and bundled viewer assets before tagging."""

from __future__ import annotations

import json
import math
import re
import tomllib
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_RE = re.compile(r"__version__ = \"([^\"]+)\"")
PACKAGE_VERSION_RE = re.compile(r"PACKAGE_VERSION = \"([^\"]+)\"")
DUPLICATE_COPY_RE = re.compile(r"^.+ [2-9](?:\.[^.]+)?$")
REQUIRED_VIEWER_FILES = (
  "landmarks.json",
  "reference_map.png",
  "regierungsviertel.dzi",
  "wikimedia_attribution.json",
)
REQUIRED_REPORT_FILES = (
  "docs/landmark-alignment.md",
  "docs/metric-precision.md",
  "geo_data/regierungsviertel/landmark_alignment.json",
  "geo_data/regierungsviertel/metric_precision.json",
)
DZI_DESCRIPTOR = "regierungsviertel.dzi"
DZI_TILES_DIR = "regierungsviertel_files"
PACKAGE_NAME = "isometric-berlin-regierungsviertel-local"


def project_version(root: Path = ROOT) -> str:
  metadata = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
  return str(metadata["project"]["version"])


def package_version(root: Path = ROOT) -> str:
  script = (root / "scripts" / "package_static_site.py").read_text(encoding="utf-8")
  match = PACKAGE_VERSION_RE.search(script)
  return match.group(1) if match else ""


def module_version(root: Path = ROOT) -> str:
  init = (root / "src" / "isometric_berlin" / "__init__.py").read_text(encoding="utf-8")
  match = VERSION_RE.search(init)
  return match.group(1) if match else ""


def app_version(root: Path = ROOT) -> str:
  package = json.loads(
    (root / "src" / "app" / "package.json").read_text(encoding="utf-8")
  )
  return str(package["version"])


def has_forbidden_duplicate_name(path: Path) -> bool:
  return any(
    part == "__MACOSX" or part.startswith(".") or DUPLICATE_COPY_RE.match(part)
    for part in path.parts
  )


def dzi_tile_failures(public_dzi: Path) -> list[str]:
  descriptor = public_dzi / DZI_DESCRIPTOR
  tiles_root = public_dzi / DZI_TILES_DIR
  if not descriptor.exists():
    return [f"Missing DZI descriptor: {descriptor}"]
  if not tiles_root.is_dir():
    return [f"Missing DZI tile directory: {tiles_root}"]

  try:
    root = ET.parse(descriptor).getroot()
  except ET.ParseError as exc:
    return [f"Invalid DZI descriptor {descriptor}: {exc}"]

  try:
    tile_size = int(root.attrib["TileSize"])
    fmt = root.attrib["Format"]
    size = next(child for child in root if child.tag.endswith("Size"))
    width = int(size.attrib["Width"])
    height = int(size.attrib["Height"])
  except (KeyError, StopIteration, ValueError) as exc:
    return [f"Incomplete DZI descriptor {descriptor}: {exc}"]

  if tile_size <= 0 or width <= 0 or height <= 0:
    return [f"Invalid DZI dimensions in {descriptor}"]

  failures: list[str] = []
  max_level = math.ceil(math.log2(max(width, height)))
  for level in range(max_level + 1):
    scale = 2 ** (max_level - level)
    level_width = math.ceil(width / scale)
    level_height = math.ceil(height / scale)
    cols = math.ceil(level_width / tile_size)
    rows = math.ceil(level_height / tile_size)
    level_dir = tiles_root / str(level)
    if not level_dir.is_dir():
      failures.append(f"Missing DZI level directory: {level_dir}")
      continue
    for row in range(rows):
      for col in range(cols):
        tile = level_dir / f"{col}_{row}.{fmt}"
        if not tile.exists():
          failures.append(f"Missing DZI tile: {tile}")
        elif tile.stat().st_size == 0:
          failures.append(f"Empty DZI tile: {tile}")
  return failures


def collect_failures(root: Path = ROOT) -> list[str]:
  failures: list[str] = []
  version = project_version(root)
  version_sources = {
    "src/isometric_berlin/__init__.py": module_version(root),
    "scripts/package_static_site.py": package_version(root),
    "src/app/package.json": app_version(root),
  }
  for source, actual in version_sources.items():
    if actual != version:
      failures.append(f"{source} has version {actual!r}, expected {version!r}")

  readme = (root / "README.md").read_text(encoding="utf-8")
  if f"Local v{version}" not in readme:
    failures.append(f"README.md status does not mention Local v{version}")

  for report_file in REQUIRED_REPORT_FILES:
    if not (root / report_file).exists():
      failures.append(f"Missing QA/report artefact: {root / report_file}")

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  for filename in REQUIRED_VIEWER_FILES:
    if not (public_dzi / filename).exists():
      failures.append(f"Missing bundled viewer asset: {public_dzi / filename}")
  failures.extend(dzi_tile_failures(public_dzi))

  public_landmarks = public_dzi / "landmarks.json"
  bundled_landmarks = (
    root / "src" / "app" / "src" / "data" / "regierungsviertel-landmarks.json"
  )
  if not bundled_landmarks.exists():
    failures.append(f"Missing bundled app landmarks: {bundled_landmarks}")
  elif (
    public_landmarks.exists()
    and bundled_landmarks.read_bytes() != public_landmarks.read_bytes()
  ):
    failures.append(
      "Bundled app landmarks differ from src/app/public/dzi/regierungsviertel/landmarks.json"
    )

  package_dir = root / "releases" / PACKAGE_NAME
  if package_dir.exists():
    if not (package_dir / "START-HERE.html").exists():
      failures.append(
        f"Missing package HTML launcher: {package_dir / 'START-HERE.html'}"
      )
    if (package_dir / "start-mac.command").exists():
      failures.append(
        f"Forbidden macOS Gatekeeper-blocked launcher: {package_dir / 'start-mac.command'}"
      )

  scan_roots = [root / "src" / "app" / "public", root / "src" / "app" / "dist"]
  for scan_root in scan_roots:
    if not scan_root.exists():
      continue
    for path in scan_root.rglob("*"):
      if has_forbidden_duplicate_name(path.relative_to(scan_root)):
        failures.append(f"Unwanted duplicate/hidden package path: {path}")

  return failures


def main() -> None:
  failures = collect_failures()
  if failures:
    details = "\n".join(f"- {failure}" for failure in failures)
    raise SystemExit(f"Release readiness failed:\n{details}")
  print(f"Release readiness OK for v{project_version()}")


if __name__ == "__main__":
  main()
