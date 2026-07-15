"""Tests for metric precision reporting."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon

from isometric_berlin.data.verify_metric_precision import (
  BERLIN_PROJECTED,
  build_precision_report,
  building_precision_stats,
  scene_surface_stats,
)


def test_building_precision_stats_count_vertices_and_interior_rings() -> None:
  buildings = gpd.GeoDataFrame(
    {
      "building_id": ["a", "b"],
      "parent_building_id": ["ensemble", None],
      "lod2_role": ["building_part", "building"],
      "source_creation_date": ["2026-03-02", "2026-02-01"],
      "measured_height_m": [12.0, None],
      "geometry": [
        Polygon(
          [(0, 0), (20, 0), (20, 20), (0, 20), (0, 0)],
          holes=[[(5, 5), (9, 5), (9, 9), (5, 9), (5, 5)]],
        ),
        Polygon([(30, 0), (42, 0), (42, 10), (30, 10), (30, 0)]),
      ],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )

  stats = building_precision_stats(buildings)

  assert stats["building_count"] == 2
  assert stats["interior_ring_count"] == 1
  assert stats["footprint_vertex_count"] == 12
  assert stats["measured_height_count"] == 1
  assert stats["measured_height_share"] == 0.5
  assert stats["building_part_count"] == 1
  assert stats["segmented_ensemble_count"] == 1
  assert stats["latest_source_creation_date"] == "2026-03-02"


def test_build_precision_report_writes_json_and_markdown(tmp_path: Path) -> None:
  buildings = gpd.GeoDataFrame(
    {
      "building_id": ["a"],
      "measured_height_m": [12.0],
      "geometry": [Polygon([(0, 0), (20, 0), (20, 20), (0, 20), (0, 0)])],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  buildings_path = tmp_path / "buildings.gpkg"
  buildings.to_file(buildings_path, layer="buildings", driver="GPKG")
  alignment_path = tmp_path / "landmark_alignment.json"
  alignment_path.write_text(
    json.dumps(
      {
        "summary": {
          "status": "ok",
          "landmarks_checked": 1,
          "relative_relationships_checked": 1,
          "review_count": 0,
        }
      }
    ),
    encoding="utf-8",
  )
  out_json = tmp_path / "metric_precision.json"
  out_markdown = tmp_path / "metric_precision.md"

  report = build_precision_report(
    buildings_path=buildings_path,
    alignment_path=alignment_path,
    out_json=out_json,
    out_markdown=out_markdown,
  )

  assert report["buildings"]["building_count"] == 1
  assert out_json.exists()
  assert "Metric precision" in out_markdown.read_text(encoding="utf-8")


def test_scene_surface_stats_reports_current_mesh_tiers(tmp_path: Path) -> None:
  scene_path = tmp_path / "scene.json"
  scene_path.write_text(
    json.dumps(
      {
        "base_tiles": [
          {
            "faces": 100,
            "vertices": 60,
            "bytes": 1_000,
            "target_faces": 100,
            "normal_crease_degrees": 58,
            "simplification_aggression": 5,
          }
        ],
        "surface_detail_tiles": [
          {"faces": 300, "vertices": 170, "bytes": 2_000, "target_faces": 300}
        ],
        "hero_details": [
          {"id": "hero", "files": [{"faces": 50, "vertices": 40, "bytes": 500}]}
        ],
      }
    ),
    encoding="utf-8",
  )

  stats = scene_surface_stats(scene_path)

  assert stats["available"] is True
  assert stats["base_faces"] == 100
  assert stats["settled_faces"] == 300
  assert stats["hero_faces"] == 50
  assert stats["scene_glb_files"] == 3
  assert stats["scene_glb_bytes"] == 3_500
