"""Tests for release-readiness checks."""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import stat
import tarfile
import zipfile
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).resolve().parents[1]
TINY_DZI_XML = """<?xml version='1.0' encoding='utf-8'?>
<Image TileSize="256" Overlap="0" Format="jpg" xmlns="http://schemas.microsoft.com/deepzoom/2008">
  <Size Width="2" Height="2" />
</Image>
"""
VALID_START_HERE_HTML = (
  '<img src="dzi/regierungsviertel/overview.png">'
  '<img src="dzi/regierungsviertel/overview_source.png">'
  "<button>Drehen/Swivel</button>"
  '<button id="under-view">Unterseite</button>'
  '<button id="lang-de">Deutsch</button>'
  '<button id="lang-en">English</button>'
  '<button id="theme-night">Nacht</button>'
  '<button id="view-north">Nord</button>'
  '<div id="compass"></div>'
  '<div id="focus-ring"></div>'
  '<svg id="tunnel-overlay"><g class="tunnel-light tunnel-vent tunnel-volume '
  'tunnel-center-wall tunnel-ceiling-rib tunnel-service-bay"></g></svg>'
  '<svg id="night-light-overlay"><g class="night-window night-street-lamp"></g></svg>'
  '<svg id="scene-detail-overlay"><g class="detail-cloud cloud-shadow sunbeam '
  "detail-glint detail-ripple detail-tree-cluster detail-water-depth "
  "detail-tunnel-branch detail-train-ice detail-train-sbahn "
  'detail-vehicle vehicle-light-cone detail-boat"></g></svg>'
  '<button id="details-toggle">Details</button><button id="clouds-toggle">Clouds</button>'
  '<button id="performance-toggle">Lite</button>'
  "<script>event.shiftKey; setViewPreset; ArrowLeft; ArrowRight; tiltBy; "
  "tunnelPayload; addTunnelVentilation; addTunnelTube; scaleY; focusTunnelRoute; "
  "applyLanguage; setLanguage; setTheme; addNightLights; requestAnimationFrame; "
  "PREFERENCE_STORAGE_KEY; readPreferences; savePreferences; localStorage; "
  "readStartParams; paramFlag; paramChoice; imageFallbackAttempted; "
  'mapImage.addEventListener("error"; '
  "sourceImage; landmarkScaleX; landmarkScaleY; mapImage.style.width; "
  "stagePointToImage; placeImagePointAt; preserveStageCenter; constrainView; "
  "applyQualityImage; savedLandmarkName; restoreInitialView; initialViewState; "
  "resetView; renderQueued; lostpointercapture; resizeTimer; "
  "refitPreservingView; setTimeout(refitPreservingView, 80); "
  "addSceneDetails; addFlag; addLandmarkList; setDetails; setClouds; setPerformance; "
  "data-dragging; data-performance; event.metaKey; event.ctrlKey; event.altKey; targetTag; "
  'activePointers; pinchGesture; pointerType === "touch"; startPinchGesture; '
  "updatePinchGesture; pointerAngle; startRotation; resumeSingleTouchDrag;"
  '!activePointers.has(event.pointerId); window.location.protocol !== "file:"; '
  "serverRequired;"
  "</script>"
  "<style>viewport-fit=cover; 100dvh; @media (pointer: coarse) { button { min-height: 44px; } }</style>"
)
VALID_SERVE_LOCAL = (
  'START_PAGE = "index.html"\n'
  "def cache_control_for_path(path):\n"
  "  return 'public, max-age=31536000, immutable'\n"
  "class QuietHandler:\n"
  '  protocol_version = "HTTP/1.1"\n'
  "  def end_headers(self):\n"
  "    cache_control_for_path(self.path)\n"
  "class ReusableTCPServer:\n"
  "  daemon_threads = True\n"
  "def file_sha256(path):\n"
  "  return 'hash'\n"
  "def verify_webgl_scene(root):\n"
  "  file_sha256(root)\n"
  "def require_package_files(root):\n"
  "  verify_webgl_scene(root)\n"
  "  return None\n"
  "print('open', flush=True)\n"
)


def webgl_entry(filename: str, data: bytes) -> dict[str, int | str]:
  return {
    "file": filename,
    "bytes": len(data),
    "sha256": hashlib.sha256(data).hexdigest(),
  }


