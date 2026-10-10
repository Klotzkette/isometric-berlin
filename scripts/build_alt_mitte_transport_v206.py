"""Step 10: explicit OSM paint and signal approaches in frozen Alt-Mitte only."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import geopandas as gpd
import pyogrio
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

from isometric_berlin.generation.build_street_details import build_traffic_signal_data
from isometric_berlin.generation.build_surface_polygons import (
  line_parts,
  runs_underground,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  mapped_lane_count,
  parse_osm_measure_m,
  road_width_m,
  road_width_source,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
BOUNDARY = GEO / "alt-mitte-v169-boundary.geojson"
SOURCE = GEO / "alt-mitte-transport-v206-source.json"
EVIDENCE = GEO / "alt-mitte-transport-v206-evidence.json"
OUT = APP / "altMitteTransportV206.json"
GROUND_OUT = APP / "altMitteTransportGroundV206.json"
CORRECTIONS_OUT = APP / "altMitteTransportCorrectionsV206.json"
OLD_STREETS = APP / "districtStreets.json"
OLD_SIGNALS = ROOT / "src/app/public/mesh/regierungsviertel/street-details.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
TAGS = {
  "highway",
  "name",
  "lanes",
  "lanes:forward",
  "lanes:backward",
  "width",
  "est_width",
  "lane_markings",
  "oneway",
  "junction",
  "bridge",
  "tunnel",
  "covered",
  "layer",
  "surface",
  "footway",
  "cycleway",
  "path",
  "crossing",
  "crossing:markings",
  "crossing:signals",
  "crossing_ref",
  "crossing:island",
  "traffic_signals",
  "traffic_signals:direction",
  "direction",
  "road_marking",
  "colour",
  "pattern",
  "stroke",
  "traffic_sign",
  "access",
  "motor_vehicle",
}


def digest(path: Path) -> str:
  """Hash one preserved source."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, data: Any) -> None:
  """Write deterministic bounded JSON."""
  path.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n")


def boundary() -> Any:
  """Read the complete historical-selection polygon in viewer metres."""
  metric = shape(json.loads(BOUNDARY.read_text())["features"][0]["geometry"])
  return affine_transform(metric, [1, 0, 0, -1, -389500, 5820000])


def extract() -> None:
  """Freeze complete relevant geometry/tags from the retained dated OSM source."""
  scope = boundary()
  metric = affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  geographic = transform(
    Transformer.from_crs(25833, 4326, always_xy=True).transform, metric.buffer(40)
  )
  features = []
  counts: Counter[str] = Counter()
  for layer, path in (
    ("lines", GEO / "raw/outer-v159/candidate.gpkg"),
    ("points", PBF),
  ):
    frame = pyogrio.read_dataframe(path, layer=layer, bbox=geographic.bounds)
    frame = frame.to_crs(25833)
    for record in frame.to_dict("records"):
      geometry = affine_transform(record["geometry"], [1, 0, 0, -1, -389500, 5820000])
      if not scope.intersects(geometry):
        continue
      tags = dict(
        re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(record.get("other_tags", "")))
      )
      for key in ("highway", "name"):
        if isinstance(record.get(key), str):
          tags[key] = record[key]
      tags = {key: value for key, value in tags.items() if key in TAGS}
      highway = tags.get("highway")
      crossing = highway == "crossing" or any(
        tags.get(k) == "crossing" for k in ("footway", "cycleway", "path")
      )
      if not (
        highway in VEHICULAR_HIGHWAYS
        or crossing
        or highway == "traffic_signals"
        or "road_marking" in tags
      ):
        continue
      element = "way" if layer == "lines" else "node"
      features.append(
        {
          "key": f"{element}/{record['osm_id']}",
          "tags": tags,
          "geometry": mapping(geometry),
        }
      )
      counts[f"{element}:{highway or tags.get('road_marking')}"] += 1
  write(
    SOURCE,
    {
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sourceSha256": digest(PBF),
      "boundarySha256": digest(BOUNDARY),
      "license": "ODbL-1.0",
      "coordinateSystem": "viewer metres; x=E-389500,z=5820000-N",
      "sourceCoordinates": "complete unsimplified source geometries; derived paint is clipped inside the frozen district",
      "features": sorted(features, key=lambda f: f["key"]),
      "counts": dict(counts),
    },
  )


