"""Bounded, source-bound Dorotheenstadt recognition with exact facade receipts."""

from __future__ import annotations

import base64
import json
import math
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import geopandas as gpd
import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_ihz_v241 import native_faces
from build_karl_marx_allee_v161 import Detail, native_detail
from build_lafayette_v241 import pieces, read, sha, write
from build_scheunenviertel_v168 import merge_native_faces
from lafayette_v241_receipts import fingerprint, mesh_signatures, retained
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/dorotheenstadt-v266/osm-map.json"
IDS = {
  "DEBE01YYK00004GM": "brecht",
  "DEBE01YYK00000uX": "vertretung",
  "DEBE01YYK000007F": "chapel",
  "DEBE01YYK00004K6": "hannoversche",
  "DEBE01YYK00003Kp": "hannoversche",
}
SELECT = {
  "UUID_9aad5a32-b2f2-4148-ab8a-4188ff9e6191": "brecht",
  "UUID_3fbd925b-75f8-4ecb-b20d-454b1da36f54": "vertretung",
  "UUID_233d4e72-2c8e-4a5b-a1b4-fde4fdb64dbb": "vertretung-side",
  "UUID_c3d5eb4a-7282-475b-bd87-fbea1b28f182": "vertretung-side",
}
STONE = (218, 211, 192)
IVORY = (230, 228, 215)
DARK = (65, 73, 70)
GLASS = (90, 116, 119)
TERRA = (157, 73, 58)
BOUNDS = [760, -1140, 1060, -820]


def frame(surface: dict) -> tuple:
  """Preserve every ring, in the source wall's local horizontal/vertical plane."""
  rings = surface["rings"]
  r = rings[0]
  a, b = max(
    ((a, b) for a in r for b in r),
    key=lambda v: math.hypot(v[0][0] - v[1][0], v[0][2] - v[1][2]),
  )
  a = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = float(np.linalg.norm(d))
  d /= length
  n = np.array(core.normal_of(r))
  poly = Polygon(
    [[(np.array(p) - a) @ d, p[1]] for p in r],
    [[[(np.array(p) - a) @ d, p[1]] for p in ring] for ring in rings[1:]],
  )
  return a, d, n, shapely.make_valid(poly), length


