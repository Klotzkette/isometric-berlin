"""Build small, site-local public exterior details from the retained Berlin shells.

The Spanish primary roof is triangulated exactly as in the visible v164 model.
Vertical facade trims use the approved outward frames. Native trims are fitted
to the original exposed, axis-aligned shell triangles, never to a rotated box.
"""

import argparse
import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
OUT = DATA / "embassySitesV380"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PROFILE = ROOT / "geo_data/regierungsviertel/embassy-sites-v380-survey.json"
ORIGINS = {"es": [-1782, 0, 911], "kp": [939, 0, 833], "cn": [3080, 0, 656]}


class Packet:
  def __init__(self, site):
    self.origin = np.asarray(ORIGINS[site])
    self.vertices = {}
    self.indices = []
    self.palette = {}

  def face(self, pts, tint):
    col = self.palette.setdefault(tint, len(self.palette))
    vertices = []
    for pt in pts:
      coord = tuple(np.rint((pt - self.origin) * 100).astype(int).tolist())
      key = (*coord, col)
      vertices.append(self.vertices.setdefault(key, len(self.vertices)))
    for i in range(1, len(vertices) - 1):
      tri = [vertices[0], vertices[i], vertices[i + 1]]
      if len(set(tri)) == 3:
        self.indices.extend(tri)

  def data(self):
    def deltas(values):
      words = np.asarray(values, dtype="<u2").ravel()
      changes = np.diff(words, prepend=np.zeros(1, dtype="<u2"))
      return np.r_[changes.astype("u1"), (changes >> 8).astype("u1")].tobytes()

    pts = list(self.vertices)
    assert 0 < len(pts) < 65536 and len(self.palette) < 256
    assert max(abs(i) for p in pts for i in p[:3]) < 32768
    xyz = np.asarray([p[:3] for p in pts], dtype="<i2")
    stream = deltas(xyz.T) + bytes(p[3] for p in pts) + deltas(self.indices)
    return dict(
      origin=self.origin.tolist(),
      n=len(pts),
      faces=len(self.indices) // 3,
      palette=list(self.palette),
      mesh=base64.b64encode(gzip.compress(stream, compresslevel=9, mtime=0)).decode(),
    )


def parts(geom):
  return [p for p in sh.get_parts(geom) if p.geom_type == "Polygon" and p.area > 0.0002]


def emit_clipped(packet, geom, transform, tint):
  for poly in parts(geom):
    for tri in sh.get_parts(sh.constrained_delaunay_triangles(poly)):
      packet.face([transform(*p) for p in list(tri.exterior.coords)[:3]], tint)


def spanish(drawn, native, evidence):
  source = json.loads((DATA / "spanishEmbassyV164Source.json").read_bytes())
  # The single large principal part contains both pitched wings and the chamfered crown.
  roofs = []
  for surface in source["surfaces"]:
    if surface["partId"] != evidence["primaryPart"] or surface["kind"] != "RoofSurface":
      continue
    for tri in surface["triangles"]:
      arr = np.array(tri)
      poly = Polygon(arr[:, [0, 2]])
      if poly.area < 0.01:
        continue
      slope = np.linalg.solve(np.c_[arr[:, 0], arr[:, 2], np.ones(3)], arr[:, 1])
      roofs.append((poly, slope))
      # Slate / zinc covering read from the current orthophoto, gently modulated by plane orientation.
      exposure = float(np.clip(-slope[0] * 0.7 + slope[1] * 0.5, -0.4, 0.4))
      light = round(exposure * 22)
      tint = (89 + light) * 65536 + (98 + light) * 256 + (106 + light)
      drawn.face(arr + [0, 0.09, 0], tint)
  native_roof = {}
  for x, y, z, _ in source["nativeBlocks"]:
    k = (int(x), int(z))
    native_roof[k] = max(native_roof.get(k, -100.0), y + 1)
  # Native roof faces use the exposed tops of the Spanish two-metre shell only.
  for (x, z), top in native_roof.items():
    eligible = [(p, s) for p, s in roofs if p.covers(Point(x, z))]
    if (
      not eligible
      or abs(top - max(x * s[0] + z * s[1] + s[2] for _, s in eligible)) > 2.3
    ):
      continue
    native.face(
      [
        (x - 1, top + 0.05, z - 1),
        (x - 1, top + 0.05, z + 1),
        (x + 1, top + 0.05, z + 1),
        (x + 1, top + 0.05, z - 1),
      ],
      0x59636D,
    )
  accepted = 0
  for x, z, bearing, width, length in evidence["rooflights"]:
    unit = np.array([math.cos(bearing), math.sin(bearing)])
    side = np.array([-unit[1], unit[0]])
    for margin, lift, tint in [(0.0, 0.17, 0xB3BAB9), (0.12, 0.20, 0x7197A7)]:
      center = np.array([x, z])
      pts = [
        center + i * (width / 2 - margin) * unit + j * (length / 2 - margin) * side
        for i, j in ((-1, -1), (-1, 1), (1, 1), (1, -1))
      ]
      pane = Polygon(pts)
      covered = 0.0
      for poly, slope in roofs:
        clipped = poly.intersection(pane)
        covered += clipped.area
        emit_clipped(
          drawn,
          clipped,
          lambda a, b: (a, a * slope[0] + b * slope[1] + slope[2] + lift, b),
          tint,
        )
      if covered < pane.area * 0.86:
        raise ValueError(f"Unregistered Spanish rooflight at {x}, {z}")
      # A short cardinal rooflight can cross the height break of a stepped roof.
      for cx in range(
        math.floor((x - 2) / 2) * 2 + 1, math.floor((x + 2) / 2) * 2 + 2, 2
      ):
        for cz in range(
          math.floor((z - 2) / 2) * 2 + 1, math.floor((z + 2) / 2) * 2 + 2, 2
        ):
          top = native_roof.get((cx, cz))
          if top is None:
            continue
          w, h = (width / 2 - margin), (length / 2 - margin)
          x0, z0, x1, z1 = (
            max(cx - 1, x - w),
            max(cz - 1, z - h),
            min(cx + 1, x + w),
            min(cz + 1, z + h),
          )
          if x1 - x0 > 0.04 and z1 - z0 > 0.04:
            native.face(
              [
                (x0, top + lift, z0),
                (x0, top + lift, z1),
                (x1, top + lift, z1),
                (x1, top + lift, z0),
              ],
              tint,
            )
    accepted += 1
  assert accepted == len(evidence["rooflights"])


