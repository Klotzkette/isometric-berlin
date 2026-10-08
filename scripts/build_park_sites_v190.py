"""Step 10: retained source paths, benches, basin edges and bunker railings."""

import hashlib
import json
import math
from pathlib import Path

import build_surrounding_outlines as e
import geopandas as gpd
import shapely
from shapely.geometry import Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
NAMES = ("Volkspark Humboldthain", "Volkspark Friedrichshain")


def build() -> dict:
  cache = DATA / "raw/outer-v159/candidate.gpkg"
  areas = gpd.read_file(cache, layer="multipolygons").to_crs(25833)
  parks = areas[areas.name.isin(NAMES) & (areas.leisure == "park")]
  scope = unary_union(parks.geometry)
  pbf = DATA / "raw/outer-v159/berlin-260929.osm.pbf"
  point_cache = DATA / "raw/north-city-v190/park-points.gpkg"
  if point_cache.exists():
    points = gpd.read_file(point_cache)
  else:
    points = gpd.read_file(
      pbf, layer="points", bbox=(13.379, 52.522, 13.446, 52.549), engine="pyogrio"
    )
    points.to_file(point_cache, driver="GPKG")
  points = points.to_crs(25833)
  lines = gpd.read_file(cache, layer="lines").to_crs(25833)
  result = {
    "parks": [],
    "benches": [],
    "edges": [],
    "basins": [],
    "bunker": {},
    "woodlandTrees": [],
  }
  evidence = []
  for _, r in parks.iterrows():
    result["parks"].append(
      {
        "name": r["name"],
        "sourceId": e.source_identity(r),
        "bounds": list(e.world(r.geometry).bounds),
      }
    )
  for _, r in points[points.geometry.intersects(scope)].iterrows():
    t = e.tags_for(r)
    if t.get("amenity") != "bench":
      continue
    p = e.world(r.geometry)
    # Unknown orientation is explicit, never an invented surveyed bearing.
    result["benches"].append(
      {
        "point": [round(p.x, 3), round(p.y, 3)],
        "direction": t.get("direction"),
        "id": "node/" + str(r.osm_id),
      }
    )
  for _, r in lines[lines.geometry.intersects(scope)].iterrows():
    t = e.tags_for(r)
    if (
      t.get("barrier") not in ("fence", "wall", "retaining_wall", "hedge")
      and t.get("highway") != "steps"
    ):
      continue
    for part in e.line_parts(e.world(r.geometry.intersection(scope))):
      result["edges"].append(
        {
          "id": "way/" + str(r.osm_id),
          "kind": t.get("barrier", "steps"),
          "points": [[round(x, 3), round(z, 3)] for x, z in part.coords],
        }
      )
  for _, r in areas[areas.geometry.intersects(scope)].iterrows():
    t = e.tags_for(r)
    world = e.world(r.geometry)
    if t.get("water") == "basin" or t.get("amenity") == "fountain":
      for p in e.polygons_from_geometry(e.polygonal(shapely.make_valid(world))):
        result["basins"].append(
          {
            "id": e.source_identity(r),
            "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords],
          }
        )
    if t.get("name") == "Flakturm Humboldthain":
      result["bunker"] = {
        "id": e.source_identity(r),
        "ring": [
          [round(x, 3), round(z, 3)] for x, z in list(world.geoms)[0].exterior.coords
        ],
        "topY": 55.4,
        "bottomY": 13.4,
      }
    if t.get("name") in (
      "Flakturm Humboldthain",
      "Humboldthain Rosengarten",
      "Märchenbrunnen",
    ):
      evidence.append({"id": e.source_identity(r), "tags": t})
  # Low-density crowns illustrate only mapped woodland, never a tree survey.
  woods, obstacles = [], []
  for _, row in areas[areas.geometry.intersects(scope)].iterrows():
    tags = e.tags_for(row)
    if tags.get("natural") == "wood" or tags.get("landuse") == "forest":
      woods.append(row.geometry.intersection(scope))
    if tags.get("building") or tags.get("natural") == "water":
      obstacles.append(row.geometry.buffer(8))
  for _, row in lines[lines.geometry.intersects(scope)].iterrows():
    tags = e.tags_for(row)
    if tags.get("highway") or tags.get("railway"):
      obstacles.append(row.geometry.buffer(6))
  for _, row in points[points.geometry.intersects(scope)].iterrows():
    if e.tags_for(row).get("natural") == "tree":
      obstacles.append(row.geometry.buffer(12))
  free = e.world(unary_union(woods).difference(unary_union(obstacles)))
  minx, minz, maxx, maxz = free.bounds
  for ix in range(math.ceil(minx / 22), math.floor(maxx / 22) + 1):
    for iz in range(math.ceil(minz / 22), math.floor(maxz / 22) + 1):
      seed = (ix * 73856093 ^ iz * 19349663) & 0xFFFFFFFF
      x, z = ix * 22 + seed % 7 - 3, iz * 22 + (seed >> 6) % 7 - 3
      if free.covers(Point(x, z).buffer(5)):
        result["woodlandTrees"].append(
          [x, z, 7 + seed % 3, 12 + (seed >> 4) % 5, (ix + iz) % 2]
        )
  result["policy"] = (
    "Exact retained OSM nodes/rings; previous complete park geometry and DGM preserved. Bench orientation when untagged, railing dimensions, material tones and vertical detail are explicit display estimates. Woodland crowns are illustrative 22m sampling strictly inside mapped woods, clear of mapped paths/water/buildings/trees; native uses half that density. Bunker envelope y13.4–55.4 retains the v182 source conflict; no imaginary museum interior."
  )
  (ROOT / "src/app/src/data/parkSitesV190.json").write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  evidence = {
    "sourceSha256": hashlib.sha256(pbf.read_bytes()).hexdigest(),
    "license": "ODbL-1.0",
    "sourceFeatures": evidence,
    "counts": {k: len(v) for k, v in result.items() if isinstance(v, list)},
    "policy": result["policy"],
    "references": [
      "https://www.berliner-unterwelten.de/fuehrungen/oeffentliche-fuehrungen/vom-flakturm-zum-truemmerberg.html",
      "https://www.berlin.de/landesdenkmalamt/aktivitaeten/artikel.1506986.php",
      "https://commons.wikimedia.org/wiki/File:Berlin_Humboldthain_Aussichtspunkte_Bunker.jpg",
    ],
  }
  (DATA / "park-sites-v190-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  return evidence


if __name__ == "__main__":
  print(build()["counts"])
