"""Step 10: finite mapped Kreuzberg lower fronts, preserving every old mesh."""

from __future__ import annotations

import base64
import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape

from scripts import build_district_facades_v188 as base
from scripts import build_scheunen_v265 as fittings
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "kreuzberg-streets-v267-context.json.gz"
EVIDENCE = GEO / "kreuzberg-streets-v267-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/kreuzbergStreetsV267.json"
STREETS = {"Wiener Straße", "Görlitzer Straße", "Oranienstraße"}
EXCLUDED_OWNER = "DEBE02YY40000Avj"
MAX_BOXES = 650
POLICY = (
  "Mapped commercial-use points bind only to ordinary retained street walls. "
  "Lower glazing, frames, blank fascia, colour and dimensions are estimates, "
  "not surveyed openings or tenant/material claims. No source shell, original "
  "window, v185 plinth/cornice, v233 door, roof or navigation is replaced. "
  "Outdoor table-tennis locations and public cycle stands retain exact OSM "
  "points. Stand count follows recorded bicycle capacity; member sizes, "
  "unsurveyed bearings and finishes are estimates. Every equipment footprint "
  "is supported by delivered horizontal triangles in both modes. Native "
  "fittings follow independently delivered cardinal walls or cardinal ground "
  "interpretations. No root, descriptor, coverage or live budget changes."
)
INPUTS = [
  GEO / "kreuzberg-streets-v267-references.json",
  base.EVIDENCE,
  base.CONTEXT,
  GEO / "house-doors-v233-context.json.gz",
  GEO / "house-doors-v233-evidence.json.gz",
  GEO / "roof-house-v233-source.json.gz",
  GEO / "outer-roofs-v262-source.json.gz",
  GEO / "south-kiez-v185-source.json",
  ROOT / "src/app/src/data/southKiezV185.json",
  ROOT / "src/app/src/data/southKiezV185Native.json",
  GEO / "oranien-corridors-v167.json",
  ROOT / "src/app/src/data/playgroundsV255.json",
]


def extract() -> None:
  """Freeze bounded source points without tenant names or personal identities."""
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  frame = pyogrio.read_dataframe(
    pbf, layer="points", bbox=(13.398, 52.490, 13.464, 52.507)
  ).to_crs(25833)
  park = base.read_json(GEO / "south-kiez-v185-source.json")["park"]
  park_poly = shape(park["geometry"])
  roads = [
    r
    for r in base.read_json(GEO / "oranien-corridors-v167.json")["roads"]
    if r.get("name") == "Oranienstraße"
  ]
  points, equipment = [], []
  for row in frame.itertuples():
    tags = dict(
      re.findall(
        r'"([^"]+)"=>"([^"]*)"',
        row.other_tags if isinstance(row.other_tags, str) else "",
      )
    )
    point = base.world(row.geometry)
    p = [point.x, point.y]
    if (
      tags.get("sport") == "table_tennis"
      and tags.get("indoor") != "yes"
      and tags.get("covered") != "yes"
      and tags.get("access") not in {"private", "no"}
      and park_poly.buffer(-2).covers(point)
    ):
      direction = tags.get("direction", "")
      equipment.append(
        dict(
          id="node/" + str(row.osm_id),
          point=p,
          type="table-tennis",
          direction=float(direction) if direction.isdigit() else 0,
          directionSource="mapped" if direction.isdigit() else "estimated-cardinal",
          tags={
            k: v
            for k, v in tags.items()
            if k
            in {
              "sport",
              "leisure",
              "direction",
              "pitch:net",
              "covered",
              "fee",
              "check_date",
            }
          },
        )
      )
    if (
      tags.get("amenity") == "bicycle_parking"
      and tags.get("bicycle_parking") == "stands"
      and tags.get("access") in {"yes", "permissive"}
      and tags.get("position") == "sidewalk"
      and tags.get("capacity", "").isdigit()
      and 2 <= int(tags["capacity"]) <= 12
    ):
      road = min(roads, key=lambda r: shape(r["geometry"]).distance(point))
      line = shape(road["geometry"])
      distance = line.distance(point)
      if distance < 15:
        u = line.project(point)
        a, b = (
          line.interpolate(max(0, u - 1)),
          line.interpolate(min(line.length, u + 1)),
        )
        angle = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        equipment.append(
          dict(
            id="node/" + str(row.osm_id),
            point=p,
            type="cycle-stands",
            count=int(tags["capacity"]) // 2,
            direction=angle,
            directionSource="estimated-perpendicular-to-retained-road",
            road=road["id"],
            roadDistance=distance,
            tags={
              k: v
              for k, v in tags.items()
              if k
              in {
                "amenity",
                "bicycle_parking",
                "access",
                "capacity",
                "position",
                "covered",
                "check_date:capacity",
              }
            },
          )
        )
    if tags.get("addr:street") not in STREETS or tags.get("level", "0") not in {
      "0",
      "ground",
    }:
      continue
    use = tags.get("shop")
    if not use or use in {"no", "vacant"}:
      use = tags.get("amenity")
      if use not in {"cafe", "restaurant", "bar", "pub", "fast_food", "ice_cream"}:
        continue
    points.append(
      dict(id="node/" + str(row.osm_id), street=tags["addr:street"], use=use, point=p)
    )
  base.write_json(
    CONTEXT,
    dict(
      schemaVersion=1,
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      sourceSha256=base.digest(pbf),
      license="ODbL-1.0",
      points=points,
      park=park,
      equipment=equipment,
    ),
  )


