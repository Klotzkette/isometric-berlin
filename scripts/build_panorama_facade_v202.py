"""Receipt for the exact superseded Panorama facade recipe; packets stay intact."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from build_alt_mitte_v169 import isometric_shading, model, pack_detail
from build_karl_marx_allee_v161 import mesh_signature, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
  ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5820-osm-00.json.gz"
)
OUTPUT = ROOT / "src/app/src/data/panoramaFacadeV202.json"


def fingerprint(strings: list[str]) -> int:
  """Bounded runtime fingerprint; offline tests also verify source SHA-256."""
  value = 2166136261
  for text in strings:
    for char in text:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def build() -> dict:
  """Match full coloured triangles of this one old owner, never an area cull."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  buildings = source if isinstance(source, list) else source["buildings"]
  owner = next(b for b in buildings if b["id"] == "OSM-way-235493631")
  _, fronts, _, _ = model(owner, Polygon())
  native = merge_native_faces(native_detail(fronts))
  records = []
  for tile, x in [("2_-1", 1024), ("3_-1", 1536)]:
    for mode, detail in [("drawn", isometric_shading(fronts)), ("minecraft", native)]:
      expected = mesh_signature({"meshes": pack_detail(detail, (x, -512, x + 512, 0))})
      path = ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{tile}.{mode}.json.gz"
      payload = json.loads(gzip.decompress(path.read_bytes()))
      mesh = next(m for m in payload["meshes"] if m["kind"] == "alt-mitte-v169")
      positions = np.frombuffer(
        base64.b64decode(mesh["positions"]), dtype="<u2"
      ).reshape(-1, 3)
      colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(
        -1, 3
      )
      vertices = np.column_stack([positions, colors])
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
        -1, 3
      )
      removed = []
      for number, triangle in enumerate(vertices[indices]):
        key = b"".join(sorted(row.tobytes() for row in triangle))
        if expected[key]:
          removed.append(number)
          expected[key] -= 1
      records.append(
        {
          "tile": tile,
          "mode": mode,
          "kind": mesh["kind"],
          "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
          "fingerprint": fingerprint(
            [mesh[k] for k in ["positions", "colors", "indices"]]
          ),
          "triangles": removed,
        }
      )
  result = {
    "owner": owner["id"],
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "method": "Exact position/colour triangle match against this owner's retained v169 recipe; no geographic deletion. All packet bytes remain unchanged.",
    "records": records,
  }
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print([(r["tile"], r["mode"], len(r["triangles"])) for r in records])
  return result


if __name__ == "__main__":
  build()
