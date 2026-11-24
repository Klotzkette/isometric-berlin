"""Compile registered facade profiles, measured embassy shells and Clayallee paving into local meshes."""

import base64
import gzip
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = DATA / "diplomaticSitesV380"
if __package__ in (None, ""):
  sys.path.insert(0, str(ROOT))


def load(path):
  return json.loads(gzip.decompress(path.read_bytes()))


class Mesh:
  def __init__(self):
    self.vertices = {}
    self.indices = []

  def face(self, points, color):
    ids = []
    for point in points:
      key = (*[round(v * 100) for v in point], int(color))
      ids.append(self.vertices.setdefault(key, len(self.vertices)))
    for i in range(1, len(ids) - 1):
      tri = [ids[0], ids[i], ids[i + 1]]
      if len(set(tri)) == 3:
        self.indices.extend(tri)

  def packet(self):
    data = np.array(list(self.vertices), dtype=np.int64)
    origin = data[:, :3].min(axis=0)
    pos = data[:, :3] - origin
    assert pos.max() <= 65535 and len(data) < 65536
    c = data[:, 3]
    rgb = np.stack([c >> 16, (c >> 8) & 255, c & 255], axis=1) / 255
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    packed = (
      pos.astype("<u2").tobytes()
      + np.rint(linear * 255).astype("u1").tobytes()
      + np.array(self.indices, dtype="<u2").tobytes()
    )
    return dict(
      o=(origin / 100).tolist(),
      n=len(data),
      i=len(self.indices),
      data=base64.b64encode(gzip.compress(packed, compresslevel=9, mtime=0)).decode(),
    )


def tone(rgb):
  return rgb[0] * 65536 + rgb[1] * 256 + rgb[2]


def profile(wall):
  width, height = wall["width"], wall["height"]
  for band in wall["bands"]:
    cols, rows = band["columns"], band["rows"]
    ax, bx = (v * width for v in band["x"])
    ay, by = (v * height for v in band["y"])
    dx, dy = (bx - ax) / cols, (by - ay) / rows
    for col in range(cols):
      for level in range(rows):
        x = ax + (col + 0.5) * dx
        y = ay + (level + 0.5) * dy
        w, h = dx * band["fillX"] / 2, dy * band["fillY"] / 2
        yield x - w, x + w, y - h, y + h, band["kind"], band["color"]


def front(mesh, site, wall, planes):
  a, b = wall["a"], wall["b"]
  width = math.dist(a, b)
  ux, uz = (b[0] - a[0]) / width, (b[1] - a[1]) / width
  base = site["base"]
  bands = list(profile(wall))
  for x, z, ex, ez, low, high, error in planes:
    length = math.hypot(ex - x, ez - z)
    if length < 0.05:
      continue
    dx, dz = (ex - x) / length, (ez - z) / length
    cosine = dx * ux + dz * uz
    if (
      cosine < 0.40
      or abs(((x + ex) / 2 - a[0]) * uz - ((z + ez) / 2 - a[1]) * ux) > error
    ):
      continue
    start = (x - a[0]) * ux + (z - a[1]) * uz
    end = start + length * cosine

    def quad(left, right, bottom, top, depth, color):
      left_bound, r = max(left, start), min(right, end)
      y0, y1 = max(bottom + base, low), min(top + base, high)
      if left_bound >= r - 0.02 or y0 >= y1 - 0.02:
        return
      mesh.face(
        [
          (
            x + dx * (u - start) / cosine + dz * depth,
            y,
            z + dz * (u - start) / cosine - dx * depth,
          )
          for u, y in [(left_bound, y0), (left_bound, y1), (r, y1), (r, y0)]
        ],
        color,
      )

    if (
      wall["coverage"] >= 0.85
      and sum(b["columns"] for b in wall["bands"] if b["kind"] == "window") >= 3
    ):
      quad(0, width, 0, wall["height"], 0.14, tone(wall["swatch"]))
    for left_bound, r, lo, hi, kind, color in bands:
      if kind == "spandrel":
        quad(left_bound, r, lo, hi, 0.17, color)
      else:
        edge = min(0.10, (hi - lo) * 0.08, (r - left_bound) * 0.09)
        quad(left_bound, r, lo, hi, 0.19, tone(wall["swatch"]))
        quad(left_bound + edge, r - edge, lo + edge, hi - edge, 0.22, color)


