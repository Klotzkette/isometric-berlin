"""Prepare the bounded Gärten der Welt and Kienbergpark terrain from official DGM1."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import parse_osm_measure_m
from scripts.build_surrounding_outlines import (
  line_parts,
  polygons_from_geometry,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/marzahn-garden-v330"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
GRIS = GEO / "raw/public-green-v329/gruenanlagen.gpkg"
SOURCE = GEO / "marzahn-garden-terrain-v330-source.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASELINE = "3778a70d4db2c672c964a839e43d05bf0fe6e053"
GRIS_SHA = "cee7d8d2fedc7cade011d564178a48389fa50a4ed446d0a9a9a954b080be9862"
GRID_STEP = 4
NATIVE_DOMAIN_STEP = 1
OSM_BBOX = (13.560, 52.528, 13.603, 52.544)
PARK = "00008100:00199269"
KIENBERG = {
  "002819ae",
  "002819bb",
  "002819c3",
  "002819c7",
  "002e6f29",
  "002819ea",
  "002819eb",
  "00202f31",
  "00202f32",
  "001991cd",
}
GARDEN = "549688688"
STATIONS = {"440671059", "516685249", "500855687"}
WATER = "24885696"
# Exact mapped south U5 approach towards the terminal from the eastern bank.
# No inferred line across the final mapped access gap or the station interior.
EAST_APPROACH = {
  "541377516",
  "506383503",
  "1082446499",
  "1192100633",
  "335201550",
  "1192100635",
  "1192100634",
  "1257812919",
  "1042056297",
}


def digest(path):
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def read_json(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def polygonal(geometry):
  return unary_union(list(polygons_from_geometry(shapely.make_valid(geometry))))


class TerrainSource(dict):
  """Public data values with separately prepared, reusable query shapes."""

  def __init__(self, data):
    super().__init__(data)
    self.land = shape(self["land"])
    self.native_land = shape(self["nativeLand"])
    shapely.prepare(self.land)
    shapely.prepare(self.native_land)


def load_terrain(path=SOURCE):
  source = TerrainSource(read_json(Path(path)))
  grid = source["grid"]
  cols, rows = grid["cols"], grid["rows"]
  if (
    source["schemaVersion"] != 1
    or grid["stepM"] != GRID_STEP
    or cols < 2
    or rows < 2
    or len(grid["heightsCm"]) != cols * rows
    or len(grid["nativeHeightsCm"]) != (cols - 1) * (rows - 1)
  ):
    raise ValueError("Incomplete Marzahn terrain grid")
  return source


def terrain_height(source, x, z, native=False):
  """Measure the actual Drawn planes or the independent Native platform grid."""
  grid = source["grid"]
  a, b = grid["origin"]
  cols, rows, step = grid["cols"], grid["rows"], grid["stepM"]
  u, v = (x - a) / step, (z - b) / step
  if not (0 <= u <= cols - 1 and 0 <= v <= rows - 1):
    return None
  i, j = min(math.floor(u), cols - 2), min(math.floor(v), rows - 2)
  if native:
    return grid["nativeHeightsCm"][j * (cols - 1) + i] / 100
  f, g = u - i, v - j
  values = grid["heightsCm"]
  at = j * cols + i
  nw, ne, sw, se = values[at], values[at + 1], values[at + cols], values[at + cols + 1]
  # Shared diagonal from NW to SE. These two affine planes meet exactly.
  if g <= f:
    return (nw + (ne - nw) * f + (se - ne) * g) / 100
  return (nw + (se - sw) * f + (sw - nw) * g) / 100


def ground_at(source, x, z, native=False):
  """Return an actual admitted land height; water and untouched holes are empty."""
  land = source.native_land if native else source.land
  if not shapely.intersects_xy(land, x, z):
    return None
  return terrain_height(source, x, z, native)


def baseline_manifest():
  name = (PUBLIC / "manifest.json").relative_to(ROOT)
  raw = subprocess.check_output(["git", "show", f"{BASELINE}:{name}"], cwd=ROOT)
  return json.loads(raw), hashlib.sha256(raw).hexdigest()


def source_polygons():
  if digest(GRIS) != GRIS_SHA:
    raise ValueError("Changed exact public-green GRIS snapshot")
  region = (402770, 5820700, 404480, 5822250)
  parks = pyogrio.read_dataframe(GRIS, bbox=region)
  ids = {PARK, *("00008100:" + s for s in KIENBERG)}
  selected = {
    row.pitid: (row.namenr, world(row.geometry))
    for row in parks.itertuples()
    if row.pitid in ids and row.widmung == "gewidmet"
  }
  if set(selected) != ids:
    raise ValueError("Incomplete named GRIS park domain")
  osm = pyogrio.read_dataframe(PBF, layer="multipolygons", bbox=OSM_BBOX).to_crs(25833)
  seen, water, green = {}, [], []
  targets = {GARDEN, WATER, *STATIONS}
  local = box(13300, -2125, 14960, -790)
  for row in osm.to_dict("records"):
    props = tags_for(row)
    key = row.get("osm_way_id")
    geometry = world(row["geometry"])
    if key in targets:
      if key in seen:
        raise ValueError("Duplicate exact OSM park owner")
      seen[key] = {"name": row["name"], "geometry": geometry, "tags": props}
    if not geometry.intersects(local):
      continue
    # GDAL separates multipolygon relation IDs from way IDs.
    area_id = key if isinstance(key, str) else "relation/" + str(row["osm_id"])
    if props.get("natural") == "water" or props.get("waterway") == "riverbank":
      water.append((area_id, geometry))
    if props.get("natural") == "wood" or props.get("landuse") in {
      "forest",
      "meadow",
      "grass",
    }:
      green.append((area_id, geometry, props.get("natural", props.get("landuse"))))
  if set(seen) != targets:
    raise ValueError("Incomplete OSM station, water or park verification")
  if seen[GARDEN]["tags"].get("leisure") != "garden" or any(
    seen[key]["tags"].get("aerialway") != "station" for key in STATIONS
  ):
    raise ValueError("Changed exact OSM park or station roles")
  return selected, seen, water, green


def source_paths(initial):
  frame = pyogrio.read_dataframe(
    PBF,
    layer="lines",
    bbox=OSM_BBOX,
    where="highway IN ('footway','pedestrian','path','cycleway','steps','living_street')",
  ).to_crs(25833)
  roads, corridors, elevated = [], [], []
  found = set()
  # The selected OSM ways only widen the proved ground corridor around the
  # station and pedestrian crossing. Long sidewalk tails outside stay intact.
  approach_extent = box(14860, -997, 14914, -858)
  for row in frame.to_dict("records"):
    props = tags_for(row)
    key = row["osm_id"]
    geometry = world(row["geometry"])
    if props.get("access") in {"private", "no"} or props.get("foot") == "no":
      continue
    if (
      props.get("bridge", "no") != "no"
      or props.get("tunnel", "no") != "no"
      or props.get("layer") not in (None, "", "0")
    ):
      if geometry.intersects(initial):
        elevated.append(
          {"id": "way/" + key, "geometry": mapping(geometry), "tags": props}
        )
      continue
    width = parse_osm_measure_m(props.get("width"))
    if width is None or not 0.5 <= width <= 12:
      width, kind = (
        (2.3 if props.get("highway") == "steps" else 2.4),
        "display-estimate",
      )
    else:
      kind = "OSM-width"
    if key in EAST_APPROACH:
      found.add(key)
      corridors.extend(
        part.buffer(width / 2, cap_style=2, join_style=2)
        for part in line_parts(geometry.intersection(approach_extent))
      )
    if geometry.intersects(initial) or key in EAST_APPROACH:
      roads.append(
        {
          "id": "way/" + key,
          "geometry": mapping(geometry),
          "widthM": width,
          "widthSource": kind,
          "tags": {
            k: props[k]
            for k in ("surface", "highway", "footway", "access", "name")
            if k in props
          },
        }
      )
  if found != EAST_APPROACH:
    raise ValueError("Changed finite east station access courses")
  return roads, polygonal(unary_union(corridors)), elevated


def old_complement(domain):
  manifest, pin = baseline_manifest()
  old, receipts = [], []
  for row in manifest["chunks"]:
    if row.get("detailCompanionOf") or not box(*row["bounds"]).intersects(domain):
      continue
    for mode in ("drawn", "minecraft"):
      asset = row[mode]
      path = PUBLIC / asset["url"]
      if digest(path) != asset["sha256"]:
        raise ValueError(f"Changed retained packet {row['id']}:{mode}")
      packet = read_json(path)
      x, _, z = packet["origin"]
      overlaps = {}
      for group in ("ground", "water", "bridges", "roads", "buildings"):
        owners = []
        for record in packet["nav"].get(group, []):
          ring = translate(Polygon(record["ring"], record["holes"]), x, z)
          retained = polygonal(ring).intersection(domain)
          if retained.area > 1e-8:
            old.append(retained)
            owners.append(
              {
                "id": record.get("sourceId"),
                "intersectionM2": retained.area,
                "geometry": mapping(retained),
              }
            )
        if owners:
          overlaps[group] = owners
      receipts.append(
        {"key": f"{mode}:{row['id']}", "sha256": asset["sha256"], "overlaps": overlaps}
      )
  return polygonal(unary_union(old)), receipts, pin


def native_domain(domain):
  """Only complete cardinal one-metre cells may carry the Native floor."""
  if domain.is_empty:
    return Polygon()
  x0, z0, x1, z1 = domain.bounds
  step = NATIVE_DOMAIN_STEP
  shapely.prepare(domain)
  rows = []
  for j in range(math.floor(z0 / step), math.ceil(z1 / step)):
    z = j * step
    intervals = line_parts(
      domain.intersection(LineString([(x0 - 1, z + step / 2), (x1 + 1, z + step / 2)]))
    )
    for interval in intervals:
      left, _, right, _ = interval.bounds
      xs = (
        np.arange(math.ceil(left / step), math.floor(right / step), dtype=np.int32)
        * step
      )
      if not len(xs):
        continue
      selected = shapely.covers(domain, shapely.box(xs, z, xs + step, z + step))
      ends = np.flatnonzero(np.diff(np.r_[False, selected, False]))
      rows.extend(
        box(xs[a], z, xs[b - 1] + step, z + step)
        for a, b in zip(ends[::2], ends[1::2], strict=True)
      )
  # Adjacent strips can share only part of an edge, so this is not an edge-matched coverage.
  return polygonal(shapely.union_all(rows)) if rows else Polygon()


def dgm_samples(east, north):
  east, north = np.broadcast_arrays(east, north)
  values = np.full(east.shape, -32_768, dtype=np.int16)
  pins = []
  tiles = sorted(
    set(zip((east // 2000 * 2).flat, (north // 2000 * 2).flat, strict=True))
  )
  local = {p.name: p for p in RAW.glob("DGM1_*.zip")}
  existing = GEO / "raw/ubahn-approaches-v326/DGM1_404_5820.zip"
  local.setdefault(existing.name, existing)
  for e, n in tiles:
    name = f"DGM1_{e}_{n}.zip"
    path = local[name]
    origin_e, origin_n = e * 1000, n * 1000
    matching = (east // 2000 * 2 == e) & (north // 2000 * 2 == n)
    wanted = (north[matching] - origin_n) * 2000 + east[matching] - origin_e
    with zipfile.ZipFile(path) as archive:
      members = [s for s in archive.namelist() if s.endswith(".xyz")]
      if len(members) != 1:
        raise ValueError("Unexpected official DGM1 ZIP")
      member = members[0]
      with archive.open(member) as data:
        xyz = np.loadtxt(data, dtype=np.float32)
    codes = (
      (xyz[:, 1].astype(np.int32) - origin_n) * 2000
      + xyz[:, 0].astype(np.int32)
      - origin_e
    )
    at = np.searchsorted(codes, wanted)
    if (
      np.any(at >= len(codes))
      or np.any(codes[at] != wanted)
      or np.any(xyz[at, 0] != east[matching] + 0.5)
      or np.any(xyz[at, 1] != north[matching] + 0.5)
    ):
      raise ValueError("Missing exact DGM1 cell centre")
    values[matching] = np.rint(xyz[at, 2].astype(np.float64) * 100).astype(np.int16)
    pins.append(
      {
        "url": "https://gdi.berlin.de/data/dgm1/atom/" + name,
        "sha256": digest(path),
        "bytes": path.stat().st_size,
        "member": member,
        "samples": int(matching.sum()),
      }
    )
  if np.any(values == -32_768):
    raise ValueError("Unbound DGM1 cell centre")
  return values, pins


def sample_grid(domain):
  x0, z0, x1, z1 = domain.bounds
  step = GRID_STEP
  x0, z0 = math.floor(x0 / step) * step, math.floor(z0 / step) * step
  x1, z1 = math.ceil(x1 / step) * step, math.ceil(z1 / step) * step
  dx, dz = np.arange(x0, x1 + step, step), np.arange(z0, z1 + step, step)
  # A two-metre lattice holds both 4m Drawn vertices and independent Native
  # cell centres. At these integer coordinates, the four original 1m
  # DGM posts surrounding the point have exactly equal interpolation weight.
  x = np.arange(x0, x1 + 2, 2)
  z = np.arange(z0, z1 + 2, 2)
  east = x[None, :, None] + 389500 + np.array([-1, 0, -1, 0])[None, None, :]
  north = 5820000 - z[:, None, None] + np.array([-1, -1, 0, 0])[None, None, :]
  posts, pins = dgm_samples(east, north)
  nhn_cm = posts.astype(np.int32).sum(2) / 4
  drawn = np.rint(nhn_cm[::2, ::2] - 2990).astype(np.int32)
  native = np.rint((nhn_cm[1::2, 1::2] - 3000) / 10).astype(np.int32) * 10 + 10
  return {
    "origin": [int(x0), int(z0)],
    "cols": len(dx),
    "rows": len(dz),
    "stepM": step,
    "heightsCm": drawn.ravel().tolist(),
    "nativeHeightsCm": native.ravel().tolist(),
    "sourcePostsSha256": hashlib.sha256(
      posts.astype("<i2", copy=False).tobytes()
    ).hexdigest(),
  }, pins


def tile_ids(domain):
  x0, z0, x1, z1 = domain.bounds
  return [
    f"{x}_{z}"
    for x in range(math.floor(x0 / 512), math.ceil(x1 / 512))
    for z in range(math.floor(z0 / 512), math.ceil(z1 / 512))
    if domain.intersection(box(x * 512, z * 512, (x + 1) * 512, (z + 1) * 512)).area
    > 1e-8
  ]


def build():
  parks, osm, water, green = source_polygons()
  official = unary_union([p for _, p in parks.values()])
  initial = polygonal(
    unary_union([official, *[osm[k]["geometry"] for k in STATIONS | {WATER}]])
  )
  paths, approaches, elevated = source_paths(initial)
  full = polygonal(initial.union(approaches))
  old, receipts, manifest_pin = old_complement(full)
  scope = polygonal(full.difference(old))
  water = [
    {"id": key, "geometry": mapping(clipped)}
    for key, g in water
    if (clipped := polygonal(g.intersection(scope))).area > 0.5
  ]
  water_scope = polygonal(unary_union([shape(f["geometry"]) for f in water]))
  land = polygonal(scope.difference(water_scope))
  native_land = native_domain(land)
  native_water = native_domain(water_scope)
  grid, tiles = sample_grid(scope)
  return {
    "schemaVersion": 1,
    "baseline": BASELINE,
    "scope": mapping(scope),
    "land": mapping(land),
    "water": mapping(water_scope),
    "nativeLand": mapping(native_land),
    "nativeWater": mapping(native_water),
    "nativeDomainStepM": NATIVE_DOMAIN_STEP,
    "grid": grid,
    "datum": {
      "source": "DHHN2016",
      "offsetM": -30,
      "surfaceLiftM": 0.10,
      "drawingDiagonal": "NW-SE",
      "nativeHeight": "independent 4m midpoint DGM interpolation, rounded to decimetres",
    },
    "tileIds": tile_ids(scope),
    "paths": paths,
    "elevatedPaths": elevated,
    "vegetation": [
      {"id": key, "kind": kind, "geometry": mapping(clipped)}
      for key, g, kind in green
      if (clipped := polygonal(g.intersection(land))).area > 0.5
    ],
    "sources": {
      "dgm": tiles,
      "park": {
        "sha256": GRIS_SHA,
        "records": [
          {"id": key, "name": name, "areaM2": g.area, "geometry": mapping(g)}
          for key, (name, g) in sorted(parks.items())
        ],
      },
      "osm": {
        "sha256": digest(PBF),
        "date": "2026-09-29",
        "gardenBoundary": mapping(osm[GARDEN]["geometry"]),
        "gardenBoundaryAreaM2": osm[GARDEN]["geometry"].area,
        "stations": [
          {
            "id": "way/" + key,
            "name": osm[key]["name"],
            "geometry": mapping(osm[key]["geometry"]),
          }
          for key in sorted(STATIONS)
        ],
        "water": water,
        "eastApproachWays": sorted(EAST_APPROACH),
      },
      "retained": {
        "manifestSha256": manifest_pin,
        "areaM2": old.area,
        "packets": receipts,
      },
    },
  }


if __name__ == "__main__":
  source = build()
  raw = (
    json.dumps(source, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    + "\n"
  ).encode()
  SOURCE.write_bytes(gzip.compress(raw, mtime=0))
  print(
    json.dumps(
      {
        "tileIds": source["tileIds"],
        "areaM2": shape(source["scope"]).area,
        "nativeAreaM2": shape(source["nativeLand"]).area
        + shape(source["nativeWater"]).area,
        "terrainLimitsM": [
          min(source["grid"]["heightsCm"]) / 100,
          max(source["grid"]["heightsCm"]) / 100,
        ],
        "paths": len(source["paths"]),
        "elevated": len(source["elevatedPaths"]),
        "sourceSha256": digest(SOURCE),
      }
    )
  )
