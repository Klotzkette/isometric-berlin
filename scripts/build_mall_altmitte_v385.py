"""Identify only the retired Mall passage envelopes in the frozen Alt-Mitte packets."""

import argparse
import json
import subprocess
from collections import Counter

import numpy as np
import shapely
from build_stelenfeld_altmitte_v385 import (
  DATA,
  ROOT,
  SOURCE,
  append_ink,
  archive,
  coplanar_patches,
  empty_packet,
  faces,
  fingerprint,
  keys,
  merge_native_faces,
  native_detail,
  original,
  pack_detail,
  spans,
  vectors,
)
from shapely.geometry import GeometryCollection, Polygon, box
from shapely.ops import unary_union

PARENT = "DEBE00YY1mc0004C"
TARGET = {"DEBE3DUbf8929NwV", "DEBE3DuwANtdjIMa"}
TILE = "1_1"
BOUNDS = (512, 512, 1024, 1024)
OUT = DATA / "mallAltMitteV385.json"


def audit_record():
  path = SOURCE / "render-audit.json"
  content = (
    (ROOT / path).read_bytes()
    if (ROOT / path).exists()
    else subprocess.check_output(["git", "show", f"v1.0.264:{path}"], cwd=ROOT)
  )
  return next(r for r in json.loads(content)["buildings"] if r["id"] == PARENT)


def production_meshes(record, audit):
  part_ids = {p["id"] for p in record["parts"]}
  assert len(part_ids) == 4 and part_ids == set(audit["parts"]) and TARGET < part_ids
  # The historic release audit records zero facade triangles at this parent.
  # Occupancy in nearby buildings suppressed every procedural window there.
  assert audit["facadeTriangles"] == 0
  ranks = {}
  for row in archive("appearance-baseline.json.gz")["records"]:
    for binding in row["bindings"]:
      for p in binding["parts"]:
        k = p["partId"]
        rank = p["match"] == "leaf-id", p["overlapAreaM2"]
        if k in part_ids and rank > ranks.get(k, (False, -1)):
          ranks[k] = rank
          original.APPEARANCE[k] = row
  result = {}
  for name, ids in [("all", part_ids), ("bridge", TARGET), ("keep", part_ids - TARGET)]:
    parts = [p for p in record["parts"] if p["id"] in ids]
    shell, front, _, _ = original.model({**record, "parts": parts}, box(*BOUNDS))
    assert not front.triangles
    block = merge_native_faces(native_detail(shell))
    if name == "all":
      assert (len(shell.triangles), len(block.triangles)) == (
        audit["sourceTriangles"],
        audit["nativeTriangles"],
      )
    edges = [
      (a, b)
      for p in parts
      for f in p["surfaces"]
      if f["kind"] in {"RoofSurface", "WallSurface", "ClosureSurface"}
      for ring in f["rings"]
      for a, b in zip(ring, ring[1:] + ring[:1])
    ]
    ink = [empty_packet(TILE, BOUNDS)]
    append_ink(ink, edges, TILE, BOUNDS)
    lines = vectors(ink[1]["lines"]["positions"], "<u2", 3).reshape(-1, 2, 3)
    result[name] = {"ink": set(keys(lines))}
    for mode, geometry in [("drawn", shell), ("native", block)]:
      (packet,) = pack_detail(geometry, BOUNDS)
      result[name][mode] = faces(packet)
  return result


def plane(tri):
  p = np.asarray(tri, dtype=np.int32)
  (axis,) = np.flatnonzero(np.ptp(p, axis=0) == 0)
  return (axis, p[0, axis]), Polygon(np.delete(p, axis, axis=1))


def retained_faces(poly, key, old):
  axis, level = key
  normal = np.cross(old[1] - old[0], old[2] - old[0])
  points = []
  patches = []
  for p in shapely.get_parts(poly):
    if p.geom_type != "Polygon" or p.area < 0.01:
      continue
    for tri in shapely.get_parts(shapely.constrained_delaunay_triangles(p)):
      if tri.area < 0.01:
        continue
      xyz = np.insert(
        np.rint(np.asarray(tri.exterior.coords[:3])).astype(np.int32),
        axis,
        level,
        axis=1,
      )
      if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), normal) < 0:
        xyz = xyz[[0, 2, 1]]
      if np.all(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]) == 0):
        continue
      points.extend(xyz.tolist())
      patches.append(Polygon(np.delete(xyz, axis, axis=1)))
  # The unquantised diagonal can cross a two-metre voxel edge at a fraction of
  # a centimetre. The original shared mesh stores U16 centimetres.
  error = unary_union(patches).symmetric_difference(poly).area / 10000
  assert error < 0.005
  return points