def minimal_webgl_scene(filename: str, data: bytes) -> dict[str, object]:
  entry = webgl_entry(filename, data)
  return {
    "source": {
      "attribution": "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH"
    },
    "base_tiles": [dict(entry) for _ in range(23)],
    "hero_details": [
      {"id": identifier, "files": [dict(entry)]}
      for identifier in (
        "reichstag",
        "bundeskanzleramt",
        "hauptbahnhof",
        "brandenburger-tor",
      )
    ],
    "tiergartentunnel": {"points": [[index, 0, index] for index in range(8)]},
    "architectural_signatures": [
      {
        "id": "reichstag-dome",
        "height_m": 23.5,
        "diameter_m": 40.0,
        "vertical_ribs": 24,
        "horizontal_rings": 17,
        "source_url": ("https://www.bundestag.de/besuche/architektur/reichstag/kuppel"),
      },
      {
        "id": "reichstag-model",
        "width_m": 100.0,
        "depth_m": 138.0,
        "rotation_y_degrees": -1.676,
      },
      {
        "id": "bundeskanzleramt-model",
        "cube_height_m": 36.0,
        "office_height_m": 18.0,
        "office_segments": [{}, {}, {}],
        "rotation_y_degrees": -1.337,
      },
      {
        "id": "hauptbahnhof-model",
        "east_west_roof_length_m": 321.0,
        "north_south_hall_length_m": 160.0,
        "north_south_hall_width_m": 45.0,
        "office_bridge_height_m": 46.0,
        "rotation_y_degrees": 21.82,
      },
      {
        "id": "brandenburger-tor-model",
        "width_m": 62.5,
        "depth_m": 11.0,
        "total_height_m": 26.0,
        "column_rows": 2,
        "columns_per_row": 6,
        "rotation_y_degrees": 5.083,
      },
    ],
  }


def load_script_module(name: str, relative_path: str) -> ModuleType:
  module_path = ROOT / relative_path
  spec = importlib.util.spec_from_file_location(name, module_path)
  assert spec is not None
  assert spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_current_tree_is_release_ready() -> None:
  release_readiness = load_script_module(
    "check_release_readiness", "scripts/check_release_readiness.py"
  )

  assert release_readiness.collect_failures(ROOT) == []


def write_tiny_dzi(public_dzi: Path) -> None:
  public_dzi.mkdir(parents=True, exist_ok=True)
  (public_dzi / "regierungsviertel.dzi").write_text(TINY_DZI_XML, encoding="utf-8")
  for level in ["0", "1"]:
    level_dir = public_dzi / "regierungsviertel_files" / level
    level_dir.mkdir(parents=True, exist_ok=True)
    (level_dir / "0_0.jpg").write_bytes(b"tile")


