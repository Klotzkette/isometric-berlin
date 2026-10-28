"""Independent source-preservation and finite perimeter checks for step 10."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, Point, shape
from shapely.ops import unary_union

from scripts.build_prison_enclosures_v281 import build

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/prison-enclosures-v281-source.json").read_bytes()
)


def test_profile_reproduces_exactly() -> None:
  """Compact runtime course is reproducible without a download or old model decode."""
  assert build() == json.loads(
    (ROOT / "src/app/src/data/prisonEnclosuresV281.json").read_bytes()
  )


def test_complete_previous_source_families_remain_byte_identical() -> None:
  """Earlier measured roofs, walls, courts and facade details remain authoritative."""
  for name, digest in SOURCE["sourceUnchangedSha256"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest


def test_outer_wall_course_and_gate_complements() -> None:
  """Nothing is invented between source traces or across the five mapped gates."""
  profile = build()
  source_lines = unary_union([shape(w["geometry"]) for w in SOURCE["wallSource"]])
  expected = source_lines
  for gate in SOURCE["gates"]:
    expected = expected.difference(shape(gate["geometry"]).buffer(2.1))
  displayed = unary_union(
    [LineString([(ax, az), (bx, bz)]) for ax, az, bx, bz in profile["walls"]]
  )
  assert len(profile["wallIds"]) == 13
  assert len(profile["gatePoints"]) == 5
  assert displayed.hausdorff_distance(expected) < 1e-7
  assert abs(displayed.length - expected.length) < 1e-7
  for point in profile["gatePoints"]:
    assert displayed.distance(Point(point)) >= 2.09
  assert source_lines.bounds == (
    -1278.6910321551259,
    -798.6008743345737,
    -977.5316272215568,
    -580.8401504009962,
  )


def test_distinct_sites_and_only_one_missing_tower_body() -> None:
  """The historical park receives no reconstructed prison or invented towers."""
  towers = SOURCE["towers"]
  assert [t["id"] for t in towers if not t["bodyPresent"]] == ["way/367216384"]
  assert [t["top"] for t in towers[:2]] == [15.121, 15.359]
  assert all(t["bottom"] == 7 and t["top"] == 9 for t in towers[2:])
  assert {t["site"] for t in towers} == {"moabit", "hsh"}
