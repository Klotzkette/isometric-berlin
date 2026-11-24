"""Public architectural character of Hoeniger's Rykestraße buildings.

The standing basilica uses the exact source triangles of its existing owner.
The frontage exchanges one old extrusion in its own streamed source tile.
"""

import argparse
import gzip
import json
import math
import subprocess

import numpy as np
from build_diplomatic_sites_v380 import DATA, GEO, ROOT, Mesh, shell_face
from build_embassy_sites_v380 import Packet
from build_oman_ownership_v380 import (
  PUBLIC,
  covered_triangles,
  fingerprint,
  packed,
  spans,
)
from shapely.geometry import Polygon

OWNER = "DEBE03YY600007vG"
HOST = "6_-4"
KIND = "ryke-street-house-v381"
BRICK, DARK_BRICK, CAP, PLASTER = 0xA95C46, 0x914A38, 0xC4432D, 0xE8D8B9
GLASS, STONE, STONE_LIGHT = 0x465662, 0xB58470, 0xD2A68B
SLATE, COPPER, TILE = 0x555254, 0x697C76, 0xB67658
STEP = 0.50


class Wall:
  def __init__(self, mesh, a, b, n):
    self.mesh = mesh
    self.a = np.array(a)
    self.length = math.dist(a, b)
    self.t = (np.array(b) - a) / self.length
    self.normal = np.array(n)

  def face(self, pts, tint, out=0.14):
    points = []
    for u, y in pts:
      x, z = self.a + self.t * u + self.normal * out
      points.append([x, y, z])
    self.mesh.face(points, tint)

  def panel(self, left, b, r, h, tint, out=0.14):
    self.face([(left, b), (r, b), (r, h), (left, h)], tint, out)

  def oval(self, u, y, rx, ry, tint, out, segments=24):
    self.face(
      [
        (u + rx * math.cos(t), y + ry * math.sin(t))
        for t in np.arange(segments) * math.tau / segments
      ],
      tint,
      out,
    )

  def arch(self, u, base, w, h, tint, out):
    r = w / 2
    spring = base + h - r
    self.face(
      [(u - r, base), (u + r, base)]
      + [
        (u + r * math.cos(t), spring + r * math.sin(t))
        for t in np.linspace(0, math.pi, 13)
      ],
      tint,
      out,
    )

  def window(self, u, y, w, h):
    self.arch(u, y, w + 0.31, h + 0.15, DARK_BRICK, 0.16)
    self.arch(u, y + 0.07, w, h - 0.08, GLASS, 0.19)
    self.panel(u - 0.06, y + 0.1, u + 0.06, y + h - 0.19, STONE, 0.22)
    self.panel(
      u - w * 0.48, y + h * 0.58, u + w * 0.48, y + h * 0.58 + 0.1, STONE, 0.22
    )

  def rose(self, u, y, r):
    # The 2007 public south elevation shows six circular petals around a round light.
    self.oval(u, y, r * 1.13, r * 1.13, DARK_BRICK, 0.18)
    self.oval(u, y, r * 1.04, r * 1.04, STONE_LIGHT, 0.21)
    for a in np.arange(6) * math.pi / 3:
      x, h = u + math.sin(a) * r * 0.63, y + math.cos(a) * r * 0.63
      self.oval(x, h, r * 0.32, r * 0.32, GLASS, 0.25, 16)
    self.oval(u, y, r * 0.38, r * 0.38, STONE, 0.27, 20)
    self.oval(u, y, r * 0.30, r * 0.30, 0x647D88, 0.3, 20)

  def step(self, u, eave, width, rise):
    # The five treads on the public east elevation include white plaster blind panels.
    unit = width / 9
    for j in range(9):
      levels = 5 - abs(4 - j)
      left = u - width / 2 + j * unit
      y = eave + rise * levels / 5
      self.panel(left, eave - 0.03, left + unit, y, BRICK, 0.035)
      self.panel(left - 0.045, y - 0.13, left + unit + 0.045, y + 0.02, CAP, 0.075)
      if levels > 1:
        self.panel(
          left + 0.12, eave + 0.25, left + unit - 0.12, y - 0.25, PLASTER, 0.095
        )


def clip_y(pts, limit, above):
  out = []
  for a, b in zip(pts, pts[1:] + pts[:1]):
    ina = a[1] >= limit if above else a[1] <= limit
    inb = b[1] >= limit if above else b[1] <= limit
    if ina:
      out.append(a)
    if ina != inb:
      t = (limit - a[1]) / (b[1] - a[1])
      out.append([a[i] + t * (b[i] - a[i]) for i in range(3)])
  return out


