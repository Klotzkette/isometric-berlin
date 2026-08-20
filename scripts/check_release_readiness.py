"""Check release metadata and bundled viewer assets before tagging."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
import stat
import struct
import tarfile
import tomllib
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from collections.abc import Callable, Iterator
from pathlib import Path, PurePosixPath
from typing import NamedTuple

ROOT = Path(__file__).resolve().parents[1]
VERSION_RE = re.compile(r"__version__ = \"([^\"]+)\"")
PACKAGE_VERSION_RE = re.compile(r"PACKAGE_VERSION = \"([^\"]+)\"")
DUPLICATE_COPY_RE = re.compile(r"^.+ [2-9](?:\.[^.]+)?$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
REQUIRED_VIEWER_FILES = (
  "landmarks.json",
  "reference_map.png",
  "regierungsviertel.dzi",
  "tiergartentunnel.json",
  "visual_reference_attribution.json",
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
MAX_REPOSITORY_BINARY_BYTES = 5 * 1024 * 1024
MAX_GROUND_CONTEXT_BYTES = 3 * 1024 * 1024
SURFACE_MANIFEST_FILE = "surface-pretriangulation.json"
SURFACE_SOURCE_FILE = "surface-polygons.json"
SURFACE_PLATE_FORMAT = "isometric-berlin-surface-plate"
SURFACE_PLATE_STAGE = "post-earcut-pre-terrain-drape"
SURFACE_PLATE_MAGIC = b"ISOPLT01"
SURFACE_PLATE_HEADER_BYTES = 32
SURFACE_PLATE_SCHEMA_VERSION = 1
SURFACE_PLATE_KIND_CODES = {"asphalt": 1, "paving": 2}
# The compressed download must remain below AGENTS.md's 200 MB ceiling. The
# extracted offline copy has a separate 240 MiB integrity ceiling: the task-13
# 500 m ring measures 238,895,458 extracted bytes (227.8 MiB), while both
# compressed archives remain below the 200 MiB download ceiling. The compact
# 2.22 MiB ground-only startup context covers the owner-approved task-13 hull
# without thinning and saves roughly 146 MiB of normal cold-start requests, so
# retaining it is materially more useful than the former 1 MiB micro-budget.
MAX_PACKAGE_UNCOMPRESSED_BYTES = 240 * 1024 * 1024
MIN_BOUNDED_MESH_TILES = 23
MIN_BASE_MESH_FACES = 2_250_000
MIN_SETTLED_SURFACE_FACES = 6_000_000
REQUIRED_BASE_TARGET_FACES = 100_000
REQUIRED_SETTLED_TARGET_FACES = 289_797
REQUIRED_BASE_NORMAL_CREASE_DEGREES = 58.0
REQUIRED_BASE_SIMPLIFICATION_AGGRESSION = 5
REQUIRED_MESHOPT_POSITION_BITS = 16
REQUIRED_MESHOPT_NORMAL_BITS = 8
# Task 11 adds three bounded edge tiles while retaining the existing 22 lazy
# hero parts. Mobile still requests only the 29.9 MiB interaction tier; desktop
# streams the settled tier and hero groups progressively instead of keeping the
# complete archive resident. This is an offline/download ceiling, not a live
# GPU-memory target.
MAX_WEBGL_SCENE_BYTES = 178 * 1024 * 1024
BOUNDED_PREVIEW_FILES = ("overview.png", "overview_source.png", "reference_map.png")
REQUIRED_PACKAGE_ENTRIES = (
  "START-HERE.html",
  "README.txt",
  "package-manifest.json",
  "serve-local.py",
  "start-mac-if-needed.txt",
  "start-windows.bat",
  "start-linux.sh",
  "index.html",
  "favicon.svg",
  "dzi/regierungsviertel/overview.png",
  "dzi/regierungsviertel/overview_source.png",
  "dzi/regierungsviertel/reference_map.png",
  "dzi/regierungsviertel/regierungsviertel.dzi",
  "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg",
  "dzi/regierungsviertel/tiergartentunnel.json",
  "dzi/regierungsviertel/visual_reference_attribution.json",
  "mesh/regierungsviertel/scene.json",
  "mesh/regierungsviertel/ground-context.json",
  f"mesh/regierungsviertel/{SURFACE_MANIFEST_FILE}",
  f"mesh/regierungsviertel/{SURFACE_SOURCE_FILE}",
  "mesh/regierungsviertel/tile-3894_58196.glb",
)
REQUIRED_ATTRIBUTION = (
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)"
)
REQUIRED_KINDERTRANSPORT_VISUAL_ATTRIBUTION = (
  "Kindertransport visual references: © Pauline Ahrens, 2021 / "
  "Bildhauerei in Berlin (CC BY 4.0)"
)
REQUIRED_KINDERTRANSPORT_REFERENCE_FILES = {
  "MIT_095_1_Pauline_Ahrens_2021.jpg",
  "MIT_095_3_Pauline_Ahrens_2021.jpg",
  "MIT_095_6_Pauline_Ahrens_2021.jpg",
  "MIT_095_7_Pauline_Ahrens_2021.jpg",
  "MIT_095_13_Pauline_Ahrens_2021.jpg",
}
REQUIRED_HERO_MESHES = {
  "reichstag",
  "bundeskanzleramt",
  "hauptbahnhof",
  "brandenburger-tor",
}


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


def package_source_hygiene_failures(root: Path) -> list[str]:
  """Reject package-source cruft without making Finder metadata a flaky gate."""
  failures: list[str] = []
  scan_roots = [
    (root / "src" / "app" / "public", False),
    (root / "src" / "app" / "dist", True),
  ]
  for scan_root, generated_build in scan_roots:
    if not scan_root.exists():
      continue
    for path in scan_root.rglob("*"):
      relative = path.relative_to(scan_root)
      if generated_build and path.name == ".DS_Store":
        continue
      if has_forbidden_duplicate_name(relative):
        failures.append(f"Unwanted duplicate/hidden package path: {path}")
  return failures


def package_arcname(relative: str) -> str:
  return f"{PACKAGE_NAME}/{relative}"


def expected_download_url(version: str) -> str:
  return (
    "https://github.com/Klotzkette/isometric-berlin/releases/download/"
    f"v{version}/{PACKAGE_ZIP}"
  )


def static_archive_name(version: str) -> str:
  return f"isometric-berlin-viewer-v{version}.tar.gz"


def _js_number_to_string(value: int | float) -> str:
  """Match the finite-number spelling used by JavaScript JSON.stringify."""
  try:
    number = float(value)
  except OverflowError as exc:
    raise ValueError("JSON number is outside JavaScript's finite range") from exc
  if not math.isfinite(number):
    raise ValueError("surface source contains a non-finite JSON number")
  if number == 0:
    return "0"

  negative = number < 0
  spelling = repr(abs(number))
  if "e" in spelling:
    coefficient, exponent_text = spelling.split("e", 1)
    exponent = int(exponent_text)
  else:
    coefficient = spelling
    exponent = 0
  if "." in coefficient:
    whole, fraction = coefficient.split(".", 1)
  else:
    whole, fraction = coefficient, ""
  digits = (whole + fraction).lstrip("0")
  decimal_exponent = exponent - len(fraction)
  while len(digits) > 1 and digits.endswith("0"):
    digits = digits[:-1]
    decimal_exponent += 1

  digit_count = len(digits)
  decimal_point = digit_count + decimal_exponent
  if -6 < decimal_point <= 0:
    result = f"0.{('0' * -decimal_point)}{digits}"
  elif digit_count <= decimal_point <= 21:
    result = f"{digits}{'0' * (decimal_point - digit_count)}"
  elif 0 < decimal_point <= 21:
    result = f"{digits[:decimal_point]}.{digits[decimal_point:]}"
  else:
    mantissa = digits[0]
    if digit_count > 1:
      mantissa = f"{mantissa}.{digits[1:]}"
    scientific_exponent = decimal_point - 1
    sign = "+" if scientific_exponent >= 0 else ""
    result = f"{mantissa}e{sign}{scientific_exponent}"
  return f"-{result}" if negative else result


def _js_array_index(key: str) -> int | None:
  """Return the ECMAScript array-index value used for object-key ordering."""
  if not key or not key.isascii() or not key.isdigit():
    return None
  if key != "0" and key.startswith("0"):
    return None
  index = int(key)
  if index >= 2**32 - 1 or str(index) != key:
    return None
  return index


def _js_json_stringify(value: object) -> str:
  """Serialize parsed JSON with JSON.stringify's insertion/key ordering."""
  if value is None:
    return "null"
  if value is True:
    return "true"
  if value is False:
    return "false"
  if isinstance(value, str):
    return json.dumps(value, ensure_ascii=False)
  if isinstance(value, int | float):
    return _js_number_to_string(value)
  if isinstance(value, list):
    return f"[{','.join(_js_json_stringify(item) for item in value)}]"
  if isinstance(value, dict):
    indexed: list[tuple[int, str, object]] = []
    named: list[tuple[str, object]] = []
    for key, item in value.items():
      if not isinstance(key, str):
        raise ValueError("surface source has a non-string object key")
      index = _js_array_index(key)
      if index is None:
        named.append((key, item))
      else:
        indexed.append((index, key, item))
    ordered = [(key, item) for _, key, item in sorted(indexed)] + named
    return (
      "{"
      + ",".join(
        f"{json.dumps(key, ensure_ascii=False)}:{_js_json_stringify(item)}"
        for key, item in ordered
      )
      + "}"
    )
  raise ValueError(f"surface source contains unsupported JSON value {type(value)!r}")


def canonical_surface_source_sha256(data: bytes) -> str:
  """Hash parsed surface JSON exactly as the browser's JSON.stringify does."""

  def reject_constant(value: str) -> object:
    raise ValueError(f"invalid JSON constant {value}")

  payload = json.loads(data.decode("utf-8"), parse_constant=reject_constant)
  canonical = _js_json_stringify(payload).encode("utf-8")
  return hashlib.sha256(canonical).hexdigest()


