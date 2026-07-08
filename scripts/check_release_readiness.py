"""Check release metadata and bundled viewer assets before tagging."""

from __future__ import annotations

import hashlib
import json
import math
import re
import tomllib
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Callable, Iterator
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
  "tiergartentunnel.json",
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
  "package-manifest.json",
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
  "dzi/regierungsviertel/tiergartentunnel.json",
)
REQUIRED_ATTRIBUTION = (
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)"
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


def expected_download_url(version: str) -> str:
  return (
    "https://github.com/Klotzkette/isometric-berlin/releases/download/"
    f"v{version}/{PACKAGE_ZIP}"
  )


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
    "ArrowLeft" not in start_here_text
    or "ArrowRight" not in start_here_text
    or "tiltBy" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks keyboard pan/rotate/swivel controls: {label}"
    )
  if (
    "setViewPreset" not in start_here_text
    or "view-north" not in start_here_text
    or "compass" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks reproducible view presets: {label}")
  if "tunnel-overlay" not in start_here_text or "tunnelPayload" not in start_here_text:
    failures.append(f"Package HTML launcher lacks Tiergartentunnel overlay: {label}")
  if (
    "tunnel-light" not in start_here_text
    or "tunnel-vent" not in start_here_text
    or "addTunnelVentilation" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks tunnel lighting / ventilation cues: {label}"
    )
  if (
    "tunnel-volume" not in start_here_text
    or "tunnel-center-wall" not in start_here_text
    or "addTunnelTube" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks tunnel volume / centre-wall geometry: {label}"
    )
  if (
    "under-view" not in start_here_text
    or "scaleY" not in start_here_text
    or "focusTunnelRoute" not in start_here_text
    or "tunnel-ceiling-rib" not in start_here_text
    or "tunnel-service-bay" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks tunnel underside / detail controls: {label}"
    )
  if (
    "lang-de" not in start_here_text
    or "lang-en" not in start_here_text
    or "applyLanguage" not in start_here_text
    or "setLanguage" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks bilingual DE/EN UI: {label}")
  if (
    "theme-night" not in start_here_text
    or "setTheme" not in start_here_text
    or "night-light-overlay" not in start_here_text
    or "addNightLights" not in start_here_text
    or "night-window" not in start_here_text
    or "night-street-lamp" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks day/night lighting controls: {label}")
  if (
    "requestAnimationFrame" not in start_here_text
    or "renderQueued" not in start_here_text
    or "lostpointercapture" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks anti-freeze render throttling: {label}"
    )
  if (
    "resizeTimer" not in start_here_text or "setTimeout(fit, 80)" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks resize debounce: {label}")
  return failures


def package_server_failures(serve_text: str, label: str) -> list[str]:
  if (
    'START_PAGE = "START-HERE.html"' not in serve_text
    or "require_package_files(root)" not in serve_text
    or "flush=True" not in serve_text
  ):
    return [f"Package server fallback does not open/flush START-HERE.html: {label}"]
  return []


def package_manifest_failures(
  manifest: dict[str, object],
  *,
  label: str,
  version: str,
  asset_reader: Callable[[str], bytes],
) -> list[str]:
  failures: list[str] = []
  if manifest.get("package_name") != PACKAGE_NAME:
    failures.append(f"Package manifest has wrong package_name: {label}")
  if manifest.get("package_version") != version:
    failures.append(
      "Package manifest has version "
      f"{manifest.get('package_version')!r}, expected {version!r}: {label}"
    )
  if manifest.get("start_page") != "START-HERE.html":
    failures.append(f"Package manifest does not point at START-HERE.html: {label}")
  if manifest.get("preferred_image") != "dzi/regierungsviertel/overview_source.png":
    failures.append(f"Package manifest does not prefer overview_source.png: {label}")
  if manifest.get("uses_google_content") is not False:
    failures.append(f"Package manifest unexpectedly marks Google content used: {label}")
  attribution = str(manifest.get("required_attribution", ""))
  if (
    REQUIRED_ATTRIBUTION not in attribution
    or "Wikimedia Commons/Wikipedia" not in attribution
  ):
    failures.append(f"Package manifest lacks required attribution: {label}")

  assets = manifest.get("assets")
  if not isinstance(assets, dict):
    return failures + [f"Package manifest has no asset inventory: {label}"]

  for required in [
    "detail_image",
    "pixel_image",
    "dzi_descriptor",
    "reference_map",
    "landmarks",
    "tiergartentunnel_overlay",
    "wikimedia_attribution",
    "start_page",
  ]:
    entry = assets.get(required)
    if not isinstance(entry, dict):
      failures.append(f"Package manifest lacks asset {required!r}: {label}")
      continue
    relative = str(entry.get("path", ""))
    expected_hash = str(entry.get("sha256", ""))
    expected_size = entry.get("bytes")
    if not relative or not expected_hash or not isinstance(expected_size, int):
      failures.append(f"Package manifest asset {required!r} is incomplete: {label}")
      continue
    try:
      data = asset_reader(relative)
    except (FileNotFoundError, KeyError):
      failures.append(f"Package manifest references missing asset {relative}: {label}")
      continue
    actual_hash = hashlib.sha256(data).hexdigest()
    if len(data) != expected_size:
      failures.append(f"Package manifest asset size mismatch for {relative}: {label}")
    if actual_hash != expected_hash:
      failures.append(f"Package manifest asset hash mismatch for {relative}: {label}")
  return failures


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

      manifest_name = package_arcname("package-manifest.json")
      if manifest_name in names:
        try:
          manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
          failures.append(
            f"Invalid package manifest: {zip_path}!{manifest_name}: {exc}"
          )
        else:
          failures.extend(
            package_manifest_failures(
              manifest,
              label=f"{zip_path}!{manifest_name}",
              version=project_version(root),
              asset_reader=lambda relative: archive.read(package_arcname(relative)),
            )
          )
  except (UnicodeDecodeError, zipfile.BadZipFile) as exc:
    return [f"Invalid package ZIP: {zip_path}: {exc}"]

  return failures


def tunnel_payload_failures(payload: dict[str, object], *, label: str) -> list[str]:
  failures: list[str] = []
  routes = payload.get("routes")
  if not isinstance(routes, list) or not routes:
    return [f"Tiergartentunnel payload has no routes: {label}"]
  route = routes[0]
  if not isinstance(route, dict):
    return [f"Tiergartentunnel route is not an object: {label}"]
  volume = route.get("volume")
  if not isinstance(volume, dict):
    failures.append(f"Tiergartentunnel route lacks volume metadata: {label}")
  else:
    for key in [
      "tube_count",
      "width_px",
      "clear_width_each_direction_m",
      "clear_height_m",
      "total_width_m",
      "assumed_depth_m",
    ]:
      value = volume.get(key)
      if not isinstance(value, int | float) or value <= 0 and key != "assumed_depth_m":
        failures.append(f"Tiergartentunnel volume has invalid {key}: {label}")
    if float(volume.get("assumed_depth_m", 0)) >= 0:
      failures.append(f"Tiergartentunnel volume depth is not underground: {label}")
  if len(route.get("points", [])) < 8:
    failures.append(f"Tiergartentunnel route is too coarse for v0.1.48: {label}")
  if len(route.get("ventilation", [])) < 5:
    failures.append(f"Tiergartentunnel route lacks enough ventilation markers: {label}")
  if len(route.get("service_bays", [])) < 4:
    failures.append(f"Tiergartentunnel route lacks service bay markers: {label}")
  if len(route.get("portals", [])) < 2:
    failures.append(f"Tiergartentunnel route lacks portal markers: {label}")
  underside = route.get("underside_view")
  if not isinstance(underside, dict) or underside.get("enabled") is not True:
    failures.append(f"Tiergartentunnel route lacks enabled underside view: {label}")
  osm_way_ids = route.get("osm_way_ids")
  if not isinstance(osm_way_ids, list) or len(osm_way_ids) < 10:
    failures.append(f"Tiergartentunnel route lacks OSM way evidence IDs: {label}")
  status = str(route.get("geometry_status", ""))
  if "OSM-derived" not in status or "not official surveyed" not in status:
    failures.append(
      f"Tiergartentunnel route must state OSM-derived non-surveyed status: {label}"
    )
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
  if expected_download_url(version) not in readme:
    failures.append(
      f"README.md direct download link does not point at v{version} package"
    )

  for report_file in REQUIRED_REPORT_FILES:
    if not (root / report_file).exists():
      failures.append(f"Missing QA/report artefact: {root / report_file}")

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  for filename in REQUIRED_VIEWER_FILES:
    if not (public_dzi / filename).exists():
      failures.append(f"Missing bundled viewer asset: {public_dzi / filename}")
  failures.extend(dzi_tile_failures(public_dzi))
  tunnel_payload = public_dzi / "tiergartentunnel.json"
  if tunnel_payload.exists():
    try:
      failures.extend(
        tunnel_payload_failures(
          json.loads(tunnel_payload.read_text(encoding="utf-8")),
          label=str(tunnel_payload),
        )
      )
    except json.JSONDecodeError as exc:
      failures.append(f"Invalid Tiergartentunnel payload: {tunnel_payload}: {exc}")

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
    package_manifest = package_dir / "package-manifest.json"
    if not package_manifest.exists():
      failures.append(f"Missing package manifest: {package_manifest}")
    else:
      try:
        manifest = json.loads(package_manifest.read_text(encoding="utf-8"))
      except json.JSONDecodeError as exc:
        failures.append(f"Invalid package manifest: {package_manifest}: {exc}")
      else:
        failures.extend(
          package_manifest_failures(
            manifest,
            label=str(package_manifest),
            version=version,
            asset_reader=lambda relative: (package_dir / relative).read_bytes(),
          )
        )
    packaged_tunnel = (
      package_dir / "dzi" / "regierungsviertel" / "tiergartentunnel.json"
    )
    if packaged_tunnel.exists():
      try:
        failures.extend(
          tunnel_payload_failures(
            json.loads(packaged_tunnel.read_text(encoding="utf-8")),
            label=str(packaged_tunnel),
          )
        )
      except json.JSONDecodeError as exc:
        failures.append(f"Invalid packaged Tiergartentunnel payload: {exc}")

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
