"""Bounded complete outer-house roofs preserve exact prior geometry owners."""

from __future__ import annotations

from collections import Counter

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_outer_roofs_v262 as build

base = build.base


def test_sources_are_complete_residential_and_previous_recipes_unchanged() -> None:
  source = base.read_json(build.SOURCE)
  evidence = base.read_json(build.EVIDENCE)
  assert evidence["sourceSha256"] == base.digest(build.SOURCE)
  assert evidence["runtimeSha256"] == base.digest(build.RUNTIME)
  counts = Counter(row["region"] for row in source["owners"])
  assert len(source["owners"]) == 24
  assert counts == {"Spandau": 8, "Niederschönhausen": 8, "Adlershof": 8}
  assert all(0 < n <= 8 for n in counts.values())
  assert len(source["archives"]) == 4
  assert source["audit"]["Pankow"]["selected"] == 0
  assert set(source["archives"]) == {
    "LoD2_378_5822.zip",
    "LoD2_391_5825.zip",
    "LoD2_391_5827.zip",
    "LoD2_401_5810.zip",
  }
  for path, expected in source["previous"].items():
    assert base.digest(build.ROOT / path) == expected
  blocked = base.protected_ids()
  old = base.read_json(base.SOURCE)
  blocked.update(row["owner"] for row in old["owners"])
  context = base.read_json(build.GEO / "outer-facades-v230-context.json.gz")
  protected = STRtree([shape(p) for p in context["protected"]])
  for row in source["owners"]:
    assert row["owner"] not in blocked
    assert row["sourceFunction"] in {"31001_1000", "31001_1010"}
    assert row["sourceCreationDate"]
    assert 1.2 < row["sourceTopY"] - row["sourceRoofLowY"] < 12
    assert row["tile"] in build.SITES[row["region"]][1]
    assert row["sourceTile"] == build.Path(build.SITES[row["region"]][0]).name
    assert all(
      {s["kind"] for s in p["surfaces"]} == {"RoofSurface", "WallSurface"}
      for p in row["parts"]
    )
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in row["parts"]])
    ox, _, oz = row["origin"]
    original = translate(
      Polygon(row["original"]["ring"], row["original"]["holes"]), ox, oz
    )
    assert footprint.symmetric_difference(original).area < max(
      0.2, original.area * 0.001
    )
    assert (
      abs(row["sourceTopY"] - row["sourceGroundY"] - row["original"]["height"]) < 0.12
    )
    assert box(ox + 2.1, oz + 2.1, ox + 509.9, oz + 509.9).covers(original)
    assert not protected.query(original.buffer(-0.12), predicate="intersects").size
  assert len({row["owner"] for row in source["owners"]}) == len(source["owners"])


def test_exact_triangle_multisets_and_original_public_assets() -> None:
  source = base.read_json(build.SOURCE)
  evidence = base.read_json(build.EVIDENCE)
  runtime = base.read_json(build.RUNTIME)
  manifest = {d["id"]: d for d in base.read_json(build.OUT / "manifest.json")["chunks"]}
  for record in evidence["packets"]:
    assert (
      base.digest(build.OUT / record["oldAsset"]["url"]) == record["oldAsset"]["sha256"]
    )
  for key, receipt in runtime["packets"].items():
    mode, tile = key.split(":")
    packet = base.read_json(build.OUT / manifest[tile][mode]["url"])
    expected, actual = Counter(), Counter()
    for row in source["owners"]:
      if row["tile"] == tile:
        expected.update(base.triangle_keys(base.old_envelope(packet, row["owner"])))
    for record in receipt["records"]:
      part = packet["meshes"][record["mesh"]]
      assert record["fingerprint"] == base.fingerprint(
        [part[k] for k in ("positions", "colors", "indices")]
      )
      assert len(record["triangles"]) == len(set(record["triangles"]))
      keys = base.triangle_keys(part)
      actual.update(keys[t] for t in record["triangles"])
    assert actual == expected
    assert receipt["replacement"]["kind"] == "outer-roofs-v262"
    assert key not in base.read_json(base.RUNTIME)["packets"]


def test_independent_native_geometry_and_existing_packet_budgets() -> None:
  source = base.read_json(build.SOURCE)
  evidence = base.read_json(build.EVIDENCE)
  runtime = base.read_json(build.RUNTIME)
  manifest = {d["id"]: d for d in base.read_json(build.OUT / "manifest.json")["chunks"]}
  assert build.SOURCE.stat().st_size < 180_000
  assert build.RUNTIME.stat().st_size < 500_000
  native_cells = {
    row["owner"]: row["nativeCells"]
    for p in evidence["packets"]
    if p["mode"] == "minecraft"
    for row in p["counts"]
  }
  for row in source["owners"]:
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in row["parts"]])
    assert native_cells[row["owner"]] == base.native_polygon(footprint).area / 4
  for key, receipt in runtime["packets"].items():
    mode, tid = key.split(":")
    packet = base.read_json(build.OUT / manifest[tid][mode]["url"])
    positions, _, indices = base.decode(receipt["replacement"])
    assert len(positions) < 12_000
    assert (
      sum(len(base.decode(p)[0]) for p in packet["meshes"]) + len(positions) < 390_000
    )
    assert len(packet["meshes"]) + 3 <= 16
    if mode == "minecraft":
      assert not receipt["segments"]
      for triangle in positions[indices].astype(int):
        assert np.any(np.ptp(triangle, axis=0) == 0)
