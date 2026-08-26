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
  prism_coverage_stats,
  road_bridge_precision_stats,
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
  assert report["buildings"]["invalid_geometry_count"] == 0
  assert out_json.exists()
  assert "Metric precision" in out_markdown.read_text(encoding="utf-8")


def test_road_bridge_precision_audits_every_geometry_and_width_tier(
  tmp_path: Path,
) -> None:
  osm_path = tmp_path / "osm.gpkg"
  roads = gpd.GeoDataFrame(
    {
      "name": ["Measured bridge", "Lane road", "Footpath"],
      "highway": ["footway", "primary", "footway"],
      "bridge": ["yes", None, None],
      "width": ["1.5", None, None],
      "lanes": [None, "4", None],
      "geometry": [
        Polygon([(0, 0), (0, 0.5), (10, 0.5), (10, 0), (0, 0)]).boundary,
        Polygon([(0, 10), (0, 10.5), (10, 10.5), (10, 10), (0, 10)]).boundary,
        Polygon([(0, 20), (0, 20.5), (10, 20.5), (10, 20), (0, 20)]).boundary,
      ],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  roads.to_file(osm_path, layer="roads", driver="GPKG")
  bounds = Polygon([(-1, -1), (12, -1), (12, 22), (-1, 22), (-1, -1)])

  stats = road_bridge_precision_stats(osm_path, bounds)

  assert stats["status"] == "ok"
  assert stats["supported_road_line_count"] == 3
  assert stats["resolved_width_count"] == 3
  assert stats["width_evidence"] == {
    "width": 1,
    "est_width": 0,
    "lanes": 1,
    "class_fallback": 1,
  }
  assert stats["bridge_line_count"] == 1
  assert stats["road_outside_bounds_count"] == 0


def test_prism_coverage_exposes_flat_and_degenerate_source_parts(
  tmp_path: Path,
) -> None:
  buildings = gpd.GeoDataFrame(
    {
      "building_id": ["solid", "flat", "sliver"],
      "measured_height_m": [12.0, 0.02, 8.0],
      "geometry": [
        Polygon([(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)]),
        Polygon([(10, 0), (14, 0), (14, 4), (10, 4), (10, 0)]),
        Polygon([(20, 0), (20.5, 0), (20.5, 0.5), (20, 0.5), (20, 0)]),
      ],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  prism_path = tmp_path / "lod2-prisms.json"
  prism_path.write_text(json.dumps({"buildings": [{"id": "solid"}]}))

  stats = prism_coverage_stats(buildings, prism_path)

  assert stats["status"] == "ok"
  assert stats["drawable_source_row_count"] == 1
  assert stats["payload_prism_count"] == 1
  assert stats["omitted_source_row_count"] == 2
  assert stats["flat_source_row_count"] == 1
  assert stats["degenerate_source_part_count"] == 1


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


def test_scene_surface_stats_reports_retired_photogrammetry(tmp_path: Path) -> None:
  scene_path = tmp_path / "scene.json"
  scene_path.write_text(
    json.dumps({"render_strategy": {"legacy_photogrammetry_removed": True}}),
    encoding="utf-8",
  )

  stats = scene_surface_stats(scene_path)

  assert stats["available"] is False
  assert stats["reason"] == "retired_from_release"
  assert stats["scene_glb_files"] == 0
  assert stats["scene_glb_bytes"] == 0