def fitting(
  target: dict, style: str, surfaces: list[dict], native: bool
) -> tuple[Detail, list]:
  """A complete source-bound front; native clipping follows its existing orthogonal skin."""
  result = Detail()
  a, d, normal, source_poly, length = frame(target)
  receipts = []
  low = source_poly.bounds[1]
  top = source_poly.bounds[3]
  contexts = []
  for surface in surfaces:
    _, _, n, _, _ = frame(surface)
    poly = shapely.make_valid(
      Polygon(
        [[float((np.array(p) - a) @ d), p[1]] for p in surface["rings"][0]],
        [
          [[float((np.array(p) - a) @ d), p[1]] for p in r]
          for r in surface["rings"][1:]
        ],
      )
    )
    # Source corner expansion of native columns is bounded to the photographed facade.
    poly = poly.intersection(box(0, low, length, top))
    if not poly.is_empty:
      contexts.append((surface, n, poly))

  def emit(shape, color, role, out=0.20, depth=0.035):
    for surface, n, poly in contexts:
      for part in pieces(poly.intersection(shape)):
        if native:
          # A retained native plane can end at a sloped colour/ground boundary.
          # Keep the new fitting strictly orthogonal and conservatively inside it.
          rings = []
          for ring_index, ring in enumerate([part.exterior, *part.interiors]):
            points = []
            coords = list(ring.coords)
            for p, q in zip(coords, coords[1:]):
              points.append(p)
              if abs(p[0] - q[0]) > 1e-7 and abs(p[1] - q[1]) > 1e-7:
                corners = [(p[0], q[1]), (q[0], p[1])]
                corner = next(
                  (
                    c
                    for c in corners
                    if part.buffer(1e-7).covers(Point(c)) == (ring_index == 0)
                  ),
                  corners[0],
                )
                points.append(corner)
            rings.append(points)
          stepped = shapely.make_valid(Polygon(rings[0], rings[1:]))
          candidates = pieces(stepped)
          # These source-bound small cuts remain simple in the selected fronts.
          if len(candidates) != 1 or not part.buffer(1e-6).covers(candidates[0]):
            continue
          part = candidates[0]
        if part.area < 0.0001:
          continue

        def xyz(u, y, offset):
          if native:
            axis = int(np.argmax(abs(n)))
            var = 2 if axis == 0 else 0
            p = np.zeros(3)
            p[axis] = surface["rings"][0][0][axis]
            p[1] = y
            p[var] = a[var] + (u - (p[axis] - a[axis]) * d[axis]) / d[var]
          else:
            p = a + d * u
            p[1] = y
          return (p + n * offset).tolist()

        # Native spacing separates quantized planes; no diagonal native profiles.
        offset = 0.08 + (out - 0.16) * 2 if native else out
        for tri in shapely.constrained_delaunay_triangles(part).geoms:
          points = [
            xyz(u, y, offset + depth / 2) for u, y in list(tri.exterior.coords)[:-1]
          ]
          if (
            np.dot(
              np.cross(
                np.array(points[1]) - points[0], np.array(points[2]) - points[0]
              ),
              n,
            )
            < 0
          ):
            points.reverse()
          result.polygon(points, color, role)
        if depth > 0.06:
          for ring in [part.exterior, *part.interiors]:
            coords = list(ring.coords)
            for p, q in zip(coords, coords[1:]):
              result.polygon(
                [
                  xyz(*p, offset - depth / 2),
                  xyz(*q, offset - depth / 2),
                  xyz(*q, offset + depth / 2),
                  xyz(*p, offset + depth / 2),
                ],
                tuple(max(0, c - 12) for c in color),
                role + " return",
              )
        receipts.append(
          {
            "role": role,
            "sourcePolygonId": target.get("sourcePolygonId"),
            "area": round(part.area, 5),
            "native": native,
          }
        )

  def rect(u, y, w, h, color, role, out=0.24, depth=0.04):
    emit(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2), color, role, out, depth)

  def window(u, y, w, h, hood=False):
    rect(u, y, w + 0.24, h + 0.22, DARK, "window reveal", 0.25, 0.10)
    rect(u, y, w, h, GLASS, "glazing", 0.32)
    for x in [u - w / 2, u, u + w / 2]:
      rect(x, y, 0.065, h, IVORY, "window vertical frame", 0.38)
    for yy in [y - h / 2, y + h * 0.18, y + h / 2]:
      rect(u, yy, w, 0.065, IVORY, "window transom", 0.38)
    rect(u, y - h / 2 - 0.12, w + 0.42, 0.16, STONE, "projecting sill", 0.40, 0.27)
    if hood:
      rect(
        u, y + h / 2 + 0.20, w + 0.58, 0.22, STONE, "classical window hood", 0.40, 0.32
      )
      for du in [-w * 0.39, w * 0.39]:
        rect(u + du, y + h / 2 + 0.01, 0.14, 0.25, STONE, "hood bracket", 0.40, 0.24)

  if style == "cornice":
    for y, h, out, depth, col in [
      (top - 0.27, 0.12, 0.22, 0.20, DARK),
      (top - 0.12, 0.15, 0.30, 0.38, STONE),
    ]:
      rect(
        length / 2, y, length - 0.10, h, col, "hannoversche measured eave", out, depth
      )
    return result, receipts

  # The old generic estimated apertures on these precise sheets are receipted.
  emit(source_poly, STONE if style == "brecht" else IVORY, "source-plane plaster", 0.17)
  if style == "brecht":
    # Street elevation: three floors, five regular axes, lateral round-arched door.
    for y, h, depth in [
      (low + 0.65, 0.8, 0.06),
      (low + 4.15, 0.19, 0.24),
      (low + 4.44, 0.12, 0.30),
      (low + 8.57, 0.13, 0.21),
      (top - 0.32, 0.20, 0.35),
      (top - 0.10, 0.18, 0.45),
    ]:
      rect(
        length / 2,
        y,
        length - 0.05,
        h,
        STONE if h < 0.5 else (177, 171, 152),
        "brecht cornice",
        0.32,
        depth,
      )
    for level, y in enumerate([low + 6.32, low + 10.4]):
      for bay in range(5):
        window((bay + 0.5) * length / 5, y, 1.32, 2.53, True)
    for i in range(24):
      rect(
        (i + 0.5) * length / 24,
        top - 0.49,
        0.18,
        0.23,
        STONE,
        "brecht cornice dentil",
        0.39,
        0.28,
      )
    # Round arch at the first photographed axis; the retained source stays closed.
    u = length * 0.105
    spring = low + 2.25
    radius = 0.93
    if native:
      for i in range(10):
        x = -radius + (i + 0.5) * 2 * radius / 10
        h = math.sqrt(max(0, radius * radius - x * x))
        rect(
          u + x,
          spring + h / 2,
          2 * radius / 10,
          h,
          DARK,
          "arched door stepped upper",
          0.29,
        )
    else:
      arch = Polygon(
        [(u - radius, low + 0.08), (u + radius, low + 0.08), (u + radius, spring)]
        + [
          (
            u + radius * math.cos(i * math.pi / 24),
            spring + radius * math.sin(i * math.pi / 24),
          )
          for i in range(25)
        ]
      )
      emit(arch, DARK, "round arched door", 0.29)
    rect(u, low + 1.16, 1.66, 2.16, (89, 74, 56), "wood entrance", 0.34)
    for side in [-1, 1]:
      rect(u + side * 1.06, low + 1.48, 0.18, 2.9, STONE, "door jamb", 0.36, 0.22)
    for i in range(13):
      angle = (i + 0.5) * math.pi / 13
      x = u + 1.06 * math.cos(angle)
      y = spring + 1.06 * math.sin(angle)
      rect(x, y, 0.22, 0.21, STONE, "arch voussoir", 0.37, 0.20)
    for bay in [1.5, 3.5]:
      window(bay * length / 5, low + 1.98, 2.7, 2.6)
    for u in [length * 0.06, length * 0.25, length * 0.5, length * 0.75, length * 0.96]:
      for y in [low + 0.8, low + 1.4, low + 2, low + 2.6, low + 3.2]:
        rect(u, y, 0.30, 0.08, DARK, "ground rustication joint", 0.27)
    rect(
      length * 0.27,
      low + 1.43,
      0.58,
      0.43,
      DARK,
      "unlettered memorial plaque",
      0.40,
      0.08,
    )
  elif style.startswith("vertretung"):
    side = style.endswith("side")
    bays = 1 if side else 5
    # Five broad paired axes, upper atelier ribbon and terracotta spandrels.
    for level in range(5):
      y = low + 1.6 + level * 3.23
      for bay in range(bays):
        window((bay + 0.5) * length / bays, y, 2.2 if side else 3.35, 2.18)
    rect(
      length / 2,
      low + 0.47,
      length - 0.04,
      0.94,
      (118, 124, 115),
      "stone base course",
      0.25,
      0.10,
    )
    for y in [low + 13.68, low + 16.71]:
      rect(length / 2, y, length - 0.05, 0.22, STONE, "strong sill cornice", 0.33, 0.32)
    if not side:
      for y, h in [(top - 3.33, 0.96), (top - 0.48, 0.84)]:
        rect(
          length / 2,
          y,
          length - 0.05,
          h,
          TERRA,
          "terracotta atelier spandrel",
          0.27,
          0.10,
        )
        for u in np.arange(0.16, length, 0.24):
          rect(float(u), y, 0.022, h, (114, 59, 49), "terracotta vertical joint", 0.33)
      y = top - 1.95
      w = length - 0.25
      rect(length / 2, y, w, 1.68, GLASS, "atelier continuous glazing", 0.30)
      for u in np.linspace(0.16, length - 0.16, round(length / 0.79) + 1):
        rect(float(u), y, 0.075, 1.7, IVORY, "atelier fine mullion", 0.38)
      for yy in [y - 0.84, y, y + 0.84]:
        rect(length / 2, yy, w, 0.085, IVORY, "atelier ribbon rail", 0.38)
    for u in [0.12, length - 0.12]:
      rect(u, (low + top) / 2, 0.12, top - low - 0.1, STONE, "risalit edge", 0.29)
  return result, receipts


