"""Check release metadata and bundled viewer assets before tagging."""

from __future__ import annotations

import json
import math
import re
import tomllib
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Iterator
from pathlib import Path
from typing import NamedTuple

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
PACKAGE_ZIP = f"{PACKAGE_NAME}.zip"
REQUIRED_PACKAGE_ENTRIES = (
  "START-HERE.html",
  "README.txt",
  "serve-local.py",
  "start-mac-if-needed.txt",
  "start-windows.bat",
  "start-linux.sh",
  "index.html",
  "dzi/regierungsviertel/overview.png",
  "dzi/regierungsviertel/overview_source.png",
  "dzi/regierungsviertel/reference_map.png",
  "dzi/regierungsviertel/regierungsviertel.dzi",
  "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg",
)


class DziInfo(NamedTuple):
  tile_size: int
  fmt: str
  width: int
  height: int


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


def package_arcname(relative: str) -> str:
  return f"{PACKAGE_NAME}/{relative}"


def package_start_here_failures(start_here_text: str, label: str) -> list[str]:
  failures: list[str] = []
  if 'type="module"' in start_here_text:
    failures.append(
      f"Package HTML launcher still depends on browser module loading: {label}"
    )
  if "dzi/regierungsviertel/overview.png" not in start_here_text:
    failures.append(f"Package HTML launcher does not reference overview.png: {label}")
  if "dzi/regierungsviertel/overview_source.png" not in start_here_text:
    failures.append(
      f"Package HTML launcher does not reference overview_source.png: {label}"
    )
  if "Drehen/Swivel" not in start_here_text or "event.shiftKey" not in start_here_text:
    failures.append(
      f"Package HTML launcher lacks rotate/swivel mouse controls: {label}"
    )
  if (
    "setViewPreset" not in start_here_text
    or "view-north" not in start_here_text
    or "compass" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks reproducible view presets: {label}")
  return failures


def package_server_failures(serve_text: str, label: str) -> list[str]:
  if (
    'START_PAGE = "START-HERE.html"' not in serve_text
    or "require_package_files(root)" not in serve_text
    or "flush=True" not in serve_text
  ):
    return [f"Package server fallback does not open/flush START-HERE.html: {label}"]
  return []


def parse_dzi_descriptor(
  descriptor_label: str, data: bytes
) -> tuple[DziInfo | None, list[str]]:
  try:
    root = ET.fromstring(data)
  except ET.ParseError as exc:
    return None, [f"Invalid DZI descriptor {descriptor_label}: {exc}"]

  try:
    tile_size = int(root.attrib["TileSize"])
    fmt = root.attrib["Format"]
    size = next(child for child in root if child.tag.endswith("Size"))
    width = int(size.attrib["Width"])
    height = int(size.attrib["Height"])
  except (KeyError, StopIteration, ValueError) as exc:
    return None, [f"Incomplete DZI descriptor {descriptor_label}: {exc}"]

  if tile_size <= 0 or width <= 0 or height <= 0:
    return None, [f"Invalid DZI dimensions in {descriptor_label}"]

  return DziInfo(tile_size=tile_size, fmt=fmt, width=width, height=height), []


def iter_dzi_tile_paths(info: DziInfo) -> Iterator[str]:
  max_level = math.ceil(math.log2(max(info.width, info.height)))
  for level in range(max_level + 1):
    scale = 2 ** (max_level - level)
    level_width = math.ceil(info.width / scale)
    level_height = math.ceil(info.height / scale)
    cols = math.ceil(level_width / info.tile_size)
    rows = math.ceil(level_height / info.tile_size)
    for row in range(rows):
      for col in range(cols):
        yield f"{level}/{col}_{row}.{info.fmt}"


def dzi_tile_failures(public_dzi: Path) -> list[str]:
  descriptor = public_dzi / DZI_DESCRIPTOR
  tiles_root = public_dzi / DZI_TILES_DIR
  if not descriptor.exists():
    return [f"Missing DZI descriptor: {descriptor}"]
  if not tiles_root.is_dir():
    return [f"Missing DZI tile directory: {tiles_root}"]

  info, failures = parse_dzi_descriptor(str(descriptor), descriptor.read_bytes())
  if failures:
    return failures
  assert info is not None

  failures = []
  seen_level_dirs: set[Path] = set()
  for relative_tile in iter_dzi_tile_paths(info):
    tile = tiles_root / relative_tile
    level_dir = tile.parent
    if level_dir not in seen_level_dirs:
      seen_level_dirs.add(level_dir)
      if not level_dir.is_dir():
        failures.append(f"Missing DZI level directory: {level_dir}")
        continue
    if not tile.exists():
      failures.append(f"Missing DZI tile: {tile}")
    elif tile.stat().st_size == 0:
      failures.append(f"Empty DZI tile: {tile}")
  return failures


def zip_dzi_tile_failures(
  archive: zipfile.ZipFile, names: set[str], zip_path: Path
) -> list[str]:
  descriptor = package_arcname(f"dzi/regierungsviertel/{DZI_DESCRIPTOR}")
  if descriptor not in names:
    return []

  info, failures = parse_dzi_descriptor(
    f"{zip_path}!{descriptor}", archive.read(descriptor)
  )
  if failures:
    return failures
  assert info is not None

  failures = []
  seen_level_dirs: set[str] = set()
  for relative_tile in iter_dzi_tile_paths(info):
    level_dir = package_arcname(
      f"dzi/regierungsviertel/{DZI_TILES_DIR}/{Path(relative_tile).parent}"
    )
    if level_dir not in seen_level_dirs:
      seen_level_dirs.add(level_dir)
      if not any(name.startswith(f"{level_dir}/") for name in names):
        failures.append(f"Missing DZI ZIP level directory: {zip_path}!{level_dir}")
        continue
    tile = package_arcname(f"dzi/regierungsviertel/{DZI_TILES_DIR}/{relative_tile}")
    if tile not in names:
      failures.append(f"Missing DZI ZIP tile: {zip_path}!{tile}")
      continue
    if archive.getinfo(tile).file_size == 0:
      failures.append(f"Empty DZI ZIP tile: {zip_path}!{tile}")
  return failures


def zip_package_failures(root: Path = ROOT) -> list[str]:
  zip_path = root / "releases" / PACKAGE_ZIP
  if not zip_path.exists():
    return [f"Missing package ZIP: {zip_path}"]

  failures: list[str] = []
  try:
    with zipfile.ZipFile(zip_path) as archive:
      corrupt_member = archive.testzip()
      if corrupt_member is not None:
        failures.append(f"Corrupt ZIP member: {zip_path}!{corrupt_member}")

      names = set(archive.namelist())
      for relative in REQUIRED_PACKAGE_ENTRIES:
        arcname = package_arcname(relative)
        if arcname not in names:
          failures.append(f"Missing package ZIP entry: {zip_path}!{arcname}")

      failures.extend(zip_dzi_tile_failures(archive, names, zip_path))

      for name in names:
        if name.endswith("/"):
          continue
        if not name.startswith(f"{PACKAGE_NAME}/"):
          failures.append(f"Unexpected package ZIP root entry: {zip_path}!{name}")
          continue
        inner = Path(name).relative_to(PACKAGE_NAME)
        if has_forbidden_duplicate_name(inner):
          failures.append(
            f"Unwanted duplicate/hidden package ZIP path: {zip_path}!{name}"
          )
        if inner.name == "start-mac.command":
          failures.append(f"Forbidden macOS Gatekeeper ZIP launcher: {zip_path}!{name}")

      start_here = package_arcname("START-HERE.html")
      if start_here in names:
        start_here_text = archive.read(start_here).decode("utf-8")
        failures.extend(
          package_start_here_failures(start_here_text, f"{zip_path}!{start_here}")
        )

      serve_local = package_arcname("serve-local.py")
      if serve_local in names:
        serve_text = archive.read(serve_local).decode("utf-8")
        failures.extend(
          package_server_failures(serve_text, f"{zip_path}!{serve_local}")
        )
  except (UnicodeDecodeError, zipfile.BadZipFile) as exc:
    return [f"Invalid package ZIP: {zip_path}: {exc}"]

  return failures


def collect_failures(
  root: Path = ROOT, *, require_package_zip: bool = False
) -> list[str]:
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
    start_here = package_dir / "START-HERE.html"
    if not start_here.exists():
      failures.append(f"Missing package HTML launcher: {start_here}")
    else:
      failures.extend(
        package_start_here_failures(
          start_here.read_text(encoding="utf-8"), str(start_here)
        )
      )
    if (package_dir / "start-mac.command").exists():
      failures.append(
        f"Forbidden macOS Gatekeeper-blocked launcher: {package_dir / 'start-mac.command'}"
      )
    serve_local = package_dir / "serve-local.py"
    if not serve_local.exists():
      failures.append(f"Missing package server fallback: {serve_local}")
    else:
      failures.extend(
        package_server_failures(
          serve_local.read_text(encoding="utf-8"), str(serve_local)
        )
      )

  zip_path = root / "releases" / PACKAGE_ZIP
  if require_package_zip or zip_path.exists():
    failures.extend(zip_package_failures(root))

  scan_roots = [root / "src" / "app" / "public", root / "src" / "app" / "dist"]
  for scan_root in scan_roots:
    if not scan_root.exists():
      continue
    for path in scan_root.rglob("*"):
      if has_forbidden_duplicate_name(path.relative_to(scan_root)):
        failures.append(f"Unwanted duplicate/hidden package path: {path}")

  return failures


def main() -> None:
  failures = collect_failures(require_package_zip=True)
  if failures:
    details = "\n".join(f"- {failure}" for failure in failures)
    raise SystemExit(f"Release readiness failed:\n{details}")
  print(f"Release readiness OK for v{project_version()}")


if __name__ == "__main__":
  main()