def at_grade(tags: dict[str, str]) -> bool:
  """Avoid painting an above/below-ground road at ground level."""
  return (
    not runs_underground(tags)
    and tags.get("bridge", "no") == "no"
    and tags.get("layer", "0") in ("0", "")
  )


def crossing_style(tags: dict[str, str]) -> str | None:
  """Require positive evidence for each marking style, never infer zebra."""
  style = tags.get("crossing:markings")
  if style in {"zebra", "dashes", "lines"}:
    return style
  if style is None and (
    tags.get("crossing_ref") == "zebra" or tags.get("crossing") == "zebra"
  ):
    return "zebra"
  return None


def tangent(line: LineString, point: Point) -> tuple[float, float]:
  """Find source-way forward direction at the source control node."""
  at = line.project(point)
  a, b = (
    line.interpolate(max(0, at - 0.7)),
    line.interpolate(min(line.length, at + 0.7)),
  )
  length = a.distance(b)
  return ((b.x - a.x) / length, (b.y - a.y) / length) if length else (1, 0)


def road_near(point: Point, roads: list[dict], index: STRtree) -> dict | None:
  """Choose a source-connected road before any merely nearby course."""
  candidates = index.query(point.buffer(18))
  if not len(candidates):
    return None
  return min(
    (roads[int(i)] for i in candidates),
    key=lambda r: (r["geometry"].distance(point), r["key"]),
  )


