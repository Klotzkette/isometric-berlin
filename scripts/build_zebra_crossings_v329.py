"""Bounded Berlin zebra markings on proved existing source road faces."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
import subprocess
from collections import Counter
from urllib.parse import urlencode

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from isometric_berlin.generation.road_geometry import parse_osm_measure_m, road_width_m
from scripts import build_city_streets_v249 as old
from scripts import build_network_fidelity_v326 as network
from scripts.build_alt_mitte_transport_v206 import VEHICULAR_HIGHWAYS, tangent
from scripts.build_cluster_facades_v320 import fnv, part_fingerprint
from scripts.build_surrounding_outlines import (
  PackedMesh,
  linear_rgb_bytes,
  polygons_from_geometry,
)

ROOT, GEO, DATA, PUBLIC = network.ROOT, network.GEO, network.DATA, network.PUBLIC
BASELINE = "d79f97dacf5aa5ad00f310af57fa181c3a8a284c"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
SOURCE = GEO / "zebra-crossings-v329-source.json.gz"
EVIDENCE = GEO / "zebra-crossings-v329-evidence.json.gz"
INDEX = DATA / "zebraCrossingsV329Index.json"
BOUNDARY = GEO / "berlin-boundaries-v200-source.json.gz"
PREDECESSORS = GEO / "raw/public-fidelity-v326/network-packet-support.json"
ORDINARY_EXCLUSIONS = {"3_-3", "4_-3"}
KIND = "zebra-crossings-v329"
WHITE = (238, 235, 221)
SURVEY = "strassenbefahrung:bp_fahrbahnmarkierung_flaeche"
FGUE = "fgue:fgue"
ZEBRAS = {"zebra", "zebra:double", "zebra:paired", "zebra:bicolour"}
VEHICLES = sorted(VEHICULAR_HIGHWAYS - {"motorway", "motorway_link"})
CORE_OLD = (
  "alt-mitte-transport-v206",
  "boulevard-transport-v210",
  "citywest-streets-v235",
)
REMOVED = re.compile(
  r"ersetzt|entfernt|abgebaut|aufgehoben|zurückgebaut|rückbau|entfällt", re.I
)


def compact(value):
  return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def write(path, value):
  raw = (compact(value) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def read(path):
  return network.read(path)


def request(layer):
  service = layer.split(":")[0]
  query = dict(
    service="WFS",
    version="2.0.0",
    request="GetFeature",
    typeNames=layer,
    count=1500,
    outputFormat="application/json",
    srsName="EPSG:25833",
  )
  if layer == SURVEY:
    query["filter"] = (
      '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">'
      "<fes:PropertyIsEqualTo><fes:ValueReference>fbf</fes:ValueReference>"
      "<fes:Literal>3</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>"
    )
  url = f"https://gdi.berlin.de/services/wfs/{service}?{urlencode(query)}"
  raw = subprocess.check_output(
    [
      "curl",
      "--fail",
      "--silent",
      "--show-error",
      "--proto",
      "=https",
      "--max-time",
      "30",
      "--max-filesize",
      str(2 * 1024 * 1024),
      url,
    ]
  )
  if len(raw) > 2 * 1024 * 1024:
    raise ValueError("Official response exceeded its read limit")
  parsed = json.loads(raw)
  rows = parsed["features"]
  if (
    parsed["crs"]["properties"]["name"] != "urn:ogc:def:crs:EPSG::25833"
    or parsed["numberMatched"] != parsed["numberReturned"]
    or parsed["numberReturned"] != len(rows)
    or len({f["id"] for f in rows}) != len(rows)
    or not rows
  ):
    raise ValueError("Incomplete or foreign official source")
  if layer == SURVEY and any(f["properties"]["fbf"] != "3" for f in rows):
    raise ValueError("Non-zebra marking from the official service")
  return {
    "url": url,
    "receivedBytes": len(raw),
    "sha256": hashlib.sha256(raw).hexdigest(),
    "timestamp": parsed["timeStamp"],
    "features": rows,
  }


def osm_style(tags):
  style = tags.get("crossing:markings")
  if style in ZEBRAS:
    return style
  if style in (None, "yes") and (
    tags.get("crossing_ref") == "zebra" or tags.get("crossing") == "zebra"
  ):
    return "zebra"
  return None


def explicit_other(tags):
  mark = tags.get("crossing:markings")
  return not osm_style(tags) and (
    mark not in (None, "yes", "unknown")
    or tags.get("crossing")
    in {
      "traffic_signals",
      "unmarked",
      "no",
      "informal",
    }
    or tags.get("crossing:signals") == "yes"
  )


def city_boundary():
  state = read(BOUNDARY)["state"]
  if state["crs"]["properties"]["name"] != "urn:ogc:def:crs:EPSG::25833":
    raise ValueError("Foreign Berlin boundary coordinates")
  return network.world(
    shapely.make_valid(unary_union([shape(f["geometry"]) for f in state["features"]]))
  )


def extract():
  survey, register = request(SURVEY), request(FGUE)
  print(
    f"Official source: {len(survey['features'])} bands, {len(register['features'])} register points",
    flush=True,
  )
  boundary = city_boundary()
  surveyed = STRtree([network.world(shape(f["geometry"])) for f in survey["features"]])
  osm, conflicts = [], []
  for layer, sql in (
    ("points", "highway = 'crossing'"),
    (
      "lines",
      """other_tags LIKE '%"footway"=>"crossing"%' OR other_tags LIKE '%"path"=>"crossing"%' OR other_tags LIKE '%"cycleway"=>"crossing"%'""",
    ),
  ):
    df = pyogrio.read_dataframe(
      PBF, layer=layer, where=sql, columns=["osm_id", "highway", "other_tags"]
    ).to_crs(25833)
    for row in df.itertuples():
      tags = network.tags({"other_tags": row.other_tags, "highway": row.highway})
      style = osm_style(tags)
      if not (style or explicit_other(tags)) or not network.at_grade(tags):
        continue
      geometry = network.world(row.geometry)
      if geometry.is_empty or not boundary.covers(geometry):
        continue
      if not style and not len(
        surveyed.query(geometry, predicate="dwithin", distance=3)
      ):
        continue
      prefix = "node" if layer == "points" else "way"
      props = {
        k: v
        for k, v in tags.items()
        if k.startswith("crossing")
        or k in ("width", "highway", "footway", "cycleway", "path")
      }
      row = {
        "id": f"{prefix}/{row.osm_id}",
        "geometry": mapping(geometry),
        "tags": props,
      }
      (osm if style else conflicts).append(row)
  print(
    f"OSM source: {len(osm)} positive and {len(conflicts)} explicit conflicting records",
    flush=True,
  )
  # A road axis is needed only to orient point-only and surveyed polygon
  # crossings. Keep complete source lines near those limited features.
  queries = [shape(f["geometry"]) for f in osm if f["id"].startswith("node/")]
  queries += [network.world(shape(f["geometry"])).centroid for f in survey["features"]]
  tree = STRtree(queries)
  where = "highway IN (" + ",".join(f"'{kind}'" for kind in VEHICLES) + ")"
  roads = []
  frame = pyogrio.read_dataframe(
    PBF, layer="lines", where=where, columns=["osm_id", "highway", "other_tags"]
  ).to_crs(25833)
  for row in frame.itertuples():
    tags = network.tags({"other_tags": row.other_tags, "highway": row.highway})
    if not network.at_grade(tags):
      continue
    axis = network.world(row.geometry)
    if axis.length < 0.5 or not len(tree.query(axis, predicate="dwithin", distance=9)):
      continue
    width = road_width_m(tags)
    if width and 2 <= width <= 28:
      roads.append(
        {"id": f"way/{row.osm_id}", "width": width, "geometry": mapping(axis)}
      )
  write(
    SOURCE,
    {
      "schemaVersion": 1,
      "osmSnapshot": "2026-09-29",
      "osmSha256": network.sha(PBF),
      "boundarySha256": network.sha(BOUNDARY),
      "officialSurvey": survey,
      "officialRegister": register,
      "osm": sorted(osm, key=lambda r: r["id"]),
      "osmConflicts": sorted(conflicts, key=lambda r: r["id"]),
      "roads": sorted(roads, key=lambda r: r["id"]),
    },
  )
  print(f"Source frozen: {len(roads)} nearby at-grade road axes", flush=True)


def nearest_axis(point, roads, tree, max_distance):
  matches = []
  for i in tree.query(point, predicate="dwithin", distance=max_distance):
    g = roads[int(i)]["shape"]
    matches.append(
      (g.distance(point), roads[int(i)]["id"], roads[int(i)], tangent(g, point))
    )
  matches.sort(key=lambda r: r[:2])
  if not matches:
    return None
  distance, _, road, direction = matches[0]
  # A crossing point at a genuine multi-road junction is not sufficient to
  # choose a roadway unless the connected source axes agree in direction.
  if any(
    abs(a * direction[0] + b * direction[1]) < 0.85
    for d, _, _, (a, b) in matches[1:]
    if d <= distance + 0.45
  ):
    return None
  return road, direction


def strips(course, width, style):
  """Render a tagged course, with explicit bounded presentation dimensions."""
  if course.length < 1 or course.length > 64:
    return Polygon()
  bars = []
  count = math.floor(course.length)
  for i in range(count):
    if style == "zebra:paired" and i % 3 == 2:
      continue
    p = course.interpolate((course.length - count) / 2 + i + 0.5)
    tx, tz = tangent(course, p)
    extents = (
      [(-width / 2, -0.13), (0.13, width / 2)]
      if style == "zebra:double"
      else [(-width / 2, width / 2)]
    )
    for lo, hi in extents:
      bars.append(
        LineString([(p.x - tz * u, p.y + tx * u) for u in (lo, hi)]).buffer(
          0.25, cap_style=2
        )
      )
  return unary_union(bars)


def band_stripes(band, direction):
  """Cover the measured band with alternating strips within its exact outline."""
  center = band.centroid
  tx, tz = direction
  cross = (-tz, tx)
  points = shapely.get_coordinates(band)
  delta = points - [center.x, center.y]
  across = delta @ cross
  length = float(np.ptp(across))
  if not 1 <= length <= 60:
    return Polygon()
  course = LineString(
    [
      (center.x + cross[0] * s, center.y + cross[1] * s)
      for s in (min(across), max(across))
    ]
  )
  return strips(
    course, min(30, float(np.ptp(delta @ [tx, tz])) + 2), "zebra"
  ).intersection(band)


def prior_markings():
  """Exact already-rendered mark identities and footprints across the city."""
  pieces, owners = [], set()
  for name in CORE_OLD:
    evidence = read(GEO / f"{name}-evidence.json")
    for row in evidence["paintOwners"]:
      if row["kind"] != "zebra":
        continue
      marks = [
        old.ribbon(s)
        for s in evidence["paintStrips"][row["first"] : row["first"] + row["count"]]
      ]
      if marks:
        pieces.append(unary_union(marks).convex_hull.buffer(0.2))
        owners.add(row["key"])
  for entry in read(GEO / "city-streets-v249-evidence.json.gz")["emitted"]:
    for row in entry["records"]:
      if row["kind"] == "zebra":
        pieces.append(shape(row["geometry"]).convex_hull.buffer(0.2))
        owners.add(row["key"])
  return pieces, owners


def candidates(source, boundary):
  roads = [{**r, "shape": shape(r["geometry"])} for r in source["roads"]]
  road_tree = STRtree([r["shape"] for r in roads])
  legacy, old_ids = prior_markings()
  legacy_tree = STRtree(legacy)
  ways = [r for r in source["osm"] if r["id"].startswith("way/")]
  nodes = [r for r in source["osm"] if r["id"].startswith("node/")]
  lines = [shape(r["geometry"]) for r in ways]
  way_tree = STRtree(lines)
  other = [shape(r["geometry"]) for r in source["osmConflicts"]]
  other_tree = STRtree(other)
  removed = [
    network.world(shape(r["geometry"]))
    for r in source["officialRegister"]["features"]
    if REMOVED.search(r["properties"].get("besond") or "")
  ]
  removed_tree = STRtree(removed)
  result, excluded = [], {}

  def admit(key, paint, hull, evidence, **extra):
    if paint.is_empty or not boundary.covers(hull):
      excluded[key] = "empty-or-outside-Berlin"
    elif key in old_ids or len(legacy_tree.query(hull, predicate="intersects")):
      excluded[key] = "previously-modelled-marking"
    else:
      result.append(dict(id=key, paint=paint, hull=hull, evidence=evidence, **extra))

  for row, course in zip(ways, lines, strict=True):
    width = min(6, max(1.5, parse_osm_measure_m(row["tags"].get("width")) or 3))
    style = osm_style(row["tags"])
    if style == "zebra:bicolour":
      excluded[row["id"]] = "unverified-alternating-colours"
      continue
    admit(
      row["id"],
      strips(course, width, style),
      course.buffer(width / 2, cap_style=2),
      "OSM-crossing-way",
    )
  for row in nodes:
    point = shape(row["geometry"])
    key = row["id"]
    if len(way_tree.query(point, predicate="dwithin", distance=0.65)):
      excluded[key] = "same-OSM-marking-as-crossing-way"
      continue
    match = nearest_axis(point, roads, road_tree, 0.35)
    style = osm_style(row["tags"])
    if match is None or style == "zebra:bicolour":
      excluded[key] = "no-unambiguous-ordinary-road-axis-or-colours"
      continue
    road, (tx, tz) = match
    span = road["width"] / 2
    width = min(6, max(1.5, parse_osm_measure_m(row["tags"].get("width")) or 3))
    course = LineString(
      [
        (point.x - tz * span, point.y + tx * span),
        (point.x + tz * span, point.y - tx * span),
      ]
    )
    admit(
      key,
      strips(course, width, style),
      course.buffer(width / 2, cap_style=2),
      "OSM-crossing-node",
      road=road["id"],
    )
  osm_hulls = [row["hull"] for row in result]
  # Official bands never create a second marking over positive current OSM.
  # An OSM point may corroborate a measured band even if its own axis was ambiguous.
  positive_points = [shape(r["geometry"]) for r in nodes]
  osm_tree = STRtree(osm_hulls + positive_points)
  for feature in source["officialSurvey"]["features"]:
    key = "Berlin/" + feature["properties"]["gis_id"]
    band = network.world(shapely.make_valid(shape(feature["geometry"])))
    if band.is_empty:
      excluded[key] = "empty-survey-polygon"
      continue
    if len(other_tree.query(band, predicate="dwithin", distance=0.5)) or len(
      removed_tree.query(band, predicate="dwithin", distance=2)
    ):
      excluded[key] = "newer-crossing-data-conflicts"
      continue
    previous = osm_tree.query(band, predicate="dwithin", distance=0.55)
    if any(i < len(osm_hulls) for i in previous):
      excluded[key] = "same-marking-as-current-OSM"
      continue
    match = nearest_axis(band.centroid, roads, road_tree, 6)
    if match is None:
      excluded[key] = "no-unambiguous-ordinary-road-axis"
      continue
    road, direction = match
    admit(
      key,
      band_stripes(band, direction),
      band,
      "Berlin-survey-2014/15",
      road=road["id"],
      corroborated=bool(len(previous)),
    )
  return result, excluded


def baseline_manifest():
  blob = "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  raw = subprocess.check_output(["git", "show", f"{BASELINE}:{blob}"], cwd=ROOT)
  return json.loads(raw), hashlib.sha256(raw).hexdigest()


def areas(packet, records, focus):
  x, _, z = packet["origin"]
  found = []
  for row in records:
    polygon = translate(Polygon(row["ring"], row.get("holes", [])).buffer(0), x, z)
    if focus.intersects(polygon):
      found.append(polygon.intersection(focus))
  return unary_union(found)


def road_layers(packet, focus):
  """Read retained road and higher top triangles only near candidate bands."""
  roads, higher = [], []
  road_rgb = linear_rgb_bytes(np.array([[109, 112, 109]], dtype=np.uint8))[0]
  x0, z0, x1, z1 = focus.bounds
  for i, part in enumerate(packet["meshes"]):
    if part["kind"] != "city" or part["positionType"] != "u16cm":
      continue
    xyz = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    triangles = xyz[indices]
    y = triangles[:, 0, 1]
    mask = (y >= 3.085) & (y <= 3.151) & (np.ptp(triangles[:, :, 1], axis=1) < 0.001)
    mask &= (triangles[:, :, 0].min(1) <= x1) & (triangles[:, :, 0].max(1) >= x0)
    mask &= (triangles[:, :, 2].min(1) <= z1) & (triangles[:, :, 2].max(1) >= z0)
    unavailable = packet.get("unavailableFloorTriangles", {}).get(str(i), [])
    if unavailable:
      mask[np.asarray(unavailable, dtype=int)] = False
    for at in np.flatnonzero(mask):
      triangle = Polygon(triangles[at][:, [0, 2]])
      if triangle.area < 1e-8 or not focus.intersects(triangle):
        continue
      if abs(y[at] - 3.09) < 0.001 and np.all(colors[indices[at]] == road_rgb):
        roads.append(triangle)
      elif y[at] > 3.095:
        higher.append(triangle)
  return unary_union(roads), unary_union(higher)


def ubahn_points():
  authored = set(read(DATA / "ubahnAuthoredGroundV326Index.json")["ids"])
  index = {r["id"] for r in read(DATA / "ubahnAccessV326Index.json")["entries"]}
  return [
    (r["id"], x, z)
    for r in read(DATA / "ubahnAccessV326.json")["entries"]
    if r["id"] in index and r["id"] not in authored
    for x, z in [r["point"]]
    if not (-3900 <= x < 2412 and -3620 <= z < 2912)
  ]


def ubahn_hosts(packet, points):
  ox, _, oz = packet["origin"]
  inside = [
    (id, x - ox, z - oz)
    for id, x, z in points
    if ox <= x < ox + 512 and oz <= z < oz + 512
  ]
  if not inside:
    return []

  def ring_contains(ring, x, z):
    return (
      sum(
        (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax
        for (ax, az), (bx, bz) in zip(ring, ring[-1:] + ring[:-1], strict=True)
      )
      % 2
    )

  def contains(rows, x, z):
    return any(
      ring_contains(p["ring"], x, z)
      and not any(ring_contains(h, x, z) for h in p["holes"])
      for p in rows
    )

  nav = packet["nav"]
  return [
    id
    for id, x, z in inside
    if contains(nav["ground"], x, z) and not contains(nav["water"], x, z)
  ]


def compile_packets():
  source = read(SOURCE)
  if network.sha(BOUNDARY) != source["boundarySha256"]:
    raise ValueError("Changed Berlin boundary source")
  boundary = city_boundary()
  crossings, excluded = candidates(source, boundary)
  tree = STRtree([c["paint"] for c in crossings])
  manifest, manifest_hash = baseline_manifest()
  published, receipts, counts = {}, [], Counter()
  support_proofs = read(PREDECESSORS)
  old_rail, old_ground, _ = network.exclusions()
  occupied = {"drawn": Polygon(), "minecraft": Polygon()}
  crossing_results = {"drawn": set(), "minecraft": set()}
  accesses = ubahn_points()
  ubahn_excluded = {}
  core_followup = []
  for entry in manifest["chunks"]:
    if entry.get("detailCompanionOf"):
      continue
    tile = box(*entry["bounds"])
    at = tree.query(tile, predicate="intersects")
    if not len(at):
      continue
    if entry["id"] in ORDINARY_EXCLUSIONS:
      core_followup.extend(
        {
          "id": crossings[i]["id"],
          "packet": entry["id"],
          "center": list(crossings[i]["hull"].centroid.coords)[0],
        }
        for i in at
      )
      continue
    focus = (
      unary_union([crossings[i]["paint"].envelope for i in at])
      .buffer(0.65)
      .intersection(tile)
    )
    if focus.is_empty or focus.area < 0.1:
      continue
    shapely.prepare(focus)
    for mode in occupied:
      key = mode + ":" + entry["id"]
      path = PUBLIC / entry[mode]["url"]
      if network.sha(path) != entry[mode]["sha256"]:
        raise ValueError(f"Changed wire source at {key}")
      packet = read(path)
      if packet["nav"]["groundY"] != 3 or packet["origin"][1] != -10:
        continue
      proof = support_proofs.get(key)
      if proof:
        if proof["sourceSha256"] != entry[mode]["sha256"]:
          raise ValueError(f"Changed retained floor proof at {key}")
        packet["unavailableFloorTriangles"] = proof["unavailable"]
      road, above = road_layers(packet, focus)
      if road.is_empty:
        continue
      allowed = focus.intersection(boundary)
      blockers = areas(
        packet,
        packet["nav"]["buildings"]
        + packet["nav"].get("bridges", [])
        + packet["nav"].get("water", []),
        focus,
      )
      safe = road.intersection(allowed).difference(
        unary_union(
          [
            blockers.buffer(0.04),
            above,
            old_ground.intersection(focus),
            old_rail.intersection(focus),
            occupied[mode].intersection(focus),
          ]
        )
      )
      if safe.is_empty:
        continue
      mesh = PackedMesh(packet["origin"][0], packet["origin"][2])
      selected = []
      for i in sorted(map(int, at)):
        row = crossings[i]
        geometry = network.bounded_shape(
          row["paint"], safe.intersection(row["hull"]), mode == "minecraft"
        )
        if geometry.area < 0.35 or len(list(polygons_from_geometry(geometry))) < 2:
          continue
        mesh.surface(geometry, 3.10, WHITE)
        selected.append(
          {
            "id": row["id"],
            "evidence": row["evidence"],
            "footprint": mapping(geometry),
            "road": row.get("road"),
            "supportY": 3.09,
          }
        )
        safe = safe.difference(geometry.buffer(0.025))
      append = mesh.payload(KIND)
      if not append:
        continue
      potential_accesses = ubahn_hosts(packet, accesses)
      if potential_accesses:
        ubahn_excluded[key] = {
          "accesses": potential_accesses,
          "crossings": sorted(r["id"] for r in selected),
        }
        continue
      occupied[mode] = occupied[mode].union(
        unary_union([shape(r["footprint"]) for r in selected])
      )
      line = packet.get("lines")
      published[key] = {
        "origin": packet["origin"],
        "navGuard": 0,  # Exact JSON text pin is finalized in Bun.
        "lineGuard": fnv(line["positions"], line.get("colors", "")) if line else None,
        "records": [
          {"mesh": i, "kind": p["kind"], "fingerprint": part_fingerprint(p)}
          for i, p in enumerate(packet["meshes"])
        ],
        "append": append,
        "appendFingerprint": part_fingerprint(append),
        "retire": [],
        "owners": sorted(r["id"] for r in selected),
      }
      counts[mode + "Packets"] += 1
      counts[mode + "Triangles"] += len(mesh.indices) // 3
      crossing_results[mode].update(r["id"] for r in selected)
      receipts.append(
        {"key": key, "packetSha256": entry[mode]["sha256"], "features": selected}
      )
      if len(published) % 60 == 0:
        print(f"{len(published)} verified packet recipes", flush=True)
  for mode in occupied:
    counts[mode + "UniqueRecords"] = len(crossing_results[mode])
  evidence = {
    "schemaVersion": 1,
    "baseline": BASELINE,
    "baselineManifestSha256": manifest_hash,
    "sourceSha256": network.sha(SOURCE),
    "predecessorFloorReceiptSha256": network.sha(PREDECESSORS),
    "counts": dict(counts),
    "packets": receipts,
    "excluded": excluded,
    "excludedOrdinaryCoreOverlap": core_followup,
    "excludedUbahnPotentialHosts": ubahn_excluded,
    "sourceCandidates": [
      {k: v for k, v in r.items() if k not in {"paint", "hull"}} for r in crossings
    ],
    "withoutVisibleOrdinaryHost": {
      mode: sorted({r["id"] for r in crossings} - seen)
      for mode, seen in crossing_results.items()
    },
  }
  write(EVIDENCE, evidence)
  index = []
  for part, start in enumerate(range(0, len(published), 128)):
    keys = sorted(published)[start : start + 128]
    file = f"zebraCrossingsV329Packets{part}.json"
    write(
      DATA / file,
      {
        "schemaVersion": 1,
        "keys": keys,
        "packets": {key: published[key] for key in keys},
      },
    )
    index.append({"file": file, "keys": keys})
  write(INDEX, {"schemaVersion": 1, "sources": index})
  print(
    compact(
      {
        "counts": counts,
        "candidateRecords": len(crossings),
        "excludedReasons": Counter(excluded.values()),
      }
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  options = parser.parse_args()
  if options.extract:
    extract()
  else:
    compile_packets()
