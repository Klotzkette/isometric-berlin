"""Mapped rail courses stay on the retained Spree shore and inside scope."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_surface_polygons import DEFAULT_BOUNDS
from scripts.spree_shore import spree_water_envelope

ROOT = Path(__file__).resolve().parents[1]


def test_rail_sources_and_geography():
  payload = json.loads((ROOT / "src/app/src/data/spreeRailings.json").read_text())
  osm = ROOT / "geo_data/regierungsviertel/osm.gpkg"
  water, ids = spree_water_envelope(osm)
  bounds = project_geometry(load_bounds_polygon(DEFAULT_BOUNDS)).buffer(0.01)
  shore = water.boundary.buffer(6.01)
  assert payload["source"]["water_ids"] == ids
  assert payload["source"]["license"] == "ODbL-1.0"
  assert (
    payload["source"]["retained_osm_sha256"]
    == hashlib.sha256(osm.read_bytes()).hexdigest()
  )
  assert len(payload["rails"]) == 15
  assert len({r["id"] for r in payload["rails"]}) == 15
  for rail in payload["rails"]:
    course = LineString([(389500 + x, 5820000 - z) for x, z in rail["points_m"]])
    assert bounds.covers(course)
    assert shore.covers(course)
    assert rail["tags"]["barrier"] in ("fence", "handrail")
    assert 0.5 <= rail["height_m"] <= 2.5
    assert rail["height_source"] in ("tag", "display")
