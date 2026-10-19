"""Retain exact native exterior support planes for three v246 facade skins."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
ROSA = ROOT / "src/app/public/mesh/surrounding-berlin-v159/8_2.minecraft.json.gz"
SOURCE = ROOT / "geo_data/regierungsviertel/civic-v246-source.json"
OUT = ROOT / "src/app/src/data/civicV246NativeFaces.json"


def build():
  source = json.loads(SOURCE.read_text())
  payload = json.loads(CORE.read_text())
  sites = {site["name"]: site for site in source["sites"]}
  result = {}
  # axis, plane, along-min, along-max, outward sign, bottom, top.
  for name, key in [("GreenHQ", "green"), ("Willy-Brandt-Haus", "spd")]:
    polygon = Polygon(sites[name]["ring"])
    bounds = polygon.buffer(8).bounds
    columns = {}
    for zi, runs in enumerate(payload["building_rows"]):
      z = (zi + payload["grid"]["min_z_idx"]) * 4
      if not bounds[1] <= z <= bounds[3]:
        continue
      for offset, count, low, high, _ in runs:
        for xi in range(offset, offset + count):
          x = (xi + payload["grid"]["min_x_idx"]) * 4
          if bounds[0] <= x <= bounds[2]:
            columns.setdefault((x, z), []).append((low / 10, high / 10))
    faces = []
    retained = []
    for (x, z), intervals in columns.items():
      if polygon.intersection(box(x, z, x + 4, z + 4)).area <= 0.01:
        continue
      for low, high in intervals:
        retained.append([x, z, low, high])
        for axis, plane, start, end, sign, neighbour in [
          (0, x, z, z + 4, -1, (x - 4, z)),
          (0, x + 4, z, z + 4, 1, (x + 4, z)),
          (2, z, x, x + 4, -1, (x, z - 4)),
          (2, z + 4, x, x + 4, 1, (x, z + 4)),
        ]:
          visible = [(low, high)]
          for nlow, nhigh in columns.get(neighbour, []):
            next_visible = []
            for lo, hi in visible:
              if nlow > lo:
                next_visible.append((lo, min(hi, nlow)))
              if nhigh < hi:
                next_visible.append((max(lo, nhigh), hi))
            visible = next_visible
          for lo, hi in visible:
            if hi - lo > 0.01:
              faces.append([axis, plane, start, end, sign, lo, hi])
    result[key] = {"faces": sorted(faces), "columns": sorted(retained)}
  packet = json.loads(gzip.decompress(ROSA.read_bytes()))
  polygon = Polygon(sites["Rosa-Luxemburg-Stiftung"]["ring"])
  faces = set()
  for mesh in packet["meshes"]:
    p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    ) / 100 + np.asarray(packet["origin"])
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    for tri in p[indices]:
      low, high = tri[:, 1].min(), tri[:, 1].max()
      # Existing Rosa tower has exact native floor/roof datums 3 / 39 m.
      if abs(low - 3) > 1e-5 or abs(high - 39) > 1e-5:
        continue
      normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
      if abs(normal[1]) > 1e-5:
        continue
      axis = 0 if abs(normal[0]) > 1e-5 else 2
      along = 2 if axis == 0 else 0
      if abs(normal[axis]) < 1e-5 or np.ptp(tri[:, axis]) > 1e-5:
        continue
      plane = float(tri[0, axis])
      start, end = float(tri[:, along].min()), float(tri[:, along].max())
      a, b = (
        ([plane, start], [plane, end]) if axis == 0 else ([start, plane], [end, plane])
      )
      if not polygon.buffer(2).covers(LineString([a, b])):
        continue
      faces.add((axis, plane, start, end, int(np.sign(normal[axis])), 3, 39))
  assert faces and len(faces) < 150
  result["rosa"] = {"faces": [list(face) for face in sorted(faces)]}
  return {
    "schemaVersion": 1,
    "description": "Exact exposed original native planes; facade fittings are projected only onto these planes. No replacement body, roof, navigation, or budget.",
    "sources": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [CORE, ROSA, SOURCE]
    },
    **result,
  }


if __name__ == "__main__":
  result = build()
  OUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(
    OUT.name,
    OUT.stat().st_size,
    {k: len(result[k]["faces"]) for k in ("green", "spd", "rosa")},
  )
