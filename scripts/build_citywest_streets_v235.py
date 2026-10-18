"""Append positively mapped Tauentzien paint to its retained street packets."""

from __future__ import annotations

import argparse
import base64
import json
import math
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import pyogrio
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import transform, unary_union

from scripts import build_alt_mitte_transport_v206 as transport
from scripts import build_house_curbs_v233 as curbs
from scripts.build_surrounding_outlines import PackedMesh

base = curbs.base
ROOT, GEO, DATA, OUT = curbs.ROOT, curbs.GEO, curbs.DATA, curbs.OUT
SOURCE = GEO / "citywest-streets-v235-source.json"
EVIDENCE = GEO / "citywest-streets-v235-evidence.json"
OUTPUT = DATA / "citywestStreetsV235.json"
SURFACES = DATA / "westSquaresV188Detail.json"
WHITE, YELLOW = (235, 231, 211), (231, 187, 68)


def ribbon(row: list) -> Polygon:
  x, z, length, width, yaw, _ = row
  c, s = math.cos(yaw), math.sin(yaw)
  return Polygon(
    [
      (x + u * c - v * s, z + u * s + v * c)
      for u, v in [
        (-length / 2, -width / 2),
        (length / 2, -width / 2),
        (length / 2, width / 2),
        (-length / 2, width / 2),
      ]
    ]
  )


def supports() -> tuple:
  retained = base.read_json(SURFACES)
  drawn = unary_union(
    [Polygon(p[0], p[1:]) for area in retained["roads"] for p in area["polygons"]]
  )
  road_colours = {r["color"] for r in retained["roads"]}
  native = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, y, z, w, h, d, yaw, colour in retained["nativePaving"]
      if colour in road_colours
    ]
  )
  previous = []
  for name in ("boulevardTransportV210.json", "altMitteTransportV206.json"):
    for cell in base.read_json(DATA / name)["cells"]:
      previous.extend(ribbon(r) for r in cell["rows"])
  # Keep the old general lane renderer intact; leave its actual mapped axes clear.
  previous.extend(
    LineString(row["points"]).buffer(0.7)
    for row in base.read_json(DATA / "districtStreets.json")["markings_m"]
  )
  return drawn, native, unary_union(previous)


def extract() -> None:
  drawn, _, _ = supports()
  west = GEO / "west-streets-v163.json"
  tau = GEO / "tauentzien-v165.json"
  axis = [r for r in base.read_json(west)["roads"] if r["name"] == "Kurfürstendamm"]
  axis += base.read_json(tau)["roads"]
  corridor = drawn.buffer(22)
  metric = affine_transform(corridor, [1, 0, 0, -1, 389500, 5820000])
  bbox = transform(
    Transformer.from_crs(25833, 4326, always_xy=True).transform, metric
  ).bounds
  paths = [GEO / "raw/outer-v159/candidate.gpkg", transport.PBF, west, tau, SURFACES]
  features = {}
  for layer, path in (("lines", paths[0]), ("points", paths[1])):
    rows = pyogrio.read_dataframe(path, layer=layer, bbox=bbox).to_crs(25833)
    for row in rows.to_dict("records"):
      geometry, tags = curbs.world(row["geometry"]), curbs.tags(row)
      if not corridor.intersects(geometry):
        continue
      tags = {k: v for k, v in tags.items() if k in transport.TAGS}
      if (
        tags.get("highway") in transport.VEHICULAR_HIGHWAYS
        or tags.get("highway") in ("crossing", "traffic_signals")
        or any(tags.get(k) == "crossing" for k in ("footway", "cycleway", "path"))
        or "road_marking" in tags
      ):
        key = f"{'way' if layer == 'lines' else 'node'}/{row['osm_id']}"
        features[key] = dict(key=key, tags=tags, geometry=mapping(geometry))
  base.write_json(
    SOURCE,
    dict(
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      license="ODbL-1.0",
      coordinateSystem="viewer metres",
      inputs={str(p.relative_to(ROOT)): base.digest(p) for p in paths},
      completeNamedRoads=axis,
      features=sorted(features.values(), key=lambda f: f["key"]),
    ),
  )


