"""Exact routes, retained platform polygons and the four-owner Ostkreuz repair."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))
import build_rail_stations_v190 as builder  # noqa: E402
from build_karl_marx_allee_v161 import mesh_signature  # noqa: E402
from build_surrounding_outlines import chunk_payload  # noqa: E402
from integrate_city_refinements_v166 import line_signature  # noqa: E402


def read(path: Path) -> dict:
  """Read committed evidence."""
  return json.loads(path.read_bytes())


def test_all_ring_and_stadtbahn_identities_and_untouched_heroes() -> None:
  source = read(ROOT / "src/app/src/data/railStationsV190.json")
  stations = source["stations"]
  assert len(stations) == len({s["anchor"] for s in stations}) == 39
  assert len([s for s in stations if "ringOrder" in s]) == 27
  assert {s["name"] for s in stations if s["heroRetained"]} == builder.PRESERVED
  for name, anchor in builder.STADTBAHN:
    s = next(s for s in stations if s["name"] == name)
    assert s["stadtbahnAnchor"] == "node/" + anchor
    assert s["platformIds"]
  assert {s["name"] for s in stations if s["hub"]} == builder.HUBS


def test_every_platform_and_roof_keeps_full_source_plan() -> None:
  source = read(ROOT / "src/app/src/data/railStationsV190.json")
  evidence = read(GEO / "rail-stations-v190-evidence.json")
  records = {r["id"]: r for r in evidence["features"]}
  for row in source["platforms"] + source["roofs"]:
    original = builder.world(shape(records[row["id"]]["geometry"]))
    polygon = Polygon(row["rings"][0], row["rings"][1:])
    # Retained polygons use millimetre world precision, with no simplification.
    assert polygon.difference(original.buffer(0.001)).area < 0.01
    assert original.difference(polygon.buffer(0.001)).area < 0.01
  assert len(source["platforms"]) == 71
  assert len(source["roofs"]) == 115


def test_closed_ring_and_two_directional_stadtbahn_courses_keep_source_vertices() -> (
  None
):
  source = read(ROOT / "src/app/src/data/railStationsV190.json")
  evidence = read(GEO / "rail-stations-v190-evidence.json")
  ring = next(r for r in source["routes"] if r["family"] == "ring")
  assert ring["points"][0] == ring["points"][-1]
  assert len(ring["points"]) == 1182
  assert LineString(ring["points"]).length == pytest.approx(36962.298, abs=0.02)
  courses = [r for r in source["routes"] if r["family"] == "stadtbahn"]
  assert {len(r["points"]) for r in courses} == {809, 830}
  for route in courses:
    course = LineString(route["points"])
    assert 15000 < course.length < 15300
    for name, _ in builder.STADTBAHN:
      station = next(s for s in source["stations"] if s["name"] == name)
      assert course.distance(Point(station["point"])) < 115
  for path, key in [
    (GEO / "outer-thin-outlines-v179.json", "originalRingSha256"),
    (
      ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json",
      "originalDetailedRailSha256",
    ),
  ]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == evidence[key]


def test_ostkreuz_exact_source_roofs_safe_local_grade_and_open_collision() -> None:
  source = read(ROOT / "src/app/src/data/ostkreuzV190.json")
  assert len(source["ownerIds"]) == len(source["roofs"]) == 4
  for roof in source["roofs"]:
    plan = Polygon(roof["rings"][0], roof["rings"][1:])
    panels = unary_union([Polygon(r[0], r[1:]) for r in roof["roofPanels"]])
    assert plan.symmetric_difference(panels).area < 0.25
    assert (
      roof["top"] - roof["floor"] == 15 if roof["hall"] else roof["top"] > roof["floor"]
    )
  assert len(source["tracks"]) == 31
  for track in source["tracks"]:
    original = builder.world(shape(track["originalGeometry"]))
    for x, y, z in track["points"]:
      assert original.distance(Point(x, z)) < 0.001
      assert 3.15 <= y <= 11.5
    for a, b in zip(track["points"], track["points"][1:]):
      assert (
        abs(a[1] - b[1]) / max(0.001, Point(a[0], a[2]).distance(Point(b[0], b[2])))
        < 0.065
      )
  # A formerly fully blocked hall interior is open at ground and upper floor.
  hall = next(r for r in source["roofs"] if r["hall"])
  center = Point(hall["frame"]["x"], hall["frame"]["z"])
  assert not any(
    n["minY"] <= 5 <= n["maxY"]
    and Polygon(n["rings"][0], n["rings"][1:]).contains(center)
    for n in source["navigation"]
  )


def test_only_audited_ostkreuz_packet_triangles_and_named_navigation_are_changed() -> (
  None
):
  audit = read(GEO / "ostkreuz-v190-packet-patch.json")
  assert {c["id"] for c in audit["chunks"]} == {"ring182-12_3", "ring182-13_3"}
  for chunk in audit["chunks"]:
    for mode in ["drawn", "minecraft"]:
      d = chunk["descriptor"][mode]
      path = PUBLIC / d["url"]
      previous = subprocess.run(
        ["git", "show", "v1.0.89:" + str(path.relative_to(ROOT))],
        check=True,
        capture_output=True,
        cwd=ROOT,
      ).stdout
      current = path.read_bytes()
      receipt = chunk["modes"][mode]
      assert hashlib.sha256(previous).hexdigest() == receipt["oldSha256"]
      assert hashlib.sha256(current).hexdigest() == receipt["newSha256"] == d["sha256"]
      assert len(current) == d["bytes"]
      old, new = (
        json.loads(gzip.decompress(previous)),
        json.loads(gzip.decompress(current)),
      )
      before, after = mesh_signature(old), mesh_signature(new)
      tile = box(*chunk["descriptor"]["bounds"])
      records = [
        {**r, "geometry": shape(r["geometry"])} for r in audit["removedSourceRecords"]
      ]
      records = [r for r in records if r["geometry"].intersects(tile)]
      selected = chunk_payload(
        chunk["id"], tile, tile, records, {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(
        chunk["id"], tile, tile, [], {}, minecraft=mode == "minecraft"
      )
      assert before - after == mesh_signature(selected) - mesh_signature(empty)
      assert not after - before
      assert sum((before - after).values()) == receipt["removedTriangles"]
      assert sum(after.values()) == receipt["preservedTriangles"]
      assert all(
        b in new["nav"]["buildings"]
        for b in old["nav"]["buildings"]
        if b["sourceId"] not in audit["ownerIds"]
      )
      assert not any(
        b["sourceId"] in audit["ownerIds"] for b in new["nav"]["buildings"]
      )
      added = [b for b in new["nav"]["buildings"] if b not in old["nav"]["buildings"]]
      assert len(added) == receipt["replacementNavigationCount"]
      assert all(b["sourceId"].startswith("OSTKREUZ-V190-") for b in added)
      for key in ["ground", "roads", "water", "bridges"]:
        assert old["nav"].get(key) == new["nav"].get(key)
      if mode == "drawn":
        assert not line_signature(new["lines"]) - line_signature(old["lines"])
        assert (
          sum((line_signature(old["lines"]) - line_signature(new["lines"])).values())
          == receipt["removedSourceInkSegments"]
        )
