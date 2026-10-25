"""Step 10: finite mapped Friedrichshain lower fronts, preserving every old mesh."""

from __future__ import annotations

import base64
import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape

from scripts import build_district_facades_v188 as base
from scripts import build_scheunen_v265 as fittings
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "friedrichshain-v266-context.json.gz"
EVIDENCE = GEO / "friedrichshain-v266-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/friedrichshainV266.json"
STREETS = {
  "Sonntagstraße",
  "Simplonstraße",
  "Krossener Straße",
  "Grünberger Straße",
  "Gärtnerstraße",
  "Gabriel-Max-Straße",
  "Simon-Dach-Straße",
  "Lenbachstraße",
}
MAX_BOXES = 650
POLICY = (
  "Mapped commercial-use points bind to existing ordinary street-facing "
  "owners. Shop opening position, frame, blank fascia, glazing hue and "
  "small dimensions are explicit display estimates, not surveyed openings "
  "or a current-tenant claim. Real previously missing mapped doors retain "
  "their nodes. All old panes, roof treatments, street/park surfaces and "
  "station structures stay unchanged. Native fittings follow independent "
  "actual orthogonal source walls. Mapped wooden park benches retain their "
  "recorded bearing; seat/member dimensions remain estimates, native bearing "
  "uses an independent cardinal interpretation. No new descriptor, root or live budget."
)
INPUTS = [
  base.EVIDENCE,
  base.CONTEXT,
  GEO / "house-doors-v233-context.json.gz",
  GEO / "house-doors-v233-evidence.json.gz",
  GEO / "roof-house-v233-source.json.gz",
  GEO / "outer-roofs-v262-source.json.gz",
  ROOT / "src/app/src/data/ostkreuzV190.json",
]


