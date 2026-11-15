"""Official facility identity coverage, exclusion rules and deterministic rebuild."""

import gzip
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
  "education350", ROOT / "scripts/build_education_inventory_v350.py"
)
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


@pytest.fixture(scope="module")
def source():
  return json.loads(gzip.decompress(M.SOURCE.read_bytes()))


def test_rebuild_preserves_complete_verified_primary_scope(source):
  inventory, evidence = M.build(source)
  assert inventory == json.loads(gzip.decompress(M.OUT.read_bytes()))
  assert gzip.compress(M.wire(inventory), mtime=0) == M.OUT.read_bytes()
  schools = [r for r in inventory["records"] if r["category"] == "primary-school"]
  assert {r["id"].removeprefix("school:") for r in schools} == {
    r["id"] for r in source["schools"] if r["schoolType"] == "Grundschule"
  }
  assert evidence["counts"] == {"kita": 2941, "primary-school": 439}
  assert evidence["schoolOperators"] == {"oeffentlich": 387, "privat": 52}
  assert all(
    len(evidence["byDistrict"][kind]) == 12 for kind in ("primary-school", "kita")
  )
  assert len(evidence["unresolved"]) == 71
  assert all(
    r["reason"] == "primary-stage-site-not-verified" for r in evidence["unresolved"]
  )


def test_latest_kita_snapshot_wins_without_dropping_older_unique_sites(source):
  inventory, evidence = M.build(source)
  actual = {r["id"]: r for r in inventory["records"]}
  assert evidence["kitaWfsXlsxMatches"] == 2881
  assert evidence["kitaDirectoryStatus"] == {
    "older-xlsx-only-current-status-unverified": 36,
    "in-latest-official-publicly-funded-snapshot": 2905,
  }
  for row in source["kitasWfs"]:
    out = actual["kita:" + row["id"]]
    assert out["name"] == row["name"]
    assert out["easting"] == row["easting"]
    assert out["sourceKey"] == "kitasWfs"
  expected = {r["id"] for r in source["kitasXlsx"] + source["kitasWfs"]}
  assert {
    r["id"].removeprefix("kita:") for r in actual.values() if r["category"] == "kita"
  } == expected


def test_no_contact_or_personal_directory_columns_retained(source):
  forbidden = {
    "telefon",
    "fax",
    "email",
    "e_tel",
    "e_platz",
    "t_name",
    "traegername",
    "phone",
    "pupils",
    "capacity",
  }

  def inspect(value):
    if isinstance(value, dict):
      assert not forbidden.intersection(k.lower() for k in value)
      for child in value.values():
        inspect(child)
    elif isinstance(value, list):
      for child in value:
        inspect(child)

  inspect(source)
  inspect(M.build(source)[0])


@pytest.mark.parametrize(
  "row",
  [
    {},
    {"easting": None, "northing": 5820000},
    {"easting": "nan", "northing": 5820000},
    {"easting": 13.4, "northing": 52.5},
    {"easting": 390000, "northing": "bad"},
  ],
)
def test_bad_coordinates_never_receive_invented_fallback(row):
  assert M.location(row) is None


def test_sources_are_attributed_and_points_do_not_claim_architecture(source):
  inventory, _ = M.build(source)
  assert inventory["crs"] == "EPSG:25833"
  assert inventory["sources"]["kitasXlsx"]["license"] == "CC-BY-4.0"
  assert (
    inventory["sources"]["kitasXlsx"]["attribution"]
    == "Senatsverwaltung für Bildung, Jugend und Familie"
  )
  for row in inventory["records"]:
    assert M.location(row) is not None
    assert row["sourceKey"] in inventory["sources"]
    assert row["locationEvidence"] in {
      "official-main-school-site-point",
      "official-facility-point-not-entrance-or-building-footprint",
    }
    assert not {"footprint", "entrance", "facade", "photographic"}.intersection(row)


def test_combined_school_identity_review_does_not_invent_primary_campus(source):
  review = json.loads((M.GEO / "education-v350-primary-stage-review.json").read_text())
  assert len(review["records"]) == 48
  inventory, evidence = M.build(source)
  unresolved = {r["id"] for r in evidence["unresolved"]}
  visible = {r["id"] for r in inventory["records"]}
  for row in review["records"]:
    assert row["id"] in unresolved
    assert "school:" + row["id"] not in visible
    assert row["sourceUrl"].startswith(
      "https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?"
    )
    assert (
      row["primarySiteStatus"] == "main-site-is-not-proof-of-primary-campus-address"
    )
    assert not {"easting", "northing", "footprint", "entrance"}.intersection(row)
