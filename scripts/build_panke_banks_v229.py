"""Retain lower Panke bank axes; shallow fittings do not replace source water."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import geopandas as gpd
from build_surrounding_outlines import tags_for, world
from shapely.geometry import LineString, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data/pankeBanksV229.json"
SOURCE = GEO / "panke-banks-v229-source.json"


def extract():
  path = GEO / "raw/outer-v159/candidate.gpkg"
  frames = {}
  for layer in ["lines", "multipolygons"]:
    f = gpd.read_file(path, layer=layer, bbox=(13.35, 52.53, 13.4, 52.56)).to_crs(25833)
    f.geometry = f.geometry.map(world)
    frames[layer] = f
  lines, areas = frames["lines"], frames["multipolygons"]
  stream = [
    r
    for _, r in lines.iterrows()
    if r["name"] == "Panke" and tags_for(r).get("waterway") == "stream"
  ]
  scope = box(-500, -4200, 1000, -1900)
  course = unary_union([r.geometry for r in stream]).intersection(scope)
  tunnels = unary_union(
    [
      r.geometry.buffer(4.5)
      for r in stream
      if tags_for(r).get("tunnel") in ["yes", "culvert"]
    ]
  )
  waters = []
  mouths = []
  for _, row in areas[areas.geometry.distance(course) < 4].iterrows():
    tags = tags_for(row)
    if tags.get("water") == "lake":
      mouths.append(row.geometry)
    if tags.get("water") not in ["river", "stream"]:
      continue
    waters.append(
      {
        "id": "way/" + str(row.osm_way_id),
        "tags": tags,
        "geometry": mapping(row.geometry),
      }
    )
  value = dict(
    waters=waters,
    scope=mapping(scope),
    tunnels=mapping(tunnels),
    mouths=mapping(unary_union(mouths)),
    course=[
      dict(id="way/" + str(r.osm_id), tags=tags_for(r), geometry=mapping(r.geometry))
      for r in stream
    ],
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    retainedGpkgSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
  )
  SOURCE.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def build():
  from shapely.geometry import shape

  s = json.loads(SOURCE.read_text())
  scope, tunnels = shape(s["scope"]), shape(s["tunnels"])
  # Union first: adjacent mapped water polygons must not acquire cross-channel
  # walls along their artificial joins. No buffer-derived replacement river.
  water = unary_union([shape(w["geometry"]) for w in s["waters"]])
  wet = water.intersection(scope)
  bank = (
    water.boundary.intersection(scope)
    .difference(tunnels)
    .difference(shape(s["mouths"]).buffer(0.2))
  )
  lines = list(bank.geoms) if hasattr(bank, "geoms") else [bank]
  rows = []
  for line in lines:
    if not isinstance(line, LineString):
      continue
    for a, b in zip(list(line.coords)[:-1], list(line.coords)[1:], strict=True):
      segment = LineString([a, b])
      length = segment.length
      if length < 0.15:
        continue
      mid = segment.interpolate(0.5, normalized=True)
      # Contemporary Nordhafen fish-pass and Sellerpark treatment stay concrete;
      # the user's observed brick enclosure is a restrained display reading of
      # the central urban reach, not a surveyed material inventory.
      material = (
        "brick" if -3520 < mid.y < -2285 else "concrete" if mid.y > -2285 else "earth"
      )
      dx, dz = b[0] - a[0], b[1] - a[1]
      nx, nz = -dz / length, dx / length
      from shapely.geometry import Point

      if not water.covers(Point(mid.x + nx * 0.08, mid.y + nz * 0.08)):
        nx, nz = -nx, -nz
      rows.append(
        [
          *[round(v, 4) for v in a],
          *[round(v, 4) for v in b],
          round(nx, 6),
          round(nz, 6),
          material,
        ]
      )
  core_path = GEO / "panke-core-banks-v229.json"
  core = json.loads(core_path.read_text())
  core_rows = []
  for r in core["records"]:
    segment = LineString([r["a"], r["b"]])
    mid = segment.interpolate(0.5, normalized=True)
    if (
      bank.distance(mid) > 1.5
      or not segment.intersection(tunnels).is_empty
      or not segment.intersection(shape(s["mouths"])).is_empty
    ):
      continue
    material = (
      "brick" if -3520 < mid.y < -2285 else "concrete" if mid.y > -2285 else "earth"
    )
    core_rows.append([*r["a"], *r["b"], *r["normal"], material, *r["tops"], r["index"]])
  core_edges = unary_union([LineString([r[:2], r[2:4]]) for r in core_rows])
  rows = [
    r + [3, 3, -1]
    for r in rows
    if core_edges.distance(
      LineString([r[:2], r[2:4]]).interpolate(0.5, normalized=True)
    )
    > 1.5
  ] + core_rows
  model = dict(
    schemaVersion=1,
    groundY=3,
    waterY=-1.15,
    bounds=list(wet.bounds),
    banks=rows,
    materialStatus="Masonry and graffiti are source-aligned display estimates from user observation; not surveyed individual bricks or reproduced artwork.",
  )
  DEST.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n")
  evidence = dict(
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    coreBankReceiptSha256=hashlib.sha256(core_path.read_bytes()).hexdigest(),
    bankSegments=len(rows),
    visibleBankLengthM=round(sum(LineString([r[:2], r[2:4]]).length for r in rows), 3),
    policy="Exact retained open-water boundaries; no filled tunnel, new water surface, widened course, rewritten upstream park or source removal. Existing datum preserved. No fabricated graffiti text.",
    primarySources=[
      "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/wasserbau/ausbau-von-gewaessern/panke/",
      "https://www.berlin.de/sen/uvk/umwelt/wasser-und-geologie/europaeische-wasserrahmenrichtlinie/berlin/panke/",
    ],
    sourceDate="2026-10-18",
    waterIds=[w["id"] for w in s["waters"]],
    profile=model["materialStatus"],
  )
  (GEO / "panke-banks-v229-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(evidence["bankSegments"], evidence["visibleBankLengthM"])


if __name__ == "__main__":
  if "--extract" in sys.argv:
    extract()
  build()
