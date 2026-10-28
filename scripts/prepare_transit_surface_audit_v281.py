"""Read-only, bounded geometry fixture for the actual transit surface test."""

import json
from pathlib import Path

from shapely import make_valid
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def fixture():
  source = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_bytes()
  )
  rails = json.loads((ROOT / "src/app/src/data/tramRailsV281.json").read_bytes())
  points = []
  for track in rails["tracks"]:
    line = LineString(track["points"])
    for fraction in [0.2, 0.5, 0.8]:
      point = line.interpolate(fraction, normalized=True)
      points.append([point.x / 10, point.y / 10, track["id"]])
  stairs = json.loads((ROOT / "src/app/src/data/ubahnEntrancesV281.json").read_bytes())[
    "stairs"
  ]
  # Metres become the original decimetres only for this read-only intersection.
  window = unary_union(
    [box(x * 10 - 20, z * 10 - 20, x * 10 + 20, z * 10 + 20) for x, z, _ in points]
    + [
      box(
        s["top"][0] * 10 - 120,
        s["top"][1] * 10 - 120,
        s["top"][0] * 10 + 120,
        s["top"][1] * 10 + 120,
      )
      for s in stairs
    ]
  )
  polygons = []
  repaired = []
  for index, entry in enumerate(source["roads"]):
    polygon = Polygon(entry["ring"], entry.get("holes", []))
    if not box(*polygon.bounds).intersects(window):
      continue
    if not polygon.is_valid:
      # Source coordinates never change. Handle only the audit copy's rounded
      # self-intersections, matching polygon set coverage rather than throwing.
      polygon = make_valid(polygon)
      repaired.append(index)
    clipped = polygon.intersection(window)
    for piece in (
      [clipped] if clipped.geom_type == "Polygon" else getattr(clipped, "geoms", [])
    ):
      if piece.geom_type != "Polygon" or piece.is_empty:
        continue
      polygons.append(
        dict(
          kind=entry["kind"],
          name=entry["name"],
          area_m2=piece.area / 100,
          ring=list(piece.exterior.coords),
          holes=[list(i.coords) for i in piece.interiors],
        )
      )
  return dict(
    schema_version=source["schema_version"],
    parks=[],
    water=[],
    roads=polygons,
    points=points,
    auditOnlyInvalidPolygonIndices=repaired,
  )


if __name__ == "__main__":
  print(json.dumps(fixture(), separators=(",", ":")))
