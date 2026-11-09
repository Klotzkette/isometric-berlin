"""Compile measured Steglitz street surfaces within the retained ground tile."""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_rixdorf_v304 import fingerprint, fnv, sha, write
from build_surrounding_outlines import COLORS as ORIGINAL_COLORS
from build_surrounding_outlines import PackedMesh, polygonal
from shapely.affinity import rotate, translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
DATA = APP / "src/data"
PUBLIC = APP / "public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "steglitz-streets-v328-source.json.gz"
OUT = DATA / "steglitzStreetsV328Packets.json"
KIND = "steglitz-streets-v328"
TILE = "ring182--7_13"
SOURCE_SHA = "5b65fa72c4e11a161ad84ba9adef2d6f168e54eadd3cc54b4b272a5081b74af1"

# Keep material differences visible without copying survey imagery or adding paint.
COLORS = {
  "cm_fahrbahn": (95, 99, 100),
  "ck_parkflaeche": (132, 128, 120),
  "cl_gehweg": (173, 169, 153),
  "bn_baumscheibe": (118, 119, 93),
}
WALK_MATERIALS = {
  "03": (158, 153, 140),
  "04": (151, 148, 137),
  "07": (180, 177, 164),
  "08": (175, 169, 151),
  "09": (166, 164, 153),
  "10": (169, 167, 155),
  "13": (155, 144, 123),
  "15": (133, 143, 107),
}
LEVELS = {
  "cm_fahrbahn": 3.03,
  "ck_parkflaeche": 3.05,
  "cl_gehweg": 3.09,
  "bn_baumscheibe": 3.045,
}


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def nav_polygon(row, x=0, z=0):
  return translate(Polygon(row["ring"], row.get("holes", [])).buffer(0), x, z)


def ground_planes(packet, focus):
  """Yield exact indexed horizontal faces near the retained ground height."""
  origin = np.asarray(packet["origin"])
  for mesh, part in enumerate(packet["meshes"]):
    vertices = np.frombuffer(base64.b64decode(part["positions"]), "<u2")
    vertices = vertices.reshape(-1, 3) / 100 + origin
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    for ordinal, ids in enumerate(indices):
      tri = vertices[ids]
      if np.ptp(tri[:, 1]) > 1e-6 or not 2.99 <= tri[0, 1] <= 3.30:
        continue
      surface = Polygon(tri[:, [0, 2]])
      if surface.area > 1e-5 and focus.intersects(surface):
        ground = tri[0, 1] == 3 and all(
          tuple(c) == (125, 131, 103) for c in colors[ids]
        )
        yield mesh, ordinal, surface, ground


def old_road_tops(packet, focus):
  return [face for _, _, face, ground in ground_planes(packet, focus) if not ground]


def close_ground_below_paving(packet, mesh, paving):
  """Replace only old flat ground that intersects a new surface.

  The original ground colour and height remain exact everywhere outside that
  surface. The old top cannot compete for depth with the new street at altitude.
  """
  ordinals = defaultdict(list)
  removed = []
  for mesh_index, ordinal, triangle, ground in ground_planes(packet, paving):
    if not ground or triangle.intersection(paving).area <= 1e-5:
      continue
    ordinals[mesh_index].append(ordinal)
    removed.append(shapely.set_precision(triangle, 0.01))
  assert ordinals
  original = shapely.union_all(removed, grid_size=0.01)
  retained = shapely.difference(original, paving, grid_size=0.01)
  assert retained.intersection(paving).area < 0.01
  mesh.surface(retained.simplify(0), 3.0, ORIGINAL_COLORS["ground"])
  return [dict(mesh=i, triangles=ordinals[i]) for i in sorted(ordinals)]


def landmark_ground(focus):
  """Retain the separate, already-authored local surfaces where they intersect."""
  tops = []
  assert not focus.intersects(box(*read(DATA / "steglitzGroundV247.json")["bounds"]))
  for name in (
    "steglitzV182Source",
    "steglitzV246Details",
    "schlossstrasseV247Details",
    "steglitzPublicSpaceV327",
  ):
    data = read(DATA / f"{name}.json")
    for row in data.get("boxes", data.get("drawn", [])):
      x, y, z, w, h, d, angle, _ = row
      if not 3.0 <= y + h / 2 <= 3.30 or min(w, d) < 0.35:
        continue
      foot = rotate(box(-w / 2, -d / 2, w / 2, d / 2), -angle, use_radians=True)
      foot = translate(foot, x, z)
      if foot.intersects(focus):
        tops.append(foot)
    for surface in data.get("surfaces", []):
      for tri in surface["triangles"]:
        if not all(3.0 <= p[1] <= 3.30 for p in tri):
          continue
        foot = Polygon([(p[0], p[2]) for p in tri])
        if foot.area > 1e-5 and foot.intersects(focus):
          tops.append(foot)
  return tops


