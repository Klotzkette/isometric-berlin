"""Tests for release-readiness checks."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
import stat
import struct
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
  "Kindertransport visual references: © Pauline Ahrens, 2021 / "
  "Bildhauerei in Berlin (CC BY 4.0)"
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


def valid_visual_reference_attribution() -> str:
  records = [
    {
      "title": f"MIT_095_{suffix}_Pauline_Ahrens_2021.jpg",
      "artist": "Pauline Ahrens",
      "year": 2021,
      "license": "CC BY 4.0",
      "license_url": "https://creativecommons.org/licenses/by/4.0/",
      "page_url": "https://bildhauerei-in-berlin.de/bildwerk/kindertransport/",
      "file_url": (
        "https://bildhauerei-in-berlin.de/wp-content/uploads/"
        f"MIT_095_{suffix}_Pauline_Ahrens_2021.jpg"
      ),
    }
    for suffix in ("1", "3", "6", "7", "13")
  ]
  return json.dumps(
    {
      "required_attribution": (
        "Kindertransport visual references: © Pauline Ahrens, 2021 / "
        "Bildhauerei in Berlin (CC BY 4.0)"
      ),
      "records": records,
    }
  )


SURFACE_SOURCE_DATA = (
  '{\n  "roads": [{"kind": "asphalt", "rings": '
  '[[[0.000001, 1e20, 1.0, -0.0]]]}],\n  "label": "Straße"\n}\n'
).encode()
# Independent Bun/JSON.stringify fixture value; covers fixed/exponential number
# spelling, integral floats, negative zero and non-ASCII strings.
SURFACE_SOURCE_SHA256 = (
  "adbf1737a45491e2acd90b60c7aa521801a12e1bfa606d0524f7510181d669bd"
)


def minimal_surface_assets() -> dict[str, bytes]:
  positions = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
  indices = struct.pack("<3I", 0, 1, 2)
  raw = (
    struct.pack(
      "<8s6I",
      b"ISOPLT01",
      1,
      1,
      3,
      3,
      len(positions),
      len(indices),
    )
    + positions
    + indices
  )
  compressed = gzip.compress(raw, compresslevel=9, mtime=0)
  filename = f"surface-asphalt-{SURFACE_SOURCE_SHA256[:12]}.plate.gz"
  manifest = {
    "format": "isometric-berlin-surface-plate",
    "schema_version": 1,
    "source_file": "surface-polygons.json",
    "source_sha256": SURFACE_SOURCE_SHA256,
    "stage": "post-earcut-pre-terrain-drape",
    "plates": [
      {
        "compressed_bytes": len(compressed),
        "file": filename,
        "index_count": 3,
        "kind": "asphalt",
        "raw_bytes": len(raw),
        "vertex_count": 3,
      }
    ],
  }
  return {
    "surface-polygons.json": SURFACE_SOURCE_DATA,
    "surface-pretriangulation.json": json.dumps(manifest).encode(),
    filename: compressed,
  }


VALID_TRAFFIC_SIGNAL_ISLAND_KEYS = {
  "node/2089708636",
  "node/4558372625",
  "node/8881562153",
  "node/10966083541",
  "node/11842476822",
  "node/11842507431",
  "node/12873153765",
  "node/13235279484",
}
LANE_OVERLAPPED_TRAFFIC_SIGNAL_ISLAND_KEYS = {
  "node/2089708636",
  "node/4558372625",
}


def valid_traffic_signal_payload() -> dict[str, object]:
  """Complete synthetic schema-7 payload matching the fixed source audit."""
  placements: list[dict[str, object]] = []
  for index in range(1_092):
    placements.append(
      {
        "osm_key": f"node/{index}",
        "placement": "relocated_verge",
        "position_dm": [index, 10],
        "road_clearance_dm": 5,
        "source_dm": [index, 0],
        "source_on_carriageway": True,
        "source_requires_relocation": True,
      }
    )
  placements.append(
    {
      "osm_key": "node/3098737953",
      "placement": "relocated_verge",
      "position_dm": [19_999, 10],
      "road_clearance_dm": 7,
      "source_dm": [19_999, 0],
      "source_on_carriageway": False,
      "source_requires_relocation": True,
    }
  )
  for index in range(227):
    placements.append(
      {
        "osm_key": f"node/{20_000 + index}",
        "placement": "surveyed_verge",
        "position_dm": [index, 20],
        "road_clearance_dm": 8,
        "source_dm": [index, 20],
        "source_on_carriageway": False,
        "source_requires_relocation": False,
      }
    )
  for index, key in enumerate(sorted(VALID_TRAFFIC_SIGNAL_ISLAND_KEYS)):
    placements.append(
      {
        "osm_key": key,
        "placement": "verified_island",
        "position_dm": [index, 30],
        "road_clearance_dm": 0,
        "source_dm": [index, 30],
        "source_on_carriageway": (key in LANE_OVERLAPPED_TRAFFIC_SIGNAL_ISLAND_KEYS),
        "source_requires_relocation": (
          key in LANE_OVERLAPPED_TRAFFIC_SIGNAL_ISLAND_KEYS
        ),
      }
    )
  return {
    "schema_version": 7,
    "traffic_signal_placements": placements,
    "traffic_signals_dm": [entry["source_dm"] for entry in placements],
  }


def valid_traffic_signal_payload_bytes() -> bytes:
  return json.dumps(valid_traffic_signal_payload()).encode()


def webgl_entry(filename: str, data: bytes) -> dict[str, bool | float | int | str]:
  return {
    "file": filename,
    "bytes": len(data),
    "faces": 100_000,
    "includes_normals": True,
    "meshopt_compressed": True,
    "normal_crease_degrees": 58.0,
    "quantize_normal_bits": 8,
    "quantize_position_bits": 16,
    "sha256": hashlib.sha256(data).hexdigest(),
    "simplification_aggression": 5,
    "target_faces": 100_000,
    "vertices": 50_000,
  }


def surface_webgl_entry(
  filename: str, data: bytes
) -> dict[str, bool | float | int | str]:
  entry = webgl_entry(filename, data)
  entry["faces"] = 289_797
  entry["target_faces"] = 289_797
  entry["vertices"] = 90_000
  return entry


def hero_webgl_entry(filename: str, data: bytes) -> dict[str, bool | float | int | str]:
  entry = webgl_entry(filename, data)
  entry["texture_max_edge"] = 1600
  return entry


def minimal_webgl_scene(filename: str, data: bytes) -> dict[str, object]:
  entry = webgl_entry(filename, data)
  return {
    "source": {
      "attribution": "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH"
    },
    "base_tiles": [dict(entry) for _ in range(23)],
    "surface_detail_tiles": [surface_webgl_entry(filename, data) for _ in range(23)],
    "hero_details": [
      {"id": identifier, "files": [hero_webgl_entry(filename, data)]}
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
        "north_south_hall_length_m": 180.0,
        "north_south_hall_width_m": 42.0,
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


def test_dzi_landmark_failures_rejects_unscaled_offline_coordinates() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_dzi_landmarks", "scripts/check_release_readiness.py"
  )
  descriptor = TINY_DZI_XML.replace('Width="2"', 'Width="8192"').replace(
    'Height="2"', 'Height="5808"'
  )
  stale = json.dumps(
    {
      "image": {"width": 16384, "height": 11616},
      "landmarks": [
        {
          "name": "Bundeskanzleramt",
          "x": 8698,
          "y": 6772,
          "nx": 0.530884,
          "ny": 0.582989,
        }
      ],
    }
  ).encode()

  failures = release_readiness.dzi_landmark_failures(
    descriptor.encode(), stale, "offline package"
  )

  assert any("dimensions differ" in failure for failure in failures)
  assert any("outside descriptor" in failure for failure in failures)


def test_current_tree_is_release_ready() -> None:
  release_readiness = load_script_module(
    "check_release_readiness", "scripts/check_release_readiness.py"
  )

  assert release_readiness.collect_failures(ROOT) == []


def test_built_app_version_guard_rejects_a_stale_hashed_bundle(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_built_app_version",
    "scripts/check_release_readiness.py",
  )
  assets = tmp_path / "src" / "app" / "dist" / "assets"
  assets.mkdir(parents=True)
  bundle = assets / "index-example.js"
  bundle.write_text("const packageMetadata={version:`1.2.2`};", encoding="utf-8")

  assert release_readiness.built_app_version_failures(tmp_path, "1.2.3")
  bundle.write_text("const packageMetadata={version:`1.2.3`};", encoding="utf-8")
  assert release_readiness.built_app_version_failures(tmp_path, "1.2.3") == []


def test_package_source_hygiene_ignores_only_generated_finder_metadata(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_source_hygiene",
    "scripts/check_release_readiness.py",
  )
  public = tmp_path / "src" / "app" / "public"
  dist = tmp_path / "src" / "app" / "dist"
  public.mkdir(parents=True)
  dist.mkdir(parents=True)
  (dist / ".DS_Store").write_text("Finder metadata", encoding="utf-8")

  assert release_readiness.package_source_hygiene_failures(tmp_path) == []

  public_hidden = public / ".DS_Store"
  public_hidden.write_text("must never ship", encoding="utf-8")
  duplicate = dist / "index 2.js"
  duplicate.write_text("duplicate", encoding="utf-8")
  failures = release_readiness.package_source_hygiene_failures(tmp_path)

  assert any(str(public_hidden) in failure for failure in failures)
  assert any(str(duplicate) in failure for failure in failures)


def test_traffic_signal_readiness_requires_safe_schema_7_roles(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_traffic_signals",
    "scripts/check_release_readiness.py",
  )
  path = tmp_path / "street-details.json"
  assert release_readiness.VERIFIED_TRAFFIC_SIGNAL_ISLAND_KEYS == (
    VALID_TRAFFIC_SIGNAL_ISLAND_KEYS
  )
  assert release_readiness.TRAFFIC_SIGNAL_PRECISION_GUARD_KEYS == {"node/3098737953"}
  payload = valid_traffic_signal_payload()
  path.write_text(json.dumps(payload), encoding="utf-8")
  assert release_readiness.traffic_signal_payload_failures(path) == []
  placements = payload["traffic_signal_placements"]
  assert isinstance(placements, list)
  placements[0]["road_clearance_dm"] = 4
  path.write_text(json.dumps(payload), encoding="utf-8")
  assert any(
    "lacks safe road clearance" in failure
    for failure in release_readiness.traffic_signal_payload_failures(path)
  )
  placements[0]["road_clearance_dm"] = 5
  placements[0]["source_requires_relocation"] = False
  path.write_text(json.dumps(payload), encoding="utf-8")
  assert any(
    "lacks safe road clearance" in failure
    for failure in release_readiness.traffic_signal_payload_failures(path)
  )


def test_traffic_signal_readiness_rejects_missing_or_non_object_payload(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_missing_traffic_signals",
    "scripts/check_release_readiness.py",
  )
  path = tmp_path / "street-details.json"

  assert release_readiness.traffic_signal_payload_failures(path) == [
    f"Missing schema-7 traffic-signal payload: {path}"
  ]

  path.write_text("[]", encoding="utf-8")
  assert release_readiness.traffic_signal_payload_failures(path) == [
    f"Traffic-signal payload is not an object: {path}"
  ]


def test_offline_package_requires_schema_7_street_details_entry() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_traffic_signal_package_entry",
    "scripts/check_release_readiness.py",
  )

  assert (
    "mesh/regierungsviertel/street-details.json"
    in release_readiness.REQUIRED_PACKAGE_ENTRIES
  )


def test_release_readiness_rejects_stale_built_street_details(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_public_parity",
    "scripts/check_release_readiness.py",
  )
  public = tmp_path / "src/app/public/mesh/regierungsviertel/street-details.json"
  dist = tmp_path / "src/app/dist/mesh/regierungsviertel/street-details.json"
  public.parent.mkdir(parents=True)
  dist.parent.mkdir(parents=True)
  public.write_bytes(b"current")
  dist.write_bytes(b"stale")
  assert release_readiness.generated_public_asset_parity_failures(tmp_path) == [
    f"Built viewer has stale generated public asset: {dist}"
  ]
  dist.write_bytes(public.read_bytes())
  assert release_readiness.generated_public_asset_parity_failures(tmp_path) == []


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
  (public_dzi / "visual_reference_attribution.json").write_text(
    valid_visual_reference_attribution(), encoding="utf-8"
  )
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
  (public_mesh / "ground-context.json").write_text(
    json.dumps(
      {
        "buildings": [],
        "trees": [],
        "ground_rows": [[[0, 1, 0]]],
        "ground_height": {"y_dm": [0]},
      }
    ),
    encoding="utf-8",
  )
  for relative, data in minimal_surface_assets().items():
    (public_mesh / relative).write_bytes(data)
  traffic_signals = valid_traffic_signal_payload_bytes()
  (public_mesh / "street-details.json").write_bytes(traffic_signals)
  dist_mesh = root / "src/app/dist/mesh/regierungsviertel"
  dist_mesh.mkdir(parents=True)
  for relative, data in minimal_surface_assets().items():
    (dist_mesh / relative).write_bytes(data)
  (dist_mesh / "street-details.json").write_bytes(traffic_signals)
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
    "dzi/regierungsviertel/landmarks.json": json.dumps(
      {
        "image": {"width": 2, "height": 2},
        "landmarks": [{"name": "Fixture", "x": 1, "y": 1, "nx": 0.5, "ny": 0.5}],
      }
    ),
    "dzi/regierungsviertel/tiergartentunnel.json": b'{"routes":[]}',
    "dzi/regierungsviertel/visual_reference_attribution.json": (
      valid_visual_reference_attribution()
    ),
    "dzi/regierungsviertel/wikimedia_attribution.json": b"{}",
    "dzi/regierungsviertel/regierungsviertel.dzi": TINY_DZI_XML,
    "dzi/regierungsviertel/regierungsviertel_files/0/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/1/0_0.jpg": b"tile",
    "dzi/regierungsviertel/regierungsviertel_files/12/0_0.jpg": b"tile",
    "mesh/regierungsviertel/scene.json": json.dumps(
      minimal_webgl_scene(Path(mesh_relative).name, mesh_data)
    ),
    "mesh/regierungsviertel/ground-context.json": (
      b'{"buildings":[],"trees":[],"ground_rows":[[[0,1,0]]],'
      b'"ground_height":{"y_dm":[0]}}'
    ),
    "mesh/regierungsviertel/street-details.json": (
      valid_traffic_signal_payload_bytes()
    ),
    mesh_relative: mesh_data,
  }
  for relative, body in minimal_surface_assets().items():
    files[f"mesh/regierungsviertel/{relative}"] = body
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
      "visual_reference_attribution": (
        "dzi/regierungsviertel/visual_reference_attribution.json"
      ),
      "wikimedia_attribution": "dzi/regierungsviertel/wikimedia_attribution.json",
      "webgl_scene": "mesh/regierungsviertel/scene.json",
      "ground_context": "mesh/regierungsviertel/ground-context.json",
      "surface_source": "mesh/regierungsviertel/surface-polygons.json",
      "surface_pretriangulation": (
        "mesh/regierungsviertel/surface-pretriangulation.json"
      ),
      "start_page": "START-HERE.html",
    }
    surface_manifest_data = files.get(
      "mesh/regierungsviertel/surface-pretriangulation.json"
    )
    if surface_manifest_data is not None:
      surface_manifest = json.loads(surface_manifest_data)
      for plate in surface_manifest["plates"]:
        asset_paths[f"surface_plate_{plate['kind']}"] = (
          f"mesh/regierungsviertel/{plate['file']}"
        )

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
          "Kindertransport visual references: © Pauline Ahrens, 2021 / "
          "Bildhauerei in Berlin (CC BY 4.0) · "
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
    "mesh/regierungsviertel/ground-context.json": (
      b'{"buildings":[],"trees":[],"ground_rows":[[[0,1,0]]],'
      b'"ground_height":{"y_dm":[0]}}'
    ),
    mesh_relative: mesh_data,
  }
  for relative, body in minimal_surface_assets().items():
    files[f"mesh/regierungsviertel/{relative}"] = body
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


def test_visual_reference_attribution_requires_all_five_cc_by_credits(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_visual_credits", "scripts/check_release_readiness.py"
  )
  path = tmp_path / "visual_reference_attribution.json"
  path.write_text(valid_visual_reference_attribution(), encoding="utf-8")

  assert release_readiness.visual_reference_attribution_failures(path) == []

  payload = json.loads(path.read_text(encoding="utf-8"))
  payload["records"].pop()
  path.write_text(json.dumps(payload), encoding="utf-8")

  assert release_readiness.visual_reference_attribution_failures(path) == [
    f"Visual-reference attribution has incomplete per-file credits: {path}"
  ]


def test_surface_pretriangulation_validates_canonical_source_and_plate_header(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_surface_valid", "scripts/check_release_readiness.py"
  )
  for relative, data in minimal_surface_assets().items():
    (tmp_path / relative).write_bytes(data)

  assert (
    release_readiness.canonical_surface_source_sha256(SURFACE_SOURCE_DATA)
    == SURFACE_SOURCE_SHA256
  )
  assert release_readiness.surface_pretriangulation_failures(tmp_path) == []


def test_surface_pretriangulation_rejects_hash_duplicate_kind_and_count(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_surface_contract", "scripts/check_release_readiness.py"
  )
  assets = minimal_surface_assets()
  manifest = json.loads(assets["surface-pretriangulation.json"])
  manifest["source_sha256"] = "0" * 64
  manifest["plates"][0]["vertex_count"] = 4
  manifest["plates"].append(dict(manifest["plates"][0]))
  assets["surface-pretriangulation.json"] = json.dumps(manifest).encode()
  for relative, data in assets.items():
    (tmp_path / relative).write_bytes(data)

  failures = release_readiness.surface_pretriangulation_failures(tmp_path)

  assert any("Surface source hash mismatch" in failure for failure in failures)
  assert any("repeats kind 'asphalt'" in failure for failure in failures)
  assert any("vertex count mismatch" in failure for failure in failures)


def test_surface_pretriangulation_rejects_corrupt_and_oversized_gzip(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_surface_gzip", "scripts/check_release_readiness.py"
  )
  assets = minimal_surface_assets()
  manifest = json.loads(assets["surface-pretriangulation.json"])
  filename = manifest["plates"][0]["file"]
  oversized = b"not-gzip" + b"\0" * release_readiness.MAX_REPOSITORY_BINARY_BYTES
  assets[filename] = oversized
  manifest["plates"][0]["compressed_bytes"] = len(oversized)
  assets["surface-pretriangulation.json"] = json.dumps(manifest).encode()
  for relative, data in assets.items():
    (tmp_path / relative).write_bytes(data)

  failures = release_readiness.surface_pretriangulation_failures(tmp_path)

  assert any("strict 5 MiB limit" in failure for failure in failures)
  assert any("Invalid gzip surface plate" in failure for failure in failures)


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
  scene["surface_detail_tiles"] = [
    surface_webgl_entry(name, assets[name]) for name in names[:96]
  ]
  scene["hero_details"] = [
    {"id": identifier, "files": [hero_webgl_entry(name, assets[name])]}
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


def test_webgl_manifest_rejects_missing_bundled_normals() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_mesh_normals", "scripts/check_release_readiness.py"
  )
  mesh_data = b"model"
  scene = minimal_webgl_scene("tile.glb", mesh_data)
  scene["base_tiles"][0].pop("includes_normals")

  failures = release_readiness.webgl_manifest_failures(
    scene,
    label="missing normals",
    asset_reader={"tile.glb": mesh_data}.__getitem__,
    actual_asset_names={"tile.glb"},
  )

  assert any("lacks bundled normals flag" in failure for failure in failures)


def test_webgl_manifest_rejects_coarse_base_surface() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_mesh_density", "scripts/check_release_readiness.py"
  )
  mesh_data = b"model"
  scene = minimal_webgl_scene("tile.glb", mesh_data)
  for entry in scene["base_tiles"]:
    entry["faces"] = 70_000
    entry["target_faces"] = 70_000

  failures = release_readiness.webgl_manifest_failures(
    scene,
    label="coarse surface",
    asset_reader={"tile.glb": mesh_data}.__getitem__,
    actual_asset_names={"tile.glb"},
  )

  assert any("face quality floor" in failure for failure in failures)
  assert any("100k/58-degree/aggression-5" in failure for failure in failures)


def test_webgl_manifest_rejects_missing_settled_surface_tier() -> None:
  release_readiness = load_script_module(
    "check_release_readiness_settled_surface",
    "scripts/check_release_readiness.py",
  )
  mesh_data = b"model"
  scene = minimal_webgl_scene("tile.glb", mesh_data)
  scene["surface_detail_tiles"] = []

  failures = release_readiness.webgl_manifest_failures(
    scene,
    label="missing settled surface",
    asset_reader={"tile.glb": mesh_data}.__getitem__,
    actual_asset_names={"tile.glb"},
  )

  assert any(
    "one settled surface-detail tile for every bounded interaction tile" in failure
    for failure in failures
  )


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
  (tmp_path / "ground-context.json").write_text(
    '{"buildings":[],"trees":[],"ground_rows":[[[0,1,0]]],'
    '"ground_height":{"y_dm":[0]}}',
    encoding="utf-8",
  )

  failures = release_readiness.webgl_scene_failures(tmp_path)

  assert any("size mismatch" in failure for failure in failures)
  assert any("hash mismatch" in failure for failure in failures)


def test_webgl_scene_allows_two_mib_ground_context_but_rejects_larger(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_ground_budget", "scripts/check_release_readiness.py"
  )
  assert release_readiness.MAX_GROUND_CONTEXT_BYTES == 3 * 1024 * 1024
  mesh_data = b"model"
  (tmp_path / "tile.glb").write_bytes(mesh_data)
  (tmp_path / "scene.json").write_text(
    json.dumps(minimal_webgl_scene("tile.glb", mesh_data)),
    encoding="utf-8",
  )
  ground_context = tmp_path / "ground-context.json"
  ground_context.write_text(
    json.dumps(
      {
        "building_rows": [],
        "tree_rows": [],
        "ground_rows": [[[0, 1, 0]]],
        "ground_height": {"y_dm": [0]},
      }
    ),
    encoding="utf-8",
  )

  failures = release_readiness.webgl_scene_failures(tmp_path)
  assert not any("Fast-start ground context exceeds" in failure for failure in failures)

  with ground_context.open("ab") as stream:
    stream.truncate(release_readiness.MAX_GROUND_CONTEXT_BYTES + 1)
  failures = release_readiness.webgl_scene_failures(tmp_path)
  assert failures == [f"Fast-start ground context exceeds 3 MiB: {ground_context}"]


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
  (tmp_path / "ground-context.json").write_text(
    '{"buildings":[],"trees":[],"ground_rows":[[[0,1,0]]],'
    '"ground_height":{"y_dm":[0]}}',
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


def test_zip_package_failures_require_street_details(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_street_details",
    "scripts/check_release_readiness.py",
  )
  relative = "mesh/regierungsviertel/street-details.json"
  write_minimal_package_zip(tmp_path, release_readiness, {relative: None})

  zip_path = tmp_path / "releases" / release_readiness.PACKAGE_ZIP
  missing = release_readiness.package_arcname(relative)
  assert f"Missing package ZIP entry: {zip_path}!{missing}" in (
    release_readiness.zip_package_failures(tmp_path)
  )


def test_zip_package_requires_referenced_surface_plate_and_manifest_inventory(
  tmp_path: Path,
) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_zip_surface", "scripts/check_release_readiness.py"
  )
  plate_name = next(
    name for name in minimal_surface_assets() if name.endswith(".plate.gz")
  )
  relative_plate = f"mesh/regierungsviertel/{plate_name}"
  write_minimal_package_zip(
    tmp_path,
    release_readiness,
    {relative_plate: None},
  )

  failures = release_readiness.zip_package_failures(tmp_path)

  assert any("Missing referenced surface plate" in failure for failure in failures)

  zip_path = write_minimal_package_zip(tmp_path, release_readiness)
  with zipfile.ZipFile(zip_path) as archive:
    files = {info.filename: archive.read(info) for info in archive.infolist()}
  manifest_name = release_readiness.package_arcname("package-manifest.json")
  package_manifest = json.loads(files[manifest_name])
  package_manifest["assets"].pop("surface_plate_asphalt")
  files[manifest_name] = json.dumps(package_manifest).encode()
  with zipfile.ZipFile(zip_path, "w") as archive:
    for name, data in files.items():
      archive.writestr(name, data)

  failures = release_readiness.zip_package_failures(tmp_path)
  assert any(
    "does not cover progressive surface assets" in failure for failure in failures
  )


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


def test_static_tarball_failures_rejects_missing_surface_plate(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_tar_surface", "scripts/check_release_readiness.py"
  )
  (tmp_path / "pyproject.toml").write_text(
    '[project]\nname = "fixture"\nversion = "9.9.9"\n',
    encoding="utf-8",
  )
  plate_name = next(
    name for name in minimal_surface_assets() if name.endswith(".plate.gz")
  )
  write_minimal_static_tarball(
    tmp_path,
    release_readiness,
    {f"mesh/regierungsviertel/{plate_name}": None},
  )

  failures = release_readiness.static_tarball_failures(tmp_path)

  assert any("Missing referenced surface plate" in failure for failure in failures)


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
