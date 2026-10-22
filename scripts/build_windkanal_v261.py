"""Bounded, explicitly estimated curved roof reading on measured Windkanal sheets."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import build_district_facades_v188 as io
import numpy as np
from build_breitscheid_towers_v161 import normal_of
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data/windkanalV261.json"
REF = io.GEO / "windkanal-v261-profile.json"
SOURCE = io.GEO / "adlershof-kuehn-v261-source.json.gz"
AXIS = np.array([0.751, -0.6603])
AXIS /= np.linalg.norm(AXIS)
CROSS = np.array([-AXIS[1], AXIS[0]])
ANCHOR = np.array([10570.0, 9945.0])


def build() -> dict:
  data = io.read_json(SOURCE)
  owner = next(b for b in data["buildings"] if b["id"] == "DEBE09YYO00007rF")
  part = next(p for p in owner["parts"] if p["id"] == "DEBE3DA0Ja4DQLYW")
  roofs = []
  for surface in part["surfaces"]:
    if surface["kind"] != "RoofSurface":
      continue
    ring = np.asarray(surface["rings"][0])
    plan = Polygon(ring[:, [0, 2]])
    plane = np.linalg.lstsq(
      np.c_[ring[:, [0, 2]], np.ones(len(ring))], ring[:, 1], rcond=None
    )[0]
    normal = np.asarray(normal_of(surface["rings"][0]))
    curved = abs(normal[1]) < 0.98
    gradient = plane[:2] / np.linalg.norm(plane[:2])
    along = ring[:, [0, 2]] @ gradient
    roofs.append((plan, plane, curved, gradient, along.min(), along.max()))
  footprint = unary_union([s[0] for s in roofs])
  curved_foot = unary_union([s[0] for s in roofs if s[2]])
  triangles = []
  cells: dict[tuple[int, int, int], int] = {}
  skin, rib = 0xB6B6A6, 0x989C90

  def height(x: float, z: float) -> float:
    point = np.array([x, z])
    candidates = []
    from shapely.geometry import Point

    for plan, plane, curved, gradient, lo, hi in roofs:
      if not plan.buffer(0.002).covers(Point(x, z)):
        continue
      y = float(np.r_[point, 1] @ plane)
      if curved:
        t = max(0, min(1, (point @ gradient - lo) / (hi - lo)))
        # Round the outer roof facet above its chord, never stack a complete
        # second pipe on top. The per-face edge taper keeps original joins.
        edge = min(1, plan.boundary.distance(Point(x, z)) / 0.65)
        y += min(0.95, (hi - lo) * 0.20) * math.sin(math.pi * t) * edge
      candidates.append(y)
    assert candidates, (x, z)
    return max(candidates) + 0.07

  def emit(polygon, colour: int, lift=0.0):
    for triangle in constrained_delaunay_triangles(polygon).geoms:
      xyz = [
        [round(x, 3), round(height(x, z) + lift, 3), round(z, 3)]
        for x, z in list(triangle.exterior.coords)[:3]
      ]
      triangles.append([colour, *xyz])
      # Independent 1 m exterior cells, sampled from this shallow skin.
      a, b, c = np.asarray(xyz)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(a - b), np.linalg.norm(b - c), np.linalg.norm(c - a))
          / 0.45
        ),
      )
      for i in range(steps + 1):
        for j in range(steps - i + 1):
          p = a + (b - a) * (i / steps) + (c - a) * (j / steps)
          key = (math.floor(p[0]), math.floor(p[1]), math.floor(p[2]))
          cells[key] = colour

  x0, z0, x1, z1 = curved_foot.bounds
  for x in range(math.floor(x0), math.ceil(x1)):
    for z in range(math.floor(z0), math.ceil(z1)):
      cut = curved_foot.intersection(box(x, z, x + 1, z + 1))
      for polygon in [cut] if isinstance(cut, Polygon) else getattr(cut, "geoms", []):
        if isinstance(polygon, Polygon) and polygon.area > 0.00001:
          emit(polygon, skin)
  # Photo-supported reinforcing rings, conservatively only their upper arcs.
  # Axial station positions are estimates and stay on this measured owner.
  for u in [-24, -12, 0, 12, 24]:
    corners = [
      ANCHOR + AXIS * a + CROSS * b
      for a, b in [(u - 0.16, 2.5), (u + 0.16, 2.5), (u + 0.16, 17), (u - 0.16, 17)]
    ]
    strip = footprint.intersection(Polygon(corners))
    for v in np.arange(2.5, 17, 1):
      cell = Polygon(
        [
          ANCHOR + AXIS * a + CROSS * b
          for a, b in [
            (u - 0.16, v),
            (u + 0.16, v),
            (u + 0.16, v + 1),
            (u - 0.16, v + 1),
          ]
        ]
      )
      cut = strip.intersection(cell)
      for polygon in [cut] if isinstance(cut, Polygon) else getattr(cut, "geoms", []):
        if isinstance(polygon, Polygon) and polygon.area > 0.00001:
          emit(polygon, rib, 0.18)
  # All voxels must remain inside the source part's outward half-cell reading.
  blocks = [
    [x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, c] for (x, y, z), c in sorted(cells.items())
  ]
  result = {
    "schemaVersion": 1,
    "sourceSha256": io.digest(SOURCE),
    "owner": owner["id"],
    "part": part["id"],
    "status": "Reference-guided rounded outer roof skin and upper reinforcement arcs; cross-section and ring stations are estimates, not a surveyed complete tube. Every official sheet, courtyard and neighbour remains unchanged.",
    "triangles": triangles,
    "blocks": blocks,
    "sourceFootprint": part["footprints"],
    "bounds": [float(x0), float(z0), float(x1), float(z1)],
    "roofFacets": int(sum(s[2] for s in roofs)),
  }
  io.write_json(OUT, result)
  assert OUT.stat().st_size < 650000
  io.write_json(
    REF,
    {
      "source": str(SOURCE.relative_to(ROOT)),
      "sourceSha256": result["sourceSha256"],
      "owner": owner["id"],
      "part": part["id"],
      "roofFacets": result["roofFacets"],
      "skinRiseM": 0.95,
      "clearanceM": 0.07,
      "ribRiseM": 0.18,
      "nativeCellM": 1,
      "support": "WISTA primary photo shows reinforced round concrete shell; WISTA describes diameter 8.5–12 m and outside extent 58×26 m. Full round replacement would conflict with coarse LoD2 lower walls; this strictly additive upper contour is an explicit partial estimate.",
      "references": [
        "https://www.adlershof.de/kiez/digitale-spaziergaenge/gedankengang",
        "https://www.adlershof.de/immobilien/bauprojekte/architektur",
      ],
      "photoReferenceOnly": "https://www.adlershof.de/fileadmin/user_upload/bilder/content/geschichte/architektur/windkanal.jpg",
      "dataSha256": hashlib.sha256(OUT.read_bytes()).hexdigest(),
      "drawnTriangles": len(triangles),
      "nativeBlocks": len(blocks),
    },
  )
  print(
    json.dumps(
      {"bytes": OUT.stat().st_size, "triangles": len(triangles), "blocks": len(blocks)}
    )
  )
  return result


if __name__ == "__main__":
  build()
