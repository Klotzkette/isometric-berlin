"""Strict all-Berlin memorial accounting, separate from protected buildings."""

import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "public-monuments-v326-source.json.gz")
PROFILE = read(ROOT / "src/app/src/data/publicMonumentsV326.json")
INDEX = read(ROOT / "src/app/src/data/publicMonumentsV326Index.json")


def test_every_strict_source_memorial_is_accounted_independently_of_heritage_areas():
  raw = read(GEO / "raw/public-fidelity-v326/public-inventory-audit.json.gz")
  expected = {
    q["sourceIdentity"]: q for q in raw["sites"] if q["category"] == "monument"
  }
  assert len(expected) == SOURCE["publicMemorialCount"] == 9029
  assert SOURCE["heritageRecordCount"] == 9578
  assert (
    len(SOURCE["records"])
    == len({q["sourceIdentity"] for q in SOURCE["records"]})
    == 9029
  )
  assert sum(SOURCE["statusCounts"].values()) == 9029
  assert SOURCE["subtypeCounts"]["stolperstein"] == 7458
  assert SOURCE["subtypeCounts"]["plaque"] == 729
  for q in SOURCE["records"]:
    original = expected[q["sourceIdentity"]]
    assert q["tags"] == original["tags"]
    assert q["geometry"] == original["geometry"]
    assert q["candidateBuildingOwnersAreNotMonumentCoverage"] is True
    assert "candidate-envelope-present" not in q["status"]
    assert q["accuracy"]


def test_old_source_and_individual_major_monuments_are_unchanged_not_replaced_by_a_blanket_statue():
  old = read(ROOT / "src/app/public/mesh/regierungsviertel/street-details.json")
  identities = {q["osm_key"] for q in old["monuments"]}
  assert not identities.intersection(q["id"] for q in PROFILE["entries"])
  assert SOURCE["statusCounts"]["retained-existing-caller-record"] == 1396
  assert SOURCE["statusCounts"]["retained-specific-authored"] == 8
  assert SOURCE["statusCounts"]["unresolved-individual-geometry"] == 1150
  assert SOURCE["statusCounts"]["source-supported-standard-supplement"] == 6475
  for file, digest in SOURCE["inputs"].items():
    assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == digest
  for file, digest in SOURCE["retainedAuthoredModules"].items():
    assert (
      hashlib.sha256((ROOT / "src/app/src" / file).read_bytes()).hexdigest() == digest
    )
  retained = {
    q["sourceIdentity"]
    for q in SOURCE["records"]
    if q["status"] == "retained-specific-authored"
  }
  assert {"node/278738513", "node/884700390"}.issubset(retained)
  # Wagner is tourism=artwork-only, absent from the strict historic source.
  # Its complete preexisting model is nevertheless explicitly pinned/retained.
  assert "WagnerMemorial.ts" in SOURCE["retainedAuthoredModules"]


def test_only_missing_standard_pavement_stones_are_built_with_original_exact_points_and_text():
  records = {q["sourceIdentity"]: q for q in SOURCE["records"]}
  assert len(PROFILE["entries"]) == 6475
  assert len(PROFILE["keys"]) == 543
  assert PROFILE["widthM"] == PROFILE["depthM"] == 0.1
  counts = Counter(q["key"] for q in PROFILE["entries"])
  assert max(counts.values()) == 238
  assert INDEX["keys"] == PROFILE["keys"] == sorted(counts)
  assert INDEX["entries"] == [
    {k: q[k] for k in ["id", "key", "point"]} for q in PROFILE["entries"]
  ]
  for entry in PROFILE["entries"]:
    original = records[entry["id"]]
    assert original["subtype"] == "stolperstein"
    assert original["status"] == "source-supported-standard-supplement"
    assert original["geometry"]["type"] == "Point"
    assert entry["point"] == original["geometry"]["coordinates"]
    assert entry["name"] == original["name"]
    assert entry["inscription"] == original["tags"].get("inscription")
    assert entry["sourceDirection"] == original["tags"].get("direction")
    assert entry["key"] == "_".join(str(math.floor(v / 512)) for v in entry["point"])
  assert (
    hashlib.sha256(
      (GEO / "public-monuments-v326-source.json.gz").read_bytes()
    ).hexdigest()
    == PROFILE["sourceSha256"]
  )
  assert any(
    q["url"] == "https://www.stolpersteine-berlin.de/de" for q in PROFILE["references"]
  )
  photo = next(
    q for q in PROFILE["references"] if q["kind"] == "external-photo-reference"
  )
  assert photo["author"] == "Matti Blume"
  assert photo["licenseUrl"] == "https://creativecommons.org/licenses/by-sa/4.0/"


def test_direct_pbf_union_contains_all_historic_records_and_artwork_only_authored_wagner():
  union = read(GEO / "public-artwork-accounting-v326-source.json.gz")
  assert union["unionCount"] == 11782
  assert union["strictHistoricCount"] == 9029
  assert union["tourismArtworkCount"] == 2763
  assert union["additionalSourceIdentityCount"] == 2753
  by_id = {q["id"]: q for q in union["records"]}
  assert len(by_id) == len(union["records"])
  assert {q["sourceIdentity"] for q in SOURCE["records"]}.issubset(by_id)
  assert by_id["node/243487615"]["status"] == "retained-specific-authored"
  assert by_id["node/243487615"]["retainedModule"] == "WagnerMemorial.ts"
  named = by_id["node/4998450868"]
  assert named["status"] == "source-supported-named-reference-interpretation"
  assert named["namedDimensions"]["heightM"] == 2.5
  assert named["namedDimensions"]["widthM"] == 0.7
  assert named["namedDimensions"]["depthM"] == 0.63
  assert "estimated" in named["namedDimensions"]["orientation"]
  for file, digest in union["inputs"].items():
    assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == digest
  originals = []
  for layer in ["points", "multipolygons"]:
    payload = read(
      GEO / "raw/public-fidelity-v326" / ("artwork_union_" + layer + ".json.gz")
    )
    assert "tourism" in payload["query"] and "memorial" in payload["query"]
    originals.extend(payload["records"])
  assert {q["id"] for q in originals} == set(by_id)
  for q in originals:
    actual = by_id[q["id"]]
    for k in ["properties", "tags", "geometry", "originalGeographicGeometry"]:
      assert actual[k] == q[k]
