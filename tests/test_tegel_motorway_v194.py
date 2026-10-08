"""Source/coverage invariants for the finite northern motorway supplement."""

import json
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import LineString, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"


def test_a111_keeps_complete_routes_and_marks_tunnels() -> None:
  payload = json.loads((DATA / "tegel-motorway-v194.json").read_text())
  records = payload["sourceRecords"]
  assert len(records) == len({r["osmId"] for r in records}) == 129
  assert all(r["tags"]["ref"] == "A 111" for r in records)
  tunnels = [r for r in records if r["tags"].get("tunnel") == "yes"]
  assert len(tunnels) == 16
  assert all(r["displayChannel"] == "tunnel" for r in tunnels)
  assert {r["tags"].get("tunnel:name") for r in tunnels} >= {
    "Tunnel Flughafen Tegel",
    "Tunnel Ortskern Tegel",
    "Tunnel Forstamt Tegel",
  }
  assert min(z for r in records for x, z in r["coordinates"]) < -13080
  assert max(z for r in records for x, z in r["coordinates"]) > -1620
  assert all(LineString(r["coordinates"]).is_simple for r in records)


def test_added_motorway_lines_do_not_overwrite_old_city() -> None:
  payload = json.loads((DATA / "tegel-motorway-v194.json").read_text())
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  previous = unary_union(
    [
      transform(
        project, shape(json.loads((DATA / name).read_text())["features"][0]["geometry"])
      )
      for name in payload["retainedScopes"]
    ]
  )
  previous = shapely.affinity.affine_transform(
    previous, [1, 0, 0, -1, -389500, 5820000]
  )
  for record in payload["sourceRecords"]:
    remaining = LineString(record["coordinates"]).difference(previous)
    assert abs(remaining.length - record["uncoveredLengthM"]) < 0.001
    if remaining.is_empty:
      assert record["vertexCount"] == 0
  runtime = json.loads((ROOT / "src/app/src/data/tegelMotorwayV194.json").read_text())
  assert runtime["positions"] == payload["positions"]
  assert sum(len(v) for v in runtime["positions"].values()) * 4 < 45000
