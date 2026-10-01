"""Source identity, ownership and native-shape guards for the heritage avenue."""

import base64
import gzip
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def exporter():
  with pytest.MonkeyPatch.context() as patch:
    patch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location(
      "kma_export", ROOT / "scripts/build_karl_marx_allee_v161.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    yield module


@pytest.fixture(scope="module")
def source():
  return json.loads(
    (ROOT / "geo_data/regierungsviertel/karl-marx-allee-v161.json").read_text()
  )


def test_all_named_parent_source_rings_remain_available(exporter, source) -> None:
  assert {b["id"] for b in source["buildings"]} == exporter.PARENT_IDS
  assert len(source["buildings"]) == 41
  assert len({b["osmWay"] for b in source["buildings"] if b["osmWay"]}) == 4
  assert len(source["sourceArchives"]) == 3
  for building in source["buildings"]:
    for part in building["parts"]:
      assert {s["kind"] for s in part["surfaces"]} >= {
        "RoofSurface",
        "GroundSurface",
      }
      # Shared internal party walls may be ClosureSurface in the official
      # source; a roof-only part is not permission to invent a visible wall.
      assert {s["kind"] for s in part["surfaces"]} & {"WallSurface", "ClosureSurface"}


def test_navigation_preserves_each_owned_source_footprint(exporter, source) -> None:
  for building in source["buildings"]:
    _detail, records = exporter.building_detail(building)
    actual = unary_union([r["geometry"] for r in records if r["minHeight"] == 0])
    expected = unary_union(
      [
        Polygon(
          [(p[0], p[2]) for p in s["rings"][0]],
          [[(p[0], p[2]) for p in ring] for ring in s["rings"][1:]],
        )
        for part in building["parts"]
        for s in part["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
    )
    assert actual.symmetric_difference(expected).area < 1e-6
    assert {r["sourceId"] for r in records} == {building["id"]}
    assert all(r["height"] > r["minHeight"] for r in records)


def test_stepped_towers_and_two_circular_cupolas_replace_flat_envelopes(
  exporter, source
) -> None:
  for building in source["buildings"]:
    if building["id"] not in exporter.TOWERS:
      continue
    detail, nav = exporter.building_detail(building)
    assert len({r["height"] for r in nav}) >= 3
    role_counts = {role for _triangle, _color, role in detail.triangles}
    if building["id"] in {"DEBE02YY20001fZe", "DEBE02YY20001fZf"}:
      assert role_counts >= {
        "cupola column",
        "cupola glazed drum",
        "copper cupola",
        "open lantern column",
        "finial",
      }
      copper = [
        p for t, _c, role in detail.triangles if role == "copper cupola" for p in t
      ]
      assert max(p[1] for p in copper) - min(p[1] for p in copper) > 4
      assert max(p[1] for t, _c, _r in detail.triangles for p in t) == pytest.approx(
        56.06
      )
      assert sum(r["minHeight"] > 0 for r in nav) == 1
    else:
      assert "copper cupola" not in role_counts
      assert (
        len(
          {
            round(p[1], 1)
            for t, _c, role in detail.triangles
            if role == "source RoofSurface"
            for p in t
          }
        )
        > 5
      )


def test_chunk_replacement_never_changes_unowned_building_or_surfaces(exporter) -> None:
  building = {
    "sourceId": "other",
    "geometry": box(20, 20, 40, 40),
    "height": 20,
    "minHeight": 0,
    "heightSource": "test",
  }
  owned = {**building, "sourceId": "owned", "geometry": box(70, 70, 95, 95)}
  surfaces = {"road": box(0, 50, 512, 60), "water": box(0, 0, 12, 512)}
  tile = box(0, 0, 512, 512)
  for native in [False, True]:
    expected = exporter.chunk_payload(
      "0_0", tile, tile, [building], surfaces, minecraft=native
    )
    actual = exporter.chunk_payload(
      "0_0",
      tile,
      tile,
      [building, owned],
      surfaces,
      minecraft=native,
      replaced_source_ids=frozenset({"owned"}),
    )
    assert actual == expected


def test_clip_preserves_roof_slope_and_native_faces_are_axis_aligned(exporter) -> None:
  triangle = [[510, 10, 10], [516, 16, 10], [510, 10, 16]]
  clipped = exporter.clip_polygon(triangle, 0, 512, False)
  assert len(clipped) == 4
  for x, y, _z in clipped:
    assert y == pytest.approx(x - 500)
  detail = exporter.Detail()
  detail.polygon(triangle, (140, 120, 90), "source RoofSurface")
  native = exporter.native_detail(detail)
  assert native.triangles
  for t, _color, _role in native.triangles:
    a, b, c = np.array(t)
    normal = np.cross(b - a, c - a)
    assert np.count_nonzero(np.abs(normal) > 0.001) == 1


def test_native_narrow_windows_leave_wall_between_floors_and_bays(exporter) -> None:
  detail = exporter.Detail()
  detail.polygon(
    [[0, 3, 10], [8, 3, 10], [8, 11, 10], [0, 11, 10]],
    exporter.PALETTE["ceramic"],
    "source WallSurface",
  )
  # First window contains one projected block centre. The second overlaps
  # a cell but misses its centre and must retain the surrounding masonry.
  for left, right, bottom, top in [(0.6, 1.4, 3.5, 4.5), (2.1, 2.7, 5.2, 6.4)]:
    detail.polygon(
      [
        [left, bottom, 10.1],
        [right, bottom, 10.1],
        [right, top, 10.1],
        [left, top, 10.1],
      ],
      exporter.PALETTE["glass"],
      "window glazing",
    )
  native = exporter.native_detail(detail)
  glazing = [
    triangle
    for triangle, color, _role in native.triangles
    if color == exporter.PALETTE["glass"]
  ]
  assert glazing
  assert all(0 <= p[0] <= 2 and 3 <= p[1] <= 5 for t in glazing for p in t)
  assert any(
    color == exporter.PALETTE["ceramic"] for _triangle, color, _role in native.triangles
  )


def test_refined_packets_keep_loader_limits_and_every_audited_chunk() -> None:
  folder = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  manifest = json.loads((folder / "manifest.json").read_text())
  audit = json.loads(
    (ROOT / "geo_data/regierungsviertel/karl-marx-allee-v161-audit.json").read_text()
  )
  for checked in audit["chunks"]:
    descriptor = next(c for c in manifest["chunks"] if c["id"] == checked["chunk"])
    for mode in ["drawn", "minecraft"]:
      data = gzip.decompress((folder / descriptor[mode]["url"]).read_bytes())
      assert len(data) == descriptor[mode]["decodedBytes"] < 12 * 1024 * 1024
      payload = json.loads(data)
      assert any(m["kind"] == "karl-marx-allee-heritage" for m in payload["meshes"])
      assert checked[mode]["retainedUnownedTriangles"] > 0
      for mesh in payload["meshes"]:
        assert len(base64.b64decode(mesh["positions"])) // 6 <= 400_000
        assert len(base64.b64decode(mesh["indices"])) // 4 <= 2_400_000


def test_additive_sash_detail_keeps_full_source_walls_and_roofs(
  exporter, source
) -> None:
  """New glazing subdivisions never replace measured geometry or native cells."""
  for building in source["buildings"]:
    detail, _ = exporter.building_detail(building)
    roles = {role for _, _, role in detail.triangles}
    if "window glazing" not in roles:
      continue
    assert roles >= {"window transom", "window lintel", "sill shadow"}
    old_detail = exporter.Detail()
    old_detail.triangles = [
      t
      for t in detail.triangles
      if t[2] not in {"window transom", "window lintel", "sill shadow"}
    ]
    assert (
      exporter.native_detail(detail).triangles
      == exporter.native_detail(old_detail).triangles
    )
