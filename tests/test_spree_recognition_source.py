"""The two small source profiles must remain bounded, metric and image-free."""

import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pytest
from shapely.geometry import Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin
from scripts.build_spree_recognition_source import (
  NS,
  ORIGIN,
  extract_parent,
  world_ring,
)

ROOT = Path(__file__).resolve().parents[1]


def test_world_ring_retains_millimetres_and_removes_only_closure() -> None:
  ring = ET.fromstring(
    "<posList>391060.319 5820300.588 30.812 "
    "391061.319 5820300.588 79.512 "
    "391060.319 5820300.588 30.812</posList>"
  )
  assert world_ring(ring) == [[1560.319, 0.812, -300.588], [1561.319, 49.512, -300.588]]


def test_extract_parent_selects_exact_building_from_xml_zip(tmp_path: Path) -> None:
  archive = tmp_path / "tile.zip"
  source = (
    f'<CityModel xmlns:bldg="{NS["bldg"]}" '
    'xmlns:gml="http://www.opengis.net/gml">'
    '<bldg:Building gml:id="other"/><bldg:Building gml:id="wanted"/>'
    "</CityModel>"
  )
  with zipfile.ZipFile(archive, "w") as output:
    output.writestr("tile.xml", source)
  selected = extract_parent(archive, "wanted")
  assert selected.attrib["{http://www.opengis.net/gml}id"] == "wanted"
  with pytest.raises(ValueError, match="not found"):
    extract_parent(archive, "absent")


def test_committed_source_is_compact_complete_and_inside_approved_polygon() -> None:
  path = ROOT / "src/app/src/spreeRecognitionSource.json"
  source = json.loads(path.read_text(encoding="utf-8"))
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert path.stat().st_size < 60_000
  assert source["license"] == "dl-de/zero-2-0"
  parts = source["bode"]["parts"] + source["grill"]["parts"]
  assert len(parts) == len({part["id"] for part in parts}) == 12
  assert sum(len(part["holes"]) for part in source["bode"]["parts"]) == 5
  for part in parts:
    footprint = Polygon([(x + ORIGIN[0], ORIGIN[1] - z) for x, z in part["ring"]])
    assert footprint.is_valid
    assert bounds.covers(footprint)
    assert abs(part["top_y_m"] - part["ground_y_m"] - part["height_m"]) < 0.002
  assert "texture" not in path.read_text(encoding="utf-8").lower()