def write_minimal_release_tree(root: Path, version: str = "9.9.9") -> Path:
  (root / "pyproject.toml").write_text(
    f'[project]\nname = "fixture"\nversion = "{version}"\n',
    encoding="utf-8",
  )
  package_script = root / "scripts" / "package_static_site.py"
  package_script.parent.mkdir(parents=True)
  package_script.write_text(
    f'PACKAGE_VERSION = "{version}"\n',
    encoding="utf-8",
  )
  init = root / "src" / "isometric_berlin" / "__init__.py"
  init.parent.mkdir(parents=True)
  init.write_text(f'__version__ = "{version}"\n', encoding="utf-8")
  app_package = root / "src" / "app" / "package.json"
  app_package.parent.mkdir(parents=True)
  app_package.write_text(f'{{"version": "{version}"}}\n', encoding="utf-8")
  (root / "README.md").write_text(
    "Local v"
    f"{version}\n"
    "https://github.com/Klotzkette/isometric-berlin/releases/download/"
    f"v{version}/isometric-berlin-regierungsviertel-local.zip\n",
    encoding="utf-8",
  )
  (root / "docs").mkdir(parents=True)
  (root / "docs" / "landmark-alignment.md").write_text("ok\n", encoding="utf-8")
  (root / "docs" / "metric-precision.md").write_text("ok\n", encoding="utf-8")
  (root / "geo_data" / "regierungsviertel").mkdir(parents=True)
  (root / "geo_data/regierungsviertel/landmark_alignment.json").write_text(
    "{}\n", encoding="utf-8"
  )
  (root / "geo_data/regierungsviertel/metric_precision.json").write_text(
    "{}\n", encoding="utf-8"
  )

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  write_tiny_dzi(public_dzi)
  for filename in [
    "landmarks.json",
    "reference_map.png",
    "wikimedia_attribution.json",
  ]:
    (public_dzi / filename).write_bytes(b"shared")
  (public_dzi / "tiergartentunnel.json").write_text(
    json.dumps(
      {
        "routes": [
          {
            "points": [{"x": index, "y": index} for index in range(8)],
            "volume": {
              "tube_count": 2,
              "width_px": 1,
              "clear_width_each_direction_m": 7.5,
              "clear_height_m": 4.5,
              "total_width_m": 23.4,
              "assumed_depth_m": -8,
            },
            "lighting": {"spacing_px": 1},
            "ventilation": [{"x": index, "y": index} for index in range(5)],
            "service_bays": [{"x": index, "y": index} for index in range(4)],
            "portals": [{"x": index, "y": index} for index in range(2)],
            "underside_view": {"enabled": True},
            "osm_way_ids": list(range(10)),
            "geometry_status": "OSM-derived approximation, not official surveyed",
            "osm_evidence": {"way_count": 1},
          }
        ]
      }
    ),
    encoding="utf-8",
  )
  bundled = root / "src" / "app" / "src" / "data"
  bundled.mkdir(parents=True)
  (bundled / "regierungsviertel-landmarks.json").write_bytes(b"shared")
  public_mesh = root / "src/app/public/mesh/regierungsviertel"
  public_mesh.mkdir(parents=True)
  mesh_file = public_mesh / "tile.glb"
  mesh_data = b"glb"
  mesh_file.write_bytes(mesh_data)
  (public_mesh / "scene.json").write_text(
    json.dumps(minimal_webgl_scene("tile.glb", mesh_data)),
    encoding="utf-8",
  )
  return public_dzi


def write_minimal_package_zip(
  root: Path,
  release_readiness: ModuleType,
  overrides: dict[str, bytes | str | None] | None = None,
) -> Path:
  overrides = overrides or {}
  (root / "pyproject.toml").write_text(
    '[project]\nname = "fixture"\nversion = "9.9.9"\n',
    encoding="utf-8",
  )
  mesh_relative = "mesh/regierungsviertel/tile-3894_58196.glb"
  mesh_data = b"glb"
  files: dict[str, bytes | str] = {
    "START-HERE.html": VALID_START_HERE_HTML,
    "README.txt": "readme\n",
    "serve-local.py": VALID_SERVE_LOCAL,
    "start-mac-if-needed.txt": "fallback\n",
    "start-windows.bat": "@echo off\n",
    "start-linux.sh": "#!/bin/sh\n",
    "index.html": "<!doctype html>\n",
    "favicon.svg": "<svg></svg>\n",
    "dzi/regierungsviertel/overview.png": b"png",
    "dzi/regierungsviertel/overview_source.png": b"png",
    "dzi/regierungsviertel/reference_map.png": b"png",
    "dzi/regierungsviertel/landmarks.json": b"{}",
    "dzi/regierungsviertel/tiergartentunnel.json": b'{"routes":[]}',
    "dzi/regierungsviertel/wikimedia_attribution.json": b"{}",
    "dzi/regierungsviertel/regierungsviertel.dzi": TINY_DZI_XML,
    "dzi/regierungsviertel/regierungsviertel_files/0/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/1/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg": b"tile",
    "mesh/regierungsviertel/scene.json": json.dumps(
      minimal_webgl_scene(Path(mesh_relative).name, mesh_data)
    ),
    mesh_relative: mesh_data,
  }
  for relative, body in overrides.items():
    if body is None:
      files.pop(relative, None)
    else:
      files[relative] = body
  if "package-manifest.json" not in files:
    asset_paths = {
      "detail_image": "dzi/regierungsviertel/overview_source.png",
      "pixel_image": "dzi/regierungsviertel/overview.png",
      "dzi_descriptor": "dzi/regierungsviertel/regierungsviertel.dzi",
      "reference_map": "dzi/regierungsviertel/reference_map.png",
      "landmarks": "dzi/regierungsviertel/landmarks.json",
      "tiergartentunnel_overlay": "dzi/regierungsviertel/tiergartentunnel.json",
      "wikimedia_attribution": "dzi/regierungsviertel/wikimedia_attribution.json",
      "webgl_scene": "mesh/regierungsviertel/scene.json",
      "start_page": "START-HERE.html",
    }

    def file_meta(relative: str) -> dict[str, int | str]:
      body = files[relative]
      data = body.encode("utf-8") if isinstance(body, str) else body
      return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    files["package-manifest.json"] = json.dumps(
      {
        "package_name": release_readiness.PACKAGE_NAME,
        "package_version": "9.9.9",
        "start_page": "START-HERE.html",
        "start_page_mode": "2d-compatibility-fallback",
        "full_3d_start_page": "index.html",
        "preferred_image": "dzi/regierungsviertel/overview_source.png",
        "uses_google_content": False,
        "required_attribution": (
          "© OpenStreetMap contributors · 3D building models: Geoportal Berlin "
          "(dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · "
          "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH"
        ),
        "assets": {
          label: {"path": relative, **file_meta(relative)}
          for label, relative in asset_paths.items()
          if relative in files
        },
      }
    )
  zip_path = root / "releases" / release_readiness.PACKAGE_ZIP
  zip_path.parent.mkdir(parents=True, exist_ok=True)
  with zipfile.ZipFile(zip_path, "w") as archive:
    for relative, body in files.items():
      archive.writestr(release_readiness.package_arcname(relative), body)
  return zip_path


