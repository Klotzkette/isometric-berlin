"""Step 10: retained Mierendorff fronts, fountain and four open station stairs."""

from __future__ import annotations

import base64
import math
import re
import sys
from collections import Counter, defaultdict

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from scripts import build_district_facades_v188 as base
from scripts import build_koepenicker_streets_v268 as fronts
from scripts import build_scheunen_v265 as fittings
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint
from scripts.build_surrounding_outlines import PackedMesh, navigation_polygons

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "mierendorff-v269-context.json.gz"
EVIDENCE = GEO / "mierendorff-v269-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/mierendorffV269.json"
SCOPE = box(-4770, -1060, -4260, -620)
STREETS = {
  "Mierendorffplatz",
  "Mierendorffstraße",
  "Brahestraße",
  "Osnabrücker Straße",
  "Kaiserin-Augusta-Allee",
  "Sömmeringstraße",
}
STAIRS = {
  "way/516635740": "node/496396432",
  "way/516635754": "node/437301322",
  "way/767953643": "node/496396431",
  "way/516635753": "node/437301323",
}
KIND = "mierendorff-v269-structure"


def extract() -> None:
  """Read only the four mapped accesses, exact fountain/park and its benches."""
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  features = []
  selected = set(STAIRS) | set(STAIRS.values()) | {"way/4763943", "way/4763942"}
  for layer in ["points", "lines", "multipolygons"]:
    frame = pyogrio.read_dataframe(
      pbf, layer=layer, bbox=(13.298, 52.523, 13.311, 52.53)
    ).to_crs(25833)
    for row in frame.itertuples():
      other = getattr(row, "other_tags", None)
      tags = dict(
        re.findall(r'"([^\"]+)"=>"([^\"]*)"', other if isinstance(other, str) else "")
      )
      for key in ["name", "highway", "railway", "amenity", "leisure"]:
        value = getattr(row, key, None)
        if isinstance(value, str):
          tags[key] = value
      oid = getattr(row, "osm_id", None)
      wid = getattr(row, "osm_way_id", None)
      identity = oid if isinstance(oid, str) else wid
      if not isinstance(identity, str):
        continue
      prefix = (
        "node/"
        if layer == "points"
        else (
          "relation/" if isinstance(oid, str) and layer == "multipolygons" else "way/"
        )
      )
      identity = prefix + identity
      if identity not in selected and tags.get("amenity") != "bench":
        continue
      features.append(
        dict(id=identity, tags=tags, geometry=mapping(base.world(row.geometry)))
      )
  park = shape(next(f["geometry"] for f in features if f["id"] == "way/4763942"))
  features = [
    f for f in features if f["id"] in selected or park.covers(shape(f["geometry"]))
  ]
  base.write_json(
    CONTEXT,
    dict(
      schema=1,
      source="retained Geofabrik berlin-260929.osm.pbf",
      sha256=base.digest(pbf),
      features=sorted(features, key=lambda f: f["id"]),
    ),
  )


def camera_checks() -> dict:
  """Eye and whole sightline against all real nearby packet building rings."""
  cameras = {
    "wholePlace": dict(eye=[-4490, 75, -980], target=[-4500, 5, -905]),
    "stairsEast": dict(eye=[-4425, 18, -879.36], target=[-4437, 1.4, -879.8]),
    "frontsWest": dict(eye=[-4550, 24, -879], target=[-4575, 16, -891]),
  }
  tiles = ["-9_-2", "-10_-2", "-9_-3", "-10_-3"]
  checks = []
  for mode in ["drawn", "minecraft"]:
    buildings = []
    for tile in tiles:
      packet = base.read_json(OUT / f"{tile}.{mode}.json.gz")
      ox, _, oz = packet["origin"]
      buildings.extend(
        (
          b["sourceId"],
          translate(Polygon(b["ring"], b["holes"]), ox, oz),
          packet["nav"]["groundY"] + b["height"],
        )
        for b in packet["nav"]["buildings"]
      )
    for name, c in cameras.items():
      eye, target = np.array(c["eye"]), np.array(c["target"])
      line = LineString([eye[[0, 2]], target[[0, 2]]])
      blocked = []
      for owner, poly, height in buildings:
        assert not poly.covers(Point(eye[[0, 2]])), (name, owner, "eye inside")
        # A facade view intentionally terminates at its first source wall.
        hit = poly.intersection(line)
        if hit.is_empty:
          continue
        pts = [hit] if hit.geom_type == "Point" else list(getattr(hit, "geoms", [hit]))
        for part in pts:
          coords = list(part.coords)
          for p in coords:
            distance = line.project(Point(p))
            fraction = distance / line.length
            if fraction > 0.97 and name == "frontsWest":
              continue
            y = eye[1] + fraction * (target[1] - eye[1])
            if y < height + 0.4:
              blocked.append(owner)
      assert not blocked, (mode, name, blocked)
      checks.append(dict(mode=mode, name=name, blockers=0))
  return dict(cameras=cameras, neighbourPackets=tiles, checks=checks)


