"""Step 10: source-clipped glazing frame for the retained Hippo Bay envelope."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PART = "DEBE01YYK0002NM4"
GROUND = 5.2
GRID = 1.2
# Fitted presentation orientation, not a surveyed glazing-grid bearing.
ANGLE = math.radians(35)
ORIGIN = (-2400.0, 1030.0)
FRAME = 0x526C61
EDGE = 0xA3B2A6


def roof_height(triangle: list, x: float, z: float) -> float | None:
  """Interpolate the retained triangle without changing any source ordinate."""
  a, b, c = triangle
  den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
  if abs(den) < 1e-9:
    return None
  u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
  v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
  if min(u, v, 1 - u - v) < -1e-6:
    return None
  return u * a[1] + v * b[1] + (1 - u - v) * c[1]


def build() -> dict:
  """Produce compact trim only; preserve both source owners and navigation."""
  source = json.loads((DATA / "zooGroundsV165Source.json").read_text())
  part = next(p for p in source["parts"] if p["id"] == PART)
  triangles = [
    triangle
    for surface in source["surfaces"]
    if surface["partId"] == PART and surface["kind"] == "RoofSurface"
    for triangle in surface["triangles"]
  ]
  sheets = [
    (Polygon([(p[0], p[2]) for p in tri]), tri)
    for tri in triangles
    if Polygon([(p[0], p[2]) for p in tri]).area > 1e-7
  ]
  footprint = Polygon(part["ring"])
  roof = unary_union([polygon for polygon, _ in sheets])

  def height(x: float, z: float) -> float | None:
    candidates = [roof_height(t, x, z) for t in triangles]
    return max((h for h in candidates if h is not None), default=None)

  # Clip each grid course to the complete measured roof sheets. The broad
  # source planes remain broad planes: this does not invent a new curved roof.
  ribs = []
  for axis in range(2):
    angle = ANGLE + axis * math.pi / 2
    dx, dz = math.cos(angle), math.sin(angle)
    nx, nz = -dz, dx
    for k in range(-40, 41):
      cx, cz = ORIGIN[0] + nx * k * GRID, ORIGIN[1] + nz * k * GRID
      line = LineString([(cx - dx * 80, cz - dz * 80), (cx + dx * 80, cz + dz * 80)])
      cuts = set()
      for polygon, _ in sheets:
        clipped = line.intersection(polygon)
        for segment in getattr(clipped, "geoms", [clipped]):
          if segment.geom_type != "LineString" or segment.length < 1e-7:
            continue
          for x, z in [segment.coords[0], segment.coords[-1]]:
            cuts.add(round((x - cx) * dx + (z - cz) * dz, 7))
      ordered = sorted(cuts)
      pieces = []
      for low, high in zip(ordered, ordered[1:]):
        if high - low < 1e-5:
          continue
        if not roof.covers(
          Point(cx + dx * (low + high) / 2, cz + dz * (low + high) / 2)
        ):
          continue
        x0, z0, x1, z1 = cx + dx * low, cz + dz * low, cx + dx * high, cz + dz * high
        h0, h1 = height(x0, z0), height(x1, z1)
        if h0 is None or h1 is None:
          continue
        start, end = [x0, h0 + 0.018, z0], [x1, h1 + 0.018, z1]
        # Merge exactly collinear neighbours only. This does not smooth out any
        # measured ridge, alter source triangles or simplify the source ring.
        if pieces and math.dist(pieces[-1][1], start) < 1e-5:
          previous = pieces[-1]
          slope0 = (previous[1][1] - previous[0][1]) / math.dist(
            [previous[0][0], previous[0][2]], [previous[1][0], previous[1][2]]
          )
          slope1 = (h1 - h0) / (high - low)
          if abs(slope0 - slope1) < 1e-7:
            previous[1] = end
            continue
        pieces.append([start, end])
      ribs.extend(pieces)

  # All exterior coping follows the retained ring, including its concave
  # visitor-hall side. Uprights are evenly spaced illustrative subdivisions.
  edges = []
  for a, b in zip(part["ring"], part["ring"][1:] + part["ring"][:1]):
    h0, h1 = height(*a), height(*b)
    if h0 is not None and h1 is not None:
      edges.append([[a[0], h0 + 0.025, a[1]], [b[0], h1 + 0.025, b[1]]])
  posts = []
  for distance in range(0, int(footprint.exterior.length), 3):
    point = footprint.exterior.interpolate(distance)
    top = height(point.x, point.y)
    if top is not None:
      posts.append([point.x, (GROUND + top) / 2, point.y, 0.08, top - GROUND, 0.08])

  # Independent orthogonal reading, at the original source's one-metre cells.
  # Roof trim ends flush with the existing occupied-cell ceiling. Thus existing
  # walking/navigation remains authoritative without a new solid envelope.
  native_roof = {}
  for row in source["nativeRows"]:
    x, y, z, w, h, depth, color = row
    if color != 0x758C86 or depth != 1:
      continue
    for ix in range(round(x - w / 2), round(x + w / 2)):
      iz = math.floor(z)
      if footprint.covers(
        Polygon([(ix, iz), (ix + 1, iz), (ix + 1, iz + 1), (ix, iz + 1)])
      ):
        native_roof[ix, iz] = max(native_roof.get((ix, iz), -math.inf), y + h / 2)
  native = []
  for (ix, iz), top in sorted(native_roof.items()):
    if ix % 3 == 0:
      native.append([ix + 0.5, top - 0.045, iz + 0.5, 0.14, 0.09, 1.0])
    if iz % 3 == 0:
      native.append([ix + 0.5, top - 0.045, iz + 0.5, 1.0, 0.09, 0.14])
  # The independent native facade posts are inside the retained shell's
  # footprint; unrounded measured ring positions never become rotated blocks.
  native_posts = [p for p in posts if footprint.buffer(0.06).covers(Point(p[0], p[2]))]
  result = {
    "schemaVersion": 1,
    "osm": "17042389",
    "part": PART,
    "groundY": GROUND,
    "frameColor": FRAME,
    "edgeColor": EDGE,
    "gridWidthM": GRID,
    "gridBearingEstimateDegrees": 35,
    "ribs": [[[round(v, 6) for v in p] for p in segment] for segment in ribs],
    "edges": edges,
    "posts": posts,
    "nativeRoofBars": native,
    "nativePosts": native_posts,
  }
  (DATA / "zooHippoV256Source.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  preserved = [
    DATA / "zooGroundsV165Source.json",
    DATA / "zooGroundsV165Evidence.json",
    DATA / "zooGroundsV165Navigation.json",
    DATA / "zooRecognitionV255Source.json",
    ROOT / "src/app/src/ZooRecognitionV255.ts",
    ROOT / "src/app/src/zooGroundsV165Profile.ts",
    ROOT / "src/app/src/zooRecognitionV255Profile.ts",
  ]
  receipt = {
    "step": 10,
    "scope": "Hippo Bay, existing Zoo Berlin west v165 owners only",
    "retrieved": "2026-10-20",
    "osm": "17042389",
    "retainedOwners": [p["id"] for p in source["parts"] if p["osm"] == "17042389"],
    "sourceRoofTriangles": len(triangles),
    "sourceWallAndRoofSurfaces": sum(
      s["partId"] in {PART, "DEBE01YYK0003VAC"} for s in source["surfaces"]
    ),
    "preservedInputs": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in preserved
    },
    "replacementOwners": [],
    "newDrawCalls": 0,
    "newStreamingDescriptors": 0,
    "temporalQualification": (
      "The current operator describes the double-domed Hippo Bay opened in 1997. "
      "The requested 'new' hippo house is interpreted as this existing building, "
      "distinct from the Nashorn-Pagode opened in 2023. No new 2026 hippo building "
      "or completed replacement is established by the inspected primary sources."
    ),
    "geometryLimitation": (
      "The retained LoD2 approximates the doubly curved roof with three broad "
      "triangulated sheets. Frame bars follow those elevations; no second curved "
      "shell conceals, replaces or claims to correct the measured source."
    ),
    "sources": [
      {
        "url": "https://www.zoo-berlin.de/en/explore-the-zoo/hippo-bay",
        "facts": "1997 opening, approximately 1000 m² glass roof, over 800 panes",
      },
      {
        "url": "https://www.sbp.de/en/project/house-for-hippopotamus-zoo-berlin/",
        "facts": "Architect J. Gribl; 29/21 m spans, 1.20 m mesh, 60×40 mm steel grid beams",
        "referencePhoto": (
          "https://www.sbp.de/app/uploads/2021/12/"
          "1642_97_a_MAX-1920x1268.jpg.pagespeed.ce.ZW_o1rMI6v.jpg"
        ),
        "photoCredit": "SNOWBOUND, via schlaich bergermann partner; reference only",
      },
      {
        "url": (
          "https://www.glastroesch.com/de/de/referenzen/okalux-referenzobjekte/"
          "okalux-referenz/flusspferdhaus-zoologischer-garten"
        ),
        "facts": "2016 project account: continuous double-curved glazed net shell and concave visitor hall",
      },
    ],
    "estimates": (
      "Grid bearing/phase, 60 mm visible strip width, coping width, steel hue and "
      "3 m facade-post spacing are display estimates. 1.20 m published mesh "
      "guides the drawn grid but does not establish as-built individual pane "
      "positions/count. Native uses independent 3 m rib courses on retained 1 m "
      "source cells, flush with their original ceilings."
    ),
    "counts": {
      "drawnRoofSegments": len(ribs),
      "perimeterSegments": len(edges),
      "facadePosts": len(posts),
      "nativeRoofBars": len(native),
      "nativePosts": len(native_posts),
    },
  }
  (ROOT / "geo_data/regierungsviertel/zoo-hippo-v256-evidence.json").write_text(
    json.dumps(receipt, indent=2) + "\n"
  )
  return result


if __name__ == "__main__":
  data = build()
  print(
    f"Hippo Bay: {len(data['ribs'])} drawn roof segments, "
    f"{len(data['posts'])} posts, {len(data['nativeRoofBars'])} native roof bars"
  )