def basilica():
  source = json.loads((DATA / "religiousSitesV205.json").read_bytes())
  site = next(s for s in source["sites"] if s["id"] == "rykestrasse")
  model = Mesh()
  for t in site["triangles"]:
    pts = t["points"]
    if t["kind"] == "RoofSurface":
      # Wider copper eaves and a warmer clay nave read distinctly at isometric scale.
      low = clip_y(pts, 19.4, False)
      if len(low) >= 3:
        model.face(low, COPPER)
      for band in range(6):
        r = clip_y(
          clip_y(pts, 19.4 + band * 1.23, True), 19.4 + (band + 1) * 1.23, False
        )
        if len(r) >= 3:
          model.face(r, [TILE, 0xB57457, 0xB8785B][band % 3])
    else:
      normal = np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0]))
      normal = normal / max(0.001, np.linalg.norm(normal))
      tint = BRICK if normal[0] > 0.5 else 0xAF6952 if normal[2] > 0.4 else 0xA05F4B
      model.face(pts, tint)
  shell_triangles = len(model.indices) // 3
  for i, w in enumerate(site["walls"]):
    f = Wall(model, w["a"], w["b"], w["normal"])
    width = f.length
    if i == 45:
      for x, relative in [
        (width * 0.205, 0.12),
        (width * 0.50, 0.195),
        (width * 0.795, 0.12),
      ]:
        f.rose(x, 18.3, relative * width)
      # White panels follow the actual pitched gable, as in the south exterior photograph.
      for left, r in [
        (0.065, 0.208),
        (0.247, 0.395),
        (0.435, 0.565),
        (0.605, 0.753),
        (0.792, 0.935),
      ]:

        def top(u):
          return 25.72 - abs(0.5 - u) * 8.6

        f.face(
          [
            (width * left, 21.38),
            (width * r, 21.38),
            (width * r, top(r)),
            (width * left, top(left)),
          ],
          PLASTER,
          0.15,
        )
      for x in [width * 0.32, width * 0.68]:
        f.arch(x, 22.65, 0.82, 0.96, GLASS, 0.19)
    elif i == 24:
      for u, height in [
        (width * 0.19, 5.55),
        (width * 0.50, 6.85),
        (width * 0.81, 5.55),
      ]:
        f.window(u, 5.5, width * 0.232, height)
      f.panel(0.05, 13.7, width - 0.05, 14.05, DARK_BRICK, 0.16)
    elif i in (1, 5, 25, 38):
      # The east side consists of stepped brick bays, each with tall grouped lights.
      for x in [width * 0.17, width * 0.39, width * 0.61, width * 0.83]:
        f.window(x, 6.6, width * 0.132, 6.45)
      f.step(width * 0.5, 14.24, width * 0.97, 3.45)
      f.panel(0.1, 6.25, width - 0.1, 6.48, STONE, 0.13)
    elif w["low"] < 4 and width > 4.2:
      # Retain the previous stylized window axes on the other public exterior faces.
      for e in site["windowEvidence"]:
        if e["wallIndex"] == i:
          f.window(e["u"], e["bottomY"], e["width"], e["height"])
      f.panel(0.07, 13.80, width - 0.07, 14.05, DARK_BRICK, 0.10)
  return model, shell_triangles