def build() -> dict:
  drawn, native, previous = supports()
  # Existing source-derived road outlines are the strict support, not a new skin.
  scope = drawn.buffer(-0.03).difference(previous.buffer(0.04))
  with tempfile.TemporaryDirectory(prefix="citywest-v235-", dir=GEO) as temporary:
    folder = Path(temporary)
    paths = {
      name: folder / f"{name}.json"
      for name in ("paint", "ground", "corrections", "evidence")
    }
    transport.build(
      source_path=SOURCE,
      output_path=paths["paint"],
      ground_path=paths["ground"],
      corrections_path=paths["corrections"],
      evidence_path=paths["evidence"],
      boundary_path=SURFACES,
      scope=scope,
      version="v235",
      include_signals=False,
      interior_junction_clearance_m=4,
    )
    paint, audit = base.read_json(paths["paint"]), base.read_json(paths["evidence"])
  entries = {r["id"]: r for r in base.read_json(OUT / "manifest.json")["chunks"]}
  packets, receipts, coverage = {}, {}, []
  counts = Counter()
  for cell in paint["cells"]:
    ix, iz = cell["cell"]
    identity = f"{ix}_{iz}"
    entry = entries[identity]
    assert not entry.get("detailCompanionOf")
    bounds = box(*entry["bounds"])
    for family in ("drawn", "minecraft"):
      path = OUT / entry[family]["url"]
      packet = base.read_json(path)
      ox, oy, oz = packet["origin"]
      assert oy == -10
      mesh = PackedMesh(ox, oz)
      support = drawn if family == "drawn" else native
      shapes = defaultdict(list)
      if family == "drawn":
        for row in cell["rows"]:
          polygon = ribbon(row).intersection(bounds)
          if not polygon.is_empty:
            shapes[int(row[-1])].append(polygon)
      else:
        for x, z, length, yellow in cell["nativeRuns"]:
          # Test every native quarter-metre square against the actual retained
          # 2.5m asphalt tiles, not merely the smooth source road envelope.
          for xx in range(x, x + length):
            pixel = box(xx / 4, z / 4, (xx + 1) / 4, (z + 1) / 4)
            if (
              support.covers(pixel)
              and bounds.covers(pixel)
              and not previous.intersects(pixel)
            ):
              shapes[yellow].append(pixel)
      footprints = []
      for yellow, polygons in shapes.items():
        footprint = unary_union(polygons).intersection(support)
        if footprint.is_empty:
          continue
        mesh.surface(
          footprint.simplify(0, preserve_topology=True),
          5.55 if family == "drawn" else 5.61,
          YELLOW if yellow else WHITE,
        )
        footprints.append(footprint)
      payload = mesh.payload("citywest-streets-v235")
      if payload:
        key = f"{family}:{identity}"
        packets[key] = dict(
          origin=packet["origin"],
          guard=curbs.ground_guard(packet["nav"]["ground"]),
          groundY=packet["nav"]["groundY"],
          mesh=payload,
        )
        receipts[key] = dict(
          url=str(path.relative_to(ROOT)),
          sha256=base.digest(path),
          meshes=len(packet["meshes"]),
        )
        coverage.append(dict(key=key, geometry=mapping(unary_union(footprints))))
        counts[family + "Vertices"] += len(mesh.vertices)
        counts[family + "Bytes"] += sum(
          len(base64.b64decode(payload[k])) for k in ("positions", "colors", "indices")
        )
  base.write_json(
    OUTPUT,
    dict(
      schemaVersion=1,
      sourceSha256=base.digest(SOURCE),
      ids=sorted(packets),
      packets=packets,
    ),
  )
  report = dict(
    originalGeometryRetained=True,
    extraManifestEntries=0,
    sourceSha256=base.digest(SOURCE),
    outputSha256=base.digest(OUTPUT),
    packets=receipts,
    counts=dict(counts),
    paintCounts=paint["counts"],
    paintOwners=audit["paintOwners"],
    paintStrips=audit["paintStrips"],
    coverage=coverage,
    sourceSupportSha256=base.digest(SURFACES),
    estimates="Source fixes crossing type/location; unspecified widths and dash phase are display estimates. No new zebra inferred.",
  )
  base.write_json(EVIDENCE, report)
  return dict(report["counts"], paint=paint["counts"])


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    extract()
  print(json.dumps(build()))