def generate():
  record = next(
    r for r in archive("source-390_5819-00.json.gz")["buildings"] if r["id"] == PARENT
  )
  models = production_meshes(record, audit_record())
  plan = {
    "drawn": {},
    "native": {},
    "ink": {},
    "residual": {},
    "colourHash": {"drawn": {}, "native": {}},
  }
  wanted_ink = models["bridge"]["ink"] - models["keep"]["ink"]
  found_ink = set()
  part_planes = {k: coplanar_patches(v["native"]) for k, v in models.items()}
  empty = GeometryCollection()
  for mode in ["drawn", "native"]:
    original_keys = Counter(keys(models["all"][mode]))
    original_count = original_keys.total()
    anticipated = Counter(keys(models["bridge"][mode]))
    survivor = set(keys(models["keep"][mode]))
    parents = 0
    for fname in sorted((DATA / ("altMitteV169" + mode.title())).glob("packet-*.json")):
      p = json.loads(fname.read_bytes())
      pid = p["id"]
      if not pid.startswith(TILE + "-"):
        continue
      if mode == "drawn" and "lines" in p:
        lines = vectors(p["lines"]["positions"], "<u2", 3).reshape(-1, 2, 3)
        ink_ix = [i for i, k in enumerate(keys(lines)) if k in wanted_ink]
        if ink_ix:
          found_ink.update(keys(lines[ink_ix]))
          plan["ink"][pid] = [spans(ink_ix), fingerprint(lines[ink_ix].flat)]
      for mesh in p["meshes"]:
        t = faces(mesh)
        ks = keys(t)
        located = [i for i, k in enumerate(ks) if k in original_keys]
        if not located:
          continue
        lo, hi = min(located), max(located) + 1
        # All faces of this parent form a contiguous run in the real packet.
        # Two native diagonals can vary between GEOS versions. The independently
        # rebuilt complete parent must agree in every plane before we touch it.
        assert hi - lo == original_count
        parent = t[lo:hi]
        current = Counter(ks[lo:hi])
        if mode == "drawn":
          assert current == original_keys
        else:
          wanted = coplanar_patches((original_keys - current).elements())
          actual = coplanar_patches((current - original_keys).elements())
          assert wanted.keys() == actual.keys()
          assert all(poly.equals(actual[k]) for k, poly in wanted.items())
        parents += 1
        colors = vectors(mesh["colors"], "u1", 3)[vectors(mesh["indices"], "<u4", 3)]
        indices = []
        repairs = []
        for j, raw in enumerate(parent):
          i = lo + j
          if mode == "drawn":
            # Where the two parents have an exactly coincident triangle the
            # existing wing owns that triangle. Its ordinal stays intact.
            if ks[i] in anticipated and ks[i] not in survivor:
              indices.append(i)
            continue
          key, poly = plane(raw)
          if key not in part_planes["bridge"]:
            continue
          remove = poly.intersection(part_planes["bridge"][key]).difference(
            part_planes["keep"].get(key, empty)
          )
          if remove.area < 0.01:
            continue
          keep = poly.difference(remove)
          if keep.area > 0.01:
            assert np.all(colors[i] == colors[i][0])
            repairs.append([i, retained_faces(keep, key, raw.astype(np.int64))])
          indices.append(i)
        plan[mode][pid] = [spans(indices), fingerprint(t[indices].flat)]
        plan["colourHash"][mode][pid] = fingerprint(colors[indices].flat)
        if repairs:
          # The two 2 m by 4 m retained contact strips are partitioned by
          # diagonals with repeating decimal crossings. Rounding a shared
          # coordinate in both triangles leaves the total footprint exact.
          repaired = unary_union(
            [
              Polygon(np.asarray(points[j : j + 3])[:, [0, 2]])
              for _, points in repairs
              for j in range(0, len(points), 3)
            ]
          )
          contacts = unary_union(
            [box(12800, 41400, 13000, 41800), box(13200, 46400, 13400, 46800)]
          )
          assert repaired.equals(contacts)
          assert all(v[1] == 1500 for _, points in repairs for v in points)
          plan["residual"][pid] = repairs

    assert parents == 1
  assert found_ink == wanted_ink
  print(
    "Registered Mall bridge faces",
    {
      m: sum(n for runs, _ in plan[m].values() for _, n in runs)
      for m in ["drawn", "native", "ink"]
    },
    "native mixed faces",
    sum(map(len, plan["residual"].values())),
  )
  return (json.dumps(plan, separators=(",", ":")) + "\n").encode()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  out = generate()
  if args.check:
    if OUT.read_bytes() != out:
      raise SystemExit("Stale Mall predecessor registration")
  else:
    OUT.write_bytes(out)