def build(
  *,
  source_path: Path = SOURCE,
  output_path: Path = OUT,
  ground_path: Path = GROUND_OUT,
  corrections_path: Path = CORRECTIONS_OUT,
  evidence_path: Path = EVIDENCE,
  boundary_path: Path = BOUNDARY,
  scope: Any = None,
  version: str = "v206",
  include_signals: bool = True,
  interior_junction_clearance_m: float = 0,
) -> None:
  """Generate compact paint strips and scoped source-based signal metadata."""
  source = json.loads(source_path.read_text())
  scope = boundary() if scope is None else scope
  ground = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_text()
  )
  height = ground["ground_height"]
  step = ground["cell_m"] * height["stride_cells"]
  origin_x = ground["grid"]["min_x_idx"] * ground["cell_m"]
  origin_z = ground["grid"]["min_z_idx"] * ground["cell_m"]
  x0, z0, x1, z1 = scope.buffer(40).bounds
  min_col, min_row = (
    max(0, math.floor((x0 - origin_x) / step) - 1),
    max(0, math.floor((z0 - origin_z) / step) - 1),
  )
  max_col, max_row = (
    min(height["cols"] - 1, math.ceil((x1 - origin_x) / step) + 1),
    min(height["rows"] - 1, math.ceil((z1 - origin_z) / step) + 1),
  )
  scope_source = json.loads((APP / "surroundingCityScope.json").read_text())
  write(
    ground_path,
    {
      "step": step,
      "origin": [origin_x + min_col * step, origin_z + min_row * step],
      "cols": max_col - min_col + 1,
      "rows": max_row - min_row + 1,
      "heightsDm": [
        height["y_dm"][row * height["cols"] + col]
        for row in range(min_row, max_row + 1)
        for col in range(min_col, max_col + 1)
      ],
      "core": scope_source["core"],
      "outerGroundY": scope_source["groundY"],
      "sourceSha256": digest(
        ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
      ),
    },
  )
  features = [{**f, "geometry": shape(f["geometry"])} for f in source["features"]]
  roads = [
    f
    for f in features
    if f["tags"].get("highway") in VEHICULAR_HIGHWAYS
    and f["geometry"].geom_type == "LineString"
    and at_grade(f["tags"])
  ]
  road_index = STRtree([r["geometry"] for r in roads])
  # v210 opt-in only: a source-connected vertex is a junction when its
  # original at-grade ways have at least three distinct outgoing neighbours.
  # Ordinary OSM way splits and geometric overpasses are not junctions.
  junction_neighbours: dict[tuple, set] = defaultdict(set)
  lane_junction_masks: dict[str, Any] = {}
  junction_receipts = []
  if interior_junction_clearance_m > 0:
    for road in roads:
      points = list(road["geometry"].coords)
      for a, b in zip(points, points[1:]):
        junction_neighbours[a].add(b)
        junction_neighbours[b].add(a)
    for road in roads:
      masks = []
      half = road_width_m(road["tags"]) / 2 + 1
      for x, z in list(road["geometry"].coords)[1:-1]:
        if len(junction_neighbours[(x, z)]) < 3:
          continue
        tx, tz = tangent(road["geometry"], Point(x, z))
        masks.append(
          Polygon(
            [
              (x + tx * u - tz * v, z + tz * u + tx * v)
              for u, v in [
                (-interior_junction_clearance_m, -half),
                (interior_junction_clearance_m, -half),
                (interior_junction_clearance_m, half),
                (-interior_junction_clearance_m, half),
              ]
            ]
          )
        )
        junction_receipts.append(
          {
            "key": road["key"],
            "position": [x, z],
            "neighbours": len(junction_neighbours[(x, z)]),
          }
        )
      if masks:
        lane_junction_masks[road["key"]] = unary_union(masks)
  road_bands = [
    smooth_road_line(r["geometry"]).buffer(road_width_m(r["tags"]) / 2, cap_style=2)
    for r in roads
  ]
  carriageways = unary_union(road_bands).intersection(scope)
  crossing_carriageways = carriageways.buffer(-0.3)
  shapely.prepare(scope)
  shapely.prepare(carriageways)
  paint: list[list[float | int]] = []
  owners: list[dict] = []
  skipped: Counter[str] = Counter()

  def strips(
    line: Any,
    width: float,
    colour: int = 0,
    dash: tuple[float, float] | None = None,
    excluded: Any = None,
  ) -> None:
    for part in line_parts(line):
      offset = 0.0
      for a, b in zip(part.coords, list(part.coords)[1:]):
        length = math.dist(a, b)
        if length < 0.005:
          continue
        unit = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        # Final fixed typed buffers are allocated once in the browser. Short
        # offline strips let each corner independently follow the DGM grade.
        cuts = []
        if dash:
          on, off = dash
          start = -offset % (on + off) - (on + off)
          while start < length:
            if min(length, start + on) > max(0, start):
              cuts.append((max(0, start), min(length, start + on)))
            start += on + off
        else:
          cuts.append((0, length))
        for start, end in cuts:
          n = math.ceil((end - start) / 2)
          for i in range(n):
            lo = start + (end - start) * i / n
            hi = start + (end - start) * (i + 1) / n
            p = [a[0] + unit[0] * (lo + hi) / 2, a[1] + unit[1] * (lo + hi) / 2]
            # Leave the full ribbon inside the scope and source road footprint.
            ribbon = LineString(
              [
                (a[0] + unit[0] * lo, a[1] + unit[1] * lo),
                (a[0] + unit[0] * hi, a[1] + unit[1] * hi),
              ]
            ).buffer(width / 2, cap_style=2)
            if (
              not scope.covers(ribbon)
              or not carriageways.covers(ribbon)
              or excluded is not None
              and excluded.intersects(ribbon)
            ):
              continue
            paint.append(
              [
                round(p[0], 3),
                round(p[1], 3),
                round(hi - lo, 3),
                round(width, 3),
                round(math.atan2(unit[1], unit[0]), 7),
                colour,
              ]
            )
        offset += length

  crossing_ways = [
    f
    for f in features
    if f["geometry"].geom_type == "LineString"
    and crossing_style(f["tags"])
    and any(f["tags"].get(k) == "crossing" for k in ("footway", "cycleway", "path"))
    and at_grade(f["tags"])
  ]
  crossing_index = STRtree([f["geometry"] for f in crossing_ways])
  crossings = crossing_ways + [
    f
    for f in features
    if f["geometry"].geom_type == "Point"
    and crossing_style(f["tags"])
    and at_grade(f["tags"])
  ]
  for crossing in crossings:
    tags, geometry = crossing["tags"], crossing["geometry"]
    style = crossing_style(tags)
    linked = []
    if geometry.geom_type == "Point":
      linked = [
        crossing_ways[int(i)]["key"]
        for i in crossing_index.query(geometry.buffer(0.35))
      ]
      if linked:
        skipped["nodeAlreadyRepresentedByCrossingWay"] += 1
        continue
      road = road_near(geometry, roads, road_index)
      if road is None or road["geometry"].distance(geometry) > 0.35:
        skipped["crossingNodeWithoutConnectedRoad"] += 1
        continue
      tx, tz = tangent(road["geometry"], geometry)
      half = road_width_m(road["tags"]) / 2
      geometry = LineString(
        [
          (geometry.x - tz * half, geometry.y + tx * half),
          (geometry.x + tz * half, geometry.y - tx * half),
        ]
      )
    before = len(paint)
    width = parse_osm_measure_m(tags.get("width")) or 3.0
    width = min(6, max(1.5, width))
    clipped = geometry.intersection(crossing_carriageways)
    for part in line_parts(clipped):
      if part.length < 0.5:
        continue
      if style == "zebra":
        # Bars follow the road (normal to the crossing), spaced along the
        # crossing's source route. 0.5m bars/gaps are display dimensions.
        for at in range(math.floor(part.length)):
          p = part.interpolate(at + 0.5)
          tx, tz = tangent(part, p)
          bar = LineString(
            [
              (p.x - tz * width / 2, p.y + tx * width / 2),
              (p.x + tz * width / 2, p.y - tx * width / 2),
            ]
          )
          strips(bar.intersection(crossing_carriageways), 0.5)
      else:
        for side in (-1, 1):
          edge = part.offset_curve(side * width / 2)
          strips(
            edge.intersection(crossing_carriageways),
            0.22,
            dash=(0.5, 0.5) if style == "dashes" else None,
          )
    if len(paint) > before:
      owners.append(
        {
          "key": crossing["key"],
          "kind": style,
          "signalized": tags.get("crossing") == "traffic_signals"
          or tags.get("crossing:signals") == "yes",
          "first": before,
          "count": len(paint) - before,
          "widthM": width,
          "widthEvidence": "width" if tags.get("width") else "display_estimate",
        }
      )

  old_markings = json.loads(OLD_STREETS.read_text())["markings_m"]
  old_lines = [LineString(m["points"]) for m in old_markings]
  no_marking_roads = [r for r in roads if r["tags"].get("lane_markings") == "no"]
  no_marking_union = unary_union([r["geometry"] for r in no_marking_roads]).buffer(0.2)
  superseded = []
  for index, line in enumerate(old_lines):
    if scope.covers(line) and no_marking_union.covers(line):
      superseded.append(
        {
          "markingIndex": index,
          "sourceWayKeys": [
            r["key"]
            for r in no_marking_roads
            if r["geometry"].buffer(0.2).intersection(line).length > 0.01
          ],
          "reason": "entire legacy inferred axis lies within 0.2m of retained lane_markings=no source roads; source arrays retained",
        }
      )
  write(
    corrections_path,
    {
      "districtStreetsSha256": digest(OLD_STREETS),
      "suppressedMarkingIndices": [r["markingIndex"] for r in superseded],
      "corrections": superseded,
    },
  )
  old_union = unary_union(old_lines).buffer(0.7)
  for road in roads:
    tags = road["tags"]
    lanes = mapped_lane_count(tags)
    if (
      tags.get("lane_markings") != "yes"
      or lanes is None
      or lanes < 2
      or lanes != int(lanes)
    ):
      continue
    geometry = road["geometry"]
    if geometry.intersection(old_union).length > geometry.length * 0.2:
      skipped["laneAxisAlreadyInDistrictStreets"] += 1
      continue
    width = road_width_m(tags)
    before = len(paint)
    for lane in range(1, int(lanes)):
      shifted = geometry.offset_curve(width * (lane / lanes - 0.5))
      # Keep endpoints/junction middles open; exact dash phase is unsurveyed.
      for part in line_parts(shifted):
        if part.length > 8:
          trimmed = shapely.ops.substring(part, 4, part.length - 4)
          excluded = lane_junction_masks.get(road["key"])
          clipped = trimmed.intersection(scope)
          if excluded is not None:
            clipped = clipped.difference(excluded)
          strips(clipped, 0.14, dash=(3, 6), excluded=excluded)
    if len(paint) > before:
      owners.append(
        {
          "key": road["key"],
          "kind": "lane_dividers",
          "lanes": lanes,
          "widthM": width,
          "widthEvidence": road_width_source(tags),
          "first": before,
          "count": len(paint) - before,
        }
      )

  # Source ring / directly mapped stop lines: no guessed regulatory symbol.
  for feature in features:
    tags, geometry = feature["tags"], feature["geometry"]
    if (
      tags.get("road_marking") != "restriction"
      or geometry.geom_type != "LineString"
      or not geometry.is_ring
      or tags.get("pattern") != "stripes"
      or not at_grade(tags)
    ):
      continue
    area = Polygon(geometry).intersection(scope).intersection(carriageways)
    if area.is_empty or area.area < 0.5:
      continue
    before = len(paint)
    strips(
      area.buffer(-0.08).boundary, 0.15, 1 if tags.get("colour") == "yellow" else 0
    )
    # The mapped polygon fixes the exclusion footprint. Hatch angle and
    # spacing remain a labelled cartographic interpretation within that ring.
    minx, minz, maxx, maxz = area.bounds
    reach = maxx - minx + maxz - minz
    for at in range(math.ceil(reach / 2.5) + 1):
      d = at * 2.5
      hatch = LineString([(minx + d, minz), (minx + d - reach, minz + reach)])
      strips(
        hatch.intersection(area.buffer(-0.16)),
        0.3,
        1 if tags.get("colour") == "yellow" else 0,
      )
    if len(paint) > before:
      owners.append(
        {
          "key": feature["key"],
          "kind": "restriction",
          "first": before,
          "count": len(paint) - before,
        }
      )

  existing = json.loads(OLD_SIGNALS.read_text())
  old_by_key = {s["osm_key"]: s for s in existing["traffic_signal_placements"]}
  signal_features = [
    f
    for f in features
    if include_signals
    and f["tags"].get("highway") == "traffic_signals"
    and scope.contains(f["geometry"])
  ]
  records = []
  for f in roads + [f for f in signal_features if f["key"] not in old_by_key]:
    element, identity = f["key"].split("/")
    records.append(
      {
        **f["tags"],
        "id": identity,
        "element": element,
        "geometry": affine_transform(f["geometry"], [1, 0, 0, -1, 389500, 5820000]),
      }
    )
  frame = gpd.GeoDataFrame(records, crs=25833)
  for key in ("crossing:island", "tunnel", "covered", "bridge", "layer"):
    if key not in frame:
      frame[key] = None
  _, new_placements = build_traffic_signal_data(
    frame, affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  )
  new_by_key = {s["osm_key"]: s for s in new_placements}
  signals = []
  direction_counts: Counter[str] = Counter()
  for feature in signal_features:
    placement = dict(old_by_key.get(feature["key"], new_by_key.get(feature["key"])))
    road = road_near(feature["geometry"], roads, road_index)
    direction = feature["tags"].get("traffic_signals:direction")
    if road is None:
      skipped["signalWithoutRoadApproach"] += 1
      continue
    tx, tz = tangent(road["geometry"], feature["geometry"])
    connected = road["geometry"].distance(feature["geometry"]) <= 0.35
    one_way = road["tags"].get("oneway")
    if connected and direction in {"forward", "backward"}:
      forward = direction == "forward"
      evidence = "mapped_direction_on_connected_way"
    elif connected and one_way in {"yes", "-1"}:
      forward = one_way == "yes"
      evidence = "mapped_oneway_approach"
    else:
      px, pz = [v / 10 for v in placement["position_dm"]]
      sx, sz = [v / 10 for v in placement["source_dm"]]
      forward = (px - sx) * (-tz) + (pz - sz) * tx >= 0
      evidence = "right_hand_approach_display_estimate"
    # Local front is +Z in Three; face toward arriving traffic, opposite
    # the source way's affected direction (not sideways toward its centre).
    facing = (-tx, -tz) if forward else (tx, tz)
    placement.update(
      {
        "heading_rad": round(math.atan2(facing[0], facing[1]), 7),
        "refined_v206": True,
        "direction_evidence": evidence,
        "road_key": road["key"],
        "source_tag_direction": direction,
        "road_connected": connected,
        "retained_existing_placement": feature["key"] in old_by_key,
      }
    )
    signals.append(placement)
    direction_counts[evidence] += 1
  signals.sort(key=lambda s: s["osm_key"])
  cells: dict[tuple[int, int], list] = defaultdict(list)
  for row in paint:
    cells[(math.floor(row[0] / 512), math.floor(row[1] / 512))].append(row)
  # Native paint is quarter-metre axis-aligned surface pixels. Test the FULL
  # pixel against both actual source carriageway and scope before lossless
  # horizontal run merging. Thus rasterisation cannot paint a sidewalk or
  # extend the district. Restriction paint also stays inside its source ring.
  feature_by_key = {f["key"]: f for f in features}
  native_pixels: dict[tuple[int, int, int], set[int]] = defaultdict(set)
  core = Polygon(scope_source["core"]["ring"], scope_source["core"]["holes"])
  shapely.prepare(core)
  for owner in owners:
    restriction = None
    if owner["kind"] == "restriction":
      restriction = Polygon(feature_by_key[owner["key"]]["geometry"])
      shapely.prepare(restriction)
    for x, z, length, width, angle, yellow in paint[
      owner["first"] : owner["first"] + owner["count"]
    ]:
      c, s = math.cos(angle), math.sin(angle)
      ex, ez = (
        abs(c) * length / 2 + abs(s) * width / 2,
        abs(s) * length / 2 + abs(c) * width / 2,
      )
      for iz in range(math.floor((z - ez) * 4), math.floor((z + ez) * 4) + 1):
        for ix in range(math.floor((x - ex) * 4), math.floor((x + ex) * 4) + 1):
          px, pz = (ix + 0.5) / 4, (iz + 0.5) / 4
          u, v = (px - x) * c + (pz - z) * s, -(px - x) * s + (pz - z) * c
          if abs(u) > length / 2 + 0.25 * 0.35 or abs(v) > max(width / 2, 0.125):
            continue
          pixel = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
          if not carriageways.covers(pixel) or not scope.covers(pixel):
            continue
          if restriction is not None and not restriction.covers(pixel):
            continue
          excluded = (
            lane_junction_masks.get(owner["key"])
            if owner["kind"] == "lane_dividers"
            else None
          )
          if excluded is not None and excluded.intersects(pixel):
            continue
          # Break runs at every possible 4m native-terrain step and at the
          # exact core/outer ownership seam, so every run has one ground Y.
          native_pixels[(iz, int(yellow), int(core.contains(Point(px, pz))))].add(ix)
  native_cells: dict[tuple[int, int], list] = defaultdict(list)
  for (iz, yellow, _core), xs in sorted(native_pixels.items()):
    ordered = sorted(xs)
    start = previous = ordered[0]
    for ix in [*ordered[1:], ordered[-1] + 2]:
      if ix != previous + 1 or ix // 16 != previous // 16:
        native_cells[(math.floor(start / 2048), math.floor(iz / 2048))].append(
          [start, iz, previous - start + 1, yellow]
        )
        start = ix
      previous = ix
  counts = {
    "sourceFeatures": len(features),
    "paintStrips": len(paint),
    "paintOwners": len(owners),
    "cells": len(cells),
    "nativePaintQuads": sum(len(rows) for rows in native_cells.values()),
    "supersededFalseLaneAxes": len(superseded),
    "signals": len(signals),
    "retainedSignalPlacements": sum(s["retained_existing_placement"] for s in signals),
    "addedSignalPlacements": sum(not s["retained_existing_placement"] for s in signals),
    "paintKinds": dict(Counter(o["kind"] for o in owners)),
    "signalDirections": dict(direction_counts),
    "skipped": dict(skipped),
  }
  write(
    output_path,
    {
      "schema": 1,
      "source": "OSM Geofabrik Berlin 2026-09-29, ODbL-1.0; frozen pre-2001 Alt-Mitte selection",
      "columns": ["x", "z", "length", "width", "angle_from_positive_x", "yellow"],
      "cells": [
        {"cell": list(key), "rows": rows, "nativeRuns": native_cells[key]}
        for key, rows in sorted(cells.items())
      ],
      "signals": signals,
      "counts": counts,
    },
  )
  write(
    evidence_path,
    {
      "step": 10,
      "version": version,
      **(
        {
          "interiorJunctionClearanceM": interior_junction_clearance_m,
          "interiorJunctions": junction_receipts,
        }
        if interior_junction_clearance_m > 0
        else {}
      ),
      "inputSha256": {
        str(p.relative_to(ROOT)): digest(p)
        for p in (
          boundary_path,
          source_path,
          OLD_STREETS,
          OLD_SIGNALS,
          ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json",
          APP / "surroundingCityScope.json",
          APP / "weinbergTerrainV176.json",
        )
      },
      "counts": counts,
      "paintOwners": owners,
      "paintStrips": paint,
      "policy": "Only explicit crossing styles, mapped lane_markings=yes with tagged lane counts and mapped restriction polygons. No zebra on unspecified/signal-only crossings. Existing source geometries/arrays unchanged. Width/paint dimensions, pole relocations, untagged directions and all signal timing are display estimates; no current traffic state claimed.",
      "references": [
        "https://wiki.openstreetmap.org/wiki/Key:crossing:markings",
        "https://wiki.openstreetmap.org/wiki/Key:traffic_signals:direction",
        "https://wiki.openstreetmap.org/wiki/Key:lane_markings",
        "https://wiki.openstreetmap.org/wiki/Key:road_marking",
      ],
    },
  )
  print(json.dumps(counts, indent=2))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    extract()
  build()
