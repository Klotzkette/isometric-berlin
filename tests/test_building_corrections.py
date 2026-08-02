"""The LoD2 snapshot outlives two buildings; the drawn city must not."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd

from isometric_berlin.generation.building_corrections import (
  apply_building_corrections,
  load_current_buildings,
)

BUILDINGS = Path("geo_data/regierungsviertel/buildings.gpkg")
PRISMS = Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json")


def test_corrections_only_touch_the_two_named_buildings() -> None:
  raw = gpd.read_file(BUILDINGS, layer="buildings")
  corrected = apply_building_corrections(raw)
  # Unnamed parts are the overwhelming majority and must all survive.
  assert len(corrected) == len(raw) - 19
  assert corrected["building_name"].astype(str).str.contains("Landeslabor").sum() == 0


def test_the_teehaus_keeps_its_ground_walls_and_loses_its_roof() -> None:
  teehaus = load_current_buildings(BUILDINGS)
  teehaus = teehaus[teehaus["building_name"].astype(str) == "Teehaus"]
  assert len(teehaus) == 4
  assert teehaus["measured_height_m"].max() <= 2.4
  assert set(teehaus["roof_type"].astype(str)) == {"1000"}


def test_no_prism_stands_on_the_cleared_landeslabor_site() -> None:
  payload = json.loads(PRISMS.read_text(encoding="utf-8"))
  # World bounds of the demolished Invalidenstraße 60 slab, in decimetres.
  x_lo, x_hi, z_lo, z_hi = -4600, -3700, -7000, -6150
  tall = [
    entry
    for entry in payload["buildings"]
    if entry["h_dm"] > 100
    and all(
      x_lo <= x <= x_hi and z_lo <= z <= z_hi for x, z in entry["ring"]
    )
  ]
  assert not tall, f"{len(tall)} prisms still stand on the cleared site"
