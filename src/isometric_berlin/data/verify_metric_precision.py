"""Summarise metric precision evidence for the Regierungsviertel render."""

from __future__ import annotations

import argparse
import json
import statistics
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
from pandas import Series, concat
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry

from isometric_berlin.data.common import BERLIN_PROJECTED, sha256_file, write_json
from isometric_berlin.generation.build_isometric_prisms import (
  DM_PER_M,
  quantise_ring,
  simplify_part,
)
from isometric_berlin.generation.build_minecraft_voxels import to_world
from isometric_berlin.generation.building_corrections import load_current_buildings
from isometric_berlin.generation.road_geometry import (
  ROAD_WIDTHS_M,
  road_width_m,
  road_width_source,
)

LOD2_METADATA_URL = (
  "https://gdi.berlin.de/geonetwork/srv/api/records/"
  "3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf"
)
DOP_METADATA_URL = (
  "https://gdi.berlin.de/geonetwork/srv/api/records/"
  "73a3de47-ab2a-4be2-ae5d-8d6f8fe5cc1c"
)
ALKIS_METADATA_URL = (
  "https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7"
)
BERLIN_3D_MESH_URL = (
  "https://www.businesslocationcenter.de/en/economic-atlas/download-portal"
)
CHANCELLERY_ARCHITECTURE_URL = (
  "https://www.bundesregierung.de/breg-de/bundesregierung/"
  "bundeskanzleramt/geschichte-bundeskanzleramt-975040"
)
OFFICIAL_DETAILS_URL = (
  "https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23"
)
OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"


def polygons(geometry: Any) -> list[Polygon]:
  """Return polygon parts from a Shapely geometry."""
  if geometry is None or getattr(geometry, "is_empty", True):
    return []
  if isinstance(geometry, Polygon):
    return [geometry]
  if isinstance(geometry, MultiPolygon):
    return list(geometry.geoms)
  if isinstance(geometry, GeometryCollection):
    return [part for item in geometry.geoms for part in polygons(item)]
  return []


def segment_lengths(poly: Polygon) -> list[float]:
  """Return exterior/interior segment lengths in metres."""
  lengths: list[float] = []
  rings = [poly.exterior, *poly.interiors]
  for ring in rings:
    coords = list(ring.coords)
    for start, end in zip(coords, coords[1:], strict=False):
      lengths.append(((start[0] - end[0]) ** 2 + (start[1] - end[1]) ** 2) ** 0.5)
  return lengths


def geometry_integrity_stats(
  frame: gpd.GeoDataFrame, bounds: BaseGeometry | None = None
) -> dict[str, Any]:
  """Count invalid, empty and out-of-bounds source geometries."""
  if frame.crs is None:
    frame = frame.set_crs(BERLIN_PROJECTED)
  frame = frame.to_crs(BERLIN_PROJECTED)
  geometries = list(frame.geometry)
  limit = bounds.buffer(0.02) if bounds is not None else None
  return {
    "geometry_count": len(geometries),
    "invalid_geometry_count": sum(
      geometry is not None and not geometry.is_empty and not geometry.is_valid
      for geometry in geometries
    ),
    "empty_geometry_count": sum(
      geometry is None or geometry.is_empty for geometry in geometries
    ),
    "outside_bounds_count": (
      sum(
        geometry is not None and not geometry.is_empty and not limit.covers(geometry)
        for geometry in geometries
      )
      if limit is not None
      else None
    ),
  }


