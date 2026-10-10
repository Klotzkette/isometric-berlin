"""Small additive transport details from retained, complete OSM geometries."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PROJECTION = Transformer.from_crs(4326, 25833, always_xy=True)
CANOPIES = {"way/36218351", "way/375394534", "way/438832765", "way/44426688"}


def world(x, y, z=None):
  e, n = PROJECTION.transform(x, y)
  try:
    return [v - 389500 for v in e], [5820000 - v for v in n]
  except TypeError:
    return e - 389500, 5820000 - n


def dump(path, value):
  path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def digest(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def rings(p):
  return [
    [[round(x, 3), round(z, 3)] for x, z in r.coords]
    for r in [p.exterior, *p.interiors]
  ]


def native_runs(p, y, thickness, color, step):
  """Only wholly contained orthogonal cells; merge consecutive cells per row."""
  rows = []
  x0, z0, x1, z1 = p.bounds
  for iz in range(math.ceil((z1 - z0) / step)):
    z = z0 + iz * step
    d = min(step, z1 - z)
    start = None
    for ix in range(math.ceil((x1 - x0) / step) + 1):
      x = min(x1, x0 + ix * step)
      w = min(step, x1 - x)
      inside = w > 0 and p.covers(box(x, z, x + w, z + d))
      if inside and start is None:
        start = x
      if not inside and start is not None:
        rows.append([(start + x) / 2, y, z + d / 2, x - start, thickness, d, color])
        start = None
  return [[round(v, 3) if isinstance(v, float) else v for v in row] for row in rows]


def airport_source(features):
  archived = GEO / "ber-v205-parts-source.json"
  if archived.exists():
    return json.loads(archived.read_bytes())
  raw = GEO / "raw/region-v200/ber-map.osm"
  tree = ET.parse(raw).getroot()
  nodes = {
    int(n.attrib["id"]): (float(n.attrib["lon"]), float(n.attrib["lat"]))
    for n in tree.findall("node")
  }
  parts = {}
  selected = {519141134, 519141137, 1082978657, *range(1429967664, 1429967682)}
  for w in tree.findall("way"):
    ident = int(w.attrib["id"])
    if ident not in selected:
      continue
    tags = {t.attrib["k"]: t.attrib["v"] for t in w.findall("tag")}
    p = Polygon([nodes[int(n.attrib["ref"])] for n in w.findall("nd")])
    assert p.is_valid
    parts[f"way/{ident}"] = {"id": f"way/{ident}", "tags": tags, "geometry": mapping(p)}
  assert len(parts) == len(selected)
  # Complete source parts are retained independently of the ignored raw cache.
  extra = [features[f"way/{i}"] for i in [700218390, 193676334, 1083495102, 69121319]]
  source = {
    "schemaVersion": 1,
    "rawSha256": digest(raw),
    "features": [*parts.values(), *extra],
  }
  dump(GEO / "ber-v205-parts-source.json", source)
  return source


def airport():
  retained = json.load(gzip.open(GEO / "region-outlines-v200-source.json.gz"))
  features = {r["id"]: r for r in retained["features"]}
  source = airport_source(features)
  buildings = []
  for item in source["features"]:
    p, tags = transform(world, shape(item["geometry"])), item["tags"]
    top = float(tags.get("height", float(tags.get("building:levels", 5)) * 3)) + 3
    bottom = float(tags.get("min_height", 0)) + 3
    column = tags.get("building:part") == "column"
    tower = item["id"] == "way/69121319"
    roof = tags.get("building:part") == "roof"
    glass = tags.get("building:material") == "glass"
    color = 0xAAA99C if column else 0xB9BDB6
    y = (bottom + top) / 2 if column or roof else top - 0.15
    thickness = top - bottom if column or roof else 0.3
    buildings.append(
      {
        "id": item["id"],
        "name": tags.get("name", tags.get("building:part", "BER")),
        "rings": rings(p),
        "bottom": bottom,
        "top": top,
        "roofBottom": y - thickness / 2,
        "glass": glass,
        "tower": tower,
        "column": column,
        "color": color,
        "native": native_runs(p, y, thickness, color, 0.35 if column else 2.5),
      }
    )
  runways = []
  for ident in ["way/4645618", "way/95201688"]:
    row = features[ident]
    p = transform(world, shape(row["geometry"]))
    coordinates = list(p.coords)
    threshold_offsets = [0, 0]
    source_ids = [ident]
    if ident == "way/4645618":
      # The 3,600 m northern pavement includes two separately mapped
      # displaced-threshold sections, not three independent runways.
      east = transform(world, shape(features["way/509961149"]["geometry"]))
      west = transform(world, shape(features["way/509961148"]["geometry"]))
      assert (
        list(east.coords)[-1] == coordinates[0]
        and list(west.coords)[-1] == coordinates[-1]
      )
      coordinates = (
        list(east.coords) + coordinates[1:] + list(reversed(west.coords))[1:]
      )
      threshold_offsets = [east.length, west.length]
      source_ids += ["way/509961149", "way/509961148"]
    assert (
      coordinates[0][0] > coordinates[-1][0]
    )  # east-to-west; 24 is at the eastern end
    runways.append(
      {
        "id": ident,
        "ref": row["tags"]["ref"],
        "width": float(row["tags"]["width"]),
        "sourceIds": source_ids,
        "endLabels": list(reversed(row["tags"]["ref"].split("/"))),
        "thresholdOffsets": threshold_offsets,
        "points": [[round(x, 3), round(z, 3)] for x, z in coordinates],
      }
    )
  result = {
    "schemaVersion": 1,
    "sourceSha256": digest(GEO / "ber-v205-parts-source.json"),
    "buildings": buildings,
    "runways": runways,
    "activeTerminals": ["way/1132137322", "way/700218390"],
  }
  dump(DATA / "berAirportV205.json", result)
  return {
    "partCount": len(buildings),
    "runways": runways,
    "bounds": list(
      shape(
        {"type": "MultiPolygon", "coordinates": [[b["rings"][0]] for b in buildings]}
      ).bounds
    ),
  }


def railway():
  src = json.loads((DATA / "railStationsV190.json").read_text())
  stations = []
  for station in src["stations"]:
    if station.get("ringOrder") is None:
      continue
    platforms = [
      p
      for p in src["platforms"]
      if p["station"] == station["name"] and p["sourceTags"].get("light_rail") == "yes"
    ]
    assert platforms, station["name"]
    markers = []
    for p in platforms:
      poly = Polygon(p["rings"][0], p["rings"][1:])
      f = p["frame"]
      for ratio in [-0.32, 0.32]:
        x, z = (
          f["x"] + f["dx"] * f["length"] * ratio,
          f["z"] + f["dz"] * f["length"] * ratio,
        )
        if poly.covers(Point(x, z).buffer(1.2)):
          markers.append(
            {
              "platform": p["id"],
              "x": round(x, 3),
              "z": round(z, 3),
              "y": p["y"],
              "dx": f["dx"],
              "dz": f["dz"],
            }
          )
    if not markers:
      p = platforms[0]
      q = Polygon(p["rings"][0], p["rings"][1:]).representative_point()
      markers.append(
        {
          "platform": p["id"],
          "x": q.x,
          "z": q.y,
          "y": p["y"],
          "dx": p["frame"]["dx"],
          "dz": p["frame"]["dz"],
        }
      )
    roofs = []
    for r in src["roofs"]:
      if r["id"] not in CANOPIES or r["station"] != station["name"]:
        continue
      assert r["retainedOwnerId"] is None and r["sourceTags"]["building"] == "roof"
      poly = Polygon(r["rings"][0], r["rings"][1:])
      roofs.append(
        {
          "id": r["id"],
          "rings": r["rings"],
          "y": r["y"],
          "native": native_runs(poly, r["y"] - 0.02, 0.16, 0x909C96, 0.7),
        }
      )
    stations.append({"name": station["name"], "markers": markers, "canopies": roofs})
  assert len(stations) == 27
  dump(DATA / "ringStationDetailsV205.json", {"schemaVersion": 1, "stations": stations})
  return {
    "stations": [s["name"] for s in stations],
    "newCanopyIds": sorted(CANOPIES),
    "wedding": "No new roof: January 2026 fire/reconstruction notice does not establish the final as-built roof in October.",
  }


def motorways():
  src = json.loads((GEO / "outer-thin-outlines-v179.json").read_text())
  runtime = json.loads((DATA / "outerThinOutlines.json").read_text())
  current = {tuple(f["osmIds"]): f for f in runtime["features"]}
  tag_archive = GEO / "motorway-v205-lanes-source.json"
  if tag_archive.exists():
    archived = json.loads(tag_archive.read_bytes())
    tags, tag_sha256 = archived["ways"], archived["rawSha256"]
  else:
    tag_source = GEO / "raw/v179/lines.json"
    tags, tag_sha256 = {}, digest(tag_source)
    cache = json.loads(tag_source.read_text())
    for f in cache["features"]:
      p = f["properties"]
      tags[f"way/{p.get('osm_id')}"] = dict(
        re.findall(r'"([^"]+)"=>"([^"]*)"', p.get("other_tags") or "")
      )
  groups, evidence = {}, []
  for line in src["lines"]:
    if line["kind"] != "motorway" or not any(
      n in line["name"] for n in ["A100", "A115"]
    ):
      continue
    p = transform(world, LineString(line["coordinates"]))
    if p.centroid.x >= -1000 or line.get("status") != "mapped":
      continue
    old = current[tuple(line["osmIds"])]
    start = old["firstVertex"] * 3
    ys = runtime["positions"][start + 1 : start + old["vertexCount"] * 3 : 3]
    assert ys and set(ys) == {3.55}
    row_tags = tags.get(line["osmIds"][0], {})
    try:
      lanes = max(1, min(5, int(row_tags.get("lanes", 2))))
    except ValueError:
      lanes = 2
    width = lanes * 3.5 + 2.5
    tunnel = line.get("tunnel") == "yes" or row_tags.get("tunnel") == "yes"
    kind = "tunnel" if tunnel else "surface"
    tile = f"{math.floor(p.centroid.x / 2048)}_{math.floor(p.centroid.y / 2048)}_{kind}"
    positions = groups.setdefault(tile, {"key": tile, "kind": kind, "positions": []})[
      "positions"
    ]
    for side in [-1, 1]:
      edge = p.offset_curve(side * width / 2, join_style=2, mitre_limit=2)
      for segment in getattr(edge, "geoms", [edge]):
        for a, b in zip(segment.coords, list(segment.coords)[1:], strict=False):
          positions.extend(
            [round(a[0], 3), 3.56, round(a[1], 3), round(b[0], 3), 3.56, round(b[1], 3)]
          )
    evidence.append(
      {
        "ids": line["osmIds"],
        "name": line["name"],
        "tags": row_tags,
        "widthEstimate": width,
        "tunnel": tunnel,
        "originalGrade": 3.55,
        "bridge": line.get("bridge"),
        "layer": line.get("layer"),
      }
    )
  assert evidence
  dump(
    tag_archive,
    {
      "schemaVersion": 1,
      "rawSha256": tag_sha256,
      "ways": {r["ids"][0]: r["tags"] for r in evidence},
    },
  )
  dump(
    DATA / "westernMotorwaysV205.json",
    {"schemaVersion": 1, "groups": list(groups.values())},
  )
  return {
    "ways": evidence,
    "bounds": [
      min(
        g["positions"][i]
        for g in groups.values()
        for i in range(axis, len(g["positions"]), 3)
      )
      for axis in [0, 2]
    ]
    + [
      max(
        g["positions"][i]
        for g in groups.values()
        for i in range(axis, len(g["positions"]), 3)
      )
      for axis in [0, 2]
    ],
  }


def main():
  old = [
    DATA / "railStationsV190.json",
    DATA / "ostkreuzV190.json",
    DATA / "regionOutlinesV200.json",
    DATA / "regionOutlinesV200Native.json",
    DATA / "regionOutlinesV200Navigation.json",
    DATA / "outerThinOutlines.json",
  ]
  before = {str(p.relative_to(ROOT)): digest(p) for p in old}
  result = {
    "schemaVersion": 1,
    "unchangedSources": before,
    "airport": airport(),
    "rail": railway(),
    "motorways": motorways(),
  }
  assert before == {str(p.relative_to(ROOT)): digest(p) for p in old}
  dump(GEO / "transport-refinements-v205-evidence.json", result)


if __name__ == "__main__":
  main()
