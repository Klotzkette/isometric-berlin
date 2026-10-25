"""Whole Moabit audit, exact source selectors, independent native wall evidence."""

import numpy as np
from shapely.geometry import LineString, Point, Polygon

from scripts import audit_moabit_houses_v269 as build


def test_whole_ortsteil_inventory_and_every_residential_quarter():
  e = build.base.read_json(build.AUDIT)
  assert e["coreParts"] == 5564 and len(e["invalidCoreParts"]) == 14
  assert e["streamNavigationParts"] == 1268 and e["distinctStreamOwners"] == 1151
  assert sum(e["coreDisposition"].values()) == e["coreParts"]
  for name, q in e["quarters"].items():
    if name == "Hansaviertel":
      assert not q  # Boundary precision sliver only; independent Ortsteil not added.
      continue
    assert q["selectedCoreFronts"] > 0 and q["nativeCoreFaces"] > 0
  for p, digest in e["inputs"].items():
    assert build.base.digest(build.ROOT / p) == digest
  for p, digest in e["assets"].items():
    assert build.base.digest(build.OUT / p) == digest


def test_exact_complete_core_part_and_public_wall_guards_leave_material_and_roof_intact():
  e = build.base.read_json(build.AUDIT)
  data = build.base.read_json(build.CORE)
  old = build.base.read_json(build.PRISMS)["buildings"]
  original_fronts = [
    LineString([f["a"], f["b"]])
    for f in build.base.read_json(build.base.EVIDENCE)["faces"]
    if f["district"] == "Moabit"
  ]
  assert len(data["core"]) == len(e["selected"]) == 1257
  for r in e["selected"]:
    b = r["source"]
    f = r["face"]
    plan = data["core"][r["owner"]]
    assert b in old and build.core_guard(b) == plan["guard"]
    assert r["owner"] not in build.BLOCKED
    assert r["ground"] == b["y0_dm"] / 10 and r["height"] == b["h_dm"] / 10
    a, end = (
      np.array(b["ring"][f["sourceRingEdge"]]) / 10,
      np.array(b["ring"][(f["sourceRingEdge"] + 1) % len(b["ring"])]) / 10,
    )
    assert np.allclose(a, f["a"]) and np.allclose(end, f["b"])
    assert plan["a"] == f["a"] and plan["b"] == f["b"]
    assert f["length"] >= 7 and f["streetId"] and f["street"]
    line = LineString([a, end])
    assert all(
      line.intersection(g.buffer(0.22, cap_style="flat")).length <= line.length * 0.5
      for g in original_fronts
    )


def test_independent_native_planes_are_actual_exposed_frozen_voxel_columns():
  e = build.base.read_json(build.AUDIT)
  v = build.base.read_json(build.VOXELS)
  data = build.base.read_json(build.CORE)
  columns = {}
  for iz, row in enumerate(v["building_rows"]):
    z = v["grid"]["min_z_idx"] + iz
    for x, n, y0, y1, c in row:
      for i in range(n):
        columns[(v["grid"]["min_x_idx"] + x + i, z)] = [y0, y1, c]
  sources = {r["owner"]: r for r in e["selected"]}
  assert len(e["nativeFaces"]) == len(data["native"]) == 5168
  for x, z, dx, dz, y0, y1, owner in e["nativeFaces"]:
    assert abs(dx) + abs(dz) == 1 and columns[(x, z)] == [y0, y1, 3]
    assert data["native"][f"{x},{z},{dx},{dz}"] == [y0, y1, owner]
    source = sources[owner]["source"]
    p = Polygon(
      np.array(source["ring"]) / 10, [np.array(r) / 10 for r in source.get("holes", [])]
    )
    assert p.covers(Point((x + 0.5) * 4, (z + 0.5) * 4))
    neighbour = columns.get((x + dx, z + dz))
    assert not neighbour or neighbour[1] < y1 - 10