def building_precision_stats(
  buildings: gpd.GeoDataFrame,
  bounds: BaseGeometry | None = None,
  source_building_count: int | None = None,
) -> dict[str, Any]:
  """Return metric shape/detail stats from the committed LoD2 footprints."""
  if buildings.crs is None:
    buildings = buildings.set_crs(BERLIN_PROJECTED)
  buildings = buildings.to_crs(BERLIN_PROJECTED)
  parts = [poly for geom in buildings.geometry for poly in polygons(geom)]
  if not parts:
    return {
      "building_count": 0,
      "polygon_part_count": 0,
      "status": "no_buildings",
    }
  vertex_counts = [
    (len(poly.exterior.coords) - 1)
    + sum(max(0, len(interior.coords) - 1) for interior in poly.interiors)
    for poly in parts
  ]
  hole_count = sum(len(poly.interiors) for poly in parts)
  lengths = [length for poly in parts for length in segment_lengths(poly) if length > 0]
  measured = buildings.get("measured_height_m")
  measured_count = int(measured.notna().sum()) if measured is not None else 0
  roles = buildings.get("lod2_role")
  part_count = int((roles == "building_part").sum()) if roles is not None else 0
  parents = buildings.get("parent_building_id")
  ensemble_count = int(parents.dropna().nunique()) if parents is not None else 0
  creation_dates = buildings.get("source_creation_date")
  current_creation_date = (
    max(str(value) for value in creation_dates.dropna().tolist())
    if creation_dates is not None and creation_dates.notna().any()
    else None
  )
  height_values = [
    float(value)
    for value in (measured.dropna().tolist() if measured is not None else [])
    if float(value) >= 2.5
  ]
  integrity = geometry_integrity_stats(buildings, bounds)
  return {
    "building_count": int(len(buildings)),
    "source_building_count": source_building_count or int(len(buildings)),
    "excluded_historical_count": max(
      0, (source_building_count or int(len(buildings))) - int(len(buildings))
    ),
    "polygon_part_count": len(parts),
    "building_footprint_area_m2": round(float(buildings.geometry.area.sum()), 2),
    "footprint_vertex_count": int(sum(vertex_counts)),
    "median_vertices_per_polygon": round(statistics.median(vertex_counts), 2),
    "interior_ring_count": int(hole_count),
    "median_segment_length_m": round(statistics.median(lengths), 2),
    "min_segment_length_m": round(min(lengths), 2),
    "max_segment_length_m": round(max(lengths), 2),
    "measured_height_count": measured_count,
    "measured_height_share": round(measured_count / len(buildings), 4),
    "building_part_count": part_count,
    "segmented_ensemble_count": ensemble_count,
    "latest_source_creation_date": current_creation_date,
    "median_measured_height_m": round(statistics.median(height_values), 2)
    if height_values
    else None,
    "source_precision_interpretation": (
      "Footprints remain in EPSG:25833 metres and are rendered from LoD2 "
      "polygon coordinates; roof forms are official generalized standard "
      "roof forms, not photogrammetric facade relief."
    ),
    **integrity,
  }


def prism_coverage_stats(
  buildings: gpd.GeoDataFrame, prism_path: Path | None
) -> dict[str, Any]:
  """Reproduce the drawn-prism inclusion policy and verify its payload."""
  if prism_path is None or not prism_path.exists():
    return {"available": False, "reason": "missing_lod2_prism_payload"}
  if buildings.crs is None:
    buildings = buildings.set_crs(BERLIN_PROJECTED)
  buildings = buildings.to_crs(BERLIN_PROJECTED)
  payload = json.loads(prism_path.read_text(encoding="utf-8"))
  payload_parts = payload.get("buildings", [])
  source_parts = 0
  drawable_parts = 0
  drawable_rows = 0
  flat_rows = 0
  flat_parts = 0
  degenerate_parts = 0
  omitted_nonflat_areas: list[float] = []
  id_suffixes: list[str] = []
  for row in buildings.itertuples(index=False):
    id_suffixes.append(str(getattr(row, "building_id", ""))[-8:])
    parts = polygons(to_world(row.geometry))
    source_parts += len(parts)
    height_m = float(getattr(row, "measured_height_m", 0.0) or 0.0)
    if round(height_m * DM_PER_M) <= 0:
      flat_rows += 1
      flat_parts += len(parts)
      continue
    retained_in_row = 0
    for part in parts:
      simplified = simplify_part(part)
      ring = quantise_ring(simplified.exterior) if simplified is not None else None
      if simplified is None or ring is None:
        degenerate_parts += 1
        omitted_nonflat_areas.append(float(part.area))
        continue
      drawable_parts += 1
      retained_in_row += 1
    drawable_rows += retained_in_row > 0
  payload_count = len(payload_parts)
  return {
    "available": True,
    "status": "ok" if payload_count == drawable_parts else "review",
    "path": str(prism_path),
    "sha256": sha256_file(prism_path),
    "current_source_row_count": int(len(buildings)),
    "current_source_polygon_part_count": source_parts,
    "drawable_source_row_count": drawable_rows,
    "drawable_prism_part_count": drawable_parts,
    "payload_prism_count": payload_count,
    "omitted_source_row_count": int(len(buildings)) - drawable_rows,
    "omitted_source_part_count": source_parts - drawable_parts,
    "flat_source_row_count": flat_rows,
    "flat_source_part_count": flat_parts,
    "degenerate_source_part_count": degenerate_parts,
    "median_omitted_nonflat_part_area_m2": (
      round(statistics.median(omitted_nonflat_areas), 3)
      if omitted_nonflat_areas
      else None
    ),
    "max_omitted_nonflat_part_area_m2": (
      round(max(omitted_nonflat_areas), 3) if omitted_nonflat_areas else None
    ),
    "source_id_suffix_collision_count": len(id_suffixes) - len(set(id_suffixes)),
    "retention_policy": (
      "Measured-height parts at least 1 m2 after 0.15 m topology-preserving "
      "simplification; sub-5 cm flats and degenerate source slivers stay in "
      "the audited GeoPackage but are not extruded."
    ),
  }