def cardinal_runs(area, cell=0.5):
  """Merge complete half-metre cells in X/Z without filling any holes."""
  if area.is_empty:
    return
  a, b, c, d = area.bounds
  xs = np.arange(math.floor(a / cell), math.ceil(c / cell)) * cell
  active = {}
  shapely.prepare(area)
  for z in np.arange(math.floor(b / cell), math.ceil(d / cell)) * cell:
    mask = shapely.covers(area, shapely.box(xs, z, xs + cell, z + cell))
    flags = np.concatenate(([False], mask, [False]))
    edges = np.flatnonzero(flags[1:] != flags[:-1])
    current = {
      (float(xs[i]), float(xs[j - 1] + cell)) for i, j in zip(edges[::2], edges[1::2])
    }
    for run in sorted(active.keys() - current):
      yield box(run[0], active.pop(run), run[1], z)
    for run in sorted(current):
      active.setdefault(run, float(z))
  for (x1, x2), start in sorted(active.items()):
    yield box(x1, start, x2, z + cell)


def build():
  assert sha(SOURCE) == SOURCE_SHA
  evidence = read(SOURCE)
  rows = [(r, shape(r["geometry"])) for r in evidence["features"]]
  focus = unary_union([g for _, g in rows])
  packets = {}
  previous = {}
  grounds = []
  excluded = landmark_ground(focus)
  for mode in ("drawn", "minecraft"):
    path = PUBLIC / f"{TILE}.{mode}.json.gz"
    packet = read(path)
    x, _, z = packet["origin"]
    nav = packet["nav"]
    assert nav["groundY"] == 3
    previous[mode] = sha(path)
    packets[mode] = packet
    grounds.append(unary_union([nav_polygon(p, x, z) for p in nav["ground"]]))
    for p in nav["buildings"] + nav["roads"] + nav["water"]:
      foot = nav_polygon(p, x, z)
      if focus.intersects(foot):
        excluded.append(foot)
    excluded.extend(old_road_tops(packet, focus))
  site = read(DATA / "steglitzV182Navigation.json")
  excluded.extend(
    nav_polygon(p) for p in site["buildings"] if focus.intersects(nav_polygon(p))
  )
  ground = grounds[0].intersection(grounds[1])
  blocked = unary_union(excluded).buffer(0.04)
  remaining = ground.difference(blocked)
  claims = defaultdict(list)
  for kind in ("bn_baumscheibe", "ck_parkflaeche", "cm_fahrbahn", "cl_gehweg"):
    for row, shape_ in rows:
      if row["layer"] != kind:
        continue
      group = (
        WALK_MATERIALS.get(row["material"], COLORS[kind])
        if kind == "cl_gehweg"
        else COLORS[kind]
      )
      part = polygonal(shape_.intersection(remaining))
      if part.area < 0.03:
        continue
      claims[(kind, group)].append(part)
      remaining = remaining.difference(part)
  compiled = {}
  stats = {}
  for mode, packet in packets.items():
    x, _, z = packet["origin"]
    mesh = PackedMesh(x, z)
    areas = defaultdict(float)
    pavement = []
    for (kind, color), values in claims.items():
      area = polygonal(unary_union(values))
      if mode == "minecraft":
        area = unary_union(list(cardinal_runs(area)))
      area = shapely.set_precision(area, 0.01).simplify(0)
      mesh.surface(area, LEVELS[kind], color)
      areas[kind] += area.area
      pavement.append(area)
    paving = shapely.union_all(pavement, grid_size=0.01)
    retire = close_ground_below_paving(packet, mesh, paving)
    append = mesh.payload(KIND)
    assert append
    # JS JSON.stringify emits exact integer-looking numbers without a decimal.
    nav = js_json(packet["nav"])
    line = packet.get("lines")
    key = f"{mode}:{TILE}"
    compiled[key] = dict(
      origin=packet["origin"],
      records=[
        dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
        for i, m in enumerate(packet["meshes"])
      ],
      navGuard=fnv(nav),
      lineGuard=fnv(line["positions"] + line.get("colors", "")) if line else None,
      append=append,
      appendFingerprint=fingerprint(append),
      retire=retire,
      owners=["Heesestraße — Straßenbefahrung", "Albrechtstraße — Straßenbefahrung"],
    )
    stats[mode] = dict(
      areas={k: round(v, 3) for k, v in areas.items()},
      vertices=len(mesh.vertices),
      indices=len(mesh.indices),
      worstCaseBytes=len(mesh.vertices) * 12 + len(mesh.indices) * 4,
      oldGroundTriangles=sum(len(row["triangles"]) for row in retire),
    )
    assert stats[mode]["worstCaseBytes"] < 768 * 1024, stats[mode]
  return dict(schemaVersion=1, keys=list(compiled), packets=compiled), dict(
    originalPacketSha256=previous, modes=stats
  )


def js_json(value):
  """Match canonical numbers for the existing finite packet's v300 gate."""

  def numbers(row):
    if isinstance(row, float) and row.is_integer():
      return int(row)
    if isinstance(row, list):
      return [numbers(v) for v in row]
    if isinstance(row, dict):
      return {k: numbers(v) for k, v in row.items()}
    return row

  return json.dumps(numbers(value), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
  result, proof = build()
  write(OUT, result)
  print(json.dumps(proof, indent=2))