def write_minimal_static_tarball(
  root: Path,
  release_readiness: ModuleType,
  overrides: dict[str, bytes | str | None] | None = None,
  extra_members: list[tarfile.TarInfo] | None = None,
) -> Path:
  overrides = overrides or {}
  mesh_data = b"glb"
  mesh_relative = "mesh/regierungsviertel/tile-3894_58196.glb"
  files: dict[str, bytes | str] = {
    "favicon.svg": "<svg></svg>\n",
    "index.html": "<!doctype html>\n",
    "assets/index.js": "console.log('ok')\n",
    "dzi/regierungsviertel/regierungsviertel.dzi": TINY_DZI_XML,
    "dzi/regierungsviertel/regierungsviertel_files/0/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/1/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg": b"tile",
    "mesh/regierungsviertel/scene.json": json.dumps(
      minimal_webgl_scene(Path(mesh_relative).name, mesh_data)
    ),
    mesh_relative: mesh_data,
  }
  for relative, body in overrides.items():
    if body is None:
      files.pop(relative, None)
    else:
      files[relative] = body

  tar_path = (
    root
    / "releases"
    / release_readiness.static_archive_name(release_readiness.project_version(root))
  )
  tar_path.parent.mkdir(parents=True, exist_ok=True)
  with tarfile.open(tar_path, "w:gz") as archive:
    for relative, body in files.items():
      data = body.encode("utf-8") if isinstance(body, str) else body
      info = tarfile.TarInfo(relative)
      info.size = len(data)
      archive.addfile(info, fileobj=io.BytesIO(data))
    for info in extra_members or []:
      archive.addfile(info)
  return tar_path


def test_dzi_tile_failures_accepts_complete_pyramid(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_complete", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)

  assert release_readiness.dzi_tile_failures(tmp_path) == []


def test_viewer_binary_size_failures_rejects_oversized_preview(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_binary_size", "scripts/check_release_readiness.py"
  )
  preview = tmp_path / "overview_source.png"
  with preview.open("wb") as stream:
    stream.truncate(release_readiness.MAX_REPOSITORY_BINARY_BYTES + 1)

  failures = release_readiness.viewer_binary_size_failures(tmp_path)

  assert len(failures) == 1
  assert "overview_source.png" in failures[0]
  assert "exceeds 5 MiB" in failures[0]


def test_webgl_integrity_matrix_rejects_100_corrupt_assets() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_webgl_matrix", "scripts/check_release_readiness.py"
  )
  assets = {
    f"asset-{index:03d}.glb": f"model-{index:03d}".encode() for index in range(100)
  }
  names = list(assets)
  scene = minimal_webgl_scene(names[0], assets[names[0]])
  scene["base_tiles"] = [webgl_entry(name, assets[name]) for name in names[:96]]
  scene["hero_details"] = [
    {"id": identifier, "files": [webgl_entry(name, assets[name])]}
    for identifier, name in zip(
      ("reichstag", "bundeskanzleramt", "hauptbahnhof", "brandenburger-tor"),
      names[96:],
      strict=True,
    )
  ]

  assert (
    release_readiness.webgl_manifest_failures(
      scene,
      label="100-asset fixture",
      asset_reader=assets.__getitem__,
      actual_asset_names=set(assets),
    )
    == []
  )
  for name in names:
    corrupted = dict(assets)
    corrupted[name] += b"-corrupt"
    failures = release_readiness.webgl_manifest_failures(
      scene,
      label=f"corrupt {name}",
      asset_reader=corrupted.__getitem__,
      actual_asset_names=set(corrupted),
    )
    assert any(name in failure and "mismatch" in failure for failure in failures)


