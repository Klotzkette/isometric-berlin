"""Associate current directory sites with existing measured exterior walls.

A location inside one building, or a matching mapped building polygon, is
required. Closing streets, nearby houses and guessed entrances are excluded.
The Bun stage checks the final production triangles of both geometry families.
"""

from __future__ import annotations

import argparse
import hashlib
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, transform, unary_union
from shapely.strtree import STRtree

from scripts import build_civic_facilities_v350 as civic
from scripts import build_cluster_facades_v320 as common

GEO = common.GEO
SOURCES = (
  "aemter-v355-source.json.gz",
  "polizeiwachen-v355-source.json.gz",
  "retail-v355-source.json.gz",
)
KINDS = ("tax-office", "citizen-office", "police", "car-dealer", "mall")
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def project(lon, lat):
  x, y = PROJECT.transform(lon, lat)
  return x - 389500, 5820000 - y


def site_geometry(site):
  mapped = site.get("buildingGeometry")
  if mapped:
    polygon = transform(project, shape(mapped))
    if polygon.is_valid and polygon.area > 4:
      return polygon
  return Point(project(site["lon"], site["lat"]))


def building_geometry(building, origin):
  holes = [
    ring
    for ring in building.get("holes", [])
    if len(ring) >= 3 and Polygon(ring).area > 0
  ]
  polygon = Polygon(building["ring"], holes)
  if not polygon.is_valid:
    repaired = make_valid(polygon)
    pieces = [
      g for g in getattr(repaired, "geoms", [repaired]) if g.geom_type == "Polygon"
    ]
    if len(pieces) == 1 and abs(pieces[0].area - polygon.area) < 0.02:
      polygon = pieces[0]
  return translate(polygon, origin[0], origin[2])


def boundary_faces(building, raw, bounds, native):
  """Yield exterior nav edges; the production decoder proves actual support."""
  y0 = raw["nav"]["groundY"] + building.get("groundOffset", 0)
  low = y0 + building.get("minHeight", 0)
  high = y0 + building["height"]
  poly = building_geometry(building, raw["origin"])
  if not poly.is_valid or building.get("minHeight", 0) > 0.1 or high - low < 2.6:
    return
  perimeter = (
    poly.simplify(0, preserve_topology=True).exterior if native else poly.exterior
  )
  for a, b in zip(perimeter.coords, list(perimeter.coords)[1:]):
    length = math.dist(a, b)
    if length < 1.6:
      continue
    direction = (np.array(b) - a) / length
    normal = np.array([-direction[1], direction[0]])
    center = (np.array(a) + b) / 2
    if poly.covers(Point(center + normal * 0.22)):
      normal *= -1
    if not bounds.covers(Point(center + normal * 0.12)):
      continue
    yield dict(
      a=list(a),
      b=list(b),
      direction=direction.tolist(),
      normal=normal.tolist(),
      length=length,
      low=low,
      high=high,
      owner=building["sourceId"],
    )


