"""Prevent the named extension becoming an unintended rectangular city fill."""

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"


def test_v194_scope_is_only_the_union_of_named_components() -> None:
  record = json.loads((DATA / "named-scope-v194-evidence.json").read_text())
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def geometry(name: str):
    data = json.loads((DATA / name).read_text())
    return transform(
      project, unary_union([shape(f["geometry"]) for f in data["features"]])
    )

  actual = geometry("bounds-named-v194.geojson")
  expected = unary_union([geometry(name) for name in record["components"]])
  assert actual.symmetric_difference(expected).area < 0.01
  assert actual.area < actual.envelope.area * 0.3
  assert not actual.covers(transform(project, Point(13.05, 52.6)))
  runtime = json.loads((ROOT / "src/app/src/data/namedScopeV194.json").read_text())
  assert runtime["bounds"] == record["bounds"]
  assert actual.covers(transform(project, Point(13.125, 52.435)))  # Pfaueninsel.
  assert runtime["bounds"][1] < -13080  # Full northern A111, not old Tegel cutoff.
  assert runtime["groundY"] == 3