def shell_face(mesh, ring, color, offset=(0.0, 0.0, 0.0)):
  # Tessellate in the plane with the largest projection. This retains
  # concave roof outlines and the stepped edges of the measured wall.
  pts = np.array(ring, dtype=float)
  normal = np.sum(np.cross(pts, np.roll(pts, -1, axis=0)), axis=0)
  drop = int(np.abs(normal).argmax())
  plane = np.delete(pts, drop, axis=1)
  lookup = {tuple(uv): p for uv, p in zip(plane, pts)}
  poly = sh.make_valid(Polygon(plane))
  for tri in sh.get_parts(sh.constrained_delaunay_triangles(poly)):
    vertices = [lookup[tuple(uv)] + offset for uv in list(tri.exterior.coords)[:3]]
    mesh.face(vertices, color)


def oman(mesh, site, native):
  a, b = site["front"]
  length = math.dist(a, b)
  dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length

  def pt(u, y, depth):
    return (a[0] + u * dx - depth * dz, y, a[1] + u * dz + depth * dx)

  for surface in site["shell"]["surfaces"]:
    kind = surface["kind"]
    if kind not in ("WallSurface", "RoofSurface"):
      continue
    ring = surface["rings"][0]
    if kind == "RoofSurface":
      shell_face(mesh, ring, 0x695C57, (0, 0.06, 0))
    else:
      arr = np.array(ring)
      vector = arr[0] - arr
      longest = max(vector, key=lambda q: math.hypot(q[0], q[2]))
      w = math.hypot(longest[0], longest[2])
      if w <= 0.05:
        continue
      nx, nz = longest[2] / w, -longest[0] / w
      center = arr.mean(axis=0)
      # Tiny outward separation lets the measured brick replace the retained proxy skin.
      if (
        nx * (center[0] - site["centre"][0]) + nz * (center[2] - site["centre"][1]) < 0
      ):
        nx, nz = -nx, -nz
      color = 0x854D43 if abs(nx) > 0.6 else 0x74443D
      shell_face(mesh, ring, color, (nx * 0.07, 0, nz * 0.07))

  # The photographed street elevation has five lower axes, six narrow upper
  # bays, a projecting red porch and dark curved heads at pavement level.
  def quad(left_bound, r, low, high, d, color):
    mesh.face(
      [pt(left_bound, low, d), pt(left_bound, high, d), pt(r, high, d), pt(r, low, d)],
      color,
    )

  # Flat brick joints remain close in tone to the photographed facing.
  for level in range(1, 47):
    y = 11.6 + level * 0.195
    quad(0.07, length - 0.07, y, y + 0.032, 0.105, 0x804B41)
  for level in range(1, 15):
    y = 22.31 + level * 0.195
    quad(3.6, 13.32, y, y + 0.026, 0.105, 0x824D43)
  for j in range(5):
    u = (j + 0.53) * length / 5
    for lo, hi in [(12.05, 15.5), (15.95, 19.8)]:
      quad(u - 0.62, u + 0.62, lo, hi, 0.19, 0x413E37)
      quad(u - 0.49, u + 0.49, lo + 0.10, hi - 0.1, 0.22, 0x617170)
      quad(u - 0.06, u + 0.06, lo + 0.10, hi - 0.1, 0.24, 0x534334)
    quad(u - 0.73, u + 0.73, 15.62, 15.8, 0.25, 0x5B4D44)
    mesh.face(
      [
        pt(u - 0.64, 15.25, 0.25),
        pt(u - 0.64, 15.72, 0.25),
        pt(u + 0.64, 15.72, 0.25),
        pt(u + 0.64, 15.25, 0.25),
        pt(u, 15.50, 0.25),
      ],
      0x443E37,
    )
  for j in range(6):
    u = 3.9 + j * 1.78
    quad(u - 0.35, u + 0.35, 22.28, 24.56, 0.19, 0x393D39)
    quad(u - 0.21, u + 0.21, 22.35, 24.38, 0.22, 0x65736E)
  for u in (4.9, 8.4):
    quad(u - 0.23, u + 0.23, 11.68, 16.32, 1.38, 0x79483E)
    mesh.face(
      [
        pt(u + 0.23, 11.68, 1.38),
        pt(u + 0.23, 16.32, 1.38),
        pt(u + 0.23, 16.32, 0.06),
        pt(u + 0.23, 11.68, 0.06),
      ],
      0x69433A,
    )
  quad(4.55, 8.75, 16.16, 16.64, 1.49, 0x75463E)
  mesh.face(
    [
      pt(4.55, 16.64, 1.49),
      pt(8.75, 16.64, 1.49),
      pt(8.75, 16.64, 0.05),
      pt(4.55, 16.64, 0.05),
    ],
    0x675B55,
  )