def test_webgl_manifest_rejects_axis_aligned_hauptbahnhof_model() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_station_rotation", "scripts/check_release_readiness.py"
  )
  mesh_data = b"model"
  scene = minimal_webgl_scene("tile.glb", mesh_data)
  station = next(
    signature
    for signature in scene["architectural_signatures"]
    if signature["id"] == "hauptbahnhof-model"
  )
  station["rotation_y_degrees"] = 0.0

  failures = release_readiness.webgl_manifest_failures(
    scene,
    label="axis-aligned station",
    asset_reader={"tile.glb": mesh_data}.__getitem__,
    actual_asset_names={"tile.glb"},
  )

  assert any("not aligned to its rotated LoD2 hall" in failure for failure in failures)


def test_webgl_scene_failures_rejects_manifest_hash_mismatch(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_webgl_hash", "scripts/check_release_readiness.py"
  )
  mesh_data = b"original"
  (tmp_path / "tile.glb").write_bytes(b"corrupted")
  (tmp_path / "scene.json").write_text(
    json.dumps(minimal_webgl_scene("tile.glb", mesh_data)),
    encoding="utf-8",
  )

  failures = release_readiness.webgl_scene_failures(tmp_path)

  assert any("size mismatch" in failure for failure in failures)
  assert any("hash mismatch" in failure for failure in failures)


def test_webgl_scene_failures_rejects_unreferenced_glb(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_webgl_orphan", "scripts/check_release_readiness.py"
  )
  mesh_data = b"model"
  (tmp_path / "tile.glb").write_bytes(mesh_data)
  (tmp_path / "stale.glb").write_bytes(b"stale")
  (tmp_path / "scene.json").write_text(
    json.dumps(minimal_webgl_scene("tile.glb", mesh_data)),
    encoding="utf-8",
  )

  assert any(
    "Unreferenced WebGL asset stale.glb" in failure
    for failure in release_readiness.webgl_scene_failures(tmp_path)
  )


