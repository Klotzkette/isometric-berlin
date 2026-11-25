"""Repack the audited cadastral, orthophoto and laser measurements for the viewer."""

import argparse
import base64
import gzip
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/stelenfeld-v385.json.gz"
TARGET = ROOT / "src/app/src/data/stelenfeldV385"


def encode(code, values):
  return base64.b64encode(struct.pack(f"<{len(values)}{code}", *values)).decode()


def flattened(rows):
  return [value for row in rows for value in row]


def prism_signature(prism):
  # Include original identity, elevations, class, every ring and every coordinate.
  values = [*map(ord, prism["id"]), prism["y0_dm"], prism["h_dm"], prism["class"]]
  for ring in [prism["ring"], *prism.get("holes", [])]:
    values.extend([len(ring), *flattened(ring)])
  h = 2166136261
  for value in values:
    h = ((h ^ (value & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
  return h


def add_information_building(survey, vertices, indices):
  """Join the separate measured street-level building to the existing mesh."""
  evidence = survey["entranceRoof"]
  part = survey["protected"]["aboveGround"][0]
  assert part["id"] == evidence["id"] == "DEBE00YYGu00005R"
  ring = [[round((x - 460) * 100), round((z - 550) * 100)] for x, z in part["rings"][0]]
  roof = evidence["roofCm"]
  base = evidence["lowerWallCm"]
  centre = [round(sum(p[k] for p in ring) / len(ring)) for k in (0, 1)]
  roof_start = len(vertices)
  vertices.append([centre[0], roof, centre[1]])
  vertices.extend([x, roof, z] for x, z in ring)
  wall_start = len(vertices)
  for i, (x, z) in enumerate(ring):
    j = (i + 1) % len(ring)
    nx, nz = ring[j]
    # The visible roof is clockwise in x/z. The centre lies inside each edge.
    assert (nx - x) * (centre[1] - z) - (nz - z) * (centre[0] - x) < 0
    indices.extend([roof_start, roof_start + 1 + i, roof_start + 1 + j])
    a = len(vertices)
    vertices.extend([[x, roof, z], [x, base, z], [nx, base, nz], [nx, roof, nz]])
    indices.extend([a, a + 1, a + 2, a, a + 2, a + 3])
  return {
    "ring": ring,
    "roofCm": roof,
    "roofStart": roof_start,
    "wallStart": wall_start,
  }


def build(check):
  with gzip.open(SOURCE, "rt") as f:
    source = json.load(f)
  signatures = sorted(map(prism_signature, source["legacyPrisms"]))
  assert len(set(signatures)) == len(signatures) == 2601
  assert len(source["stelePoses"]) == 2710
  assert sum(h == 0 for _, _, h, *_ in source["stelePoses"]) == 112
  entrance = add_information_building(
    source["nativeFieldSurvey"], source["groundVertices"], source["groundIndices"]
  )
  rows_by_span = {40: [], 80: []}
  for x, z, low, high, cls in sorted(
    source["nativeColumns"], key=lambda t: (t[1], t[0])
  ):
    assert cls == 3
    rows = rows_by_span[high - low]
    if rows and rows[-1][0] == z and rows[-1][2] == x and rows[-1][3] == low:
      rows[-1][2] += 1
    else:
      rows.append([z, x, x + 1, low])
  packets = {
    "owners": {
      "prisms": encode("I", signatures),
      "columns": rows_by_span[40],
      "tallColumns": rows_by_span[80],
    },
    "field": {
      "grid": source["floorGrid"],
      "floor": encode("h", source["floorHeights"]),
      "positions": encode("h", flattened(source["groundVertices"])),
      "indices": encode("H", source["groundIndices"]),
      "entrance": entrance,
      "stelae": encode("h", flattened(source["stelePoses"])),
      "trees": [tree[:5] for tree in source["trees"]],
    },
  }
  for name, packet in packets.items():
    file = TARGET / (name + ".json")
    content = json.dumps(packet, separators=(",", ":")) + "\n"
    if check:
      if file.read_text() != content:
        raise SystemExit(f"Stale model packet: {file}")
    else:
      file.parent.mkdir(parents=True, exist_ok=True)
      file.write_text(content)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  build(parser.parse_args().check)
