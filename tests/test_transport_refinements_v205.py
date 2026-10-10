"""Source identity, complete runway pavement and strictly additive transport details."""

import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def read(path):
  return json.loads(path.read_bytes())


def world(x, z):
  e, n = PROJECT.transform(x, z)
  return e - 389500, 5820000 - n


def test_old_sources_are_byte_identical_and_addition_stays_small():
  evidence = read(GEO / "transport-refinements-v205-evidence.json")
  assert len(evidence["unchangedSources"]) == 6
  for name, expected in evidence["unchangedSources"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
  for name in [
    "berAirportV205.json",
    "ringStationDetailsV205.json",
    "westernMotorwaysV205.json",
  ]:
    assert (DATA / name).stat().st_size < 100_000


def test_replay_is_exact_without_any_ignored_raw_cache(monkeypatch):
  spec = importlib.util.spec_from_file_location(
    "transport_v205_replay", ROOT / "scripts/build_transport_refinements_v205.py"
  )
  builder = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(builder)
  captured = {}
  monkeypatch.setattr(
    builder, "dump", lambda path, value: captured.setdefault(path, value)
  )
  original_read = Path.read_bytes

  def guarded_read(path):
    assert "/raw/" not in str(path)
    return original_read(path)

  def reject_raw_parse(*_args, **_kwargs):
    raise AssertionError(
      "The tracked source archive must replace the ignored XML cache"
    )

  monkeypatch.setattr(Path, "read_bytes", guarded_read)
  monkeypatch.setattr(builder.ET, "parse", reject_raw_parse)
  builder.main()
  assert len(captured) == 5
  for path, generated in captured.items():
    assert generated == read(path)


def test_ber_uses_complete_height_tagged_parts_and_contained_native_runs():
  source = read(GEO / "ber-v205-parts-source.json")
  originals = {r["id"]: r for r in source["features"]}
  data = read(DATA / "berAirportV205.json")
  assert data["activeTerminals"] == ["way/1132137322", "way/700218390"]
  assert len(originals) == len(data["buildings"]) == 25
  for row in data["buildings"]:
    original = originals[row["id"]]
    p = transform(world, shape(original["geometry"]))
    actual = Polygon(row["rings"][0], row["rings"][1:])
    assert actual.hausdorff_distance(p) < 0.001
    if "height" in original["tags"]:
      assert row["top"] == float(original["tags"]["height"]) + 3
    assert row["native"]
    for x, y, z, w, h, d, _color in row["native"]:
      assert min(w, h, d) > 0
      assert p.buffer(0.0015).covers(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2))
      assert abs(y + h / 2 - row["top"]) < 0.001
  roof = next(r for r in data["buildings"] if r["id"] == "way/1082978657")
  assert (roof["roofBottom"], roof["top"]) == (37, 39)
  assert sum(r["column"] for r in data["buildings"]) == 18
  assert sum(r["glass"] for r in data["buildings"]) == 1


def test_both_runways_preserve_every_source_vertex_displaced_threshold_and_label_direction():
  old = json.loads(
    gzip.decompress((GEO / "region-outlines-v200-source.json.gz").read_bytes())
  )
  originals = {r["id"]: r for r in old["features"]}
  runways = read(DATA / "berAirportV205.json")["runways"]
  assert len(runways) == 2
  assert [r["width"] for r in runways] == [45, 60]
  assert [r["endLabels"] for r in runways] == [["24R", "06L"], ["24L", "06R"]]
  assert [len(r["sourceIds"]) for r in runways] == [3, 1]
  for row, expected_length in zip(runways, [3600, 4000], strict=True):
    coordinates = {tuple(p) for p in row["points"]}
    for ident in row["sourceIds"]:
      p = transform(world, shape(originals[ident]["geometry"]))
      assert {(round(x, 3), round(z, 3)) for x, z in p.coords} <= coordinates
    assert abs(LineString(row["points"]).length - expected_length) < 2
    assert row["points"][0][0] > row["points"][-1][0]
  assert all(298 < v < 299 for v in runways[0]["thresholdOffsets"])
  assert runways[1]["thresholdOffsets"] == [0, 0]


def test_all_ring_stations_use_real_sbahn_platforms_and_only_four_unowned_roofs():
  old = read(DATA / "railStationsV190.json")
  data = read(DATA / "ringStationDetailsV205.json")
  expected = {s["name"] for s in old["stations"] if "ringOrder" in s}
  assert len(expected) == 27 and {s["name"] for s in data["stations"]} == expected
  platforms, roofs = (
    {p["id"]: p for p in old["platforms"]},
    {r["id"]: r for r in old["roofs"]},
  )
  added = set()
  for station in data["stations"]:
    assert station["markers"]
    for m in station["markers"]:
      p = platforms[m["platform"]]
      assert p["station"] == station["name"] and p["sourceTags"]["light_rail"] == "yes"
      assert m["y"] == p["y"]
      assert Polygon(p["rings"][0], p["rings"][1:]).contains(Point(m["x"], m["z"]))
    for r in station["canopies"]:
      source = roofs[r["id"]]
      assert (
        source["retainedOwnerId"] is None and source["sourceTags"]["building"] == "roof"
      )
      assert r["rings"] == source["rings"] and r["y"] == source["y"]
      assert station["name"] not in {
        "Wedding",
        "Ostkreuz",
        "Westkreuz",
        "Südkreuz",
        "Gesundbrunnen",
      }
      p = Polygon(r["rings"][0], r["rings"][1:])
      for x, _y, z, w, _h, d, _c in r["native"]:
        assert p.buffer(0.0015).covers(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2))
      added.add(r["id"])
  assert added == {"way/36218351", "way/375394534", "way/438832765", "way/44426688"}


def test_motorways_keep_source_course_grades_and_distinguish_tunnels():
  receipt = read(GEO / "transport-refinements-v205-evidence.json")["motorways"]
  source = read(GEO / "outer-thin-outlines-v179.json")
  expected = [
    r
    for r in source["lines"]
    if r["kind"] == "motorway"
    and any(n in r["name"] for n in ["A100", "A115"])
    and r.get("status") == "mapped"
    and transform(world, LineString(r["coordinates"])).centroid.x < -1000
  ]
  assert {tuple(w["ids"]) for w in receipt["ways"]} == {
    tuple(w["osmIds"]) for w in expected
  }
  assert len(receipt["ways"]) == 203
  assert sum(w["tunnel"] for w in receipt["ways"]) == 4
  assert sum("lanes" in w["tags"] for w in receipt["ways"]) == 188
  assert all(
    w["originalGrade"] == 3.55 and w["widthEstimate"] <= 20 for w in receipt["ways"]
  )
  groups = read(DATA / "westernMotorwaysV205.json")["groups"]
  assert {g["kind"] for g in groups} == {"surface", "tunnel"}
  assert len(groups) < 25
  for group in groups:
    assert len(group["positions"]) % 6 == 0
    assert set(group["positions"][1::3]) == {3.56}
