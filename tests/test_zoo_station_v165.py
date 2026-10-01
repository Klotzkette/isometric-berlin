"""The detailed station preserves every measured part and the mapped platforms."""

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "zoo_station", ROOT / "scripts/build_zoo_station_v165.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
DATA = json.loads((ROOT / "src/app/src/data/zooStationV165Source.json").read_text())


def test_complete_official_source_planes() -> None:
  assert len(DATA["parts"]) == 21
  assert {p["parentId"] for p in DATA["parts"]} == set(module.PARENTS)
  for part in DATA["parts"]:
    expected = [
      s for s in part["sourceSurfaces"] if s["kind"] in ["WallSurface", "RoofSurface"]
    ]
    rendered = [s for s in DATA["surfaces"] if s["owner"] == part["id"]]
    assert len(expected) == len(rendered)
    for original, display in zip(expected, rendered, strict=True):
      normal = module.normal_of(original["rings"][0])
      axes = [i for i in range(3) if i != int(np.argmax(abs(normal)))]
      rings = [[tuple(p[i] for i in axes) for p in ring] for ring in original["rings"]]
      polygon = Polygon(rings[0], rings[1:])
      actual = unary_union(
        [Polygon([tuple(p[i] for i in axes) for p in t]) for t in display["triangles"]]
      )
      assert polygon.symmetric_difference(actual).area < 0.0002
      if original["kind"] == "RoofSurface":
        assert display["material"] == "roof"


def test_three_complete_platforms_and_six_curved_track_identities() -> None:
  assert [p["id"] for p in DATA["platforms"]] == ["3641992", "3641993", "3641994"]
  assert {p["ref"] for p in DATA["tracks"]} == {"1", "2", "3", "4", "5", "6"}
  for platform in DATA["platforms"]:
    footprint = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in platform["polygons"]]
    )
    rendered = next(s for s in DATA["surfaces"] if s["owner"] == platform["id"])
    faces = unary_union(
      [Polygon([(p[0], p[2]) for p in t]) for t in rendered["triangles"]]
    )
    assert footprint.symmetric_difference(faces).area < 0.01
    assert footprint.area > 850
  assert len(DATA["stairs"]) > 20
  assert any(len(p["points"]) > 10 for p in DATA["tracks"])


def test_explicit_replacement_evidence_and_bounded_native_shell() -> None:
  assert {"BBka4goT", "50002bg4", "50002d5W", "32493294", "20145539"} <= {
    p["id"] for p in DATA["legacyPrisms"]
  }
  assert "15777905" not in {p["id"] for p in DATA["legacyPrisms"]}
  assert len(DATA["nativeBlocks"]) < 22000
  assert len({tuple(r[:3]) + (r[4],) for r in DATA["nativeBlocks"]}) == len(
    DATA["nativeBlocks"]
  )
  assert any(r[4] == "glass" for r in DATA["nativeBlocks"])
  assert all(len(a["sha256"]) == 64 for a in DATA["archives"])
  assert len(DATA["colliders"]) > 50


def test_amerika_glazing_has_source_bounded_floors_and_opaque_sides() -> None:
  parts = [p for p in DATA["parts"] if p["parentId"] == module.AMERIKA]
  expected = unary_union(
    [Polygon(r, p["holes"][i]) for p in parts for i, r in enumerate(p["rings"])]
  )
  floor = next(s for s in DATA["surfaces"] if s["kind"] == "InteriorGroundFloor")
  actual = unary_union([Polygon([(p[0], p[2]) for p in t]) for t in floor["triangles"]])
  assert expected.symmetric_difference(actual).area < 0.01
  assert all(p[1] > 5.29 for t in floor["triangles"] for p in t)
  facade = [
    s
    for s in DATA["surfaces"]
    if s["owner"] == "DEBE3DmBA1c2eNP3" and s["kind"] == "WallSurface"
  ]
  assert sum(s["material"] == "glass" for s in facade) == 2
  assert all(s["material"] in ["stone", "glass"] for s in facade)
  for s in facade:
    if s["material"] == "glass":
      n = module.normal_of(s["triangles"][0])
      assert abs(float(np.dot(n, [0.6193, 0, -0.7852]))) > 0.98
  assert any(s["kind"] == "EstimatedUpperFloor" for s in DATA["surfaces"])
  assert any(s["kind"] == "FacadeSpandrel" for s in DATA["surfaces"])
