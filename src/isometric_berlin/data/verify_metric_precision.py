"""Summarise metric precision evidence for the Regierungsviertel render."""

from __future__ import annotations

import argparse
import json
import statistics
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon

from isometric_berlin.data.common import BERLIN_PROJECTED, sha256_file, write_json

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


def building_precision_stats(buildings: gpd.GeoDataFrame) -> dict[str, Any]:
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
  return {
    "building_count": int(len(buildings)),
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
) -> dict[str, Any]:
  """Build and write JSON/Markdown precision evidence reports."""
  buildings = gpd.read_file(buildings_path, layer="buildings")
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
    },
    "buildings": building_precision_stats(buildings),
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
        f"- Buildings: {buildings['building_count']}",
        f"- Polygon parts: {buildings['polygon_part_count']}",
        f"- Total footprint area: {buildings['building_footprint_area_m2']} m²",
        f"- Footprint vertices rendered: {buildings['footprint_vertex_count']}",
        f"- Median vertices per polygon: {buildings['median_vertices_per_polygon']}",
        f"- Interior rings / courtyards: {buildings['interior_ring_count']}",
        f"- Median segment length: {buildings['median_segment_length_m']} m",
        f"- Measured LoD2 heights: {buildings['measured_height_count']} ({buildings['measured_height_share']:.1%})",
        f"- Explicit CityGML BuildingParts: {buildings['building_part_count']}",
        f"- Segmented parent ensembles: {buildings['segmented_ensemble_count']}",
        f"- Latest source creation date: {buildings['latest_source_creation_date']}",
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
        "CityGML BuildingParts at their individual measured heights, LoD2",
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
  )
  print(
    "Wrote metric precision report for "
    f"{report['buildings']['building_count']} buildings to {args.out_json}"
  )


if __name__ == "__main__":
  main()