def street_house():
  source = json.loads((GEO / "rykestrasse-v381-street-house.json").read_bytes())
  assert source["owner"] == OWNER
  model = Mesh()
  for kind, rings in source["surfaces"]:
    if kind == "GroundSurface":
      continue
    assert len(rings) == 1
    shell_face(model, rings[0], SLATE if kind == "RoofSurface" else BRICK)
  shell_triangles = len(model.indices) // 3
  # The two broad masonry arches, tripartite frontage, horizontal mouldings and
  # round-arched top storey are the street elevation's historic public composition.
  a = [3278.65, -1731.11]
  b = [3268.04, -1710.59]
  t = (np.array(b) - a) / math.dist(a, b)
  f = Wall(model, a, b, [t[1], -t[0]])
  w = f.length
  for x in [0.17, 0.83]:
    f.arch(x * w, 3.05, 6.15, 6.8, DARK_BRICK, 0.16)
    f.arch(x * w, 3.08, 5.35, 6.35, 0x5D5350, 0.19)
    f.arch(x * w, 3.10, 4.92, 6.05, 0x59483F, 0.22)

  def lights(x, y, width, height, tint=GLASS):
    f.panel(
      x - width / 2 - 0.11,
      y - 0.12,
      x + width / 2 + 0.11,
      y + height + 0.14,
      DARK_BRICK,
      0.15,
    )
    f.panel(x - width / 2, y, x + width / 2, y + height, tint, 0.18)
    f.panel(x - 0.055, y, x + 0.055, y + height, 0x766C61, 0.215)
    f.panel(
      x - width / 2,
      y + height * 0.62,
      x + width / 2,
      y + height * 0.62 + 0.08,
      0x766C61,
      0.215,
    )

  for x in [0.405, 0.495, 0.585]:
    lights(w * x, 4.5, 0.92, 2.18)
    lights(w * x, 7.64, 1.10, 1.9)
  for u in [0.09, 0.245, 0.405, 0.50, 0.595, 0.755, 0.91]:
    for y in [10.55, 14.66, 18.7, 22.0]:
      wide = w * (0.106 if u in (0.09, 0.245, 0.755, 0.91) else 0.063)
      if y == 22.0:
        f.window(w * u, y, wide * 0.9, 2.55)
      else:
        lights(w * u, y, wide, 2.55)
  for y in [10.02, 14.2, 18.18, 21.57, 24.85]:
    f.panel(0.02, y - 0.13, w - 0.02, y + 0.07, DARK_BRICK, 0.24)
    f.panel(0.02, y + 0.07, w - 0.02, y + 0.18, STONE, 0.23)
  for x in [0.34, 0.66]:
    f.panel(w * x - 0.17, 10.35, w * x + 0.17, 24.79, STONE, 0.145)
  return model, shell_triangles, source


def block_model(model, shell_count):
  """Rasterize the registered exterior onto a half-metre lattice and greedily mesh its skin."""
  rows = np.asarray(list(model.vertices)) / 100
  colors = [v[3] for v in model.vertices]
  faces = np.asarray(model.indices).reshape(-1, 3)
  origin = np.floor(rows[:, :3].min(axis=0) / STEP).astype(int) - 2
  dims = np.ceil(rows[:, :3].max(axis=0) / STEP).astype(int) - origin + 4
  vox = np.zeros(dims, dtype=np.int32)
  for i, inds in enumerate(faces):
    tri = rows[inds, :3] / STEP - origin
    n = max(
      1,
      math.ceil(
        max(math.dist(a, b) for a, b in zip(tri, np.roll(tri, 1, axis=0))) * 1.7
      ),
    )
    a, b = np.triu_indices(n + 1)
    points = (
      tri[0]
      + (tri[1] - tri[0]) * (a / n)[:, None]
      + (tri[2] - tri[0]) * ((b - a) / n)[:, None]
    )
    cells = np.rint(points).astype(int)
    vox[tuple(cells.T)] = colors[inds[0]]
    if i + 1 == shell_count:
      # All intermediate faces are culled. Only the exterior shell is published.
      for x, z in zip(*np.nonzero(vox.any(axis=1))):
        col = vox[x, :, z]
        idx = np.flatnonzero(col)
        interior = col[max(0, round(3 / STEP - origin[1])) : idx[-1]]
        interior[interior == 0] = BRICK
  mesh = Mesh()
  for axis in range(3):
    plane = np.moveaxis(vox, axis, 0)
    others = [j for j in range(3) if j != axis]
    for sign in [-1, 1]:
      exposed = (plane != 0) & (np.roll(plane, -sign, axis=0) == 0)
      for coord in np.flatnonzero(exposed.any(axis=(1, 2))):
        layer = plane[coord]
        mask = exposed[coord]
        for u, v in zip(*np.nonzero(mask)):
          if not mask[u, v]:
            continue
          tint = layer[u, v]
          end = v + 1
          while end < mask.shape[1] and mask[u, end] and layer[u, end] == tint:
            end += 1
          stop = u + 1
          while stop < mask.shape[0] and np.all(
            mask[stop, v:end] & (layer[stop, v:end] == tint)
          ):
            stop += 1
          mask[u:stop, v:end] = False
          pts = []
          for uu, vv in [(u, v), (u, end), (stop, end), (stop, v)]:
            p = np.array(origin, dtype=float)
            p[axis] += coord + sign * 0.5
            p[others[0]] += uu - 0.5
            p[others[1]] += vv - 0.5
            pts.append(p * STEP)
          mesh.face(pts, int(tint))
  return mesh, vox, origin


