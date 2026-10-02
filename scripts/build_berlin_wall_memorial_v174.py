"""Step 3/10: present-day Bernauer memorial, exact OSM courses and LoD2 museums.

The enclosed monument is explicitly different from the open memorial landscape.
Unmeasured members are procedural estimates; no historical border is invented.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import tags_for, world
from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw"
DEST = ROOT / "src/app/src/data/berlinWallMemorialV174Source.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/berlin-wall-memorial-v174.json"
NAV = ROOT / "src/app/src/data/berlinWallMemorialV174Navigation.json"
GROUND = 5.2
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENTS = {
  "DEBE01YYK0003tZM": "documentation-center",
  "DEBE01YYK0003tGE": "viewing-tower",
  "DEBE00YY2hR0005R": "viewing-tower",
  "DEBE01YYK0003yxD": "visitor-center",
}
LINES = {
  "1504490315": "front-wall",
  "1504490317": "front-wall",
  "129028211": "rear-wall",
  "446637390": "rear-remnant",
  "446637389": "rear-remnant",
  "446637038": "rear-remnant",
  "1504490302": "rear-remnant",
  "1504490305": "rear-remnant",
  "1504490306": "rear-remnant",
  "129029469": "signal-fence-remnant",
  "53257439": "steel-endpoint",
  "126462918": "steel-endpoint",
  "446637042": "preserved-patrol-path",
  "1504490312": "current-steel-markers",
  "1504490313": "current-steel-markers",
  "1504490314": "current-steel-markers",
  "1080303188": "current-steel-markers",
  "1504490311": "current-steel-markers",
  "126462840": "current-steel-markers",
}
POLYGONS = {"45664093", "45664094", "45664095", "53333454", "158945354"}
CONCRETE, JOINT, RUST, GLASS, STEEL = (
  0xC3C0B1,
  0x8F9088,
  0x865038,
  0x496064,
  0xA3AAA8,
)
SOURCES = [
  "https://www.stiftung-berliner-mauer.de/en/berlin-wall-memorial/visit/map",
  "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/bernauer-strasse-648145.php",
  "https://www.berlin.de/sen/stadtentwicklung/staedtebau/einzelprojekte/gedenkstaette-berliner-mauer/",
  "https://www.zhn-architekten.de/referenzen/nationale-gedenkstaette-berliner-mauer/",
  "https://gemeinde-versoehnung.de/kapelle/",
  "https://www.onarchitektur.de/gedenkstaette-berline-mauer.html?cid=77&file=files%2Fonarki%2FPDFs%2FMauer.pdf",
  "https://sinai.de/sites/default/files/pdf/veroeffentlichung/1110_Deutsche_Bauzeitung_GBM.pdf",
]


def rounded(value: Any) -> Any:
  """Millimetre presentation coordinates, preserving source records separately."""
  if isinstance(value, float):
    return round(value, 4)
  if isinstance(value, (tuple, list)):
    return [rounded(v) for v in value]
  if isinstance(value, dict):
    return {k: rounded(v) for k, v in value.items()}
  return value


def extract_osm() -> tuple[dict, list[LineString]]:
  """Extract finite identities, not an unbounded historical wall relation."""
  features: dict[str, dict] = {}
  paths = []
  for layer in ["lines", "multipolygons"]:
    frame = gpd.read_file(
      RAW / "outer-v159/candidate.gpkg",
      layer=layer,
      bbox=(13.385, 52.532, 13.402, 52.54),
    ).to_crs(25833)
    for _, row in frame.iterrows():
      tags = tags_for(row)
      oid = str(row.osm_id) if layer == "lines" else tags.get("osm_way_id")
      geom = world(row.geometry)
      if layer == "lines" and tags.get("highway") in ("footway", "path", "steps"):
        if tags.get("access") not in ("no", "private"):
          paths.append(geom)
      if oid in LINES or oid in POLYGONS:
        features[oid] = {
          "osmKey": f"way/{oid}",
          "role": LINES.get(oid, "mapped-building-or-enclosure"),
          "tags": tags,
          "geometry": mapping(geom),
        }
  assert set(LINES) | POLYGONS == set(features)
  points = gpd.read_file(
    RAW / "outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=(13.387, 52.533, 13.401, 52.538),
  ).to_crs(25833)
  for _, row in points.iterrows():
    if str(row.osm_id) == "746066862":
      features["746066862"] = {
        "osmKey": "node/746066862",
        "role": "window-of-remembrance",
        "tags": {k: v for k, v in tags_for(row).items() if k != "inscription"},
        "geometry": mapping(world(row.geometry)),
      }
  assert "746066862" in features
  return features, paths


def extract_lod2() -> list[dict]:
  """Retain every source part/surface of the two previously coarse museums."""
  archive = RAW / "lod2/LoD2_390_5821.zip"
  with zipfile.ZipFile(archive) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  result = []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    datum = min(
      float(pos.text.split()[i])
      for pos in parent.findall(".//g:posList", NS)
      for i in range(2, len(pos.text.split()), 3)
    )
    # Tower and documentation building share one source vertical datum. Their
    # source ground planes are genuinely higher than the main building base.
    if PARENTS[pid] == "viewing-tower":
      datum = 36.556
    for part in leaf_building_parts(parent) or [parent]:
      sid = part.get("{" + NS["g"] + "}id")
      surfaces = []
      for boundary in part.findall("b:boundedBy", NS):
        for surface in boundary:
          for poly in surface.findall(".//g:Polygon", NS):
            rings = []
            for pos in poly.findall(".//g:posList", NS):
              a = list(map(float, pos.text.split()))
              r = [
                [a[i] - 389500, a[i + 2] - datum + GROUND, 5820000 - a[i + 1]]
                for i in range(0, len(a), 3)
              ]
              if r[0] == r[-1]:
                r.pop()
              rings.append(r)
            surfaces.append(
              {
                "kind": surface.tag.split("}")[-1],
                "sourcePolygonId": poly.get("{" + NS["g"] + "}id"),
                "rings": rounded(rings),
              }
            )
      ys = [p[1] for s in surfaces for r in s["rings"] for p in r]
      result.append(
        {
          "id": sid,
          "parentId": pid,
          "role": PARENTS[pid],
          "groundY": min(ys),
          "topY": max(ys),
          "sourceDatumNHN": datum,
          "surfaces": surfaces,
        }
      )
  assert {p["parentId"] for p in result} == set(PARENTS)
  return result


def build() -> tuple[dict, dict, dict, dict]:
  """Build independent, bounded representations and a small collision contract."""
  from shapely.geometry import shape

  features, paths = extract_osm()
  parts = extract_lod2()
  geoms = {oid: shape(f["geometry"]) for oid, f in features.items()}
  enclosure = geoms["45664093"].geoms[0]
  boxes, caps, sheets, solids, native = [], [], [], [], []
  roles: Counter[str] = Counter()
  native_cells: dict[tuple[int, int, int], int] = {}

  def sheet(role: str, rings: list, color: int, source_id: str | None = None) -> None:
    ts = triangles_for(rings)
    if ts:
      sheets.append({"role": role, "color": color, "triangles": ts})
      roles[role] += 1
      if source_id:
        sheets[-1]["sourcePolygonId"] = source_id
      # The preserved sand remains a thin ground finish in native mode too.
      if role == "enclosed-preserved-sand":
        poly = Polygon([(x, z) for x, _, z in rings[0]])
        x0, z0, x1, z1 = poly.bounds
        for iz in range(math.floor(z0 / 0.5), math.ceil(z1 / 0.5)):
          z = (iz + 0.5) * 0.5
          xs = [
            ix
            for ix in range(math.floor(x0 / 0.5), math.ceil(x1 / 0.5))
            if poly.covers(Point((ix + 0.5) * 0.5, z))
          ]
          if not xs:
            continue
          first = prev = xs[0]
          for ix in xs[1:] + [xs[-1] + 2]:
            if ix != prev + 1:
              native.append(
                [
                  (first + prev + 1) * 0.25,
                  GROUND + 0.09,
                  z,
                  (prev - first + 1) * 0.5,
                  0.06,
                  0.5,
                  color,
                ]
              )
              first = ix
            prev = ix
        return
      # Independent 0.75 m surface sampling, not filled building volumes.
      for tri in ts:
        a, b, c = np.array(tri)
        steps = max(
          1,
          math.ceil(
            max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
            / 0.37
          ),
        )
        for i in range(steps + 1):
          for j in range(steps + 1 - i):
            p = a + (b - a) * (i / steps) + (c - a) * (j / steps)
            key = tuple(math.floor(float(v) / 0.75) for v in p)
            native_cells[key] = color

  def add_box(
    role: str,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    angle: float,
    color: int,
    collision: bool = False,
    native_step: float = 0.5,
  ) -> None:
    boxes.append([x, y, z, w, h, d, angle, color])
    roles[role] += 1
    co, si = math.cos(angle), math.sin(angle)
    poly = Polygon(
      [
        (x + u * co + v * si, z - u * si + v * co)
        for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
      ]
    )
    if collision:
      solids.append(
        {
          "role": role,
          "ring": list(poly.exterior.coords)[:-1],
          "y0": y - h / 2,
          "y1": y + h / 2,
        }
      )
    # Thin facade fields and members remain thin native cuboids. Longer rotated
    # objects become an orthogonal stepped sequence, without a rotated smooth box.
    if w < 0.8 and d < 0.8:
      native.append([x, y, z, max(w, 0.16), h, max(d, 0.16), color])
      return
    axis = LineString(
      [(x - co * w / 2, z + si * w / 2), (x + co * w / 2, z - si * w / 2)]
    )
    steps = max(1, math.ceil(w / native_step))
    # Cell centres follow source course; every native member is axis-aligned.
    for i in range(steps):
      p = axis.interpolate((i + 0.5) / steps, normalized=True)
      native.append(
        [
          p.x,
          y,
          p.y,
          max(abs(co) * w / steps, abs(si) * d, 0.16),
          h,
          max(abs(si) * w / steps, abs(co) * d, 0.16),
          color,
        ]
      )

  def line_box(
    role: str,
    a: tuple,
    b: tuple,
    height: float,
    width: float,
    color: int,
    *,
    y: float = GROUND,
    collision: bool = False,
  ) -> None:
    dx, dz = b[0] - a[0], b[1] - a[1]
    add_box(
      role,
      (a[0] + b[0]) / 2,
      y + height / 2,
      (a[1] + b[1]) / 2,
      math.hypot(dx, dz),
      height,
      width,
      -math.atan2(dz, dx),
      color,
      collision,
    )

  # Preserve the source geometry; modern steel endpoints are separate from both
  # historical walls. No wall is extrapolated into the public memorial landscape.
  for oid, role in LINES.items():
    line = geoms[oid]
    tags = features[oid]["tags"]
    if role in ("front-wall", "rear-wall", "rear-remnant", "steel-endpoint"):
      height = float(tags.get("height", "3.0"))
      width = 0.24 if role == "steel-endpoint" else 0.20
      for a, b in zip(line.coords, list(line.coords)[1:]):
        line_box(
          role,
          a,
          b,
          height,
          width,
          RUST if role == "steel-endpoint" else CONCRETE,
          collision=True,
        )
        if role == "front-wall":
          length = math.dist(a, b)
          angle = -math.atan2(b[1] - a[1], b[0] - a[0])
          caps.append(
            [
              (a[0] + b[0]) / 2,
              GROUND + height - 0.12,
              (a[1] + b[1]) / 2,
              length,
              0.19,
              angle,
              CONCRETE,
            ]
          )
          # Native coping is an orthogonal stepped block run, not cylinders.
          before = len(boxes)
          line_box(
            "native-coping-only", a, b, 0.38, 0.38, CONCRETE, y=GROUND + height - 0.31
          )
          boxes.pop(before)
          roles.pop("native-coping-only", None)
        if role == "steel-endpoint":
          # LDA: stainless inward faces, weathering-steel outward faces.
          v = np.array(b) - np.array(a)
          v /= np.linalg.norm(v)
          n = np.array([-v[1], v[0]])
          mid = (np.array(a) + np.array(b)) / 2
          if not enclosure.buffer(1.3).covers(Point(mid + n)):
            n *= -1
          line_box(
            "endpoint-inner-stainless",
            np.array(a) + n * 0.135,
            np.array(b) + n * 0.135,
            height - 0.12,
            0.018,
            STEEL,
            y=GROUND + 0.06,
          )
        else:
          count = max(1, math.ceil(math.dist(a, b) / 1.2))
          for j in range(1, count):
            t = j / count
            add_box(
              "concrete-panel-joint",
              a[0] + (b[0] - a[0]) * t,
              GROUND + height / 2,
              a[1] + (b[1] - a[1]) * t,
              0.022,
              height - 0.2,
              0.215,
              -math.atan2(b[1] - a[1], b[0] - a[0]),
              JOINT,
            )
    elif role == "current-steel-markers":
      # OSM maps uninterrupted symbolic-bar courses through public paths. Keep
      # every mapped public crossing open rather than introducing a new fence.
      for distance in np.arange(0.1, line.length, 0.36):
        p = line.interpolate(distance)
        if any(path.distance(p) < 1.35 for path in paths):
          continue
        add_box(
          role, p.x, GROUND + 1.8, p.y, 0.085, 3.6, 0.085, 0, RUST, collision=True
        )
    elif role == "signal-fence-remnant":
      # The retained source explicitly says ruins=yes: posts only, not a new
      # intact electrified mesh or invented barbed-wire obstacles.
      for distance in np.arange(0, line.length, 2.7):
        p = line.interpolate(distance)
        add_box(
          role, p.x, GROUND + 1.5, p.y, 0.13, 3, 0.13, 0, 0x777B70, collision=True
        )
    elif role == "preserved-patrol-path":
      a, b = np.array(line.coords[0]), np.array(line.coords[-1])
      v = (b - a) / line.length
      n = np.array([-v[1], v[0]])
      for side in (-0.72, 0.72):
        line_box(
          "patrol-concrete-wheel-track",
          a + n * side,
          b + n * side,
          0.07,
          0.62,
          0xB4B4A4,
          y=GROUND + 0.135,
        )
      for d in np.arange(0, line.length, 1.5):
        p = a + v * d
        for side in (-0.72, 0.72):
          q = p + n * side
          line_box(
            "patrol-slab-joints",
            q - n * 0.31,
            q + n * 0.31,
            0.008,
            0.025,
            JOINT,
            y=GROUND + 0.208,
          )
      # Published whip lights; locations/size are explicit local display fits,
      # confined to this inaccessible preserved ensemble.
      for d in (8, 27, 46):
        p = a + v * d + n * 2.1
        add_box(
          "preserved-whip-light-pole",
          p[0],
          GROUND + 3.3,
          p[1],
          0.12,
          6.6,
          0.12,
          0,
          0x687269,
        )
        q = p + n * 1.5
        line_box("preserved-whip-light-arm", p, q, 0.12, 0.12, 0x687269, y=GROUND + 6.4)
        add_box(
          "preserved-whip-light-head",
          q[0],
          GROUND + 6.38,
          q[1],
          0.55,
          0.19,
          0.31,
          0,
          0xDFDED0,
        )
  sheet(
    "enclosed-preserved-sand",
    [[[x, GROUND + 0.12, z] for x, z in list(enclosure.exterior.coords)[:-1]]],
    0xCCC4AA,
  )

  # Complete official museum envelopes supersede exactly two older OSM fallback
  # prisms. Every roof plane and part is retained in the evidence and drawn mesh.
  buildings = []
  for part in parts:
    role = part["role"]
    color = (
      RUST
      if role == "visitor-center"
      else (STEEL if role == "viewing-tower" else 0x858983)
    )
    for s in part["surfaces"]:
      if s["kind"] == "GroundSurface":
        for r in s["rings"][:1]:
          p = Polygon([(x, z) for x, _, z in r])
          if p.area > 0.1:
            buildings.append(
              {
                "sourceId": part["id"],
                "ring": list(p.exterior.coords)[:-1],
                "holes": [],
                "groundY": part["groundY"],
                "topY": part["topY"],
              }
            )
        continue
      sheet(
        f"official-{role}-{s['kind']}",
        s["rings"],
        color if s["kind"] == "WallSurface" else 0x606963,
        s["sourcePolygonId"],
      )
    # Museum facade subdivision is confined to surveyed exterior wall rectangles;
    # source identity, roof silhouette and courtyard are never inferred from bays.
    footprint = unary_union(
      [
        Polygon([(x, z) for x, _, z in s["rings"][0]])
        for s in part["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
    )
    if footprint.is_empty:
      continue
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      ring = s["rings"][0]
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      p, q = np.array([a[0], a[2]]), np.array([b[0], b[2]])
      length = np.linalg.norm(q - p)
      if length < 4:
        continue
      v = (q - p) / length
      n = np.array([-v[1], v[0]])
      mid = (p + q) / 2
      if footprint.covers(Point(mid + n * 0.12)):
        n *= -1
      y0, y1 = min(p[1] for p in ring), max(p[1] for p in ring)
      angle = -math.atan2(v[1], v[0])
      if role == "viewing-tower":
        # The architect describes stainless mesh around the stair. Narrow
        # geometry bands convey mesh without photograph or alpha texture.
        for y in np.arange(y0 + 0.35, y1 - 0.2, 0.55):
          c = mid + n * 0.055
          add_box(
            "viewing-tower-steel-mesh",
            c[0],
            y,
            c[1],
            length - 0.16,
            0.042,
            0.045,
            angle,
            0x626D6B,
            native_step=1,
          )
        continue
      levels = np.arange(y0 + 1.8, y1 - 0.6, 3.0)
      for y in levels:
        for d in np.arange(1.35, length - 1, 2.5):
          c = p + v * d + n * 0.07
          add_box(
            "museum-window-field",
            c[0],
            y,
            c[1],
            1.55,
            min(1.75, y1 - y - 0.2),
            0.06,
            angle,
            GLASS,
          )
          add_box(
            "museum-window-mullion",
            c[0] + n[0] * 0.035,
            y,
            c[1] + n[1] * 0.035,
            0.065,
            min(1.75, y1 - y - 0.2),
            0.06,
            angle,
            STEEL,
          )

  # Existing full LoD2 BT9 and chapel retain sole ownership of their envelopes.
  # Add only recognizable facade members on their measured outside surfaces.
  alt = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5821-00.json.gz"
      ).read_bytes()
    )
  )
  anchors = {
    b["id"]: b
    for b in alt["buildings"]
    if b["id"] in {"DEBE01YYK0001yOL", "DEBE01YYK000003x"}
  }
  tower = anchors["DEBE01YYK0001yOL"]
  for p in tower["parts"]:
    for s in p["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      r = s["rings"][0]
      y0, y1 = min(v[1] for v in r), max(v[1] for v in r)
      if y1 < p["topY"] - 0.2:
        continue
      a, b = max(
        ((a, b) for a in r for b in r),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      v = np.array([b[0] - a[0], b[2] - a[2]])
      length = np.linalg.norm(v)
      if length < 0.6:
        continue
      v /= length
      mid = np.array([(a[0] + b[0]) / 2, (a[2] + b[2]) / 2])
      centre = geoms["158945354"].centroid
      n = mid - np.array([centre.x, centre.y])
      n /= np.linalg.norm(n)
      mid += n * 0.07
      add_box(
        "BT9-observation-glazing",
        mid[0],
        y1 - 0.88,
        mid[1],
        max(length - 0.25, 0.2),
        1.12,
        0.09,
        -math.atan2(v[1], v[0]),
        GLASS,
      )
  chapel = anchors["DEBE01YYK000003x"]
  cp = chapel["parts"][0]
  poly = Polygon(cp["footprintPolygons"][0]["ring"])
  outline = poly.buffer(0.11).exterior
  for d in np.arange(0, outline.length, 0.32):
    p = outline.interpolate(d)
    add_box(
      "chapel-timber-lamella",
      p.x,
      cp["groundY"] + 3.8,
      p.y,
      0.085,
      7.6,
      0.085,
      0,
      0x997B50,
    )

  # Schematic niche structure at the mapped Window of Remembrance anchor; no
  # victim portrait, copyrighted inscription or asserted exact niche count.
  p = geoms["746066862"]
  angle = math.atan2(0.81, 0.59)
  add_box(
    "window-of-remembrance",
    p.x,
    GROUND + 1.8,
    p.y,
    12,
    3.6,
    0.25,
    angle,
    RUST,
    collision=True,
  )
  for i in range(24):
    for j in range(3):
      u = -5.7 + i * 0.49
      add_box(
        "schematic-empty-remembrance-niche",
        p.x + math.cos(angle) * u + math.sin(angle) * 0.15,
        GROUND + 0.55 + j * 1.0,
        p.y - math.sin(angle) * u + math.cos(angle) * 0.15,
        0.30,
        0.56,
        0.04,
        angle,
        0x333F3D,
      )

  # Merge adjacent native surface cells along x. No solid interiors, rotated
  # boxes, source triangles, or smooth cylinders are shipped in this mode.
  groups: dict[tuple[int, int, int], list[int]] = {}
  for (x, y, z), color in native_cells.items():
    groups.setdefault((y, z, color), []).append(x)
  for (y, z, color), xs in sorted(groups.items()):
    xs.sort()
    first = prev = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x != prev + 1:
        native.append(
          [
            (first + prev + 1) * 0.375,
            (y + 0.5) * 0.75,
            (z + 0.5) * 0.75,
            (prev - first + 1) * 0.75,
            0.75,
            0.75,
            color,
          ]
        )
        first = x
      prev = x
  legacy = [
    b
    for b in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
    if b["id"] in {"45664094", "53333454"}
  ]
  navigation = {
    "groundY": GROUND,
    "legacyPrisms": legacy,
    "buildings": buildings,
    "solids": [
      s
      for s in solids
      if s["role"] not in {"current-steel-markers", "signal-fence-remnant"}
    ],
    "posts": [
      [
        (s["ring"][0][0] + s["ring"][2][0]) / 2,
        (s["ring"][0][1] + s["ring"][2][1]) / 2,
        0.065 if s["role"] == "signal-fence-remnant" else 0.0425,
        s["y1"],
      ]
      for s in solids
      if s["role"] in {"current-steel-markers", "signal-fence-remnant"}
    ],
    "roofTriangles": [
      t
      for p in parts
      for s in p["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in triangles_for(s["rings"])
    ],
    "inaccessibleEnclosure": list(enclosure.exterior.coords)[:-1],
    "publicCrossingPoints": [
      [1263.828601, -1733.620818],
      [1283.372812, -1719.397487],
      [1296.428623, -1710.281938],
    ],
    "retainedParents": list(anchors),
    "genericArtworkSuppressionKeys": ["node/746066862"],
  }
  evidence = {
    "schemaVersion": 1,
    "state": "present-day memorial, preserved and reconstructed national monument distinguished from open public landscape",
    "retrieved": "2026-10-02",
    "osmTimestamp": "2026-09-29T20:22:51Z",
    "osmLicense": "ODbL-1.0",
    "lod2License": "dl-de/zero-2-0",
    "lod2SourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5821.zip",
    "lod2Sha256": hashlib.sha256(
      (RAW / "lod2/LoD2_390_5821.zip").read_bytes()
    ).hexdigest(),
    "osmFeatures": features,
    "officialParts": parts,
    "officialPublicSources": SOURCES,
    "preservedExistingParents": list(anchors),
    "replacedFallbackPrisms": legacy,
    "sourceConflicts": [
      "LDA calls the preserved section 64 m; Foundation calls the enclosing monument 70 m. Exact OSM geometry is retained, never stretched to either published round figure.",
      "OSM tower height is 10 m; authoritative retained LoD2 BT9 height is 9.278 m. Existing complete LoD2 envelope remains unchanged.",
      "OSM chapel height is 8 m; retained LoD2 is 9.907 m. Added 7.6 m timber lamellae are a display fit and do not replace its measured roof.",
      "Two original museum OSM fallback prisms estimate 12/9 m; complete 18-part official museum/view-tower/visitor source supersedes only those two envelopes.",
      "Signal fence is tagged ruins=yes; only post remnants are shown, not a new intact electric fence.",
    ],
    "displayEstimates": "wall thickness, panel joints, coping radius, marker spacing, facade windows, timber lamellae, mesh subdivisions, three whip-light display positions, patrol slab widths, and remembrance niche grid; no survey claim",
    "copyrightPolicy": "factual text only; no photograph, protected landscape plan, text inscription or portrait is traced, bundled or loaded",
    "roles": dict(roles),
    "counts": {
      "officialParts": len(parts),
      "boxes": len(boxes),
      "caps": len(caps),
      "surfaceTriangles": sum(len(s["triangles"]) for s in sheets),
      "nativeBlocks": len(native),
      "collisionSolids": len(solids),
    },
  }
  return (
    rounded({"boxes": boxes, "caps": caps, "surfaces": sheets}),
    rounded({"rows": native}),
    rounded(navigation),
    rounded(evidence),
  )


def main() -> None:
  """Write deterministic, representation-specific lazy runtime packets."""
  drawn, native, navigation, evidence = build()
  runtime = {**drawn, "nativeRows": native["rows"], "counts": evidence["counts"]}
  data = json.dumps(runtime, separators=(",", ":")).encode()
  DEST.write_bytes(data + b"\n")
  evidence["runtimeBytes"] = {
    "decoded": len(data),
    "gzipEquivalent": len(gzip.compress(data, mtime=0)),
  }
  NAV.write_text(json.dumps(navigation, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
  print(
    json.dumps(
      {"counts": evidence["counts"], "runtimeBytes": evidence["runtimeBytes"]}, indent=2
    )
  )


if __name__ == "__main__":
  main()
