"""Register the two superseded Mall bridge roofs against the complete v169 models."""

import argparse
import base64
import gzip
import hashlib
import json
from collections import Counter
from math import sqrt
from pathlib import Path

import build_alt_mitte_v169 as original
import numpy as np
from build_karl_marx_allee_v161 import native_detail
from build_scheunenviertel_v168 import merge_native_faces
from build_stelenfeld_altmitte_v385 import archive, faces
from shapely import Point, Polygon, union_all

DATA = Path(__file__).resolve().parents[1] / "src/app/src/data"
OUTPUT = DATA / "mallBridgeRoofsV385.json"
PARENT = "DEBE00YY1mc0004C"
BRIDGES = {"DEBE3DUbf8929NwV", "DEBE3DuwANtdjIMa"}


def roof_model(record, parts, occupied):
  shell, fronts, _, roofs = original.model({**record, "parts": parts}, occupied)
  shell.triangles.extend(fronts.triangles)
  native = merge_native_faces(native_detail(shell))
  return roofs, native, original.native_roofs(native)


def drawn_rows(roofs):
  archive = json.loads((DATA / "altMitteRoofStorageV198.json").read_bytes())
  raw = gzip.decompress(base64.b64decode(archive["gzip"]))
  assert hashlib.sha256(raw).hexdigest() == archive["sha256"]
  stream = np.frombuffer(raw, "<f8").reshape(-1, 9)
  rows = []
  for roof in roofs:
    words = np.asarray(roof, "<f8").reshape(9)
    matches = np.where(np.all(stream.view("<u8") == words.view("<u8"), axis=1))[0]
    assert len(matches) == 1, "Ambiguous or missing published roof"
    rows.append([int(matches[0]), *words.tolist()])
  return sorted(rows)


def add_layers(triangles, samples, result):
  """Count every upward horizontal surface at a point inside each 1 m cell.

  Native blocks have 2 m cardinal boundaries. Irrational offsets stay off the
  internal triangulation diagonals, counting a source plane exactly once.
  """
  if len(triangles) == 0:
    return
  a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
  up = (np.cross(b - a, c - a)[:, 1] > 0) & (np.ptp(triangles[:, :, 1], axis=1) == 0)
  for triangle in triangles[up]:
    polygon = Polygon(triangle[:, [0, 2]])
    x0, z0, x1, z1 = polygon.bounds
    for key, point in samples.items():
      if x0 < point.x < x1 and z0 < point.y < z1 and polygon.contains(point):
        result[key][float(triangle[0, 1])] += 1


def global_native_layers(samples):
  points = {(x, z): Point(x + sqrt(2) / 10, z + sqrt(3) / 10) for x, z in samples}
  result = {k: Counter() for k in points}
  x = [p.x for p in points.values()]
  z = [p.y for p in points.values()]
  west, east, north, south = min(x), max(x), min(z), max(z)
  manifest = json.loads((DATA / "altMitteNativeV169Source.json").read_bytes())
  for item in manifest["chunkFiles"]:
    packet = json.loads((DATA / item["file"]).read_bytes())
    origin = np.asarray(packet["origin"])
    for mesh in packet["meshes"]:
      assert mesh["positionType"] == "u16cm"
      triangles = faces(mesh) / 100 + origin
      local = (
        (triangles[:, :, 0].max(axis=1) >= west)
        & (triangles[:, :, 0].min(axis=1) <= east)
        & (triangles[:, :, 2].max(axis=1) >= north)
        & (triangles[:, :, 2].min(axis=1) <= south)
      )
      add_layers(triangles[local], points, result)
  return points, result


def native_rows(old_mesh, old, retained):
  changed = {key for key, y in old.items() if retained.get(key) != y}
  assert changed and not (retained.keys() - old.keys())
  samples, all_layers = global_native_layers(changed)
  parent_layers = {k: Counter() for k in changed}
  add_layers(
    np.asarray([face for face, _, _ in old_mesh.triangles]), samples, parent_layers
  )
  published = {}
  west, east = min(x for x, _ in changed), max(x for x, _ in changed)
  north, south = min(z for _, z in changed), max(z for _, z in changed)
  for number in ("006", "007"):
    for x0, z0, x1, z1, height in json.loads(
      (DATA / f"altMitteV169Navigation/packet-{number}.json").read_bytes()
    ):
      if x0 > east or x1 <= west or z0 > south or z1 <= north:
        continue
      for x in range(max(x0, west), min(x1, east + 1)):
        for z in range(max(z0, north), min(z1, south + 1)):
          if (x, z) in changed:
            published[x, z] = max(published.get((x, z), -np.inf), height)
  result = []
  for key in sorted(changed):
    assert (
      max(all_layers[key]) == published[key] and max(parent_layers[key]) == old[key]
    )
    others = all_layers[key].copy()
    others.subtract(parent_layers[key])
    assert all(n >= 0 for n in others.values()), (
      "Reconstructed roof missing from complete native model"
    )
    remaining = [y for y, count in others.items() if count]
    if key in retained:
      remaining.append(retained[key])
    top = max(remaining, default=None)
    if top != published[key]:
      result.append([*key, published[key], top])
  return result


def generate():
  records = archive("source-390_5819-00.json.gz")["buildings"]
  record = next(row for row in records if row["id"] == PARENT)
  parts = record["parts"]
  assert {p["id"] for p in parts} == BRIDGES | {"DEBE3DAAMeoMBUqM", "DEBE3DyiZSDXhJGe"}
  site = original.footprint(record)
  nearby = [
    shape for row in records if (shape := original.footprint(row)).distance(site) < 5
  ]
  occupied = union_all(nearby)
  _, model, original_cells = roof_model(record, parts, occupied)
  _, _, retained_cells = roof_model(
    record, [p for p in parts if p["id"] not in BRIDGES], occupied
  )
  _, _, _, roofs = original.model(
    {**record, "parts": [p for p in parts if p["id"] in BRIDGES]}, occupied
  )
  result = {
    "drawn": drawn_rows(roofs),
    "native": native_rows(model, original_cells, retained_cells),
  }
  return (json.dumps(result, separators=(",", ":")) + "\n").encode()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  options = parser.parse_args()
  data = generate()
  if options.check:
    if OUTPUT.read_bytes() != data:
      raise SystemExit("Mall roof registration differs")
  else:
    OUTPUT.write_bytes(data)
