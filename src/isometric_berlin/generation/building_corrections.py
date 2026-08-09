"""LoD2 records that the city on the ground has since overtaken.

Berlin's LoD2 stock is a snapshot, and two buildings inside these bounds
no longer stand as the file describes them. Extruding the record as it
is puts an intact reed-roof house on a burnt-out clearing and a 29 m
concrete slab on a cleared building site — both of which a reader
standing in the Tiergarten or on the Invalidenstraße would notice at
once.

Corrections are keyed on the LoD2 ``building_name`` and applied to every
part that carries it, because a LoD2 building arrives as a handful of
separately measured parts (the Teehaus is four, the Landeslabor
nineteen) and a ruin with one wing still at full height is worse than no
correction at all.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd

# A ruin keeps its ground walls, so it must not keep its pitched roof.
FLAT_ROOF_TYPE = "1000"


@dataclass(frozen=True)
class BuildingCorrection:
  """What is left of a building whose LoD2 record is out of date.

  ``remaining_height_m`` is ``None`` when nothing is left to draw, and
  otherwise the height every part is capped to — heights are never
  raised, so a low annexe stays low.
  """

  building_name: str
  remaining_height_m: float | None
  note: str


CORRECTIONS: tuple[BuildingCorrection, ...] = (
  BuildingCorrection(
    building_name="Landeslabor Berlin-Brandenburg",
    remaining_height_m=None,
    note=(
      "Invalidenstraße 60, torn down in 2025/26 to clear the site for the "
      "ULAP-Quartier; the LoD2 tile still carries the 29 m slab"
    ),
  ),
  BuildingCorrection(
    building_name="Teehaus",
    remaining_height_m=2.4,
    note=(
      "Teehaus im Englischen Garten, burnt out in September 2024; the reed "
      "roof and the upper storey are gone and the ground walls stand"
    ),
  ),
)


def apply_building_corrections(buildings: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Return the LoD2 frame with demolished and burnt-out records fixed."""
  frame = buildings
  for correction in CORRECTIONS:
    # Most LoD2 parts are unnamed, and a bare comparison leaves those rows as
    # pd.NA — which silently indexes as "drop me".
    names = frame["building_name"].astype("string").fillna("")
    hit = names == correction.building_name
    if not hit.any():
      continue
    if correction.remaining_height_m is None:
      frame = frame[~hit]
      continue
    frame = frame.copy()
    frame.loc[hit, "measured_height_m"] = frame.loc[hit, "measured_height_m"].clip(
      upper=correction.remaining_height_m
    )
    frame.loc[hit, "roof_type"] = FLAT_ROOF_TYPE
  return frame


def load_current_buildings(buildings_path: Path) -> gpd.GeoDataFrame:
  """Read ``buildings.gpkg`` as the district stands today."""
  return apply_building_corrections(gpd.read_file(buildings_path, layer="buildings"))
