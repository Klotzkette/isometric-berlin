"""Select the retained Spree/Spreekanal water polygons for bounded viewer detail."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

SPREE_SHORE_BUFFER_M = 35.0


def spree_water_envelope(osm_path: Path) -> tuple[BaseGeometry, list[str]]:
  """Return only polygons intersecting named Spree/Spreekanal source axes."""
  water = gpd.read_file(osm_path, layer="water").to_crs(epsg=25833)
  axes = unary_union(
    water[water["name"].fillna("").isin(["Spree", "Spreekanal"])].geometry
  )
  polygons = water[
    water.geom_type.isin(["Polygon", "MultiPolygon"])
    & water["water"].isin(["river", "canal"])
  ]
  selected = polygons[polygons.intersects(axes.buffer(1.0))]
  if selected.empty:
    raise ValueError("Retained Spree water polygons are missing")
  return unary_union(selected.geometry), sorted(selected["id"].astype(str))
