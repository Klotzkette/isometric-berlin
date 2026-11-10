#!/usr/bin/env python3
"""Build packet-local Katzengrabensteg fittings over the retained walking deck."""
import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = ROOT / "geo_data/regierungsviertel/network-fidelity-v326-source.json.gz"
OUTPUT = ROOT / "src/app/src/data/katzengrabenV334.json"
SOURCE_ID = "way/24522970"
PIER_CHAINAGE = 59.63
DECK_Y = 3.12
DECK_HALF_WIDTH = 1.5
PALETTE = {
  "deck": (160, 135, 96),
  "girder": (80, 107, 129),
  "rail": (107, 128, 142),
  "pylon": (141, 161, 172),
  "stay": (121, 142, 151),
  "stone": (155, 151, 136),
}
CORNERS = [(i, j, k) for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)]
FACES = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
         (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]


def mesh_fingerprint(part):
  value = 2166136261
  for char in part["positions"] + part["colors"] + part["indices"]:
    value = (value ^ ord(char)) * 16777619 & 0xFFFFFFFF
  return value


def clip(poly, z, sign):
  out = []
  for a, b in zip(poly, poly[1:] + poly[:1]):
    inside_a, inside_b = sign * (a[2] - z) >= 0, sign * (b[2] - z) >= 0
    if inside_a:
      out.append(a)
    if inside_a != inside_b:
      out.append(a + (b - a) * ((z - a[2]) / (b[2] - a[2])))
  return out


class Mesh:
  def __init__(self, origin):
    self.origin = np.array(origin)
    self.positions = []
    self.colors = []
    self.indices = []
    self.vertices = {}

  def cuboid(self, center, axes, color):
    vertices = [center + sum((s * axis for s, axis in zip(signs, axes))) for signs in CORNERS]
    for face in FACES:
      poly = clip([vertices[i] for i in face], self.origin[2], 1)
      poly = clip(poly, self.origin[2] + 512, -1)
      if len(poly) < 3:
        continue
      packed = [tuple(np.rint((p - self.origin) * 100).astype(int)) for p in poly]
      if len(set(packed)) < 3:
        continue
      indices = []
      for point in packed:
        key = (point, color)
        if key not in self.vertices:
          self.vertices[key] = len(self.positions)
          self.positions.append(point)
          self.colors.append(PALETTE[color])
        indices.append(self.vertices[key])
      for i in range(1, len(indices) - 1):
        face_indices = (indices[0], indices[i], indices[i + 1])
        if len(set(face_indices)) == 3:
          self.indices.extend(face_indices)

  def member(self, a, b, width, depth, color, native):
    delta = b - a
    length = float(np.linalg.norm(delta))
    if native:
      steps = math.ceil(length / max(.46, width))
      for i in range(steps):
        point = a + delta * ((i + .5) / steps)
        extent = np.abs(delta) / steps + np.array([width, depth, width])
        self.cuboid(point, np.diag(extent / 2), color)
      return
    axis = delta / length
    side = np.cross(axis, (0, 1, 0))
    if np.linalg.norm(side) < 1e-9:
      side = np.array([1., 0., 0.])
    side /= np.linalg.norm(side)
    self.cuboid((a + b) / 2, [axis * length / 2, side * width / 2,
                           np.cross(axis, side) * depth / 2], color)

  def pack(self):
    assert self.positions and min(min(p) for p in self.positions) >= 0
    assert max(max(p) for p in self.positions) < 65536
    def encoded(values, dtype):
      return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode("ascii")
    return {
      "kind": "katzengrabensteg-v334", "positionType": "u16cm",
      "positions": encoded(self.positions, "<u2"),
      "colors": encoded(self.colors, "u1"), "indices": encoded(self.indices, "<u4"),
    }


def fittings(mesh, course, native):
  (ax, az), (bx, bz) = course
  length = math.hypot(bx - ax, bz - az)
  ux, uz = (bx - ax) / length, (bz - az) / length

  def pt(s, side, height):
    return np.array([ax + ux * s - uz * side, height, az + uz * s + ux * side])

  def bar(s, t, width, depth, color):
    mesh.member(pt(*s), pt(*t), width, depth, color, native)

  # Span endpoints align to the existing walkway. The visible steel box
  # stays below the retained ground plane. The timber cap is 2 cm above it.
  for side in (-1, 1):
    offset = DECK_HALF_WIDTH * side
    bar((2.5, offset, DECK_Y - .38), (length - 2.5, offset, DECK_Y - .38), .18, .78, "girder")
    for y in (DECK_Y + .39, DECK_Y + .73, DECK_Y + 1.04):
      bar((1, offset, y), (length - 1, offset, y), .055 if not native else .1,
          .055 if not native else .1, "rail")
    for s in np.arange(1, length - 1, 2.15):
      bar((s, offset, DECK_Y - .1), (s, offset, DECK_Y + 1.06), .08, .08, "rail")
    for s in np.arange(3, length - 3, 3.45):
      bar((s, offset * 1.04, DECK_Y - .76), (s, offset * 1.04, DECK_Y - .08), .085, .085, "girder")
  if not native:
    bar((1, 0, DECK_Y + .01), (length - 1, 0, DECK_Y + .01), 2.82, .02, "deck")
  # The steel A stands on the Baumgarteninsel. The apex chainage follows the
  # 2026 bDOM point on the centreline. The 26.85 m overall pylon dimension is
  # reported from the base, which sits below the bridge's walking surface.
  base_y, apex_y = .8, 27.65
  for side in (-1, 1):
    bar((PIER_CHAINAGE, 2.55 * side, base_y), (PIER_CHAINAGE, .28 * side, apex_y), .67, .75, "pylon")
    bar((PIER_CHAINAGE, 2.55 * side, base_y - .5), (PIER_CHAINAGE, 2.55 * side, base_y + .7), 1.8, 1.8, "stone")
    for i, anchor in enumerate((7.5, 26.5, 45., 74., 91.5, 107.)):
      bar((PIER_CHAINAGE, .25 * side, apex_y - .8 - (i % 3) * .38),
          (anchor, 1.56 * side, DECK_Y - .52), .063 if not native else .14,
          .063 if not native else .14, "stay")
  bar((PIER_CHAINAGE, -.34, apex_y - .3), (PIER_CHAINAGE, .34, apex_y - .3), .68, .66, "pylon")


def main():
  with gzip.open(SOURCE) as f:
    source = next(r for r in json.load(f)["records"] if r["key"] == SOURCE_ID)
  assert source["tags"]["bridge:structure"] == "cable-stayed"
  course = source["geometry"]["coordinates"]
  packets = {}
  for id in ("outer187-27_16", "outer187-27_15"):
    for mode in ("drawn", "minecraft"):
      with gzip.open(PACKETS / f"{id}.{mode}.json.gz") as f:
        packet = json.load(f)
      mesh = Mesh(packet["origin"])
      fittings(mesh, course, mode == "minecraft")
      packets[f"{mode}:{id}"] = {
        "origin": packet["origin"],
        "records": [{"mesh": 0, "fingerprint": mesh_fingerprint(packet["meshes"][0]), "triangles": []}],
        "lineFingerprint": None, "segments": [], "replacement": mesh.pack(),
        "navigationRecords": [], "navigationSolids": [],
      }
  OUTPUT.write_text(json.dumps({"schema": 1, "keys": list(packets), "packets": packets}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
