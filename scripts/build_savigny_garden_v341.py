"""Fill evidenced shrub gaps at Savignyplatz without changing its lawn or paths."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import pyogrio
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union

from scripts.build_mitte_garden_details import Terrain, polygon_dm
from scripts.build_surrounding_outlines import world

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = DATA / "savignyGardenV341.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/savigny-garden-v341-evidence.json"
IDS = ("252591398", "58422317")


def read(path: Path) -> dict:
  """Read an unchanged source file."""
  return json.loads(path.read_bytes())


def build() -> tuple[dict, dict]:
  """Build source-contained small foliage from the two mapped scrub polygons."""
  city = read(DATA / "cityWestCinemasV166Source.json")
  park = shape(
    next(
      x["geometry"] for x in city["publicRealm"] if x["id"] == "OSM-relation-5462503"
    )
  )
  rows = pyogrio.read_dataframe(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="osm_way_id IN ('252591398','58422317')",
  ).to_crs(25833)
  surface = read(CORE / "surface-polygons.json")
  bodies = read(CORE / "lod2-prisms.json")
  region = box(-3420, 1300, -3300, 1460)
  obstacles = []
  for item in [*surface["roads"], *surface["water"], *bodies["buildings"]]:
    p = polygon_dm(item).buffer(0)
    if p.intersects(region):
      obstacles.append(p.buffer(0.20))
  for x, z, r, *_ in surface["scrub_points"]:
    if region.covers(Point(x / 10, z / 10)):
      obstacles.append(Point(x / 10, z / 10).buffer(r / 10 + 0.20))
  obstruction = unary_union(obstacles)
  terrains = [
    Terrain(read(CORE / name), bool(i))
    for i, name in enumerate(("ground-context.json", "minecraft-voxels.json"))
  ]
  patches, records = [], []
  for row in rows.sort_values("osm_way_id").itertuples():
    assert row.natural == "scrub"
    mapped = world(row.geometry).buffer(0)
    allowed = mapped.intersection(park).difference(obstruction).buffer(-0.52)
    anchors = []
    minx, minz, maxx, maxz = allowed.bounds
    for iz in range(math.floor(minz / 1.15), math.ceil(maxz / 1.15)):
      for ix in range(math.floor(minx / 1.15), math.ceil(maxx / 1.15)):
        x = round(ix * 1.15 + (iz % 2) * 0.40, 3)
        z = round(iz * 1.15, 3)
        if not allowed.covers(Point(x, z)):
          continue
        heights = [terrain.at(x, z) for terrain in terrains]
        if any(
          y is None or name not in ("park", "grass", "ground", "pedestrian")
          for name, y in heights
        ):
          continue
        height = 0.38 + ((ix * 17 + iz * 23) % 5) * 0.055
        anchors.append(
          [
            x,
            z,
            round(heights[0][1], 3),
            round(heights[1][1], 3),
            round(height, 3),
            (ix + iz) % 3,
          ]
        )
    assert anchors, row.osm_way_id
    patches.append({"id": row.osm_way_id, "anchors": anchors})
    records.append(
      {
        "id": row.osm_way_id,
        "kind": "scrub",
        "sourceGeometry": mapping(mapped),
        "allowedCentres": mapping(allowed),
        "count": len(anchors),
      }
    )
  originals = {
    str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in [
      DATA / "cityWestCinemasV166Source.json",
      CORE / "surface-polygons.json",
      CORE / "lod2-prisms.json",
      CORE / "ground-context.json",
      CORE / "minecraft-voxels.json",
    ]
  }
  data = {"version": 341, "sourceIds": list(IDS), "patches": patches}
  evidence = {
    "version": 341,
    "originals": originals,
    "patches": records,
    "reference": "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.156595.php",
    "status": "Retained OSM scrub polygons and real terrain datums; crown spacing, species-neutral foliage and height are illustrative. Existing shrubs, source paths, water, buildings and lawn remain.",
  }
  return data, evidence


if __name__ == "__main__":
  data, evidence = build()
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(
    {
      "patches": len(data["patches"]),
      "clusters": sum(len(x["anchors"]) for x in data["patches"]),
      "bytes": OUT.stat().st_size,
    }
  )