def bake():
  records = load(GEO / "diplomatische-fassaden-v380.json.gz")
  meshes = defaultdict(Mesh)
  bounds = defaultdict(list)
  views = {}
  from scripts.facade_preview_v380 import PreviewRoofline, preview_camera

  roofline = PreviewRoofline(ROOT / "src/app/public/mesh", records["walls"])

  def region(x, z):
    return f"{math.floor(x / 512)}_{math.floor(z / 512)}"

  for site in records["walls"]:
    for w in site["walls"]:
      x, z = (w["a"][j] * 0.5 + w["b"][j] * 0.5 for j in (0, 1))
      key = region(x, z)
      planes = [[*w["a"], *w["b"], site["base"], site["base"] + site["height"], 0.05]]
      front(meshes[key, "drawn"], site, w, planes)
      front(meshes[key, "native"], site, w, site["nativePlanes"])
      bounds[key].extend([w["a"], w["b"]])
      weight, cam = preview_camera(site, w, roofline)
      if weight > views.get(site["name"], (-1,))[0]:
        views[site["name"]] = (weight, key, cam)
  om = records["oman"]
  key = region(*om["centre"])
  # The seven-part Omani building replaces its proxy in the original resident tile.
  views["Clayallee 82 – Botschaft des Sultanats Oman"] = (
    1,
    key,
    dict(position=[-6654, 31, 6175], target=[-6624, 17.4, 6198], fov=44),
  )
  # Clayallee surface triangles are clipped to the original topography in
  # each mode, and packed using the same regional format as the façades.
  from scripts.clayallee_surfaces_v380 import add_clayallee

  add_clayallee(meshes, bounds)
  views["Clayallee – US-Konsulat in Dahlem"] = (
    1,
    region(-6908, 7268),
    dict(position=[-6949, 51, 7292], target=[-6908, 17, 7268], fov=48),
  )
  OUT.mkdir(exist_ok=True)
  hosts = []
  for key, points in sorted(bounds.items()):
    variants = {
      mode: json.dumps(meshes[key, mode].packet(), separators=(",", ":")) + "\n"
      for mode in ["drawn", "native"]
      if meshes[key, mode].indices
    }
    if not variants:
      continue
    assert len(variants) == 2, f"Both styles need geometry in {key}"
    shared = variants["drawn"] == variants["native"]
    files = {"shared": variants["drawn"]} if shared else variants
    for variant in ("drawn", "native", "shared"):
      path = OUT / f"{variant}_{key}.json"
      if variant in files:
        path.write_text(files[variant])
      elif path.exists():
        path.unlink()
    x, z = zip(*points)
    host = dict(
      id="diplomatic380-" + key,
      bounds=[
        math.floor(min(x)) - 2,
        math.floor(min(z)) - 2,
        math.ceil(max(x)) + 2,
        math.ceil(max(z)) + 2,
      ],
    )
    if shared:
      host["shared"] = True
    hosts.append(host)
  (DATA / "diplomaticHostsV380.json").write_text(
    json.dumps(hosts, separators=(",", ":")) + "\n"
  )
  cameras = {
    name: dict(host="diplomatic380-" + key, **cam)
    for name, (_, key, cam) in sorted(views.items())
  }
  (DATA / "diplomaticViewsV380.json").write_text(
    json.dumps(cameras, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(len(hosts), "regions,", len(cameras), "public views")


if __name__ == "__main__":
  bake()
