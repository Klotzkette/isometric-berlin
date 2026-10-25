"""Step 10: district-wide Moabit retained pane jambs and heads and mapped lower fronts."""

from __future__ import annotations

import base64
import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box

from scripts import build_district_facades_v188 as base
from scripts import build_scheunen_v265 as fittings
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "moabit-houses-v269-context.json.gz"
EVIDENCE = GEO / "moabit-houses-v269-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/moabitHousesV269.json"
STREETS = {
  f["streetName"]
  for f in base.read_json(base.EVIDENCE)["faces"]
  if f["district"] == "Moabit"
}
EXCLUDED_OWNERS = {
  "DEBE02YY400000KE",
  "DEBE01YYK00002yj",
  "DEBE01YYK00007Fz",
  "DEBE01YYK00007Vq",
  "DEBE01YYK0000AOd",
  "DEBE01YYK00008nb",
}
MAX_BOXES = 5000
POLICY = (
  "Add only previously absent side jambs and heads around exact retained v188 panes; preserve v209 sills/crossbars on "
  "complete original walls. No new window grid, pane, roof, plinth or paint. "
  "Frame sections, neutral finishes and mapped-use lower shop openings remain "
  "display estimates. Native surrounds use its independent retained cardinal "
  "panes and actual original walls. Every object records delivered ground. "
  "All original source geometry, earlier detail, navigation and lines remain. "
  "No new descriptor, root, live budget, device cut or coverage."
)
INPUTS = [
  GEO / "moabit-houses-v269-references.json",
  base.EVIDENCE,
  base.CONTEXT,
  GEO / "house-doors-v233-context.json.gz",
  GEO / "house-doors-v233-evidence.json.gz",
  GEO / "roof-house-v233-source.json.gz",
  GEO / "outer-roofs-v262-source.json.gz",
  GEO / "kiez-facades-v209-evidence.json.gz",
  GEO / "kiez-facades-v209-context.json.gz",
  GEO / "grey-facades-v263-evidence.json.gz",
  ROOT / "src/app/src/data/outerFacadesV262.json",
  ROOT / "src/app/src/data/districtHouseScopeV225.json",
]