def surface_pretriangulation_manifest_failures(
  manifest: dict[str, object],
  *,
  label: str,
  source_reader: Callable[[str], bytes],
  asset_reader: Callable[[str], bytes],
  actual_plate_names: set[str] | None = None,
) -> list[str]:
  """Validate one progressive pre-triangulation manifest and all plate bytes."""
  failures: list[str] = []
  if manifest.get("format") != SURFACE_PLATE_FORMAT:
    failures.append(f"Surface plate manifest has the wrong format: {label}")
  schema_version = manifest.get("schema_version")
  if type(schema_version) is not int or schema_version != SURFACE_PLATE_SCHEMA_VERSION:
    failures.append(f"Surface plate manifest has the wrong schema version: {label}")
  if manifest.get("stage") != SURFACE_PLATE_STAGE:
    failures.append(f"Surface plate manifest has the wrong build stage: {label}")

  source_file = manifest.get("source_file")
  source_hash = manifest.get("source_sha256")
  if source_file != SURFACE_SOURCE_FILE:
    failures.append(f"Surface plate manifest has the wrong source file: {label}")
  if not isinstance(source_hash, str) or not SHA256_RE.fullmatch(source_hash):
    failures.append(f"Surface plate manifest has an invalid source SHA-256: {label}")
  if source_file == SURFACE_SOURCE_FILE:
    try:
      source_data = source_reader(source_file)
    except (FileNotFoundError, KeyError, OSError):
      failures.append(f"Missing surface source {source_file}: {label}")
    else:
      try:
        actual_source_hash = canonical_surface_source_sha256(source_data)
      except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        failures.append(
          f"Invalid canonical surface source {source_file}: {label}: {exc}"
        )
      else:
        if source_hash != actual_source_hash:
          failures.append(f"Surface source hash mismatch for {source_file}: {label}")

  plates = manifest.get("plates")
  if not isinstance(plates, list) or not plates:
    failures.append(f"Surface plate manifest has no plates: {label}")
    plates = []

  seen_kinds: set[str] = set()
  expected_plate_names: set[str] = set()
  for entry in plates:
    if not isinstance(entry, dict):
      failures.append(f"Surface plate manifest has an invalid plate entry: {label}")
      continue
    kind = entry.get("kind")
    if not isinstance(kind, str) or kind not in SURFACE_PLATE_KIND_CODES:
      failures.append(
        f"Surface plate manifest has an unsupported kind {kind!r}: {label}"
      )
      continue
    if kind in seen_kinds:
      failures.append(f"Surface plate manifest repeats kind {kind!r}: {label}")
    seen_kinds.add(kind)

    relative = entry.get("file")
    if not isinstance(relative, str):
      failures.append(f"Surface plate {kind!r} has no file: {label}")
      continue
    relative_path = PurePosixPath(relative)
    if (
      relative_path.is_absolute()
      or relative_path.name != relative
      or not relative.endswith(".plate.gz")
      or "\\" in relative
    ):
      failures.append(f"Unsafe surface plate path {relative!r}: {label}")
      continue
    if relative in expected_plate_names:
      failures.append(f"Surface plate manifest repeats file {relative!r}: {label}")
    expected_plate_names.add(relative)

    compressed_bytes = entry.get("compressed_bytes")
    raw_bytes = entry.get("raw_bytes")
    vertex_count = entry.get("vertex_count")
    index_count = entry.get("index_count")
    for field, value in (
      ("compressed_bytes", compressed_bytes),
      ("raw_bytes", raw_bytes),
      ("vertex_count", vertex_count),
      ("index_count", index_count),
    ):
      if type(value) is not int or value <= 0:
        failures.append(f"Surface plate {relative!r} has invalid {field}: {label}")

    try:
      compressed = asset_reader(relative)
    except (FileNotFoundError, KeyError, OSError):
      failures.append(f"Missing referenced surface plate {relative}: {label}")
      continue
    if len(compressed) >= MAX_REPOSITORY_BINARY_BYTES:
      failures.append(
        f"Surface plate exceeds the strict 5 MiB limit ({relative}): {label}"
      )
    if type(compressed_bytes) is int and len(compressed) != compressed_bytes:
      failures.append(f"Surface plate compressed byte mismatch for {relative}: {label}")
    try:
      raw = gzip.decompress(compressed)
    except (EOFError, gzip.BadGzipFile, OSError) as exc:
      failures.append(f"Invalid gzip surface plate {relative}: {label}: {exc}")
      continue
    if type(raw_bytes) is int and len(raw) != raw_bytes:
      failures.append(f"Surface plate raw byte mismatch for {relative}: {label}")
    if len(raw) < SURFACE_PLATE_HEADER_BYTES:
      failures.append(f"Surface plate is shorter than its header ({relative}): {label}")
      continue

    (
      magic,
      version,
      kind_code,
      header_vertex_count,
      header_index_count,
      position_bytes,
      index_bytes,
    ) = struct.unpack("<8s6I", raw[:SURFACE_PLATE_HEADER_BYTES])
    if magic != SURFACE_PLATE_MAGIC or version != SURFACE_PLATE_SCHEMA_VERSION:
      failures.append(f"Surface plate has an unsupported header ({relative}): {label}")
    if kind_code != SURFACE_PLATE_KIND_CODES[kind]:
      failures.append(f"Surface plate kind header mismatch for {relative}: {label}")
    if type(vertex_count) is int and header_vertex_count != vertex_count:
      failures.append(f"Surface plate vertex count mismatch for {relative}: {label}")
    if type(index_count) is int and header_index_count != index_count:
      failures.append(f"Surface plate index count mismatch for {relative}: {label}")
    if position_bytes != header_vertex_count * 3 * 4:
      failures.append(f"Surface plate position byte mismatch for {relative}: {label}")
    if index_bytes != header_index_count * 4:
      failures.append(f"Surface plate index byte mismatch for {relative}: {label}")
    if SURFACE_PLATE_HEADER_BYTES + position_bytes + index_bytes != len(raw):
      failures.append(
        f"Surface plate header byte total mismatch for {relative}: {label}"
      )

  if actual_plate_names is not None:
    unexpected = sorted(actual_plate_names - expected_plate_names)
    if unexpected:
      failures.append(f"Unreferenced surface plate files in {label}: {unexpected[:3]}")
  return failures


def surface_pretriangulation_failures(mesh_root: Path) -> list[str]:
  """Validate progressive surface assets in a source/build/package directory."""
  manifest_path = mesh_root / SURFACE_MANIFEST_FILE
  if not manifest_path.exists():
    return [f"Missing surface plate manifest: {manifest_path}"]
  try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
    return [f"Invalid surface plate manifest: {manifest_path}: {exc}"]
  if not isinstance(manifest, dict):
    return [f"Surface plate manifest is not an object: {manifest_path}"]
  actual_plate_names = {
    path.name for path in mesh_root.glob("*.plate.gz") if path.is_file()
  }
  return surface_pretriangulation_manifest_failures(
    manifest,
    label=str(manifest_path),
    source_reader=lambda relative: (mesh_root / relative).read_bytes(),
    asset_reader=lambda relative: (mesh_root / relative).read_bytes(),
    actual_plate_names=actual_plate_names,
  )


def viewer_binary_size_failures(public_dzi: Path) -> list[str]:
  """Keep committed fallback images below the repository binary limit."""
  failures: list[str] = []
  for filename in BOUNDED_PREVIEW_FILES:
    path = public_dzi / filename
    if path.exists() and path.stat().st_size > MAX_REPOSITORY_BINARY_BYTES:
      failures.append(
        f"Bundled viewer asset exceeds 5 MiB repository limit: {path} "
        f"({path.stat().st_size} bytes)"
      )
  return failures


def visual_reference_attribution_failures(path: Path) -> list[str]:
  """Keep every non-Wikimedia CC BY reference auditable in public output."""
  if not path.exists():
    return [f"Missing visual-reference attribution: {path}"]
  try:
    payload = json.loads(path.read_text(encoding="utf-8"))
  except json.JSONDecodeError as exc:
    return [f"Invalid visual-reference attribution: {path}: {exc}"]
  if payload.get("required_attribution") != REQUIRED_KINDERTRANSPORT_VISUAL_ATTRIBUTION:
    return [f"Visual-reference attribution lacks the required public credit: {path}"]
  records = payload.get("records")
  if not isinstance(records, list):
    return [f"Visual-reference attribution has no records: {path}"]
  titles = {
    str(record.get("title", ""))
    for record in records
    if isinstance(record, dict)
    and record.get("artist") == "Pauline Ahrens"
    and record.get("year") == 2021
    and record.get("license") == "CC BY 4.0"
    and record.get("license_url") == "https://creativecommons.org/licenses/by/4.0/"
    and str(record.get("page_url", "")).startswith(
      "https://bildhauerei-in-berlin.de/bildwerk/"
    )
    and str(record.get("file_url", "")).startswith(
      "https://bildhauerei-in-berlin.de/wp-content/uploads/"
    )
  }
  if titles != REQUIRED_KINDERTRANSPORT_REFERENCE_FILES:
    return [f"Visual-reference attribution has incomplete per-file credits: {path}"]
  return []


