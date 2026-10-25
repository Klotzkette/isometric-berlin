"""Bounded station reconstruction and retained source packet audit."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "schlesisches_tor_v267", ROOT / "scripts/build_schlesisches_tor_v267.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_rebuild_retains_full_original_station_and_exact_track_sources():
  evidence, runtime = MODULE.build()
  assert json.loads(json.dumps(evidence)) == json.loads(
    (
      ROOT / "geo_data/regierungsviertel/schlesisches-tor-v267-evidence.json"
    ).read_text()
  )
  assert runtime == json.loads(
    (ROOT / "src/app/src/data/schlesischesTorV267.json").read_text()
  )
  assert evidence["retiredOwners"] == [] and evidence["removedTriangles"] == 0
  assert len(evidence["sourcePart"]["all_surfaces"]) == 68
  assert len(evidence["tracks"]) == 2
  assert len(evidence["retainedOsmFeatures"]) == 3
  assert len(runtime["roofs"]) == 3
  for roof in runtime["roofs"]:
    assert Polygon(runtime["ring"]).buffer(0.002).covers(Polygon(roof["ring"]))
  native_owner = evidence["nativeRetainedOwner"]
  translated = Polygon([[x + 4608, z + 2048] for x, z in native_owner["ring"]])
  assert Polygon(runtime["nativeRing"]).symmetric_difference(translated).area < 1e-8
  assert len(set(runtime["nativePortalEdges"])) == 2
  for index in runtime["nativePortalEdges"]:
    a, b = (
      runtime["nativeRing"][index],
      runtime["nativeRing"][(index + 1) % len(runtime["nativeRing"])],
    )
    assert a[1] == b[1] and abs(a[0] - b[0]) >= 4


def test_all_original_inputs_immutable_and_ground_explicit():
  evidence = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/schlesisches-tor-v267-evidence.json"
    ).read_text()
  )
  for name, digest in evidence["inputSha256"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  assert evidence["retainedOutline"]["height"] == 10.71
  assert "Display ground Y3" in evidence["estimates"]
  assert "not an opened walkable interior" in evidence["estimates"]
