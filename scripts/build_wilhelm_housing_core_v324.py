"""Compile only obsolete fittings on the finite, retained Wilhelm Core owners.

Inputs are completed original constructors from both engines and full/touch
profiles. Every source body, roof and ink line remains; a whole fitting primitive
must fit inside an independently compiled replacement wall polygon.
"""

from __future__ import annotations

import argparse
import base64
import copy
import json
import subprocess
from collections import defaultdict
from pathlib import Path

import numpy as np
from federal_ministries_v321_native import decode, row_column
from shapely.geometry import LineString, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(Path(path).read_text())


def primitives(component):
  a = component["attributes"]["position"]
  p = decode(
    a["bytes"], {"Float32Array": "<f4", "Uint16Array": "<u2"}[a["type"]]
  ).reshape(-1, a["itemSize"])[:, :3]
  if component["kind"] == "instances":
    homogeneous = np.column_stack((p, np.ones(len(p))))
    return [
      (m @ homogeneous.T).T[:, :3]
      for m in decode(component["instances"]["matrix"], "<f4")
      .reshape(-1, 4, 4)
      .transpose(0, 2, 1)
    ]
  ix = component["index"]
  order = (
    decode(
      ix["bytes"],
      {"Uint32Array": "<u4", "Uint16Array": "<u2", "Uint8Array": "u1"}[ix["type"]],
    )
    if ix
    else np.arange(len(p))
  )
  return p[order.reshape(-1, 2 if component["kind"] == "lines" else 3)]


def inside(points, patches, distance):
  for patch, polygon in patches:
    xz = points[:, [0, 2]]
    if np.max(np.abs(xz @ patch["n"] - patch["c"])) > distance:
      continue
    uv = np.column_stack((xz @ patch["d"], points[:, 1]))
    shape = Polygon(uv).convex_hull if len(uv) >= 3 else LineString(uv)
    if polygon.buffer(0.0001).covers(shape):
      return True
  return False


def drawn(capture, specification):
  patches = defaultdict(list)
  for run in specification["runs"]:
    for p in run["patches"]:
      patches[p["part"][-8:]].append((p, Polygon(p["rings"][0], p["rings"][1:])))
  owners = []
  guarded = []
  for owner in capture["owners"]:
    ident = owner["source"]["id"]
    components = copy.deepcopy(owner["parts"])
    for c in components:
      c["retire"] = (
        False
        if c["name"] in {"LoD2 prism buildings", "LoD2 prism ink lines"}
        else [
          i
          for i, points in enumerate(primitives(c))
          if inside(points, patches[ident], 0.18)
        ]
      )
    # The other literal source records remain bound by V324Sources; an owner
    # with no obsolete fitting needs no second Core index owner at all.
    record = {
      "id": ident,
      "sourcePrism": owner["source"],
      "retireBody": False,
      "components": components,
    }
    guarded.append(record)
    if any(c["retire"] for c in components):
      owners.append(record)
  # Combined constructors preserve duplicate copies of shared ink. Bind the
  # complete unchanged neighbour owners so the existing strict joint receipt
  # proves both copies; never relax multiplicity or retire an outside line.
  sharing = defaultdict(set)
  for owner in guarded:
    for c in owner["components"]:
      if c["name"] != "LoD2 prism ink lines":
        continue
      for points in primitives(c):
        sharing[points.astype("<f4").tobytes()].add(owner["id"])
  active = {o["id"] for o in owners}
  while True:
    previous = set(active)
    for group in sharing.values():
      if active.intersection(group):
        active.update(group)
    if previous == active:
      break
  owners = [owner for owner in guarded if owner["id"] in active]
  return {"schemaVersion": 1, "native": False, "owners": owners}


