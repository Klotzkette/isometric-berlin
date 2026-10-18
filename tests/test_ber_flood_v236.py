"""The airport flood adds only the final airport footprint to the released mask."""

import hashlib
import json
import subprocess
from pathlib import Path

import shapely
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_ber_flood_preserves_released_area_and_only_adds_airport():
  name = "geo_data/regierungsviertel/flood-extent-v205.geojson"
  previous = shapely.make_valid(
    shape(
      json.loads(subprocess.check_output(["git", "show", f"v1.0.135:{name}"], cwd=ROOT))
    )
  )
  current = shapely.make_valid(shape(json.loads((ROOT / name).read_text())))
  path = ROOT / "geo_data/regierungsviertel/ber-v236-manifest-addition.json"
  addition = json.loads(path.read_text())
  airport = unary_union(
    [shapely.make_valid(Polygon(p["ring"], p["holes"])) for p in addition["footprint"]]
  )
  expected = previous.union(airport)
  assert current.symmetric_difference(expected).area < 0.001
  assert previous.difference(current).area < 0.001
  assert airport.difference(current).area < 0.001
  assert current.difference(previous).difference(airport).area < 0.001
  receipt = json.loads((ROOT / "src/app/src/data/floodExtensionV205.json").read_text())
  assert (
    receipt["berAirportV236"]["manifestSha256"]
    == hashlib.sha256(path.read_bytes()).hexdigest()
  )
  assert abs(receipt["areaM2"] - current.area) < 0.01
  assert receipt["rawBytes"] < 3_000_000
  assert receipt["compressedBytes"] < 1_000_000
