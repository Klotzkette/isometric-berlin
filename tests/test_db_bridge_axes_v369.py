"""Spatial selection for the Berlin DB axis register."""

import csv
import gzip
import io
import json
from zipfile import ZipFile

from shapely.geometry import box

from scripts.extract_db_bridge_axes_v369 import GEO, PROJECT, SOURCE_CRS, bridge_axes


def test_clip_border_crossing_preserves_direction_and_excludes_neighbouring_lines(
  tmp_path,
):
  columns = (
    "Bundesland",
    "Streckennummer",
    "Richtung",
    "km_von_l",
    "km_bis_l",
    "Bezeichnung",
    "Kreuzungsart",
    SOURCE_CRS,
  )
  table = io.StringIO()
  writer = csv.writer(table, delimiter=";")
  writer.writerow(columns)
  for land, line in [
    ("Brandenburg", "13.39 52.5,13.41 52.5"),
    ("Berlin", "13.3 52.5,13.31 52.5"),
  ]:
    writer.writerow((land, "6024", "1", "4", "5", "EÜ", "", f"LINESTRING({line})"))
  archive = tmp_path / "records.zip"
  with ZipFile(archive, "w") as target:
    target.writestr("M1 Eisenbahnbrücken.csv", table.getvalue().encode("utf-8-sig"))
  x, y = PROJECT.transform(13.40, 52.5)
  rows = list(bridge_axes(archive, box(x - 90, y - 90, x + 90, y + 90)))
  assert len(rows) == 1 and rows[0]["route"] == "6024"
  path = rows[0]["courses"][0]
  assert [p[0] for p in path] == [round(x - 90 - 389500, 2), round(x + 90 - 389500, 2)]


def test_frozen_inventory_contains_db_route_components_with_explicit_source():
  with gzip.open(GEO / "db-bridge-axes-v369.json.gz", "rt") as f:
    data = json.load(f)
  assert len(data["records"]) == 786 and len(data["archiveSha256"]) == 64
  assert data["license"].endswith("/by/4.0/")
  assert all(len(course) >= 2 for row in data["records"] for course in row["courses"])
