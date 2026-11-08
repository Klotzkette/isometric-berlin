"""Finite source-course U-Bahn approaches outside every retained ground owner.

Only new 512 m ordinary packets are written. Full source paths/tags, sparse
official DGM1 samples, exclusions and every unsupported access stay accounted.
No former packet, footprint, building, water or navigation row is edited.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely import constrained_delaunay_triangles, make_valid, set_precision
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from scripts.build_public_inventory_v326 import (
  digest,
  osm_identity,
  tags,
  world_geometry,
)
from scripts.build_surrounding_outlines import (
  PackedMesh,
  navigation_polygons,
  polygons_from_geometry,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/ubahn-approaches-v326"
SOURCE = GEO / "ubahn-ground-approaches-v326-source.json.gz"
INDEX = DATA / "ubahnGroundApproachesV326Index.json"
AUTHORED = DATA / "ubahnAuthoredGroundV326Index.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
TO_GEO = Transformer.from_crs(25833, 4326, always_xy=True)
PUBLIC_NAMESPACE = "ubahnApproach326-"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def footprints(rows):
  return unary_union([make_valid(Polygon(p["ring"], p.get("holes", []))) for p in rows])


def finite_width(way):
  for key in ["width", "est_width"]:
    try:
      value = float(way["tags"].get(key, "").removesuffix(" m"))
      if 0.8 <= value <= 8:
        return value, key
    except ValueError:
      pass
  return 2.3 if way["tags"].get(
    "highway"
  ) == "steps" else 2.4, "explicit-display-estimate"


def pole_footprints(entry):
  result = []
  for native in [False, True]:
    dx, dz = entry["axis"]
    if native:
      dx, dz = (
        (math.copysign(1, dx), 0) if abs(dx) >= abs(dz) else (0, math.copysign(1, dz))
      )
    side = (entry["stair"]["width"] if entry["stair"] else 2.3) / 2 + 0.26
    x, z = entry["point"]
    # This is the existing factory's exact .09 m pole footing, with only
    # .035 m display support. It is not asserted to be a surveyed paving pad.
    cx, cz = x - dz * side, z + dx * side
    result.append(
      box(cx - 0.08, cz - 0.08, cx + 0.08, cz + 0.08)
      if not native
      else box(
        math.floor((cx - 0.045) * 4) / 4 - 0.02,
        math.floor((cz - 0.045) * 4) / 4 - 0.02,
        math.ceil((cx + 0.045) * 4) / 4 + 0.02,
        math.ceil((cz + 0.045) * 4) / 4 + 0.02,
      )
    )
  return result


def approach(entry, ways):
  candidates, records = [], []
  point = Point(entry["point"])
  for way in ways:
    t = way["tags"]
    if t.get("highway") not in ["footway", "path", "pedestrian", "steps", "cycleway"]:
      continue
    if t.get("indoor") == "yes" or t.get("bridge") not in [None, "no"]:
      continue
    if t.get("tunnel") not in [None, "no"]:
      continue
    # A mapped descent itself is represented only at its documented top;
    # arbitrary level=-1 connecting paths never become a surface approach.
    is_stair = bool(entry["stair"] and way["id"] == entry["stair"]["sourceWay"])
    if not is_stair and "level" in t and "0" not in t["level"].split(";"):
      continue
    line = LineString(way["points"])
    if line.distance(point) > 0.11:
      continue
    width, source = finite_width(way)
    selected_line = (
      line if is_stair else line.intersection(point.buffer(10, quad_segs=16))
    )
    # The mapped entrance is frequently a line endpoint. A width-radius
    # round end is the explicit ordinary path-cap estimate; a flat cap plus
    # source-safety inset would incorrectly delete its own top endpoint.
    patch = selected_line.buffer(width / 2, cap_style=1, join_style=2, quad_segs=8)
    candidates.append(patch)
    records.append(
      {
        "id": way["id"],
        "widthM": width,
        "widthSource": source,
        "sourceDescent": is_stair,
      }
    )
  if not candidates:
    return Polygon(), records
  # Rails and the pole are real members of the existing finite access model.
  # Their bounded foundations are an explicit tiny display-support estimate;
  # there is no enclosing rectangle, street block or district backdrop.
  if entry["stair"]:
    candidates.append(Polygon(entry["stair"]["ring"]).buffer(0.20, join_style=2))
  candidates.extend(pole_footprints(entry))
  return unary_union(candidates), records


def closed_body(t):
  """Clear only explicitly overhead roofs with positive vertical evidence."""
  try:
    overhead = (t.get("building") == "roof" or t.get("building:part") == "roof") and (
      float(t.get("layer", "0")) > 0 or float(t.get("min_height", "0")) > 1.5
    )
  except ValueError:
    overhead = False
  return not overhead and (
    t.get("building") not in [None, "no"] or t.get("building:part") not in [None, "no"]
  )


def extract_context(scope):
  cache = RAW / "context.json.gz"
  sql = "SELECT * FROM multipolygons WHERE building IS NOT NULL OR other_tags LIKE '%\"building:part\"=>%' OR \"natural\"='water' OR landuse IN ('reservoir','basin') OR other_tags LIKE '%\"waterway\"=>%'"
  geographic = transform(lambda x, z: TO_GEO.transform(x + 389500, 5820000 - z), scope)
  frame = pyogrio.read_dataframe(PBF, sql=sql, sql_dialect="OGRSQL", mask=geographic)
  rows = []
  for _, row in frame.iterrows():
    properties = {
      k: v
      for k, v in row.to_dict().items()
      if k != "geometry"
      and v is not None
      and not (isinstance(v, float) and math.isnan(v))
    }
    geometry = make_valid(world_geometry(mapping(row.geometry)))
    if not geometry.intersects(scope):
      continue
    rows.append(
      {
        "id": osm_identity(properties, True),
        "tags": tags(properties),
        "properties": properties,
        "geometry": mapping(geometry),
        "originalGeographicGeometry": mapping(row.geometry),
      }
    )
  result = {
    "source": str(PBF.relative_to(ROOT)),
    "sha256": digest(PBF),
    "query": sql,
    "records": rows,
    "selectedDomain": mapping(scope),
  }
  write(cache, result)
  print("selected context", len(rows), flush=True)
  return result


def prepare(audit_path, reuse_context=False):
  ubahn_path = GEO / "ubahn-access-v326-source.json.gz"
  ubahn = read(ubahn_path)
  if digest(PBF) != ubahn["source"]["sha256"]:
    raise ValueError("Changed original U-Bahn source PBF")
  audit = read(audit_path)
  ids = set(read(AUTHORED)["ids"])
  entries = [e for e in audit["missing"] if e["id"] not in ids]
  if len(entries) != 148:
    raise ValueError("Expected the finite 148 unprovided ground accesses")
  by_entry = defaultdict(list)
  for way in ubahn["accessWays"]:
    for key in way["entrances"]:
      by_entry[key].append(way)
  candidates, records = {}, []
  for entry in entries:
    patch, widths = approach(entry, by_entry[entry["id"]])
    candidates[entry["id"]] = patch
    records.append(
      {
        "entry": entry,
        "sourceWays": by_entry[entry["id"]],
        "widths": widths,
        "candidate": mapping(patch),
      }
    )
  scope = unary_union(list(candidates.values()))
  context = read(RAW / "context.json.gz") if reuse_context else {}
  if not context.get("selectedDomain") or not shape(context["selectedDomain"]).covers(
    scope
  ):
    context = extract_context(scope.buffer(2))
  if context["sha256"] != digest(PBF):
    raise ValueError("Changed context source")
  buildings, water = [], []
  for record in context["records"]:
    t = record["tags"]
    if closed_body(t):
      buildings.append(shape(record["geometry"]))
    if (
      t.get("natural") == "water"
      or t.get("landuse") in ["reservoir", "basin"]
      or t.get("waterway")
    ):
      water.append(shape(record["geometry"]))
  exclusion_paths = [
    GEO / "public-fidelity-v326-published206-manifest.json.gz",
    DATA / "northEastPublicSitesV326Index.json",
    DATA / "publicInstitutionsV326Index.json",
  ]
  exclusions = [footprints(read(p)["footprint"]) for p in exclusion_paths]
  # Preserve the original source objects. make_valid is used only on this
  # derivative clipping union, not as a rewrite of any earlier owner.
  exclusions.extend(
    [box(-3900, -3620, 2412, 2912), unary_union(buildings), unary_union(water)]
  )
  excluded = unary_union(exclusions).intersection(scope.buffer(0.05))
  state_path = GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson"
  state = unary_union(
    [world_geometry(f["geometry"], True) for f in read(state_path)["features"]]
  )
  exclusion_paths.append(state_path)
  for record in records:
    candidate = shape(record["candidate"])
    patch = (
      candidate.intersection(state).difference(excluded).buffer(-0.015, join_style=2)
      if not candidate.is_empty
      else Polygon()
    )
    patch = make_valid(set_precision(patch, 0.01))
    record["ground"] = mapping(patch)
    record["candidateAreaM2"] = candidate.area
    record["newGroundAreaM2"] = patch.area
    point = Point(record["entry"]["point"])
    record["status"] = (
      "source-ground"
      if patch.covers(point)
      else "unsupported-after-exact-source-exclusions"
    )
    record["reason"] = (
      "supported-complete-source-course"
      if record["status"] == "source-ground"
      else "no-public-surface-course-evidence"
      if not record["widths"]
      else "outside-Berlin"
      if not state.covers(point)
      else "source-building-or-water"
      if unary_union(buildings + water).covers(point)
      else "retained-ground-or-institution-scope"
      if excluded.covers(point)
      else "no-positive-inset-source-ground-at-entry"
    )
  return {
    "schemaVersion": 1,
    "sourceUbahn": {
      "path": str(ubahn_path.relative_to(ROOT)),
      "sha256": digest(ubahn_path),
    },
    "sourcePbf": ubahn["source"],
    "auditOriginal": audit,
    "exclusionPins": {str(p.relative_to(ROOT)): digest(p) for p in exclusion_paths},
    "contextOriginal": context,
    "records": records,
    "heightPolicy": "Original DGM1 cell-centre heights in DHHN2016, existing world transform NHN minus30m; fixed original half-metre-origin one-metre triangle planes are shared by Drawn geometry and navigation. No fabricated regional elevation.",
    "estimates": "Untagged source path widths are explicitly2.4m (steps2.3m), identical bounded display estimates to existing U sources. Width-radius round path endcaps are estimated, never surveyed edges. A .20m stair perimeter and .16m square Drawn factory-pole footing (Native at most four quarter-metre cells plus .02m clipping allowance) are tiny support estimates, never measured streets. Drawn lift .10m; independent Native quarter-metre cells use decimetre-quantized original DGM heights plus .10m.",
  }


def retain_dgm(source):
  queries = set()
  for record in source["records"]:
    if record["status"] != "source-ground":
      continue
    p = shape(record["ground"])
    x0, z0, x1, z1 = p.bounds
    for z in range(math.floor(z0) - 2, math.ceil(z1) + 3):
      for x in range(math.floor(x0) - 2, math.ceil(x1) + 3):
        if p.distance(Point(x + 0.5, z + 0.5)) < 2:
          queries.add((x + 389500, 5819999 - z))
  tiles = defaultdict(set)
  for x, n in queries:
    tiles[math.floor(x / 2000) * 2, math.floor(n / 2000) * 2].add((x, n))
  cache = {p.name: p for p in (GEO / "raw").rglob("DGM1_*.zip")}
  points, pins = [], []
  for (a, b), coords in sorted(tiles.items()):
    name = f"DGM1_{a}_{b}.zip"
    if name not in cache:
      raise ValueError("Missing required official tile " + name)
    path = cache[name]
    cached = RAW / (name + ".samples.json")
    wanted = sorted(coords)
    previous = read(cached) if cached.exists() else {}
    previous_points = {(p[0], p[1]): p for p in previous.get("points", [])}
    if all(p in previous_points for p in wanted) and previous.get("sha256") == digest(
      path
    ):
      member, selected = previous["member"], [previous_points[p] for p in wanted]
    else:
      with zipfile.ZipFile(path) as archive:
        member = next(n for n in archive.namelist() if n.endswith(".xyz"))
        xyz = np.loadtxt(archive.open(member), dtype=np.float32)
      # Boundary tiles have absent rows outside Berlin's 250 m source buffer.
      # Locate the exact retained XY cell centres; never reshape or fill holes.
      codes = (xyz[:, 1] - 0.5 - b * 1000).astype(np.int32) * 2000 + (
        xyz[:, 0] - 0.5 - a * 1000
      ).astype(np.int32)
      wanted_codes = np.array([(n - b * 1000) * 2000 + x - a * 1000 for x, n in wanted])
      indices = np.searchsorted(codes, wanted_codes)
      if np.any(indices >= len(codes)) or np.any(codes[indices] != wanted_codes):
        raise ValueError(
          "No original DGM1 support at a required approach cell in " + name
        )
      selected = [
        [x, n, round(float(xyz[int(i), 2]) * 100)] for (x, n), i in zip(wanted, indices)
      ]
      write(
        cached,
        {
          "queries": wanted,
          "sha256": digest(path),
          "member": member,
          "points": selected,
        },
      )
    points.extend(selected)
    pins.append(
      {
        "url": "https://gdi.berlin.de/data/dgm1/atom/" + name,
        "sha256": digest(path),
        "member": member,
      }
    )
    print("DGM", name, len(coords), flush=True)
  source["dgmOriginalCheckpoints"] = points
  source["dgmOriginalTiles"] = pins
  source["references"] = [
    {
      "title": "Official ATKIS DGM1 specification, 1 m raster / DHHN2016",
      "url": "https://gdi.berlin.de/data/dgm1/docs/dgm1.pdf",
      "license": "dl-de/zero-2-0",
    },
    {
      "title": "Official DGM1 download and metadata",
      "url": "https://gdi.berlin.de/geonetwork/geonetwork/api/records/fa02f9e1-a0df-3be1-b0aa-bc624c0c7ff5",
      "license": "dl-de/zero-2-0",
    },
    {
      "title": "Retained exact OpenStreetMap source, 2026-09-29",
      "url": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "license": "ODbL-1.0",
    },
  ]


def field_sampler(points):
  values = {(x, n): cm / 100 - 30 for x, n, cm in points}

  def height(x, z, native=False):
    e, n = x + 389500, 5820000 - z
    i, j = math.floor(e - 0.5), math.floor(n - 0.5)
    u, v = e - 0.5 - i, n - 0.5 - j
    if native:
      y = values.get((math.floor(e), math.floor(n)))
      if y is None:
        raise ValueError("Native point has no original DGM cell " + str((x, z)))
      return round(y * 10) / 10 + 0.1
    keys = [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)]
    if any(k not in values for k in keys):
      raise ValueError(
        "Drawn point lacks complete original DGM interpolation " + str((x, z))
      )
    a, b, c, d = [values[k] for k in keys]
    return (
      a + (b - a) * u + (c - a) * v
      if u + v <= 1
      else d + (c - d) * (1 - u) + (b - d) * (1 - v)
    ) + 0.1

  return height


def build_packets(source):
  height = field_sampler(source["dgmOriginalCheckpoints"])
  supported = [r for r in source["records"] if r["status"] == "source-ground"]
  scope = unary_union([shape(r["ground"]) for r in supported])
  tiles = defaultdict(list)
  for r in supported:
    p = shape(r["ground"])
    x0, z0, x1, z1 = p.bounds
    for tz in range(math.floor(z0 / 512), math.floor(z1 / 512) + 1):
      for tx in range(math.floor(x0 / 512), math.floor(x1 / 512) + 1):
        tiles[tx, tz].append(r)
  descriptors, native_domain = [], []
  counts = {"drawnTriangles": 0, "nativeCells": 0}
  for (tx, tz), records in sorted(tiles.items()):
    tile = box(tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
    ground = scope.intersection(tile)
    if ground.area < 0.001:
      continue
    key = f"{PUBLIC_NAMESPACE}{tx}_{tz}"
    descriptor = {"id": key, "bounds": list(tile.bounds), "buildingCount": 0}
    for native in [False, True]:
      mesh = PackedMesh(tx * 512, tz * 512)
      actual_ground = ground
      if native:
        cells = []
        x0, z0, x1, z1 = ground.bounds
        for iz in range(math.floor(z0 * 4), math.ceil(z1 * 4)):
          for ix in range(math.floor(x0 * 4), math.ceil(x1 * 4)):
            x, z = ix / 4, iz / 4
            cell = box(x, z, x + 0.25, z + 0.25)
            if not ground.covers(cell):
              continue
            cells.append(cell)
            mesh.surface(cell, height(x + 0.125, z + 0.125, True), (196, 195, 183))
        actual_ground = unary_union(cells)
        native_domain.append(actual_ground)
        counts["nativeCells"] += len(cells)
      else:
        # Each source-clipped one-metre patch has its own original DGM
        # interpolation. Every courtyard/hole and old boundary remains empty.
        x0, z0, x1, z1 = ground.bounds
        for iz in range(math.floor(z0 - 0.5), math.ceil(z1 - 0.5)):
          for ix in range(math.floor(x0 - 0.5), math.ceil(x1 - 0.5)):
            x, z = ix + 0.5, iz + 0.5
            for plane in [
              Polygon([(x, z), (x, z + 1), (x + 1, z + 1)]),
              Polygon([(x, z), (x + 1, z + 1), (x + 1, z)]),
            ]:
              local = ground.intersection(plane)
              for poly in polygons_from_geometry(local):
                for tri in constrained_delaunay_triangles(poly).geoms:
                  pp = [(x, height(x, z), z) for x, z in list(tri.exterior.coords)[:3]]
                  a, b, c = pp
                  if (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) > 0:
                    pp.reverse()
                  mesh.triangle(pp, (205, 201, 188))
      part = mesh.payload("source-ground-approach")
      if not part:
        raise ValueError("Empty independently represented ground mode")
      if not native:
        counts["drawnTriangles"] += len(mesh.indices) // 3
      y = height(
        ground.representative_point().x, ground.representative_point().y, native
      )
      packet = {
        "schemaVersion": 1,
        "id": key,
        "origin": [tx * 512, -10, tz * 512],
        "meshes": [part],
        "nav": {
          "ground": navigation_polygons(actual_ground, tx * 512, tz * 512),
          "water": [],
          "roads": navigation_polygons(actual_ground, tx * 512, tz * 512),
          "buildings": [],
          "groundY": y,
        },
      }
      mode = "minecraft" if native else "drawn"
      path = PUBLIC / f"{key}.{mode}.json.gz"
      write(path, packet)
      descriptor[mode] = {
        "url": path.name,
        "bytes": path.stat().st_size,
        "decodedBytes": len(gzip.decompress(path.read_bytes())),
        "encoding": "gzip",
        "sha256": digest(path),
      }
    descriptors.append(descriptor)
    print("packet", key, round(ground.area, 2), flush=True)
  ledger = []
  nd = unary_union(native_domain)
  for record in source["records"]:
    entry = record["entry"]
    p = Point(entry["point"])
    inside = record["status"] == "source-ground"
    ledger.append(
      {
        "id": entry["id"],
        "station": entry["station"],
        "key": entry["key"],
        "status": record["status"],
        "reason": record["reason"],
        "hasSourceStair": bool(entry["stair"]),
        "drawnPoint": inside,
        "nativePoint": inside and nd.covers(p),
        "newAreaM2": record["newGroundAreaM2"],
        "widths": record["widths"],
      }
    )
  return {
    "schemaVersion": 1,
    "chunks": descriptors,
    "footprint": navigation_polygons(scope, 0, 0),
    "nativeFootprint": navigation_polygons(nd, 0, 0),
    "terrainSamples": source["dgmOriginalCheckpoints"],
    "entries": ledger,
    "counts": counts,
    "sourceSha256": digest(SOURCE),
    "exclusionPins": source["exclusionPins"],
    "references": source["references"],
    "estimates": source["estimates"],
  }


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--audit", type=Path)
  parser.add_argument("--reuse-context", action="store_true")
  parser.add_argument("--from-source", action="store_true")
  args = parser.parse_args()
  RAW.mkdir(exist_ok=True)
  if args.from_source:
    source = read(SOURCE)
    if any(digest(ROOT / p) != h for p, h in source["exclusionPins"].items()):
      raise ValueError("Changed exact prior source scope")
  else:
    if not args.audit:
      raise ValueError("A complete original 157-access audit is required")
    source = prepare(args.audit, args.reuse_context)
    retain_dgm(source)
    write(SOURCE, source)
  index = build_packets(source)
  write(INDEX, index)
  referenced = {
    d[mode]["url"] for d in index["chunks"] for mode in ["drawn", "minecraft"]
  }
  for path in PUBLIC.glob(PUBLIC_NAMESPACE + "*.json.gz"):
    if path.name not in referenced:
      path.unlink()  # Only obsolete new derivatives owned by this compiler.
  print(
    "DONE",
    len(index["chunks"]),
    "packets",
    "new area",
    round(sum(polygon_area(p) for p in index["footprint"]), 2),
    "status",
    {
      s: sum(e["status"] == s for e in index["entries"])
      for s in {e["status"] for e in index["entries"]}
    },
    flush=True,
  )


def polygon_area(p):
  return Polygon(p["ring"], p.get("holes", [])).area


if __name__ == "__main__":
  main()
