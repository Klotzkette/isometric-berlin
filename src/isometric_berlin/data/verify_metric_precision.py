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
    "median_measured_height_m": round(statistics.median(height_values), 2)
    if height_values
    else None,
    "source_precision_interpretation": (
      "Footprints remain in EPSG:25833 metres and are rendered from LoD2 "
      "polygon coordinates; roof forms are official generalized standard "
      "roof forms, not photogrammetric facade relief."
    ),
  }


def load_alignment_summary(path: Path) -> dict[str, Any]:
  """Load existing landmark placement QA summary."""
  if not path.exists():
    return {"available": False, "reason": "missing_alignment_report"}
  payload = json.loads(path.read_text(encoding="utf-8"))
  return {"available": True, **payload.get("summary", {})}


def build_precision_report(
  *,
  buildings_path: Path,
  alignment_path: Path,
  out_json: Path,
  out_markdown: Path,
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
      "berlin3d_mesh_future": {
        "metadata_url": BERLIN_3D_MESH_URL,
        "claim": (
          "Berlin 3D download portal offers free OBJ mesh tiles with "
          "textures from the 2025 aerial survey; this should become the "
          "future source for true photogrammetric facade texture/relief."
        ),
      },
    },
    "buildings": building_precision_stats(buildings),
    "landmark_alignment": load_alignment_summary(alignment_path),
    "render_policy": {
      "geometry_anchor": "lod2",
      "semantic_context": "osm",
      "visual_material_cues": "wikimedia",
      "not_claimed": (
        "The current deterministic viewer is metric in planimetric LoD2/OSM "
        "placement, but it is not yet a photogrammetric textured mesh. "
        "Granular facade relief is stylised from LoD2 footprint complexity, "
        "height, roof attributes, OSM semantics, and Wikimedia colour cues."
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
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(
    "\n".join(
      [
        "# Metric precision and surface-detail QA",
        "",
        "This report documents what the current deterministic viewer can claim",
        "from committed public/open data, and where it still needs a future",
        "photogrammetric mesh pass.",
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
        f"- Future textured mesh candidate: {report['sources']['berlin3d_mesh_future']['metadata_url']}",
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
        "",
        "## Landmark placement QA",
        "",
        f"- Status: {alignment.get('status', 'unknown')}",
        f"- Landmarks checked: {alignment.get('landmarks_checked', 'n/a')}",
        f"- Relative relationships checked: {alignment.get('relative_relationships_checked', 'n/a')}",
        f"- Review count: {alignment.get('review_count', 'n/a')}",
        "",
        "## Current rendering claim",
        "",
        "The viewer is metric in planimetric placement because it renders",
        "EPSG:25833 LoD2/OSM/ALKIS geometries in metres. It now also renders",
        "LoD2 interior rings as visible courtyards/cut-outs and uses denser",
        "facade bays, roof ribs, and roof equipment marks from footprint size,",
        "height, roof type, and landmark material cues.",
        "",
        "It does **not** yet claim true photogrammetric facade relief. For that,",
        "the next major step should ingest the official Berlin 3D mesh/OBJ",
        "texture tiles or another fully licensed textured 3D source, then render",
        "from that mesh rather than stylising LoD2 footprints.",
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
  )
  print(
    "Wrote metric precision report for "
    f"{report['buildings']['building_count']} buildings to {args.out_json}"
  )


if __name__ == "__main__":
  main()
