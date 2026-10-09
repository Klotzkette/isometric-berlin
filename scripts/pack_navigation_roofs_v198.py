"""Pack retained Alt-Mitte roof coordinates as exact IEEE-754 doubles.

This changes storage only. Original navigation packets remain the authoritative
input; no point, triangle, order or precision is changed.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
INPUTS = [DATA / f"altMitteV169Navigation/packet-{i:03d}.json" for i in (3, 4, 5)]


def build() -> dict:
  values = bytearray()
  sources = []
  count = 0
  for path in INPUTS:
    raw = path.read_bytes()
    sources.append(
      {"path": str(path.relative_to(DATA)), "sha256": hashlib.sha256(raw).hexdigest()}
    )
    for triangle in json.loads(raw):
      if len(triangle) != 3 or any(len(vertex) != 3 for vertex in triangle):
        raise ValueError("Expected complete xyz roof triangles")
      for vertex in triangle:
        values.extend(struct.pack("<3d", *vertex))
      count += 1
  packed = gzip.compress(values, compresslevel=9, mtime=0)
  result = {
    "format": "lossless-f64le-roof-triangles-v1",
    "triangles": count,
    "bytes": len(values),
    "sha256": hashlib.sha256(values).hexdigest(),
    "sources": sources,
    "gzip": base64.b64encode(packed).decode("ascii"),
  }
  (DATA / "altMitteRoofStorageV198.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  return {"triangles": count, "bytes": len(values), "gzipBytes": len(packed)}


if __name__ == "__main__":
  print(json.dumps(build()))