def extract() -> None:
  """Freeze only bounded public-use points; omit names and occupant identities."""
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  frame = pyogrio.read_dataframe(
    pbf, layer="points", bbox=(13.447, 52.501, 13.476, 52.517)
  )
  park_frame = pyogrio.read_dataframe(
    pbf, layer="multipolygons", where="name = 'Boxhagener Platz'"
  ).to_crs(25833)
  assert len(park_frame) == 1 and str(park_frame.iloc[0].osm_way_id) == "237788251"
  park = base.world(park_frame.iloc[0].geometry)
  projection = Transformer.from_crs(4326, 25833, always_xy=True)
  points = []
  benches = []
  for row in frame.itertuples():
    tags = dict(
      re.findall(
        r'"([^"]+)"=>"([^"]*)"',
        row.other_tags if isinstance(row.other_tags, str) else "",
      )
    )
    x, y = projection.transform(row.geometry.x, row.geometry.y)
    point = [x - 389500, 5820000 - y]
    if (
      tags.get("amenity") == "bench"
      and tags.get("material") == "wood"
      and tags.get("direction", "").isdigit()
      and park.covers(Point(point))
    ):
      benches.append(
        dict(
          id="node/" + str(row.osm_id),
          point=point,
          direction=int(tags["direction"]),
          backrest=tags.get("backrest") == "yes",
          tags={
            k: tags[k]
            for k in ("amenity", "material", "direction", "backrest")
            if k in tags
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
    x, y = projection.transform(row.geometry.x, row.geometry.y)
    points.append(
      dict(
        id="node/" + str(row.osm_id),
        street=tags["addr:street"],
        use=use,
        point=[x - 389500, 5820000 - y],
        coordinate=[row.geometry.x, row.geometry.y],
      )
    )
  base.write_json(
    CONTEXT,
    dict(
      schemaVersion=1,
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      sourceSha256=base.digest(pbf),
      license="ODbL-1.0",
      points=points,
      park=dict(id="way/237788251", geometry=mapping(park)),
      benches=benches,
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


def bench_frame(bench: dict, native: bool) -> dict:
  """Retain mapped bearing in drawn; independently interpret cardinal native."""
  angle = math.radians(bench["direction"])
  n = [math.sin(angle), -math.cos(angle)]
  if native:
    dim = int(abs(n[1]) > abs(n[0]))
    n = [
      math.copysign(1, n[0]) if dim == 0 else 0,
      math.copysign(1, n[1]) if dim == 1 else 0,
    ]
  return dict(n=n, d=[-n[1], n[0]])


def bench_support(bench: dict, native: bool, triangles: np.ndarray) -> float | None:
  """Require real delivered at-grade triangles under both support feet."""
  f = bench_frame(bench, native)
  p, d = np.array(bench["point"]), np.array(f["d"])
  levels = []
  ground = triangles[
    (np.ptp(triangles[:, :, 1], axis=1) < 0.015)
    & (triangles[:, :, 1].min(axis=1) >= 2.99)
    & (triangles[:, :, 1].max(axis=1) < 3.4)
  ]
  for u in [-0.70, 0.70]:
    pt = p + d * u
    inside = ground[
      (ground[:, :, 0].min(axis=1) <= pt[0])
      & (ground[:, :, 0].max(axis=1) >= pt[0])
      & (ground[:, :, 2].min(axis=1) <= pt[1])
      & (ground[:, :, 2].max(axis=1) >= pt[1])
    ]
    y = [
      float(t[0, 1])
      for t in inside
      if Polygon(t[:, [0, 2]]).buffer(0.001).covers(Point(pt))
    ]
    if not y:
      return None
    levels.append(max(y))
  return max(levels) if max(levels) - min(levels) < 0.05 else None


def bench_boxes(
  rows: list, origin: list, bench: dict, native: bool, ground: float
) -> None:
  """Wood/backrest evidence; 1.8m length and all sections are display estimates."""
  f = bench_frame(bench, native)

  def add(
    u: float, y: float, w: float, h: float, depth: float, out: float, colour: int
  ) -> None:
    fittings.append_box(
      rows, origin, f, bench["point"], u, ground + y, w, h, depth, out, colour
    )

  for u in [-0.7, 0.7]:
    add(u, 0.22, 0.12, 0.44, 0.46, 0, 0x636860)
  if native:
    add(0, 0.47, 1.8, 0.12, 0.52, 0, 0xA39576)
    if bench["backrest"]:
      add(0, 0.80, 1.8, 0.35, 0.12, -0.23, 0xA39576)
  else:
    for out in [-0.20, -0.065, 0.07, 0.205]:
      add(0, 0.47, 1.8, 0.08, 0.115, out, 0xA79878)
    if bench["backrest"]:
      for u in [-0.7, 0.7]:
        add(u, 0.72, 0.07, 0.60, 0.075, -0.24, 0x636860)
      for y in [0.69, 0.83, 0.97]:
        add(0, y, 1.8, 0.105, 0.065, -0.27, 0xA79878)


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
    if f["district"] == "Friedrichshain"
    and f["streetName"] in STREETS
    and 5600 < (f["a"][0] + f["b"][0]) / 2 < 6700
    and 750 < (f["a"][1] + f["b"][1]) / 2 < 2000
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
  recipes, assets, shops, doors, counts = {}, {}, [], [], Counter()
  benches = []
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
        for mode, f in [("drawn", sf), ("minecraft", nf)]:
          shop_boxes(
            plans[mode]["boxes"], packets[mode]["origin"], f, mode == "minecraft"
          )
        local_shops.append(
          dict(
            node=poi["id"],
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
    local_benches = []
    native_tris = fittings.drawn_triangles(packets["minecraft"], [])
    for bench in context.get("benches", []):
      if any(b["id"] == bench["id"] for b in benches):
        continue
      point = Point(bench["point"])
      if not any(
        translate(Polygon(g["ring"], g["holes"]), ox, oz).buffer(-1.1).covers(point)
        for g in packets["drawn"]["nav"]["ground"]
      ):
        continue
      if not shape(context["park"]["geometry"]).buffer(-1.1).covers(point):
        continue
      ground = {
        mode: bench_support(bench, mode == "minecraft", tris)
        for mode, tris in [("drawn", source_tris), ("minecraft", native_tris)]
      }
      if any(y is None for y in ground.values()):
        continue
      for mode, p in packets.items():
        bench_boxes(
          plans[mode]["boxes"], p["origin"], bench, mode == "minecraft", ground[mode]
        )
      local_benches.append(dict(**bench, chunk=tile, ground=ground))
    if not local_shops and not local_doors and not local_benches:
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
    benches.extend(local_benches)
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    inputs={str(p.relative_to(ROOT)): base.digest(p) for p in INPUTS + [CONTEXT]},
    assets=assets,
    shops=shops,
    doors=doors,
    benches=benches,
    counts=dict(counts),
  )
  base.write_json(EVIDENCE, evidence)
  base.write_json(RUNTIME, dict(schemaVersion=1, keys=sorted(recipes), chunks=recipes))
  return dict(
    shops=len(shops),
    doors=len(doors),
    benches=len(benches),
    streets=dict(Counter(r["face"]["streetName"] for r in shops)),
    packets=list(recipes),
    counts=dict(counts),
    drawnBoxes=sum(len(p["drawn"]["boxes"]) for p in recipes.values()),
    nativeBoxes=sum(len(p["minecraft"]["boxes"]) for p in recipes.values()),
    runtimeBytes=RUNTIME.stat().st_size,
  )


if __name__ == "__main__":
  print(json.dumps(build(), indent=2, ensure_ascii=False))
