"""Check release metadata and bundled viewer assets before tagging."""

from __future__ import annotations

import hashlib
import json
import math
import re
import stat
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
MAX_PACKAGE_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
MIN_BASE_MESH_FACES = 2_250_000
MIN_SETTLED_SURFACE_FACES = 4_000_000
REQUIRED_BASE_TARGET_FACES = 100_000
REQUIRED_SETTLED_TARGET_FACES = 175_700
REQUIRED_BASE_NORMAL_CREASE_DEGREES = 72.0
REQUIRED_BASE_SIMPLIFICATION_AGGRESSION = 5
REQUIRED_MESHOPT_POSITION_BITS = 16
REQUIRED_MESHOPT_NORMAL_BITS = 8
MAX_WEBGL_SCENE_BYTES = 165 * 1024 * 1024
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
  "mesh/regierungsviertel/scene.json",
  "mesh/regierungsviertel/tile-3894_58196.glb",
)
REQUIRED_ATTRIBUTION = (
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)"
)
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


def package_arcname(relative: str) -> str:
  return f"{PACKAGE_NAME}/{relative}"


def expected_download_url(version: str) -> str:
  return (
    "https://github.com/Klotzkette/isometric-berlin/releases/download/"
    f"v{version}/{PACKAGE_ZIP}"
  )


