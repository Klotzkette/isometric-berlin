"""Step 10: additive mapped street links from Schloss to the three east outlines."""

from __future__ import annotations

import base64
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from build_district_streets import triangulated_positions, world_lines
from build_schloss_east_source import EAST_LOBE
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin
from isometric_berlin.generation.build_surface_polygons import (
  PATH_HIGHWAYS,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  road_width_m,
  road_width_source,
)

ROOT = Path(__file__).resolve().parents[1]


def world(geometry):
  """Projected metre geometry to viewer X/Z metre geometry."""
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def decoded_surface_union(payload):
  """Only exact existing surface footprints own their presentation area."""
  polygons = []
  for s in payload["surfaces"]:
    points = (
      np.frombuffer(base64.b64decode(s["positions_cm_b64"]), dtype="<i4").reshape(-1, 2)
      / 100
    )
    indices = np.frombuffer(base64.b64decode(s["indices_b64"]), dtype="<u4").reshape(
      -1, 3
    )
    polygons.append(unary_union(shapely.polygons(points[indices])))
  return unary_union(polygons)


def encoded(kind, geometry):
  """Use existing indexed centimetre format, preserving all polygon holes."""

  def polygon_members(item):
    if isinstance(item, Polygon):
      return [] if item.is_empty else [item]
    return [p for child in getattr(item, "geoms", []) for p in polygon_members(child)]

  # Polygon differences can retain zero-area seam lines in a collection.
  # Those lines must not make the old Polygon/MultiPolygon triangulator skip
  # all the actual pavement faces that accompany them.
  flat = np.asarray(
    [
      value
      for part in polygon_members(geometry)
      for value in triangulated_positions(part)
    ]
  ).reshape(-1, 2)
  points, indices = np.unique(
    np.round(flat * 100).astype("<i4"), axis=0, return_inverse=True
  )
  return {
    "kind": kind,
    "positions_cm_b64": base64.b64encode(points.astype("<i4").tobytes()).decode(),
    "indices_b64": base64.b64encode(indices.astype("<u4").tobytes()).decode(),
  }


def build(root: Path) -> tuple[dict, dict]:
  """Clip current public OSM lines to the requested corridor, never whole relations."""
  raw = root / "geo_data/regierungsviertel/raw/east_v148/east.osm"
  tree = ET.parse(raw).getroot()
  project = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {
    n.attrib["id"]: project.transform(float(n.attrib["lon"]), float(n.attrib["lat"]))
    for n in tree.findall("node")
  }
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  scope = box(391260, 5819710, EAST_LOBE[2], EAST_LOBE[3]).intersection(bounds)
  district = json.loads((root / "src/app/src/data/districtStreets.json").read_text())
  existing = affine_transform(
    decoded_surface_union(district), [1, 0, 0, -1, 389500, 5820000]
  )
  roads, paths, crossings, buildings, inventory = [], [], [], [], []
  for way in tree.findall("way"):
    tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
    refs = [n.attrib["ref"] for n in way.findall("nd")]
    if len(refs) < 2 or any(r not in nodes for r in refs):
      continue
    points = [nodes[r] for r in refs]
    line = LineString(points)
    if not line.intersects(scope):
      continue
    closed = len(points) >= 4 and refs[0] == refs[-1]
    if closed and "building" in tags and tags.get("building") != "train_station":
      buildings.append(shapely.make_valid(Polygon(points)))
    highway = tags.get("highway")
    if highway not in VEHICULAR_HIGHWAYS | PATH_HIGHWAYS:
      continue
    if (
      tags.get("tunnel", "no") != "no"
      or tags.get("bridge", "no") != "no"
      or float(tags.get("layer", "0")) < 0
    ):
      continue
    width = road_width_m(tags)
    if width is None:
      continue
    is_motor = highway in VEHICULAR_HIGHWAYS
    curved = smooth_road_line(line)
    polygon = (
      shapely.make_valid(Polygon(points))
      if closed and tags.get("area") == "yes"
      else curved.buffer(width / 2, cap_style="flat", join_style="round")
    )
    clipped = polygon.intersection(scope)
    (roads if is_motor else paths).append(clipped)
    if not is_motor:
      crossings.append(clipped.buffer(0.35))
    inventory.append(
      {
        "id": way.attrib["id"],
        "name": tags.get("name", ""),
        "highway": highway,
        "width_m": width,
        "width_source": road_width_source(tags),
      }
    )
  # The river remains open; published bridge geometry retains its own ownership.
  water = gpd.read_file(
    root / "geo_data/regierungsviertel/osm.gpkg", layer="water"
  ).to_crs(25833)
  excluded = unary_union(
    [*buildings, *water.geometry[water.geometry.intersects(scope)].tolist()]
  )
  asphalt = (
    unary_union(roads).intersection(scope).difference(excluded).difference(existing)
  )
  paving = (
    unary_union(paths)
    .intersection(scope)
    .difference(excluded)
    .difference(existing)
    .difference(asphalt)
  )
  # Only source-mapped pedestrian bands: no guessed pavement strips.
  kerbs = (
    asphalt.boundary.difference(unary_union(crossings))
    .difference(scope.boundary.buffer(0.1))
    .difference(existing.buffer(0.12))
  )
  previous = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds-task13.geojson")
  )
  blank = bounds.difference(previous)
  sha = hashlib.sha256(raw.read_bytes()).hexdigest()
  result = {
    "source": {
      "osm_url": "https://api.openstreetmap.org/api/0.6/map?bbox=13.396,52.5135,13.4155,52.5240",
      "osm_sha256": sha,
      "license": "ODbL-1.0",
      "outline_extension_only": True,
      "records": inventory,
      "asphalt_area_m2": round(asphalt.area, 3),
      "paving_area_m2": round(paving.area, 3),
      "width_policy": "Mapped width, then mapped lanes, then existing road-class estimate. Only mapped pedestrian ways and areas. No invented street furniture.",
    },
    "surfaces": [encoded("asphalt", asphalt), encoded("sidewalk", paving)],
    "blank_extension": encoded("paving", blank),
    "curbs_m": world_lines(kerbs),
    "markings_m": [],
    "elevated_path_ids": [],
  }
  shapes = [world(blank), world(asphalt), world(paving), world(kerbs.buffer(0.11))]
  runs, cell_count = [], 0
  x0, z0, x1, z1 = world(scope).bounds
  for z in range(int(np.floor(z0)), int(np.ceil(z1))):
    xs = np.arange(int(np.floor(x0)), int(np.ceil(x1)))
    pts = shapely.points(xs + 0.5, np.full(len(xs), z + 0.5))
    kinds = np.full(len(xs), -1)
    for k, shape in enumerate(shapes):
      kinds[shapely.covers(shape, pts)] = [3, 0, 1, 2][k]
    begin = 0
    for end in range(1, len(xs) + 1):
      if end < len(xs) and kinds[end] == kinds[begin]:
        continue
      if kinds[begin] >= 0:
        runs.append([int(xs[begin]), z, end - begin, int(kinds[begin])])
        cell_count += end - begin
      begin = end
  return result, {"runs": runs, "cell_count": cell_count, "osm_sha256": sha}


def main() -> None:
  """Write only the additive source-bound presentation layer."""
  source, native = build(ROOT)
  for filename, payload in [
    ("schlossEastStreets.json", source),
    ("schlossEastBlockStreets.json", native),
  ]:
    path = ROOT / "src/app/src/data" / filename
    path.write_text(
      json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    print(f"Wrote {filename}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
  main()
