"""Spanish embassy retains all five official parts and exact source ownership."""

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
  "spanish_embassy", ROOT / "scripts/build_spanish_embassy_v164.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
DATA = json.loads((ROOT / "src/app/src/data/spanishEmbassyV164Source.json").read_text())


def test_complete_official_parts_and_height_profile() -> None:
  assert DATA["parentId"] == "DEBE01YYK0002NgP"
  assert {p["id"] for p in DATA["parts"]} == {
    "DEBE3DKqyIGjF11M",
    "DEBE3DCzDC13dOb2",
    "DEBE3DCVxytVlQkz",
    "DEBE3DkGIMvGGC26",
    "DEBE3DflaRtl1pZV",
  }
  assert len(DATA["archive"]["sha256"]) == 64
  assert DATA["archive"]["licence"] == "dl-de/zero-2-0"
  assert abs(max(p["topY"] for p in DATA["parts"]) - 30.86) < 0.001
  assert len(DATA["surfaces"]) == 101
  for part in DATA["parts"]:
    assert {s["kind"] for s in part["sourceSurfaces"]} >= {
      "GroundSurface",
      "RoofSurface",
      "WallSurface",
    }
    rendered = [s for s in DATA["surfaces"] if s["partId"] == part["id"]]
    assert len(rendered) == sum(
      s["kind"] in ["WallSurface", "RoofSurface"] for s in part["sourceSurfaces"]
    )


def test_source_shells_retain_all_original_surveyed_planes() -> None:
  for part in DATA["parts"]:
    authored = [s for s in DATA["surfaces"] if s["partId"] == part["id"]]
    actual = [
      s for s in part["sourceSurfaces"] if s["kind"] in ["WallSurface", "RoofSurface"]
    ]
    for source, render in zip(actual, authored, strict=True):
      assert render["kind"] == source["kind"]
      normal = module.normal_of(source["rings"][0])
      axes = [i for i in range(3) if i != int(np.argmax(np.abs(normal)))]
      projected = [[tuple(p[i] for i in axes) for p in r] for r in source["rings"]]
      expected = Polygon(projected[0], projected[1:])
      triangles = [
        Polygon([tuple(p[i] for i in axes) for p in t]) for t in render["triangles"]
      ]
      assert expected.symmetric_difference(unary_union(triangles)).area < 0.00001


def test_facades_clipped_to_source_and_height_specific_ownership() -> None:
  rings = [[[0.0, 5.2, 0.0], [16.0, 5.2, 0.0], [16.0, 26.3, 0.0], [0.0, 26.3, 0.0]]]
  rows = module.facade(rings)
  windows = [r for r in rows if r[8] == 1]
  assert len(windows) == 16
  for x, y, _z, w, h, *_ in windows:
    assert 0 < x - w / 2 < x + w / 2 < 16
    assert 5.2 < y - h / 2 < y + h / 2 < 26.3
  assert {p["id"] for p in DATA["legacyPrisms"]} == module.LEGACY_IDS
  assert not {"gsRPMIWr", "K0002Mrk"} & module.LEGACY_IDS
  portico = DATA["replacedPorticoEnvelope"]
  assert portico["id"] == "DEBE01YYK0003Ul3"
  assert portico["legacyId"] in module.LEGACY_IDS
  assert len(portico["sourceSurfaces"]) == 6
  assert not any(s["partId"] == portico["id"] for s in DATA["surfaces"])
  assert len(DATA["facadeBoxes"]) == 1506
  assert len(DATA["nativeBlocks"]) == 2262