def extract() -> None:
  """Only mapped public commercial uses on this bounded street; omit names."""
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  frame = pyogrio.read_dataframe(
    pbf, layer="points", bbox=(13.315, 52.519, 13.392, 52.551)
  ).to_crs(25833)
  points = []
  for row in frame.itertuples():
    tags = dict(
      re.findall(
        r'"([^"]+)"=>"([^"]*)"',
        row.other_tags if isinstance(row.other_tags, str) else "",
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
    p = base.world(row.geometry)
    points.append(
      dict(
        id="node/" + str(row.osm_id),
        street=tags["addr:street"],
        use=use,
        point=[p.x, p.y],
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


def retained_panes(face: dict, native: bool) -> list[dict]:
  """Exactly replay the frozen v188 layout; no additional glazing or layout."""
  panes = []
  for span_index, span in enumerate(face["nativeSpans"] if native else [face]):
    f = face_frame({**face, **span})
    width = math.dist(f["a"], f["b"])
    rows = max(1, int((f["high"] - f["low"] - 1.5) / (4 if native else 3.6)))
    cols = max(1, int((width - 1.5) / (4 if native else 3.8)))
    for row in range(rows):
      y = f["low"] + 1.5 + (row + 0.5) * (f["high"] - f["low"] - 2.4) / rows
      for col in range(cols):
        if not native and col in f["omittedWindowColumns"]:
          continue
        point = (
          np.array(f["a"]) + np.array(f["d"]) * (col + 0.5) * width / cols
        ).tolist()
        panes.append(
          dict(
            face=f,
            point=point,
            y=y,
            width=1.15 if native else 1.32,
            height=1.4 if native else 1.8,
            depth=0.045 if native else 0.075,
            row=row,
            column=col,
            span=span_index,
          )
        )
  return panes


def planar_union(point: list, frame: dict, triangles: np.ndarray, offset: float = 0):
  from shapely.ops import unary_union

  delta = triangles[:, :, [0, 2]] - np.array(point)
  dist, u = delta @ np.array(frame["n"]), delta @ np.array(frame["d"])
  chosen = np.where(np.max(np.abs(dist - offset), axis=1) < 0.013)[0]
  return unary_union(
    [Polygon(np.column_stack([u[i], triangles[i, :, 1]])) for i in chosen]
  )


def pane_surround(rows: list, origin: list, pane: dict) -> None:
  """Three estimated members preserve v188 glass and the existing v209 sill/crossbar."""
  f, p, y, w, h = pane["face"], pane["point"], pane["y"], pane["width"], pane["height"]
  for u in [-(w / 2 + 0.055), w / 2 + 0.055]:
    fittings.append_box(
      rows, origin, f, p, u, y + 0.03, 0.08, h + 0.02, 0.13, 0.115, 0xB7B4A3
    )
  fittings.append_box(
    rows, origin, f, p, 0, y + h / 2 + 0.065, w + 0.19, 0.09, 0.14, 0.12, 0xC0BCAB
  )


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
    if f["district"] == "Moabit" and f["owner"] not in EXCLUDED_OWNERS
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
  surrounds = []
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
    local_surrounds = []
    mode_tris = {
      "drawn": source_tris,
      "minecraft": fittings.drawn_triangles(packets["minecraft"], []),
    }
    companions = {
      mode: fittings.drawn_triangles(extras[mode][0], extras[mode][1:])
      if extras[mode]
      else np.empty((0, 3, 3))
      for mode in packets
    }
    for face in sorted(local_faces, key=lambda f: f["owner"]):
      for mode in packets:
        native = mode == "minecraft"
        for pane in retained_panes(face, native):
          f, p, y, w, h = (
            pane["face"],
            pane["point"],
            pane["y"],
            pane["width"],
            pane["height"],
          )
          # The actual old source pane must remain exactly at this plane.
          old_glass = planar_union(p, f, companions[mode], pane["depth"])
          if not old_glass.buffer(0.013).covers(
            box(-w / 2, y - h / 2, w / 2, y + h / 2)
          ):
            counts["missingRetainedPane"] += 1
            continue
          wall = planar_union(p, f, mode_tris[mode])
          if not wall.buffer(0.013).covers(
            box(-w / 2 - 0.14, y - h / 2 - 0.14, w / 2 + 0.14, y + h / 2 + 0.12)
          ):
            counts["frameOutsideActualWall"] += 1
            continue
          if y - h / 2 - 0.14 < f["low"] + 2.7 and any(
            math.dist(p, e["point"]) < 2.0 for e in entrances
          ):
            counts["frameNearMappedEntrance"] += 1
            continue
          pt, d, n = np.array(p), np.array(f["d"]), np.array(f["n"])
          strip = Polygon(
            [
              pt + d * u + n * v
              for u, v in [
                (-w / 2 - 0.14, 0.8),
                (w / 2 + 0.14, 0.8),
                (w / 2 + 0.14, 1.0),
                (-w / 2 - 0.14, 1.0),
              ]
            ]
          )
          ground = ground_support(strip, mode_tris[mode])
          if ground is None or abs(ground - f["low"]) > 0.15:
            counts["frameMissingGround"] += 1
            continue
          first = len(plans[mode]["boxes"])
          pane_surround(plans[mode]["boxes"], packets[mode]["origin"], pane)
          local_surrounds.append(
            dict(
              **pane, chunk=tile, mode=mode, ground=ground, firstBox=first, boxCount=3
            )
          )
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
    if not local_shops and not local_doors and not local_surrounds:
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
    surrounds.extend(local_surrounds)
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    inputs={str(p.relative_to(ROOT)): base.digest(p) for p in INPUTS + [CONTEXT]},
    assets=assets,
    shops=shops,
    doors=doors,
    surrounds=surrounds,
    counts=dict(counts),
  )
  base.write_json(EVIDENCE, evidence)
  base.write_json(RUNTIME, dict(schemaVersion=1, keys=sorted(recipes), chunks=recipes))
  return dict(
    shops=len(shops),
    doors=len(doors),
    surrounds=len(surrounds),
    surroundModes=dict(Counter(r["mode"] for r in surrounds)),
    streets=dict(Counter(r["face"]["streetName"] for r in shops)),
    packets=list(recipes),
    counts=dict(counts),
    drawnBoxes=sum(len(p["drawn"]["boxes"]) for p in recipes.values()),
    nativeBoxes=sum(len(p["minecraft"]["boxes"]) for p in recipes.values()),
    runtimeBytes=RUNTIME.stat().st_size,
  )


if __name__ == "__main__":
  print(json.dumps(build(), indent=2, ensure_ascii=False))
