"""Bind only Kalkscheune's original estimated drawn windows to their replacement.

Replays the existing facade recipe for three exact official source families,
then matches complete centimetre-position and linear-colour triangle signatures.
Never regenerates published packets, resident shells, ink or native voxels.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from alt_mitte_v169_packets import pack_detail
from build_alt_mitte_v169 import facade, footprint, isometric_shading
from build_karl_marx_allee_v161 import Detail, mesh_signature
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5820-00.json.gz"
DEST = ROOT / "src/app/src/data/kalkscheuneOwnershipV218.json"
OWNERS = ("DEBE01YYK0000Boq", "DEBE01YYK0000BWc", "DEBE01YYK000068w")
TILE = "2_-2"
BOUNDS = (1024, -1024, 1536, -512)
PACKET = ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{TILE}.drawn.json.gz"


def fingerprint(mesh: dict) -> int:
  value = 2166136261
  for key in ("positions", "colors", "indices"):
    for byte in mesh[key].encode("ascii"):
      value = ((value ^ byte) * 16777619) & 0xFFFFFFFF
  return value


def signatures(mesh: dict):
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  vertices = np.column_stack((positions, colors))
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  for triangle in vertices[indices]:
    yield b"".join(sorted(row.tobytes() for row in triangle))


def build() -> dict:
  rows = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  selected = [next(row for row in rows if row["id"] == owner) for owner in OWNERS]
  area = unary_union([footprint(row) for row in selected])
  # All exposure probes are within 3 m. This source tile contains that entire
  # neighbourhood (world x500..1500 / z-1000..0); no other tile can occlude it.
  assert box(500, -1000, 1500, 0).contains(area.buffer(5))
  occupied = unary_union(
    [footprint(row) for row in rows if footprint(row).intersects(area.buffer(5))]
  )
  expected: Counter[bytes] = Counter()
  counts = {}
  source_parts = []
  for row in selected:
    detail = Detail()
    for part in row["parts"]:
      source_parts.append(part["id"])
      ground = min(
        point[1]
        for sheet in part["surfaces"]
        if sheet["kind"] == "GroundSurface"
        for ring in sheet["rings"]
        for point in ring
      )
      for sheet in part["surfaces"]:
        if sheet["kind"] == "WallSurface":
          detail.triangles.extend(
            facade(sheet["rings"], ground, part["topY"], occupied).triangles
          )
    packed = pack_detail(isometric_shading(detail), BOUNDS)
    owner_signatures = mesh_signature({"meshes": packed})
    assert not (expected.keys() & owner_signatures.keys()), "Overlapping owner recipes"
    expected.update(owner_signatures)
    counts[row["id"]] = sum(owner_signatures.values())
  packet_bytes = PACKET.read_bytes()
  packet = json.loads(gzip.decompress(packet_bytes))
  assert packet["origin"] == [1024, -10, -1024]
  remaining = expected.copy()
  records = []
  for mesh in packet["meshes"]:
    if mesh["kind"] != "alt-mitte-v169":
      continue
    matches = []
    for index, signature in enumerate(signatures(mesh)):
      if signature in expected:
        assert remaining[signature] > 0, "Ambiguous duplicate packet triangle"
        remaining[signature] -= 1
        matches.append(index)
    if matches:
      records.append(
        {
          "tile": TILE,
          "kind": mesh["kind"],
          "mode": "drawn",
          "fingerprint": fingerprint(mesh),
          "triangles": matches,
        }
      )
  assert not +remaining, f"Missing {sum(remaining.values())} exact window triangles"
  assert len(records) == 1 and sum(counts.values()) > 0
  return {
    "schemaVersion": 1,
    "sourceFile": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "packetFile": str(PACKET.relative_to(ROOT)),
    "packetSha256": hashlib.sha256(packet_bytes).hexdigest(),
    "sourceOwners": list(OWNERS),
    "sourceParts": source_parts,
    "ownerFacadeTriangles": counts,
    "transferredTriangles": sum(counts.values()),
    "residentShellTrianglesTransferred": 0,
    "nativeTrianglesTransferred": 0,
    "selection": "Exact original v169 facade recipe position/colour triangle multisets; only external drawn windows, surrounds, mullions and sills.",
    "records": records,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  result = build()
  if args.check:
    assert result == json.loads(DEST.read_bytes())
  else:
    DEST.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "owners": result["ownerFacadeTriangles"],
        "transferredTriangles": result["transferredTriangles"],
      }
    )
  )