def exact_receipts(front: Detail) -> tuple[list, dict]:
  result = []
  inputs = {}
  shaded = core.isometric_shading(front)
  manifest = read(PUB / "manifest.json")
  for tile in ["1_-3", "1_-2", "2_-2"]:
    packet = read(PUB / (tile + ".drawn.json.gz"))
    origin = packet["origin"]
    bounds = [origin[0], origin[2], origin[0] + 512, origin[2] + 512]
    pending = Counter(
      s
      for m in pack_detail(shaded, bounds, origin_y=origin[1])
      for s in mesh_signatures(m)
    )
    for c in manifest["chunks"]:
      if c["id"] != tile and not c["id"].startswith(tile + "-alt-mitte-v169-"):
        continue
      path = PUB / c["drawn"]["url"]
      p = read(path)
      for m in p["meshes"]:
        if m["kind"] != "alt-mitte-v169":
          continue
        chosen = []
        for i, s in enumerate(mesh_signatures(m)):
          if pending[s]:
            chosen.append(i)
            pending[s] -= 1
        if chosen:
          result.append(
            dict(
              tile=c["id"],
              kind=m["kind"],
              mode="drawn",
              fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
              triangles=chosen,
            )
          )
      inputs[str(path.relative_to(ROOT))] = sha(path)
    assert not sum(pending.values()), (tile, sum(pending.values()))
  return result, inputs


