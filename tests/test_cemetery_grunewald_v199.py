"""Step 10 cemetery source identity, bounded additions and unchanged terrain."""

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  return json.loads(path.read_bytes())


def test_source_identity_and_no_invented_measured_grave_coordinates():
  source = read(GEO / "cemetery-grunewald-v199-source.json")
  cemetery = shape(source["boundary"]["geometry"])
  assert source["boundary"]["id"] == "way/23105617"
  assert abs(cemetery.area - 5091.868081849915) < 1e-6
  assert len(source["paths"]) == 22
  graves = [p for p in source["points"] if p["tags"].get("cemetery") == "grave"]
  assert {p["id"] for p in graves} == {
    "node/277933694",
    "node/277933696",
    "node/277933697",
  }
  nico = next(p for p in graves if p["id"] == "node/277933694")
  assert np.allclose(nico["point"], [-10940.84944109735, 2628.491011646576], atol=1e-9)
  assert cemetery.covers(Point(nico["point"]))
  evidence = read(GEO / "cemetery-grunewald-v199-evidence.json")
  assert evidence["packetEdits"] == []
  assert "not surveyed individual burials" in evidence["estimates"][0]
  assert (
    hashlib.sha256((ROOT / source["terrain"]["file"]).read_bytes()).hexdigest()
    == source["terrain"]["sha256"]
  )


def test_constructor_buffers_are_finite_bounded_and_native_independent():
  nav = read(DATA / "cemeteryGrunewaldV199Navigation.json")
  for native in [False, True]:
    key = "native" if native else "drawn"
    model = read(
      DATA
      / (
        "cemeteryGrunewaldV199Native.json"
        if native
        else "cemeteryGrunewaldV199Drawn.json"
      )
    )
    assert len(model["boxes"]) < 11000
    rows = np.array(model["boxes"])
    assert rows.shape[1] == (7 if native else 8)
    assert np.isfinite(rows).all() and np.all(rows[:, 3:6] > 0)
    assert rows[:, 0].min() > -11023 and rows[:, 0].max() < -10913
    assert rows[:, 2].min() > 2599 and rows[:, 2].max() < 2722
    assert len(model["positions"]) == len(model["colors"])
    assert not native or not model["positions"]
    assert nav[key]["nico"][2] > 33
    assert len(nav[key]["representativeSectorMarkers"]) == 22
    for g in nav[key]["graves"]:
      assert 33 < g["groundY"] < 35


def test_reproduction_is_deterministic_and_does_not_require_raw_source():
  import sys

  sys.path.insert(0, str(ROOT / "scripts"))
  from build_cemetery_grunewald_v199 import generate

  source = read(GEO / "cemetery-grunewald-v199-source.json")
  nav = read(DATA / "cemeteryGrunewaldV199Navigation.json")
  for native in [False, True]:
    model, navigation = generate(source, native)
    assert model == read(
      DATA
      / (
        "cemeteryGrunewaldV199Native.json"
        if native
        else "cemeteryGrunewaldV199Drawn.json"
      )
    )
    assert navigation == nav["native" if native else "drawn"]
