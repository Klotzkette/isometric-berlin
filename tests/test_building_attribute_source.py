"""OSM semantics may enrich retained source geometry only on a conservative match."""

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import box

from scripts.build_building_attribute_source import bind_source, source_query

ROOT = Path(__file__).resolve().parents[1]
TO_GEO = Transformer.from_crs(25833, 4326, always_xy=True)


def element(
  osm_id: int, bounds: tuple[float, float, float, float], **tags: str
) -> dict:
  """Source fixture from metre coordinates, using the production coordinate frame."""
  points = []
  for x, z in box(*bounds).exterior.coords:
    lon, lat = TO_GEO.transform(x + 389500, 5820000 - z)
    points.append({"lat": lat, "lon": lon})
  return {"id": osm_id, "geometry": points, "tags": {"building": "yes", **tags}}


def prism(prism_id: str, bounds: tuple[float, float, float, float]) -> dict:
  """A retained source footprint needs no semantic metadata to match."""
  return {
    "id": prism_id,
    "ring": [[round(x * 10), round(z * 10)] for x, z in box(*bounds).exterior.coords],
  }


def test_requires_complete_match_and_rejects_cross_bounds_sources() -> None:
  sources = [
    element(1, (0, 0, 20, 20), **{"building:levels": "5"}),
    element(2, (40, 0, 70, 20), **{"building:levels": "6"}),
  ]
  prisms = [
    prism("inside", (1, 1, 19, 19)),
    prism("overlap", (18, 1, 38, 19)),
    prism("outside-source", (41, 1, 49, 19)),
    prism("tiny-roof-fragment", (2, 2, 3, 3)),
  ]
  records, matches, _ = bind_source(sources, prisms, box(-10, -10, 50, 50))
  assert matches == {"inside": 0}
  assert records[0]["osm"] == "way/1"
  assert records[0]["tags"] == {"building:levels": "5"}


def test_competing_attributes_are_not_silently_chosen() -> None:
  sources = [
    element(1, (0, 0, 20, 20), **{"building:levels": "5"}),
    element(2, (0, 0, 20, 20), **{"building:levels": "6"}),
  ]
  _, matches, stats = bind_source(
    sources, [prism("same", (1, 1, 19, 19))], box(-5, -5, 25, 25)
  )
  assert matches == {}
  assert stats["conflicting_attribute_matches"] == 1


def test_explicit_building_part_has_priority_over_parent_attributes() -> None:
  sources = [
    element(1, (0, 0, 20, 20), **{"building:levels": "5"}),
    element(2, (0, 0, 12, 20), **{"building:levels": "3", "building:part": "yes"}),
  ]
  records, matches, _ = bind_source(
    sources, [prism("part", (1, 1, 11, 19))], box(-5, -5, 25, 25)
  )
  assert records[matches["part"]]["osm"] == "way/2"
  assert records[matches["part"]]["tags"]["building:levels"] == "3"


def test_shared_id_does_not_transfer_a_valid_match_to_an_ineligible_fragment() -> None:
  source = [element(1, (0, 0, 20, 20), **{"building:levels": "5"})]
  prisms = [prism("multipart", (1, 1, 19, 19)), prism("multipart", (2, 2, 3, 3))]
  for ordered in (prisms, list(reversed(prisms))):
    _, matches, _ = bind_source(source, ordered, box(-5, -5, 25, 25))
    assert matches == {}


def test_committed_semantics_are_small_traceable_and_cannot_change_geometry() -> None:
  path = ROOT / "src/app/src/buildingAttributeSource.json"
  payload = json.loads(path.read_text())
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  source_ids = {prism["id"] for prism in prisms["buildings"]}
  assert path.stat().st_size < 1_050_000
  assert payload["license"] == "ODbL-1.0"
  assert payload["source_timestamp"].startswith("2026-09-07")
  assert len(payload["source_sha256"]) == 64
  assert payload["minimum_footprint_coverage"] == 0.97
  assert len(payload["prisms"]) > 12_000
  assert set(payload["prisms"]).issubset(source_ids)
  assert payload["statistics"]["conflicting_attribute_matches"] > 0
  for record in payload["records"]:
    assert set(record) == {"osm", "part", "tags"}
    assert record["osm"].startswith("way/")
    assert "height" not in record["tags"]
    assert "roof:shape" not in record["tags"]
    assert "entrance" not in record["tags"]


def test_reproducible_query_is_bounded_and_requests_only_semantic_attributes() -> None:
  bounds = json.loads((ROOT / "geo_data/regierungsviertel/bounds.geojson").read_text())
  query = source_query(bounds)
  assert query.startswith("[out:json][timeout:90]")
  assert 'way["building:material"](' in query
  assert 'way["building:levels"](' in query
  assert "out tags geom" in query
  assert "area" not in query
