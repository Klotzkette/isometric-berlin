"""Step 10: retain Arkonaplatz OSM context and add a representative market."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import build_surrounding_outlines as e
import geopandas as gpd
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
BBOX = (13.4004, 52.5365, 13.4035, 52.5379)


def sha(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def build() -> dict:
  cache = GEO / "raw/outer-v159/candidate.gpkg"
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  areas = gpd.read_file(cache, layer="multipolygons", bbox=BBOX).to_crs(25833)
  paths = gpd.read_file(cache, layer="lines", bbox=BBOX).to_crs(25833)
  points = gpd.read_file(pbf, layer="points", bbox=BBOX).to_crs(25833)
  park = e.world(areas[areas.osm_id == "14583948"].iloc[0].geometry)
  footprint = park.convex_hull
  features, trees, benches, beds, protected_paths = [], [], [], [], []
  protected_planting = []
  for _, r in areas.iterrows():
    tags, geometry = e.tags_for(r), e.world(r.geometry)
    if not geometry.intersects(footprint):
      continue
    if tags.get("leisure") in ("park", "playground") or tags.get("landuse") in (
      "grass",
      "flowerbed",
    ):
      features.append(
        {
          "type": "Feature",
          "properties": {"id": e.source_identity(r), "tags": tags},
          "geometry": mapping(geometry),
        }
      )
    if (
      tags.get("landuse") in ("grass", "flowerbed")
      or tags.get("leisure") == "playground"
    ):
      protected_planting.append(geometry)
    if tags.get("landuse") == "flowerbed":
      for p in e.polygons_from_geometry(geometry):
        beds.append({"id": e.source_identity(r), "ring": list(p.exterior.coords)})
  for _, r in paths.iterrows():
    tags, geometry = e.tags_for(r), e.world(r.geometry)
    if tags.get("highway") not in ("footway", "path", "steps"):
      continue
    if not geometry.intersects(footprint):
      continue
    # Complete source coordinates, not a simplified or clipped replacement.
    features.append(
      {
        "type": "Feature",
        "properties": {"id": "way/" + str(r.osm_id), "tags": tags},
        "geometry": mapping(geometry),
      }
    )
    protected_paths.append(geometry.buffer(1.25))
  for _, r in points.iterrows():
    tags, geometry = e.tags_for(r), e.world(r.geometry)
    if not footprint.covers(geometry):
      continue
    if tags.get("natural") == "tree" or tags.get("amenity") in ("bench", "marketplace"):
      features.append(
        {
          "type": "Feature",
          "properties": {"id": "node/" + str(r.osm_id), "tags": tags},
          "geometry": mapping(geometry),
        }
      )
    row = {"id": "node/" + str(r.osm_id), "xz": [geometry.x, geometry.y]}
    if tags.get("natural") == "tree":
      trees.append(row)
    if tags.get("amenity") == "bench":
      # Bearing is explicitly unmeasured; face the nearest square centre.
      closest = min(park.geoms, key=lambda p: p.distance(geometry))
      row["yaw"] = math.atan2(
        closest.centroid.x - geometry.x, closest.centroid.y - geometry.y
      )
      benches.append(row)
  trees.sort(key=lambda r: r["id"])
  existing = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_text()
  )
  old_trees = [Point(t["position"][0], t["position"][2]) for t in existing["trees"]]
  old_tree_union = unary_union([p for p in old_trees if footprint.buffer(3).covers(p)])
  # Do not create a duplicate if a later canonical tree pass adopts these nodes.
  missing_trees = [
    t
    for t in trees
    if old_tree_union.is_empty or old_tree_union.distance(Point(t["xz"])) > 1
  ]
  # Four exact endpoint vertices of the opposing park boundaries. The convex
  # hull alone also contains unrelated thin wedges on the square's perimeter.
  # Limit the surface to the real central strip before removing the full park.
  paving_clip = Polygon(
    [
      (2092.2597566532204, -2012.2667315239087),
      (2123.760696398909, -2025.9348905878142),
      (2150.0620957153733, -1965.3412568662316),
      (2115.134171263606, -1950.135298131965),
    ]
  )
  paving = (
    footprint.difference(park)
    .intersection(paving_clip)
    .difference(
      unary_union(
        protected_planting + [Point(t["xz"]).buffer(0.65, quad_segs=4) for t in trees]
      )
    )
  )
  paving_rings = [
    [list(p.exterior.coords), *[list(r.coords) for r in p.interiors]]
    for p in e.polygons_from_geometry(paving)
  ]
  native_paving = []
  minx, minz, maxx, maxz = paving.bounds
  grid = 0.5
  for ix in range(math.floor(minx / grid), math.ceil(maxx / grid)):
    for iz in range(math.floor(minz / grid), math.ceil(maxz / grid)):
      tile = box(ix * grid, iz * grid, (ix + 1) * grid, (iz + 1) * grid)
      if paving.covers(tile):
        native_paving.append([(ix + 0.5) * grid, (iz + 0.5) * grid])
  obstacles = unary_union(
    protected_paths + protected_planting + [Point(t["xz"]).buffer(2) for t in trees]
  )
  axis = (0.397, 0.918)
  length = math.hypot(*axis)
  axis = tuple(v / length for v in axis)
  across = (axis[1], -axis[0])
  origin = (
    2119.35,
    -1987.59,
  )  # rounded source central-way junction; authored layout anchor
  stalls = []
  for side in (-9, -7, -3, 3, 7, 9):
    for along in range(-30, 34, 1):
      x = origin[0] + axis[0] * along + across[0] * side
      z = origin[1] + axis[1] * along + across[1] * side
      corners = [
        [x + axis[0] * u + across[0] * v, z + axis[1] * u + across[1] * v]
        for u, v in [(-1.6, -1.0), (1.6, -1.0), (1.6, 1.0), (-1.6, 1.0)]
      ]
      polygon = Polygon(corners)
      if not footprint.covers(polygon) or polygon.intersects(obstacles):
        continue
      obstacles = unary_union([obstacles, polygon.buffer(0.8)])
      stalls.append(
        {
          "id": len(stalls),
          "xz": [x, z],
          "yaw": -math.atan2(axis[1], axis[0]),
          "ring": corners,
        }
      )
  data = {
    "trees": missing_trees,
    "benches": benches,
    "beds": beds,
    "stalls": stalls,
    "pavingRings": paving_rings,
    "pavingClip": list(paving_clip.exterior.coords),
    "nativePavingCentres": native_paving,
    "sourceTreeCount": len(trees),
    "marketNode": [2124.525136126962, -1975.5765480604023],
    "parkCentre": [park.centroid.x, park.centroid.y],
  }
  (ROOT / "src/app/src/data/arkonaplatzV193.json").write_text(
    json.dumps(data, separators=(",", ":")) + "\n"
  )
  (GEO / "arkonaplatz-v193-source.geojson").write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "coordinateFrame": "EPSG:25833 transformed to world x=easting-389500,z=5820000-northing",
        "features": features,
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  audit = {
    "step": 10,
    "sourceDate": "2026-09-29",
    "license": "ODbL-1.0",
    "sources": {str(p.relative_to(ROOT)): sha(p) for p in [cache, pbf]},
    "counts": {
      "sourceTrees": len(trees),
      "missingTreesAdded": len(missing_trees),
      "benches": len(benches),
      "beds": len(beds),
      "stalls": len(stalls),
      "pavingAreaM2": paving.area,
      "nativePavingTiles": len(native_paving),
    },
    "marketClearanceM": 1.25,
    "treeClearanceM": 2,
    "marketPolicy": "Representative Sunday market, not live occupancy. Stall positions, dimensions, stock and canopy choices are procedural estimates inside the mapped central paved strip. All source footways keep at least 2.5m clear drawn corridors (at least 2.0m after conservative native block rounding); lawns/playground and existing source vertices remain untouched.",
    "treePolicy": "Exact mapped nodes; untagged heights/crowns are modest display estimates. Native retains a stable half-density subset only under the owner-requested Minecraft tree reduction. Complete source nodes remain inventoried.",
    "pavingPolicy": "The prior generic green ground incorrectly filled the paved central market strip. Add only convexHull(park14583948) minus complete park, clipped to four exact park-endpoint vertices, minus actual grass/flowerbed/playground polygons and estimated 0.65m trunk apertures. Existing mapped path surfaces remain intact above this warm-gray sheet. Native uses fully contained 0.5m tiles, no broad square slab.",
    "factSources": [
      "https://www.berlin.de/special/shopping/flohmaerkte/1998213-1724959-flohmarkt-am-arkonaplatz.html",
      "https://www.flohmarkt-arkonaplatz.de/oeffnungszeiten",
    ],
  }
  (GEO / "arkonaplatz-v193-evidence.json").write_text(
    json.dumps(audit, indent=2) + "\n"
  )
  return audit


if __name__ == "__main__":
  print(json.dumps(build()["counts"]))
