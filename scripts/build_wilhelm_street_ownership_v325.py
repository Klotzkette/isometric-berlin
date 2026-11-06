"""Reproduce finite fitting-only Core plans from retained actual-engine captures.

No city constructor, network, old source write, body/roof/navigation edit, or
new compression codec. Output must be a fresh external JSON path.
"""

from __future__ import annotations

import argparse
import base64
import json
import struct
from pathlib import Path
from typing import Any

import build_wilhelm_housing_retirements_v324 as old
import numpy as np
from shapely.geometry import MultiPoint, Polygon

ROOT = Path(__file__).resolve().parents[1]


def values(a: dict[str, Any]) -> np.ndarray:
  return old.attr_values(a)


def primitive_positions(part: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
  p = values(part["attributes"]["position"])
  ix = part["index"]
  width = 2 if part["kind"] == "lines" else 3
  indices = (
    np.frombuffer(
      base64.b64decode(ix["bytes"]), "<u2" if ix["type"] == "Uint16Array" else "<u4"
    ).reshape(-1, width)
    if ix
    else np.arange(len(p)).reshape(-1, width)
  )
  return p, indices


def within(points: Any, masks: list[dict[str, Any]]) -> bool:
  q = np.asarray(points)
  for p in masks:
    n = np.asarray(p["n"])
    d = np.asarray(p["d"])
    dist = q[:, [0, 2]] @ n - p["c"]
    if min(dist) < -0.2 or max(dist) > 0.65:
      continue
    shape = MultiPoint(np.column_stack([q[:, [0, 2]] @ d, q[:, 1]])).convex_hull
    if Polygon(p["rings"][0], p["rings"][1:]).buffer(0.0002).covers(shape):
      return True
  return False


def corners(matrix: Any, positions: Any = None) -> np.ndarray:
  m = np.asarray(matrix).reshape(4, 4).T
  points = (
    positions
    if positions is not None
    else [(x, y, z) for x in [-0.5, 0.5] for y in [-0.5, 0.5] for z in [-0.5, 0.5]]
  )
  return np.asarray([(m @ np.array([x, y, z, 1]))[:3] for x, y, z in points])


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()
  if (
    not args.output.is_absolute()
    or args.output.exists()
    or not args.output.parent.is_dir()
    or args.output.is_relative_to(ROOT)
  ):
    raise ValueError("A fresh absolute external output is required")
  if args.output.parent.is_symlink():
    raise ValueError("Symlink output parent rejected")
  evidence = old.read(
    ROOT / "geo_data/regierungsviertel/wilhelm-street-v325-evidence.json.gz"
  )
  profile = old.read(ROOT / "src/app/src/data/wilhelmStreetFrontsV325.json")
  spec = old.read(ROOT / "src/app/src/data/wilhelmStreetFrontsV325Sources.json")
  nativeSupport = evidence["actualNativeSupport"]
  prisms = old.read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  byid = {p["id"]: p for p in prisms}
  patches = {}
  for run in profile["runs"]:
    for patch in run["patches"]:
      patches.setdefault(patch["part"], []).append(patch)
  plans = {}
  summary = []
  for engine in ["bun", "node"]:
    capture = evidence["actualDrawn"][engine]
    owners = []
    counts = {}
    for record in capture["owners"]:
      pid = record["source"]["id"]
      masks = patches.get(pid, [])
      parts = []
      total = 0
      for part in record["parts"]:
        retire = []
        if part["kind"] == "lines" and part["name"] == "LoD2 facade axes":
          p, ix = primitive_positions(part)
          retire = [i for i, t in enumerate(ix) if within(p[t], masks)]
        elif part["kind"] == "instances" and part["name"] == "LoD2 facade night strips":
          a = np.frombuffer(
            base64.b64decode(part["instances"]["matrix"]), "<f4"
          ).reshape(-1, 16)
          retire = [
            i
            for i, m in enumerate(a)
            if within(corners(m, values(part["attributes"]["position"])), masks)
          ]
        total += len(retire)
        parts.append({**part, "retire": retire if retire else False})
      if total:
        owners.append(
          {
            "id": pid,
            "sourcePrism": record["source"],
            "retireBody": False,
            "components": parts,
          }
        )
        counts[pid] = total

    # Exact shared prism-ink multiplicity requires the complete unchanged neighbour too.
    def inkkeys(record):
      result = set()
      for part in record["parts"]:
        if part["kind"] != "lines" or part["name"] != "LoD2 prism ink lines":
          continue
        p, ix = primitive_positions(part)
        for tri in ix:
          result.add(
            tuple(np.asarray(p[tri], dtype="<f4").view("<u4").reshape(-1).tolist())
          )
      return result

    allkeys = {r["source"]["id"]: inkkeys(r) for r in capture["owners"]}
    included = {o["id"] for o in owners}
    guards = []
    while True:
      chosen = set().union(*(allkeys[i] for i in included)) if included else set()
      new = [
        r
        for r in capture["owners"]
        if r["source"]["id"] not in included and allkeys[r["source"]["id"]] & chosen
      ]
      if not new:
        break
      for record in new:
        pid = record["source"]["id"]
        included.add(pid)
        guards.append(pid)
        owners.append(
          {
            "id": pid,
            "sourcePrism": record["source"],
            "retireBody": False,
            "components": [{**part, "retire": False} for part in record["parts"]],
          }
        )
    plans["drawn" if engine == "bun" else "drawnV8"] = {
      "schemaVersion": 1,
      "native": False,
      "owners": owners,
    }
    summary.append(
      {
        "mode": engine,
        "owners": len(owners),
        "selected": counts,
        "retiredPrimitives": sum(counts.values()),
        "unchangedJointInkGuards": guards,
      }
    )
  # A native receipt claims finite, exclusively same-family original cells, never body retirement.
  familyByPrism = {pid: f["id"] for f in profile["families"] for pid in f["prismIds"]}
  cellFamily = {}
  for cell in spec["nativeVoxels"]["cells"]:
    ids = set(cell["contributors"])
    if ids:
      fs = {familyByPrism.get(i) for i in ids}
      if len(fs) == 1 and None not in fs:
        cellFamily[cell["x"], cell["z"]] = next(iter(fs))
  for mode in ["full", "mobile"]:
    capture = evidence["actualNative"][mode]
    body = next(p for p in capture["parts"] if p["name"] == "Voxel building columns")
    window = next(
      (p for p in capture["parts"] if p["name"] == "Voxel facade windows"), None
    )
    families = {}
    selectedCells = set()
    for row in body["rows"]:
      m = struct.unpack("<16f", base64.b64decode(row["matrix"]))
      cell = (round(m[12] / 4 - 0.5), round(m[14] / 4 - 0.5))
      f = cellFamily.get(cell)
      if f and any(r["family"] == f for r in profile["runs"]):
        families.setdefault(f, {"body": [], "panes": [], "cells": set()})[
          "body"
        ].append(row)
        families[f]["cells"].add(cell)
    if window:
      for row in window["rows"]:
        m = struct.unpack("<16f", base64.b64decode(row["matrix"]))
        q = corners(m, values(window["attributes"]["position"]))
        hits = []
        for f, rows in families.items():
          masks = [s for s in nativeSupport["surfaces"] if s["family"] == f]
          if within(q, masks):
            hits.append(f)
        if len(hits) > 1:
          raise ValueError("Ambiguous native pane family")
        if hits:
          families[hits[0]]["panes"].append(row)
    owners = []
    columns = []
    for fid, rows in families.items():
      # Only families with actual old windows need a new Core transaction. Touch has no old panes.
      if not rows["panes"]:
        continue
      candidate = next(f for f in profile["families"] if f["id"] == fid)
      representative = sorted(candidate["prismIds"])[0]
      components = []
      for host, items, retire in [
        (body, rows["body"], False),
        (window, rows["panes"], True),
      ]:
        components.append(
          {
            "name": host["name"],
            "kind": "instances",
            "attributes": host["attributes"],
            "index": host["index"],
            "instances": {
              "count": len(items),
              "matrix": base64.b64encode(
                b"".join(base64.b64decode(r["matrix"]) for r in items)
              ).decode(),
              "color": base64.b64encode(
                b"".join(base64.b64decode(r["color"]) for r in items)
              ).decode(),
            },
            "retire": retire,
          }
        )
      owners.append(
        {
          "id": representative,
          "sourcePrism": byid[representative],
          "retireBody": False,
          "components": components,
        }
      )
      selectedCells.update(rows["cells"])
    for cell in spec["nativeVoxels"]["cells"]:
      if (cell["x"], cell["z"]) in selectedCells:
        columns.extend(
          {"source": v, "contributors": cell["contributors"], "retireBody": False}
          for v in cell["intervals"]
        )
    # Keep an actually proved body-only member in Touch so the shared closed binder remains meaningful.
    if not owners:
      fid, rows = next(iter(families.items()))
      candidate = next(f for f in profile["families"] if f["id"] == fid)
      representative = sorted(candidate["prismIds"])[0]
      items = rows["body"]
      owners = [
        {
          "id": representative,
          "sourcePrism": byid[representative],
          "retireBody": False,
          "components": [
            {
              "name": body["name"],
              "kind": "instances",
              "attributes": body["attributes"],
              "index": body["index"],
              "instances": {
                "count": len(items),
                "matrix": base64.b64encode(
                  b"".join(base64.b64decode(r["matrix"]) for r in items)
                ).decode(),
                "color": base64.b64encode(
                  b"".join(base64.b64decode(r["color"]) for r in items)
                ).decode(),
              },
              "retire": False,
            }
          ],
        }
      ]
      for cell in spec["nativeVoxels"]["cells"]:
        if (cell["x"], cell["z"]) in rows["cells"]:
          columns.extend(
            {"source": v, "contributors": cell["contributors"], "retireBody": False}
            for v in cell["intervals"]
          )
    key = "nativeFull" if mode == "full" else "nativeMobile"
    plans[key] = {
      "schemaVersion": 1,
      "native": True,
      "owners": owners,
      "nativeSource": {
        "cell": 4,
        "grid": spec["nativeVoxels"]["grid"],
        "columns": columns,
      },
    }
    summary.append(
      {
        "mode": key,
        "owners": len(owners),
        "retiredPanes": sum(
          o["components"][-1]["instances"]["count"]
          for o in owners
          if o["components"][-1]["retire"]
        ),
        "bodyRetirement": False,
        "columns": len(columns),
      }
    )
  base = {o["id"]: o for o in plans["drawn"]["owners"]}
  changed = [o for o in plans["drawnV8"]["owners"] if o != base[o["id"]]]
  plans["drawnV8"] = {
    "schemaVersion": 1,
    "native": False,
    "baseControl": 1895311961,
    "owners": changed,
  }
  args.output.write_bytes(old.encode(plans) + b"\n")
  print(
    json.dumps({"output": str(args.output), "summary": summary}, separators=(",", ":"))
  )


if __name__ == "__main__":
  main()
