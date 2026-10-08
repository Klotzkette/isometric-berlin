"""Independent datum, source, join and preservation checks for the local DGM field."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_grunewald_terrain_v190 as previous  # noqa: E402
import build_teufelsberg_terrain_v195 as terrain  # noqa: E402

OLD_FIELD_SHA256 = "7e18c957243303e8c1ece2c990ed119192182164efa1c5b9fbe6f52b320d4902"
SOURCE_SHA256 = {
  "380_5816": "945425aa89183e1ddadcf9ba0959fbca2e71d389bb4e929da2dbafe4cf94e3a0",
  "380_5818": "e6a6219b9fd9dfba1dc87dde9d88b531bd56a34bc72f873429746bca0787d7e7",
}


def load(path: str) -> dict:
  return json.loads((ROOT / path).read_bytes())


def test_field_and_retained_official_sources_have_verifiable_hashes() -> None:
  evidence = load("geo_data/regierungsviertel/teufelsberg-terrain-v195.json")
  old_evidence = load("geo_data/regierungsviertel/grunewald-terrain-v190.json")
  assert evidence["baseline"] == "v1.0.94"
  assert evidence["license"] == "dl-de/zero-2-0"
  assert (
    evidence["fieldSha256"] == hashlib.sha256(terrain.DATA.read_bytes()).hexdigest()
  )
  original = ROOT / "src/app/src/data/grunewaldTerrainV190.json"
  assert hashlib.sha256(original.read_bytes()).hexdigest() == OLD_FIELD_SHA256
  assert evidence["originalFieldSha256"] == OLD_FIELD_SHA256
  expected = [
    {
      "url": f"https://gdi.berlin.de/data/dgm1/atom/DGM1_{code}.zip",
      "member": f"dgm1_33_{code}_2_be.xyz",
      "sha256": digest,
    }
    for code, digest in SOURCE_SHA256.items()
  ]
  assert evidence["sources"] == expected
  assert all(source in old_evidence["sources"] for source in expected)


@pytest.mark.parametrize("code", SOURCE_SHA256)
def test_locally_retained_source_archive_matches_pinned_evidence(code: str) -> None:
  path = ROOT / f"geo_data/regierungsviertel/raw/grunewald-v190/DGM1_{code}.zip"
  if not path.exists():
    pytest.skip("Raw official archives are optional, gitignored reproduction inputs")
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE_SHA256[code]


def test_only_the_named_hills_and_small_crest_receive_finer_samples() -> None:
  field = terrain.field()
  general, crest = field["profiles"]
  assert field["datumNHN"] == 30 and field["baseline"] == 3
  assert field["nativeStepM"] == 8 and field["fadeM"] == 64
  assert general["support"] == [-9248, 1248, -7936, 2688]
  assert crest["support"] == [-8800, 2140, -8768, 2172]
  assert [general["stepM"], crest["stepM"]] == [8, 1]
  for profile in (general, crest):
    w, n, e, s = profile["support"]
    step = profile["stepM"]
    assert len(profile["offsets"]) == (s - n) // step + 1
    assert all(len(row) == (e - w) // step + 1 for row in profile["offsets"])
    assert all(math.isfinite(value) for row in profile["offsets"] for value in row)


def test_interior_eight_metre_samples_keep_the_official_nhn_datum() -> None:
  evidence = load("geo_data/regierungsviertel/teufelsberg-terrain-v195.json")
  general, _ = terrain.field()["profiles"]
  measured = evidence["measuredNHN"]
  assert evidence["sourceResolutionM"] == 1
  assert evidence["displayGridM"] == evidence["nativeTerraceM"] == 8
  assert evidence["edgeFadeM"] == 64
  assert len(measured) == len(general["offsets"])
  assert all(len(row) == len(general["offsets"][0]) for row in measured)
  # Beyond the transition apron, measured NHN = baseline 3 + offset + datum 30.
  for iz in range(8, len(measured) - 8):
    for ix in range(8, len(measured[iz]) - 8):
      assert general["offsets"][iz][ix] + 33 == pytest.approx(measured[iz][ix])


def test_every_profile_boundary_joins_the_retained_parent_field() -> None:
  general, crest = terrain.field()["profiles"]
  for profile in (general, crest):
    w, n, e, s = profile["support"]
    step = profile["stepM"]
    parent = (
      previous.offset_at
      if profile is general
      else lambda x, z: previous.sample_grid(general, x, z)
    )
    for iz, row in enumerate(profile["offsets"]):
      for ix, value in enumerate(row):
        if iz not in (0, len(profile["offsets"]) - 1) and ix not in (0, len(row) - 1):
          continue
        x, z = w + ix * step, n + iz * step
        assert value == pytest.approx(parent(x, z), abs=0.000051)
        # Sample the limiting surface from inside, including all four corners.
        px, pz = min(e - 1e-6, max(w + 1e-6, x)), min(s - 1e-6, max(n + 1e-6, z))
        assert terrain.offset_at(px, pz) == pytest.approx(parent(x, z), abs=0.0001)


def test_real_highpoint_is_distinct_from_the_mapped_peak_label() -> None:
  evidence = load("geo_data/regierungsviertel/teufelsberg-terrain-v195.json")
  peaks = {p["name"]: p for p in evidence["peaks"]}
  teufelsberg = peaks["Teufelsberg"]
  assert teufelsberg["sourceId"] == "OSM-node-156850034"
  assert teufelsberg["anchor"] == [-8775.006918908737, 2150.707746723667]
  assert teufelsberg["nearbySampledHighpoint"] == {
    "nhn": 120.07,
    "point": [-8783, 2157],
  }
  assert terrain.offset_at(-8783, 2157) + 33 == pytest.approx(120.07)
  assert evidence["summitCrestMaxNHN"] == pytest.approx(120.07)
  assert max(map(max, terrain.field()["profiles"][1]["offsets"])) + 33 == pytest.approx(
    120.07
  )
  assert teufelsberg["dgmAtMappedNodeNHN"] == 115.27
  assert teufelsberg["publishedPeakNHN"] == 120.1
  assert terrain.offset_at(*teufelsberg["anchor"]) + 33 == pytest.approx(
    114.4961, abs=0.00005
  )
  drachenberg = peaks["Drachenberg"]
  assert drachenberg["sourceId"] == "OSM-node-353075536"
  assert drachenberg["dgmAtMappedNodeNHN"] == 98.57
  assert drachenberg["publishedPeakNHN"] == 99
  assert terrain.offset_at(-8432, 1672) + 33 == pytest.approx(98.72)
  for peak in peaks.values():
    assert peak["displayAtMappedNodeNHN"] == pytest.approx(
      terrain.offset_at(*peak["anchor"]) + 33, abs=0.00005
    )
    assert peak["oldDisplayAtMappedNodeNHN"] == pytest.approx(
      previous.offset_at(*peak["anchor"]) + 33, abs=0.00005
    )


def test_native_eight_metre_terraces_and_earlier_checkpoints_remain_stable() -> None:
  for x, z in [(-8788, 2156), (-8404, 1644), (-9244, 1252), (-7940, 2684)]:
    height = terrain.offset_at(x, z)
    for dx in (-3.999, 0, 3.999):
      for dz in (-3.999, 0, 3.999):
        assert terrain.offset_at(x + dx, z + dz, True) == height
  # Frozen v1.0.94 checkpoints, independent of the mutable new evidence file.
  for x, z, drawn, native in [
    (-11966.52, 4245.25, 44.995675, 45.065),
    (-6700, 5626, 14.593125, 14.77),
    (-9456, 2088, 0.1625, 0.38125),
    (-7740, 1780, 0.0325, 0.0325),
    (-8620, 1120, 0, 0),
    (-8350, 2784, 18.90625, 18.89),
    (0, 0, 0, 0),
  ]:
    assert terrain.offset_at(x, z) == pytest.approx(drawn)
    assert terrain.offset_at(x, z, True) == pytest.approx(native)