def test_dzi_tile_failures_require_tile_directory(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_missing_dir", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)
  for tile in (tmp_path / "regierungsviertel_files").rglob("*"):
    if tile.is_file():
      tile.unlink()
  for directory in sorted(
    (tmp_path / "regierungsviertel_files").rglob("*"), reverse=True
  ):
    if directory.is_dir():
      directory.rmdir()
  (tmp_path / "regierungsviertel_files").rmdir()

  assert release_readiness.dzi_tile_failures(tmp_path) == [
    f"Missing DZI tile directory: {tmp_path / 'regierungsviertel_files'}"
  ]


def test_dzi_tile_failures_require_referenced_tiles(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_missing_tile", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)
  missing_tile = tmp_path / "regierungsviertel_files" / "1" / "0_0.jpg"
  missing_tile.unlink()

  assert release_readiness.dzi_tile_failures(tmp_path) == [
    f"Missing DZI tile: {missing_tile}"
  ]


def test_zip_package_failures_accepts_complete_zip(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_complete", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(tmp_path, release_readiness)

  assert release_readiness.zip_package_failures(tmp_path) == []


def test_collect_failures_can_require_package_zip(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_required", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)

  zip_path = tmp_path / "releases" / release_readiness.PACKAGE_ZIP
  assert f"Missing package ZIP: {zip_path}" in release_readiness.collect_failures(
    tmp_path, require_package_zip=True
  )


def test_collect_failures_rejects_stale_readme_download_link(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_readme_link", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path, version="1.2.3")
  (tmp_path / "README.md").write_text(
    "Local v1.2.3\n"
    "https://github.com/Klotzkette/isometric-berlin/releases/download/"
    "v1.2.2/isometric-berlin-regierungsviertel-local.zip\n",
    encoding="utf-8",
  )

  assert (
    "README.md direct download link does not point at v1.2.3 package"
    in release_readiness.collect_failures(tmp_path)
  )


def test_zip_package_failures_require_referenced_tile(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_missing_tile", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {"dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg": None},
  )

  zip_path = tmp_path / "releases" / release_readiness.PACKAGE_ZIP
  missing = release_readiness.package_arcname(
    "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg"
  )
  assert f"Missing package ZIP entry: {zip_path}!{missing}" in (
    release_readiness.zip_package_failures(tmp_path)
  )


def test_zip_package_failures_require_full_dzi_pyramid(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_dzi_tile", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {"dzi/regierungsviertel/regierungsviertel_files/1/0_0.jpg": None},
  )

  zip_path = tmp_path / "releases" / release_readiness.PACKAGE_ZIP
  missing_level = release_readiness.package_arcname(
    "dzi/regierungsviertel/regierungsviertel_files/1"
  )
  assert f"Missing DZI ZIP level directory: {zip_path}!{missing_level}" in (
    release_readiness.zip_package_failures(tmp_path)
  )


def test_zip_package_failures_require_every_scene_glb(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_missing_glb", "scripts/check_release_readiness.py"
  )
  relative = "mesh/regierungsviertel/tile-3894_58196.glb"
  write_minimal_package_zip(tmp_path, release_readiness, {relative: None})

  failures = release_readiness.zip_package_failures(tmp_path)

  assert any(
    "Missing referenced WebGL asset tile-3894_58196.glb" in failure
    for failure in failures
  )


def test_zip_package_failures_rejects_corrupt_scene_glb(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_corrupt_glb", "scripts/check_release_readiness.py"
  )
  relative = "mesh/regierungsviertel/tile-3894_58196.glb"
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {relative: b"a different model payload"},
  )

  failures = release_readiness.zip_package_failures(tmp_path)

  assert any("WebGL asset hash mismatch" in failure for failure in failures)


def test_zip_package_failures_rejects_duplicate_member(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_duplicate", "scripts/check_release_readiness.py"
  )
  zip_path = write_minimal_package_zip(tmp_path, release_readiness)
  duplicate = release_readiness.package_arcname("README.txt")
  with zipfile.ZipFile(zip_path, "a") as archive:
    with pytest.warns(UserWarning, match="Duplicate name"):
      archive.writestr(duplicate, "duplicate\n")

  assert any(
    "Duplicate package ZIP member" in failure and duplicate in failure
    for failure in release_readiness.zip_package_failures(tmp_path)
  )


def test_zip_package_failures_rejects_symlink_member(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_symlink", "scripts/check_release_readiness.py"
  )
  zip_path = write_minimal_package_zip(tmp_path, release_readiness)
  link_name = release_readiness.package_arcname("assets/current.js")
  info = zipfile.ZipInfo(link_name)
  info.create_system = 3
  info.external_attr = (stat.S_IFLNK | 0o777) << 16
  with zipfile.ZipFile(zip_path, "a") as archive:
    archive.writestr(info, "../outside.js")

  assert any(
    "Symlink package ZIP member" in failure and link_name in failure
    for failure in release_readiness.zip_package_failures(tmp_path)
  )


def test_static_tarball_failures_accepts_complete_archive(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_tar_complete", "scripts/check_release_readiness.py"
  )
  (tmp_path / "pyproject.toml").write_text(
    '[project]\nname = "fixture"\nversion = "9.9.9"\n',
    encoding="utf-8",
  )
  write_minimal_static_tarball(tmp_path, release_readiness)

  assert release_readiness.static_tarball_failures(tmp_path) == []


def test_static_tarball_failures_rejects_missing_scene_glb(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_tar_missing_glb", "scripts/check_release_readiness.py"
  )
  (tmp_path / "pyproject.toml").write_text(
    '[project]\nname = "fixture"\nversion = "9.9.9"\n',
    encoding="utf-8",
  )
  write_minimal_static_tarball(
    tmp_path,
    release_readiness,
    {"mesh/regierungsviertel/tile-3894_58196.glb": None},
  )

  failures = release_readiness.static_tarball_failures(tmp_path)
  assert any("Missing referenced WebGL asset" in failure for failure in failures)


def test_static_tarball_failures_rejects_links_and_duplicates(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_tar_links", "scripts/check_release_readiness.py"
  )
  (tmp_path / "pyproject.toml").write_text(
    '[project]\nname = "fixture"\nversion = "9.9.9"\n',
    encoding="utf-8",
  )
  link = tarfile.TarInfo("assets/current.js")
  link.type = tarfile.SYMTYPE
  link.linkname = "../outside.js"
  duplicate = tarfile.TarInfo("index.html")
  write_minimal_static_tarball(
    tmp_path,
    release_readiness,
    extra_members=[link, duplicate],
  )

  failures = release_readiness.static_tarball_failures(tmp_path)
  assert any("Linked static archive member" in failure for failure in failures)
  assert any("Duplicate static archive member" in failure for failure in failures)


def test_zip_package_failures_rejects_stale_launcher(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_launcher", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {"START-HERE.html": '<script type="module" src="/assets/app.js"></script>'},
  )

  failures = release_readiness.zip_package_failures(tmp_path)
  assert any("browser module loading" in failure for failure in failures)


def test_zip_package_failures_rejects_manifest_hash_mismatch(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_manifest_hash", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {
      "package-manifest.json": json.dumps(
        {
          "package_name": release_readiness.PACKAGE_NAME,
          "package_version": "9.9.9",
          "start_page": "START-HERE.html",
          "preferred_image": "dzi/regierungsviertel/overview_source.png",
          "uses_google_content": False,
          "required_attribution": (
            "© OpenStreetMap contributors · 3D building models: Geoportal Berlin "
            "(dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia"
          ),
          "assets": {
            "detail_image": {
              "path": "dzi/regierungsviertel/overview_source.png",
              "bytes": 3,
              "sha256": "0" * 64,
            }
          },
        }
      )
    },
  )

  failures = release_readiness.zip_package_failures(tmp_path)
  assert any("asset hash mismatch" in failure for failure in failures)


def test_zip_package_failures_rejects_stale_server(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_server", "scripts/check_release_readiness.py"
  )
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {"serve-local.py": 'print("old root launcher")\n'},
  )

  failures = release_readiness.zip_package_failures(tmp_path)
  assert any(
    "does not verify/open/flush the 3D viewer" in failure for failure in failures
  )


def test_collect_failures_rejects_mismatched_bundled_landmarks(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_landmarks", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  (tmp_path / "src/app/src/data/regierungsviertel-landmarks.json").write_bytes(
    b"different"
  )

  assert (
    "Bundled app landmarks differ from src/app/public/dzi/regierungsviertel/landmarks.json"
    in release_readiness.collect_failures(tmp_path)
  )


def test_collect_failures_rejects_packaged_mac_command(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_package", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  package_dir = tmp_path / "releases" / release_readiness.PACKAGE_NAME
  package_dir.mkdir(parents=True)
  (package_dir / "START-HERE.html").write_text(
    VALID_START_HERE_HTML,
    encoding="utf-8",
  )
  (package_dir / "start-mac.command").write_text("#!/bin/sh\n", encoding="utf-8")

  assert (
    f"Forbidden macOS Gatekeeper-blocked launcher: {package_dir / 'start-mac.command'}"
    in release_readiness.collect_failures(tmp_path)
  )


def test_collect_failures_rejects_stale_server_fallback(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_stale_server", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  package_dir = tmp_path / "releases" / release_readiness.PACKAGE_NAME
  package_dir.mkdir(parents=True)
  (package_dir / "START-HERE.html").write_text(
    VALID_START_HERE_HTML,
    encoding="utf-8",
  )
  (package_dir / "serve-local.py").write_text(
    'print("old root launcher")\n',
    encoding="utf-8",
  )

  assert (
    "Package server fallback does not verify/open/flush the 3D viewer: "
    f"{package_dir / 'serve-local.py'}" in release_readiness.collect_failures(tmp_path)
  )
