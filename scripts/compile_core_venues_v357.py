"""Bind venue signs and photographed details to retained central-city walls."""

from __future__ import annotations

import math
import re
from collections import defaultdict

import numpy as np
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from scripts import build_venue_fronts_v355 as venue

COMMON = venue.common
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def footprint(prism):
  def ring(points):
    return [[x / 10, z / 10] for x, z in points]

  return Polygon(ring(prism["ring"]), [ring(h) for h in prism.get("holes", [])])


def central_fronts(sites):
  public = COMMON.ROOT / "src/app/public/mesh/regierungsviertel"
  buildings = [
    (building, footprint(building))
    for building in COMMON.read(public / "lod2-prisms.json")["buildings"]
  ]
  buildings = [(b, poly) for b, poly in buildings if poly.is_valid and poly.area > 4]
  tree = STRtree([poly for _, poly in buildings])
  roads_file = COMMON.GEO / "raw/city-v346/named-roads.geojson.gz"
  roads = defaultdict(list)
  for item in COMMON.read(roads_file)["features"]:
    if name := item["properties"].get("name"):
      roads[name.casefold()].append(shape(item["geometry"]))
  voxels = COMMON.read(public / "minecraft-voxels.json")
  assert voxels["cell_m"] == 4
  records = []
  owners = {b["id"]: (b, poly) for b, poly in buildings}
  for site in sites.values():
    if site.get("existingOwner") or site.get("directoryOnly"):
      continue
    position = Point(venue.project(site["lon"], site["lat"]))
    hint = site.get("coreOwnerHint") if site.get("coreFacade") else None
    if hint:
      if hint not in owners or not site.get("buildingGeometry"):
        continue
      building, polygon = owners[hint]
    else:
      indices = tree.query(position, predicate="within")
      if len(indices) != 1:
        continue
      building, polygon = buildings[int(indices[0])]
    if hint or site.get("buildingGeometry"):
      geometry = venue.site_geometry(site)
      overlap = polygon.intersection(geometry).area
      if not geometry.area or overlap / polygon.area < 0.80:
        continue
      if hint and not geometry.covers(position):
        continue
      if not hint and overlap / geometry.area < 0.80:
        continue
    record = bind(site, position, building, polygon, tree, roads, voxels)
    if record:
      records.append(record)
  return records


def bind(site, position, building, polygon, tree, roads, voxels):
  photo = site.get("coreFacade")
  entrance = site.get("entrance")
  if photo:
    anchor = Point(venue.project(*photo["point"]))
    if anchor.distance(position) > 50:
      return None
    streets = ()
  elif entrance and entrance.get("sourceUrl"):
    anchor = Point(venue.project(entrance["lon"], entrance["lat"]))
    streets = ()
  else:
    anchor = position
    street = site.get("street") or site.get("address", "").split(",")[0]
    street = re.sub(r"\s+\d[^ ]*$", "", street).casefold()
    streets = roads.get(street, ())
    if not streets:
      return None
  sign = photo.get("sign") if photo else None
  if not sign and not site.get("suppressPlaque"):
    sign = dict(width=2.8, height=0.20, bottom=2.23)
  bands = photo.get("bands", []) if photo else []
  parts = [(b["width"], b["bottom"], b["top"]) for b in bands]
  if sign:
    parts.append(
      (sign["width"], sign["bottom"] - 0.2, sign["bottom"] + sign["height"] + 0.2)
    )
  if not parts:
    return None
  width = max(w for w, _, _ in parts)
  if not 1.2 <= width <= 12 or len(bands) > 5:
    return None
  lo = building["y0_dm"]
  bottom = min(y for _, y, _ in parts)
  top = max(y for _, _, y in parts)
  if bottom < 0.05 or building["h_dm"] / 10 < top + 0.12:
    return None
  candidates = []
  ring = building["ring"]
  for i, a in enumerate(ring):
    b = ring[(i + 1) % len(ring)]
    line = LineString([[v / 10 for v in a], [v / 10 for v in b]])
    if line.length < width + 0.32:
      continue
    dx, dz = (np.asarray(b) - a) / (line.length * 10)
    normal = np.array([-dz, dx])
    probe = np.asarray(line.interpolate(0.5, normalized=True).coords[0])
    side = -1 if polygon.covers(Point(probe + normal * 0.15)) else 1
    normal *= side
    distance = line.distance(anchor)
    if photo:
      if np.dot(photo["normal"], normal) < 0.85 or distance > 1.6:
        continue
      penalty = 0
    elif not streets:
      if distance > 2.2:
        continue
      penalty = 0
    else:
      street_point = min(
        (nearest_points(line, road)[1] for road in streets), key=line.distance
      )
      street_vector = np.asarray(street_point.coords[0]) - probe
      span = np.linalg.norm(street_vector)
      facing = np.dot(street_vector, normal) / max(0.01, span)
      if facing < 0.45 or span > 48:
        continue
      penalty = span * 0.2 + (1 - facing) * 4
    offset = max(
      width / 2 + 0.15, min(line.length - width / 2 - 0.15, line.project(anchor))
    )
    xy = np.asarray(line.interpolate(offset).coords[0])
    t = np.array([dx, dz]) * width / 2
    strip = Polygon(
      [
        xy - t + normal * 0.17,
        xy + t + normal * 0.17,
        xy + t + normal * 0.50,
        xy - t + normal * 0.50,
      ]
    )
    if len(tree.query(strip, predicate="intersects")):
      continue
    candidates.append((distance + penalty, i, xy, normal, offset, side))
  for _, i, xy, normal, offset, side in sorted(candidates, key=lambda item: item[0]):
    native = native_face(polygon, xy, normal, width, lo, bottom, top, voxels)
    if native:
      name = site.get("signName") or site["name"]
      label = re.sub(r"[^A-Z0-9 ÄÖÜ()./'-]", " ", name.upper())
      label = " ".join(label.split())[:32]
      if sign and not re.search(r"[A-Z0-9ÄÖÜ]", label):
        continue
      return {
        "id": site["id"],
        "name": label,
        "kind": site["kind"],
        "owner": building["id"],
        "base": lo,
        "height": building["h_dm"],
        "edge": [ring[i], ring[(i + 1) % len(ring)]],
        "side": side,
        "offset": round(offset, 3),
        "native": native,
        "sign": sign,
        "bands": bands,
        "reference": photo["url"] if photo else None,
      }
  return None


