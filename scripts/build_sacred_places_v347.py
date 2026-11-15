"""Current cemetery routes and mapped graves on retained source-owned city ground.

This is an attributed site inventory, not a claim to photographically survey
every religious building. Unknown grave inscriptions and shapes stay absent.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pyogrio
import shapely
from shapely import STRtree
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import road_width_m, road_width_source
from scripts.build_park_paths_v329 import (
  MATERIALS,
  earlier_support,
  nav_polygon,
  raw_floors,
  square_raster,
)
from scripts.build_public_inventory_v326 import world_geometry
from scripts.build_rixdorf_v304 import fingerprint
from scripts.build_surrounding_outlines import PackedMesh, polygonal, tags_for, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/sacred-places-v347"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
SOURCE = GEO / "sacred-places-v347-source.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
APP = ROOT / "src/app/src/data"
KIND = "sacred-places-v347"


def read(path):
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def write(path, value):
  data = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == ".gz" else data)


def sha(path):
  h = hashlib.sha256()
  with path.open("rb") as f:
    while chunk := f.read(4 * 1024 * 1024):
      h.update(chunk)
  return h.hexdigest()


def record(row, layer):
  return dict(
    id=(
      "way/" + row.osm_way_id
      if isinstance(row.get("osm_way_id"), str)
      else (
        "relation/"
        if layer == "multipolygons"
        else "node/"
        if layer == "points"
        else "way/"
      )
      + row.osm_id
    ),
    tags=tags_for(row),
    geometry=mapping(world(shapely.make_valid(row.geometry))),
  )


def extract():
  original = read(SOURCE)
  boundary = read(GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson")
  state = unary_union(
    [world_geometry(f["geometry"], True) for f in boundary["features"]]
  )
  sites = [
    r
    for r in original["records"]
    if state.covers(shape(r["geometry"]).representative_point())
  ]
  cemeteries = [
    r
    for r in sites
    if r["tags"].get("landuse") == "cemetery"
    or r["tags"].get("amenity") == "grave_yard"
  ]
  cemeteries = [
    r
    for r in cemeteries
    if "tierfriedhof" not in r["tags"].get("name", "").lower()
    and shape(r["geometry"]).area >= 1000
  ]
  polygons = [shapely.make_valid(shape(r["geometry"])) for r in cemeteries]
  tree = STRtree(polygons)
  details = []
  for layer, where in [
    (
      "lines",
      "highway IN ('footway','path','steps','pedestrian','service') OR barrier IN ('wall','fence')",
    ),
    (
      "points",
      "other_tags LIKE '%tomb%' OR other_tags LIKE '%grave%' OR barrier IN ('gate','entrance')",
    ),
    ("multipolygons", "historic='tomb' OR other_tags LIKE '%cemetery%grave%'"),
  ]:
    f = pyogrio.read_dataframe(PBF, layer=layer, where=where).to_crs(25833)
    for _, row in f.iterrows():
      if row.geometry is None or row.geometry.is_empty:
        continue
      r = record(row, layer)
      g = shape(r["geometry"])
      matches = tree.query(g, predicate="intersects")
      if len(matches):
        r["cemeteries"] = [cemeteries[int(i)]["id"] for i in matches]
        details.append(r)
  worship_points = pyogrio.read_dataframe(
    PBF, layer="points", where="other_tags LIKE '%place_of_worship%'"
  ).to_crs(25833)
  for _, row in worship_points.iterrows():
    r = record(row, "points")
    if state.covers(shape(r["geometry"])):
      sites.append(r)
  result = dict(
    schemaVersion=1,
    source=str(PBF.relative_to(ROOT)),
    sha256=sha(PBF),
    sourceUrl="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
    license="ODbL-1.0",
    date="2026-11-13",
    sites=sites,
    cemeteries=cemeteries,
    details=details,
    policy="Complete Berlin-state mapped inventory; site points are not buildings. Fine grave dimensions/materials require separate evidence. No invented names or religious symbols. Exact source paths are clipped to literal retained ground before use.",
  )
  write(GEO / "sacred-places-v347-inventory.json.gz", result)
  print(
    dict(
      sites=len(sites),
      cemeteries=len(cemeteries),
      details=len(details),
      religions=dict(Counter(r["tags"].get("religion", "unspecified") for r in sites)),
    ),
    flush=True,
  )


def pack_routes(plans, receipts, manifest):
  """Only the already-full host uses the ordinary bounded companion mechanism."""
  full = {
    k.split(":", 1)[1] for k in plans if len(receipts[k]["preparedRecords"]) >= 16
  }
  chunks = []
  for host in sorted(full):
    primary = next(c for c in manifest["chunks"] if c["id"] == host)
    identity = "sacred347-" + host
    descriptor = dict(id=identity, bounds=primary["bounds"], detailCompanionOf=host)
    for mode in ("drawn", "minecraft"):
      plan = plans.pop(mode + ":" + host)
      packet = dict(
        schemaVersion=1,
        id=identity,
        origin=plan["origin"],
        meshes=[plan["append"]],
        nav=dict(
          groundY=manifest["groundY"],
          ground=[],
          water=[],
          roads=[],
          buildings=[],
          bridges=[],
        ),
      )
      target = RAW / "packets" / f"{identity}.{mode}.json.gz"
      write(target, packet)
      descriptor[mode] = dict(
        url=target.name,
        encoding="gzip",
        bytes=target.stat().st_size,
        decodedBytes=len(gzip.decompress(target.read_bytes())),
        sha256=sha(target),
      )
    chunks.append(descriptor)
  write(
    GEO / "sacred-places-v347-manifest.json",
    dict(
      schemaVersion=1,
      chunks=chunks,
      footprint=[],
      source="Exact mapped cemetery routes on retained source ground",
    ),
  )
  hosts = sorted({key.split(":", 1)[1] for key in plans})
  modules = []
  for start in range(0, len(hosts), 12):
    keys = [k for k in sorted(plans) if k.split(":", 1)[1] in hosts[start : start + 12]]
    file = f"sacredPlacesV347Packets{len(modules):02d}.json"
    write(
      APP / file, dict(schemaVersion=1, keys=keys, packets={k: plans[k] for k in keys})
    )
    modules.append(dict(file=file, keys=keys))
  write(APP / "sacredPlacesV347Index.json", dict(sources=modules))
  return modules, chunks


def compile_paths():
  source = read(GEO / "sacred-places-v347-inventory.json.gz")
  manifest = read(PUBLIC / "manifest.json")
  cemeteries = source["cemeteries"]
  shapes = [shapely.make_valid(shape(r["geometry"])) for r in cemeteries]
  tree = STRtree(shapes)
  paths = [
    r
    for r in source["details"]
    if r["tags"].get("highway") in {"path", "footway", "pedestrian", "service"}
  ]
  route_shapes = [shape(r["geometry"]) for r in paths]
  route_tree = STRtree(route_shapes)
  descriptors = [
    c
    for c in manifest["chunks"]
    if not c.get("detailCompanionOf")
    and not c["id"].startswith(("publicInstitutions", "monuments", "regional", "a10"))
    and len(tree.query(box(*c["bounds"]), predicate="intersects"))
  ]
  jobs = [
    dict(id=c["id"], mode=m, path=str(PUBLIC / c[m]["url"]))
    for c in descriptors
    for m in ("drawn", "minecraft")
  ]
  captured = RAW / "predecessors.jsonl"
  RAW.mkdir(parents=True, exist_ok=True)
  with captured.open("w") as out:
    subprocess.run(
      ["bun", "--bun", "src/app/scripts/capture-sacred-places-v347.ts"],
      cwd=ROOT,
      input=json.dumps(jobs),
      text=True,
      stdout=out,
      check=True,
    )
  receipts = {
    r["key"]: r for line in captured.read_text().splitlines() if (r := json.loads(line))
  }
  plans, reports, inputs, skipped = {}, [], {}, Counter()
  for desc in descriptors:
    bounds = box(*desc["bounds"])
    selected = tree.query(bounds, predicate="intersects")
    domain = unary_union([shapes[int(i)] for i in selected]).intersection(bounds)
    for mode in ("drawn", "minecraft"):
      key = mode + ":" + desc["id"]
      raw = read(PUBLIC / desc[mode]["url"])
      receipt = receipts[key]
      ox, _, oz = raw["origin"]
      covered = polygonal(
        unary_union([nav_polygon(r, ox, oz) for r in raw["nav"]["ground"]])
      ).intersection(domain)
      if covered.is_empty:
        skipped["noOriginalGround"] += 1
        continue
      prior = earlier_support(receipt["priorAdditions"], raw["origin"], covered)
      obstacles = unary_union(
        [
          nav_polygon(r, ox, oz)
          for category in ("buildings", "water", "bridges")
          for r in raw["nav"].get(category, [])
        ]
      )
      excluded = unary_union([prior, obstacles]).buffer(0.04)
      floors = raw_floors(raw, covered)
      mesh, used, patches = PackedMesh(ox, oz), set(), []
      candidates = route_tree.query(covered.buffer(5), predicate="intersects")
      for purpose, substrate in floors.items():
        for y, floor in substrate.items():
          support = floor.difference(excluded).buffer(-0.015)
          if support.is_empty:
            continue
          painted = Polygon()
          for i in candidates:
            r = paths[int(i)]
            tags = r["tags"]
            axis = route_shapes[int(i)]
            width = road_width_m(tags)
            if width is None or not 0.3 <= width <= 8:
              skipped["unsupportedWidth"] += 1
              continue
            area = (
              axis.buffer(width / 2, cap_style="flat", quad_segs=2)
              .intersection(support)
              .difference(painted)
            )
            if mode == "minecraft":
              area = square_raster(area)
            if area.area < 0.25:
              continue
            color = MATERIALS.get(tags.get("surface"), (166, 153, 128))
            mesh.surface(area, round(y + 0.02, 2), color)
            used.add(r["id"])
            painted = painted.union(area)
            patches.append(
              dict(
                id=r["id"],
                cemeteries=r["cemeteries"],
                areaM2=round(area.area, 3),
                height=y,
                kind=purpose,
                width=width,
                widthSource=road_width_source(tags),
                surface=tags.get("surface", "unknown: muted gravel display estimate"),
              )
            )
      append = mesh.payload(KIND)
      if append is None:
        continue
      if len(mesh.vertices) > 45000 or len(mesh.indices) > 240000 or len(used) > 512:
        raise ValueError(f"Finite source packet allowance exceeded: {key}")
      plans[key] = dict(
        origin=raw["origin"],
        records=[
          dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
          for i, m in enumerate(raw["meshes"])
        ],
        navGuard=receipt["navGuard"],
        lineGuard=receipt["lineGuard"],
        preparedNavGuard=receipt["preparedNavGuard"],
        preparedLineGuard=receipt["preparedLineGuard"],
        append=append,
        appendFingerprint=fingerprint(append),
        retire=[],
        owners=sorted(used),
      )
      inputs[key] = desc[mode]
      reports.append(
        dict(
          key=key,
          patches=patches,
          vertices=len(mesh.vertices),
          triangles=len(mesh.indices) // 3,
        )
      )
      print(key, len(used), "paths", flush=True)
  hosts = sorted({key.split(":", 1)[1] for key in plans})
  modules, companions = pack_routes(plans, receipts, manifest)
  represented = {
    site for r in reports for p in r["patches"] for site in p["cemeteries"]
  }
  covered = unary_union(
    [
      shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
      for p in manifest["footprint"]
    ]
  )
  inventory = [
    dict(
      id=s["id"],
      name=s["tags"].get("name", ""),
      religion=s["tags"].get("religion", "unspecified"),
      role="mapped point, not exterior"
      if shape(s["geometry"]).geom_type == "Point"
      else "mapped footprint/site, not proof of an individually verified exterior",
      covered=covered.covers(shape(s["geometry"]).representative_point()),
      newRoutes=s["id"] in represented,
    )
    for s in source["sites"]
  ]
  write(
    GEO / "sacred-places-v347-evidence.json.gz",
    dict(
      schemaVersion=1,
      sourceSha256=sha(GEO / "sacred-places-v347-inventory.json.gz"),
      sourceInputs=inputs,
      modules=modules,
      companions=companions,
      priorDeclines={k: r["declined"] for k, r in receipts.items() if r["declined"]},
      reports=reports,
      inventory=inventory,
      skipped=dict(skipped),
      counts=dict(
        hosts=len(hosts),
        modePackets=len(reports),
        cemeteriesWithNewRoutes=len(represented),
        uniquePaths=len({p["id"] for r in reports for p in r["patches"]}),
      ),
      policy="Exact mapped routes on literal source-supported floor only. Complete older terrain/buildings/tree/models/navigation retained. No guessed slopes, grave register, foreign religious symbols or image assets. Native .5m cardinal cells stay inside original support; same finite detail on touch and pointer.",
    ),
  )
  print("Completed", len(hosts), "hosts,", len(represented), "cemeteries", flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--compile", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  if args.compile:
    compile_paths()