def static_archive_name(version: str) -> str:
  return f"isometric-berlin-viewer-v{version}.tar.gz"


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
  if not isinstance(base_tiles, list) or len(base_tiles) < 23:
    failures.append(f"WebGL scene needs all 23 bounded Berlin mesh tiles: {label}")
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
        "WebGL base tiles do not use the required 100k/72-degree/aggression-5 "
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
  if not isinstance(surface_tiles, list) or len(surface_tiles) < 23:
    failures.append(f"WebGL scene needs all 23 settled surface-detail tiles: {label}")
    surface_tiles = []
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
        "175700-face/72-degree/aggression-5/Meshopt profile: "
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
      "north_south_hall_length_m": 160.0,
      "north_south_hall_width_m": 45.0,
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
      f"WebGL scene exceeds 165 MiB progressive offline budget: {total_bytes} bytes"
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
  if not scene_path.exists():
    return [f"Missing bundled WebGL scene: {scene_path}"]
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
  memorial_path = root / "src/app/src/MemorialLandmarks.ts"
  camera_navigation_path = root / "src/app/src/cameraNavigation.ts"
  render_quality_path = root / "src/app/src/renderQuality.ts"
  surface_quality_path = root / "src/app/src/surfaceQuality.ts"
  styles_path = root / "src/app/src/styles.css"
  if (
    not viewer_path.exists()
    or not app_path.exists()
    or not architecture_path.exists()
    or not memorial_path.exists()
    or not camera_navigation_path.exists()
    or not render_quality_path.exists()
    or not surface_quality_path.exists()
    or not styles_path.exists()
  ):
    return ["Missing true-3D viewer sources"]
  viewer = viewer_path.read_text(encoding="utf-8")
  app = app_path.read_text(encoding="utf-8")
  architecture = architecture_path.read_text(encoding="utf-8")
  memorial = memorial_path.read_text(encoding="utf-8")
  camera_navigation = camera_navigation_path.read_text(encoding="utf-8")
  render_quality = render_quality_path.read_text(encoding="utf-8")
  surface_quality = surface_quality_path.read_text(encoding="utf-8")
  styles = styles_path.read_text(encoding="utf-8")
  required_viewer_snippets = {
    "two-finger rotate/zoom": "TWO: TOUCH.DOLLY_ROTATE",
    "three-finger gesture": "touchPoints.size >= 3",
    "three-finger underside": "setModelMaterialState(runtime, polar > Math.PI / 2)",
    "full underside orbit": "controls.maxPolarAngle = Math.PI - 0.06",
    "late-loaded underside materials": (
      "material.side = runtime.underside ? DoubleSide : FrontSide"
    ),
    "oblique texture filtering": "material.map.anisotropy",
    "hidden default marker": "marker.visible = false",
    "bounded hero-detail cache": "heroDetailEvictions",
    "GPU texture disposal": "texture.dispose()",
    "retryable model loading": "loadModelWithRetry",
    "nonfatal detail warnings": "onWarningRef.current",
    "WebGL context-loss fallback": 'addEventListener("webglcontextlost"',
    "coarse-pointer frame budget": (
      "activeFrameIntervalMs = coarsePointer ? 1000 / 30"
    ),
    "low-power idle frame budget": (
      "idleFrameIntervalMs = coarsePointer ? 1000 / 10 : 1000 / 12"
    ),
    "reuse bundled mesh normals": (
      '!detail && !object.geometry.getAttribute("normal")'
    ),
    "instanced tunnel fixtures": ('"Tiergartentunnel instanced ceiling lights"'),
    "always-on tunnel presentation": "setTunnelPresentation(runtime.tunnel, underside)",
    "automatic orbit underside detection": (
      "const underside = controls.getPolarAngle() > Math.PI / 2"
    ),
    "granular memorial layer": "createMemorialLandmarks(manifest.landmarks)",
    "stale mobile hero cancellation": (
      "runtime.coarsePointer && selectedRef.current !== name"
    ),
    "disposed queue cancellation": "shouldStop: () => runtime.disposed",
    "lost pointer-capture recovery": '"lostpointercapture"',
    "window-blur gesture recovery": 'window.addEventListener("blur"',
    "decoded texture-image disposal": "image.close()",
    "adaptive GPU-bounded pixel ratio": "renderPixelRatio({",
    "day/night scene lighting": "setSceneLighting(runtime, lightingMode)",
    "temporary selected marker": "runtime.markerTimer = window.setTimeout",
    "Meshopt decoder": "setMeshoptDecoder(MeshoptDecoder)",
    "four-million-face settled surface": "manifest.surface_detail_tiles",
    "interaction surface swap": "setSurfacePresentation(runtime, isMoving)",
    "keyboard and button quality swap": "markSurfaceInteraction(runtime)",
    "inspectable surface tier": "dataset.surfaceQuality",
    "damping-aware active rendering": "const controlsChanged = controls.update()",
    "stuck touch watchdog": "timestamp - lastTouchActivityAt > 10_000",
    "global pointer release recovery": 'window.addEventListener("pointerup"',
    "hidden-tab gesture recovery": 'document.addEventListener("visibilitychange"',
    "camera rig stabilization": "stabilizeCameraRig(",
  }
  failures = [
    f"True-3D viewer lacks {label}: {viewer_path}"
    for label, snippet in required_viewer_snippets.items()
    if snippet not in viewer
  ]
  required_render_quality_snippets = {
    "2.25x desktop settled quality": "coarsePointer ? 1.75 : 2.25",
    "1x touch interaction quality": "coarsePointer ? 1 : 1.25",
    "fixed settled GPU budget": "8_000_000",
    "fixed mobile GPU budget": "4_800_000",
  }
  failures.extend(
    f"3D render-quality policy lacks {label}: {render_quality_path}"
    for label, snippet in required_render_quality_snippets.items()
    if snippet not in render_quality
  )
  if "detailReady && !coarsePointer && !interacting" not in surface_quality:
    failures.append(
      f"3D surface quality policy lacks idle-desktop gating: {surface_quality_path}"
    )
  if 'marker.className = "map-marker map-marker--selected"' not in app:
    failures.append(f"DZI fallback lacks selected-only marker: {app_path}")
  if "isThreeReady && keepThreeWarm" not in app:
    failures.append(f"Touch mode does not release inactive 3D memory: {app_path}")
  if "toggleLightingMode" not in app or "lightingMode={lightingMode}" not in app:
    failures.append(f"Viewer lacks persistent day/night controls: {app_path}")
  if "flyBy(1, 0)" not in app or "Shift + Pfeil" not in app:
    failures.append(f"Viewer lacks direct arrow-key flight controls: {app_path}")
  required_memorial_snippets = {
    "complete Holocaust stela field": "Holocaust Memorial 2710 instanced stelae",
    "official Holocaust height bands": "high: 872",
    "official-mesh ground placement": "MEMORIAL_GROUND_Y",
    "mobile-safe Holocaust shadow budget": "stelae.castShadow = false",
    "Soviet memorial tanks": "Soviet memorial T-34 west",
    "2026 Jehovah's Witnesses memorial": (
      "Jehovahs Witnesses memorial fine vertical folds"
    ),
  }
  failures.extend(
    f"Memorial models lack {label}: {memorial_path}"
    for label, snippet in required_memorial_snippets.items()
    if snippet not in memorial
  )
  required_camera_snippets = {
    "screen-relative flight": "screenRelativeFlightDelta",
    "bounded flight volume": "REGIERUNGSVIERTEL_FLIGHT_BOUNDS",
    "camera-target translation": "camera.position.add(applied)",
    "last-safe camera capture": "captureCameraPose",
    "invalid camera recovery": "stabilizeCameraRig",
  }
  failures.extend(
    f"Camera navigation lacks {label}: {camera_navigation_path}"
    for label, snippet in required_camera_snippets.items()
    if snippet not in camera_navigation
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
  required_mobile_style_snippets = {
    "compact phone breakpoint": "@media (max-width: 768px)",
    "mobile overflow action": ".toolbar .mobile-overflow",
    "safe-area bottom action bar": (
      "bottom: calc(8px + env(safe-area-inset-bottom, 0px))"
    ),
    "four-column compass sheet": (
      "grid-template-columns: repeat(4, minmax(44px, 1fr))"
    ),
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
    or "Berlin Partner für Wirtschaft und Technologie GmbH" not in attribution
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
    "webgl_scene",
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
          "Package ZIP exceeds 200 MiB extracted budget: "
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
      failures.extend(zip_webgl_scene_failures(archive, names, zip_path))

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
          "Static archive exceeds 200 MiB extracted budget: "
          f"{tar_path} ({uncompressed_bytes} bytes)"
        )

      required = {
        "favicon.svg",
        "index.html",
        "mesh/regierungsviertel/scene.json",
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

  for report_file in REQUIRED_REPORT_FILES:
    if not (root / report_file).exists():
      failures.append(f"Missing QA/report artefact: {root / report_file}")

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  for filename in REQUIRED_VIEWER_FILES:
    if not (public_dzi / filename).exists():
      failures.append(f"Missing bundled viewer asset: {public_dzi / filename}")
  failures.extend(viewer_binary_size_failures(public_dzi))
  failures.extend(dzi_tile_failures(public_dzi))
  public_mesh = root / "src" / "app" / "public" / "mesh" / "regierungsviertel"
  failures.extend(webgl_scene_failures(public_mesh))
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
    packaged_mesh = package_dir / "mesh" / "regierungsviertel"
    failures.extend(webgl_scene_failures(packaged_mesh))

  zip_path = root / "releases" / PACKAGE_ZIP
  if require_package_zip or zip_path.exists():
    failures.extend(zip_package_failures(root))
  tar_path = root / "releases" / static_archive_name(version)
  if require_static_tarball or tar_path.exists():
    failures.extend(static_tarball_failures(root))

  scan_roots = [root / "src" / "app" / "public", root / "src" / "app" / "dist"]
  for scan_root in scan_roots:
    if not scan_root.exists():
      continue
    for path in scan_root.rglob("*"):
      if has_forbidden_duplicate_name(path.relative_to(scan_root)):
        failures.append(f"Unwanted duplicate/hidden package path: {path}")

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