def column_runs(voxels, x, z):
  grid = voxels["grid"]
  row = z - grid["min_z_idx"]
  if not 0 <= row < grid["rows"]:
    return []
  offset = x - grid["min_x_idx"]
  return [r[2:] for r in voxels["building_rows"][row] if r[0] <= offset < r[0] + r[1]]


def native_face(polygon, point, normal, width, base, bottom, top, voxels):
  cx, cz = [math.floor(v / 4) for v in point]
  cells_needed = math.ceil((width + 0.32) / 4)
  choices = []
  for dx, dz in DIRECTIONS:
    if np.dot(normal, [dx, dz]) < 0.70:
      continue
    for x in range(cx - 2, cx + 3):
      for z in range(cz - 2, cz + 3):
        cells = []
        for i in range(cells_needed):
          ix, iz = x + dz * i, z - dx * i
          if not polygon.covers(Point((ix + 0.5) * 4, (iz + 0.5) * 4)):
            break
          runs = column_runs(voxels, ix, iz)
          match = [
            r for r in runs if abs(r[0] - base) <= 4 and (r[1] - r[0]) / 10 > top + 0.12
          ]
          if len(match) != 1:
            break
          y0, y1, kind = match[0]
          if any(
            a < y0 + top * 10 and b > y0 + bottom * 10
            for a, b, _ in column_runs(voxels, ix + dx, iz + dz)
          ):
            break
          if cells and y0 != cells[0][2]:
            break
          cells.append([ix, iz, y0, y1, kind])
        if len(cells) != cells_needed:
          continue
        halfrun = (cells_needed - 1) * 2
        face = np.array(
          [(x + 0.5 + dx / 2) * 4 + dz * halfrun, (z + 0.5 + dz / 2) * 4 - dx * halfrun]
        )
        diff = point - face
        if abs(np.dot(diff, [dx, dz])) > 4.1:
          continue
        affordance = cells_needed * 2 - width / 2 - 0.15
        lateral = float(np.clip(np.dot(diff, [dz, -dx]), -affordance, affordance))
        offset = cells_needed * 2 + lateral
        gap = np.linalg.norm(diff - np.array([dz, -dx]) * lateral)
        if gap <= 5:
          choices.append(
            (
              gap,
              {
                "cells": cells,
                "normal": [dx, dz],
                "offset": round(offset, 3),
                "bottom": bottom,
                "top": top,
              },
            )
          )
  return min(choices, key=lambda item: item[0])[1] if choices else None
