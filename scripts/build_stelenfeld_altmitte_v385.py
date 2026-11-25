"""Identify the two historical LoD2 floor sheets under the surveyed memorial."""

import argparse
import base64
import gzip
import json
import subprocess
from collections import Counter, defaultdict
from itertools import groupby
from pathlib import Path

import build_alt_mitte_v169 as original
import numpy as np
from alt_mitte_v169_packets import append_ink, empty_packet, pack_detail
from build_karl_marx_allee_v161 import native_detail
from build_scheunenviertel_v168 import merge_native_faces
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = Path("geo_data/regierungsviertel/alt-mitte-v169")
OUTPUT = DATA / "stelenfeldAltMitteV385.json"
PARENT = "DEBE00YYGu00005X"


def archive(name):
  path = SOURCE / name
  if (ROOT / path).exists():
    content = (ROOT / path).read_bytes()
  else:
    content = subprocess.check_output(["git", "show", f"v1.0.264:{path}"], cwd=ROOT)
  return json.loads(gzip.decompress(content))


def vectors(content, dtype, width):
  return np.frombuffer(base64.b64decode(content), dtype).reshape(-1, width)


def faces(mesh):
  points = vectors(mesh["positions"], "<u2", 3)
  return points[vectors(mesh["indices"], "<u4", 3)]


def keys(triangles):
  return [tuple(sorted(map(tuple, triangle.tolist()))) for triangle in triangles]


def spans(indices):
  return [
    [n[0], len(n)]
    for _, group in groupby(enumerate(indices), lambda row: row[1] - row[0])
    if (n := [value for _, value in group])
  ]


def fingerprint(words):
  h = 2166136261
  for word in words:
    h = ((h ^ int(word)) * 16777619) & 0xFFFFFFFF
  return h


def coplanar_patches(triangles):
  """Compare alternate diagonals of coplanar native rectangles exactly in cm."""
  planes = defaultdict(list)
  for triangle in triangles:
    t = np.array(triangle, dtype=np.int64)
    axis = np.where(np.ptp(t, axis=0) == 0)[0]
    assert len(axis) == 1
    k = axis[0]
    planes[k, t[0, k]].append(Polygon(np.delete(t, k, axis=1)))
  return {key: unary_union(rows) for key, rows in planes.items()}


def registered(record):
  part_ids = {p["id"] for p in record["parts"]}
  assert part_ids == {"DEBE3DeExMIcRZKx", "DEBE3DZhgOS1LQeK"}
  ranks = {}
  for row in archive("appearance-baseline.json.gz")["records"]:
    for binding in row["bindings"]:
      for part in binding["parts"]:
        key = part["partId"]
        rank = part["match"] == "leaf-id", part["overlapAreaM2"]
        if key in part_ids and rank > ranks.get(key, (False, -1)):
          ranks[key] = rank
          original.APPEARANCE[key] = row
  shell, front, navigation, _ = original.model(record, original.footprint(record))
  assert not front.triangles and len(navigation) == 2
  block = merge_native_faces(native_detail(shell))
  return shell, block, navigation


def generate():
  record = next(
    b for b in archive("source-389_5819-00.json.gz")["buildings"] if b["id"] == PARENT
  )
  shell, block, navigation = registered(record)
  edges = [
    (a, b)
    for part in record["parts"]
    for surface in part["surfaces"]
    if surface["kind"] in ("RoofSurface", "WallSurface", "ClosureSurface")
    for ring in surface["rings"]
    for a, b in zip(ring, ring[1:] + ring[:1])
  ]
  plan = {
    "drawn": {},
    "native": {},
    "ink": {},
    "footprints": [r["ring"] for r in navigation],
  }
  for label, shape in [("Drawn", shell), ("Native", block)]:
    packets = [
      json.loads(p.read_bytes())
      for p in sorted((DATA / ("altMitteV169" + label)).glob("packet-*.json"))
    ]
    for x, z in [(0, 0), (0, 1), (1, 0), (1, 1)]:
      tile = f"{x}_{z}"
      bounds = (x * 512, z * 512, (x + 1) * 512, (z + 1) * 512)
      expected = Counter(
        key for mesh in pack_detail(shape, bounds) for key in keys(faces(mesh))
      )
      corners = {corner for triangle in expected for corner in triangle}
      ink = [empty_packet(tile, bounds)]
      append_ink(ink, edges, tile, bounds)
      segments = set(
        keys(vectors(ink[1]["lines"]["positions"], "<u2", 3).reshape(-1, 2, 3))
      )
      found = Counter()
      found_ink = set()
      for packet in packets:
        if not packet["id"].startswith(tile + "-"):
          continue
        for mesh in packet["meshes"]:
          t = faces(mesh)
          words = keys(t)
          selected = [
            i for i, triangle in enumerate(words) if all(v in corners for v in triangle)
          ]
          if selected:
            found.update(words[i] for i in selected)
            plan[label.lower()][packet["id"]] = [
              spans(selected),
              fingerprint(t[selected].flat),
            ]
        if label == "Drawn" and "lines" in packet:
          lines = vectors(packet["lines"]["positions"], "<u2", 3).reshape(-1, 2, 3)
          selected = [i for i, key in enumerate(keys(lines)) if key in segments]
          if selected:
            found_ink.update(keys(lines[selected]))
            plan["ink"][packet["id"]] = [
              spans(selected),
              fingerprint(lines[selected].flat),
            ]
      if label == "Drawn":
        assert found == expected and found_ink == segments, tile
      else:
        assert found.total() == expected.total()
        expected_patches = coplanar_patches((expected - found).elements())
        found_patches = coplanar_patches((found - expected).elements())
        assert expected_patches.keys() == found_patches.keys()
        assert all(p.equals(found_patches[k]) for k, p in expected_patches.items())
  # The packed roof query contains the union of all buildings. Check that no
  # other part shares the old floor or any of its 2-m native boundary cells.
  site = original.footprint(record)
  for name in ["packet-001.json", "packet-002.json"]:
    for r in json.loads((DATA / "altMitteV169Navigation" / name).read_bytes()):
      if r["sourceId"] != PARENT:
        assert Polygon(r["ring"], r["holes"]).distance(site) > 3
  native_cells = original.native_roofs(block)
  rows = defaultdict(list)
  for x, z in native_cells:
    rows[z].append(x)
  plan["nativeRows"] = {str(z): spans(sorted(xs)) for z, xs in sorted(rows.items())}
  return (json.dumps(plan, separators=(",", ":")) + "\n").encode()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  result = generate()
  if args.check:
    if OUTPUT.read_bytes() != result:
      raise SystemExit("Stelenfeld predecessor registration differs")
  else:
    OUTPUT.write_bytes(result)
