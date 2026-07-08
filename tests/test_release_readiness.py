"""Tests for release-readiness checks."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import zipfile
from pathlib import Path
from types import ModuleType

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
  '<svg id="tunnel-overlay"><g class="tunnel-light tunnel-vent tunnel-volume '
  'tunnel-center-wall tunnel-ceiling-rib tunnel-service-bay"></g></svg>'
  '<svg id="night-light-overlay"><g class="night-window night-street-lamp"></g></svg>'
  "<script>event.shiftKey; setViewPreset; ArrowLeft; ArrowRight; tiltBy; "
  "tunnelPayload; addTunnelVentilation; addTunnelTube; scaleY; focusTunnelRoute; "
  "applyLanguage; setLanguage; setTheme; addNightLights; requestAnimationFrame; "
  "PREFERENCE_STORAGE_KEY; readPreferences; savePreferences; localStorage; "
  "applyQualityImage; savedLandmarkName; restoreInitialView; initialViewState; "
  "resetView; renderQueued; lostpointercapture; resizeTimer; setTimeout(fit, 80);"
  "</script>"
)
VALID_SERVE_LOCAL = (
  'START_PAGE = "START-HERE.html"\n'
  "def require_package_files(root):\n"
  "  return None\n"
  "print('open', flush=True)\n"
)


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
  files: dict[str, bytes | str] = {
    "START-HERE.html": VALID_START_HERE_HTML,
    "README.txt": "readme\n",
    "serve-local.py": VALID_SERVE_LOCAL,
    "start-mac-if-needed.txt": "fallback\n",
    "start-windows.bat": "@echo off\n",
    "start-linux.sh": "#!/bin/sh\n",
    "index.html": "<!doctype html>\n",
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
        "preferred_image": "dzi/regierungsviertel/overview_source.png",
        "uses_google_content": False,
        "required_attribution": (
          "© OpenStreetMap contributors · 3D building models: Geoportal Berlin "
          "(dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia"
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


def test_dzi_tile_failures_accepts_complete_pyramid(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_complete", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)

  assert release_readiness.dzi_tile_failures(tmp_path) == []


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
  assert any("does not open/flush START-HERE.html" in failure for failure in failures)


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
    f"Package server fallback does not open/flush START-HERE.html: {package_dir / 'serve-local.py'}"
    in release_readiness.collect_failures(tmp_path)
  )
