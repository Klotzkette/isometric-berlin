"""Bounded source receipts for four Rosenthaler stair mouths, no packet mutation."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
# Exact linear RGB bytes in retained ground/path/road and v168 pavement sheets.
PALETTES = {
  "city": {(125, 131, 103), (39, 41, 39), (149, 131, 92)},
  "scheunenviertel-v168": {(118, 111, 93), (168, 159, 133)},
}


def build():
  stairs = json.loads((DATA / "rosenthalerV228.json").read_text())["stairs"]
  mouths = []
  for stair in stairs:
    top, bottom = np.array(stair["top"]), np.array(stair["bottom"])
    direction = bottom - top
    direction /= np.linalg.norm(direction)
    normal = np.array([-direction[1], direction[0]]) * stair["width"] / 2
    mouths.append(
      Polygon([top - normal, bottom - normal, bottom + normal, top + normal])
    )
  mouth = unary_union(mouths)
  # Cover every cell of the independent native quarter-metre opening too.
  pixels = []
  for ring in mouths:
    x0, z0, x1, z1 = ring.bounds
    for ix in range(int(np.floor(x0 * 4)), int(np.ceil(x1 * 4))):
      for iz in range(int(np.floor(z0 * 4)), int(np.ceil(z1 * 4))):
        cell = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
        if ring.intersection(cell).area > 1e-9:
          pixels.append(cell)
  native_mouth = unary_union(pixels)
  result = {}
  for tile in ("3_-3", "4_-3"):
    for mode in ("drawn", "minecraft"):
      path = PACKETS / f"{tile}.{mode}.json.gz"
      raw = path.read_bytes()
      packet = json.loads(gzip.decompress(raw))
      origin = np.array(packet["origin"])
      aperture = native_mouth if mode == "minecraft" else mouth
      buildings = unary_union(
        [
          translate(
            make_valid(Polygon(b["ring"], b["holes"])), xoff=origin[0], yoff=origin[2]
          )
          for b in packet["nav"]["buildings"]
        ]
      )
      # Navigation rings are local metres, translated by the retained origin.
      assert aperture.intersection(buildings).area < 1e-6
      triangles, counts = [], {}
      vertex_offset = index_offset = 0
      for part in packet["meshes"]:
        points = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(
          -1, 3
        )
        colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
        indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
        if part["kind"] in PALETTES:
          x0, z0, x1, z1 = aperture.bounds
          world = points * 0.01 + origin
          faces = world[indices]
          eligible = np.flatnonzero(
            (faces[:, :, 0].max(1) >= x0)
            & (faces[:, :, 0].min(1) <= x1)
            & (faces[:, :, 2].max(1) >= z0)
            & (faces[:, :, 2].min(1) <= z1)
            & (faces[:, :, 1].max(1) < 8)
          )
          for number in eligible:
            ids = indices[number]
            triangle = Polygon(world[ids][:, [0, 2]])
            if triangle.area < 1e-9 or triangle.intersection(aperture).area < 1e-9:
              continue
            rgb = colors[ids]
            assert all(tuple(map(int, c)) in PALETTES[part["kind"]] for c in rgb)
            assert world[ids][:, 1].min() > 6
            triangles.append(
              [
                index_offset + int(number) * 3,
                *map(int, ids + vertex_offset),
                *map(int, points[ids].flatten()),
                *map(int, rgb.flatten()),
              ]
            )
            counts[part["kind"]] = counts.get(part["kind"], 0) + 1
        vertex_offset += len(points)
        index_offset += indices.size
      result[f"{tile}.{mode}"] = dict(
        sourceSha256=hashlib.sha256(raw).hexdigest(),
        origin=packet["origin"],
        vertexCount=vertex_offset,
        indexCount=index_offset,
        counts=counts,
        triangles=triangles,
      )
  return result


if __name__ == "__main__":
  path = DATA / "rosenthalerV228Ground.json"
  payload = build()
  path.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    path.relative_to(ROOT),
    path.stat().st_size,
    {k: v["counts"] for k, v in payload.items()},
  )
