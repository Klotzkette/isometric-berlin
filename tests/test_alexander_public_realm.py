"""Preserve Forum source anchors and prove additive tree ownership."""

import hashlib
import json
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "src/app/src/alexanderPublicRealmSource.json").read_text())


def test_exact_source_scope_and_monument_identity() -> None:
  bounds = json.loads((ROOT / "geo_data/regierungsviertel/bounds.geojson").read_text())
  t = Transformer.from_crs(4326, 25833, always_xy=True)
  scope = transform(t.transform, shape(bounds["features"][0]["geometry"]))
  for key in ["forum", "ensemble", "marx_engels", "alte_welt", "neptun"]:
    record = SOURCE[key]
    p = Polygon(record["outline_xz"])
    assert p.is_valid
    assert p.area == pytest.approx(record["area_m2"], abs=0.001)
    assert scope.covers(
      Polygon([(x + 389500, 5820000 - z) for x, z in p.exterior.coords])
    )
  assert SOURCE["marx_engels"]["osm_key"] == "way/895523111"
  assert SOURCE["marx_engels"]["area_m2"] < 20
  assert SOURCE["ensemble"]["area_m2"] > 2800
  assert SOURCE["neptun"]["osm_key"] == "way/23813204"
  assert len(SOURCE["secondary"]) == 6


def test_trees_add_only_missing_mapped_points_in_both_renderers() -> None:
  trees = SOURCE["added_trees"]
  assert len(trees) == 59
  assert len({t["osm_key"] for t in trees}) == 59
  assert SOURCE["retained_existing_tree_count_in_forum"] == 161
  assert len(SOURCE["deduplicated_osm_trees"]) == 161
  assert not set(t["osm_key"] for t in trees).intersection(
    SOURCE["deduplicated_osm_trees"]
  )
  forum = Polygon(SOURCE["forum"]["outline_xz"])
  for tree in trees:
    x, y, z = tree["position"]
    assert forum.covers(Point(x, z))
    assert tree["nearest_existing_m"] > 2
    assert tree["nearest_native_tree_m"] >= 3
    assert y == 5.245
  for key, file in [
    ("existing_tree_sha256", "park-details.json"),
    ("native_tree_sha256", "minecraft-voxels.json"),
  ]:
    assert (
      hashlib.sha256(
        (ROOT / "src/app/public/mesh/regierungsviertel" / file).read_bytes()
      ).hexdigest()
      == SOURCE[key]
    )


def test_source_generation_remains_reproducible() -> None:
  path = ROOT / "geo_data/regierungsviertel/raw/east_v148/east.osm"
  if not path.exists():
    pytest.skip("Optional ignored source archive is not needed by an offline clone")
  from scripts.build_alexander_public_realm import build_source

  assert build_source(ROOT) == SOURCE