def encoded(model, xyz):
  # Use the existing centimetre / palette / delta codec for local geometry.
  p = Packet.__new__(Packet)
  p.origin = np.asarray(xyz)
  p.vertices = {}
  p.indices = []
  p.palette = {}
  rows = list(model.vertices)
  for a, b, c in np.asarray(model.indices).reshape(-1, 3):
    p.face([np.array(rows[k][:3]) / 100 for k in (a, b, c)], rows[a][3])
  return p.data()


def frontage_nav(source, raw):
  from build_oman_ownership_v380 import cdt

  origin = raw["origin"]
  groups = {
    kind: rings for kind, rings in source["surfaces"] if kind == "GroundSurface"
  }
  ground = groups["GroundSurface"][0]
  ring = [[round(p[0] - origin[0], 3), round(p[2] - origin[2], 3)] for p in ground]
  tris = []
  for kind, rings in source["surfaces"]:
    if kind != "RoofSurface":
      continue
    q = np.array(rings[0])
    pts = {(x, z): h for x, h, z in q}
    for t in cdt(Polygon(q[:, [0, 2]])):
      tris.append(
        [
          [round(x - origin[0], 3), round(pts[x, z] - 3, 3), round(z - origin[2], 3)]
          for x, z in t
        ]
      )
  return [
    dict(
      sourceId=OWNER,
      ring=ring,
      holes=[],
      minHeight=0,
      height=max(y for tri in tris for x, y, z in tri),
      roofTriangles=tris,
    )
  ]


def native_nav(vox, axis_origin, tile_origin):
  # Join equal-height cells before building a sparse roof navigation lookup.
  tops = {}
  for x, z in zip(*np.nonzero(vox.any(axis=1))):
    high = np.flatnonzero(vox[x, :, z])[-1]
    tops[x + axis_origin[0], z + axis_origin[2]] = round(
      (high + axis_origin[1] + 0.5) * STEP - 3, 3
    )
  records = []
  for x, z, x1, z1, h in spans(tops):
    pts = [
      [round(u - STEP / 2 - tile_origin[0], 3), round(v - STEP / 2 - tile_origin[2], 3)]
      for u, v in [(x, z), (x1, z), (x1, z1), (x, z1)]
    ]
    records.append(dict(sourceId=OWNER, ring=pts, holes=[], height=h, minHeight=0))
  return records


def build():
  temple, n = basilica()
  block, _, _ = block_model(temple, n)
  for mode, model in [("drawn", temple), ("native", block)]:
    payload = encoded(model, [3240, 3, -1760])
    yield (
      DATA / f"rykeBasilicaV381-{mode}.json",
      (json.dumps(payload, separators=(",", ":")) + "\n").encode(),
    )
  school, n, source = street_house()
  native, vox, axis_origin = block_model(school, n)
  guards = json.loads(
    subprocess.check_output(
      ["bun", str(ROOT / "scripts/prepare_ryke_v381.ts")], cwd=ROOT / "src/app"
    )
  )
  for mode, model in [("drawn", school), ("minecraft", native)]:
    raw = json.loads(gzip.decompress((PUBLIC / f"{HOST}.{mode}.json.gz").read_bytes()))
    [old] = [b for b in raw["nav"]["buildings"] if b["sourceId"] == OWNER]
    # SourceQuarter uses the exact original nav row, where groundOffset is implicit.
    retire, lines = covered_triangles(raw, {"groundOffset": 0, **old})
    part = packed(model, raw["origin"])
    part["kind"] = KIND
    nav = (
      frontage_nav(source, raw)
      if mode == "drawn"
      else native_nav(vox, axis_origin, raw["origin"])
    )
    plan = dict(
      **guards[mode],
      origin=raw["origin"],
      retire=retire,
      retireLines=lines,
      append=part,
      appendFingerprint=fingerprint(part),
      retireNav=[old],
      appendNav=nav,
      owners=[OWNER],
    )
    key = mode + ":" + HOST
    wire = json.dumps(
      dict(schemaVersion=1, keys=[key], packets={key: plan}), separators=(",", ":")
    ).encode()
    yield DATA / f"rykeStreetHouseV381-{mode}.json.gz", gzip.compress(wire, mtime=0)


if __name__ == "__main__":
  arg = argparse.ArgumentParser()
  arg.add_argument("--check", action="store_true")
  check = arg.parse_args().check
  for file, content in build():
    if check:
      assert file.read_bytes() == content, file
    else:
      file.write_bytes(content)
    print(file.name, len(content), flush=True)
