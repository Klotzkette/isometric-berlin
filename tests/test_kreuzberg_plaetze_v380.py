import gzip
import json
from pathlib import Path

from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/kreuzberg-plaetze-v380.json.gz").read_bytes()
  )
)


def test_measured_square_surfaces_and_tree_inventory():
  for key, expected in {"rio": (166, 25), "moritz": (325, 66)}.items():
    site = DATA[key]
    assert (len(site["features"]), len(site["trees"])) == expected
    assert len({tree[5] for tree in site["trees"]}) == expected[1]
    for x, z, h, diameter, *_ in site["trees"]:
      assert h > 1 and diameter > 0
      assert (
        max(abs(x - site["center"][0]), abs(z - site["center"][1])) <= site["extent"]
      )
    assert all(row["id"] and not shape(row["g"]).is_empty for row in site["features"])


def test_open_and_construction_entrances_have_individual_survey_footprints():
  site = DATA["moritz"]
  surveyed = [
    shape(f["g"]) for f in site["features"] if f["layer"] == "bm_zugangsbauwerk"
  ]
  assert len(surveyed) == 8
  assert len(site["entrances"]) == 6
  assert len(site["closedEntrances"]) == 2
  matched = {
    next(i for i, g in enumerate(surveyed) if g.distance(Point(p)) < 0.5)
    for _, p in [*site["entrances"], *site["closedEntrances"]]
  }
  assert len(matched) == 8


def test_visible_elevations_bind_to_both_original_models():
  faces = [f for site in DATA.values() for f in site["fronts"]]
  assert len(faces) == 31
  assert sum(len(f["windows"]) for f in faces if not f.get("modern")) == 344
  assert sum(len(f["windows"]) for f in faces if f.get("modern")) == 78
  for f in faces:
    assert (
      f["solid"] and f["block"] and f["windows"] and f["model"].startswith("https://")
    )
    for x, y, s, t in f["windows"]:
      assert 0 <= x < s <= 1 and 0 <= y < t <= 1
    if f.get("modern"):
      assert f["id"] == "DEBE00YY1CY000BU" and f["photo"]
    else:
      assert f["coverage"] >= 0.77 and f["distance"] <= 1