def webgl_manifest_failures(
  scene: dict[str, object],
  *,
  label: str,
  asset_reader: Callable[[str], bytes],
  actual_asset_names: set[str] | None = None,
) -> list[str]:
  """Validate scene structure and the bytes of every referenced GLB."""
  failures: list[str] = []
  base_tiles = scene.get("base_tiles")
  if not isinstance(base_tiles, list) or len(base_tiles) < MIN_BOUNDED_MESH_TILES:
    failures.append(
      "WebGL scene needs the complete bounded Berlin interaction-tile set "
      f"(at least {MIN_BOUNDED_MESH_TILES}): {label}"
    )
    base_tiles = []
  if base_tiles:
    base_face_count = sum(
      entry.get("faces", 0)
      for entry in base_tiles
      if isinstance(entry, dict) and type(entry.get("faces")) is int
    )
    if base_face_count < MIN_BASE_MESH_FACES:
      failures.append(
        f"WebGL base surface is below the {MIN_BASE_MESH_FACES:,}-face quality "
        f"floor: {label} ({base_face_count:,} faces)"
      )
    invalid_quality_entries = [
      str(entry.get("file", "<unknown>"))
      for entry in base_tiles
      if not isinstance(entry, dict)
      or entry.get("target_faces") != REQUIRED_BASE_TARGET_FACES
      or entry.get("normal_crease_degrees") != REQUIRED_BASE_NORMAL_CREASE_DEGREES
      or entry.get("simplification_aggression")
      != REQUIRED_BASE_SIMPLIFICATION_AGGRESSION
    ]
    if invalid_quality_entries:
      failures.append(
        "WebGL base tiles do not use the required 100k/58-degree/aggression-5 "
        f"surface profile: {label} ({invalid_quality_entries[:3]})"
      )
    invalid_meshopt_entries = [
      str(entry.get("file", "<unknown>"))
      for entry in base_tiles
      if not isinstance(entry, dict)
      or entry.get("meshopt_compressed") is not True
      or entry.get("quantize_position_bits") != REQUIRED_MESHOPT_POSITION_BITS
      or entry.get("quantize_normal_bits") != REQUIRED_MESHOPT_NORMAL_BITS
    ]
    if invalid_meshopt_entries:
      failures.append(
        "WebGL base tiles lack the required Meshopt 16-bit-position/8-bit-normal "
        f"profile: {label} ({invalid_meshopt_entries[:3]})"
      )
  surface_tiles = scene.get("surface_detail_tiles")
  if not isinstance(surface_tiles, list) or len(surface_tiles) < len(base_tiles):
    failures.append(
      "WebGL scene needs one settled surface-detail tile for every bounded "
      f"interaction tile: {label}"
    )
    surface_tiles = []
  elif base_tiles:
    base_tile_ids = {
      str(entry["tile_id"])
      for entry in base_tiles
      if isinstance(entry, dict) and entry.get("tile_id")
    }
    surface_tile_ids = {
      str(entry["tile_id"])
      for entry in surface_tiles
      if isinstance(entry, dict) and entry.get("tile_id")
    }
    missing_tile_ids = sorted(base_tile_ids - surface_tile_ids)
    if missing_tile_ids:
      failures.append(
        "WebGL settled surface misses bounded tile IDs: "
        f"{label} ({missing_tile_ids[:3]})"
      )
  if surface_tiles:
    surface_face_count = sum(
      entry.get("faces", 0)
      for entry in surface_tiles
      if isinstance(entry, dict) and type(entry.get("faces")) is int
    )
    if surface_face_count < MIN_SETTLED_SURFACE_FACES:
      failures.append(
        f"WebGL settled surface is below the {MIN_SETTLED_SURFACE_FACES:,}-face "
        f"quality floor: {label} ({surface_face_count:,} faces)"
      )
    invalid_surface_entries = [
      str(entry.get("file", "<unknown>"))
      for entry in surface_tiles
      if not isinstance(entry, dict)
      or entry.get("target_faces") != REQUIRED_SETTLED_TARGET_FACES
      or entry.get("normal_crease_degrees") != REQUIRED_BASE_NORMAL_CREASE_DEGREES
      or entry.get("simplification_aggression")
      != REQUIRED_BASE_SIMPLIFICATION_AGGRESSION
      or entry.get("meshopt_compressed") is not True
      or entry.get("quantize_position_bits") != REQUIRED_MESHOPT_POSITION_BITS
      or entry.get("quantize_normal_bits") != REQUIRED_MESHOPT_NORMAL_BITS
    ]
    if invalid_surface_entries:
      failures.append(
        "WebGL settled tiles do not use the required "
        "289797-face/58-degree/aggression-5/Meshopt profile: "
        f"{label} ({invalid_surface_entries[:3]})"
      )
  hero_details = scene.get("hero_details")
  if not isinstance(hero_details, list):
    failures.append(f"WebGL scene lacks hero details: {label}")
    hero_details = []
  hero_ids = {
    str(hero.get("id"))
    for hero in hero_details
    if isinstance(hero, dict) and hero.get("files")
  }
  if not REQUIRED_HERO_MESHES.issubset(hero_ids):
    failures.append(
      f"WebGL scene lacks required hero mesh groups: {label} "
      f"({sorted(REQUIRED_HERO_MESHES - hero_ids)})"
    )
  hero_files = [
    file
    for hero in hero_details
    if isinstance(hero, dict)
    for file in hero.get("files", [])
    if isinstance(file, dict)
  ]
  invalid_hero_entries = [
    str(entry.get("file", "<unknown>"))
    for entry in hero_files
    if entry.get("meshopt_compressed") is not True
    or entry.get("quantize_position_bits") != REQUIRED_MESHOPT_POSITION_BITS
    or entry.get("quantize_normal_bits") != REQUIRED_MESHOPT_NORMAL_BITS
    or not isinstance(entry.get("texture_max_edge"), int)
    or int(entry["texture_max_edge"]) > 1600
  ]
  if invalid_hero_entries:
    failures.append(
      "WebGL hero crops lack the required Meshopt/1600px texture profile: "
      f"{label} ({invalid_hero_entries[:3]})"
    )
  tunnel = scene.get("tiergartentunnel")
  if not isinstance(tunnel, dict) or len(tunnel.get("points", [])) < 8:
    failures.append(f"WebGL scene lacks 3D Tiergartentunnel route: {label}")
  signatures = scene.get("architectural_signatures")
  reichstag_dome = next(
    (
      signature
      for signature in signatures or []
      if isinstance(signature, dict) and signature.get("id") == "reichstag-dome"
    ),
    None,
  )
  if (
    not isinstance(reichstag_dome, dict)
    or reichstag_dome.get("height_m") != 23.5
    or reichstag_dome.get("diameter_m") != 40.0
    or reichstag_dome.get("vertical_ribs") != 24
    or reichstag_dome.get("horizontal_rings") != 17
    or "bundestag.de" not in str(reichstag_dome.get("source_url", ""))
  ):
    failures.append(f"WebGL scene lacks the official-dimension Reichstag dome: {label}")

  signature_by_id = {
    str(signature.get("id")): signature
    for signature in signatures or []
    if isinstance(signature, dict)
  }
  recognition_requirements = {
    "reichstag-model": {
      "width_m": 100.0,
      "depth_m": 138.0,
    },
    "bundeskanzleramt-model": {
      "cube_height_m": 36.0,
      "office_height_m": 18.0,
    },
    "hauptbahnhof-model": {
      "east_west_roof_length_m": 321.0,
      "north_south_hall_length_m": 180.0,
      "north_south_hall_width_m": 42.0,
      "office_bridge_height_m": 46.0,
    },
    "brandenburger-tor-model": {
      "width_m": 62.5,
      "depth_m": 11.0,
      "total_height_m": 26.0,
      "column_rows": 2,
      "columns_per_row": 6,
    },
  }
  for signature_id, requirements in recognition_requirements.items():
    signature = signature_by_id.get(signature_id)
    if not isinstance(signature, dict) or any(
      signature.get(field) != expected for field, expected in requirements.items()
    ):
      failures.append(
        f"WebGL scene lacks metric recognition signature {signature_id}: {label}"
      )
      continue
    rotation = signature.get("rotation_y_degrees")
    if (
      not isinstance(rotation, (int, float))
      or isinstance(rotation, bool)
      or not math.isfinite(rotation)
    ):
      failures.append(
        f"WebGL recognition signature lacks a finite LoD2 rotation "
        f"{signature_id}: {label}"
      )
  station_signature = signature_by_id.get("hauptbahnhof-model")
  station_rotation = (
    station_signature.get("rotation_y_degrees")
    if isinstance(station_signature, dict)
    else None
  )
  if not isinstance(station_rotation, (int, float)) or not (
    15.0 <= abs(station_rotation) <= 30.0
  ):
    failures.append(
      f"WebGL Hauptbahnhof model is not aligned to its rotated LoD2 hall: {label}"
    )
  chancellery_signature = signature_by_id.get("bundeskanzleramt-model")
  if (
    not isinstance(chancellery_signature, dict)
    or len(chancellery_signature.get("office_segments", [])) < 3
  ):
    failures.append(
      f"WebGL scene lacks LoD2-aligned Chancellery office segments: {label}"
    )

  files = [*base_tiles, *surface_tiles]
  files.extend(
    file
    for hero in hero_details
    if isinstance(hero, dict)
    for file in hero.get("files", [])
  )
  asset_cache: dict[str, bytes] = {}
  expected_asset_names: set[str] = set()
  for entry in files:
    if not isinstance(entry, dict) or not entry.get("file"):
      failures.append(f"Invalid WebGL asset entry: {label}")
      continue
    relative = str(entry["file"])
    relative_path = Path(relative)
    if (
      relative_path.is_absolute()
      or relative_path.suffix.lower() != ".glb"
      or relative_path.as_posix() != relative
      or ".." in relative_path.parts
      or "\\" in relative
    ):
      failures.append(f"Unsafe WebGL asset path {relative!r}: {label}")
      continue
    expected_asset_names.add(relative)
    expected_size = entry.get("bytes")
    expected_hash = entry.get("sha256")
    if entry.get("includes_normals") is not True:
      failures.append(f"WebGL asset lacks bundled normals flag for {relative}: {label}")
    if type(expected_size) is not int or expected_size <= 0:
      failures.append(f"WebGL asset has invalid byte count for {relative}: {label}")
    if not isinstance(expected_hash, str) or not SHA256_RE.fullmatch(expected_hash):
      failures.append(f"WebGL asset has invalid SHA-256 for {relative}: {label}")

    if relative in asset_cache:
      data = asset_cache[relative]
    else:
      try:
        data = asset_reader(relative)
      except (FileNotFoundError, KeyError, OSError):
        failures.append(f"Missing referenced WebGL asset {relative}: {label}")
        continue
      asset_cache[relative] = data
    actual_size = len(data)
    if actual_size > MAX_REPOSITORY_BINARY_BYTES:
      failures.append(
        f"WebGL asset exceeds 5 MiB repository limit ({relative}): {label}"
      )
    if type(expected_size) is int and actual_size != expected_size:
      failures.append(f"WebGL asset size mismatch for {relative}: {label}")
    if (
      isinstance(expected_hash, str)
      and SHA256_RE.fullmatch(expected_hash)
      and hashlib.sha256(data).hexdigest() != expected_hash
    ):
      failures.append(f"WebGL asset hash mismatch for {relative}: {label}")

  total_bytes = sum(len(data) for data in asset_cache.values())
  if total_bytes > MAX_WEBGL_SCENE_BYTES:
    failures.append(
      "WebGL scene exceeds "
      f"{MAX_WEBGL_SCENE_BYTES // 1024 // 1024} MiB progressive offline budget: "
      f"{total_bytes} bytes"
    )
  if actual_asset_names is not None:
    for relative in sorted(actual_asset_names - expected_asset_names):
      failures.append(f"Unreferenced WebGL asset {relative}: {label}")
  source = scene.get("source")
  attribution = str(source.get("attribution", "")) if isinstance(source, dict) else ""
  if "Berlin Partner für Wirtschaft und Technologie GmbH" not in attribution:
    failures.append(f"WebGL scene lacks Berlin Partner attribution: {label}")
  return failures


