"""Replace the Clayallee embassy's one OSM extrusion inside its actual outer tile."""

import argparse
import base64
import gzip
import json
import math
import subprocess
from collections import defaultdict

import numpy as np
import shapely as sh
from build_diplomatic_sites_v380 import DATA, GEO, ROOT, Mesh, oman
from shapely.geometry import LineString, Point, Polygon, box

HOST = "outer187--13_12"
KIND = "oman-exterior-v380"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
STEP = 0.5


def decode(s, dtype):
  return np.frombuffer(base64.b64decode(s), dtype=dtype)


def covered_triangles(data, old):
  """All and only old wall / roof planes, verified by bounds, surface area and topology."""
  poly = Polygon(old["ring"], old["holes"])
  low = data["nav"]["groundY"] + old["groundOffset"]
  high = low + old["height"]
  origin = data["origin"]
  records = []
  roofs = []
  side_area = 0
  for mi, m in enumerate(data["meshes"]):
    if m["kind"] != "city":
      continue
    pos = decode(m["positions"], "<u2").reshape(-1, 3) * 0.01
    pos[:, 1] += origin[1]
    idx = decode(m["indices"], "<u4").reshape(-1, 3)
    tri = pos[idx]
    mean = tri.mean(1)
    x0, z0, x1, z1 = poly.bounds
    candidates = np.flatnonzero(
      (mean[:, 0] >= x0 - 0.01)
      & (mean[:, 0] <= x1 + 0.01)
      & (mean[:, 2] >= z0 - 0.01)
      & (mean[:, 2] <= z1 + 0.01)
    )
    selected = []
    for j in candidates:
      t = tri[j]
      xz = t[:, [0, 2]]
      projected = Polygon(xz)
      if np.allclose(t[:, 1], high) and poly.buffer(0.006).covers(projected):
        roofs.append(projected)
        selected.append(int(j))
        continue
      if abs(t[:, 1].min() - low) > 0.005 or abs(t[:, 1].max() - high) > 0.005:
        continue
      if poly.boundary.buffer(0.006).covers(LineString(xz)):
        side_area += np.linalg.norm(np.cross(t[1] - t[0], t[2] - t[0])) / 2
        selected.append(int(j))
    if selected:
      records.append(dict(mesh=mi, triangles=selected))
  assert abs(sum(p.area for p in roofs) - poly.area) < 0.005
  assert poly.symmetric_difference(sh.union_all(roofs)).area < 0.005
  assert abs(side_area - poly.length * (high - low)) < 0.01
  retired_lines = []
  if data.get("lines"):
    ps = decode(data["lines"]["positions"], "<u2").reshape(-1, 2, 3) * 0.01
    wanted = {
      tuple(sorted((tuple(np.rint(x * 100).astype(int)) for x in pair)))
      for pair in zip(np.array(old["ring"][:-1]), np.array(old["ring"][1:]))
    }
    for i, points in enumerate(ps):
      if not np.all(abs(points[:, 1] + origin[1] - high - 0.02) < 0.005):
        continue
      key = tuple(
        sorted(tuple(np.rint(x * 100).astype(int)) for x in points[:, [0, 2]])
      )
      if key in wanted:
        retired_lines.append(i)
        wanted.remove(key)
    assert not wanted
  return records, retired_lines


def surface_parts(site):
  groups = defaultdict(dict)
  for s in site["shell"]["surfaces"]:
    if s["kind"] not in ("RoofSurface", "GroundSurface"):
      continue
    rings = s["rings"]
    p = Polygon(
      [(x, z) for x, y, z in rings[0]], [[(x, z) for x, y, z in r] for r in rings[1:]]
    )
    assert p.is_valid
    groups[s["owner"]][s["kind"]] = (p, np.array(rings[0]))
  assert len(groups) == 7
  return groups


def plane(arr):
  return np.linalg.lstsq(
    np.c_[arr[:, 0], arr[:, 2], np.ones(len(arr))], arr[:, 1], rcond=None
  )[0]


def cdt(poly):
  for t in sh.get_parts(sh.constrained_delaunay_triangles(poly)):
    yield list(t.exterior.coords)[:3]


def spans(cells):
  """Greedy same-height rectangles for roof faces and collision."""
  left = dict(cells)
  while left:
    x, z = next(iter(left))
    h = left[x, z]
    end = x + 1
    while left.get((end, z)) == h:
      end += 1
    z1 = z + 1
    while all(left.get((a, z1)) == h for a in range(x, end)):
      z1 += 1
    for zz in range(z, z1):
      for xx in range(x, end):
        del left[xx, zz]
    yield [x * STEP, z * STEP, end * STEP, z1 * STEP, h]


