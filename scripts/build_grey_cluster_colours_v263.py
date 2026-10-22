"""Step 10: resolve source-corner paint gaps in nine fixed existing house tiles."""

from __future__ import annotations

import base64
import hashlib
import json
from collections import defaultdict

import numpy as np
from shapely.geometry import Polygon
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint
from scripts.build_surrounding_outlines import linear_rgb_bytes

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
OUTPUT = ROOT / "src/app/src/data/greyClusterColoursV263.json"
EVIDENCE = GEO / "grey-cluster-colours-v263-evidence.json.gz"
TILES = (
  "outer187-27_6",
  "outer187--22_-5",
  "east200-4_-15",
  "east200-23_17",
  "north190-9_-9",
  "ring182--9_8",
  "city183--9_10",
  "-8_-3",
  "outer187--11_18",
)
WALL = tuple(linear_rgb_bytes(np.array([[211, 208, 195]]))[0])
ROOF = tuple(linear_rgb_bytes(np.array([[157, 151, 140]]))[0])


def decoded(part: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  """Read one bounded existing part without altering its encoding."""
  return (
    np.frombuffer(base64.b64decode(part["positions"]), dtype="<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(part["colors"]), dtype="u1").reshape(-1, 3),
    np.frombuffer(base64.b64decode(part["indices"]), dtype="<u4").reshape(-1, 3),
  )


def source_owners(packet: dict) -> tuple[list[dict], dict, dict]:
  """Source nav is used only together with complete original mesh triangles."""
  owners, corners, walls = [], defaultdict(set), defaultdict(set)
  for b in packet["nav"]["buildings"]:
    base_y = packet["nav"]["groundY"] + b.get("groundOffset", 0) - packet["origin"][1]
    low, high = (
      round((base_y + b["minHeight"]) * 100),
      round((base_y + b["height"]) * 100),
    )
    rings = [
      [(round(x * 100), round(z * 100)) for x, z in r] for r in [b["ring"], *b["holes"]]
    ]
    polygon = Polygon(rings[0], rings[1:])
    if not polygon.is_valid or polygon.area == 0:
      continue
    index = len(owners)
    owners.append(
      {"sourceId": b["sourceId"], "low": low, "high": high, "polygon": polygon}
    )
    for ring in rings:
      for a, z in zip(ring, ring[1:]):
        corners[a].add(b["sourceId"])
        if a != z:
          walls[(tuple(sorted((a, z))), low, high)].add(index)
  return owners, corners, walls


def analyse(packet: dict, part: dict) -> tuple[list[list], dict]:
  """Only unanimous incident-triangle ownership can resolve an ambiguous corner."""
  owners, corners, walls = source_owners(packet)
  points, colours, triangles = decoded(part)
  roles = np.array(
    [0 if tuple(c) == WALL else 1 if tuple(c) == ROOF else -1 for c in colours]
  )
  tree = STRtree([owner["polygon"] for owner in owners])
  triangle_owners: dict[int, set[int]] = {}
  quads = defaultdict(list)
  for ti, ids in enumerate(triangles):
    if not np.all(roles[ids] == roles[ids[0]]) or roles[ids[0]] < 0:
      continue
    p = points[ids]
    if roles[ids[0]] == 0:
      xz = tuple(sorted({(int(x), int(z)) for x, _, z in p}))
      yy = sorted({int(y) for _, y, _ in p})
      if len(xz) == 2 and len(yy) == 2:
        key = (xz, yy[0], yy[1])
        if key in walls:
          quads[key].append(ti)
    elif len(set(map(int, p[:, 1]))) == 1:
      polygon = Polygon(p[:, [0, 2]])
      if polygon.area > 0:
        triangle_owners[ti] = {
          int(i)
          for i in tree.query(polygon)
          if owners[i]["high"] == int(p[0, 1]) and owners[i]["polygon"].covers(polygon)
        }
  for key, tis in quads.items():
    if len(tis) != 2:
      continue
    sets = [{tuple(map(int, p)) for p in points[triangles[ti]]} for ti in tis]
    shared = sets[0] & sets[1]
    if len(sets[0] | sets[1]) != 4 or len(shared) != 2:
      continue
    a, b = tuple(shared)
    if a[1] == b[1] or (a[0], a[2]) == (b[0], b[2]):
      continue
    for ti in tis:
      triangle_owners[ti] = walls[key]
  incident = defaultdict(list)
  for ti, ids in enumerate(triangles):
    for index in ids:
      if (
        roles[index] >= 0
        and len(corners[(int(points[index, 0]), int(points[index, 2]))]) > 1
      ):
        incident[int(index)].append(ti)
  rows, proof = [], []
  for vertex, tis in sorted(incident.items()):
    by_triangle = [triangle_owners.get(ti, set()) for ti in tis]
    resolved = [
      set(owners[i]["sourceId"] for i in candidates) for candidates in by_triangle
    ]
    if any(len(ids) != 1 for ids in resolved) or len(set.union(*resolved)) != 1:
      continue
    source_id = next(iter(resolved[0]))
    verticals = {
      (owner["low"], owner["high"])
      for owner in owners
      if owner["sourceId"] == source_id
    }
    # Conflicting source parts have no single grounding wash, matching v184.
    low, high = next(iter(verticals)) if len(verticals) == 1 else (-1, -1)
    rows.append([vertex, source_id, int(roles[vertex]), low, high])
    proof.append([vertex, tis, source_id])
  return rows, {
    "ambiguousGenericVertices": len(incident),
    "resolvedVertices": len(rows),
    "proof": proof,
  }


def build() -> dict:
  """Inspect exactly nine drawn/native pairs and emit finite immutable receipts."""
  packets, proofs, inputs = {}, {}, {}
  for tile in TILES:
    for mode in ("drawn", "minecraft"):
      path = OUT / f"{tile}.{mode}.json.gz"
      packet = base.read_json(path)
      inputs[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
      records, details = [], []
      for mesh, part in enumerate(packet["meshes"]):
        if part["kind"] != "city":
          continue
        rows, detail = analyse(packet, part)
        details.append({"mesh": mesh, **detail})
        if rows:
          ids = sorted({r[1] for r in rows})
          records.append(
            {
              "mesh": mesh,
              "fingerprint": fingerprint(
                [part["positions"], part["colors"], part["indices"]]
              ),
              "owners": ids,
              "rows": [[r[0], ids.index(r[1]), *r[2:]] for r in rows],
            }
          )
      key = f"{mode}:{tile}"
      if records:
        packets[key] = {
          "origin": packet["origin"],
          "guard": nav_fingerprint(packet["nav"]),
          "records": records,
        }
      proofs[key] = details
  runtime = {"schemaVersion": 1, "keys": list(packets), "packets": packets}
  OUTPUT.write_text(json.dumps(runtime, separators=(",", ":")) + "\n")
  evidence = {
    "schemaVersion": 1,
    "tiles": list(TILES),
    "inputs": inputs,
    "policy": "Resolve only raw-generic shared-XZ vertices whose every original incident triangle has one unanimous complete source owner. Complete wall quads and source-covered top triangles required. True shared vertices stay unchanged. Existing palette is illustrative; material receipts retain priority.",
    "packets": proofs,
    "runtimeSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "runtimeBytes": OUTPUT.stat().st_size,
  }
  base.write_json(EVIDENCE, evidence)
  return {
    "packets": len(packets),
    "bytes": OUTPUT.stat().st_size,
    "resolved": {
      mode: sum(
        d["resolvedVertices"]
        for k, v in proofs.items()
        if k.startswith(mode + ":")
        for d in v
      )
      for mode in ("drawn", "minecraft")
    },
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
