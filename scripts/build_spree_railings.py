"""Clip mapped riverside railings to the retained Spree and viewer bounds."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString
from shapely.ops import transform
from spree_shore import spree_water_envelope

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_surface_polygons import (
  DEFAULT_BOUNDS,
  line_parts,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/spree_v137/barriers.json"
OUTPUT = ROOT / "src/app/src/data/spreeRailings.json"


def build_payload(raw_path: Path = RAW) -> dict:
  """Keep mapped rail runs, excluding construction, walls and transverse fences."""
  osm = ROOT / "geo_data/regierungsviertel/osm.gpkg"
  water, water_ids = spree_water_envelope(osm)
  bounds = project_geometry(load_bounds_polygon(DEFAULT_BOUNDS))
  # A selection tolerance, not a buffer used to move or fabricate a rail.
  corridor = water.boundary.buffer(6.0).intersection(bounds)
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  raw = json.loads(raw_path.read_text())
  rails = []
  for element in raw["elements"]:
    tags = element.get("tags", {})
    if tags.get("barrier") not in ("fence", "handrail"):
      continue
    if tags.get("landuse") == "construction" or tags.get("access") == "private":
      continue
    coordinates = [(p["lon"], p["lat"]) for p in element.get("geometry", [])]
    if len(coordinates) < 2:
      continue
    source = transform(project, LineString(coordinates))
    clipped = source.intersection(corridor)
    # A property fence meeting the river at right angles is not a bank rail.
    if clipped.length < source.length * 0.6:
      continue
    for index, line in enumerate(line_parts(clipped)):
      if line.length < 8:
        continue
      height = None
      try:
        height = float(tags.get("height", "").removesuffix(" m"))
      except ValueError:
        pass
      rails.append(
        {
          "id": f"{element['id']}:{index}",
          "osm_way": element["id"],
          "tags": {
            key: tags[key]
            for key in ("barrier", "fence_type", "material", "height", "colour")
            if key in tags
          },
          "height_m": height if height and 0.5 <= height <= 2.5 else 1.1,
          "height_source": "tag" if height and 0.5 <= height <= 2.5 else "display",
          "points_m": [
            [round(x - 389500, 2), round(5820000 - y, 2)] for x, y in line.coords
          ],
          "length_m": round(line.length, 2),
        }
      )
  return {
    "source": {
      "license": "ODbL-1.0",
      "osm_timestamp": raw["osm3s"]["timestamp_osm_base"],
      "raw_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
      "retained_osm_sha256": hashlib.sha256(osm.read_bytes()).hexdigest(),
      "water_ids": water_ids,
      "selection_distance_m": 6,
      "policy": "Exact mapped line courses, clipped to Spree shore and existing bounds; post/bar spacing, missing heights and colours are procedural display estimates. No barrier is added across an unrecorded gap.",
    },
    "rails": sorted(rails, key=lambda r: r["id"]),
  }


if __name__ == "__main__":
  payload = build_payload()
  OUTPUT.write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        "runs": len(payload["rails"]),
        "length_m": sum(r["length_m"] for r in payload["rails"]),
        "bytes": OUTPUT.stat().st_size,
      }
    )
  )
