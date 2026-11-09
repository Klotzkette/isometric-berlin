"""Compile only measured Berlin park vegetation on existing actual packet ground."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import shapely
from build_network_fidelity_v326 import exclusions
from build_rixdorf_v304 import fingerprint, read, sha, write
from build_surrounding_outlines import (
  COLORS,
  PackedMesh,
  linear_rgb_bytes,
  polygons_from_geometry,
  source_identity,
  tags_for,
  world,
)
from pyogrio import read_dataframe
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
DATA = APP / "src/data"
PUBLIC = APP / "public/mesh/surrounding-berlin-v159"
KIND = "public-green-v329"
# The ALKIS land-cover code, rather than a site's name, determines the material.
PAINT = {
  1021: (111, 140, 99),  # broadleaf stand
  1022: (99, 129, 96),  # conifer stand
  1250: (118, 145, 102),  # woody shrubs
  1000: (112, 139, 103),  # mapped wood without leaf-type evidence
  1600: (143, 159, 109),  # ornamental planted area
  1500: (135, 166, 111),  # grass
}
NATIVE_M = 1
MAX_GEOMETRY_BYTES = 112 * 1024
MAX_RAW_SHARD_BYTES = 280 * 1024
MAX_ARCHIVE_GZIP_BYTES = 4 * 1024 * 1024
SOURCE_ROWS = {"gruenanlagen": 2563, "spielplaetze": 1886, "alkis-vegetation": 9972}
SOURCE_SHA = {
  "gruenanlagen": "cee7d8d2fedc7cade011d564178a48389fa50a4ed446d0a9a9a954b080be9862",
  "spielplaetze": "e212b2256900a5ef5889ee60241ef4464f4d7754d5924e2767379b0128ea49db",
  "alkis-vegetation": "d3b597ff7d3010996126cdf944f8f83d72faa51288822ea545481fc5db1cbd22",
}
SOURCE_URLS = {
  "gruenanlagen": "https://gdi.berlin.de/services/wfs/gruenanlagen",
  "spielplaetze": "https://gdi.berlin.de/services/wfs/gruenanlagen",
  "alkis-vegetation": "https://gdi.berlin.de/services/wfs/alkis",
}


def union(polygons):
  return unary_union(list(polygons)) if len(polygons) else Polygon()


def local_rings(records):
  return [Polygon(row["ring"], row.get("holes", [])) for row in records]


def protected_ground(path_evidence):
  """Keep actual prior elevated/curated grounds and newly authored paths."""
  protected_rail, older, inputs = exclusions()
  polygons = [protected_rail, older]

  def kept(name):
    path = DATA / (name + ".json")
    inputs.append({"path": str(path.relative_to(ROOT)), "sha256": sha(path)})
    return read(path)

  for name in ("parkReliefV182", "parkReliefV183"):
    polygons.extend(box(*p["support"]) for p in kept(name)["profiles"])
  for p in kept("northParkTerrainV306")["profiles"]:
    polygons.append(shape(p["domain"]))
  polygons.extend(local_rings(kept("northParksV198Terrain")["scope"]))
  polygons.extend(local_rings(kept("northEastPublicSitesV326Index")["footprint"]))
  old_east = kept("eastParksV198")
  polygons.extend(Polygon(r[0], r[1:]) for r in old_east["park"])
  polygons.append(Polygon(old_east["memorial"][0], old_east["memorial"][1:]))
  # These placements are not generally encoded in the old outline terrain.
  # Source-owned interior parks and their support are deliberately outside this
  # broad paint pass.
  protected_keys = {"3_-3", "4_-3"}
  for name in ("tierparkV255", "tierparkV276", "mauerparkTerrainV298"):
    asset = kept(name)
    for key in asset.get("ids", []):
      protected_keys.add(key.split(":")[-1])
    for key in asset.get("packets", {}):
      protected_keys.add(key.split(":")[-1])
  if path_evidence:
    inputs.append({"path": str(path_evidence), "sha256": sha(path_evidence)})
    new = read(path_evidence)
    polygons.extend(shape(f["geometry"]) for f in new["features"])
  return unary_union([shapely.make_valid(p) for p in polygons]), protected_keys, inputs


def osm_material(tags):
  natural = tags.get("natural")
  landuse = tags.get("landuse")
  cover = tags.get("landcover")
  if natural == "wood" or landuse == "forest" or cover == "trees":
    return {"broadleaved": 1021, "needleleaved": 1022}.get(tags.get("leaf_type"), 1000)
  if natural == "scrub":
    return 1250
  if landuse == "flowerbed" or tags.get("leisure") == "flowerbed":
    return 1600
  if natural == "grassland" or landuse in {"grass", "meadow"} or cover == "grass":
    return 1500
  return None


def osm_support():
  """Explicit land-cover polygons and nonvegetated sports/plaza exclusions."""
  path = ROOT / "geo_data/regierungsviertel/raw/outer-v159/berlin-260929.osm.pbf"
  frame = read_dataframe(
    path,
    layer="multipolygons",
    where=(
      "natural IN ('wood','scrub','grassland') OR landuse IN ('forest','grass','meadow','flowerbed','construction')"
      " OR leisure IN ('flowerbed','pitch','playground','track','sports_centre','swimming_pool')"
      " OR amenity IN ('parking','marketplace') OR other_tags LIKE '%landcover%' OR other_tags LIKE '%pedestrian%'"
    ),
  ).to_crs(25833)
  covered, blocked = [], []
  for _, row in frame.iterrows():
    tags = tags_for(row)
    if row.geometry is None or row.geometry.is_empty:
      continue
    geometry = world(shapely.make_valid(row.geometry))
    if (
      tags.get("leisure") in {"pitch", "playground", "track", "swimming_pool"}
      or tags.get("amenity") in {"parking", "marketplace"}
      or tags.get("highway") == "pedestrian"
      or tags.get("landuse") == "construction"
    ):
      blocked.extend(polygons_from_geometry(geometry))
      continue
    code = osm_material(tags)
    if code is not None:
      covered.append((source_identity(row), code, geometry))
  assert len({p[0] for p in covered}) == len(covered)
  return (
    covered,
    blocked,
    {
      "file": path.name,
      "sha256": sha(path),
      "source": "https://download.geofabrik.de/europe/germany/berlin.html",
      "license": "ODbL",
      "measuredLandCoverPolygons": len(covered),
      "mappedHardSurfacePolygons": len(blocked),
    },
  )


def public_sources(folder, preserved):
  frames, receipt = {}, []
  for name, expected in SOURCE_ROWS.items():
    path = folder / f"{name}.gpkg"
    if sha(path) != SOURCE_SHA[name]:
      raise ValueError(f"Changed exact official source {path}")
    frame = read_dataframe(path)
    if (
      len(frame) != expected
      or frame.crs.to_epsg() != 25833
      or not frame.geometry.is_valid.all()
    ):
      raise ValueError(f"Incomplete or unsupported official source {path}")
    frame.geometry = frame.geometry.map(world)
    frames[name] = frame
    receipt.append(
      {
        "file": path.name,
        "sha256": sha(path),
        "rows": expected,
        "source": SOURCE_URLS[name],
        "license": "DL-DE-Zero 2.0",
      }
    )
  parks, play, vegetation = (frames[name] for name in SOURCE_ROWS)
  assert parks["pitid"].is_unique and vegetation["uuid"].is_unique
  eligible = parks.loc[parks["widmung"] == "gewidmet"]
  park_geometries = eligible.geometry.to_list()
  park_ids = eligible["pitid"].to_list()
  park_tree = STRtree(park_geometries)

  osm_vegetation, osm_hard_surface, osm_receipt = osm_support()
  receipt.append(osm_receipt)
  exclusions_tree = STRtree(
    [*play.geometry.to_list(), *polygons_from_geometry(preserved), *osm_hard_surface]
  )
  plants, linked = [], defaultdict(set)
  official = [
    (row.uuid, int(row.bws), row.geometry)
    for row in vegetation.itertuples()
    if row.bws in PAINT and row.bezeich == "AX_Vegetationsmerkmal"
  ]
  authoritative_tree = STRtree([g for _, _, g in official])
  for source, current in (("ALKIS", official), ("OSM", osm_vegetation)):
    for owner, code, geometry in current:
      inside = []
      for i in park_tree.query(geometry, predicate="intersects"):
        overlap = geometry.intersection(park_geometries[i])
        if overlap.area > 0.02:
          inside.append((i, overlap))
      if not inside:
        continue
      coverage = union([g for _, g in inside])
      indices = exclusions_tree.query(coverage, predicate="intersects")
      if len(indices):
        coverage = coverage.difference(union(list(exclusions_tree.geometries[indices])))
      if source == "OSM":
        indices = authoritative_tree.query(coverage, predicate="intersects")
        if len(indices):
          coverage = coverage.difference(
            union(list(authoritative_tree.geometries[indices]))
          )
      if coverage.area <= 1:
        continue
      identity = f"{source}:{owner}"
      for i, overlap in inside:
        if coverage.intersection(overlap).area > 0.02:
          linked[park_ids[i]].add(identity)
      plants.append((identity, code, coverage))
  inventory = {
    row.pitid: {
      "name": row.namenr.strip(),
      "borough": row.bezirkname,
      "status": row.widmung.strip(),
      "mappedMaterialOwners": sorted(linked[row.pitid]),
    }
    for row in parks.itertuples()
  }
  return plants, inventory, receipt, park_ids, park_geometries


def rgba_floor(packet, desired):
  """Exactly the ordinary flat grass/ground support encoded in the old asset."""
  result = defaultdict(list)
  colors = linear_rgb_bytes(
    np.array([COLORS["ground"], COLORS["park"]], dtype=np.uint8)
  )
  nav_y = packet["nav"]["groundY"]
  for part in packet["meshes"]:
    if (
      part["kind"] != "city"
      or part["positionType"] != "u16cm"
      or part.get("colorType") not in (None, "u8")
    ):
      continue
    vertices = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    rgb = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    ox, oy, oz = packet["origin"]
    min_x, min_z, max_x, max_z = desired.bounds
    for y, color in zip((nav_y, nav_y + 0.01), colors, strict=True):
      y_word = round((y - oy) * 100)
      mask = ((vertices[:, 1] == y_word) & np.all(rgb == color, axis=1))[indices].all(
        axis=1
      )
      if not mask.any():
        continue
      xyz = vertices[indices[mask]][:, :, [0, 2]] / 100 + [ox, oz]
      in_bounds = (
        (xyz[:, :, 0].max(axis=1) >= min_x)
        & (xyz[:, :, 0].min(axis=1) <= max_x)
        & (xyz[:, :, 1].max(axis=1) >= min_z)
        & (xyz[:, :, 1].min(axis=1) <= max_z)
      )
      for tri in xyz[in_bounds]:
        poly = Polygon(tri)
        if poly.area > 0.00001 and poly.intersects(desired):
          result[y].append(poly)
  return {height: union(polys) for height, polys in result.items()}


def nav_exclusions(packet, desired):
  nav = packet["nav"]
  ox, _, oz = packet["origin"]
  matches = []
  for key in ("water", "buildings", "roads", "bridges"):
    for item in nav.get(key, []):
      ring = [(x + ox, z + oz) for x, z in item["ring"]]
      holes = [[(x + ox, z + oz) for x, z in r] for r in item.get("holes", [])]
      polygon = Polygon(ring, holes)
      if polygon.intersects(desired):
        matches.extend(polygons_from_geometry(shapely.make_valid(polygon)))
  return union(matches)


def native_pixels(desired, grid):
  """All four cardinal cell corners and full square must belong to support."""
  all_cells = []
  for p in polygons_from_geometry(desired):
    x0, z0, x1, z1 = p.bounds
    xs = np.arange(math.floor(x0 / grid) * grid, x1, grid)
    zs = np.arange(math.floor(z0 / grid) * grid, z1, grid)
    shapely.prepare(p)
    for z in zs:
      cells = shapely.box(xs, z, xs + grid, z + grid)
      good = shapely.covers(p, cells)
      starts = np.flatnonzero(np.diff(np.r_[False, good, False].astype(int)) == 1)
      ends = np.flatnonzero(np.diff(np.r_[False, good, False].astype(int)) == -1)
      for start, end in zip(starts, ends, strict=True):
        all_cells.append(box(xs[start], z, xs[end - 1] + grid, z + grid))
  result = union(all_cells).simplify(0)
  if not result.is_empty and result.difference(desired).area > 0.00001:
    raise ValueError("Native cells escaped their complete support")
  return result


def make_part(packet, candidates, tile, native, grid=NATIVE_M):
  by_kind = {
    code: union([g for _, kind, g in candidates if kind == code]).intersection(tile)
    for code in PAINT
  }
  desired = union(list(by_kind.values()))
  if desired.is_empty:
    return None
  floors = rgba_floor(packet, desired)
  if not floors:
    return None
  blocked = nav_exclusions(packet, desired)
  ox, _, oz = packet["origin"]
  mesh = PackedMesh(ox, oz)
  emitted = {}
  occupied = Polygon()
  for code, desired_kind in by_kind.items():
    clean = desired_kind.difference(blocked).difference(occupied)
    if clean.is_empty:
      continue
    paint = PAINT[code]
    for y, floor in floors.items():
      if not floor.intersects(clean):
        continue
      strict = clean.intersection(floor)
      if native:
        coverage = native_pixels(strict, grid)
      else:
        # Quantized words stay within the exact intended polygon. Use at most
        # the two nearest centimetres to clip roundoff at mixed boundaries.
        clipped = shapely.set_precision(strict.buffer(-0.012), 0.01)
        coverage = union(
          [
            p
            for p in polygons_from_geometry(clipped)
            if p.area > 0.2 and strict.covers(p)
          ]
        )
      if coverage.is_empty:
        continue
      assert (
        coverage.difference(floor).area < 0.00001
        and coverage.intersection(blocked).area < 0.00001
      )
      mesh.surface(coverage, y + 0.02, paint)
      emitted[code, y] = coverage
      occupied = occupied.union(coverage)
  if not mesh.indices:
    return None
  if len(mesh.vertices) * 12 + len(mesh.indices) * 4 > MAX_GEOMETRY_BYTES:
    return False
  owners = sorted(
    {
      owner
      for owner, code, g in candidates
      if any(
        c == code and h.intersection(g).area > 0.001 for (c, _), h in emitted.items()
      )
    }
  )
  if not 0 < len(owners) <= 512:
    return False
  part = mesh.payload(KIND)
  metrics = {
    "areaM2": round(occupied.area, 3),
    "patches": len(owners),
    "triangles": len(mesh.indices) // 3,
    "maxGpuBytes": len(mesh.vertices) * 12 + len(mesh.indices) * 4,
    "materialAreaM2": {
      str(c): round(sum(h.area for (code, _), h in emitted.items() if c == code), 3)
      for c in PAINT
    },
  }
  return part, owners, metrics, occupied


class Shards:
  def __init__(self, output):
    self.directory = output
    self.pending = {}
    self.pending_bytes = 0
    self.raw = 0
    self.gzip = 0
    self.files = []

  def add(self, key, plan):
    size = len(json.dumps(plan, separators=(",", ":")).encode())
    if self.pending and (
      len(self.pending) >= 24 or self.pending_bytes + size > MAX_RAW_SHARD_BYTES
    ):
      self.flush()
    self.pending[key] = plan
    self.pending_bytes += size

  def flush(self):
    if not self.pending:
      return
    name = f"publicGreenV329Packets{len(self.files)}.json"
    path = self.directory / name
    keys = list(self.pending)
    write(path, {"schemaVersion": 1, "keys": keys, "packets": self.pending})
    data = path.read_bytes()
    self.gzip += len(gzip.compress(data, mtime=0))
    self.raw += len(data)
    self.files.append({"file": name, "keys": keys, "sha256": sha(path)})
    self.pending = {}
    self.pending_bytes = 0


def ubahn_hosts(manifest):
  """Use the exact same conservative tile guard as the normal runtime."""
  descriptors = [{"id": d["id"], "bounds": d["bounds"]} for d in manifest["chunks"]]
  result = subprocess.run(
    [
      "bun",
      str(APP / "scripts/capture-public-green-receipts-v329.ts"),
      "--ubahn-bounds",
    ],
    cwd=APP,
    input=json.dumps(descriptors),
    capture_output=True,
    text=True,
    check=True,
  )
  blocked = json.loads(result.stdout)
  assert len(blocked) == len(set(blocked))
  return set(blocked)


def finalize_shards(staged, output, blocked):
  """Filter dormant U-Bahn hosts while keeping the original finite shard partitions."""
  paths = sorted(
    staged.glob("publicGreenV329Packets*.json"),
    key=lambda p: int(p.stem.removeprefix("publicGreenV329Packets")),
  )
  files, seen, excluded = [], set(), []
  raw_bytes, gzip_bytes = 0, 0
  output.mkdir(parents=True, exist_ok=True)
  for source in paths:
    data = read(source)
    if (
      not 0 < len(data["keys"]) <= 24
      or list(data["packets"]) != data["keys"]
      or set(data["keys"]) & seen
    ):
      raise ValueError(f"Invalid staging shard {source}")
    seen.update(data["keys"])
    packets = {}
    for key in data["keys"]:
      if key.split(":", 1)[1] in blocked:
        excluded.append(key)
        continue
      plan = data["packets"][key]
      if (
        plan["retire"]
        or plan.get("preparedRecords")
        or plan["append"]["kind"] != KIND
        or fingerprint(plan["append"]) != plan["appendFingerprint"]
      ):
        raise ValueError(f"Incompatible staged green plan {key}")
      packets[key] = plan
    if not packets:
      continue
    name = f"publicGreenV329Packets{len(files)}.json"
    destination = output / name
    write(destination, {"schemaVersion": 1, "keys": list(packets), "packets": packets})
    payload = destination.read_bytes()
    raw_bytes += len(payload)
    gzip_bytes += len(gzip.compress(payload, mtime=0))
    files.append({"file": name, "keys": list(packets), "sha256": sha(destination)})
  if not files or gzip_bytes > MAX_ARCHIVE_GZIP_BYTES:
    raise ValueError(f"Public-green archive cap or empty result: {gzip_bytes} bytes")
  write(output / "publicGreenV329Index.json", {"schemaVersion": 1, "sources": files})
  return files, raw_bytes, gzip_bytes, excluded


def compile(args):
  protected, protected_keys, inputs = protected_ground(args.path_evidence)
  plants, inventory, receipts, park_ids, park_geometries = public_sources(
    args.source, protected
  )
  eligible_site_tree = STRtree(park_geometries)
  tree = STRtree([p[2] for p in plants])
  manifest_path = PUBLIC / "manifest.json"
  manifest_sha = sha(manifest_path)
  if manifest_sha != "d4160435b1f7c70d6b633aed7d695b587ee46708259efb5140476dceacd21d4c":
    raise ValueError("Changed published footprint manifest")
  manifest = read(manifest_path)
  blocked = ubahn_hosts(manifest)
  keys = [entry["id"] for entry in manifest["chunks"]]
  assert len(keys) == len(set(keys))
  # A candidate that already sits in a bespoke source packet remains with its
  # owner. The network add-only road layer is separately excluded by level.
  special_prefixes = ("northEast326-", "publicInstitutions326-", "ubahn", "airport")
  candidates = []
  for entry in manifest["chunks"]:
    identity = entry["id"]
    if (
      entry.get("detailCompanionOf")
      or identity in protected_keys
      or identity.startswith(special_prefixes)
    ):
      continue
    if args.only and identity not in args.only:
      continue
    tile = box(*entry["bounds"])
    selected = [plants[i] for i in tree.query(tile, predicate="intersects")]
    if selected:
      candidates.append((entry, tile, selected))
  hints = [
    [f"{mode}:{d['id']}", str(PUBLIC / d[mode]["url"])]
    for d, _, _ in candidates
    for mode in ("drawn", "minecraft")
  ]
  capture = subprocess.run(
    ["bun", str(APP / "scripts/capture-public-green-receipts-v329.ts")],
    cwd=APP,
    input=json.dumps(hints),
    capture_output=True,
    text=True,
    check=True,
  )
  pins = dict(json.loads(line) for line in capture.stdout.splitlines())
  if len(pins) != len(hints):
    raise ValueError("Incomplete source preparation capture")
  args.output.mkdir(parents=True, exist_ok=True)
  stage = tempfile.TemporaryDirectory(prefix="green-shards-", dir=args.output)
  shards = Shards(Path(stage.name))
  skips, details, site_areas = Counter(), {}, defaultdict(Counter)
  for i, (entry, tile, selected) in enumerate(candidates):
    for mode in ("drawn", "minecraft"):
      key = f"{mode}:{entry['id']}"
      if not pins[key]:
        skips["unsafe predecessor or packet mesh cap"] += 1
        continue
      asset = entry[mode]
      path = PUBLIC / asset["url"]
      if sha(path) != asset["sha256"]:
        raise ValueError(f"Unexpected old asset {path}")
      packet = read(path)
      native = mode == "minecraft"
      result = make_part(packet, selected, tile, native)
      if result is False and native:
        result = make_part(packet, selected, tile, True, 2)
      if not result:
        skips[
          "geometry cap" if result is False else "no supported public vegetation"
        ] += 1
        continue
      append, owners, metrics, occupied = result
      plan = {
        "origin": packet["origin"],
        **pins[key],
        "append": append,
        "appendFingerprint": fingerprint(append),
        "owners": owners,
        "retire": [],
      }
      shards.add(key, plan)
      if entry["id"] in blocked:
        continue
      for site in eligible_site_tree.query(occupied, predicate="intersects"):
        site_areas[mode][park_ids[site]] += (
          park_geometries[site].intersection(occupied).area
        )
      details[key] = {**metrics, "sourceSha256": asset["sha256"]}
    if (i + 1) % 64 == 0:
      print(
        f"{i + 1}/{len(candidates)} tiles, {len(details)} emitted families", flush=True
      )
  shards.flush()
  files, raw_bytes, gzip_bytes, excluded = finalize_shards(
    Path(stage.name), args.output, blocked
  )
  stage.cleanup()
  skips["preserved U-Bahn aperture host"] = len(excluded)
  if not details or len(details) != sum(len(f["keys"]) for f in files):
    raise ValueError("Incomplete exact admitted green proof")
  for key, row in inventory.items():
    row["drawnM2"] = round(site_areas["drawn"][key], 3)
    row["minecraftM2"] = round(site_areas["minecraft"][key], 3)
  evidence = {
    "schemaVersion": 1,
    "manifestSha256": manifest_sha,
    "sources": receipts,
    "preservedInputs": inputs,
    "skips": dict(skips),
    "tiles": details,
    "officialPublicSiteAccounting": inventory,
    "archiveMeasuredGzipBytes": gzip_bytes,
    "recipeRawBytes": raw_bytes,
  }
  write(args.output / "public-green-v329-evidence.json.gz", evidence)
  print(
    json.dumps(
      {
        "tiles": len(candidates),
        "plans": len(details),
        "shards": len(files),
        "gzip": gzip_bytes,
        "raw": raw_bytes,
        "skips": dict(skips),
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  cli = argparse.ArgumentParser(description=__doc__)
  cli.add_argument("--source", type=Path, required=True)
  cli.add_argument("--output", type=Path, required=True)
  cli.add_argument("--only", nargs="*")
  cli.add_argument("--path-evidence", type=Path)
  compile(cli.parse_args())