def navigation(poly, site, part, origin, height, extra):
  def ring(pts):
    return [
      [round(x - origin[0], 3), round(z - origin[2], 3)] for x, z in list(pts)[:-1]
    ]

  return dict(
    sourceId=site["shell"]["id"] + ":" + part,
    ring=ring(poly.exterior.coords),
    holes=[ring(h.coords) for h in poly.interiors],
    groundOffset=round(site["base"] - 3, 3),
    minHeight=0,
    height=round(height - site["base"], 3),
    **extra,
  )


def planar_model(site, origin):
  mesh = Mesh()
  oman(mesh, site, False)
  nav = []
  for part, s in surface_parts(site).items():
    poly, arr = s["RoofSurface"]
    foot = s["GroundSurface"][0]
    lookup = {(x, z): y for x, y, z in arr}
    rows = [
      [
        [
          round(x - origin[0], 3),
          round(lookup[x, z] - site["base"], 3),
          round(z - origin[2], 3),
        ]
        for x, z in t
      ]
      for t in cdt(poly)
    ]
    nav.append(
      navigation(
        foot, site, part, origin, arr[:, 1].max() + 0.06, dict(roofTriangles=rows)
      )
    )
  return mesh, nav


def native_model(site, origin, model):
  mesh = Mesh()
  groups = surface_parts(site)
  cell_top = {}
  owners = {}
  for part, s in groups.items():
    poly, arr = s["RoofSurface"]
    sl = plane(arr)
    x0, z0, x1, z1 = poly.bounds
    for x in range(math.floor(x0 / STEP), math.ceil(x1 / STEP)):
      for z in range(math.floor(z0 / STEP), math.ceil(z1 / STEP)):
        xx, zz = (x + 0.5) * STEP, (z + 0.5) * STEP
        if not poly.covers(Point(xx, zz)):
          continue
        y = site["base"] + STEP * round(
          (xx * sl[0] + zz * sl[1] + sl[2] - site["base"]) / STEP
        )
        if y > cell_top.get((x, z), 0):
          cell_top[x, z] = round(y, 2)
          owners[x, z] = part
  nav = []
  for part in groups:
    local = {k: v for k, v in cell_top.items() if owners[k] == part}
    caps = list(spans(local))
    assert caps
    poly = sh.union_all([box(*r[:4]) for r in caps])
    for p in sh.get_parts(poly):
      rows = [
        [
          round(a - origin[0], 3),
          round(b - origin[2], 3),
          round(c - origin[0], 3),
          round(d - origin[2], 3),
          round(y - site["base"], 3),
        ]
        for a, b, c, d, y in caps
        if p.covers(Point((a + c) / 2, (b + d) / 2))
      ]
      nav.append(
        navigation(
          p, site, part, origin, max(local.values()), dict(nativeRoofCaps=rows)
        )
      )
    for x, z, xx, zz, y in caps:
      mesh.face([(x, y, z), (x, y, zz), (xx, y, zz), (xx, y, z)], 0x695C57)
  a, b = np.array(site["front"])
  u = (b - a) / np.linalg.norm(b - a)
  n = np.array([-u[1], u[0]])
  verts = np.array(list(model.vertices))
  fittings = []
  for k in range(0, len(model.indices), 3):
    t = verts[model.indices[k : k + 3]]
    col = int(t[0, 3])
    tri = t[:, :3] * 0.01
    if col in {0x695C57, 0x854D43, 0x74443D}:
      continue
    # Project the photographed elevation onto stepped, outward-facing wall segments.
    depth = (tri[:, [0, 2]] - a) @ n
    pr = Polygon(np.c_[(tri[:, [0, 2]] - a) @ u, tri[:, 1]])
    if pr.area > 0.001 and depth.min() > -0.05 and depth.max() < 1.8:
      fittings.append((pr, min(0.24, max(0.04, 0.025 + depth.mean() * 0.14)), col))
  for (x, z), hi in cell_top.items():
    for sx, sz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
      lo = cell_top.get((x + sx, z + sz), site["base"])
      if lo >= hi:
        continue
      axis = 0 if sx else 2
      other = 2 - axis
      sign = sx or sz
      fixed = ((x if sx else z) + (sign > 0)) * STEP
      v0 = (z if sx else x) * STEP
      v1 = v0 + STEP

      def xyz(v, y, offset):
        p = [0, y, 0]
        p[axis] = fixed + sign * offset
        p[other] = v
        return p

      quad = [xyz(v0, lo, 0), xyz(v1, lo, 0), xyz(v1, hi, 0), xyz(v0, hi, 0)]
      mesh.face(quad, 0x854D43 if sx else 0x74443D)
      mid = np.array(xyz((v0 + v1) / 2, (lo + hi) / 2, 0))[[0, 2]]
      if n[axis // 2] * sign < 0.22 or abs((mid - a) @ n) > 0.7:
        continue
      ext = [(np.array(pt)[[0, 2]] - a) @ u for pt in quad[:2]]
      mask = box(min(ext), lo, max(ext), hi)
      for pr, offset, col in fittings:
        if not mask.intersects(pr):
          continue
        for p in sh.get_parts(mask.intersection(pr)):
          if p.geom_type != "Polygon" or p.area < 0.001:
            continue
          for t in cdt(p):
            mesh.face(
              [
                xyz(
                  a[other // 2]
                  + (h - (fixed - a[axis // 2]) * u[axis // 2]) / u[other // 2],
                  y,
                  offset,
                )
                for h, y in t
              ],
              col,
            )
  return mesh, nav


def packed(mesh, origin):
  a = np.array(list(mesh.vertices))
  coords = a[:, :3] - np.rint(np.array(origin) * 100).astype(int)
  assert coords.min() >= 0 and coords.max() <= 65535
  color = a[:, 3]
  rgb = np.stack((color >> 16, (color >> 8) & 255, color & 255), axis=1) / 255
  rgb = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)

  def enc(array):
    return base64.b64encode(array.tobytes()).decode()

  return dict(
    kind=KIND,
    positionType="u16cm",
    positions=enc(coords.astype("<u2")),
    colors=enc(np.rint(rgb * 255).astype("u1")),
    indices=enc(np.array(mesh.indices, dtype="<u4")),
  )


def fingerprint(mesh):
  value = 2166136261
  for key in ("positions", "colors", "indices"):
    for c in mesh[key].encode("ascii"):
      value = ((value ^ c) * 16777619) & 0xFFFFFFFF
  return value


def build():
  site = json.loads(
    gzip.decompress((GEO / "diplomatische-fassaden-v380.json.gz").read_bytes())
  )["oman"]
  guards = json.loads(
    subprocess.check_output(
      ["bun", str(ROOT / "scripts/prepare_oman_v380.ts")], cwd=ROOT / "src/app"
    )
  )
  for mode in ("drawn", "minecraft"):
    file = PUBLIC / f"{HOST}.{mode}.json.gz"
    raw = json.loads(gzip.decompress(file.read_bytes()))
    [old] = [v for v in raw["nav"]["buildings"] if v["sourceId"] == site["owner"]]
    assert (
      site["match"] == 1
      and old["heightSource"] == "display_fallback:building=yes"
      and old["height"] == (8 if mode == "minecraft" else 9)
    )
    retire, lines = covered_triangles(raw, old)
    origin = raw["origin"]
    mesh, nav = planar_model(site, origin)
    if mode == "minecraft":
      mesh, nav = native_model(site, origin, mesh)
    append = packed(mesh, origin)
    plan = dict(
      **guards[mode],
      origin=origin,
      retire=retire,
      retireLines=lines,
      append=append,
      appendFingerprint=fingerprint(append),
      retireNav=[old],
      appendNav=nav,
      owners=[site["shell"]["id"]],
    )
    key = mode + ":" + HOST
    buffer = json.dumps(
      dict(schemaVersion=1, keys=[key], packets={key: plan}), separators=(",", ":")
    ).encode()
    yield (
      mode,
      gzip.compress(buffer, mtime=0),
      len(mesh.indices) // 3,
      sum(len(r["triangles"]) for r in retire),
      len(lines),
    )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  for mode, buffer, faces, retired, lines in build():
    path = DATA / f"omanExteriorV380-{mode}.json.gz"
    if args.check:
      assert buffer == path.read_bytes()
    else:
      path.write_bytes(buffer)
    print(
      mode,
      faces,
      "new triangles",
      retired,
      "old triangles",
      lines,
      "old lines",
      len(buffer),
      "bytes",
    )