def face_frame(face: dict) -> dict:
  """Reconstruct the exact retained outward-facing original facade frame."""
  d = np.array(face["b"]) - face["a"]
  d /= np.linalg.norm(d)
  return {**face, "d": d.tolist(), "n": face["normal"]}


def pane_bottom(face: dict, native: bool = False) -> float:
  """Exact lower bound of the retained v188 ground-floor pane row."""
  height = face["high"] - face["low"]
  rows = max(1, int((height - 1.5) / (4 if native else 3.6)))
  return face["low"] + 1.5 + 0.5 * (height - 2.4) / rows - (0.7 if native else 0.9)


def native_shop(point: list, face: dict, planes: list) -> dict | None:
  """Fit a compact shop window on an actual independent orthogonal wall."""
  choices = []
  for plane in planes:
    dim, across = (0, 1) if plane["axis"] == 0 else (1, 0)
    if abs(face["n"][dim]) < 0.65 or abs(point[dim] - plane["plane"]) > 1.65:
      continue
    p = list(point)
    p[dim] = plane["plane"]
    n = [0.0, 0.0]
    n[dim] = 1.0 if face["n"][dim] > 0 else -1.0
    d = [0.0, 0.0]
    d[across] = 1.0
    lo, hi = face["low"] + 1.04, min(face["low"] + 2.65, pane_bottom(face, True) - 0.35)
    if hi - lo < 1:
      continue
    section = plane["polygon"].intersection(
      LineString(
        [
          [point[across] - 3, (lo + hi) / 2],
          [point[across] + 3, (lo + hi) / 2],
        ]
      )
    )
    segments = list(section.geoms) if hasattr(section, "geoms") else [section]
    spans = []
    for segment in segments:
      if segment.is_empty or segment.bounds[2] - segment.bounds[0] < 1.74:
        continue
      u = max(segment.bounds[0] + 0.87, min(segment.bounds[2] - 0.87, point[across]))
      if abs(u - point[across]) <= 1.0 and plane["polygon"].buffer(0.012).covers(
        box(u - 0.86, lo - 0.08, u + 0.86, hi + 0.21)
      ):
        spans.append(u)
    if not spans:
      continue
    p[across] = min(spans, key=lambda u: abs(u - point[across]))
    choices.append(
      (
        math.dist(point, p),
        dict(
          point=p,
          d=d,
          n=n,
          low=face["low"],
          bottom=lo,
          top=hi,
          width=1.55,
          axis=plane["axis"],
          plane=plane["plane"],
          sourceProjectionDistance=math.dist(point, p),
        ),
      )
    )
  return min(choices, key=lambda v: v[0])[1] if choices else None


