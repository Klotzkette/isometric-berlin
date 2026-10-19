"""Complete mapped museum bridge plans, lane evidence and native geometry."""

import base64

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_museum_bridges_v243 as build


def test_sources_and_previous_owners_are_unchanged():
  source, evidence = build.read(build.SOURCE), build.read(build.EVIDENCE)
  assert evidence["sourceSha256"] == build.digest(build.SOURCE)
  assert evidence["outputSha256"] == build.digest(build.OUTPUT)
  assert source["previousSha256"] == build.digest(build.PREVIOUS)
  assert evidence["unchangedV242Sha256"] == build.digest(
    build.DATA / "spreeBridgesV242.json"
  )
  assert source["groundSha256"] == build.digest(
    build.ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  )
  assert {b["id"] for b in source["bridges"]} == set(build.OWNERS)
  assert sum(len(r["cells"]) for r in build.read(build.PREVIOUS)["records"]) == 102
  for b in source["bridges"]:
    assert shape(b["geometry"]).is_valid
    parts = build.plans(b, False)
    assert parts["walks"].area > 20 and parts["curbs"].area > 2
    if b["id"] == "339201179":
      assert parts["paint"].is_empty  # Living street, no lane-count evidence.
    else:
      assert parts["paint"].area > 3
      assert all(
        r["tags"].get("lanes") == "2"
        for r in b["roads"]
        if r["tags"].get("highway") in ("primary", "tertiary")
      )


def test_complete_source_coverage_closed_support_and_orthogonal_native():
  source, data = build.read(build.SOURCE), build.read(build.OUTPUT)
  owners = {b["id"]: b for b in source["bridges"]}
  for family, packets in data["core"].items():
    assert {p["owner"] for p in packets} == set(build.OWNERS)
    for packet in packets:
      nav = packet["nav"]["spreeBridgesV242"]
      polygons = [Polygon(p["ring"], p["holes"]) for p in nav["floors"] + nav["solids"]]
      assert all(p.is_valid for p in polygons)
      floors = unary_union(
        [
          translate(
            Polygon(p["ring"], p["holes"]), packet["origin"][0], packet["origin"][2]
          )
          for p in nav["floors"]
        ]
      )
      expected = build.plans(owners[packet["owner"]], family == "minecraft")["outline"]
      assert expected.difference(floors.buffer(0.015)).area < 0.001
      assert floors.difference(expected.buffer(0.015)).area < 0.001
      mesh = packet["meshes"][0]
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert ix.max() < len(p)
      points = p.astype(float) / 100 + packet["origin"]
      assert points[:, 1].min() <= -1.24
      if family == "minecraft":
        t = points[ix]
        normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all(np.count_nonzero(np.abs(normals) > 1e-7, axis=1) <= 1)