def native_exteriors(code):
  region = (897, 812, 981, 852) if code == "kp" else (3060, 624, 3118, 697)
  files = (
    [DATA / "altMitteV169Native" / f"packet-{i:03d}.json" for i in range(45, 49)]
    if code == "kp"
    else [PUBLIC / f"{i}_1.minecraft.json.gz" for i in (5, 6)]
  )
  faces = []
  seen = set()
  for file in files:
    buf = file.read_bytes()
    d = json.loads(gzip.decompress(buf) if file.suffix == ".gz" else buf)
    for mesh in d["meshes"]:
      if mesh["kind"] != "alt-mitte-v169":
        continue
      pos = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) * 0.01
        + d["origin"]
      )
      idx = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      tri = pos[idx]
      mid = tri.mean(1)
      ok = (
        (mid[:, 0] >= region[0] - 3)
        & (mid[:, 2] >= region[1] - 3)
        & (mid[:, 0] <= region[2] + 3)
        & (mid[:, 2] <= region[3] + 3)
      )
      for t in tri[ok]:
        n = np.cross(t[1] - t[0], t[2] - t[0])
        axis = int(np.argmax(np.abs(n)))
        if (
          axis == 1 or abs(n[axis]) < 0.01 or np.count_nonzero(np.abs(n) > 0.0001) != 1
        ):
          continue
        other = 2 - axis
        if np.ptp(t[:, other]) < 1.99 or np.ptp(t[:, 1]) < 1.99:
          continue
        key = tuple(sorted(tuple(p) for p in t))
        if key in seen:
          continue
        seen.add(key)
        faces.append((axis, other, np.sign(n[axis]), t, t.mean(0)))
  assert faces
  return faces


