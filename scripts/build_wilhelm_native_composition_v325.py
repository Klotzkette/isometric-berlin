"""Build independent cardinal fittings on complete original native wall unions.

Inputs are explicit external evidence files. This compiler never reads a live
world, rewrites old sources, cuts a body, or installs the output into a product.
Only the audited full-wall support hash can supply native placement.
"""

import argparse
import hashlib
import json
import math
import time
from collections import Counter, defaultdict
from pathlib import Path

from shapely.geometry import LineString, Polygon, box

SUPPORT_SHA = "b4524c200d211406f7a8bda87bb7c35066140233de09aea32c0aa63b09fee6f7"


def read(path):
  return json.loads(path.read_text())


def encode(value):
  return json.dumps(value, separators=(",", ":")).encode()


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--composition", type=Path, required=True)
  parser.add_argument("--support", type=Path, required=True)
  parser.add_argument("--output-dir", type=Path, required=True)
  args = parser.parse_args()
  META, SUPPORT, HERE = args.composition, args.support, args.output_dir
  if hashlib.sha256(SUPPORT.read_bytes()).hexdigest() != SUPPORT_SHA:
    raise ValueError("Changed complete original native-wall support")
  if HERE.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
    raise ValueError("Review output must be outside the repository")
  HERE.mkdir(parents=True, exist_ok=True)
  start = time.monotonic()
  meta = read(META)
  support = read(SUPPORT)
  families = {f["family"]: f for f in meta["families"]}
  runs = {r["run"]: r for r in meta["runs"]}
  rows = []
  counts = Counter()
  roles = Counter()
  groups = defaultdict(list)
  checks = []

  def push(s, u, y, w, h, depth, out, rgb, role):
    n, d, c = s["n"], s["d"], s["c"]
    x = n[0] * (c + out) + d[0] * u
    z = n[1] * (c + out) + d[1] * u
    size = [depth if n[0] else w, h, w if n[0] else depth]
    rows.append(
      [
        round(x, 6),
        round(y, 6),
        round(z, 6),
        round(size[0], 6),
        round(size[1], 6),
        round(size[2], 6),
        0,
        rgb,
        role,
        s["run"],
      ]
    )
    roles[role] += 1

  for si, s in enumerate(support["surfaces"]):
    f = families[s["family"]]
    run = runs[s["run"]]
    shape = Polygon(s["rings"][0], s["rings"][1:])
    u0, y0, u1, y1 = shape.bounds
    dot = sum(a * b for a, b in zip(s["d"], run["tangent"]))
    base = s["c"] * sum(a * b for a, b in zip(s["n"], run["tangent"]))
    special = run.get("photographicColumnAxes", [])
    if special and abs(dot) > 0.2:
      axes = [((q["s"] - base) / dot, q["kind"]) for q in special]
    else:
      # Independent native3m cardinal lattice; one phase for the WHOLE run, never each cell/wall.
      anchor = run["bayOriginS"]
      c = run["backingDepth"]
      t = run["tangent"]
      n = run["normal"]
      origin = (t[0] * anchor + n[0] * c) * s["d"][0] + (t[1] * anchor + n[1] * c) * s[
        "d"
      ][1]
      pitch = 3.0
      axes = [
        (origin + k * pitch, "ordinary")
        for k in range(
          math.floor((u0 - origin) / pitch) - 1, math.ceil((u1 - origin) / pitch) + 2
        )
      ]
    levels = [(y, "housing") for y in f["residentialFloorCenters"]]
    low, high = f["groundFloorRange"]
    levels.insert(
      0,
      (
        (low + high) / 2,
        "shopfront" if f["groundUse"] == "corner-shopfront" else "base",
      ),
    )
    levels.extend((y, "roof-front-joinery") for y in f["roofOpeningCenters"])
    modern = f["groundUse"] == "modern-base"
    for y, zone in levels:
      for u, column in axes:
        w = 1.45 if column == "ordinary" else 1.62
        h = 1.62 if zone in ("housing", "roof-front-joinery") else 1.95
        if modern:
          # The two recent metal/glass families keep their broader dark
          # mullion fields; historic cream apartment frames would misidentify
          # their facade type. Full original wall containment still applies.
          w = 2.10
          h = 1.90 if zone == "housing" else 2.20
        if zone == "roof-front-joinery":
          w = 1.2
          h = 1.35
        outer = box(
          u - w / 2 - 0.07, y - h / 2 - 0.07, u + w / 2 + 0.07, y + h / 2 + 0.07
        )
        if not shape.covers(outer):
          continue
        glass = 0x718D8E if zone != "shopfront" else 0x526A6D
        frame = 0xE6DFCE if column == "ordinary" else 0x484E4A
        if modern:
          glass, frame = 0x577483, 0x3C4444
        push(s, u, y, w, h, 0.06, 0.07, glass, "glazing")
        for side in [-1, 1]:
          push(
            s,
            u + side * (w / 2 + 0.035),
            y,
            0.07,
            h + 0.14,
            0.11,
            0.135,
            frame,
            "native-family-frame",
          )
        for side in [-1, 1]:
          push(
            s,
            u,
            y + side * (h / 2 + 0.035),
            w,
            0.07,
            0.11,
            0.135,
            frame,
            "native-family-frame",
          )
        push(s, u, y, w, 0.055, 0.09, 0.14, frame, "native-common-transom")
        push(
          s,
          u,
          y - h / 2 - 0.06,
          w + 0.14,
          0.06,
          0.18,
          0.14,
          0x8A9294 if modern else 0xAAA798,
          "native-source-sill",
        )
        if column == "oriel":
          push(s, u, y, 0.07, h, 0.10, 0.15, frame, "native-source-oriel-division")
        counts[s["run"]] += 1
        groups[s["run"]].append(
          {
            "surface": si,
            "u": u,
            "y": y,
            "zone": zone,
            "column": column,
            "outerBounds": list(outer.bounds),
          }
        )
    # Paired panel seams follow shared family floor boundaries and skip openings.
    centers = f["residentialFloorCenters"]
    ys = [(a + b) / 2 for a, b in zip(centers, centers[1:])]
    if f["groundUse"] == "corner-shopfront":
      ys.insert(0, high)
    for y in ys:
      cut = shape.intersection(LineString([(u0 - 1, y), (u1 + 1, y)]))
      segments = (
        [cut]
        if cut.geom_type == "LineString"
        else list(cut.geoms)
        if hasattr(cut, "geoms")
        else []
      )
      for segment in segments:
        if segment.geom_type != "LineString" or segment.is_empty:
          continue
        a, _, b, _ = segment.bounds
        w = b - a - 0.08
        if w < 0.3:
          continue
        rectangle = box((a + b) / 2 - w / 2, y - 0.016, (a + b) / 2 + w / 2, y + 0.016)
        if shape.covers(rectangle):
          push(
            s,
            (a + b) / 2,
            y,
            w,
            0.032,
            0.04,
            0.025,
            0x929B9D if modern else 0xA3A094,
            "native-common-family-panel-seam",
          )
    checks.append(
      {
        "surface": si,
        "run": s["run"],
        "coveredWindows": sum(q["surface"] == si for q in groups[s["run"]]),
        "allOuterRectanglesInActualWallWithHoles": True,
      }
    )
  missing = [r for r in runs if not counts[r]]
  if missing:
    raise ValueError("No complete native window in modeled runs " + str(missing))
  output = {
    "schemaVersion": 1,
    "native": rows,
    "families": [
      {
        "family": f["family"],
        "residentialFloorCenters": f["residentialFloorCenters"],
        "groundFloorRange": f["groundFloorRange"],
        "roofZoneRange": f["roofZoneRange"],
      }
      for f in meta["families"]
    ],
    "runs": [
      {
        "run": r,
        "windowCount": counts[r],
        "axes": "independent3mcardinalwhole-run phase; photoorielaxesonlyasfiniteanchors",
      }
      for r in runs
    ],
    "roles": dict(roles),
    "sourceControl": 3025656564,
    "sourceSupportSha256": hashlib.sha256(SUPPORT.read_bytes()).hexdigest(),
    "compositionMetadataSha256": hashlib.sha256(META.read_bytes()).hexdigest(),
    "limits": "No original geometry or V324 recipe is changed. All actual source wall exterior rectangles remain source-contained; every residential window shares family Y across every native plane. Positions/dimensions are independently cardinal, never rotated Drawn rows.",
  }
  target = HERE / "native-composition-v325.json"
  target.write_bytes(encode(output) + b"\n")
  (HERE / "native-composition-v325-proof.json").write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "rows": len(rows),
        "windows": sum(counts.values()),
        "runs": len(counts),
        "families": len(families),
        "surfaceChecks": checks,
        "groups": dict(groups),
        "roles": dict(roles),
        "matrixColorBytes": len(rows) * 76,
        "elapsedSeconds": time.monotonic() - start,
      }
    )
    + b"\n"
  )
  print(
    json.dumps(
      {
        "rows": len(rows),
        "windows": sum(counts.values()),
        "runs": len(counts),
        "families": len(families),
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "elapsedSeconds": time.monotonic() - start,
      }
    )
  )


if __name__ == "__main__":
  main()