def cardinal(poly: BaseGeometry, step: float = 0.25) -> BaseGeometry:
  """Independent occupied-cell reading, preserving an open interior."""
  a, b, c, d = poly.bounds
  return unary_union(
    [
      box(x, z, x + step, z + step)
      for x in np.arange(math.floor(a / step) * step, c, step)
      for z in np.arange(math.floor(b / step) * step, d, step)
      if poly.covers(Point(x + step / 2, z + step / 2))
    ]
  )


def prism(
  mesh: PackedMesh,
  poly: BaseGeometry,
  low: float,
  high: float,
  colour: tuple,
  edge_colour: tuple | None = None,
) -> None:
  """All perimeter sheets, holes and a top; no hidden solid cube fill."""
  if edge_colour is None:
    mesh.surface(poly, high, colour)
  else:
    # Coplanar 3.5 cm edge accents make each actual tread readable in the
    # unlit drawn material. This is a display convention, not surveyed paint.
    # Mitred offsets keep the independently cardinal native treads orthogonal.
    inset = poly.buffer(-0.035, join_style="mitre")
    mesh.surface(inset, high, colour)
    mesh.surface(poly.difference(inset), high, edge_colour)
  for p in getattr(poly, "geoms", [poly]):
    for ring in [p.exterior, *p.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        q = [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ]
        mesh.triangle(q[:3], edge_colour or colour)
        mesh.triangle([q[0], q[2], q[3]], edge_colour or colour)


def add_box(
  rows: list,
  origin: list,
  point: list,
  y: float,
  width: float,
  height: float,
  depth: float,
  colour: int,
  direction: tuple = (1, 0),
) -> None:
  d = np.array(direction, dtype=float)
  d /= np.linalg.norm(d)
  n = np.array([-d[1], d[0]])
  rows.append(
    [
      round(point[0] - origin[0], 4),
      round(y - origin[1], 4),
      round(point[1] - origin[2], 4),
      *d.tolist(),
      *n.tolist(),
      width,
      height,
      depth,
      colour,
    ]
  )


def decode(mesh: dict, origin: list) -> tuple:
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
    + origin
  )
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p, c, i


def srgb(colour: list) -> tuple:
  c = np.array(colour) / 255
  return tuple(
    np.rint(
      np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255
    ).astype(int)
  )


