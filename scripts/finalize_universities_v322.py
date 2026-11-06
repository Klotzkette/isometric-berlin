"""Freeze exact university Core/preview/native recipes from real constructors.

The original constructors and source records are never edited. Every full body
retirement has a complete original-record identity and original rendered tuples.
Mixed native columns remain with their original source owners.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from federal_ministries_v321_native import native_columns, native_plans, row_column

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  raw = Path(path).read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  Path(path).write_bytes(
    gzip.compress(raw, mtime=0) if str(path).endswith(".gz") else raw
  )


def sha(path):
  return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def core_plan(capture):
  return {
    "schemaVersion": 1,
    "native": False,
    "owners": [
      {
        "id": o["source"]["id"],
        "sourcePrism": o["source"],
        "retireBody": True,
        "components": [{**part, "retire": True} for part in o["parts"]],
      }
      for o in capture["owners"]
      if o["parts"]
    ],
  }


def balance_shared_cells(plan, lookup, active):
  """Assign a shared retired cell once while proving every contributing owner.

  A small original annex can contribute only to cells also owned by its larger
  neighbour. Give it one complete actual shared cell, never duplicate a matrix.
  Both original contributor records still bind the same exact raw column.
  """
  present = {o["id"] for o in plan["owners"]}
  for identity in sorted(active - present):
    record = next(
      (
        c
        for c in plan["nativeSource"]["columns"]
        if c["retireBody"]
        and identity in c["contributors"]
        and min(c["contributors"]) in present
      ),
      None,
    )
    if record is None:
      # An owner completely absent from the actual voxel source is not invented.
      if any(identity in c["contributors"] for c in plan["nativeSource"]["columns"]):
        raise ValueError("Unproven shared native contributor")
      continue
    donor = next(o for o in plan["owners"] if o["id"] == min(record["contributors"]))
    moved = []
    cell = tuple(record["source"][:2])
    for component in donor["components"]:
      instances = component["instances"]
      matrices = np.frombuffer(base64.b64decode(instances["matrix"]), "<f4").reshape(
        -1, 16
      )
      colors = np.frombuffer(base64.b64decode(instances["color"]), "<f4").reshape(-1, 3)
      choose = [
        i
        for i, matrix in enumerate(matrices)
        if row_column(
          {"matrix": base64.b64encode(matrix.tobytes()).decode()},
          window=component["name"] == "Voxel facade windows",
        )
        == cell
      ]
      if not choose:
        continue
      keep = [i for i in range(len(matrices)) if i not in set(choose)]

      def portion(indices):
        return {
          "count": len(indices),
          "matrix": base64.b64encode(matrices[indices].tobytes()).decode(),
          "color": base64.b64encode(colors[indices].tobytes()).decode(),
        }

      moved.append({**component, "instances": portion(choose), "retire": True})
      component["instances"] = portion(keep)
      component["retire"] = True
    donor["components"] = [c for c in donor["components"] if c["instances"]["count"]]
    if not any(c["name"] == "Voxel building columns" for c in moved) or not any(
      c["name"] == "Voxel building columns" for c in donor["components"]
    ):
      raise ValueError("A shared-cell assignment lost an actual body proof")
    plan["owners"].append(
      {
        "id": identity,
        "sourcePrism": lookup[identity],
        "retireBody": True,
        "components": moved,
      }
    )
    present.add(identity)
  plan["owners"].sort(key=lambda o: o["id"])


def finalize(bounded: Path, native: Path, previous_native: Path):
  draws = [read(bounded / "drawn" / f"{engine}.json") for engine in ("bun", "node")]
  previews = [
    read(bounded / "preview" / f"{engine}.json") for engine in ("bun", "node")
  ]
  if (
    draws[0]["owners"] != draws[1]["owners"]
    or previews[0]["owners"] != previews[1]["owners"]
  ):
    raise ValueError("Actual constructor engine tuples differ")
  drawn, preview = core_plan(draws[0]), core_plan(previews[0])
  active = {o["id"] for o in drawn["owners"]}
  if active != {o["id"] for o in preview["owners"]} or len(active) != 21:
    raise ValueError(
      "Every actually active source owner must have Core and preview proof"
    )
  prisms = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  voxels = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  lookup = {p["id"]: p for p in prisms}
  columns, mixed = native_columns(prisms, voxels, active, active)
  paths = [native / "node-full.json", native / "node-mobile.json"]
  engine_proofs = []
  for mode, path in zip(("full", "mobile"), paths, strict=True):
    current, prior = read(path), read(previous_native / f"bun-{mode}.json")
    for part in current["parts"]:
      old = next(p for p in prior["parts"] if p["name"] == part["name"])
      if {k: v for k, v in part.items() if k != "rows"} != {
        k: v for k, v in old.items() if k != "rows"
      }:
        raise ValueError("Native primitive/count differs across actual engines")
      actual = {r["index"]: r for r in part["rows"]}
      for row in old["rows"]:
        if actual.get(row["index"]) != row:
          raise ValueError(
            "A previously captured actual native row differs across engines"
          )
      engine_proofs.append(
        {
          "mode": mode,
          "host": part["name"],
          "commonRows": len(old["rows"]),
          "exact": True,
        }
      )
    body = next(p for p in current["parts"] if p["name"] == "Voxel building columns")
    cells = {row_column(r) for r in body["rows"]}
    missing = [r for r in columns if tuple(r["source"][:2]) not in cells]
    if missing:
      raise ValueError(
        (mode, "An exclusive source column is outside the actual capture", missing[:2])
      )
  plans = native_plans(*paths, columns, lookup, {}, active)
  for plan in plans.values():
    plan["nativeSource"]["grid"] = voxels["grid"]
    balance_shared_cells(plan, lookup, active)
    # Full retired contributors are part of this one finite source catalogue.
    # Native cells with a foreign contributor were already excluded above.
    for record in plan["nativeSource"]["columns"]:
      if record["retireBody"] and not all(i in active for i in record["contributors"]):
        raise ValueError("Mixed native ownership cannot retire a body")
  result = {"schemaVersion": 1, "plans": {"drawn": drawn, **plans, "preview": preview}}
  write(DATA / "universitiesPreviousV322.json", result)
  runtime = read(DATA / "universitiesArchitectureV322.json")
  runtime["sourcePrisms"] = [o["source"] for o in draws[0]["owners"]]
  runtime["oldBodies"] = [lookup[i] for i in sorted(active)]
  write(DATA / "universitiesArchitectureV322.json", runtime)
  proof = {
    "schemaVersion": 1,
    "baseline": "c3f8ca120908d264ab5921f1fe090b4bf2db3767",
    "activeOwners": sorted(active),
    "preservedAbsentOwners": [
      o["source"]["id"] for o in draws[0]["owners"] if not o["parts"]
    ],
    "engineProofs": engine_proofs,
    "nativeExclusiveColumns": len(columns),
    "mixedColumnsPreserved": mixed,
    "captureSha256": {
      str(p): sha(p)
      for p in [
        bounded / "drawn/bun.json",
        bounded / "drawn/node.json",
        bounded / "preview/bun.json",
        bounded / "preview/node.json",
        *paths,
      ]
    },
    "planSha256": sha(DATA / "universitiesPreviousV322.json"),
    "profileSha256": sha(DATA / "universitiesArchitectureV322.json"),
  }
  write(GEO / "universities-v322-previous-evidence.json.gz", proof)
  print(
    json.dumps(
      {
        "owners": len(active),
        "columns": len(columns),
        "mixedPreserved": len(mixed),
        "plans": {k: len(v["owners"]) for k, v in result["plans"].items()},
      }
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("bounded", type=Path)
  parser.add_argument("native", type=Path)
  parser.add_argument("previous_native", type=Path)
  args = parser.parse_args()
  finalize(args.bounded, args.native, args.previous_native)