def shop_boxes(rows: list, origin: list, face: dict, native: bool) -> None:
  """Use a shallow blank shopfront below existing panes, with explicit estimates."""
  p = face["point"]
  lo, hi, w = face["bottom"], face["top"], face["width"]
  h = hi - lo

  def add(
    u: float,
    y: float,
    width: float,
    height: float,
    depth: float,
    out: float,
    colour: int,
  ) -> None:
    fittings.append_box(rows, origin, face, p, u, y, width, height, depth, out, colour)

  add(0, (lo + hi) / 2, w, h, 0.04, 0.16, 0x819FA2)
  # Slightly warmer lower glazing and narrow frames supply depth without signs.
  add(0, lo + h * 0.22, w - 0.14, h * 0.34, 0.025, 0.19, 0x9DB0AA)
  for u in [-w / 2, w / 2]:
    add(u, (lo + hi) / 2, 0.09, h + 0.14, 0.10, 0.20, 0x515B58)
  add(0, (lo + hi) / 2, 0.065, h, 0.08, 0.22, 0x59635E)
  add(0, lo - 0.025, w + 0.14, 0.10, 0.16, 0.21, 0xA49E8B)
  add(0, hi + 0.025, w + 0.14, 0.10, 0.12, 0.21, 0x6A7066)
  add(0, hi + 0.145, w + 0.14, 0.13, 0.10, 0.20, 0xC5B59A)
  if not native:
    add(-w * 0.22, lo + h * 0.75, w * 0.28, 0.035, 0.025, 0.215, 0xBECAC3)
    add(w * 0.22, lo + h * 0.75, w * 0.28, 0.035, 0.025, 0.215, 0xBECAC3)


def equipment_frame(item: dict, native: bool) -> dict:
  angle = math.radians(item["direction"])
  n = [math.sin(angle), -math.cos(angle)]
  if native:
    dim = int(abs(n[1]) > abs(n[0]))
    n = [
      math.copysign(1, n[0]) if dim == 0 else 0,
      math.copysign(1, n[1]) if dim == 1 else 0,
    ]
  return dict(n=n, d=[-n[1], n[0]])