class Front:
  def __init__(self, run, drawn, native, faces):
    self.a = np.array(run["start"])
    b = np.array(run["end"])
    self.n = np.array(run["outward"])
    self.length = np.linalg.norm(b - self.a)
    self.d = (b - self.a) / self.length
    self.wall = Polygon(run["wallRingsLocal"][0], run["wallRingsLocal"][1:]).buffer(0)
    self.drawn, self.native = drawn, native
    self.cards = []
    for axis, other, sign, triangle, center in faces:
      rel = center[[0, 2]] - self.a
      if (
        self.n[axis // 2] * sign < 0.25
        or abs(rel @ self.n) > 2.7
        or not -2.1 <= rel @ self.d <= self.length + 2.1
      ):
        continue
      # Each native face is expressed in the same u,y frame as the official wall.
      proj = (triangle[:, [0, 2]] - self.a) @ self.d
      mask = Polygon(np.c_[proj, triangle[:, 1]])
      if mask.area < 0.0001:
        continue
      self.cards.append((mask, axis, other, sign, triangle[0, axis]))

  def patch(self, u0, lo, u1, hi, color, outside=0.27, bottom_out=None):
    shape = self.wall.intersection(box(u0, lo, u1, hi))
    if shape.area <= 0.0003:
      return

    def drawn_at(u, y):
      depth = (
        outside
        if bottom_out is None
        else outside + (bottom_out - outside) * (hi - y) / (hi - lo)
      )
      x, z = self.a + self.d * u + self.n * depth
      return (x, y, z)

    emit_clipped(self.drawn, shape, drawn_at, color)
    for mask, axis, other, sign, fixed in self.cards:
      cut = mask.intersection(shape)
      if cut.area < 0.003:
        continue

      def card_at(u, y):
        point = [0.0, y, 0.0]
        point[other] = (
          self.a[other // 2]
          + (u - (fixed - self.a[axis // 2]) * self.d[axis // 2]) / self.d[other // 2]
        )
        point[axis] = fixed + sign * (0.035 + outside * 0.17)
        return point

      emit_clipped(self.native, cut, card_at, color)


def facades(code, drawn, native):
  runs = json.loads((DATA / "mitteEmbassiesV288Profile.json").read_bytes())["runs"]
  native_faces = native_exteriors(code)
  for run in runs:
    style = run["style"]
    portal = run["partId"] == "DEBE3DsXAMuD6zDV"
    towers = run["partId"] in ("DEBE3DcWU0k2Rhqv", "DEBE3DXvMqFajkhR")
    if (
      code == "cn"
      and style not in ("china-facet", "china-front-stack")
      and not (portal or towers)
    ):
      continue
    if code == "kp" and (style != "dprk" or run["topY"] > 28):
      continue
    front = Front(run, drawn, native, native_faces)
    w, top = front.length, run["topY"]
    if portal:
      # The photographed entrance pavilion has a continuous reflective upper face.
      # Model fitted panes in quiet sky / masonry tones, with the public doors below.
      cols = max(1, round(w / 2.55))
      low = 7.8
      for row in range(5):
        for col in range(cols):
          y = low + (top - low) * row / 5
          next_y = low + (top - low) * (row + 1) / 5
          pale = [0x6C8795, 0x829CA6, 0x91ABB6, 0xA0B9C4, 0xACC4CC][row]
          tint = pale + (0x040404 if (col + row) % 3 == 0 else 0)
          front.patch(w * col / cols, y, w * (col + 1) / cols, next_y, tint, 0.47)
      for col in range(cols + 1):
        center = w * col / cols
        front.patch(
          max(0, center - 0.045), low, min(w, center + 0.045), top, 0x596E78, 0.52
        )
      for y in np.linspace(low, top, 6):
        front.patch(0, max(low, y - 0.045), w, min(top, y + 0.045), 0x536B75, 0.54)
    elif towers:
      # Upper wings flanking the central glazing are clad in broad silver panels.
      low = 20.2
      for y in np.arange(low, top, 0.98):
        front.patch(0, y, w, min(top, y + 0.055), 0x969FA2, 0.32)
      cols = max(1, round(w / 2.4))
      for col in range(1, cols):
        center = w * col / cols
        front.patch(center - 0.029, low, center + 0.029, top - 0.2, 0x8E989D, 0.34)
    elif style == "china-facet":
      front.patch(0, top - 5.1, w, top - 0.10, 0xAFB8C0, 0.10, 0.73)
      # Standing seams read in the reference as narrow parallel upright folds.
      count = max(1, round(w / 0.61))
      for i in range(count):
        u = (i + 0.5) * w / count
        front.patch(u - 0.027, top - 5.1, u + 0.027, top - 0.10, 0x798890, 0.13, 0.76)
      front.patch(0, top - 5.21, w, top - 5.05, 0xE1E4E3, 0.77)
    elif style == "china-front-stack":
      front.patch(0, top - 5.9, w, top - 2.12, 0x697782, 0.30)
      for y in np.arange(top - 5.81, top - 2.14, 0.25):
        front.patch(0, y, w, y + 0.075, 0xA7AFB2, 0.38)
      front.patch(0, top - 2.12, w, top - 1.98, 0xD7DBDB, 0.39)
    else:
      # The earlier fitting only supplied reveals on several unglazed source walls.
      # Restrict dark panes to the originally accepted axes and inside the reveals.
      for idx, (u, y) in enumerate(run["apertures"]):
        pane = (0x5F7077, 0x63757B, 0x718087, 0x66777C)[idx % 4]
        front.patch(u - 0.626, y - 0.87, u + 0.626, y + 0.87, pane, 0.245)
        front.patch(u - 0.035, y - 0.85, u + 0.035, y + 0.85, 0xA6B0AF, 0.27)
      # Courses sit in the clear spandrel between the existing source-registered windows.
      for y in [12.32, 15.57, 18.82, 22.07, 25.32]:
        front.patch(0, y - 0.09, w, y + 0.07, 0x89908C, 0.36)
        front.patch(0, y + 0.07, w, y + 0.18, 0xD2D1C8, 0.39)
      front.patch(0, 8.71, w, 9.34, 0x5A6262, 0.40)
      front.patch(0, 9.34, w, 9.47, 0xA6AAA2, 0.43)
      front.patch(0, top - 0.22, w, top - 0.06, 0x777E7C, 0.32)


def build():
  evidence = json.loads(PROFILE.read_bytes())
  packets = {}
  for site in ORIGINS:
    drawn, native = Packet(site), Packet(site)
    if site == "es":
      spanish(drawn, native, evidence["es"])
    else:
      facades(site, drawn, native)
    for style, packet in (("drawn", drawn), ("native", native)):
      packets[site + "-" + style] = (
        json.dumps(packet.data(), separators=(",", ":")) + "\n"
      )
  return packets


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  OUT.mkdir(exist_ok=True)
  for tag, payload in build().items():
    file = OUT / (tag + ".json")
    if args.check:
      assert file.read_text() == payload, tag
    else:
      file.write_text(payload)
    print(tag, len(payload), flush=True)
