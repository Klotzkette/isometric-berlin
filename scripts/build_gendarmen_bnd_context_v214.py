"""Step 10: retain exact street planes for two bounded neighbourhood overlays."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src"
DEST = APP / "data/gendarmenBndContextV214Source.json"
PACKET = GEO / "alt-mitte-v169/source-390_5821-00.json.gz"
PERIMETER = APP / "gendarmenmarktPerimeterSource.json"
OWNERS = {
  "DEBE00YY1f30003L": ("living108", "Living 108, Chausseestraße 108–109"),
  "DEBE00YY27A000Ar": ("feuerland", "Feuerlandhöfe, Chausseestraße 38–42"),
}


def build() -> dict:
  """Extract only existing exterior planes; no source geometry is replaced."""
  roads = gpd.read_file(GEO / "osm.gpkg", layer="roads")
  roads = roads[roads["name"].fillna("") == "Chausseestraße"]
  axis = affine_transform(unary_union(roads.geometry), [1, 0, 0, -1, -389500, 5820000])
  packet = json.loads(gzip.decompress(PACKET.read_bytes()))
  buildings = []
  for owner in packet["buildings"]:
    if owner["id"] not in OWNERS:
      continue
    key, name = OWNERS[owner["id"]]
    footprint = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for part in owner["parts"]
        for p in part["footprintPolygons"]
      ]
    )
    fronts = []
    for part in owner["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        ring = surface["rings"][0]
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
        )
        length = math.hypot(b[0] - a[0], b[2] - a[2])
        low = min(p[1] for p in ring)
        above = [p[1] for p in ring if p[1] > low + 0.4]
        high = min(above) if above else low
        if length < 0.7 or high - low < 2:
          continue
        mid = Point((a[0] + b[0]) / 2, (a[2] + b[2]) / 2)
        nx, nz = -(b[2] - a[2]) / length, (b[0] - a[0]) / length
        left = footprint.contains(Point(mid.x + nx * 0.12, mid.y + nz * 0.12))
        right = footprint.contains(Point(mid.x - nx * 0.12, mid.y - nz * 0.12))
        # Inter-part planes behind the street facade are never decorated.
        if left == right:
          continue
        side = -1 if left else 1
        distance = axis.distance(mid)
        outward_distance = axis.distance(Point(mid.x + nx * side, mid.y + nz * side))
        if distance > 28 or outward_distance >= distance - 0.5:
          continue
        fronts.append(
          {
            "startXZ": [a[0], a[2]],
            "endXZ": [b[0], b[2]],
            "outwardSide": side,
            "wallBaseY": low,
            "wallTopY": high,
            "street": "Chausseestraße",
            "prismId": owner["id"],
            "sourcePartId": part["id"],
            "sourcePolygonId": surface["sourcePolygonId"],
          }
        )
    buildings.append(
      {"key": key, "name": name, "ownerIds": [owner["id"]], "fronts": fronts}
    )
  perimeter = json.loads(PERIMETER.read_text())
  for building in perimeter["buildings"]:
    # v208 already supplies a finer independent full Quartier 206 treatment.
    if building["key"] == "quartier206":
      continue
    fronts = [
      edge
      for edge in building["streetFronts"]
      if math.dist(edge["startXZ"], edge["endXZ"]) > 4
      and edge["wallTopY"] - edge["wallBaseY"] > 9
    ]
    buildings.append(
      {
        "key": building["key"],
        "name": building["name"],
        "ownerIds": building["parentIds"],
        "fronts": fronts,
      }
    )
  return {
    "schemaVersion": 1,
    "sourceReceipts": [
      {
        "path": str(path.relative_to(ROOT)),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
      for path in (PACKET, PERIMETER)
    ],
    "sourceAttribution": "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "sourceGeometryRetained": True,
    "replacementOwners": [],
    "buildings": buildings,
  }


if __name__ == "__main__":
  result = build()
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print({b["key"]: len(b["fronts"]) for b in result["buildings"]})