def webgl_scene_failures(public_mesh: Path) -> list[str]:
  """Validate the bounded official-mesh scene and every referenced GLB."""
  scene_path = public_mesh / "scene.json"
  ground_context = public_mesh / "ground-context.json"
  if not scene_path.exists():
    return [f"Missing bundled WebGL scene: {scene_path}"]
  if not ground_context.exists():
    return [f"Missing fast-start ground context: {ground_context}"]
  if ground_context.stat().st_size > MAX_GROUND_CONTEXT_BYTES:
    return [
      "Fast-start ground context exceeds "
      f"{MAX_GROUND_CONTEXT_BYTES // 1024 // 1024} MiB: {ground_context}"
    ]
  try:
    ground_payload = json.loads(ground_context.read_text(encoding="utf-8"))
  except json.JSONDecodeError as exc:
    return [f"Invalid fast-start ground context: {ground_context}: {exc}"]
  building_rows = None
  tree_rows = None
  if isinstance(ground_payload, dict):
    building_rows = ground_payload.get("building_rows", ground_payload.get("buildings"))
    tree_rows = ground_payload.get("tree_rows", ground_payload.get("trees"))
  if (
    not isinstance(ground_payload, dict)
    or building_rows != []
    or tree_rows != []
    or not ground_payload.get("ground_rows")
    or not ground_payload.get("ground_height")
  ):
    return [
      f"Fast-start ground context has an invalid terrain subset: {ground_context}"
    ]
  try:
    scene = json.loads(scene_path.read_text(encoding="utf-8"))
  except json.JSONDecodeError as exc:
    return [f"Invalid WebGL scene manifest: {scene_path}: {exc}"]
  if not isinstance(scene, dict):
    return [f"WebGL scene manifest is not an object: {scene_path}"]

  actual_asset_names = {
    path.relative_to(public_mesh).as_posix() for path in public_mesh.rglob("*.glb")
  }
  return webgl_manifest_failures(
    scene,
    label=str(scene_path),
    asset_reader=lambda relative: (public_mesh / relative).read_bytes(),
    actual_asset_names=actual_asset_names,
  )


