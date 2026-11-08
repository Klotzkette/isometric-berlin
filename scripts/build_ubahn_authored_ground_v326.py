"""Finite existing eastern-ground ownership, with original body/water guards.

This creates an index only. Existing ground, building and water bytes remain
unchanged; the main thread must borrow the actual existing mesh references.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from shapely import STRtree, make_valid
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
IDS = {
  "node/1840339724",
  "node/2777153586",
  "node/315140146",
  "node/3876077785",
  "node/8196659439",
  "node/8196659440",
  "node/8196659577",
  "node/8196659581",
  "node/8196659583",
}


def read(path: Path):
  return json.loads(path.read_bytes())


def polygon(row, scale=1):
  return make_valid(
    Polygon(
      [(x * scale, z * scale) for x, z in row["ring"]],
      [[(x * scale, z * scale) for x, z in h] for h in row.get("holes", [])],
    )
  )


def build():
  profile = read(DATA / "ubahnAccessV326.json")
  entries = [e for e in profile["entries"] if e["id"] in IDS]
  if len(entries) != 9:
    raise ValueError("Incomplete exact existing-ground identities")
  paths = [
    DATA / f"altMitteV169Navigation/packet-{i:03d}.json" for i in [0, 1, 2, 6, 7]
  ]
  parts = read(paths[1]) + read(paths[2])
  legacy = read(paths[0])
  spans = read(paths[3]) + read(paths[4])
  water_path = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  waters = read(water_path)["water"]
  groups = {
    "drawnBodies": ([polygon(p) for p in parts], [p["id"] for p in parts]),
    "legacyBodies": ([polygon(p, 0.1) for p in legacy], [p["id"] for p in legacy]),
    "nativeSpans": ([box(*p[:4]) for p in spans], list(range(len(spans)))),
    "mappedWater": ([polygon(p, 0.1) for p in waters], list(range(len(waters)))),
  }
  trees = {k: STRtree(p[0]) for k, p in groups.items()}
  rows = []
  for entry in entries:
    # Stair mouths are checked in full. A marker point receives a physical
    # nine-centimetre pole-support footprint instead of a zero-area point test.
    footprint = (
      Polygon(entry["stair"]["ring"])
      if entry["stair"]
      else Point(entry["point"]).buffer(0.08)
    )
    hits = {}
    for name, (polys, names) in groups.items():
      found = [
        names[i]
        for i in trees[name].query(footprint, predicate="intersects")
        if polys[i].intersection(footprint).area > 1e-8
      ]
      if found:
        hits[name] = found
    rows.append(
      {
        **{k: entry[k] for k in ["id", "station", "key"]},
        "hasSourceStair": bool(entry["stair"]),
        "owner": "schloss-east-existing-ground",
        "admission": "source-body-blocked" if hits else "ready",
        "intersections": hits,
      }
    )
  if sum(e["admission"] == "ready" for e in rows) != 6:
    raise ValueError("Changed original eastern body/water admission")
  if any(e["intersections"] for e in rows if e["hasSourceStair"]):
    raise ValueError("A complete eastern stair mouth intersects old source")
  pin_paths = paths + [
    water_path,
    DATA / "ubahnAccessV326.json",
    DATA / "schlossEastStreets.json",
    DATA / "schlossEastBlockStreets.json",
  ]
  return {
    "schemaVersion": 1,
    "ids": sorted(IDS),
    "entries": rows,
    "ownerRootDrawn": "Schloss to Alexanderplatz mapped street extension",
    "ownerRootNative": "Block-native Schloss to Alexanderplatz mapped street extension",
    "profileCounts": {k: len(v[0]) for k, v in groups.items()},
    "sourcePins": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in pin_paths
    },
    "policy": "All nine are excluded from ordinary packets. Six borrow actual scoped original ground refs; three source points are inside retained measured bodies and stay explicitly blocked. No new eastern ground, no outside-body mutation.",
  }


if __name__ == "__main__":
  output = DATA / "ubahnAuthoredGroundV326Index.json"
  result = build()
  output.write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(
    "exact",
    len(result["ids"]),
    "ready",
    sum(e["admission"] == "ready" for e in result["entries"]),
    "bytes",
    output.stat().st_size,
  )
