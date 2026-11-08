"""Finite complete sources, additive old-owner preservation and actual new terrain."""

from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

import numpy as np
import pytest
from shapely import make_valid
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_north_east_public_sites_v326 import (
  DATA,
  GEO,
  PUBLIC,
  SOURCE,
  SitePackets,
  baseline_manifest,
  body_triangles,
  complete_scope,
  emit_cells,
  height,
  read,
)

ROOT = Path(__file__).resolve().parents[1]


def test_complete_families_and_distinct_named_sites_preserve_previous_sources() -> None:
  """The lake is neither prison nor memorial; all complete leaves remain."""
  source = read(SOURCE)
  assert len(source["parents"]) == 39
  assert sum(len(p["parts"]) for p in source["parents"]) == 120
  assert len(body_triangles(source)) == 4127
  assert {s["id"] for s in source["sites"]} == {
    "relation/8027588",
    "way/4537841",
    "way/4805433",
    "way/4807989",
    "way/759414113",
  }
  assert all(shape(s["oldScope"]).area == 0 for s in source["sites"])
  baseline = baseline_manifest()
  old = unary_union(
    [make_valid(Polygon(p["ring"], p.get("holes", []))) for p in baseline["footprint"]]
  )
  assert complete_scope(source).intersection(old).area == 0
  expected = {
    "geo_data/regierungsviertel/prisons-memorials-v209-source.json": "7e3827928bcfb24b6d8260e697944a045f6892c62a1c692fb4daa7db3f358205",
    "src/app/src/data/prisonsMemorialsV209.json": "b026affc65320f0ea12e02951ddf620f2ad0d1976988fb8f012637f92aeb7799",
    "src/app/src/data/prisonsMemorialsV209Envelopes.json": "e02b39fa20f021296f1a9febd4881985d1ef1f1355c99aef282314dbe0273a73",
  }
  for path, digest in expected.items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest


def test_reproduction_rejects_new_or_foreign_baseline_manifest(
  tmp_path, monkeypatch
) -> None:
  import scripts.build_north_east_public_sites_v326 as compiler

  fake = tmp_path / "foreign.gz"
  fake.write_bytes(gzip.compress(b'{"chunks":[],"footprint":[]}'))
  monkeypatch.setattr(compiler, "BASELINE_MANIFEST", fake)
  with pytest.raises(ValueError, match="immutable published206"):
    baseline_manifest()


def test_new_hq_windows_never_duplicate_four_previously_authored_families() -> None:
  """Full rectangle containment is stronger than a centre-point wall guess."""
  proof = read(GEO / "north-east-public-sites-v326-facades.json.gz")
  for mode in ["drawn", "native"]:
    records = proof[mode]["hq"]["windows"]
    assert records
    assert len({r["owner"] for r in records}) > 15
    assert all(
      r["owner"] not in proof["drawn"]["hq"]["protectedParents"] for r in records
    )
    assert proof[mode]["hshNewHorizontalBars"] == 5136
  for window in proof["drawn"]["hq"]["windows"]:
    assert shape(window["wall"]).covers(box(*window["rectangle"]))
  source = read(DATA / "northEastPublicSitesV326Packets.json")
  assert len(source["keys"]) == 4
  for plan in source["packets"].values():
    assert all(not plan[k] for k in ["retire", "retireLines", "retireNav", "appendNav"])
    assert plan["navGuard"] and plan["preparedNavGuard"]


def test_native_rectangular_merging_preserves_exposed_area_colour_and_open_holes() -> (
  None
):
  """An enclosed missing cell is still open after exact surface coalescing."""
  cells = {(x, 0, z): 0x808080 for x in range(5) for z in range(5) if (x, z) != (2, 2)}
  cells[0, 1, 0] = 0xA0A0A0
  out = SitePackets(True)
  emit_cells(out, cells)
  triangles = []
  for mesh in out.meshes.values():
    vertices = list(mesh.vertices)
    for i in range(0, len(mesh.indices), 3):
      rows = [vertices[mesh.indices[i + j]] for j in range(3)]
      xyz = np.asarray(
        [
          [p[0] / 100 + mesh.origin_x, p[1] / 100 - 10, p[2] / 100 + mesh.origin_z]
          for p in rows
        ]
      )
      triangles.append((xyz, tuple(rows[0][3:])))
  expected_area = 0
  for x, y, z in cells:
    for dx, dy, dz in [
      (-1, 0, 0),
      (1, 0, 0),
      (0, -1, 0),
      (0, 1, 0),
      (0, 0, -1),
      (0, 0, 1),
    ]:
      expected_area += (x + dx, y + dy, z + dz) not in cells
  actual_area = sum(
    np.linalg.norm(np.cross(p[1] - p[0], p[2] - p[0])) / 2 for p, _ in triangles
  )
  assert actual_area == expected_area
  top = [
    shape(
      {
        "type": "Polygon",
        "coordinates": [[[v[0], v[2]] for v in p] + [[p[0][0], p[0][2]]]],
      }
    )
    for p, _ in triangles
    if np.all(p[:, 1] == 1)
  ]
  assert not unary_union(top).intersects(box(2.1, 2.1, 2.9, 2.9))


def test_measured_relief_lake_and_all_new_packets_stay_inside_existing_live_caps() -> (
  None
):
  """Audit actual source field and independently encoded complete packets."""
  field = read(DATA / "northEastPublicSitesV326Terrain.json")
  assert field["lakeY"] == 1.18
  assert 21 < height(field, -2671.25, -3491.2) < 23
  assert height(field, -2671.25, -3491.2, True) == height(field, -2670, -3490, True)
  index = read(DATA / "northEastPublicSitesV326Index.json")
  assert len(index["chunks"]) == 13
  assert index["trees"] == 626
  assert index["fountain"]["waterRunning"] is False
  for entry in index["chunks"]:
    for mode in ["drawn", "minecraft"]:
      record = entry[mode]
      raw = (PUBLIC / record["url"]).read_bytes()
      assert hashlib.sha256(raw).hexdigest() == record["sha256"]
      assert len(raw) == record["bytes"]
      assert len(gzip.decompress(raw)) == record["decodedBytes"] <= 12 * 1024 * 1024
      packet = read(PUBLIC / record["url"])
      vertices = sum(
        len(base64.b64decode(p["positions"])) // 6 for p in packet["meshes"]
      )
      indices = sum(len(base64.b64decode(p["indices"])) // 4 for p in packet["meshes"])
      assert vertices <= 400000 and indices <= 2400000
      for part in packet["meshes"]:
        p = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4")
        assert ix.max() < len(p)
        assert p[:, 0].min() >= 0 and p[:, 0].max() <= 51200
        assert p[:, 2].min() >= 0 and p[:, 2].max() <= 51200