def webgl_viewer_source_failures(root: Path) -> list[str]:
  """Keep the true-3D, selected-only and touch interaction contracts intact."""
  viewer_path = root / "src/app/src/ThreeViewer.tsx"
  app_path = root / "src/app/src/App.tsx"
  architecture_path = root / "src/app/src/ArchitecturalLandmarks.ts"
  cultural_path = root / "src/app/src/CulturalLandmarks.ts"
  localization_path = root / "src/app/src/localization.ts"
  ambient_path = root / "src/app/src/AmbientSoundscape.ts"
  crisp_path = root / "src/app/src/crisp.frag"
  memorial_path = root / "src/app/src/MemorialLandmarks.ts"
  queer_memorial_path = root / "src/app/src/QueerRainbowMemorial.ts"
  csd_attack_memorial_path = root / "src/app/src/CsdAttackMemorial.ts"
  invalidenfriedhof_path = root / "src/app/src/InvalidenfriedhofDetails.ts"
  park_path = root / "src/app/src/ParkDetails.ts"
  project_metadata_path = root / "src/app/src/projectMetadata.ts"
  camera_navigation_path = root / "src/app/src/cameraNavigation.ts"
  render_quality_path = root / "src/app/src/renderQuality.ts"
  surface_quality_path = root / "src/app/src/surfaceQuality.ts"
  styles_path = root / "src/app/src/styles.css"
  tunnel_portals_path = root / "src/app/src/TunnelPortals.ts"
  if (
    not viewer_path.exists()
    or not app_path.exists()
    or not architecture_path.exists()
    or not cultural_path.exists()
    or not localization_path.exists()
    or not ambient_path.exists()
    or not crisp_path.exists()
    or not memorial_path.exists()
    or not queer_memorial_path.exists()
    or not csd_attack_memorial_path.exists()
    or not invalidenfriedhof_path.exists()
    or not park_path.exists()
    or not project_metadata_path.exists()
    or not camera_navigation_path.exists()
    or not render_quality_path.exists()
    or not surface_quality_path.exists()
    or not styles_path.exists()
    or not tunnel_portals_path.exists()
  ):
    return ["Missing true-3D viewer sources"]
  viewer = viewer_path.read_text(encoding="utf-8")
  app = app_path.read_text(encoding="utf-8")
  architecture = architecture_path.read_text(encoding="utf-8")
  cultural = cultural_path.read_text(encoding="utf-8")
  localization = localization_path.read_text(encoding="utf-8")
  ambient = ambient_path.read_text(encoding="utf-8")
  crisp = crisp_path.read_text(encoding="utf-8")
  memorial = memorial_path.read_text(encoding="utf-8")
  queer_memorial = queer_memorial_path.read_text(encoding="utf-8")
  csd_attack_memorial = csd_attack_memorial_path.read_text(encoding="utf-8")
  invalidenfriedhof = invalidenfriedhof_path.read_text(encoding="utf-8")
  park = park_path.read_text(encoding="utf-8")
  project_metadata = project_metadata_path.read_text(encoding="utf-8")
  camera_navigation = camera_navigation_path.read_text(encoding="utf-8")
  render_quality = render_quality_path.read_text(encoding="utf-8")
  surface_quality = surface_quality_path.read_text(encoding="utf-8")
  styles = styles_path.read_text(encoding="utf-8")
  tunnel_portals = tunnel_portals_path.read_text(encoding="utf-8")
  required_viewer_snippets = {
    "two-finger rotate/zoom": "TWO: TOUCH.DOLLY_ROTATE",
    "three-finger gesture": "touchPoints.size >= 3",
    "three-finger underside": "setModelMaterialState(runtime, polar > Math.PI / 2)",
    "full underside orbit": "controls.maxPolarAngle = Math.PI - 0.06",
    "late-loaded underside materials": (
      "material.side = runtime.underside ? DoubleSide : FrontSide"
    ),
    "drawn building facades (no photo textures)": "applyDrawnFacade(material, { anchor: facadeAnchor })",
    "hidden default marker": "marker.visible = false",
    "bounded hero-detail cache": "heroDetailEvictions",
    "GPU texture disposal": "texture.dispose()",
    "retryable model loading": "loadModelWithRetry",
    "nonfatal detail warnings": "onWarningRef.current",
    "WebGL context-loss fallback": 'addEventListener("webglcontextlost"',
    "full-rate camera movement": "ACTIVE_MOTION_FRAME_INTERVAL_MS",
    "motion-stable transparent ink": "material.depthWrite = false",
    "resting framebuffer hold": "const renderRequired =",
    "reuse bundled mesh normals": (
      '!detail && !object.geometry.getAttribute("normal")'
    ),
    "instanced tunnel fixtures": ('"Tiergartentunnel instanced ceiling lights"'),
    "state-aware tunnel presentation": (
      "runtime.pedestrian.state?.insideTunnel === true ||"
    ),
    "automatic orbit underside detection": ("controls.getPolarAngle() > Math.PI / 2;"),
    "exact tunnel-corridor detection": "createTunnelInteriorTester(",
    "granular memorial layer": "createMemorialLandmarks(manifest.landmarks)",
    "Ahornsteig rainbow memorial layer": "createQueerRainbowMemorial()",
    "separate CSD attack memorial layer": "createCsdAttackMemorial()",
    "stale mobile hero cancellation": (
      "runtime.coarsePointer && selectedRef.current !== name"
    ),
    "disposed queue cancellation": "shouldStop: () => runtime.disposed",
    "lost pointer-capture recovery": '"lostpointercapture"',
    "window-blur gesture recovery": 'window.addEventListener("blur"',
    "decoded texture-image disposal": "image.close()",
    "stable GPU-bounded pixel ratio": "renderPixelRatio({",
    "day/night scene lighting": (
      "setSceneLighting(runtime, lightingMode, nightLightsOn)"
    ),
    "temporary selected marker": "runtime.markerTimer = window.setTimeout",
    "static selected marker": "marker.visible = false",
    "Meshopt decoder": "setMeshoptDecoder(MeshoptDecoder)",
    "compact fast-start terrain": "GROUND_CONTEXT_FILE",
    "demand-only photographic shell": "photographicSurfaceNeeded(",
    "seven-million-plus official-source presentation": '"settled-7m-plus"',
    "settled-only official-tree detail gate": (
      "setParkSettledDetail(runtime.parkDetails, settled)"
    ),
    "mode-locked surface tier": (
      "setSurfacePresentation(runtime, stability.pinInteractionSurface)"
    ),
    "keyboard and button quality swap": "markSurfaceInteraction(runtime)",
    "inspectable surface tier": "dataset.surfaceQuality",
    "exact pointer-up camera rest": "controls.enableDamping = false",
    "immediate continuous keyboard flight": "continuousFlightSpeeds(distance)",
    "faster direct orbit response": "controls.rotateSpeed = 1.08",
    "stuck touch watchdog": "timestamp - lastTouchActivityAt > 10_000",
    "global pointer release recovery": 'window.addEventListener("pointerup"',
    "hidden-tab gesture recovery": 'document.addEventListener("visibilitychange"',
    "camera rig stabilization": "stabilizeCameraRig(",
    "two-finger direct pan": "twoFingerPanFlight(",
    "midpoint-anchored pinch/double-click zoom": "zoomCameraAtScreenPoint(",
    "direct primary-button pan mapping": (
      "controls.mouseButtons = THREE_MOUSE_GESTURE_SETTINGS"
    ),
    "flat-unlit architectural signatures": "markAuthoredFlatUnlit(model)",
    "flat-unlit memorials": "markAuthoredFlatUnlit(runtime.monuments)",
    # v0.70.10: every crisp profile is neutral, so running the pass only burns
    # a full-screen half-float read/write. The disabled pass plus permanent
    # SMAA final resolve keeps motion/rest pixels on one stable pipeline.
    "disabled neutral crisp pass": "crispPass.enabled = false",
    "permanent final SMAA resolve": "smaaPass.enabled = true",
    "co-planar ink depth stabilization": "stableInkViewBias",
  }
  failures = [
    f"True-3D viewer lacks {label}: {viewer_path}"
    for label, snippet in required_viewer_snippets.items()
    if snippet not in viewer
  ]
  required_render_quality_snippets = {
    "uncapped interaction cadence": "ACTIVE_MOTION_FRAME_INTERVAL_MS = 0",
    "stable 2x desktop quality": "STABLE_DESKTOP_PIXEL_RATIO_CAP = 2",
    "stable 1.5x touch quality": "STABLE_TOUCH_PIXEL_RATIO_CAP = 1.5",
    "fixed desktop GPU budget": "STABLE_DESKTOP_PIXEL_BUDGET = 10_000_000",
    "fixed touch GPU budget": "STABLE_TOUCH_PIXEL_BUDGET = 4_400_000",
    "integer-stable WebGL viewport": "export function stableViewportSize(",
  }
  failures.extend(
    f"3D render-quality policy lacks {label}: {render_quality_path}"
    for label, snippet in required_render_quality_snippets.items()
    if snippet not in render_quality
  )
  if "detailReady && !coarsePointer && !interactionTierLocked" not in surface_quality:
    failures.append(
      f"3D surface quality policy lacks stable mode gating: {surface_quality_path}"
    )
  if "`app-shell--viewer-${viewerMode}`" not in app:
    failures.append(f"Viewer lacks a compositor-isolation mode class: {app_path}")
  for compositor_contract in (
    ".app-shell--viewer-three .viewer",
    "visibility: hidden",
    ".app-shell--viewer-three .map-stage::after",
    "-webkit-backdrop-filter: none",
    "contain: strict",
  ):
    if compositor_contract not in styles:
      failures.append(
        f"3D compositor isolation lacks {compositor_contract!r}: {styles_path}"
      )
  for forbidden_runtime_switch in (
    "coarsePointer ? 1000 / 30 : 0",
    "nextPixelRatioMode(",
    "nextSettledDetailMode(",
    "timestamp / 1000",
    "controls.enableDamping = true",
    "timestamp < settleUntil",
    "timestamp < runtime.interactionUntil",
    "flightVelocity.lerp",
  ):
    if forbidden_runtime_switch in viewer:
      failures.append(
        "3D viewer contains a time/input-driven visual switch: "
        f"{forbidden_runtime_switch}"
      )
  required_tunnel_portal_snippets = {
    "tagged construction-only tunnel bore interiors": (
      "tiergartentunnelPortalInterior"
    ),
    "default-hidden tunnel bore interiors": "object.visible = false",
    "explicit in-tunnel bore reveal": (
      "const interiorVisible = revealInterior && !underside"
    ),
    "underside portal suppression": "group.visible = !underside",
  }
  failures.extend(
    f"Tunnel portal presentation lacks {label}: {tunnel_portals_path}"
    for label, snippet in required_tunnel_portal_snippets.items()
    if snippet not in tunnel_portals
  )
  if "Tiergartentunnel buried ground occlusion cap" in tunnel_portals:
    failures.append(
      "Tunnel portal presentation contains a route-spanning surface cap: "
      f"{tunnel_portals_path}"
    )
  if "!underside && !voxelMode && revealInterior" in tunnel_portals:
    failures.append(
      "Tunnel portal presentation can reveal a buried helper bore in an "
      f"exterior view: {tunnel_portals_path}"
    )
  if "marker.scale.setScalar" in viewer or "marker-pulse" in styles:
    failures.append(
      "Selected sight marker contains an idle pulse that can look like flicker"
    )
  if 'marker.className = "map-marker map-marker--selected"' not in app:
    failures.append(f"DZI fallback lacks selected-only marker: {app_path}")
  if "isThreeReady && keepThreeWarm" not in app:
    failures.append(f"Touch mode does not release inactive 3D memory: {app_path}")
  if "toggleLightingMode" not in app or "lightingMode={lightingMode}" not in app:
    failures.append(f"Viewer lacks persistent day/night controls: {app_path}")
  if "openRepository" not in app or "REPOSITORY_URL" not in app:
    failures.append(f"Viewer lacks repository information control: {app_path}")
  if "https://github.com/Klotzkette/isometric-berlin" not in project_metadata:
    failures.append(
      f"Viewer lacks the complete public repository URL: {project_metadata_path}"
    )
  held_navigation_contract = (
    "heldNavigationInput(",
    "setPanInput(pan.horizontal, pan.vertical)",
    "setFlightInput(flight.strafe, flight.forward, 0)",
    "setOrbitInput(orbit.horizontal, orbit.vertical)",
    "event.shiftKey",
    "event.altKey",
  )
  if any(snippet not in app for snippet in held_navigation_contract):
    failures.append(
      f"Viewer lacks continuous pan, heading-flight, or orbit input: {app_path}"
    )
  for mode in ("day", "night", "minecraft"):
    if f'selectVisualMode("{mode}")' not in app:
      failures.append(f"Viewer lacks direct {mode} mode selection: {app_path}")
  if (
    'attractions: "Sehenswürdigkeiten"' not in localization
    or 'attraction: "Sehenswürdigkeit"' not in localization
    or "Landmarken" in localization
  ):
    failures.append(
      f"Viewer lacks correct bilingual sight terminology: {localization_path}"
    )
  if "AMBIENT_VARIANTS" not in ambient or ambient.count('name: "') != 7:
    failures.append(f"Viewer lacks seven original ambient variants: {ambient_path}")
  if "toggleMusic" not in app or "new AmbientSoundscape" not in app:
    failures.append(f"Viewer lacks an explicit music control: {app_path}")
  discovery_path = root / "src/app/src/discoveryNotes.ts"
  if (
    discovery_path.exists() or "discoveryNoteFor" in app or ".discovery-note" in styles
  ):
    failures.append(f"Viewer still contains unsolicited location quips: {app_path}")
  if "neighbours * 0.25" not in crisp or "uniform float strength" not in crisp:
    failures.append(f"Viewer lacks the bounded settled-image crisp pass: {crisp_path}")
  required_memorial_snippets = {
    # v0.69.0: the field is generated from the documented figures in
    # holocaustField.ts (2711 stelae, 0.95 m alleys in both directions),
    # so the readiness gate checks that source instead of the old
    # hand-banded lattice it replaced.
    "complete Holocaust stela field": "holocaustStelePlacements()",
    "documented Holocaust stele count": "HOLOCAUST_FIELD.steleCount",
    "official-mesh ground placement": "MEMORIAL_GROUND_Y",
    "mobile-safe Holocaust shadow budget": "stelae.castShadow = false",
    "Soviet memorial T-34/76 tanks": 'vehicleType = "T-34/76"',
    "2026 Jehovah's Witnesses memorial": (
      "Jehovahs Witnesses memorial stacked bronze discs"
    ),
    "2025 Gedenkort für Polen erratic": "Polish memorial Findling",
  }
  failures.extend(
    f"Memorial models lack {label}: {memorial_path}"
    for label, snippet in required_memorial_snippets.items()
    if snippet not in memorial
  )
  required_queer_memorial_snippets = {
    "owner-supplied metric anchor": "worldM: [40.647, 4.479, 660.01]",
    "retained source ground sample": "sourceGroundYM: 4.057",
    "surface-fitted display base": "renderedGroundYM: 4.479",
    "explicit non-survey status": "field-view-bounded tree and memorial",
    "dense batched flowers": "flowerCount: 132",
    "night-only candle flames": "Queer Rainbow Memorial candle flames",
    "local night candle pools": "Queer Rainbow Memorial candle pool light",
    "snow-only crown caps": "Queer Rainbow Memorial snow crown caps",
    "deterministic snow switch": "setQueerRainbowMemorialSnow",
  }
  failures.extend(
    f"Queer Rainbow Memorial lacks {label}: {queer_memorial_path}"
    for label, snippet in required_queer_memorial_snippets.items()
    if snippet not in queer_memorial
  )
  required_csd_attack_memorial_snippets = {
    "new OSM source identity": 'CSD_ATTACK_MEMORIAL_OSM_KEY = "node/14076715427"',
    "independent new-site anchor": "worldM: [-115.6634, 3.3105, 714.3809]",
    "documented French maple": "Französischer Ahorn (Acer monspessulanum)",
    "already leafy young crown": "CSD attack memorial young French maple leaves",
    "round metal guard": "CSD attack memorial round metal guard vertical rods",
    "six-colour rainbow bench": "CSD attack memorial rainbow bench slats",
    "static Pride offerings": "CSD attack memorial static Pride flag stripes",
    "closed Pride-flag motion policy": (
      'motionPolicy = "static in every mode including Schwellenraum"'
    ),
    "hanging wreaths": "CSD attack memorial hanging wreaths",
    "privacy-safe cards": "CSD attack memorial unlettered cards",
    "exact-Day Schwellenraum subtree": "schwellenraumGeschuetzt: true",
    "disjoint source-driven quiet volumes": "treeProtectionRadiusM: 1.75",
    "separate bench quiet volume": "benchProtectionRadiusM: 1.55",
    "precise pedestrian solids": "export function csdAttackMemorialSolidAt(",
    "deterministic snow switch": "setCsdAttackMemorialSnow",
  }
  failures.extend(
    f"CSD attack memorial lacks {label}: {csd_attack_memorial_path}"
    for label, snippet in required_csd_attack_memorial_snippets.items()
    if snippet not in csd_attack_memorial
  )
  for forbidden in [
    "CanvasTexture",
    "TextureLoader",
    "PointLight",
    "markWindFlag(",
    ".userData.windFlag =",
    ".userData.windFlagInstances =",
  ]:
    if forbidden in csd_attack_memorial:
      failures.append(
        f"CSD attack memorial violates its lightweight static contract, found "
        f"{forbidden}: {csd_attack_memorial_path}"
      )
  required_invalidenfriedhof_snippets = {
    "Scharnhorst lion tomb": 'id: "scharnhorst-lion-tomb"',
    "Witzleben Gothic canopy": 'id: "witzleben-green-canopy-tomb"',
    "Winterfeld OSM-owned pedestal": 'osmKey: "node/279219439"',
    "Kessel fenced grave": 'id: "von-kessel-fenced-slab"',
    "correct Rauch family OSM anchor": 'osmKey: "node/281941696"',
    "absorbed Rauch family legacy marker": '"node/281941700"',
    "August-Viktoria bell OSM anchor": 'osmKey: "node/7430297888"',
    "open bell LoD2 ownership": 'lod2BuildingPartId: "K0001yqp"',
    "documented 1.60 m bell": "displayBellDiameterM: 1.6",
    "Litfin watchtower OSM anchor": 'osmKey: "way/31347999"',
    "Litfin LoD2 ownership": 'lod2BuildingPartId: "1pC0000R"',
    "three-metre Litfin shaft": "shaftFootprintM: [3.0, 3.0]",
    "sixteen Litfin observation panes": "upperPaneCount: 16",
    "eight Litfin small windows": "smallWindowCount: 8",
    "solid Hinterland wall shell": (
      "Invalidenfriedhof Hinterlandmauer continuous grey backing shell"
    ),
    "separate canal brick wall": (
      "Invalidenfriedhof canal wall red brick piers and coping"
    ),
    "all-mode Minecraft signatures": "createMinecraftInvalidenfriedhofDetails",
    "granular physical solids": "export function invalidenfriedhofSolidAt(",
    "source-scoped open bell undercroft": (
      "export function invalidenfriedhofWalkableInteriorAt("
    ),
    "exact LoD2 voxel replacement": (
      "export function invalidenfriedhofVoxelReplacementAt("
    ),
    "deterministic horizontal snow": "setInvalidenfriedhofSnow",
    "reference-only supplied photographs": (
      "Owner-supplied field photographs are reference-only"
    ),
  }
  failures.extend(
    f"Invalidenfriedhof detail layer lacks {label}: {invalidenfriedhof_path}"
    for label, snippet in required_invalidenfriedhof_snippets.items()
    if snippet not in invalidenfriedhof
  )
  for forbidden in [
    "CanvasTexture",
    "TextureLoader",
    "PointLight",
    "markWindFlag(",
    ".userData.windFlag =",
    ".userData.windFlagInstances =",
    "Math.random",
  ]:
    if forbidden in invalidenfriedhof:
      failures.append(
        "Invalidenfriedhof detail layer violates its lightweight static "
        f"contract, found {forbidden}: {invalidenfriedhof_path}"
      )
  required_park_snippets = {
    "official settled tree microcrowns": (
      "Geoportal Berlin settled-only official tree microcrowns"
    ),
    "official tree-only detail filter": 'tree.source === "berlin_official"',
    "settled detail visibility switch": "setParkSettledDetail",
  }
  failures.extend(
    f"Park detail layer lacks {label}: {park_path}"
    for label, snippet in required_park_snippets.items()
    if snippet not in park
  )
  required_camera_snippets = {
    "screen-relative flight": "screenRelativeFlightDelta",
    "bounded flight volume": "REGIERUNGSVIERTEL_FLIGHT_BOUNDS",
    "camera-target translation": "camera.position.add(applied)",
    "cursor-anchored zoom": "zoomCameraAtScreenPoint",
    "last-safe camera capture": "captureCameraPose",
    "invalid camera recovery": "stabilizeCameraRig",
    "faster distance-scaled navigation": ("NAVIGATION_STEP_DISTANCE_RATIO = 0.075"),
    "low-latency two-finger gesture decision": ("TWO_FINGER_DECISION_TRAVEL_PX = 6"),
    "faster direct two-finger pan": "TWO_FINGER_PAN_PIXELS_PER_UNIT = 56",
    "ramp-free continuous flight": "export function continuousFlightSpeeds(",
  }
  failures.extend(
    f"Camera navigation lacks {label}: {camera_navigation_path}"
    for label, snippet in required_camera_snippets.items()
    if snippet not in camera_navigation
  )
  required_map_navigation_snippets = {
    "immediate programmatic pan": "viewport.applyConstraints(true)",
    "immediate programmatic zoom": "zoomBy(factor, undefined, true)",
    "short fallback animation": "animationTime: 0.12",
    "immediate tile presentation": "immediateRender: true",
    "responsive map spring": "springStiffness: 18",
  }
  failures.extend(
    f"Map navigation lacks {label}: {app_path}"
    for label, snippet in required_map_navigation_snippets.items()
    if snippet not in app
  )
  required_architecture_snippets = {
    "official-dimension Reichstag dome": "createOfficialReichstagDome",
    "metric Brandenburg Gate columns": "Brandenburg Gate Doric column",
    "metric Hauptbahnhof glass roof": "321 m east-west glass roof",
    "metric Chancellery semicircular windows": (
      "Chancellery semicircular leadership window"
    ),
    "metric Reichstag west portico": "Reichstag west portico column",
  }
  failures.extend(
    f"Architecture models lack {model}: {architecture_path}"
    for model, snippet in required_architecture_snippets.items()
    if snippet not in architecture
  )
  if "selectively lit upper rectangular" in architecture:
    failures.append(
      f"Reichstag upper rectangular windows must remain dark: {architecture_path}"
    )
  if "selectively lit three-bay tower" in architecture:
    failures.append(f"Reichstag tower windows must remain dark: {architecture_path}")
  if "Carillon black-granite tower shaft" in cultural:
    failures.append(
      f"Carillon recognition layer duplicates official mesh pylons: {cultural_path}"
    )
  if "officialMeshCarriesPylons: true" not in cultural:
    failures.append(
      f"Carillon source ownership is not documented in code: {cultural_path}"
    )
  required_mobile_style_snippets = {
    "compact phone breakpoint": "@media (max-width: 768px)",
    "mobile overflow action": ".toolbar .mobile-overflow",
    "safe-area bottom action bar": (
      "bottom: calc(8px + env(safe-area-inset-bottom, 0px))"
    ),
    "four-column compass sheet": (
      "grid-template-columns: repeat(4, minmax(44px, 1fr))"
    ),
    "coarse-pointer tablet layout": ("(max-width: 1024px) and (pointer: coarse)"),
  }
  failures.extend(
    f"Viewer CSS lacks {label}: {styles_path}"
    for label, snippet in required_mobile_style_snippets.items()
    if snippet not in styles
  )
  dome_path = root / "src/app/src/ReichstagDome.ts"
  if not dome_path.exists():
    failures.append(f"Missing official-dimension Reichstag dome source: {dome_path}")
  return failures


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
  if REQUIRED_KINDERTRANSPORT_VISUAL_ATTRIBUTION not in start_here_text:
    failures.append(
      f"Package HTML launcher lacks the Kindertransport photo credit: {label}"
    )
  if (
    "sourceImage" not in start_here_text
    or "landmarkScaleX" not in start_here_text
    or "mapImage.style.width" not in start_here_text
    or "stagePointToImage" not in start_here_text
    or "constrainView" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher does not normalize DZI coordinates to its offline canvas: {label}"
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
    "scene-detail-overlay" not in start_here_text
    or "addSceneDetails" not in start_here_text
    or "details-toggle" not in start_here_text
    or "clouds-toggle" not in start_here_text
    or "performance-toggle" not in start_here_text
    or "setDetails" not in start_here_text
    or "setClouds" not in start_here_text
    or "setPerformance" not in start_here_text
    or "data-performance" not in start_here_text
    or "data-dragging" not in start_here_text
    or "detail-cloud" not in start_here_text
    or "cloud-shadow" not in start_here_text
    or "sunbeam" not in start_here_text
    or "detail-glint" not in start_here_text
    or "detail-ripple" not in start_here_text
    or "detail-tree-cluster" not in start_here_text
    or "detail-water-depth" not in start_here_text
    or "detail-tunnel-branch" not in start_here_text
    or "detail-train-ice" not in start_here_text
    or "detail-train-sbahn" not in start_here_text
    or "detail-vehicle" not in start_here_text
    or "vehicle-light-cone" not in start_here_text
    or "addFlag" not in start_here_text
    or "detail-boat" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks v0.1.57 scene detail/performance overlays: {label}"
    )
  if (
    "PREFERENCE_STORAGE_KEY" not in start_here_text
    or "readPreferences" not in start_here_text
    or "savePreferences" not in start_here_text
    or "localStorage" not in start_here_text
    or "applyQualityImage" not in start_here_text
    or "savedLandmarkName" not in start_here_text
    or "restoreInitialView" not in start_here_text
    or "initialViewState" not in start_here_text
    or "resetView" not in start_here_text
    or "readStartParams" not in start_here_text
    or "paramFlag" not in start_here_text
    or "paramChoice" not in start_here_text
    or "imageFallbackAttempted" not in start_here_text
    or 'mapImage.addEventListener("error"' not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks persistent preferences: {label}")
  if (
    "event.metaKey" not in start_here_text
    or "event.ctrlKey" not in start_here_text
    or "event.altKey" not in start_here_text
    or "targetTag" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks keyboard shortcut guards: {label}")
  if (
    "requestAnimationFrame" not in start_here_text
    or "renderQueued" not in start_here_text
    or "lostpointercapture" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks anti-freeze render throttling: {label}"
    )
  if (
    "resizeTimer" not in start_here_text
    or "refitPreservingView" not in start_here_text
    or "setTimeout(refitPreservingView, 80)" not in start_here_text
  ):
    failures.append(f"Package HTML launcher lacks resize debounce: {label}")
  if (
    "viewport-fit=cover" not in start_here_text
    or "100dvh" not in start_here_text
    or "@media (pointer: coarse)" not in start_here_text
    or "min-height: 44px" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks mobile viewport/touch-target hardening: {label}"
    )
  if (
    "activePointers" not in start_here_text
    or "pinchGesture" not in start_here_text
    or 'pointerType === "touch"' not in start_here_text
    or "startPinchGesture" not in start_here_text
    or "updatePinchGesture" not in start_here_text
    or "pointerAngle" not in start_here_text
    or "startRotation" not in start_here_text
    or "resumeSingleTouchDrag" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher lacks touchscreen pinch/pan handling: {label}"
    )
  if (
    'className = "marker"' in start_here_text
    or '<div id="markers">' in start_here_text
    or "markerRoot" in start_here_text
  ):
    failures.append(f"Package HTML launcher still renders permanent markers: {label}")
  if "focus-ring" not in start_here_text or "addLandmarkList" not in start_here_text:
    failures.append(f"Package HTML launcher lacks selected-only focus UI: {label}")
  if (
    'window.location.protocol !== "file:"' not in start_here_text
    or "serverRequired" not in start_here_text
  ):
    failures.append(
      f"Package HTML launcher can still open broken true-3D file URLs: {label}"
    )
  if "!activePointers.has(event.pointerId)" not in start_here_text:
    failures.append(
      f"Package HTML launcher lacks duplicate pointer-end protection: {label}"
    )
  return failures


def package_server_failures(serve_text: str, label: str) -> list[str]:
  if (
    'START_PAGE = "index.html"' not in serve_text
    or "require_package_files(root)" not in serve_text
    or "verify_webgl_scene(root)" not in serve_text
    or "file_sha256(path)" not in serve_text
    or "cache_control_for_path(self.path)" not in serve_text
    or 'protocol_version = "HTTP/1.1"' not in serve_text
    or "daemon_threads = True" not in serve_text
    or "flush=True" not in serve_text
  ):
    return [
      f"Package server fallback does not verify/open/flush the 3D viewer: {label}"
    ]
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
  if manifest.get("start_page_mode") != "2d-compatibility-fallback":
    failures.append(f"Package manifest mislabels the compatibility start: {label}")
  if manifest.get("full_3d_start_page") != "index.html":
    failures.append(f"Package manifest lacks the full 3D start page: {label}")
  if manifest.get("preferred_image") != "dzi/regierungsviertel/overview_source.png":
    failures.append(f"Package manifest does not prefer overview_source.png: {label}")
  if manifest.get("uses_google_content") is not False:
    failures.append(f"Package manifest unexpectedly marks Google content used: {label}")
  attribution = str(manifest.get("required_attribution", ""))
  if (
    REQUIRED_ATTRIBUTION not in attribution
    or "Wikimedia Commons/Wikipedia" not in attribution
    or REQUIRED_KINDERTRANSPORT_VISUAL_ATTRIBUTION not in attribution
    or "Berlin Partner für Wirtschaft und Technologie GmbH" not in attribution
  ):
    failures.append(f"Package manifest lacks required attribution: {label}")

  assets = manifest.get("assets")
  if not isinstance(assets, dict):
    return failures + [f"Package manifest has no asset inventory: {label}"]

  required_asset_labels = [
    "detail_image",
    "pixel_image",
    "dzi_descriptor",
    "reference_map",
    "landmarks",
    "tiergartentunnel_overlay",
    "visual_reference_attribution",
    "wikimedia_attribution",
    "webgl_scene",
    "ground_context",
    "surface_source",
    "surface_pretriangulation",
    "start_page",
  ]
  for required in required_asset_labels:
    entry = assets.get(required)
    if not isinstance(entry, dict):
      failures.append(f"Package manifest lacks asset {required!r}: {label}")
  asset_paths: set[str] = set()
  for asset_label, entry in assets.items():
    if not isinstance(entry, dict):
      failures.append(f"Package manifest asset {asset_label!r} is invalid: {label}")
      continue
    relative = str(entry.get("path", ""))
    expected_hash = str(entry.get("sha256", ""))
    expected_size = entry.get("bytes")
    if (
      not relative
      or not SHA256_RE.fullmatch(expected_hash)
      or type(expected_size) is not int
      or expected_size < 0
    ):
      failures.append(f"Package manifest asset {asset_label!r} is incomplete: {label}")
      continue
    asset_paths.add(relative)
    try:
      data = asset_reader(relative)
    except (FileNotFoundError, KeyError, OSError):
      failures.append(f"Package manifest references missing asset {relative}: {label}")
      continue
    actual_hash = hashlib.sha256(data).hexdigest()
    if len(data) != expected_size:
      failures.append(f"Package manifest asset size mismatch for {relative}: {label}")
    if actual_hash != expected_hash:
      failures.append(f"Package manifest asset hash mismatch for {relative}: {label}")

  surface_manifest_relative = f"mesh/regierungsviertel/{SURFACE_MANIFEST_FILE}"
  surface_source_relative = f"mesh/regierungsviertel/{SURFACE_SOURCE_FILE}"
  required_surface_paths = {surface_manifest_relative, surface_source_relative}
  try:
    surface_manifest = json.loads(
      asset_reader(surface_manifest_relative).decode("utf-8")
    )
  except (
    FileNotFoundError,
    KeyError,
    OSError,
    UnicodeDecodeError,
    json.JSONDecodeError,
  ):
    surface_manifest = None
  if isinstance(surface_manifest, dict):
    plates = surface_manifest.get("plates")
    if isinstance(plates, list):
      required_surface_paths.update(
        f"mesh/regierungsviertel/{entry['file']}"
        for entry in plates
        if isinstance(entry, dict) and isinstance(entry.get("file"), str)
      )
  missing_surface_inventory = sorted(required_surface_paths - asset_paths)
  if missing_surface_inventory:
    failures.append(
      "Package manifest does not cover progressive surface assets: "
      f"{label} ({missing_surface_inventory[:3]})"
    )
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


def dzi_landmark_failures(
  descriptor_data: bytes,
  landmark_data: bytes,
  label: str,
) -> list[str]:
  """Require focus coordinates to use the descriptor's pixel grid."""
  info, failures = parse_dzi_descriptor(f"{label} descriptor", descriptor_data)
  if failures:
    return failures
  assert info is not None
  try:
    payload = json.loads(landmark_data.decode("utf-8"))
    image = payload["image"]
    landmarks = payload["landmarks"]
  except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
    return [f"Invalid DZI landmark metadata {label}: {exc}"]

  failures = []
  if image.get("width") != info.width or image.get("height") != info.height:
    failures.append(f"DZI landmark image dimensions differ from descriptor: {label}")
  for landmark in landmarks:
    name = landmark.get("name", "unnamed landmark")
    x = landmark.get("x")
    y = landmark.get("y")
    if (
      not isinstance(x, int | float)
      or not isinstance(y, int | float)
      or not 0 <= x <= info.width
      or not 0 <= y <= info.height
    ):
      failures.append(f"DZI landmark lies outside descriptor: {label}: {name}")
      continue
    nx = landmark.get("nx")
    ny = landmark.get("ny")
    if isinstance(nx, int | float) and abs(x - nx * info.width) > 1:
      failures.append(f"DZI landmark x/nx mismatch: {label}: {name}")
    if isinstance(ny, int | float) and abs(y - ny * info.height) > 1:
      failures.append(f"DZI landmark y/ny mismatch: {label}: {name}")
  return failures


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


def zip_webgl_scene_failures(
  archive: zipfile.ZipFile, names: set[str], zip_path: Path
) -> list[str]:
  """Validate every GLB declared by the packaged scene manifest."""
  scene_relative = "mesh/regierungsviertel/scene.json"
  scene_name = package_arcname(scene_relative)
  if scene_name not in names:
    return []
  try:
    scene = json.loads(archive.read(scene_name).decode("utf-8"))
  except (UnicodeDecodeError, json.JSONDecodeError) as exc:
    return [f"Invalid packaged WebGL scene: {zip_path}!{scene_name}: {exc}"]
  if not isinstance(scene, dict):
    return [f"Packaged WebGL scene is not an object: {zip_path}!{scene_name}"]

  prefix = package_arcname("mesh/regierungsviertel")
  actual_asset_names = {
    name.removeprefix(f"{prefix}/")
    for name in names
    if name.startswith(f"{prefix}/") and name.lower().endswith(".glb")
  }
  return webgl_manifest_failures(
    scene,
    label=f"{zip_path}!{scene_name}",
    asset_reader=lambda relative: archive.read(f"{prefix}/{relative}"),
    actual_asset_names=actual_asset_names,
  )


def zip_surface_pretriangulation_failures(
  archive: zipfile.ZipFile, names: set[str], zip_path: Path
) -> list[str]:
  """Validate the progressive surface files carried by the offline ZIP."""
  prefix = package_arcname("mesh/regierungsviertel")
  manifest_name = f"{prefix}/{SURFACE_MANIFEST_FILE}"
  if manifest_name not in names:
    return []
  try:
    manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
  except (KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
    return [
      f"Invalid packaged surface plate manifest: {zip_path}!{manifest_name}: {exc}"
    ]
  if not isinstance(manifest, dict):
    return [
      f"Packaged surface plate manifest is not an object: {zip_path}!{manifest_name}"
    ]
  actual_plate_names = {
    name.removeprefix(f"{prefix}/")
    for name in names
    if name.startswith(f"{prefix}/") and name.endswith(".plate.gz")
  }
  return surface_pretriangulation_manifest_failures(
    manifest,
    label=f"{zip_path}!{manifest_name}",
    source_reader=lambda relative: archive.read(f"{prefix}/{relative}"),
    asset_reader=lambda relative: archive.read(f"{prefix}/{relative}"),
    actual_plate_names=actual_plate_names,
  )


def zip_package_failures(root: Path = ROOT) -> list[str]:
  zip_path = root / "releases" / PACKAGE_ZIP
  if not zip_path.exists():
    return [f"Missing package ZIP: {zip_path}"]

  failures: list[str] = []
  try:
    with zipfile.ZipFile(zip_path) as archive:
      members = archive.infolist()
      name_counts = Counter(member.filename for member in members)
      encrypted_names: set[str] = set()
      for name, count in sorted(name_counts.items()):
        if count > 1:
          failures.append(
            f"Duplicate package ZIP member ({count} copies): {zip_path}!{name}"
          )
      for member in members:
        mode = member.external_attr >> 16
        if stat.S_ISLNK(mode):
          failures.append(f"Symlink package ZIP member: {zip_path}!{member.filename}")
        if member.flag_bits & 0x1:
          encrypted_names.add(member.filename)
          failures.append(f"Encrypted package ZIP member: {zip_path}!{member.filename}")
      uncompressed_bytes = sum(member.file_size for member in members)
      if uncompressed_bytes > MAX_PACKAGE_UNCOMPRESSED_BYTES:
        failures.append(
          "Package ZIP exceeds "
          f"{MAX_PACKAGE_UNCOMPRESSED_BYTES // 1024 // 1024} MiB extracted budget: "
          f"{zip_path} ({uncompressed_bytes} bytes)"
        )
      if not any(member.flag_bits & 0x1 for member in members):
        corrupt_member = archive.testzip()
        if corrupt_member is not None:
          failures.append(f"Corrupt ZIP member: {zip_path}!{corrupt_member}")

      names = set(name_counts) - encrypted_names
      for relative in REQUIRED_PACKAGE_ENTRIES:
        arcname = package_arcname(relative)
        if arcname not in names:
          failures.append(f"Missing package ZIP entry: {zip_path}!{arcname}")

      failures.extend(zip_dzi_tile_failures(archive, names, zip_path))
      zip_dzi = package_arcname(f"dzi/regierungsviertel/{DZI_DESCRIPTOR}")
      zip_landmarks = package_arcname("dzi/regierungsviertel/landmarks.json")
      if zip_dzi in names and zip_landmarks in names:
        failures.extend(
          dzi_landmark_failures(
            archive.read(zip_dzi),
            archive.read(zip_landmarks),
            f"{zip_path}!dzi/regierungsviertel",
          )
        )
      failures.extend(zip_webgl_scene_failures(archive, names, zip_path))
      failures.extend(zip_surface_pretriangulation_failures(archive, names, zip_path))

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


def normalized_tar_name(name: str) -> str:
  return PurePosixPath(name).as_posix().removeprefix("./")


def static_tarball_failures(root: Path = ROOT) -> list[str]:
  """Validate the independently deployable static viewer archive."""
  version = project_version(root)
  tar_path = root / "releases" / static_archive_name(version)
  if not tar_path.exists():
    return [f"Missing static viewer archive: {tar_path}"]

  failures: list[str] = []
  try:
    with tarfile.open(tar_path, "r:gz") as archive:
      members = archive.getmembers()
      files: dict[str, tarfile.TarInfo] = {}
      name_counts: Counter[str] = Counter()
      for member in members:
        pure_path = PurePosixPath(member.name)
        normalized = normalized_tar_name(member.name)
        if pure_path.is_absolute() or ".." in pure_path.parts or "\\" in member.name:
          failures.append(f"Unsafe static archive path: {tar_path}!{member.name}")
          continue
        if member.issym() or member.islnk():
          failures.append(f"Linked static archive member: {tar_path}!{member.name}")
          continue
        if not member.isfile() and not member.isdir():
          failures.append(f"Special static archive member: {tar_path}!{member.name}")
          continue
        if member.isfile():
          name_counts[normalized] += 1
          files.setdefault(normalized, member)
          if has_forbidden_duplicate_name(Path(normalized)):
            failures.append(
              f"Unwanted duplicate/hidden static archive path: {tar_path}!{member.name}"
            )

      for name, count in sorted(name_counts.items()):
        if count > 1:
          failures.append(
            f"Duplicate static archive member ({count} copies): {tar_path}!{name}"
          )
      uncompressed_bytes = sum(member.size for member in files.values())
      if uncompressed_bytes > MAX_PACKAGE_UNCOMPRESSED_BYTES:
        failures.append(
          "Static archive exceeds "
          f"{MAX_PACKAGE_UNCOMPRESSED_BYTES // 1024 // 1024} MiB extracted budget: "
          f"{tar_path} ({uncompressed_bytes} bytes)"
        )

      required = {
        "favicon.svg",
        "index.html",
        "mesh/regierungsviertel/scene.json",
        "mesh/regierungsviertel/ground-context.json",
        f"mesh/regierungsviertel/{SURFACE_MANIFEST_FILE}",
        f"mesh/regierungsviertel/{SURFACE_SOURCE_FILE}",
        "mesh/regierungsviertel/tile-3894_58196.glb",
        "dzi/regierungsviertel/regierungsviertel.dzi",
        "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg",
      }
      for name in sorted(required - files.keys()):
        failures.append(f"Missing static archive entry: {tar_path}!{name}")
      if not any(name.startswith("assets/") and name.endswith(".js") for name in files):
        failures.append(f"Static archive has no built JavaScript: {tar_path}")

      def read_member(name: str) -> bytes:
        member = files[name]
        extracted = archive.extractfile(member)
        if extracted is None:
          raise KeyError(name)
        return extracted.read()

      tar_dzi = "dzi/regierungsviertel/regierungsviertel.dzi"
      tar_landmarks = "dzi/regierungsviertel/landmarks.json"
      if tar_dzi in files and tar_landmarks in files:
        failures.extend(
          dzi_landmark_failures(
            read_member(tar_dzi),
            read_member(tar_landmarks),
            f"{tar_path}!dzi/regierungsviertel",
          )
        )

      scene_name = "mesh/regierungsviertel/scene.json"
      if scene_name in files:
        try:
          scene = json.loads(read_member(scene_name).decode("utf-8"))
        except (KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
          failures.append(f"Invalid static WebGL scene: {tar_path}: {exc}")
        else:
          if not isinstance(scene, dict):
            failures.append(f"Static WebGL scene is not an object: {tar_path}")
          else:
            mesh_prefix = "mesh/regierungsviertel/"
            actual_assets = {
              name.removeprefix(mesh_prefix)
              for name in files
              if name.startswith(mesh_prefix) and name.endswith(".glb")
            }
            failures.extend(
              webgl_manifest_failures(
                scene,
                label=f"{tar_path}!{scene_name}",
                asset_reader=lambda relative: read_member(f"{mesh_prefix}{relative}"),
                actual_asset_names=actual_assets,
              )
            )

      surface_manifest_name = f"mesh/regierungsviertel/{SURFACE_MANIFEST_FILE}"
      if surface_manifest_name in files:
        try:
          surface_manifest = json.loads(
            read_member(surface_manifest_name).decode("utf-8")
          )
        except (KeyError, UnicodeDecodeError, json.JSONDecodeError) as exc:
          failures.append(f"Invalid static surface plate manifest: {tar_path}: {exc}")
        else:
          if not isinstance(surface_manifest, dict):
            failures.append(
              f"Static surface plate manifest is not an object: {tar_path}"
            )
          else:
            mesh_prefix = "mesh/regierungsviertel/"
            actual_plates = {
              name.removeprefix(mesh_prefix)
              for name in files
              if name.startswith(mesh_prefix) and name.endswith(".plate.gz")
            }
            failures.extend(
              surface_pretriangulation_manifest_failures(
                surface_manifest,
                label=f"{tar_path}!{surface_manifest_name}",
                source_reader=lambda relative: read_member(f"{mesh_prefix}{relative}"),
                asset_reader=lambda relative: read_member(f"{mesh_prefix}{relative}"),
                actual_plate_names=actual_plates,
              )
            )

      descriptor_name = f"dzi/regierungsviertel/{DZI_DESCRIPTOR}"
      if descriptor_name in files:
        info, dzi_failures = parse_dzi_descriptor(
          f"{tar_path}!{descriptor_name}", read_member(descriptor_name)
        )
        failures.extend(dzi_failures)
        if info is not None:
          for relative_tile in iter_dzi_tile_paths(info):
            tile_name = f"dzi/regierungsviertel/{DZI_TILES_DIR}/{relative_tile}"
            if tile_name not in files:
              failures.append(
                f"Missing DZI static archive tile: {tar_path}!{tile_name}"
              )
            elif files[tile_name].size == 0:
              failures.append(f"Empty DZI static archive tile: {tar_path}!{tile_name}")
  except (OSError, EOFError, tarfile.TarError) as exc:
    return [f"Invalid static viewer archive: {tar_path}: {exc}"]

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
  root: Path = ROOT,
  *,
  require_package_zip: bool = False,
  require_static_tarball: bool = False,
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
  package_source = (root / "scripts" / "package_static_site.py").read_text(
    encoding="utf-8"
  )
  if (
    "Große transparente Cumulus-Wolke über Spreebogen und Kanzleramt" in package_source
  ):
    failures.append("Zero-server fallback still places a cloud over the Chancellery")

  for report_file in REQUIRED_REPORT_FILES:
    if not (root / report_file).exists():
      failures.append(f"Missing QA/report artefact: {root / report_file}")

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  for filename in REQUIRED_VIEWER_FILES:
    if not (public_dzi / filename).exists():
      failures.append(f"Missing bundled viewer asset: {public_dzi / filename}")
  failures.extend(viewer_binary_size_failures(public_dzi))
  failures.extend(
    visual_reference_attribution_failures(
      public_dzi / "visual_reference_attribution.json"
    )
  )
  failures.extend(dzi_tile_failures(public_dzi))
  public_descriptor = public_dzi / DZI_DESCRIPTOR
  public_landmarks = public_dzi / "landmarks.json"
  if public_descriptor.exists() and public_landmarks.exists():
    failures.extend(
      dzi_landmark_failures(
        public_descriptor.read_bytes(),
        public_landmarks.read_bytes(),
        str(public_dzi),
      )
    )
  public_mesh = root / "src" / "app" / "public" / "mesh" / "regierungsviertel"
  failures.extend(webgl_scene_failures(public_mesh))
  failures.extend(surface_pretriangulation_failures(public_mesh))
  dist_mesh = root / "src" / "app" / "dist" / "mesh" / "regierungsviertel"
  failures.extend(surface_pretriangulation_failures(dist_mesh))
  failures.extend(webgl_viewer_source_failures(root))
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
    packaged_dzi = package_dir / "dzi" / "regierungsviertel"
    packaged_descriptor = packaged_dzi / DZI_DESCRIPTOR
    packaged_landmarks = packaged_dzi / "landmarks.json"
    if packaged_descriptor.exists() and packaged_landmarks.exists():
      failures.extend(
        dzi_landmark_failures(
          packaged_descriptor.read_bytes(),
          packaged_landmarks.read_bytes(),
          str(packaged_dzi),
        )
      )
    packaged_mesh = package_dir / "mesh" / "regierungsviertel"
    failures.extend(webgl_scene_failures(packaged_mesh))
    failures.extend(surface_pretriangulation_failures(packaged_mesh))
  elif require_package_zip or require_static_tarball:
    failures.append(f"Missing extracted package directory: {package_dir}")

  zip_path = root / "releases" / PACKAGE_ZIP
  if require_package_zip or zip_path.exists():
    failures.extend(zip_package_failures(root))
  tar_path = root / "releases" / static_archive_name(version)
  if require_static_tarball or tar_path.exists():
    failures.extend(static_tarball_failures(root))

  failures.extend(package_source_hygiene_failures(root))

  return failures


def main() -> None:
  failures = collect_failures(
    require_package_zip=True,
    require_static_tarball=True,
  )
  if failures:
    details = "\n".join(f"- {failure}" for failure in failures)
    raise SystemExit(f"Release readiness failed:\n{details}")
  print(f"Release readiness OK for v{project_version()}")


if __name__ == "__main__":
  main()
