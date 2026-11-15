"""Mapped school/Kita access surfaces on literal retained source ground only."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pyogrio
import shapely
from shapely import STRtree
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import road_width_m, road_width_source
from scripts.build_park_paths_v329 import (
  MATERIALS,
  earlier_support,
  nav_polygon,
  raw_floors,
  square_raster,
)
from scripts.build_rixdorf_v304 import fingerprint
from scripts.build_surrounding_outlines import (
  COLORS,
  PackedMesh,
  polygonal,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
INVENTORY = GEO / "education-v350-inventory.json.gz"
SOURCE = GEO / "education-v350-paths-source.json.gz"
EVIDENCE = GEO / "education-v350-paths-evidence.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/facility-paths-v350"
KIND = "facility-paths-v350"
PROTECTED_LATE_HOSTS = {"ring182-8_8", "ring182-8_10", "ring182-9_8"}
PROTECTED_APERTURE_HOSTS = {"3_-3", "4_-3"}


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  h = hashlib.sha256()
  with path.open("rb") as f:
    while chunk := f.read(4 * 1024 * 1024):
      h.update(chunk)
  return h.hexdigest()


def eligible(tags):
  if tags.get("highway") not in {"footway", "path", "cycleway", "pedestrian"}:
    return False
  if tags.get("bridge", "no") != "no" or tags.get("tunnel", "no") != "no":
    return False
  if tags.get("footway") == "crossing" or tags.get("crossing") not in {None, "no"}:
    return False
  if tags.get("indoor") == "yes" or tags.get("layer", "0") not in {"0", ""}:
    return False
  return (
    tags.get("surface") in MATERIALS
    or tags.get("area") == "yes"
    or road_width_source(tags) == "width"
  )


def extract():
  facilities = read(INVENTORY)["records"]
  zones = [
    Point(r["easting"] - 389500, 5820000 - r["northing"]).buffer(
      90 if r["category"] == "primary-school" else 45, quad_segs=8
    )
    for r in facilities
  ]
  tree = STRtree(zones)
  rows, rejects = [], Counter()
  for layer in ("lines", "multipolygons"):
    frame = pyogrio.read_dataframe(
      PBF,
      layer=layer,
      where=(
        "highway IN ('footway','path','cycleway','pedestrian')"
        if layer == "lines"
        else "other_tags LIKE '%highway%'"
      ),
    ).to_crs(25833)
    for _, row in frame.iterrows():
      tags = tags_for(row)
      if row.geometry is None or row.geometry.is_empty or not eligible(tags):
        rejects["unsupportedMaterialWidthOrGrade"] += 1
        continue
      g = world(shapely.make_valid(row.geometry))
      matches = tree.query(g, predicate="intersects")
      if not len(matches):
        continue
      if g.geom_type in {"Polygon", "MultiPolygon"}:
        tags["area"] = "yes"
      elif tags.get("area") == "yes":
        if not g.is_ring:
          rejects["unclosedMappedArea"] += 1
          continue
        g = Polygon(g.coords)
      if isinstance(row.get("osm_way_id"), str):
        identity = "way/" + row.osm_way_id
      else:
        identity = ("relation/" if layer == "multipolygons" else "way/") + row.osm_id
      rows.append(
        dict(
          id=identity,
          tags=tags,
          geometry=mapping(g),
          facilities=sorted(facilities[int(i)]["id"] for i in matches),
        )
      )
  records = {r["id"]: r for r in rows}
  source = dict(
    schemaVersion=1,
    crs="local-east-south-from-EPSG25833",
    sources=dict(
      education=dict(path=str(INVENTORY.relative_to(ROOT)), sha256=sha(INVENTORY)),
      osm=dict(
        path=str(PBF.relative_to(ROOT)),
        sha256=sha(PBF),
        date="2026-11-13",
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        license="ODbL-1.0",
        attribution="© OpenStreetMap contributors",
      ),
    ),
    facilities=[
      dict(
        id=r["id"],
        category=r["category"],
        district=r["district"],
        x=r["easting"] - 389500,
        z=5820000 - r["northing"],
        radius=90 if r["category"] == "primary-school" else 45,
      )
      for r in facilities
    ],
    paths=[records[k] for k in sorted(records)],
    rejected=dict(rejects),
  )
  write(SOURCE, source)
  print(
    json.dumps(
      dict(
        paths=len(records),
        facilities=len({f for p in records.values() for f in p["facilities"]}),
        materials=dict(
          Counter(r["tags"].get("surface", "unspecified") for r in records.values())
        ),
        bytes=SOURCE.stat().st_size,
      )
    )
  )


def compile_tile(raw, mode, domain, paths, receipt, facility_zones=None):
  ox, _, oz = raw["origin"]
  covered = polygonal(
    unary_union([nav_polygon(r, ox, oz) for r in raw["nav"]["ground"]])
  ).intersection(domain)
  if covered.is_empty:
    return None, "noOriginalGround"
  prior = earlier_support(receipt["priorAdditions"], raw["origin"], covered)
  obstacles = unary_union(
    [
      nav_polygon(r, ox, oz)
      for category in ("buildings", "water", "bridges")
      for r in raw["nav"].get(category, [])
    ]
  )
  excluded = unary_union([prior, obstacles]).buffer(0.04)
  roads = unary_union([nav_polygon(r, ox, oz) for r in raw["nav"].get("roads", [])])
  floors = raw_floors(raw, covered)
  mesh, used, patches = PackedMesh(ox, oz), set(), []
  for purpose, levels in floors.items():
    for y, floor in sorted(levels.items()):
      support = floor.difference(excluded).buffer(-0.015)
      # nav.roads also contains footways. Original path-coloured faces prove
      # the material substrate; new ground additions must avoid the entire
      # old road/path navigation union. No carriageway-coloured face qualifies.
      if purpose == "ground":
        support = support.difference(roads.buffer(0.04))
      if support.is_empty:
        continue
      painted = Polygon()
      for row in paths:
        tags = row["tags"]
        geometry = shape(row["geometry"])
        is_area = geometry.geom_type in {"Polygon", "MultiPolygon"}
        if purpose == "path" and tags.get("surface") not in MATERIALS:
          continue
        if purpose == "ground" and not is_area and road_width_source(tags) != "width":
          continue
        width = road_width_m(tags)
        if not is_area and (width is None or not 0.4 <= width <= 12):
          continue
        strip = (
          geometry
          if is_area
          else geometry.buffer(width / 2, cap_style="flat", quad_segs=2)
        )
        area = polygonal(strip.intersection(support).difference(painted))
        if mode == "minecraft":
          area = square_raster(area)
        if area.area < 0.25:
          continue
        color = MATERIALS.get(tags.get("surface"), COLORS["path"])
        mesh.surface(area, round(y + 0.02, 2), color)
        used.add(row["id"])
        painted = painted.union(area)
        patches.append(
          dict(
            id=row["id"],
            facilities=[
              f
              for f in row["facilities"]
              if facility_zones is None or facility_zones[f].intersects(area)
            ],
            point=list(area.representative_point().coords)[0],
            areaM2=round(area.area, 3),
            height=y,
            purpose="material" if purpose == "path" else "mapped-missing-path",
            width=width,
            widthSource="mapped-area" if is_area else road_width_source(tags),
            surface=tags.get("surface", "unclassified-existing-path-palette"),
          )
        )
  append = mesh.payload(KIND)
  if append is None:
    return None, "noLiteralSupportedPatch"
  if len(mesh.vertices) > 45000 or len(mesh.indices) > 240000 or len(used) > 512:
    raise ValueError("Finite per-tile allowance exceeded")
  plan = dict(
    origin=raw["origin"],
    records=[
      dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
      for i, m in enumerate(raw["meshes"])
    ],
    **{
      k: receipt[k]
      for k in ("navGuard", "lineGuard", "preparedNavGuard", "preparedLineGuard")
    },
    append=append,
    appendFingerprint=fingerprint(append),
    retire=[],
    owners=sorted(used),
  )
  return (
    plan,
    dict(
      patches=patches, vertices=len(mesh.vertices), triangles=len(mesh.indices) // 3
    ),
  ), None


class CaptureReceipts:
  """Only file offsets are resident; keep one tile's immutable capture in memory."""

  def __init__(self, paths):
    self.offsets = {}
    for path in paths:
      with path.open("rb") as stream:
        while True:
          offset = stream.tell()
          line = stream.readline()
          if not line:
            break
          match = re.match(rb'\{"key":"([^"\\]+)"', line)
          if match is None:
            raise ValueError("Capture key must be the first JSON field")
          self.offsets[match[1].decode()] = (path, offset)

  def __getitem__(self, key):
    path, offset = self.offsets[key]
    with path.open("rb") as stream:
      stream.seek(offset)
      return json.loads(stream.readline())