def footprint(item: dict, native: bool) -> Polygon:
  f = equipment_frame(item, native)
  p, d, n = np.array(item["point"]), np.array(f["d"]), np.array(f["n"])
  w, depth = (
    (2.80, 1.61)
    if item["type"] == "table-tennis"
    else ((item["count"] - 1) * 1.3 + 0.12, 1.05)
  )
  return Polygon(
    [
      p + d * u * w / 2 + n * v * depth / 2
      for u, v in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
  )


def ground_support(poly: Polygon, triangles: np.ndarray) -> float | None:
  from shapely.ops import unary_union

  a, b, c, d = poly.bounds
  selected = triangles[
    (np.ptp(triangles[:, :, 1], axis=1) < 0.015)
    & (triangles[:, :, 1].min(axis=1) >= 2.99)
    & (triangles[:, :, 1].max(axis=1) < 3.4)
    & (triangles[:, :, 0].max(axis=1) >= a)
    & (triangles[:, :, 0].min(axis=1) <= c)
    & (triangles[:, :, 2].max(axis=1) >= b)
    & (triangles[:, :, 2].min(axis=1) <= d)
  ]
  levels = sorted({round(float(t[0, 1]), 2) for t in selected}, reverse=True)
  for level in levels:
    surface = unary_union(
      [Polygon(t[:, [0, 2]]) for t in selected if abs(t[0, 1] - level) < 0.015]
    )
    if surface.buffer(0.002).covers(poly):
      return level
  return None


def equipment_boxes(
  rows: list, origin: list, item: dict, native: bool, ground: float
) -> None:
  f = equipment_frame(item, native)

  def add(u, y, w, h, depth, out, colour):
    fittings.append_box(
      rows, origin, f, item["point"], u, ground + y, w, h, depth, out, colour
    )

  if item["type"] == "cycle-stands":
    for i in range(item["count"]):
      u = (i - (item["count"] - 1) / 2) * 1.3
      for out in [-0.48, 0.48]:
        add(u, 0.40, 0.055, 0.80, 0.055, out, 0x858D88)
      add(u, 0.80, 0.055, 0.055, 1.015, 0, 0x949B94)
      add(u, 0.43, 0.055, 0.055, 0.96, 0, 0x858D88)
  else:
    for u in [-0.88, 0.88]:
      add(u, 0.345, 0.30, 0.69, 1.16, 0, 0xB2B0A2)
    add(0, 0.72, 2.74, 0.12, 1.525, 0, 0x748E8C)
    # Concrete slab, thin playing-field edges and simple net are estimates.
    for out in [-0.745, 0.745]:
      add(0, 0.785, 2.70, 0.014, 0.022, out, 0xD8DDD1)
    for u in [-1.35, 1.35]:
      add(u, 0.785, 0.022, 0.014, 1.49, 0, 0xD8DDD1)
    add(0, 0.85, 0.035, 0.15, 1.56, 0, 0xA6AEA3)
    add(0, 0.785, 2.69, 0.014, 0.018, 0, 0xD8DDD1)


def build() -> dict:
  """Append finite recipes after proving source walls and previous fitting gaps."""
  if not CONTEXT.exists():
    extract()
  context = base.read_json(CONTEXT)
  # These existing v188 walls have an audited ordinary-owner and street-facing
  # contract. Bounded ranges exclude long unrelated portions of named streets.
  faces = [
    face_frame(f)
    for f in base.read_json(base.EVIDENCE)["faces"]
    if f["streetName"] in STREETS and f["owner"] != EXCLUDED_OWNER
  ]
  protected = fittings.protected()
  faces = [f for f in faces if f["owner"] not in protected]
  old = base.read_json(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  old_nodes = {r["node"] for r in old}
  entrances = base.read_json(GEO / "house-doors-v233-context.json.gz")["entrances"]
  manifest = base.read_json(OUT / "manifest.json")
  descs = {d["id"]: d for d in manifest["chunks"]}
  by_tile = defaultdict(list)
  for f in faces:
    by_tile[f["chunk"]].append(f)
  for item in context["equipment"]:
    tile = f"{math.floor(item['point'][0] / 512)}_{math.floor(item['point'][1] / 512)}"
    if tile in descs:
      by_tile.setdefault(tile, [])
  recipes, assets, shops, doors, counts = {}, {}, [], [], Counter()
  equipment = []
  for tile, local_faces in sorted(by_tile.items()):
    desc = descs[tile]
    packets = {
      mode: base.read_json(OUT / desc[mode]["url"]) for mode in ["drawn", "minecraft"]
    }
    if any(len(p["meshes"]) >= 16 for p in packets.values()):
      continue
    extras = {mode: [] for mode in packets}
    for cd in manifest["chunks"]:
      if cd.get("detailCompanionOf") == tile:
        for mode in packets:
          extras[mode].append(base.read_json(OUT / cd[mode]["url"]))
          assets[cd[mode]["url"]] = base.digest(OUT / cd[mode]["url"])
    planes = fittings.native_planes(packets["minecraft"], extras["minecraft"])
    source_tris = fittings.drawn_triangles(packets["drawn"], [])
    ox, oy, oz = packets["drawn"]["origin"]
    owners = {}
    native_owners = {}
    nox, _, noz = packets["minecraft"]["origin"]
    for owner in packets["minecraft"]["nav"]["buildings"]:
      native_owners.setdefault(owner["sourceId"], []).append(
        translate(Polygon(owner["ring"], owner["holes"]), nox, noz)
      )
    for owner in packets["drawn"]["nav"]["buildings"]:
      owners.setdefault(owner["sourceId"], []).append(
        translate(Polygon(owner["ring"], owner["holes"]), ox, oz)
      )
    plans = {
      mode: dict(
        origin=p["origin"],
        guard=nav_fingerprint(p["nav"]),
        records=[
          dict(
            mesh=i,
            kind=m["kind"],
            fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
          )
          for i, m in enumerate(p["meshes"])
        ],
        boxes=[],
      )
      for mode, p in packets.items()
    }
    local_shops = []
    local_doors = []
    used_points = []
    for face in sorted(local_faces, key=lambda f: (f["streetName"], f["owner"])):
      edge = LineString([face["a"], face["b"]])
      width = edge.length
      d = np.array(face["d"])
      for entrance in entrances:
        if entrance["id"] in old_nodes or any(
          e["node"] == entrance["id"] for e in doors + local_doors
        ):
          continue
        pt = Point(entrance["point"])
        distance = edge.distance(pt)
        u = edge.project(pt)
        if distance > 0.35 or not 0.85 < u < width - 0.85:
          continue
        p = (np.array(face["a"]) + d * u).tolist()
        if not fittings.drawn_door_exists(face, p, source_tris):
          continue
        nf = fittings.native_face(entrance["point"], face, planes)
        if nf is None:
          continue
        # v188's upper panes are retained; this door ends below the lowest pane.
        # The full source door frame needs 2.65m, so skip collisions explicitly.
        if pane_bottom(face) < face["low"] + 2.73:
          continue
        for mode, f, point in [("drawn", face, p), ("minecraft", nf, nf["point"])]:
          fittings.door_boxes(
            plans[mode]["boxes"], packets[mode]["origin"], f, point, mode == "minecraft"
          )
        local_doors.append(
          dict(
            node=entrance["id"],
            mappedPoint=entrance["point"],
            point=p,
            distance=distance,
            face=face,
            native=nf,
            chunk=tile,
          )
        )
      for poi in context["points"]:
        if poi["street"] != face["streetName"] or not any(
          poly.buffer(0.1).covers(Point(poi["point"]))
          for poly in owners.get(face["owner"], [])
        ):
          continue
        pt = Point(poi["point"])
        u = edge.project(pt)
        if edge.distance(pt) > 18 or not 1.8 < u < width - 1.8:
          continue
        p = (np.array(face["a"]) + d * u).tolist()
        # Preserve every mapped entrance and already generated shop fitting.
        near = (
          [r["point"] for r in old if r["chunk"] == tile]
          + [r["point"] for r in local_doors]
          + [r["point"] for r in entrances if math.dist(r["point"], p) < 8]
        )
        if any(math.dist(p, q) < 3.1 for q in near + used_points):
          counts["nearEntranceOrShop"] += 1
          continue
        lo, hi = face["low"] + 1.04, min(face["low"] + 2.65, pane_bottom(face) - 0.35)
        if hi - lo < 1:
          continue
        sf = {**face, "point": p, "bottom": lo, "top": hi, "width": 2.8}
        # Full wall triangles must cover the new lower rectangle, never a seam.
        if not fittings.drawn_door_exists(face, p, source_tris):
          continue
        from shapely.ops import unary_union

        offsets = source_tris[:, :, [0, 2]] - np.array(p)
        distances, along = offsets @ np.array(face["n"]), offsets @ d
        selected = np.where(np.max(np.abs(distances), axis=1) <= 0.012)[0]
        wall = unary_union(
          [Polygon(np.column_stack([along[i], source_tris[i, :, 1]])) for i in selected]
        )
        if not wall.buffer(0.012).covers(box(-1.48, lo - 0.08, 1.48, hi + 0.21)):
          continue
        nf = native_shop(p, face, planes)
        if nf is None:
          counts["noNativePlane"] += 1
          continue
        npnt = Point(nf["point"])
        exterior = Point(np.array(nf["point"]) + np.array(nf["n"]) * 0.3)
        if not any(
          poly.boundary.distance(npnt) < 0.02 and not poly.covers(exterior)
          for poly in native_owners.get(face["owner"], [])
        ):
          counts["noSameNativeOwner"] += 1
          continue
        native_entries = [
          r["native"]["point"] for r in old if r["chunk"] == tile and r.get("native")
        ]
        if any(math.dist(nf["point"], q) < 2.1 for q in near + native_entries):
          continue
        shop_ground = {}
        for mode, f in [("drawn", sf), ("minecraft", nf)]:
          pt = np.array(f["point"])
          normal = np.array(f["n"])
          direction = np.array(f["d"])
          support = Polygon(
            [
              pt + direction * u + normal * v
              for u, v in [
                (-f["width"] / 2, 0.24),
                (f["width"] / 2, 0.24),
                (f["width"] / 2, 0.34),
                (-f["width"] / 2, 0.34),
              ]
            ]
          )
          tris = (
            source_tris
            if mode == "drawn"
            else fittings.drawn_triangles(packets[mode], [])
          )
          shop_ground[mode] = ground_support(support, tris)
        if any(y is None or abs(y - face["low"]) > 0.15 for y in shop_ground.values()):
          counts["shopMissingGround"] += 1
          continue
        for mode, f in [("drawn", sf), ("minecraft", nf)]:
          shop_boxes(
            plans[mode]["boxes"], packets[mode]["origin"], f, mode == "minecraft"
          )
        local_shops.append(
          dict(
            node=poi["id"],
            ground=shop_ground,
            use=poi["use"],
            mappedPoint=poi["point"],
            chunk=tile,
            face=sf,
            native=nf,
          )
        )
        used_points.append(p)
        if sum(r["face"]["owner"] == face["owner"] for r in local_shops) >= 2:
          break
    local_equipment = []
    native_tris = fittings.drawn_triangles(packets["minecraft"], [])
    for item in context["equipment"]:
      if any(r["id"] == item["id"] for r in equipment):
        continue
      # Items stay in their original 512m source packet; no duplicate delivery.
      if (
        tile
        != f"{math.floor(item['point'][0] / 512)}_{math.floor(item['point'][1] / 512)}"
      ):
        continue
      polys = {mode: footprint(item, mode == "minecraft") for mode in packets}
      ground = {
        mode: ground_support(polys[mode], tris)
        for mode, tris in [("drawn", source_tris), ("minecraft", native_tris)]
      }
      if any(y is None for y in ground.values()):
        counts["equipmentMissingGround"] += 1
        continue
      blocked = False
      for mode, packet in packets.items():
        xx, _, zz = packet["origin"]
        for owner in packet["nav"]["buildings"]:
          if translate(Polygon(owner["ring"], owner["holes"]), xx, zz).intersects(
            polys[mode]
          ):
            blocked = True
      if blocked:
        counts["equipmentBuildingOverlap"] += 1
        continue
      for mode, p in packets.items():
        equipment_boxes(
          plans[mode]["boxes"], p["origin"], item, mode == "minecraft", ground[mode]
        )
      local_equipment.append(dict(**item, chunk=tile, ground=ground))
    if not local_shops and not local_doors and not local_equipment:
      continue
    for mode, p in packets.items():
      plan = plans[mode]
      rows = plan["boxes"]
      if len(rows) > MAX_BOXES:
        raise ValueError(f"capacity {tile}/{mode}: {len(rows)}")
      if (
        sum(len(base64.b64decode(m["positions"])) // 6 for m in p["meshes"])
        + len(rows) * 24
        > 400_000
      ):
        raise ValueError("vertices")
      if (
        sum(len(base64.b64decode(m["indices"])) // 4 for m in p["meshes"])
        + len(rows) * 36
        > 2_400_000
      ):
        raise ValueError("indices")
      if any(not all(0 < v < 655.35 for v in r[:3]) for r in rows):
        raise ValueError("coordinates")
      assets[desc[mode]["url"]] = base.digest(OUT / desc[mode]["url"])
    recipes[tile] = plans
    shops.extend(local_shops)
    doors.extend(local_doors)
    equipment.extend(local_equipment)
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    inputs={str(p.relative_to(ROOT)): base.digest(p) for p in INPUTS + [CONTEXT]},
    assets=assets,
    shops=shops,
    doors=doors,
    equipment=equipment,
    counts=dict(counts),
  )
  base.write_json(EVIDENCE, evidence)
  base.write_json(RUNTIME, dict(schemaVersion=1, keys=sorted(recipes), chunks=recipes))
  return dict(
    shops=len(shops),
    doors=len(doors),
    equipment=len(equipment),
    streets=dict(Counter(r["face"]["streetName"] for r in shops)),
    packets=list(recipes),
    counts=dict(counts),
    drawnBoxes=sum(len(p["drawn"]["boxes"]) for p in recipes.values()),
    nativeBoxes=sum(len(p["minecraft"]["boxes"]) for p in recipes.values()),
    runtimeBytes=RUNTIME.stat().st_size,
  )


if __name__ == "__main__":
  print(json.dumps(build(), indent=2, ensure_ascii=False))