def run() -> None:
  """Only original packets are inputs; append complete local replacements."""
  context = base.read_json(CONTEXT)
  features = {f["id"]: f for f in context["features"]}
  faces = [
    fronts.face_frame(f)
    for f in base.read_json(base.EVIDENCE)["faces"]
    if f["streetName"] in STREETS and SCOPE.covers(LineString([f["a"], f["b"]]))
  ]
  manifest = base.read_json(OUT / "manifest.json")
  descs = {d["id"]: d for d in manifest["chunks"]}
  by_tile = defaultdict(list)
  for f in faces:
    by_tile[f["chunk"]].append(f)
  by_tile["-9_-2"]
  recipes = {}
  proof = []
  surrounds = []
  ground_receipts = []
  assets = {str(base.EVIDENCE.relative_to(ROOT)): base.digest(base.EVIDENCE)}
  runs = []
  counts = Counter()
  selected_ids = set(STAIRS) | set(STAIRS.values()) | {"way/4763943", "way/4763942"}
  for sid, node in STAIRS.items():
    g = shape(features[sid]["geometry"])
    coords = list(g.coords)
    p = np.array(shape(features[node]["geometry"]).coords[0])
    if np.linalg.norm(np.array(coords[-1]) - p) < np.linalg.norm(
      np.array(coords[0]) - p
    ):
      coords.reverse()
    top, bottom = np.array(coords[0]), np.array(coords[-1])
    d = bottom - top
    length = float(np.linalg.norm(d))
    d /= length
    n = np.array([-d[1], d[0]])
    steps = int(features[sid]["tags"].get("step_count", 24))
    width = 2.5
    landing = 1.1
    descent = steps * 0.16

    def point(u, v):
      return (top + d * u + n * v).tolist()

    aperture = Polygon(
      [
        point(0, -width / 2),
        point(length, -width / 2),
        point(length, width / 2),
        point(0, width / 2),
      ]
    )
    runs.append(
      dict(
        id=sid,
        node=node,
        top=top.tolist(),
        bottom=bottom.tolist(),
        length=length,
        d=d.tolist(),
        n=n.tolist(),
        width=width,
        stepCount=steps,
        descent=descent,
        landing=landing,
        ring=list(aperture.exterior.coords),
      )
    )
  all_apertures = unary_union([Polygon(r["ring"]) for r in runs])
  neighbours = [
    d for d in manifest["chunks"] if box(*d["bounds"]).intersects(all_apertures)
  ]
  assert {d["id"] for d in neighbours} == {"-9_-2", "district188--9_-2"}
  fountain = shape(features["way/4763943"]["geometry"])
  centre = fountain.centroid
  benches = [
    f
    for f in features.values()
    if f["tags"].get("amenity") == "bench"
    and shape(features["way/4763942"]["geometry"]).covers(shape(f["geometry"]))
  ]
  selected_ids.update(f["id"] for f in benches)
  for tile, local in sorted(by_tile.items()):
    for mode in ["drawn", "minecraft"]:
      native = mode == "minecraft"
      path = OUT / descs[tile][mode]["url"]
      packet = base.read_json(path)
      assets[str(path.relative_to(ROOT))] = base.digest(path)
      origin = packet["origin"]
      mesh = PackedMesh(origin[0], origin[2])
      rows = []
      floors = []
      solids = []
      openings = []
      transfers = []
      extras = []
      for cd in manifest["chunks"]:
        if cd.get("detailCompanionOf") == tile:
          cp = OUT / cd[mode]["url"]
          extras.append(base.read_json(cp))
          assets[str(cp.relative_to(ROOT))] = base.digest(cp)
      triangles = fittings.drawn_triangles(packet, [])
      panes_triangles = (
        fittings.drawn_triangles(extras[0], extras[1:])
        if extras
        else np.empty((0, 3, 3))
      )
      for face in sorted(local, key=lambda f: f["owner"]):
        cache = {}
        for pane in fronts.retained_panes(face, native):
          # Keep every existing pane; add a projecting sill and upper reveal only.
          f, p, y, w, h = (
            pane["face"],
            pane["point"],
            pane["y"],
            pane["width"],
            pane["height"],
          )
          key = (tuple(f["a"]), tuple(f["b"]))
          if key not in cache:
            cache[key] = (
              fronts.planar_union(f["a"], f, panes_triangles, pane["depth"]),
              fronts.planar_union(f["a"], f, triangles),
            )
          old, wall = cache[key]
          u = float(np.dot(np.array(p) - f["a"], f["d"]))
          if not old.buffer(0.013).covers(
            box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
          ) or not wall.buffer(0.013).covers(
            box(u - w / 2 - 0.15, y - h / 2 - 0.15, u + w / 2 + 0.15, y + h / 2 + 0.15)
          ):
            continue
          # Upper rows never obscure an existing mapped entrance/shop treatment.
          if y - h / 2 < face["low"] + 3:
            continue
          first = len(rows)
          for yy, ww, hh, dd, out, col in [
            (y - h / 2 - 0.09, w + 0.26, 0.12, 0.30, 0.17, 0xA6A899),
            (y + h / 2 + 0.07, w + 0.16, 0.09, 0.14, 0.12, 0xC4BFAE),
          ]:
            fittings.append_box(rows, origin, f, p, 0, yy, ww, hh, dd, out, col)
          surrounds.append(
            dict(
              chunk=tile,
              mode=mode,
              owner=face["owner"],
              pane=pane,
              firstBox=first,
              boxCount=2,
            )
          )
      if tile == "-9_-2":
        # The mapped complete granite basin: low bowl, open water and one static jet.
        basin = cardinal(fountain, 0.25) if native else fountain
        rim = basin.difference(basin.buffer(-0.38, join_style="mitre"))
        prism(mesh, rim, 3.12, 3.64, (174, 171, 160))
        mesh.surface(basin.buffer(-0.38, join_style="mitre"), 3.32, (102, 145, 154))
        jet = (
          box(centre.x - 0.10, centre.y - 0.10, centre.x + 0.10, centre.y + 0.10)
          if native
          else centre.buffer(0.10, quad_segs=6)
        )
        prism(mesh, jet, 3.32, 5.0, (200, 220, 218))
        for p in navigation_polygons(rim, origin[0], origin[2]):
          solids.append(
            dict(
              **p, minHeight=0.12, height=0.64, sourceId="mierendorff-v269-fountain-rim"
            )
          )
        for bench in benches:
          p = np.array(shape(bench["geometry"]).coords[0])
          direction = (1, 0) if native else np.array([0.964, 0.266])
          first = len(rows)
          add_box(rows, origin, p, 3.55, 1.8, 0.14, 0.52, 0xDFDACC, direction)
          n = np.array([-direction[1], direction[0]])
          add_box(
            rows, origin, p + n * 0.24, 3.88, 1.8, 0.46, 0.09, 0xDFDACC, direction
          )
          for side in [-0.65, 0.65]:
            add_box(
              rows,
              origin,
              p + np.array(direction) * side,
              3.28,
              0.10,
              0.52,
              0.42,
              0x505651,
              direction,
            )
          proof.append(
            dict(
              role="mapped-bench",
              id=bench["id"],
              mode=mode,
              firstBox=first,
              boxCount=4,
              ground=3.12,
            )
          )
        for run in runs:
          top = np.array(run["top"])
          d = np.array(run["d"])
          n = np.array(run["n"])
          length = run["length"]
          width = run["width"]
          landing = run["landing"]
          steps = run["stepCount"]
          ground = 3.12

          def rect(u0, u1, v0, v1):
            p = Polygon(
              [top + d * u + n * v for u, v in [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]]
            )
            return cardinal(p, 0.25) if native else p

          hole = rect(0, length, -width / 2, width / 2)
          openings += navigation_polygons(hole, origin[0], origin[2])
          # Cell-centre ownership partitions native tread footprints without gaps.
          drawn_strips = []
          for i in range(steps + 1):
            u0 = i * (length - landing) / steps
            u1 = (i + 1) * (length - landing) / steps if i < steps else length
            surface = rect(u0, u1, -width / 2, width / 2)
            y = ground - i * run["descent"] / steps
            prism(mesh, surface, y - 0.17, y, (177, 175, 164), (100, 103, 100))
            floors += [
              dict(**p, y=round(y, 5), sourceId=run["id"], step=i)
              for p in navigation_polygons(surface, origin[0], origin[2])
            ]
            drawn_strips.append(surface)
          assert hole.symmetric_difference(unary_union(drawn_strips)).area < 1e-6
          # Three closed retaining sides, with an entirely open upper approach.
          for side in [-1, 1]:
            wall = rect(
              0,
              length,
              side * width / 2 + (-0.24 if side < 0 else 0),
              side * width / 2 + (0 if side < 0 else 0.24),
            )
            prism(
              mesh, wall, ground - run["descent"] - 0.17, ground + 0.80, (158, 158, 148)
            )
            solids += [
              dict(
                **p,
                minHeight=ground - run["descent"] - 0.17 - 3,
                height=ground + 0.80 - 3,
                sourceId="mierendorff-v269-" + run["id"],
              )
              for p in navigation_polygons(wall, origin[0], origin[2])
            ]
          back = rect(length, length + 0.24, -width / 2 - 0.24, width / 2 + 0.24)
          prism(
            mesh, back, ground - run["descent"] - 0.17, ground + 0.80, (158, 158, 148)
          )
          solids += [
            dict(
              **p,
              minHeight=ground - run["descent"] - 0.17 - 3,
              height=ground + 0.80 - 3,
              sourceId="mierendorff-v269-" + run["id"],
            )
            for p in navigation_polygons(back, origin[0], origin[2])
          ]
          # Blue entrance standard and white U, kept beside the open mouth.
          marker = top + n * (width / 2 + 0.48)
          direction = (1, 0) if native else n
          add_box(rows, origin, marker, 4.45, 0.10, 2.66, 0.10, 0x626B69)
          add_box(rows, origin, marker, 5.9, 0.64, 0.70, 0.12, 0x1E568C, direction)
          frame = {"d": list(direction), "n": [-direction[1], direction[0]]}
          for u, y, w, h in [
            (-0.17, 5.94, 0.08, 0.40),
            (0.17, 5.94, 0.08, 0.40),
            (0, 5.74, 0.40, 0.08),
          ]:
            fittings.append_box(
              rows, origin, frame, marker, u, y, w, h, 0.025, 0.075, 0xEEEDE4
            )
        # Derive the final mouth from delivered centimetre tread edges, so
        # independently rounded oblique outer edges cannot leave tiny gaps.
        openings = navigation_polygons(
          unary_union([Polygon(f["ring"], f["holes"]) for f in floors]), 0, 0
        )
        cuts = unary_union(
          [
            translate(Polygon(p["ring"], p["holes"]), origin[0], origin[2])
            for p in openings
          ]
        )
        for mi, m in enumerate(packet["meshes"]):
          pts, col, indices = decode(m, np.array(origin))
          retired = []
          for ti, idx in enumerate(indices):
            t = pts[idx]
            if np.ptp(t[:, 1]) > 0.001 or not 2.99 <= t[0, 1] <= 3.4:
              continue
            poly = Polygon(t[:, [0, 2]])
            if not poly.is_valid or poly.area < 1e-7 or not poly.intersects(cuts):
              continue
            diff = poly.difference(cuts)
            if poly.area - diff.area < 1e-7:
              continue
            assert np.all(col[idx] == col[idx[0]])
            mesh.surface(diff, float(t[0, 1]), srgb(col[idx[0]]))
            retired.append(ti)
            ground_receipts.append(
              dict(
                chunk=tile,
                mode=mode,
                mesh=mi,
                triangle=ti,
                points=t.tolist(),
                colours=col[idx].tolist(),
                outsideArea=diff.area,
                insideArea=poly.intersection(cuts).area,
              )
            )
          if retired:
            transfers.append(dict(mesh=mi, triangles=retired))
        # Every overlapping actual companion is checked, not silently assumed empty.
        for cd in neighbours:
          if cd["id"] == tile:
            continue
          cp = base.read_json(OUT / cd[mode]["url"])
          tt = fittings.drawn_triangles(cp, [])
          for t in tt:
            if np.ptp(t[:, 1]) < 0.001 and 2.99 <= t[0, 1] <= 3.4:
              assert Polygon(t[:, [0, 2]]).intersection(cuts).area < 1e-7
      plan = dict(
        origin=origin,
        guard=nav_fingerprint(packet["nav"]),
        records=[
          dict(
            mesh=i,
            kind=m["kind"],
            fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
          )
          for i, m in enumerate(packet["meshes"])
        ],
        boxes=rows,
        structure=mesh.payload(KIND),
        transfers=transfers,
        floors=floors,
        solids=solids,
        openings=openings,
      )
      # Construction is bound to both the exact original source and complete output.
      if plan["structure"]:
        plan["structureFingerprint"] = fingerprint(
          [plan["structure"][s] for s in ["positions", "colors", "indices"]]
        )
      assert len(rows) <= 2200
      recipes[mode + ":" + tile] = plan
      counts[mode + "Boxes"] += len(rows)
      counts[mode + "StructureTriangles"] += len(mesh.indices) // 3
  for tile in ["-9_-2", "-10_-2", "-9_-3", "-10_-3"]:
    for mode in ["drawn", "minecraft"]:
      path = OUT / f"{tile}.{mode}.json.gz"
      assets[str(path.relative_to(ROOT))] = base.digest(path)
  runtime = dict(
    schema=1,
    keys=list(recipes),
    packets=recipes,
    profile=dict(
      faces=len(faces),
      owners=sorted({f["owner"] for f in faces}),
      streets=sorted(STREETS),
      scope=list(SCOPE.bounds),
      runs=runs,
      counts=dict(counts),
      groundY=3,
      fullMobileIdentical=True,
      nativeIndependent=True,
    ),
  )
  base.write_json(RUNTIME, runtime)
  base.write_json(
    EVIDENCE,
    dict(
      schema=1,
      sourceInputs=[dict(path=p, sha256=s) for p, s in sorted(assets.items())],
      contextSha256=base.digest(CONTEXT),
      faces=faces,
      surrounds=surrounds,
      furniture=proof,
      groundReceipts=ground_receipts,
      overlappingGroundPackets=[d["id"] for d in neighbours],
      cameraQA=camera_checks(),
      groundPolicy="All existing horizontal ground triangles crossing exact four apertures retain their full same-height, same-colour outside complements. Every other triangle and every line remains.",
      counts=dict(counts),
    ),
  )
  print(
    dict(
      runtimeBytes=RUNTIME.stat().st_size,
      evidenceBytes=EVIDENCE.stat().st_size,
      faces=len(faces),
      counts=dict(counts),
      groundTransfers=len(ground_receipts),
    )
  )


if __name__ == "__main__":
  if "--extract" in sys.argv:
    extract()
  run()
