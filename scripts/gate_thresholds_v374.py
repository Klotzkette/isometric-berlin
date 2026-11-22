"""Open colonnade and passage floors within Berlin's original building masks."""

import json
import math
from pathlib import Path

import shapely
from build_exterior_street_margins_v373 import dm_polygon, polygon_parts, world
from shapely.geometry import Point, Polygon, box, shape

ALKIS = (
  Path(__file__).resolve().parents[1]
  / "geo_data/regierungsviertel/gate-passage-v374-alkis.geojson"
)
GATE_PARTS = {
  "K0001xqy",
  "QDYNK7dL",
  "VpZW4Luf",
  "K0000APP",
  "K00008CG",
  "eFGax25F",
  "PQ6fnwZI",
  "TEHsJHGG",
  "kuj9G14s",
  "X9jEff6H",
  "Gqf7is1F",
  "6cPbX9wD",
  "SPq0oRzs",
  "ya3usNuH",
}
ROOMS = {"K0000APP", "K00008CG"}


def gate_thresholds(features, buildings, surface_coverage):
  """Fill the photographed walking surface between the public-space and LoD2 owners.

  The 2014/15 traffic survey omitted the monument and leaves six bounded
  holes along its central piers. It did not classify these holes as lawns.
  The photographed stone thresholds and the ALKIS AX_WegPfadSteig establish
  the present public passage. Retain the surveyed edges, piers and both closed
  rooms, alongside all existing positive paving and street-furniture owners.
  """
  records = {b["id"]: dm_polygon(b) for b in buildings if b["id"] in GATE_PARTS}
  if set(records) != GATE_PARTS:
    raise ValueError("Incomplete Brandenburg Gate LoD2 ownership")
  masks = list(records[k] for k in sorted(ROOMS))
  survey_areas = []
  for fid, material, threshold, encoded in features:
    geometry = shapely.from_wkb(encoded)
    if geometry.geom_type not in {"Polygon", "MultiPolygon"}:
      continue
    projected = world(geometry)
    if projected.intersects(box(396, 258, 452, 343)):
      survey_areas.append(projected)
      if fid.split(".")[0] in {
        "cc_treppe",
        "bm_zugangsbauwerk",
        "bv_springbrunnen_zierbrunnen",
        "ce_gruenflaeche",
        "bn_baumscheibe",
      }:
        masks.append(projected)
  coverage = shapely.union_all(survey_areas, grid_size=0.01)
  holes = [Polygon(r) for p in polygon_parts(coverage) for r in p.interiors]

  # Source-centred points of the four long non-road regions at the passage
  # dividers plus the pair of narrow end-pier islands. Retain original rings.
  angle = math.radians(5.083)
  cosine, sine = math.cos(angle), math.sin(angle)

  def source_point(x, z):
    return Point(
      417.898 + cosine * x + sine * z,
      300.453 - sine * x + cosine * z,
    )

  islands = []
  for z in (-15, -8.7, -3, 4.5, 10.1, 16.2):
    selected = [hole for hole in holes if hole.covers(source_point(0, z))]
    if len(selected) != 1:
      raise ValueError(f"Unresolved 2014/15 gate-pier margin at local Z={z}")
    islands.append(selected[0])
  cadastral = json.loads(ALKIS.read_text())["features"]
  if len(cadastral) != 1 or cadastral[0]["id"] != "bauwerkeflaechen.DEBE01YYK00024QN":
    raise ValueError("Missing historic gate passage footprint")
  path = world(shape(cadastral[0]["geometry"]))
  floor = shapely.union_all([*records.values(), path, *islands], grid_size=0.01)
  for record in buildings:
    if record["id"] in GATE_PARTS or not record["ring"]:
      continue
    ring = record["ring"]
    xs, zs = zip(*ring)
    if max(xs) >= 4040 and min(xs) <= 4450 and max(zs) >= 2660 and min(zs) <= 3360:
      masks.append(dm_polygon(record))
  return floor.difference(
    shapely.union_all([surface_coverage, *masks], grid_size=0.01), grid_size=0.01
  )