def native(capture, support, bindings, lookup):
  cells = {(c["x"], c["z"]): c for c in bindings["nativeVoxels"]["cells"]}
  selected = {tuple(c["column"][:2]) for c in support["sourceColumns"]}
  records = [
    dict(source=interval, contributors=cells[xy]["contributors"], retireBody=False)
    for xy in sorted(selected)
    for interval in cells[xy]["intervals"]
  ]
  if len(records) != len(selected):
    raise ValueError(
      "Complete original interval coverage required for selected columns"
    )
  patches = [(p, Polygon(p["rings"][0], p["rings"][1:])) for p in support["surfaces"]]
  owners = defaultdict(list)
  bodies = set()
  for part in capture["parts"]:
    window = part["name"] == "Voxel facade windows"
    groups = defaultdict(list)
    for row in part["rows"]:
      xy = row_column(row, window=window)
      if xy in selected:
        groups[min(cells[xy]["contributors"])].append(row)
    for owner, rows in groups.items():
      c = {
        "name": part["name"],
        "kind": "instances",
        "attributes": part["attributes"],
        "index": part["index"],
        "instances": {
          "count": len(rows),
          "matrix": base64.b64encode(
            b"".join(base64.b64decode(r["matrix"]) for r in rows)
          ).decode(),
          "color": base64.b64encode(
            b"".join(base64.b64decode(r["color"]) for r in rows)
          ).decode(),
        },
        "retire": False,
      }
      if window:
        c["retire"] = [
          i for i, points in enumerate(primitives(c)) if inside(points, patches, 0.081)
        ]
      else:
        bodies.add(owner)
      owners[owner].append(c)
  if set(owners) - bodies:
    raise ValueError("Every old fitting requires its actual original body")
  return {
    "schemaVersion": 1,
    "native": True,
    "owners": [
      {
        "id": ident,
        "sourcePrism": lookup[ident],
        "retireBody": False,
        "components": owners[ident],
      }
      for ident in sorted(owners)
    ],
    "nativeSource": {
      "cell": 4,
      "grid": bindings["nativeVoxels"]["grid"],
      "columns": records,
    },
  }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--ownership", type=Path, required=True)
  args = parser.parse_args()
  folder = args.ownership.resolve()
  specification = read(folder / "core41-input-v324.json")
  draws = [
    drawn(read(folder / f"core41-actual-v324/{engine}.json"), specification)
    for engine in ["bun", "node"]
  ]
  if draws[0] != draws[1]:
    raise ValueError("Selected Drawn constructor components differ by engine")
  support = read(folder / "native-core-support-v324.json")
  bindings = read(DATA / "wilhelmHousingV324Sources.json")
  lookup = {
    p["id"]: p
    for p in read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
      "buildings"
    ]
  }
  plans = {"drawn": draws[0]}
  for mode, key in [("full", "nativeFull"), ("mobile", "nativeMobile")]:
    actual = [
      read(folder / f"core41-native-actual-v324/{engine}-{mode}.json")
      for engine in ["bun", "node"]
    ]
    if actual[0]["parts"] != actual[1]["parts"]:
      raise ValueError(f"Complete original Native {mode} components differ by engine")
    plans[key] = native(actual[0], support, bindings, lookup)
  out = DATA / "wilhelmHousingV324Core.json"
  out.write_text(
    json.dumps({"schemaVersion": 1, **plans}, separators=(",", ":")) + "\n"
  )
  code = "import{readFileSync}from'node:fs';const d=JSON.parse(readFileSync(process.argv[1],'utf8'));const h=v=>{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h};console.log(JSON.stringify(Object.fromEntries(['drawn','nativeFull','nativeMobile'].map(k=>[k,h(d[k])]))));"
  controls = subprocess.check_output(
    ["bun", "--eval", code, str(out)], text=True
  ).strip()
  module = """/** Complete original Core bodies prove only finite obsolete fitting retirement. */
import source from "./data/wilhelmHousingV324Core.json";
import type {ExactOwnersPlanV321} from "./ExactOwnersV321";
const CONTROLS = __CONTROLS__;
export function wilhelmHousingCorePlanV324(native=false,mobileLike=false):{plan:ExactOwnersPlanV321;control:number}{
 const key=native?(mobileLike?"nativeMobile":"nativeFull"):"drawn";
 return {plan:source[key] as unknown as ExactOwnersPlanV321,control:CONTROLS[key]};
}
""".replace("__CONTROLS__", controls)
  (ROOT / "src/app/src/WilhelmHousingV324Core.ts").write_text(module)
  report = {
    k: {
      "owners": len(p["owners"]),
      "retired": sum(
        len(c["retire"])
        for o in p["owners"]
        for c in o["components"]
        if isinstance(c["retire"], list)
      ),
      "sourceBodiesRetired": 0,
    }
    for k, p in plans.items()
  }
  (folder / "core-plan-proof-v324.json").write_text(json.dumps(report, indent=2) + "\n")
  print(json.dumps(report))


if __name__ == "__main__":
  main()
