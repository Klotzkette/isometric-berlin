"""Finalize the finite Federal V321 catalogues from real constructor captures.

Original captures and complete source sheets are immutable inputs. No old asset
is repacked. Fine facade members are contextual display fits, not survey data.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_federal_ministries_v321 import (
  DATA,
  GEO,
  OLD_BODIES,
  ROOT,
  build,
  packed,
  paint_face,
  read,
  write,
)
from build_karl_marx_allee_v161 import Detail
from federal_ministries_v321_native import (
  capture_parts,
  decode,
  native_columns,
  native_plans,
  on_faces,
  primitive_world_faces,
  selected_cardinal_faces,
)
from shapely.geometry import Polygon


def decoded_mesh(mesh, origin):
  p = decode(mesh["positions"], "<u2").reshape(-1, 3) / 100 + np.asarray(origin)
  index = decode(mesh["indices"], "<u4").reshape(-1, 3)
  return p[index]


def add_door_voids(face, doors, native):
  for source in doors:
    if source["owner"] != face.get("parent", face["owner"]):
      continue
    door = source.get("native") if native else source
    if not door:
      continue
    a, d, n = map(np.asarray, [face["a"], face["d"], face["n"]])
    point = np.asarray(door["point"])
    if abs(float((point - a) @ n)) > 0.06:
      continue
    u = float((point - a) @ d)
    half = (door["width"] + 0.5) / 2
    face["voids"].append(
      [u - half, u + half, door["low"] - 0.02, door["low"] + door["height"] + 0.25]
    )


def owner_faces(runtime):
  result = defaultdict(list)
  for site in runtime["sites"]:
    for face in site["faces"]:
      result[face["owner"][-8:]].append(face)
      result[face["owner"]].append(face)
  return result


def component_points(component):
  if component["kind"] == "instances":
    values = decode(component["instances"]["matrix"], "<f4").reshape(-1, 16)
    return [np.array([[r[12], r[13], r[14]]]) for r in values]
  attr = component["attributes"]["position"]
  types = {"Float32Array": "<f4", "Uint16Array": "<u2", "Uint8Array": "u1"}
  values = decode(attr["bytes"], types[attr["type"]]).reshape(-1, attr["itemSize"])
  index = component["index"]
  order = (
    decode(
      index["bytes"],
      {"Uint32Array": "<u4", "Uint16Array": "<u2", "Uint8Array": "u1"}[index["type"]],
    )
    if index
    else np.arange(len(values))
  )
  width = 2 if component["kind"] == "lines" else 3
  return values[order.reshape(-1, width)]


def drawn_plan(capture, runtime):
  faces = owner_faces(runtime)
  items = []
  for owner in capture["owners"]:
    source = owner["source"]
    ident = source["id"]
    if ident not in faces and ident not in OLD_BODIES:
      continue
    components = []
    for part in owner["parts"]:
      c = copy.deepcopy(part)
      if ident in OLD_BODIES:
        c["retire"] = True
      elif c["name"] in {"LoD2 prism buildings", "LoD2 prism ink lines"}:
        c["retire"] = False
      else:
        c["retire"] = [
          i
          for i, pts in enumerate(component_points(c))
          if all(on_faces(p, faces[ident], tolerance=0.65) for p in pts)
        ]
      components.append(c)
    items.append(
      {
        "id": ident,
        "sourcePrism": source,
        "retireBody": ident in OLD_BODIES,
        "components": components,
      }
    )
  return {"schemaVersion": 1, "native": False, "owners": items}


def finalize(capture_dir):
  runtime = build()
  lookup = {
    p["id"]: p
    for p in read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
      "buildings"
    ]
  }
  draw_capture = read(capture_dir / "core-bounded-r4/bun.json")
  if (
    draw_capture["owners"] != read(capture_dir / "core-bounded-r4/node.json")["owners"]
  ):
    raise ValueError("Actual Drawn engines differ")
  plan = drawn_plan(draw_capture, runtime)
  wanted = {p["id"] for p in plan["owners"]}
  voxels = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  columns, mixed = native_columns(
    list(lookup.values()), voxels, wanted, set(OLD_BODIES)
  )
  full_path, touch_path = (
    capture_dir / "native-full-r3/bun-full.json",
    capture_dir / "native-full-r3/bun-mobile.json",
  )
  full, touch = read(full_path), read(touch_path)
  for mobile, current in [("full", full), ("mobile", touch)]:
    if (
      current["parts"]
      != read(capture_dir / f"native-full-r3/node-{mobile}.json")["parts"]
    ):
      raise ValueError("Actual Native engines differ")
  native = native_plans(
    full_path, touch_path, columns, lookup, owner_faces(runtime), set(OLD_BODIES)
  )
  for p in native.values():
    p["nativeSource"]["grid"] = voxels["grid"]
  # Build recognition fronts only on actual delivered orthogonal hosts.
  all_triangles = []
  for detail in runtime["_nativeModels"].values():
    all_triangles.extend(t for t, _, _ in detail.triangles)
  manifest = read(DATA / "altMitteNativeV169Source.json")
  bounds = [
    Polygon(p["ring"], p["holes"]).bounds
    for parts in runtime["_parts"].values()
    for p in parts
  ]
  for row in manifest["chunkFiles"]:
    packet = read(DATA / row["file"])
    x, _, z = packet["origin"]
    if not any(
      x <= b[2] + 4 and x + 512 >= b[0] - 4 and z <= b[3] + 4 and z + 512 >= b[1] - 4
      for b in bounds
    ):
      continue
    for mesh in packet["meshes"]:
      all_triangles.extend(decoded_mesh(mesh, packet["origin"]))
  body = capture_parts(full_path)["Voxel building columns"]
  for _, axis, sign, plane, shape in primitive_world_faces(body, columns):
    polygons = [shape] if shape.geom_type == "Polygon" else list(shape.geoms)
    for polygon in polygons:
      if polygon.geom_type != "Polygon":
        continue
      # Cardinal rectangle parts only, from actual original matrices.
      coords = list(polygon.exterior.coords[:-1])
      points = [[plane, y, u] if axis == 0 else [u, y, plane] for u, y in coords]
      for i in range(1, len(points) - 1):
        tri = np.array([points[0], points[i], points[i + 1]])
        if np.cross(tri[1] - tri[0], tri[2] - tri[0])[axis] * sign < 0:
          tri = tri[::-1]
        all_triangles.append(tri.tolist())
  doors = read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  for site in runtime["sites"]:
    site["nativeFaces"] = selected_cardinal_faces(all_triangles, site["faces"])
    if not site["nativeFaces"]:
      raise ValueError("No actual native public hosts: " + site["key"])
    paints = {False: Detail(), True: Detail()}
    parent_by_leaf = {f["owner"]: f.get("parent", f["owner"]) for f in site["faces"]}
    details_by_leaf = {f["owner"]: f["detail"] for f in site["faces"] if "detail" in f}
    for is_native, faces in [(False, site["faces"]), (True, site["nativeFaces"])]:
      for face in faces:
        face["parent"] = parent_by_leaf.get(
          face["owner"], face.get("parent", face["owner"])
        )
        if face["owner"] in details_by_leaf:
          face["detail"] = details_by_leaf[face["owner"]]
        add_door_voids(face, doors, is_native)
        paint_face(
          paints[is_native],
          face,
          face.get("detail", site)["palette"][0],
          0.22 if not is_native else 0.04,
        )
    print(site["key"], "nativeFaces", len(site["nativeFaces"]), flush=True)
    for is_native, detail in paints.items():
      runtime["models"].append(
        packed(detail, site["key"] + "-public-facade-veneer", is_native)
      )
  runtime["nativeColumns"] = {
    "cellM": voxels["cell_m"],
    "grid": voxels["grid"],
    "records": [
      {
        "tuple": c["source"],
        "contributors": c["contributors"],
        "exclusive": c["retireBody"],
        "owner": min(c["contributors"]),
      }
      for c in columns
      if c["retireBody"]
    ],
  }
  preview_capture = read(capture_dir / "preview-r1/bun.json")
  if preview_capture["owners"] != read(capture_dir / "preview-r1/node.json")["owners"]:
    raise ValueError("Actual preview engines differ")
  preview = {
    "schemaVersion": 1,
    "native": False,
    "owners": [
      {
        "id": p["source"]["id"],
        "sourcePrism": p["source"],
        "retireBody": True,
        "components": [{**c, "retire": True} for c in p["parts"]],
      }
      for p in preview_capture["owners"]
      if p["source"]["id"] in OLD_BODIES
    ],
  }
  central_capture = read(capture_dir / "central-r2/bun.json")
  if central_capture != read(capture_dir / "central-r2/node.json"):
    raise ValueError("Actual central motif engines differ")
  central = {
    "schemaVersion": 1,
    "native": False,
    "owners": [
      {
        "id": "bpbGgD9p",
        "sourcePrism": lookup["bpbGgD9p"],
        "components": central_capture["parts"],
      }
    ],
  }
  previous = {
    "schemaVersion": 1,
    "plans": {"drawn": plan, **native, "preview": preview, "central": central},
  }
  transport = {k: v for k, v in runtime.items() if not k.startswith("_")}
  write(DATA / "federalMinistriesV321.json", transport)
  write(DATA / "federalMinistriesV321Previous.json", previous)
  proof = {
    "schemaVersion": 1,
    "actualCaptures": {
      str(p.relative_to(capture_dir)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [
        capture_dir / "core-bounded-r4/bun.json",
        capture_dir / "core-bounded-r4/node.json",
        full_path,
        touch_path,
        capture_dir / "native-full-r3/node-full.json",
        capture_dir / "native-full-r3/node-mobile.json",
        capture_dir / "preview-r1/bun.json",
        capture_dir / "preview-r1/node.json",
      ]
    },
    "columns": columns,
    "mixedRetained": mixed,
    "oldOwners": OLD_BODIES,
    "sourcePrisms": list(lookup.values()) if False else [],
    "counts": {
      "drawnOwners": len(plan["owners"]),
      "nativeFullOwners": len(native["nativeFull"]["owners"]),
      "nativeTouchOwners": len(native["nativeTouch"]["owners"]),
      "columns": len(columns),
      "mixedKept": len(mixed),
    },
    "policy": "Every actual source column contributor is positive-area verified; every foreign or preserved tower contribution stays. Full source tuples and outside words remain unchanged.",
  }
  write(GEO / "federal-ministries-v321-native-evidence.json.gz", proof)
  for filename in ["federalMinistriesV321.json", "federalMinistriesV321Previous.json"]:
    b = (DATA / filename).read_bytes()
    print(filename, len(b), "gzip", len(gzip.compress(b, mtime=0)), flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--capture-dir", type=Path, required=True)
  finalize(parser.parse_args().capture_dir)
