"""Only requested named park, stream and bridge polygons extend coverage."""

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"


def test_named_scope_is_exact_components_not_rectangular_fill() -> None:
  record = json.loads((DATA / "named-scope-v198-evidence.json").read_text())
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def geometry(name: str):
    payload = json.loads((DATA / name).read_text())
    return transform(
      project, unary_union([shape(f["geometry"]) for f in payload["features"]])
    )

  actual = geometry("bounds-named-v198.geojson")
  expected = unary_union([geometry(name) for name in record["components"]])
  assert actual.symmetric_difference(expected).area < 0.01
  assert actual.area < 2_100_000
  assert actual.area < actual.envelope.area * 0.02
  # No speculative coverage for the ambiguous additional place name.
  assert not actual.covers(transform(project, Point(13.5, 52.58)))
  assert not actual.covers(transform(project, Point(13.51, 52.46)))
  runtime = json.loads((ROOT / "src/app/src/data/namedScopeV198.json").read_text())
  assert runtime["bounds"] == record["bounds"]
