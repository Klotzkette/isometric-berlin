"""Measured topology and preservation checks for the small Alt-Mitte overlay."""

import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
EVIDENCE = json.loads((GEO / "alt-mitte-edges-v186-evidence.json").read_text())
DATA = json.loads((APP / "altMitteEdgesV186.json").read_text())


@pytest.fixture(scope="module")
def selected_sources() -> dict:
  wanted = {f["parentId"] for f in EVIDENCE["faces"]}
  result = {}
  for chunk in EVIDENCE["sourceChunks"]:
    path = GEO / "alt-mitte-v169" / chunk["file"]
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == chunk["sha256"]
    for record in json.loads(gzip.decompress(data))["buildings"]:
      if record["id"] in wanted:
        result[record["id"]] = record
  return result


def test_all_selected_profiles_retain_exact_source_wall_and_terrain(
  selected_sources: dict,
) -> None:
  faces = EVIDENCE["faces"]
  assert len(faces) == len({f["parentId"] for f in faces}) == 1780
  cells = {c["cell"]: c["rows"] for c in DATA["cells"]}
  offsets = json.loads((APP / "weinbergBuildingOffsetsV176.json").read_text())[
    "offsets"
  ]
  excluded = set(EVIDENCE["excludedIds"])
  for face in faces:
    source = selected_sources[face["parentId"]]
    assert source["category"] in {"core", "outer"}
    assert source["sourceType"] == "official-lod2"
    assert source["id"] not in excluded
    assert not set(source.get("legacyPrismIds", [])) & excluded
    part = next(p for p in source["parts"] if p["id"] == face["partId"])
    surface = next(
      s for s in part["surfaces"] if s["sourcePolygonId"] == face["sourcePolygonId"]
    )
    assert surface["kind"] == "WallSurface" and surface["rings"] == face["rings"]
    assert face["terrainOffsetY"] == offsets.get(source["id"], 0)
    # Independent wall-plane projection and full rectangle containment ensure
    # no cap fills a gable, hole, roof or an unrelated family footprint.
    points = np.asarray(surface["rings"][0])
    a, b = max(
      ((a, b) for a in points for b in points),
      key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
    )
    d = b - a
    d[1] = 0
    d /= np.linalg.norm(d)
    rings = [
      [(float(np.dot(np.asarray(p) - a, d)), p[1]) for p in ring]
      for ring in surface["rings"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(0)
    rows = cells[face["cell"]][face["firstBox"] : face["firstBox"] + face["boxCount"]]
    assert len(rows) == len(face["sections"]) <= 2
    for row, section in zip(rows, face["sections"], strict=True):
      left, bottom, right, upper = section["rectangle"]
      assert wall.covers(box(left, bottom, right, upper))
      assert row[1] == pytest.approx(
        (bottom + upper) / 2 + face["terrainOffsetY"], abs=0.00051
      )
      assert row[3] == pytest.approx(right - left, abs=0.00051)
      assert row[4] <= 0.25 and row[5] <= 0.25 and row[8] in {-1, 1}
      n = np.asarray(face["normal"])
      q = np.asarray([row[0], row[1] - face["terrainOffsetY"], row[2]])
      assert np.dot(q - a, n) == pytest.approx(row[5] / 2 + 0.035, abs=0.002)
  counts = EVIDENCE["counts"]
  assert (
    counts["accented_core"]
    + counts["accented_outer"]
    + counts["noEligibleStreetWall"]
    + counts["protectedLaterAccent"]
    + counts["mappedGlass"]
    == 8374
  )


def test_all_input_receipts_and_bounded_additive_buffers() -> None:
  for path, sha in EVIDENCE["inputSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha
  rows = [row for cell in DATA["cells"] for row in cell["rows"]]
  assert len(DATA["cells"]) == 54
  assert len(rows) == EVIDENCE["counts"]["drawnInstances"] == 3560
  assert (
    sum(math.ceil(r[3] / 2.4) for r in rows)
    == EVIDENCE["counts"]["nativeInstances"]
    == 28032
  )
  assert len(rows) * 76 < 280_000
  assert (APP / "altMitteEdgesV186.json").stat().st_size < 230_000
  assert not (APP / "altMitteEdgesV186Native.json").exists()


def test_gable_and_source_hole_never_become_rectangular_trim() -> None:
  spec = importlib.util.spec_from_file_location(
    "edges186", ROOT / "scripts/build_alt_mitte_edges_v186.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  gable = {"rings": [[[0, 0, 0], [20, 0, 0], [20, 8, 0], [10, 12, 0], [0, 8, 0]]]}
  frame = module.wall_frame(gable)
  rows, sections = module.profile_rows(frame, 2.5)
  assert len(rows) == 2
  assert sections[0]["rectangle"][3] < 8
  assert rows[0][1] < 10.5
  hole = {
    "rings": [
      [[0, 0, 0], [20, 0, 0], [20, 10, 0], [0, 10, 0]],
      [[4, 9.5, 0], [6, 9.5, 0], [6, 9.95, 0], [4, 9.95, 0]],
    ]
  }
  rows, sections = module.profile_rows(module.wall_frame(hole), 0)
  assert len(rows) == 1
  assert sections[0]["role"] == "base edge"