def road_bridge_precision_stats(
  osm_path: Path | None,
  bounds: BaseGeometry | None,
  voxel_path: Path | None = None,
) -> dict[str, Any]:
  """Summarise every committed OSM street and bridge geometry."""
  if osm_path is None or not osm_path.exists():
    return {"available": False, "reason": "missing_osm_geopackage"}
  roads = gpd.read_file(osm_path, layer="roads").to_crs(BERLIN_PROJECTED)
  line_mask = roads.geometry.geom_type.isin(["LineString", "MultiLineString"])
  supported = roads[line_mask & roads["highway"].isin(ROAD_WIDTHS_M)].copy()
  road_bridge_mask = (
    roads.get("bridge", Series(index=roads.index, dtype="string")).notna()
    & (
      roads.get("bridge", Series(index=roads.index, dtype="string"))
      .astype(str)
      .str.lower()
      != "no"
    )
    & line_mask
  )
  road_bridges = roads[road_bridge_mask].copy()
  if "rail" in set(gpd.list_layers(osm_path)["name"]):
    rail = gpd.read_file(osm_path, layer="rail").to_crs(BERLIN_PROJECTED)
  else:
    rail = gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  rail_line_mask = rail.geometry.geom_type.isin(["LineString", "MultiLineString"])
  rail_bridge_mask = (
    rail.get("bridge", Series(index=rail.index, dtype="string")).notna()
    & (
      rail.get("bridge", Series(index=rail.index, dtype="string"))
      .astype(str)
      .str.lower()
      != "no"
    )
    & rail_line_mask
  )
  rail_bridges = rail[rail_bridge_mask].copy()
  bridges = gpd.GeoDataFrame(
    concat([road_bridges, rail_bridges], ignore_index=True),
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  evidence = [road_width_source(row) for _, row in supported.iterrows()]
  widths = [road_width_m(row) for _, row in supported.iterrows()]
  integrity = geometry_integrity_stats(roads, bounds)
  bridge_integrity = geometry_integrity_stats(bridges, bounds)
  return {
    "available": True,
    "road_feature_count": int(len(roads)),
    "supported_road_line_count": int(len(supported)),
    "road_centerline_length_m": round(float(supported.geometry.length.sum()), 2),
    "resolved_width_count": sum(width is not None for width in widths),
    "width_evidence": {
      source: evidence.count(source)
      for source in ("width", "est_width", "lanes", "class_fallback")
    },
    "bridge_line_count": int(len(bridges)),
    "road_bridge_line_count": int(len(road_bridges)),
    "rail_bridge_line_count": int(len(rail_bridges)),
    "named_bridge_line_count": int(
      bridges.get("name", Series(dtype="string")).notna().sum()
    ),
    "bridge_centerline_length_m": round(float(bridges.geometry.length.sum()), 2),
    "width_policy": "width > est_width > mapped lanes > highway-class fallback",
    "status": (
      "ok"
      if all(
        integrity[key] == 0 and bridge_integrity[key] == 0
        for key in (
          "invalid_geometry_count",
          "empty_geometry_count",
          "outside_bounds_count",
        )
      )
      else "review"
    ),
    **{f"road_{key}": value for key, value in integrity.items()},
    **{f"bridge_{key}": value for key, value in bridge_integrity.items()},
    "rendered_water_crossings": voxel_bridge_stats(voxel_path),
  }


def voxel_bridge_stats(path: Path | None) -> dict[str, Any]:
  """Count connected bridge-deck groups retained by the block/drawn worlds."""
  if path is None or not path.exists():
    return {"available": False, "reason": "missing_voxel_payload"}
  payload = json.loads(path.read_text(encoding="utf-8"))
  classes = payload.get("classes", [])
  if "bridge" not in classes:
    return {"available": False, "reason": "missing_bridge_class"}
  bridge_class = classes.index("bridge")
  cells: set[tuple[int, int]] = set()
  for z, encoded_row in enumerate(payload.get("ground_rows", [])):
    for x_start, run, class_id in encoded_row:
      if class_id == bridge_class:
        cells.update((x, z) for x in range(x_start, x_start + run))
  clusters: list[int] = []
  remaining = set(cells)
  while remaining:
    stack = [remaining.pop()]
    size = 0
    while stack:
      x, z = stack.pop()
      size += 1
      for dz in range(-2, 3):
        for dx in range(-2, 3):
          neighbour = (x + dx, z + dz)
          if neighbour in remaining:
            remaining.remove(neighbour)
            stack.append(neighbour)
    clusters.append(size)
  return {
    "available": True,
    "bridge_cell_count": len(cells),
    "cluster_count": len(clusters),
    "small_cluster_count": sum(size < 12 for size in clusters),
    "minimum_cluster_cells": min(clusters, default=0),
    "retention_policy": "all clusters, including one-cell narrow stegs",
  }


def landmark_scale_stats(buildings: gpd.GeoDataFrame) -> dict[str, Any]:
  """Return explicit scale evidence for complex named LoD2 ensembles."""
  names = buildings.get("building_name")
  if names is None:
    return {}
  chancellery = buildings[names == "Bundeskanzleramt"]
  if chancellery.empty:
    return {}
  heights = [float(value) for value in chancellery["measured_height_m"].dropna()]
  return {
    "bundeskanzleramt": {
      "source": "Berlin LoD2 BuildingPart geometry",
      "official_architecture_url": CHANCELLERY_ARCHITECTURE_URL,
      "part_count": int(len(chancellery)),
      "footprint_area_m2": round(float(chancellery.geometry.area.sum()), 2),
      "min_measured_height_m": round(min(heights), 3),
      "median_measured_height_m": round(statistics.median(heights), 3),
      "max_measured_height_m": round(max(heights), 3),
      "published_nominal_heights_m": {
        "office_rows": 18,
        "central_cube": 36,
      },
      "interpretation": (
        "The renderer uses each official LoD2 part and measured height. "
        "Published 18 m / 36 m architectural dimensions are a QA cross-check; "
        "LoD2 roof/parapet and terrain references can be higher."
      ),
    }
  }


def load_alignment_summary(path: Path) -> dict[str, Any]:
  """Load existing landmark placement QA summary."""
  if not path.exists():
    return {"available": False, "reason": "missing_alignment_report"}
  payload = json.loads(path.read_text(encoding="utf-8"))
  return {"available": True, **payload.get("summary", {})}


def scene_surface_stats(path: Path | None) -> dict[str, Any]:
  """Summarise committed official-mesh tiers from the browser manifest."""
  if path is None or not path.exists():
    return {"available": False, "reason": "missing_scene_manifest"}
  scene = json.loads(path.read_text(encoding="utf-8"))
  base = scene.get("base_tiles", [])
  settled = scene.get("surface_detail_tiles", [])
  heroes = [
    file
    for group in scene.get("hero_details", [])
    if isinstance(group, dict)
    for file in group.get("files", [])
    if isinstance(file, dict)
  ]

  def total(rows: list[dict[str, Any]], key: str) -> int:
    return sum(int(row.get(key, 0)) for row in rows)

  all_assets = [*base, *settled, *heroes]
  return {
    "available": True,
    "path": str(path),
    "sha256": sha256_file(path),
    "source_tiles": len(base),
    "base_faces": total(base, "faces"),
    "base_vertices": total(base, "vertices"),
    "base_bytes": total(base, "bytes"),
    "base_target_faces_per_tile": base[0].get("target_faces") if base else None,
    "settled_faces": total(settled, "faces"),
    "settled_vertices": total(settled, "vertices"),
    "settled_bytes": total(settled, "bytes"),
    "settled_target_faces_per_tile": (
      settled[0].get("target_faces") if settled else None
    ),
    "normal_crease_degrees": base[0].get("normal_crease_degrees") if base else None,
    "simplification_aggression": (
      base[0].get("simplification_aggression") if base else None
    ),
    "hero_groups": len(scene.get("hero_details", [])),
    "hero_files": len(heroes),
    "hero_faces": total(heroes, "faces"),
    "scene_glb_files": len(all_assets),
    "scene_glb_bytes": total(all_assets, "bytes"),
    "largest_glb_bytes": max(
      (int(row.get("bytes", 0)) for row in all_assets), default=0
    ),
  }


def build_precision_report(
  *,
  buildings_path: Path,
  alignment_path: Path,
  out_json: Path,
  out_markdown: Path,
  scene_path: Path | None = None,
  osm_path: Path | None = None,
  bounds_path: Path | None = None,
  voxel_path: Path | None = None,
  prism_path: Path | None = None,
) -> dict[str, Any]:
  """Build and write JSON/Markdown precision evidence reports."""
  source_buildings = gpd.read_file(buildings_path, layer="buildings")
  buildings = (
    load_current_buildings(buildings_path)
    if {"building_name", "building_id"}.issubset(source_buildings.columns)
    else source_buildings.copy()
  )
  bounds = (
    gpd.read_file(bounds_path).to_crs(BERLIN_PROJECTED).geometry.union_all()
    if bounds_path is not None and bounds_path.exists()
    else None
  )
  building_stats = building_precision_stats(
    buildings,
    bounds,
    source_building_count=len(source_buildings),
  )
  building_stats["source_geometry_audit"] = geometry_integrity_stats(
    source_buildings, bounds
  )
  building_stats["drawn_prism_coverage"] = prism_coverage_stats(buildings, prism_path)
  report = {
    "generated_at": datetime.now(tz=UTC).isoformat(),
    "coordinate_reference_system": BERLIN_PROJECTED,
    "sources": {
      "lod2": {
        "path": str(buildings_path),
        "sha256": sha256_file(buildings_path),
        "metadata_url": LOD2_METADATA_URL,
        "claim": (
          "Official Berlin LoD2; building footprints correspond exactly to "
          "cadastral building outlines, with generalized standard roof forms."
        ),
      },
      "dop": {
        "metadata_url": DOP_METADATA_URL,
        "claim": (
          "Official Berlin DOP 2025 orthophotos: 0.20 m ground resolution "
          "and approximately +/- 0.4 m positional accuracy."
        ),
      },
      "alkis": {
        "metadata_url": ALKIS_METADATA_URL,
        "claim": "Official cadastral parcel context for geometry QA.",
      },
      "berlin3d_mesh": {
        "path": str(scene_path) if scene_path is not None else None,
        "metadata_url": BERLIN_3D_MESH_URL,
        "claim": (
          "The committed viewer renders bounded official photogrammetric OBJ "
          "geometry and aerial textures from the June 2025 survey."
        ),
      },
      "berlindetails": {
        "metadata_url": OFFICIAL_DETAILS_URL,
        "claim": (
          "Official bounded tree catalogues, public-lighting points and "
          "Vorderlandmauer traces support public-space detail."
        ),
      },
      "osm": {
        "path": str(osm_path) if osm_path is not None else None,
        "sha256": sha256_file(osm_path)
        if osm_path is not None and osm_path.exists()
        else None,
        "metadata_url": OSM_COPYRIGHT_URL,
        "claim": "OSM centrelines, bridge tags and mapped width/lane evidence.",
      },
    },
    "buildings": building_stats,
    "roads_and_bridges": road_bridge_precision_stats(osm_path, bounds, voxel_path),
    "landmark_scale": landmark_scale_stats(buildings),
    "landmark_alignment": load_alignment_summary(alignment_path),
    "photogrammetric_surface": scene_surface_stats(scene_path),
    "render_policy": {
      "geometry_anchor": "lod2",
      "semantic_context": "osm",
      "visual_material_cues": "wikimedia",
      "limitations": (
        "The official mesh provides photogrammetric surface relief and aerial "
        "colour. Procedural landmark, window, train, tunnel and monument "
        "recognition layers remain labelled display approximations and are not "
        "surveyed as-built facade or interior geometry."
      ),
    },
  }
  write_json(out_json, report)
  write_precision_markdown(out_markdown, report)
  return report


def write_precision_markdown(path: Path, report: dict[str, Any]) -> None:
  """Write a human-readable metric precision report."""
  buildings = report["buildings"]
  prism_coverage = buildings["drawn_prism_coverage"]
  roads = report["roads_and_bridges"]
  alignment = report["landmark_alignment"]
  chancellery = report.get("landmark_scale", {}).get("bundeskanzleramt", {})
  surface = report["photogrammetric_surface"]
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(
    "\n".join(
      [
        "# Metric precision and surface-detail QA",
        "",
        "This report documents what the current deterministic viewer can claim",
        "from committed public/open data, including the official photogrammetric",
        "surface, and which additions remain display approximations.",
        "",
        "## Source hierarchy",
        "",
        f"- LoD2 geometry anchor: {report['sources']['lod2']['metadata_url']}",
        "  - Official metadata states that Berlin LoD2 footprints correspond to",
        "    cadastral building outlines; roof forms are generalized standard",
        "    roof forms.",
        f"- DOP orthophoto QA: {report['sources']['dop']['metadata_url']}",
        "  - Official DOP 2025 metadata gives 0.20 m ground resolution and",
        "    approximately +/- 0.4 m positional accuracy.",
        f"- ALKIS parcel context: {report['sources']['alkis']['metadata_url']}",
        f"- Official textured surface: {report['sources']['berlin3d_mesh']['metadata_url']}",
        "  - The committed scene uses bounded geometry and aerial texture colour",
        "    from the June 2025 Berlin survey.",
        f"- Official public-space details: {report['sources']['berlindetails']['metadata_url']}",
        "",
        "## Committed LoD2 geometry statistics",
        "",
        f"- Official source building features audited: {buildings['source_building_count']}",
        f"- Current source features after documented corrections: {buildings['building_count']}",
        f"- Documented historical/demolished features excluded: {buildings['excluded_historical_count']}",
        f"- Polygon parts: {buildings['polygon_part_count']}",
        f"- Total footprint area: {buildings['building_footprint_area_m2']} m²",
        f"- Current source footprint vertices audited: {buildings['footprint_vertex_count']}",
        f"- Median vertices per polygon: {buildings['median_vertices_per_polygon']}",
        f"- Interior rings / courtyards: {buildings['interior_ring_count']}",
        f"- Median segment length: {buildings['median_segment_length_m']} m",
        f"- Measured LoD2 heights: {buildings['measured_height_count']} ({buildings['measured_height_share']:.1%})",
        f"- Explicit CityGML BuildingParts: {buildings['building_part_count']}",
        f"- Segmented parent ensembles: {buildings['segmented_ensemble_count']}",
        f"- Latest source creation date: {buildings['latest_source_creation_date']}",
        f"- Invalid / empty / outside-bounds geometries: {buildings['invalid_geometry_count']} / {buildings['empty_geometry_count']} / {buildings['outside_bounds_count']}",
        f"- Full source invalid / empty / outside-bounds geometries: {buildings['source_geometry_audit']['invalid_geometry_count']} / {buildings['source_geometry_audit']['empty_geometry_count']} / {buildings['source_geometry_audit']['outside_bounds_count']}",
        f"- Drawn-prism coverage status: {prism_coverage.get('status', 'unavailable')}",
        f"- Drawn LoD2 prisms: {prism_coverage.get('payload_prism_count', 'n/a')} parts from {prism_coverage.get('drawable_source_row_count', 'n/a')} current source rows",
        f"- Non-extruded source rows / parts: {prism_coverage.get('omitted_source_row_count', 'n/a')} / {prism_coverage.get('omitted_source_part_count', 'n/a')}",
        f"  - Sub-5 cm flat rows: {prism_coverage.get('flat_source_row_count', 'n/a')}",
        f"  - Degenerate non-flat parts: {prism_coverage.get('degenerate_source_part_count', 'n/a')} (maximum footprint {prism_coverage.get('max_omitted_nonflat_part_area_m2', 'n/a')} m²)",
        "",
        "## Complete street and bridge geometry audit",
        "",
        f"- Status: {roads.get('status', 'unavailable')}",
        f"- OSM road features audited: {roads.get('road_feature_count', 'n/a')}",
        f"- Supported road centrelines rendered: {roads.get('supported_road_line_count', 'n/a')}",
        f"- Resolved full widths: {roads.get('resolved_width_count', 'n/a')}",
        f"- Width evidence: {roads.get('width_evidence', {})}",
        f"- OSM bridge centrelines audited: {roads.get('bridge_line_count', 'n/a')}",
        f"  - Road/path bridges: {roads.get('road_bridge_line_count', 'n/a')}",
        f"  - Rail bridges/viaduct lines: {roads.get('rail_bridge_line_count', 'n/a')}",
        f"- Named bridge centrelines: {roads.get('named_bridge_line_count', 'n/a')}",
        f"- Rendered water-crossing groups: {roads.get('rendered_water_crossings', {}).get('cluster_count', 'n/a')} ({roads.get('rendered_water_crossings', {}).get('small_cluster_count', 'n/a')} narrow groups retained)",
        f"- Road invalid / empty / outside-bounds geometries: {roads.get('road_invalid_geometry_count', 'n/a')} / {roads.get('road_empty_geometry_count', 'n/a')} / {roads.get('road_outside_bounds_count', 'n/a')}",
        f"- Bridge invalid / empty / outside-bounds geometries: {roads.get('bridge_invalid_geometry_count', 'n/a')} / {roads.get('bridge_empty_geometry_count', 'n/a')} / {roads.get('bridge_outside_bounds_count', 'n/a')}",
        f"- Width policy: {roads.get('width_policy', 'n/a')}",
        "",
        "## Bundeskanzleramt scale check",
        "",
        f"- Official architecture reference: {chancellery.get('official_architecture_url', 'n/a')}",
        f"- Rendered LoD2 parts: {chancellery.get('part_count', 'n/a')}",
        f"- Measured part-height range: {chancellery.get('min_measured_height_m', 'n/a')}–{chancellery.get('max_measured_height_m', 'n/a')} m",
        f"- Measured median part height: {chancellery.get('median_measured_height_m', 'n/a')} m",
        "- Published nominal architecture: 18 m office rows; 36 m central cube.",
        "- Rendering policy: preserve every LoD2 part and measured height; use",
        "  published nominal dimensions as QA rather than flattening the ensemble.",
        "",
        "## Landmark placement QA",
        "",
        f"- Status: {alignment.get('status', 'unknown')}",
        f"- Landmarks checked: {alignment.get('landmarks_checked', 'n/a')}",
        f"- Relative relationships checked: {alignment.get('relative_relationships_checked', 'n/a')}",
        f"- Review count: {alignment.get('review_count', 'n/a')}",
        "",
        "## Committed photogrammetric surface statistics",
        "",
        f"- Status: {'available' if surface.get('available') else 'unavailable'}",
        f"- Official source tiles: {surface.get('source_tiles', 'n/a')}",
        f"- Interaction faces: {surface.get('base_faces', 'n/a')}",
        f"- Interaction vertices: {surface.get('base_vertices', 'n/a')}",
        f"- Interaction GLB size: {surface.get('base_bytes', 0) / 1024 / 1024:.1f} MiB",
        f"- Settled desktop faces: {surface.get('settled_faces', 'n/a')}",
        f"- Settled desktop vertices: {surface.get('settled_vertices', 'n/a')}",
        f"- Settled desktop GLB size: {surface.get('settled_bytes', 0) / 1024 / 1024:.1f} MiB",
        f"- Settled per-tile target: {surface.get('settled_target_faces_per_tile', 'n/a')} faces",
        f"- Normal crease: {surface.get('normal_crease_degrees', 'n/a')}°",
        f"- Simplification aggression: {surface.get('simplification_aggression', 'n/a')}",
        f"- Separate high-detail hero groups: {surface.get('hero_groups', 'n/a')}",
        f"- Complete scene: {surface.get('scene_glb_files', 'n/a')} GLBs / {surface.get('scene_glb_bytes', 0) / 1024 / 1024:.1f} MiB",
        "",
        "## Current rendering claim",
        "",
        "The viewer is metric in planimetric placement because it renders",
        "EPSG:25833 LoD2/OSM/ALKIS geometries in metres. It now also renders",
        "all drawable CityGML BuildingParts at their individual measured",
        "heights, while the report above exposes sub-5 cm flats and tiny",
        "degenerate source slivers that are retained in the GeoPackage but not",
        "extruded. LoD2",
        "interior rings as visible courtyards/cut-outs, and uses denser",
        "facade bays, roof ribs, and roof equipment marks from footprint size,",
        "height, roof type, and landmark material cues. The official Berlin 3D",
        "Mesh adds genuine photogrammetric roof, facade, ground and canopy relief",
        "at unchanged EPSG:25833 scale, with a six-million-face settled tier.",
        "",
        "Procedural monument, window, train, tunnel and architectural-signature",
        "layers remain labelled display geometry. They are not surveyed facade,",
        "interior or as-built detail and do not replace LoD2/official-mesh anchors.",
        "",
        "## Tiergartentunnel precision claim",
        "",
        "The Tiergartentunnel route is drawn as a visible underground",
        "engineering cutaway using derived OpenStreetMap tunnel carriageway",
        "geometry, public portal coordinates, public route descriptions and",
        "published cross-section facts. Its rendered centreline and depth are",
        "still an approximation, not official surveyed as-built geometry. See",
        "[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).",
        "",
      ]
    ),
    encoding="utf-8",
  )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--buildings",
    type=Path,
    default=Path("geo_data/regierungsviertel/buildings.gpkg"),
  )
  parser.add_argument(
    "--voxel",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json"),
  )
  parser.add_argument(
    "--prisms",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json"),
  )
  parser.add_argument(
    "--osm",
    type=Path,
    default=Path("geo_data/regierungsviertel/osm.gpkg"),
  )
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--scene",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/scene.json"),
  )
  parser.add_argument(
    "--alignment",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmark_alignment.json"),
  )
  parser.add_argument(
    "--out-json",
    type=Path,
    default=Path("geo_data/regierungsviertel/metric_precision.json"),
  )
  parser.add_argument(
    "--out-markdown",
    type=Path,
    default=Path("docs/metric-precision.md"),
  )
  args = parser.parse_args()
  report = build_precision_report(
    buildings_path=args.buildings,
    alignment_path=args.alignment,
    out_json=args.out_json,
    out_markdown=args.out_markdown,
    scene_path=args.scene,
    osm_path=args.osm,
    bounds_path=args.bounds,
    voxel_path=args.voxel,
    prism_path=args.prisms,
  )
  print(
    "Wrote metric precision report for "
    f"{report['buildings']['building_count']} buildings to {args.out_json}"
  )


if __name__ == "__main__":
  main()