def compile_paths(finalize=False):
  source, manifest = read(SOURCE), read(PUBLIC / "manifest.json")
  zones = [
    Point(r["x"], r["z"]).buffer(r["radius"], quad_segs=8) for r in source["facilities"]
  ]
  zone_tree = STRtree(zones)
  facility_zones = {
    r["id"]: zone for r, zone in zip(source["facilities"], zones, strict=True)
  }
  path_shapes = [shape(r["geometry"]) for r in source["paths"]]
  path_tree = STRtree(path_shapes)
  descriptors = [
    c
    for c in manifest["chunks"]
    if not c.get("detailCompanionOf")
    and not c["id"].startswith(("publicInstitutions", "monuments", "regional", "a10"))
    and len(path_tree.query(box(*c["bounds"]), predicate="intersects"))
  ]
  descriptors = [
    c
    for c in descriptors
    if (r := read(PUBLIC / c["drawn"]["url"]))["nav"]["ground"]
    and any(p["kind"] == "city" for p in r["meshes"])
  ]
  jobs = [
    dict(id=c["id"], mode=m, path=str(PUBLIC / c[m]["url"]))
    for c in descriptors
    for m in ("drawn", "minecraft")
  ]
  RAW.mkdir(parents=True, exist_ok=True)
  captured = RAW / "predecessors.jsonl"
  if finalize:
    baseline = captured
    civic_keys = {
      k
      for m in read(DATA / "civicFacilitiesV350Index.json")["sources"]
      for k in m["keys"]
    }
    for file in ("namedElevatedStationsV334.json", "katzengrabenV334.json"):
      civic_keys.update(read(DATA / file)["keys"])
    jobs = [job for job in jobs if job["mode"] + ":" + job["id"] in civic_keys]
    captured = RAW / "civic-predecessors.jsonl"
  with captured.open("w") as out:
    subprocess.run(
      ["bun", "--bun", "src/app/scripts/capture-facility-paths-v350.ts"],
      cwd=ROOT,
      input=json.dumps(jobs),
      text=True,
      stdout=out,
      check=True,
    )
  receipts = CaptureReceipts([baseline, captured] if finalize else [captured])
  plans, reports, inputs, skipped = {}, {}, {}, Counter()
  baseline_skipped = None
  if finalize:
    previous = read(EVIDENCE)
    assert previous["sourceSha256"] == sha(SOURCE), (
      "Source changed since baseline; compile fully"
    )
    for module in read(DATA / "facilityPathsV350Index.json")["sources"]:
      plans.update(read(DATA / module["file"])["packets"])
    reports, inputs = previous["reports"], previous["sourceInputs"]
    baseline_skipped = previous["skipped"]
    hosts = (
      {key.split(":", 1)[1] for key in civic_keys}
      | PROTECTED_LATE_HOSTS
      | PROTECTED_APERTURE_HOSTS
    )
    descriptors = [c for c in descriptors if c["id"] in hosts]
    for c in descriptors:
      for mode in ("drawn", "minecraft"):
        key = mode + ":" + c["id"]
        plans.pop(key, None)
        reports.pop(key, None)
        inputs.pop(key, None)
  for c in descriptors:
    tile = box(*c["bounds"])
    selected = zone_tree.query(tile, predicate="intersects")
    domain = unary_union([zones[int(i)] for i in selected]).intersection(tile)
    candidates = [
      source["paths"][int(i)] for i in path_tree.query(domain, predicate="intersects")
    ]
    for mode in ("drawn", "minecraft"):
      key = mode + ":" + c["id"]
      receipt = receipts[key]
      if c["id"] in PROTECTED_APERTURE_HOSTS:
        skipped["protectedAggregateAperture"] += 1
        continue
      if c["id"] in PROTECTED_LATE_HOSTS:
        skipped["protectedLatePreparedOwner"] += 1
        continue
      if len(receipt["preparedRecords"]) + receipt.get("reservedLaterMeshes", 0) >= 16:
        skipped["existingFullMeshBudget"] += 1
        continue
      path = PUBLIC / c[mode]["url"]
      result, reason = compile_tile(
        read(path), mode, domain, candidates, receipt, facility_zones
      )
      if reason:
        skipped[reason] += 1
        continue
      plans[key], reports[key] = result
      inputs[key] = dict(path=str(path.relative_to(ROOT)), sha256=sha(path))
    if len(reports) % 40 == 0:
      print(json.dumps(dict(processed=c["id"], recipes=len(reports))), flush=True)
  modules = []
  hosts = sorted({k.split(":", 1)[1] for k in plans})
  for start in range(0, len(hosts), 16):
    keys = [k for k in sorted(plans) if k.split(":", 1)[1] in hosts[start : start + 16]]
    filename = f"facilityPathsV350Packets{len(modules):03d}.json"
    write(
      DATA / filename,
      dict(schemaVersion=1, keys=keys, packets={k: plans[k] for k in keys}),
    )
    modules.append(dict(file=filename, keys=keys))
  write(DATA / "facilityPathsV350Index.json", dict(sources=modules))
  retained = {m["file"] for m in modules}
  for old in DATA.glob("facilityPathsV350Packets*.json"):
    if old.name not in retained:
      old.unlink()
  counts = dict(
    hosts=len(hosts),
    recipes=len(plans),
    paths=len({p["id"] for r in reports.values() for p in r["patches"]}),
    facilities=len(
      {f for r in reports.values() for p in r["patches"] for f in p["facilities"]}
    ),
    uncompressedBytes=sum((DATA / m["file"]).stat().st_size for m in modules),
    gzipBytes=sum(
      len(gzip.compress((DATA / m["file"]).read_bytes(), mtime=0)) for m in modules
    ),
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      civicIndexSha256=sha(DATA / "civicFacilitiesV350Index.json"),
      sourceInputs=inputs,
      modules=modules,
      reports=reports,
      counts=counts,
      skipped=dict(skipped),
      baselineSkipped=baseline_skipped,
      finalizedWithCivic=finalize,
      protectedLatePreparedHosts=sorted(PROTECTED_LATE_HOSTS),
      protectedAggregateApertureHosts=sorted(PROTECTED_APERTURE_HOSTS),
      policy="No overwritten source geometry. Material only on literal original paths. Missing mapped paths require explicit width or area and literal original flat ground. Buildings, water, bridges, roads, crossings and all prior overlays excluded. Native surfaces independently rasterized inside actual support.",
    ),
  )
  print(json.dumps(counts), flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--compile", action="store_true")
  parser.add_argument(
    "--finalize-civic",
    action="store_true",
    help="Refresh only changed civic host captures, then rebuild all exact surfaces",
  )
  args = parser.parse_args()
  if args.extract:
    extract()
  if args.compile or args.finalize_civic:
    compile_paths(finalize=args.finalize_civic)
