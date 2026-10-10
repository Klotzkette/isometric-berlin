"""Prepare the additive full-Berlin flood off-line, retaining the original water."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OUTPUT = ROOT / "src/app/public/mesh/regierungsviertel/flood-extension-v205.bin.gz"
SCOPE_NAMES = (
  "ringCityScopeV182.json",
  "cityCoverageScopeV183.json",
  "outskirtsScopeV187.json",
  "northCityScopeV190.json",
  "namedScopeV194.json",
  "namedScopeV198.json",
  "eastCityScopeV200.json",
  "regionalScopeV200.json",
)


def polygons(data: dict) -> list[Polygon]:
  """Read the existing exact world-space polygon rings and holes."""
  items = ([data["core"]] if "core" in data else []) + data.get("footprint", [])
  return [Polygon(p["ring"], p["holes"]) for p in items]


def extent():
  """Official complete state area plus already approved presentation footprints."""
  source = json.loads(
    gzip.decompress((GEO / "berlin-boundaries-v200-source.json.gz").read_bytes())
  )
  state = unary_union([shape(f["geometry"]) for f in source["state"]["features"]])
  state = transform(
    lambda x, y, z=None: (np.asarray(x) - 389500, 5820000 - np.asarray(y)), state
  )
  original = unary_union(
    polygons(json.loads((DATA / "surroundingCityScope.json").read_text()))
  )
  scopes = [state, original]
  for name in SCOPE_NAMES:
    scopes.extend(polygons(json.loads((DATA / name).read_text())))
  complete = unary_union([shapely.make_valid(p) for p in scopes])
  return complete, original, complete.difference(original)


def build() -> dict:
  """Bake <=96 m water triangles into one bounded, lossless binary asset."""
  complete, original, extension = extent()
  # Uniform 64 m cells give <=90.51 m diagonals without skinny-boundary
  # recursive bisection or a large browser-side triangulation peak.
  vertices, lookup, indices, tiles = [], {}, [], []

  def vertex(x, z):
    key = (float(x), float(z))
    if key not in lookup:
      lookup[key] = len(vertices)
      vertices.append(key)
    return lookup[key]

  shapely.prepare(extension)
  west, north, east, south = extension.bounds
  for z in range(math.floor(north / 64) * 64, math.ceil(south / 64) * 64, 64):
    for x in range(math.floor(west / 64) * 64, math.ceil(east / 64) * 64, 64):
      tile = shapely.box(x, z, x + 64, z + 64)
      if not extension.intersects(tile):
        continue
      if extension.covers(tile):
        tiles.append((x, z))
      else:
        clipped = extension.intersection(tile)
        for triangle in shapely.get_parts(
          shapely.constrained_delaunay_triangles(clipped)
        ):
          indices.extend(
            vertex(px, pz) for px, pz in list(triangle.exterior.coords)[:3]
          )
  # Contiguous 2 km cells allow frustum culling without buffer copies or LOD.
  tiles.sort(key=lambda p: (math.floor(p[0] / 2048), math.floor(p[1] / 2048)))
  chunks = []
  for i, (x, z) in enumerate(tiles):
    key = [math.floor(x / 2048), math.floor(z / 2048)]
    if not chunks or chunks[-1]["key"] != key:
      chunks.append({"key": key, "start": i, "count": 0})
    chunks[-1]["count"] += 1
  positions = np.zeros((len(vertices), 3), dtype="<f4")
  positions[:, [0, 2]] = vertices
  positions[:, 1] = 7.2
  index = np.asarray(indices, dtype="<u4")
  offsets = np.asarray(tiles, dtype="<f4")
  raw = (
    b"ISOFLO05"
    + struct.pack("<III", len(tiles), len(vertices), len(indices))
    + offsets.tobytes()
    + positions.tobytes()
    + index.tobytes()
  )
  assert len(raw) < 5 * 1024 * 1024
  packed = gzip.compress(raw, mtime=0)
  assert len(packed) < 5 * 1024 * 1024
  OUTPUT.write_bytes(packed)
  receipt = {
    "file": OUTPUT.name,
    "rawBytes": len(raw),
    "compressedBytes": len(packed),
    "gridCells": len(tiles),
    "vertices": len(vertices),
    "indices": len(indices),
    "sha256": hashlib.sha256(raw).hexdigest(),
    "source": "Official Berlin ALKIS Landesgrenze v200 (dl-de/zero-2-0) plus retained approved scope footprints",
    "areaM2": complete.area,
    "originalAreaM2": original.area,
    "extensionAreaM2": extension.area,
    "maxEdgeM": 96,
    "bounds": list(complete.bounds),
    "chunks": chunks,
  }
  (DATA / "floodExtensionV205.json").write_text(
    json.dumps(receipt, separators=(",", ":")) + "\n"
  )
  (GEO / "flood-extent-v205.geojson").write_text(
    json.dumps(mapping(complete), separators=(",", ":")) + "\n"
  )
  print(json.dumps(receipt, indent=2))
  return receipt


if __name__ == "__main__":
  build()