def facing_candidates(site, building, raw, native, bounds, roads, road_tree, occupied):
  location = Point(project(site["lon"], site["lat"]))
  entrance = site.get("entrance")
  if (
    isinstance(entrance, dict)
    and entrance.get("sourceUrl")
    and "lon" in entrance
    and "lat" in entrance
  ):
    location = Point(project(entrance["lon"], entrance["lat"]))
    mapped_entrance = True
  else:
    mapped_entrance = False
  placements = []
  for face in boundary_faces(building, raw, bounds, native):
    a, b = face["a"], face["b"]
    if native and a[0] != b[0] and a[1] != b[1]:
      continue
    line = LineString([a, b])
    center = line.interpolate(0.5, normalized=True)
    near = nearest_points(center, roads[int(road_tree.nearest(center))])[1]
    toward = np.array([near.x - center.x, near.y - center.y])
    normal = np.asarray(face["normal"])
    alignment = float(np.dot(toward, normal)) / max(
      0.001, float(np.linalg.norm(toward))
    )
    distance = line.distance(location)
    if (not mapped_entrance or distance > 3) and (
      alignment < 0.38 or center.distance(near) > 100
    ):
      continue
    position = np.array(line.interpolate(line.project(location)).coords[0])
    direction = np.asarray(face["direction"])
    width = min(2.8, face["length"] - 0.26)
    center_offset = np.clip(
      np.dot(position - a, direction),
      width / 2 + 0.12,
      face["length"] - width / 2 - 0.12,
    )
    position = np.asarray(a) + direction * center_offset
    strip = Polygon(
      [
        position - direction * width / 2 + normal * 0.20,
        position + direction * width / 2 + normal * 0.20,
        position + direction * width / 2 + normal * 0.75,
        position - direction * width / 2 + normal * 0.75,
      ]
    )
    if len(occupied.query(strip, predicate="intersects")):
      continue
    origin = raw["origin"]
    label = civic.short_name(site["name"])
    for prefix in ("FINANZAMT ", "BURGERAMT ", "POLIZEIABSCHNITT "):
      if label.startswith(prefix) and len(label) > len(prefix):
        label = civic.short_name(site["name"].split(" ", 1)[1])
        break
    recipe = [
      round((position[0] - origin[0]) * 100),
      round((face["low"] + 1.64 - origin[1]) * 100),
      round((position[1] - origin[2]) * 100),
      *[round(d * 1e6) for d in [*face["direction"], *face["normal"]]],
      round(width * 100),
      KINDS.index(site["kind"]),
      label,
    ]
    if not all(70 <= v <= 65460 for v in recipe[:3]):
      continue
    score = (
      distance + (0 if native else center.distance(near) * 0.25) + (1 - alignment) * 1.3
    )
    placements.append((score, recipe, face, mapped_entrance and distance <= 3))
  return [list(row[1:]) for row in sorted(placements, key=lambda r: r[0])[:8]]


def facade_panels(site, building, raw, native, bounds, host):
  """Land reference courses on the exact nearby exterior, with no extrapolation."""
  refs = site.get("facadeReference", [])
  if isinstance(refs, dict):
    refs = [refs]
  result = []
  origin = raw["origin"]
  for index, ref in enumerate(refs):
    if (
      ref.get("hostHint", host) != host
      or ref.get("ownerHint", building["sourceId"]) != building["sourceId"]
    ):
      continue
    if native and ref.get("native"):
      ref = {**ref, **ref["native"]}
    if not all(
      field in ref
      for field in ("point", "normal", "width", "bottom", "top", "finish", "url")
    ):
      continue
    anchor = Point(project(*ref["point"]))
    finish = ref["finish"]
    kind = finish["type"]
    if kind == "lamellae":
      kind = (
        "horizontal" if finish.get("direction") == "horizontal" else "vertical"
      ) + "-lamellae"
    if kind not in ("horizontal-lamellae", "vertical-lamellae", "glazing", "panel"):
      continue
    for face in boundary_faces(building, raw, bounds, native):
      a, b = np.asarray(face["a"]), np.asarray(face["b"])
      if native and a[0] != b[0] and a[1] != b[1]:
        continue
      line = LineString([a, b])
      if (
        line.distance(anchor) > (5 if native else 1.5)
        or np.dot(face["normal"], ref["normal"]) < 0.85
      ):
        continue
      width = min(ref["width"], face["length"] - 0.40, 100)
      if width < 1.4 or width < ref["width"] * 0.68:
        continue
      bottom = face["low"] + ref["bottom"]
      top = min(face["high"] - 0.17, face["low"] + ref["top"])
      if top - bottom < (ref["top"] - ref["bottom"]) * 0.80:
        continue
      offset = np.clip(
        line.project(anchor), width / 2 + 0.18, line.length - width / 2 - 0.18
      )
      x, z = line.interpolate(offset).coords[0]
      spec = dict(
        anchor=[
          round((x - origin[0]) * 100),
          round(((bottom + top) / 2 - origin[1]) * 100),
          round((z - origin[2]) * 100),
          *[round(v * 1e6) for v in [*face["direction"], *face["normal"]]],
          round(width * 100),
          0,
          "",
        ],
        height=round((top - bottom) * 100),
        finish=kind,
        fill=finish["color"],
        frame=finish["frame"],
        count=min(
          64,
          max(
            1,
            round(
              finish["count"]
              * (width / ref["width"] if kind != "horizontal-lamellae" else 1)
            ),
          ),
        ),
      )
      result.append(dict(reference=ref["url"], index=index, panel=spec))
  return result