def cemetery(buildings: list) -> tuple[dict, list]:
  raw = read(RAW)
  nodes = {e["id"]: e for e in raw["elements"] if e["type"] == "node"}
  tr = Transformer.from_crs(4326, 25833, always_xy=True)

  def xz(n):
    x, y = tr.transform(n["lon"], n["lat"])
    return [round(x - 389500, 5), round(5820000 - y, 5)]

  way = next(e for e in raw["elements"] if e["type"] == "way" and e["id"] == 24733507)
  ring = [xz(nodes[n]) for n in way["nodes"][:-1]]
  area = Polygon(ring)
  paths = []
  points = []
  for e in raw["elements"]:
    tags = e.get("tags", {})
    if (
      e["type"] == "way" and tags.get("highway") and all(n in nodes for n in e["nodes"])
    ):
      line = LineString([xz(nodes[n]) for n in e["nodes"]])
      if line.distance(area) > 8:
        continue
      width = (
        2.8 if tags["highway"] in ["path", "footway", "steps", "pedestrian"] else 12
      )
      paths.append(dict(id=e["id"], width=width, geometry=mapping(line)))
    if e["type"] == "node" and (
      tags.get("historic") == "tomb"
      or tags.get("cemetery") == "grave"
      or tags.get("natural") == "tree"
    ):
      p = Point(xz(e))
      if area.covers(p):
        points.append(
          dict(
            id=e["id"],
            point=list(p.coords)[0],
            radius=3 if tags.get("historic") == "tomb" else 1.5,
          )
        )
  building_shapes = [
    core.footprint(b) for b in buildings if core.footprint(b).distance(area) < 3
  ]
  paths_union = unary_union(
    [shapely.geometry.shape(p["geometry"]).buffer(p["width"] / 2 + 1.15) for p in paths]
  )
  blockers = unary_union(
    [
      paths_union,
      *[p.buffer(1.2) for p in building_shapes],
      *[Point(p["point"]).buffer(p["radius"]) for p in points],
    ]
  )
  allowed = area.buffer(-2).difference(blockers)
  groups = []
  # Dispersed anonymous interpretation; no asserted grave plan or personal names.
  for iz in range(-1110, -885, 7):
    for ix in range(780, 947, 7):
      x = ix + (iz % 3) * 0.7
      z = iz + ((ix // 7) % 3) * 0.5
      envelope = box(x - 1.25, z - 1.55, x + 1.25, z + 1.55)
      if allowed.covers(envelope):
        groups.append([round(x, 3), round(z, 3), (ix + iz) % 4])
  groups = groups[:: max(1, math.ceil(len(groups) / 130))]
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  terrain = read(ground_path)
  heights, grid, cell = terrain["ground_height"], terrain["grid"], terrain["cell_m"]
  datums = set()
  for x, z, _ in groups:
    for dx, dz in [(0, 0), (-1.25, -1.55), (1.25, -1.55), (-1.25, 1.55), (1.25, 1.55)]:
      ix = math.floor((x + dx) / cell) - grid["min_x_idx"]
      iz = math.floor((z + dz) / cell) - grid["min_z_idx"]
      assert any(a <= ix < a + n for a, n, _ in terrain["ground_rows"][iz])
      row, col = iz // heights["stride_cells"], ix // heights["stride_cells"]
      datums.add(heights["y_dm"][row * heights["cols"] + col] / 10)
  assert len(datums) == 1, (
    "Cemetery requires per-group terrain anchors if the ground varies"
  )
  evidence = dict(
    osmWay=way,
    ring=ring,
    paths=paths,
    retainedPointClearances=points,
    buildingFootprints=[mapping(p) for p in building_shapes],
    groups=groups,
    groundY=datums.pop(),
    groundSource=str(ground_path.relative_to(ROOT)),
    groundSourceSha256=sha(ground_path),
    displayEstimate="Anonymous dispersed grave markers; not named, surveyed or cadastral grave plots. All mapped graves, paths, trees and source buildings remain clear.",
  )
  return evidence, groups


def build():
  _, occupied, inputs = retained()
  all_buildings = []
  for tile in ["390_5820", "390_5821"]:
    p = core.SOURCE / ("source-" + tile + "-00.json.gz")
    all_buildings += read(p)["buildings"]
    inputs[str(p.relative_to(ROOT))] = sha(p)
  buildings = [b for b in all_buildings if b["id"] in IDS]
  assert len(buildings) == len(IDS)
  drawn = Detail()
  native = Detail()
  old = Detail()
  front_receipts = []
  audit = []
  roads = gpd.read_file(GEO / "osm.gpkg", layer="roads")
  roads = roads[roads["name"].fillna("") == "Hannoversche Straße"]
  axis = affine_transform(unary_union(roads.geometry), [1, 0, 0, -1, -389500, 5820000])
  for b in buildings:
    full = Detail()
    shell, front, _, _ = core.model(b, occupied)
    full.triangles = shell.triangles + front.triangles
    existing = merge_native_faces(native_detail(full))
    targets = []
    for p in b["parts"]:
      for s in p["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        style = SELECT.get(s["sourcePolygonId"])
        if IDS[b["id"]] == "hannoversche":
          a, d, n, poly, length = frame(s)
          mid = a + d * length / 2
          low, top = poly.bounds[1], poly.bounds[3]
          if (
            length > 5
            and top - low > 8
            and axis.distance(Point(mid[0], mid[2])) < 18
            and axis.distance(Point(mid[0] + n[0], mid[2] + n[2]))
            < axis.distance(Point(mid[0], mid[2])) - 0.5
          ):
            style = "cornice"
        if not style:
          continue
        targets.append(s)
        new, r = fitting(s, style, [s], False)
        drawn.triangles.extend(new.triangles)
        front_receipts += r
        if style != "cornice":
          low = min(
            (
              q[1]
              for surf in p["surfaces"]
              if surf["kind"] == "GroundSurface"
              for ring in surf["rings"]
              for q in ring
            ),
            default=p["groundY"],
          )
          old.triangles.extend(
            core.facade(s["rings"], low, p["topY"], occupied).triangles
          )
        faces = native_faces(existing, [s])
        new, r = fitting(s, style, faces, True)
        native.triangles.extend(new.triangles)
        front_receipts += r
    audit.append(
      dict(
        id=b["id"],
        site=IDS[b["id"]],
        parts=len(b["parts"]),
        sheets=sum(len(p["surfaces"]) for p in b["parts"]),
        selectedSheets=len(targets),
        sourceTriangles=len(shell.triangles),
        nativeSourceTriangles=len(existing.triangles),
      )
    )
  records, packet_inputs = exact_receipts(old)
  inputs.update(packet_inputs)
  cemetery_evidence, groups = cemetery(all_buildings)
  inputs[cemetery_evidence["groundSource"]] = cemetery_evidence["groundSourceSha256"]
  # The complete chapel is evidence and an exclusion footprint; its original
  # measured roof, facade and entrance remain untouched by the anonymous graves.
  runtime = {}
  counts = {}
  for family, detail in [("drawn", drawn), ("minecraft", native)]:
    packet = empty_packet("dorotheenstadt-v266-" + family, BOUNDS)
    packet["meshes"] = pack_detail(detail, BOUNDS, origin_y=-10)
    for m in packet["meshes"]:
      m["kind"] = "dorotheenstadt-v266"
    runtime[family] = packet
    counts[family] = dict(
      triangles=sum(
        len(base64.b64decode(m["indices"])) // 12 for m in packet["meshes"]
      ),
      constructionTriangles=len(detail.triangles),
      vertices=sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
      ),
      roles=dict(Counter(r for _, _, r in detail.triangles)),
    )
  runtime["graves"] = groups
  runtime["profile"] = dict(
    owners=audit,
    fullStaticDetailOnTouch=True,
    retiredTriangles=sum(len(r["triangles"]) for r in records),
    graveGroups=len(groups),
    graveGroundY=cemetery_evidence["groundY"],
    counts=counts,
  )
  write(APP / "dorotheenstadtV266.json", runtime)
  write(APP / "dorotheenstadtV266Previous.json", dict(schemaVersion=1, records=records))
  write(
    GEO / "dorotheenstadt-v266-evidence.json.gz",
    dict(
      schemaVersion=1,
      buildings=buildings,
      inputs={**inputs, str(RAW.relative_to(ROOT)): sha(RAW)},
      frontFittings=front_receipts,
      cemetery=cemetery_evidence,
      counts=counts,
      owners=audit,
      retiredTriangles=sum(len(r["triangles"]) for r in records),
      retirementPolicy="Only exact generic v169 drawn apertures on four source sheets yield after the required new facade has loaded; complete walls, roofs, courtyards, native shells, paths and prior details remain. No navigation changes.",
      primaryReferences=[
        "https://www.museum-der-1000-orte.de/bauwerke/bauwerk/altbau",
        "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011063",
        "https://lfbrecht.de/brecht-haus/geschichte/",
        "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010186",
        "https://evfbs.de/start/friedhoefe/region-nord/einzeldarstellung/dorotheenstadt-i/kapelle",
      ],
    ),
  )
  print(
    json.dumps(
      dict(
        owners=audit,
        counts={
          k: {x: v for x, v in c.items() if x != "roles"} for k, c in counts.items()
        },
        groups=len(groups),
        retired=sum(len(r["triangles"]) for r in records),
        bytes=(APP / "dorotheenstadtV266.json").stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  build()