def prepare(scratch, inputs):
  manifest = common.read(common.PUBLIC / "manifest.json")
  roads_file = GEO / "raw/city-v346/named-roads.geojson.gz"
  roads = [shape(row["geometry"]) for row in common.read(roads_file)["features"]]
  road_tree = STRtree(roads)
  sites = {}
  for path in inputs:
    document = common.read(path)
    for row in document["sites"]:
      assert row["kind"] in KINDS and row["id"] not in sites
      assert row["sourceUrl"].startswith("https://")
      assert 13.07 < row["lon"] < 13.77 and 52.31 < row["lat"] < 52.71, row["id"]
      sites[row["id"]] = row
  ids = sorted(sites)
  areas = [site_geometry(sites[key]) for key in ids]
  points = [Point(project(sites[key]["lon"], sites[key]["lat"])) for key in ids]
  targets = STRtree(areas)
  point_targets = STRtree(points)
  point_matches = defaultdict(list)
  contained_parts = defaultdict(list)
  site_areas = dict(zip(ids, areas, strict=True))
  references = {}
  reference_points = []
  for key, row in sites.items():
    refs = row.get("facadeReference") or []
    if isinstance(refs, dict):
      refs = [refs]
    for ref in refs:
      if ref.get("hostHint") and ref.get("ownerHint") and ref.get("point"):
        references[(ref["hostHint"], ref["ownerHint"])] = key
        reference_points.append(Point(project(*ref["point"])))
  ref_targets = STRtree(reference_points)
  matches = defaultdict(list)
  core = common.read(
    common.ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  )
  core_matches = defaultdict(set)
  for building in core["buildings"]:
    ring = [[x / 10, z / 10] for x, z in building["ring"]]
    holes = [[[x / 10, z / 10] for x, z in h] for h in building.get("holes", [])]
    poly = Polygon(ring, holes)
    if poly.is_valid:
      for index in point_targets.query(poly, predicate="covers"):
        core_matches[ids[index]].add(building["id"])

  for descriptor in manifest["chunks"]:
    bounds = box(*descriptor["bounds"])
    if not len(targets.query(bounds, predicate="intersects")) and not len(
      ref_targets.query(bounds, predicate="intersects")
    ):
      continue
    raw = common.read(common.PUBLIC / descriptor["drawn"]["url"])
    buildings = [
      (b, building_geometry(b, raw["origin"])) for b in raw["nav"]["buildings"]
    ]
    buildings = [
      (b, p)
      for b, p in buildings
      if p.is_valid and p.area > 4 and b.get("minHeight", 0) <= 0.1
    ]
    for building, poly in buildings:
      hinted_key = references.get((descriptor["id"], building["sourceId"]))
      if hinted_key:
        matches[hinted_key].append((descriptor, building, poly.area))
      for index in point_targets.query(poly, predicate="covers"):
        point_matches[ids[index]].append((descriptor, building, poly.area))
      for index in targets.query(poly, predicate="intersects"):
        key = ids[index]
        if key == hinted_key:
          continue
        area = areas[index]
        if area.area:
          overlap = poly.intersection(area).area
          if min(overlap / area.area, overlap / poly.area) < 0.87:
            if overlap / poly.area >= 0.96:
              contained_parts[key].append((descriptor, building, poly))
            continue
        elif not poly.covers(area):
          continue
        matches[key].append((descriptor, building, poly.area))

  decisions = {}
  work = defaultdict(list)
  for key, row in sites.items():
    candidates = matches[key]
    if not candidates and contained_parts[key]:
      parts = contained_parts[key]
      whole = site_areas[key]
      owners = {building["sourceId"] for _, building, _ in parts}
      if (
        len(owners) == 1
        and unary_union([p for _, _, p in parts]).intersection(whole).area / whole.area
        >= 0.87
      ):
        candidates = [(d, b, p.area) for d, b, p in parts]
    if not candidates and not row.get("buildingGeometry") and not row.get("geometry"):
      candidates = point_matches[key]
    hints = {owner for (host, owner), site_id in references.items() if site_id == key}
    if row.get("sourceOwner"):
      hints.add(row["sourceOwner"])
    hinted = [r for r in candidates if r[1]["sourceId"] in hints]
    if hinted:
      candidates = hinted
    by_owner = {building["sourceId"] for _, building, _ in candidates}
    if not candidates:
      decisions[key] = dict(
        status="core-shell-retained" if core_matches[key] else "building-unresolved",
        core=sorted(core_matches[key]),
      )
    elif len(by_owner) > 1:
      decisions[key] = dict(
        status="multiple-overlapping-source-owners", owners=sorted(by_owner)
      )
    else:
      entrance = row.get("entrance")
      if entrance and len(candidates) > 1:
        entrance_point = Point(project(entrance["lon"], entrance["lat"]))
        with_entrance = [
          c for c in candidates if box(*c[0]["bounds"]).covers(entrance_point)
        ]
        if with_entrance:
          candidates = with_entrance
      for descriptor, building, _ in candidates:
        work[descriptor["id"]].append((key, building, descriptor))
  jobs = []
  for host, rows in sorted(work.items()):
    descriptor = rows[0][2]
    bounds = box(*descriptor["bounds"])
    modes = {}
    for mode in ("drawn", "minecraft"):
      path = common.PUBLIC / descriptor[mode]["url"]
      raw = common.read(path)
      retained = defaultdict(list)
      for b in raw["nav"]["buildings"]:
        retained[b["sourceId"]].append(b)
      occupied = STRtree(
        [building_geometry(b, raw["origin"]) for b in raw["nav"]["buildings"]]
      )
      records = {}
      for key, building, _ in rows:
        choices = [building] if mode == "drawn" else retained[building["sourceId"]]
        if not choices:
          continue
        options = (
          []
          if key in {"kotti-wache", "bundespolizei-hbf"}
          or str(sites[key].get("storey", "0")) not in ("0", "ground", "")
          else [
            p
            for b in choices
            for p in facing_candidates(
              sites[key],
              b,
              raw,
              mode == "minecraft",
              bounds,
              roads,
              road_tree,
              occupied,
            )
          ]
        )
        panels = [
          panel
          for b in choices
          for panel in facade_panels(
            sites[key], b, raw, mode == "minecraft", bounds, host
          )
        ]
        if options or panels:
          records[key] = dict(
            owner=building["sourceId"], options=options, panels=panels
          )
      modes[mode] = dict(path=str(path), sites=records)
    paired = set(modes["drawn"]["sites"]) & set(modes["minecraft"]["sites"])
    if paired:
      for mode in modes.values():
        mode["sites"] = {key: mode["sites"][key] for key in sorted(paired)}
      jobs.append(dict(host=host, modes=modes))
    for key, building, _ in rows:
      decisions[key] = dict(
        status="retained-shell", owner=building["sourceId"], host=host
      )
  scratch.mkdir(parents=True, exist_ok=True)
  common.write(scratch / "jobs.json", jobs)
  common.write(
    scratch / "inventory.json",
    dict(
      sourceFiles={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
      sites=sites,
      decisions=decisions,
    ),
  )
  print(
    len(sites),
    "directory sites",
    len(jobs),
    "candidate hosts",
    sum(len(j["modes"]["drawn"]["sites"]) for j in jobs),
    "paired site/host candidates",
    dict(Counter(x["status"] for x in decisions.values())),
    flush=True,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("scratch", type=Path)
  parser.add_argument("--input", type=Path, action="append")
  args = parser.parse_args()
  prepare(args.scratch, args.input or [GEO / name for name in SOURCES])
