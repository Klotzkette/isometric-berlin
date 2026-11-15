"""Add the exact previously absent Kladow domain and its present Gatow airfield.

This produces an independent supplement. It never edits the shared manifest or
any previous packet. Official roof sheets are retained; Native is independently
constructed from measured roof levels on the existing two-metre outer-city grid.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.errors import GEOSException
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_surrounding_outlines as outer
from build_bebelplatz_building_source import part_profile
from build_karl_marx_allee_v161 import Detail, clip_polygon, packed_detail
from build_rixdorf_v304 import merge_caps
from build_scheunenviertel_v168 import merge_native_faces

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/kladow-v346"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
SOURCE = GEO / "kladow-airfield-v346-source-index.json"
SOURCE_PART_LIMIT = 2 * 1024**2
PREFIX = "kladow346-"
BASELINE = "daa0c5e3"


def baseline_manifest():
  path = (PUBLIC / "manifest.json").relative_to(ROOT)
  raw = subprocess.check_output(["git", "show", f"{BASELINE}:{path}"], cwd=ROOT)
  return json.loads(raw), hashlib.sha256(raw).hexdigest()


def triangles_for(rings):
  """Triangulate measured sheets, including source slivers rejected by GEOS."""
  normal = sum(
    (np.cross(a, b) for a, b in zip(rings[0], rings[0][1:] + rings[0][:1])), np.zeros(3)
  )
  if np.linalg.norm(normal) < 1e-8:
    return []  # Collinear source sheets have no renderable area.
  axis = int(np.argmax(np.abs(normal)))
  axes = [i for i in range(3) if i != axis]
  points = [[tuple(p[i] for i in axes) for p in ring] for ring in rings]
  polygon = shapely.make_valid(Polygon(points[0], points[1:]))
  lookup = {q: p for ring, pp in zip(rings, points) for p, q in zip(ring, pp)}
  result = []
  for part in outer.polygons_from_geometry(polygon):
    try:
      triangles = list(shapely.constrained_delaunay_triangles(part).geoms)
    except GEOSException:
      triangles = outer.earcut_fallback(part)
    for triangle in triangles:
      p3 = []
      for point in list(triangle.exterior.coords)[:3]:
        if point in lookup:
          p3.append(lookup[point])
        else:
          p = list(rings[0][0])
          for i, q in zip(axes, point):
            p[i] = q
          p[axis] -= (
            sum(normal[i] * (p[i] - rings[0][0][i]) for i in axes) / normal[axis]
          )
          p3.append(p)
      if (
        np.dot(np.cross(np.subtract(p3[1], p3[0]), np.subtract(p3[2], p3[0])), normal)
        < 0
      ):
        p3.reverse()
      result.append(p3)
  return result


def json_bytes(value):
  return (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()


def write(path, value):
  raw = json_bytes(value)
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)
  return raw


def read(path):
  b = path.read_bytes()
  value = json.loads(gzip.decompress(b) if path.suffix == ".gz" else b)
  if not isinstance(value, dict) or value.get("format") != "split-kladow-source-v346":
    return value
  return read_source_parts(path, value)


def read_source_parts(path, index):
  """Reassemble checked audit JSON; no source coordinate or record is changed."""
  fields = {}
  for descriptor in index["parts"]:
    relative = Path(descriptor["file"])
    if relative.is_absolute() or ".." in relative.parts:
      raise ValueError("Source part escaped its audit directory")
    packed = (path.parent / relative).read_bytes()
    if (
      len(packed) != descriptor["bytes"]
      or hashlib.sha256(packed).hexdigest() != descriptor["sha256"]
    ):
      raise ValueError("Changed Kladow source part")
    raw = gzip.decompress(packed)
    if (
      len(raw) != descriptor["decodedBytes"]
      or hashlib.sha256(raw).hexdigest() != descriptor["decodedSha256"]
    ):
      raise ValueError("Incomplete Kladow source part")
    part = json.loads(raw)
    if descriptor["field"] == "metadata":
      if fields or part["field"] != "metadata":
        raise ValueError("Duplicate or misplaced Kladow metadata")
      fields.update(part["value"])
    else:
      field = descriptor["field"]
      rows = fields.setdefault(field, [])
      if (
        part["field"] != field
        or len(rows) != descriptor["start"]
        or part["start"] != descriptor["start"]
        or len(part["items"]) != descriptor["count"]
      ):
        raise ValueError("Missing, repeated or reordered Kladow records")
      rows.extend(part["items"])
  result = {key: fields[key] for key in index["keyOrder"]}
  raw = json_bytes(result)
  if (
    len(raw) != index["decodedBytes"]
    or hashlib.sha256(raw).hexdigest() != index["decodedSha256"]
  ):
    raise ValueError("Reassembled Kladow source differs from the frozen original")
  return result


def write_source_parts(source, path=SOURCE):
  """Independent valid JSON shards remain well below the repository binary cap."""
  original = json_bytes(source)
  parts = []
  folder = path.parent / "kladow-airfield-v346-source-parts"
  folder.mkdir(parents=True, exist_ok=True)

  def emit(value, field, start=0, count=0):
    raw = json_bytes(value)
    if len(raw) > SOURCE_PART_LIMIT:
      raise ValueError("An audit source part exceeds its fixed two-MiB limit")
    packed = gzip.compress(raw, mtime=0)
    filename = folder / f"part-{len(parts):03}.json.gz"
    filename.write_bytes(packed)
    parts.append(
      dict(
        file=str(filename.relative_to(path.parent)),
        field=field,
        start=start,
        count=count,
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
        decodedSha256=hashlib.sha256(raw).hexdigest(),
      )
    )

  emit(
    dict(
      field="metadata",
      value={k: v for k, v in source.items() if k not in {"parents", "records"}},
    ),
    "metadata",
  )
  for field in ("parents", "records"):
    start, rows, size = 0, [], 128
    for record in source[field]:
      length = len(json_bytes(record))
      if rows and size + length > SOURCE_PART_LIMIT:
        emit(dict(field=field, start=start, items=rows), field, start, len(rows))
        start += len(rows)
        rows, size = [], 128
      rows.append(record)
      size += length
    emit(dict(field=field, start=start, items=rows), field, start, len(rows))
  index = dict(
    schemaVersion=1,
    format="split-kladow-source-v346",
    keyOrder=list(source),
    decodedBytes=len(original),
    decodedSha256=hashlib.sha256(original).hexdigest(),
    parts=parts,
  )
  write(path, index)
  if json_bytes(read(path)) != original:
    raise ValueError("Audit sharding was not byte-lossless after reassembly")
  retained = {path.parent / p["file"] for p in parts}
  for stale in folder.glob("part-*.json.gz"):
    if stale not in retained:
      stale.unlink()
  return index


def digest(path):
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare():
  """Freeze exact current source geometry, retaining all existing area owners."""
  RAW.mkdir(parents=True, exist_ok=True)
  boundary = pyogrio.read_dataframe(
    PBF, layer="multipolygons", where="name = 'Kladow' AND admin_level = '10'"
  ).to_crs(25833)
  if len(boundary) != 1 or str(boundary.iloc[0].osm_id) != "409216":
    raise ValueError("Expected the exact Kladow Ortsteil relation 409216")
  extent = shapely.make_valid(boundary.geometry.iloc[0])
  manifest, manifest_sha = baseline_manifest()
  retained = unary_union(
    [
      shapely.make_valid(Polygon(q["ring"], q.get("holes", [])))
      for q in manifest["footprint"]
    ]
  )
  scope = outer.world(extent).difference(retained)
  projected = affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  write(RAW / "scope.json", mapping(scope))
  archives = {}
  for path in (GEO / "raw").rglob("LoD2_*.zip"):
    archives.setdefault(path.name, path)
  minx, miny, maxx, maxy = projected.bounds
  selected_archives = []
  for ix in range(math.floor(minx / 1000), math.ceil(maxx / 1000)):
    for iy in range(math.floor(miny / 1000), math.ceil(maxy / 1000)):
      if (
        projected.intersection(
          box(ix * 1000, iy * 1000, (ix + 1) * 1000, (iy + 1) * 1000)
        ).area
        < 1
      ):
        continue
      name = f"LoD2_{ix}_{iy}.zip"
      path = archives.get(name, RAW / name)
      if not path.exists():
        print("Fetch", name, flush=True)
        urllib.request.urlretrieve(
          "https://gdi.berlin.de/data/a_lod2/atom/" + name, path
        )
      selected_archives.append(path)
  parents, seen, failed, sources = [], set(), [], []
  for path in selected_archives:
    kept = 0
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with archive.open(member) as stream:
          for _, el in ET.iterparse(stream, events=("end",)):
            if el.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = el.get(GML_ID)
            footprint = building_footprint(el)
            if (
              identity in seen
              or footprint is None
              or not footprint.intersects(projected)
            ):
              el.clear()
              continue
            try:
              parts = [part_profile(p) for p in leaf_building_parts(el) or [el]]
              parents.append(dict(id=identity, parts=parts, archive=path.name))
              seen.add(identity)
              kept += 1
            except ValueError as error:
              failed.append(dict(id=identity, reason=str(error), archive=path.name))
            el.clear()
    sources.append(
      dict(
        name=path.name,
        sha256=digest(path),
        parents=kept,
        url="https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
      )
    )
    print(path.name, kept, "complete families", flush=True)
  cache = RAW / "candidate.gpkg"
  if not cache.exists():
    geographic = transform(
      Transformer.from_crs(25833, 4326, always_xy=True).transform, extent
    )
    for layer in ("lines", "multipolygons"):
      frame = pyogrio.read_dataframe(PBF, layer=layer, bbox=geographic.bounds)
      frame.to_file(cache, layer=layer)
  records = []
  for layer in ("lines", "multipolygons"):
    frame = pyogrio.read_dataframe(cache, layer=layer).to_crs(25833)
    for row in frame.to_dict("records"):
      geometry = shapely.make_valid(row["geometry"])
      if geometry.intersects(projected):
        tags = {
          k: v
          for k, v in outer.tags_for(row).items()
          if v is not None and not (isinstance(v, float) and math.isnan(v))
        }
        identity = (
          f"OSM-way-{row['osm_id']}" if layer == "lines" else outer.source_identity(row)
        )
        records.append(
          dict(
            id=identity, layer=layer, tags=tags, geometry=mapping(outer.world(geometry))
          )
        )
  result = dict(
    schemaVersion=1,
    baseline=BASELINE,
    scope=mapping(scope),
    boundary=mapping(outer.world(extent)),
    retainedFootprintSha256=manifest_sha,
    scopeM2=scope.area,
    relation=409216,
    parents=parents,
    failures=failed,
    records=records,
    sources=dict(
      lod2=sources,
      osm=dict(
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        sha256=digest(PBF),
        timestamp="2026-11-13T21:22:20Z",
        license="ODbL-1.0",
      ),
    ),
    policy="Exact current Kladow Ortsteil minus every retained public ground footprint; additive only. All official leaf-part wall and roof sheets retained in Drawn. Independent two-metre Native columns sample the measured roof planes and retain mapped holes. Complete families share the established flat outer-city y=3 ground datum; material and missing OSM height/width estimates are explicit. Current disused runway/apron geometry only; no former full runway across present Landstadt Gatow housing. No runtime network source, photograph or geodata archive shipped.",
  )
  write_source_parts(result)
  print(
    "SOURCE",
    len(parents),
    "families",
    len(records),
    "OSM records",
    len(failed),
    "unavailable profiles",
    flush=True,
  )
  return result


def clip_scope(triangle, scope):
  """Clip arbitrary measured roof/wall faces without changing their planes."""
  xz = Polygon([(p[0], p[2]) for p in triangle])
  if xz.area > 1e-8:
    if scope.covers(xz):
      return [triangle]
    normal = np.cross(
      np.subtract(triangle[1], triangle[0]), np.subtract(triangle[2], triangle[0])
    )
    result = []
    for polygon in outer.polygons_from_geometry(
      shapely.make_valid(xz).intersection(scope)
    ):
      for t in shapely.constrained_delaunay_triangles(polygon).geoms:
        points = [
          [
            x,
            triangle[0][1]
            - (normal[0] * (x - triangle[0][0]) + normal[2] * (z - triangle[0][2]))
            / normal[1],
            z,
          ]
          for x, z in list(t.exterior.coords)[:3]
        ]
        if (
          np.dot(
            np.cross(
              np.subtract(points[1], points[0]), np.subtract(points[2], points[0])
            ),
            normal,
          )
          < 0
        ):
          points.reverse()
        result.append(points)
    return result
  a, b = max(
    ((a, b) for a in triangle for b in triangle),
    key=lambda pair: math.hypot(pair[0][0] - pair[1][0], pair[0][2] - pair[1][2]),
  )
  line = LineString([(a[0], a[2]), (b[0], b[2])])
  if scope.covers(line):
    return [triangle]
  axis = 0 if abs(a[0] - b[0]) >= abs(a[2] - b[2]) else 2
  result = []
  for segment in outer.line_parts(line.intersection(scope)):
    values = [p[0 if axis == 0 else 1] for p in segment.coords]
    points = clip_polygon(triangle, axis, min(values), True)
    points = clip_polygon(points, axis, max(values), False)
    result.extend(
      [points[0], points[i], points[i + 1]] for i in range(1, len(points) - 1)
    )
  return result


def roof_height(triangle, x, z):
  a, b, c = np.array(triangle)
  n = np.cross(b - a, c - a)
  return a[1] - (n[0] * (x - a[0]) + n[2] * (z - a[2])) / n[1]


def native_columns(parent, scope):
  """Independent cardinal massing from every official part's measured roof."""
  cells, caps = {}, {}
  low = min(p["ground_y_m"] for p in parent["parts"])
  for part in parent["parts"]:
    footprint = shapely.make_valid(Polygon(part["ring"], part["holes"]))
    minx, minz, maxx, maxz = footprint.bounds
    xs, zs = np.meshgrid(
      np.arange(math.floor(minx / 2), math.ceil(maxx / 2)) * 2 + 1,
      np.arange(math.floor(minz / 2), math.ceil(maxz / 2)) * 2 + 1,
    )
    inside = shapely.intersects_xy(footprint, xs, zs)
    xx, zz = xs[inside], zs[inside]
    tops = np.full(len(xx), -np.inf)
    pitched = False
    for surface in part["surfaces"]:
      if surface["kind"] != "RoofSurface":
        continue
      for triangle in triangles_for(surface["rings"]):
        area = Polygon([(p[0], p[2]) for p in triangle])
        if area.area < 1e-9:
          continue
        covered = shapely.intersects_xy(area, xx, zz)
        tops[covered] = np.maximum(
          tops[covered], roof_height(triangle, xx[covered], zz[covered]) - low
        )
        pitched |= max(p[1] for p in triangle) - min(p[1] for p in triangle) > 0.3
    wall = (213, 207, 192)
    roof = (132, 91, 72) if pitched else (110, 117, 113)
    bottom = max(0, math.floor((part["ground_y_m"] - low) / 2))
    for x, z, top in zip(xx, zz, tops):
      if not np.isfinite(top):
        # Only an official roof with non-zero projected area admits a column.
        continue
      ix, iz = int((x - 1) / 2), int((z - 1) / 2)
      if not scope.covers(box(ix * 2, iz * 2, ix * 2 + 2, iz * 2 + 2)):
        continue
      ceiling = max(bottom + 1, math.ceil(top / 2))
      for iy in range(bottom, ceiling):
        cells[(ix, iy, iz)] = (wall, roof)
      caps[(ix, iz)] = max(caps.get((ix, iz), 0), ceiling * 2)
  out = Detail()
  for (ix, iy, iz), (wall, roof) in cells.items():
    x, y, z = ix * 2, 3 + iy * 2, iz * 2
    faces = [
      ((-1, 0, 0), [[x, y, z], [x, y, z + 2], [x, y + 2, z + 2], [x, y + 2, z]], wall),
      (
        (1, 0, 0),
        [[x + 2, y, z + 2], [x + 2, y, z], [x + 2, y + 2, z], [x + 2, y + 2, z + 2]],
        wall,
      ),
      ((0, -1, 0), [[x, y, z + 2], [x, y, z], [x + 2, y, z], [x + 2, y, z + 2]], wall),
      (
        (0, 1, 0),
        [[x, y + 2, z], [x, y + 2, z + 2], [x + 2, y + 2, z + 2], [x + 2, y + 2, z]],
        roof,
      ),
      ((0, 0, -1), [[x + 2, y, z], [x, y, z], [x, y + 2, z], [x + 2, y + 2, z]], wall),
      (
        (0, 0, 1),
        [[x, y, z + 2], [x + 2, y, z + 2], [x + 2, y + 2, z + 2], [x, y + 2, z + 2]],
        wall,
      ),
    ]
    for delta, points, color in faces:
      if (ix + delta[0], iy + delta[1], iz + delta[2]) not in cells:
        out.polygon(points, color, "independent measured-roof cardinal surface")
  # The existing exact cap merger also works at two metres after normalization.
  merged = merge_caps([[x, z, x + 1, z + 1, height] for (x, z), height in caps.items()])
  return merge_native_faces(out), [
    [x0 * 2, z0 * 2, x1 * 2, z1 * 2, height] for x0, z0, x1, z1, height in merged
  ]


def drawn_model(parent, scope):
  out = Detail()
  low = min(p["ground_y_m"] for p in parent["parts"])
  roofs = []
  for part in parent["parts"]:
    for surface in part["surfaces"]:
      rings = [[[x, y - low + 3, z] for x, y, z in ring] for ring in surface["rings"]]
      pitched = (
        surface["kind"] == "RoofSurface"
        and max(p[1] for r in rings for p in r) - min(p[1] for r in rings for p in r)
        > 0.3
      )
      color = (
        ((132, 91, 72) if pitched else (110, 117, 113))
        if surface["kind"] == "RoofSurface"
        else (213, 207, 192)
      )
      for triangle in triangles_for(rings):
        for clipped in clip_scope(triangle, scope):
          out.triangles.append((clipped, color, "official " + surface["kind"]))
          if surface["kind"] == "RoofSurface":
            roofs.append([[x, y - 3, z] for x, y, z in clipped])
  return out, roofs


def resolved(source):
  scope = shape(source["scope"])
  projected = affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  official = []
  for p in source["parents"]:
    footprint = unary_union(
      [shapely.make_valid(Polygon(q["ring"], q["holes"])) for q in p["parts"]]
    ).intersection(scope)
    if footprint.area < 0.01:
      continue
    official.append(
      dict(
        sourceId=p["id"],
        geometry=affine_transform(footprint, [1, 0, 0, -1, 389500, 5820000]),
        height=max(q["top_y_m"] for q in p["parts"])
        - min(q["ground_y_m"] for q in p["parts"]),
        minHeight=0.0,
        heightSource="Complete official LoD2 leaf-part sheets",
      )
    )
  lines = pyogrio.read_dataframe(RAW / "candidate.gpkg", layer="lines").to_crs(25833)
  areas = pyogrio.read_dataframe(RAW / "candidate.gpkg", layer="multipolygons").to_crs(
    25833
  )
  buildings, layers, inventory = outer.collect_sources(
    lines, areas, projected, official
  )
  for b in buildings:
    b["geometry"] = outer.world(b["geometry"])
  surfaces = {k: outer.world(unary_union(v)) for k, v in layers.items()}
  airfield = []
  for r in source["records"]:
    t, geometry = r["tags"], shape(r["geometry"])
    kind = t.get("aeroway") or t.get("disused:aeroway") or t.get("abandoned:aeroway")
    if kind not in {"runway", "taxiway", "apron", "helipad"}:
      continue
    width = None
    if r["layer"] == "lines":
      width = float(t.get("width", 12 if kind == "taxiway" else 46))
      geometry = geometry.buffer(width / 2, cap_style="flat", join_style="round")
    geometry = geometry.intersection(scope)
    if geometry.area:
      airfield.append(
        dict(
          id=r["id"].replace("OSM-relation-", "OSM-way-")
          if r["layer"] == "lines"
          else r["id"],
          kind=kind,
          geometry=mapping(geometry),
          width=width,
          widthSource="OSM width"
          if "width" in t
          else "display estimate"
          if width
          else "mapped area",
        )
      )
  occupied = unary_union([b["geometry"] for b in buildings])
  water = surfaces.get("water", Polygon())
  surfaces["road"] = unary_union(
    [surfaces.get("road", Polygon()), *[shape(q["geometry"]) for q in airfield]]
  )
  for kind in ("road", "path", "rail"):
    surfaces[kind] = (
      surfaces.get(kind, Polygon())
      .difference(occupied)
      .difference(water.difference(surfaces.get("bridge", Polygon())))
    )
  surfaces["park"] = surfaces.get("park", Polygon()).difference(water)
  return buildings, surfaces, airfield, inventory


def packed_split(payload):
  """Bound wire/decode size while retaining every face and primary navigation."""

  def pack(p):
    raw = (json.dumps(p, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
    return raw, gzip.compress(raw, mtime=0)

  pair = pack(payload)
  if len(pair[0]) <= 2_600_000 and len(pair[1]) <= 650_000:
    return [pair]
  metadata = {k: v for k, v in payload.items() if k != "meshes"}
  empty = dict(
    schemaVersion=1,
    origin=payload["origin"],
    nav=dict(ground=[], water=[], buildings=[], groundY=3),
  )
  if len(pack({**metadata, "meshes": []})[0]) > 2_000_000:
    raise ValueError("Primary navigation exceeds packet budget")
  result = []
  for mesh in payload["meshes"]:
    positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    )
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )

    def emit(rows, header):
      ids, mapped = np.unique(rows, return_inverse=True)
      m = {
        **mesh,
        "positions": outer.encode(positions[ids]),
        "colors": outer.encode(colors[ids]),
        "indices": outer.encode(mapped.astype("<u4")),
      }
      trial = pack({**header, "meshes": [m]})
      if len(trial[0]) <= 2_600_000 and len(trial[1]) <= 650_000:
        return [trial]
      if len(rows) < 2:
        raise ValueError("Cannot split packet metadata")
      middle = len(rows) // 2
      return emit(rows[:middle], header) + emit(rows[middle:], empty)

    result.extend(emit(indices, metadata if not result else empty))
  return result


def build(output):
  source = read(SOURCE)
  # GEOS cannot overlay an untyped empty collection against a complex scope;
  # an empty polygon has identical area and the required surface dimension.
  native_polygon = outer.native_polygon

  def typed_native(geometry):
    result = native_polygon(geometry)
    return Polygon() if result.is_empty else result

  outer.native_polygon = typed_native
  scope = shape(source["scope"])
  buildings, surfaces, airfield, inventory = resolved(source)
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  parents = {p["id"]: p for p in source["parents"]}
  output.mkdir(parents=True, exist_ok=True)
  checkpoint = output / "build-input.json"
  identity = dict(sourceSha256=digest(SOURCE), compilerRevision=1)
  if checkpoint.exists() and read(checkpoint) != identity:
    raise ValueError(
      "Staged packets belong to a different source/compiler; use a fresh output directory"
    )
  write(checkpoint, identity)
  descriptors, stats = [], defaultdict(int)
  minx, minz, maxx, maxz = scope.bounds
  for ix in range(math.floor(minx / 512), math.ceil(maxx / 512)):
    for iz in range(math.floor(minz / 512), math.ceil(maxz / 512)):
      tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
      ground = scope.intersection(tile)
      if ground.area < 0.01:
        continue
      selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
      local = {
        kind: outer.polygonal(shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds)))
        for kind, g in surfaces.items()
      }
      name = f"{PREFIX}{ix}_{iz}"
      # Completed packet pairs are immutable staging checkpoints. A process
      # interrupted during a later tile can resume without redoing 12k roofs.
      completed = sorted(output.glob(name + ".drawn.json.gz")) + sorted(
        output.glob(name + "-p*.drawn.json.gz")
      )
      if completed and all(
        p.with_name(p.name.replace(".drawn.", ".minecraft.")).exists()
        for p in completed
      ):
        for i, path in enumerate(completed):
          identity = path.name.removesuffix(".drawn.json.gz")
          d = dict(id=identity, bounds=list(tile.bounds))
          if i:
            d["detailCompanionOf"] = name
          for mode in ("drawn", "minecraft"):
            f = output / f"{identity}.{mode}.json.gz"
            packed = f.read_bytes()
            d[mode] = dict(
              url=f.name,
              bytes=len(packed),
              decodedBytes=len(gzip.decompress(packed)),
              encoding="gzip",
              sha256=hashlib.sha256(packed).hexdigest(),
            )
          descriptors.append(d)
        print(name, "retained staged pair", flush=True)
        continue
      families = {}
      for native in (False, True):
        mode = "minecraft" if native else "drawn"
        visible = [
          r
          for r in selected
          if not native
          or r["sourceId"] in parents
          or not outer.native_polygon(
            outer.polygonal(r["geometry"].intersection(tile))
          ).is_empty
        ]
        payload = outer.chunk_payload(
          name,
          tile,
          ground,
          visible,
          local,
          minecraft=native,
          replaced_source_ids=frozenset(parents),
        )
        detail = Detail()
        for record in selected:
          parent = parents.get(record["sourceId"])
          if not parent:
            continue
          low = min(p["ground_y_m"] for p in parent["parts"])
          if native:
            model, caps = native_columns(parent, scope)
            admitted = [c for c in caps if box(*c[:4]).intersects(tile)]
            footprint = unary_union([box(*c[:4]) for c in admitted]).intersection(tile)
            nav = outer.navigation_polygons(footprint, tile.bounds[0], tile.bounds[1])
            for n in nav:
              n.update(
                sourceId=parent["id"],
                height=max((c[4] for c in admitted), default=0),
                minHeight=0,
                nativeRoofCaps=[
                  [
                    max(c[0], tile.bounds[0]) - tile.bounds[0],
                    max(c[1], tile.bounds[1]) - tile.bounds[1],
                    min(c[2], tile.bounds[2]) - tile.bounds[0],
                    min(c[3], tile.bounds[3]) - tile.bounds[1],
                    c[4],
                  ]
                  for c in admitted
                  if box(*c[:4]).intersection(tile).area > 0
                ],
              )
          else:
            model, roofs = drawn_model(parent, scope)
            nav = []
            for part in parent["parts"]:
              footprint = shapely.make_valid(
                Polygon(part["ring"], part["holes"])
              ).intersection(ground)
              for n in outer.navigation_polygons(
                footprint, tile.bounds[0], tile.bounds[1]
              ):
                n.update(
                  sourceId=parent["id"],
                  partId=part["id"],
                  height=part["top_y_m"] - low,
                  minHeight=max(0, part["ground_y_m"] - low),
                  roofTriangles=[
                    [[x - tile.bounds[0], y, z - tile.bounds[1]] for x, y, z in t]
                    for t in roofs
                    if Polygon([(p[0], p[2]) for p in t]).intersects(footprint)
                  ],
                )
                nav.append(n)
          payload["nav"]["buildings"].extend(nav)
          detail.triangles.extend(model.triangles)
        mesh = packed_detail(detail, tile)
        if mesh:
          mesh["kind"] = "kladow-measured-buildings-v346"
          payload["meshes"].append(mesh)
        families[mode] = packed_split(payload)
      for i in range(max(map(len, families.values()))):
        identity = name if i == 0 else f"{name}-p{i}"
        d = dict(id=identity, bounds=list(tile.bounds))
        if i:
          d["detailCompanionOf"] = name
        for mode in ("drawn", "minecraft"):
          if i < len(families[mode]):
            raw, packed = families[mode][i]
          else:
            raw, packed = packed_split(
              dict(
                schemaVersion=1,
                origin=payload["origin"],
                meshes=[],
                nav=dict(ground=[], water=[], buildings=[], groundY=3),
              )
            )[0]
          filename = f"{identity}.{mode}.json.gz"
          (output / filename).write_bytes(packed)
          d[mode] = dict(
            url=filename,
            bytes=len(packed),
            decodedBytes=len(raw),
            encoding="gzip",
            sha256=hashlib.sha256(packed).hexdigest(),
          )
        descriptors.append(d)
      print(
        name,
        len(selected),
        "buildings",
        [len(v) for v in families.values()],
        flush=True,
      )
  for descriptor in descriptors:
    for mode in ("drawn", "minecraft"):
      packet = read(output / descriptor[mode]["url"])
      stats[mode + "Triangles"] += sum(
        len(base64.b64decode(m["indices"])) // 12 for m in packet["meshes"]
      )
      stats[mode + "BuildingRecords"] += len(packet["nav"]["buildings"])
  manifest = dict(
    schemaVersion=1,
    version="1.0.226",
    chunkSize=512,
    bounds=list(scope.bounds),
    footprint=outer.navigation_polygons(scope, 0, 0),
    groundY=3,
    waterY=outer.WATER_Y,
    chunks=descriptors,
    source=dict(
      **source["sources"],
      sourceSha256=digest(SOURCE),
      sourceFile=SOURCE.name,
      decodedSourceSha256=json.loads(SOURCE.read_bytes())["decodedSha256"],
      relation=409216,
      officialBuildingCount=len(source["parents"]),
      buildingCount=len(buildings),
      addedAreaM2=scope.area,
      policy=source["policy"],
    ),
  )
  source_index = json.loads(SOURCE.read_bytes())
  proof = dict(
    scopeM2=scope.area,
    families=len(source["parents"]),
    parts=sum(len(p["parts"]) for p in source["parents"]),
    sourceSheets=sum(len(q["surfaces"]) for p in source["parents"] for q in p["parts"]),
    unavailableProfiles=source["failures"],
    chunks=len(descriptors),
    packetBytes=sum(c[m]["bytes"] for c in descriptors for m in ("drawn", "minecraft")),
    maxPacketBytes=max(
      c[m]["bytes"] for c in descriptors for m in ("drawn", "minecraft")
    ),
    maxDecodedBytes=max(
      c[m]["decodedBytes"] for c in descriptors for m in ("drawn", "minecraft")
    ),
    airfield=airfield,
    stats=dict(stats),
    auditSource=dict(
      index=SOURCE.name,
      indexSha256=digest(SOURCE),
      decodedBytes=source_index["decodedBytes"],
      decodedSha256=source_index["decodedSha256"],
      priorCompressedSha256=hashlib.sha256(
        gzip.compress(json_bytes(source), mtime=0)
      ).hexdigest(),
      parts=len(source_index["parts"]),
      maxPartBytes=max(p["bytes"] for p in source_index["parts"]),
      maxDecodedPartBytes=max(p["decodedBytes"] for p in source_index["parts"]),
    ),
  )
  write(GEO / "kladow-airfield-v346-manifest.json", manifest)
  write(GEO / "kladow-airfield-v346-evidence.json.gz", proof)
  write(GEO / "kladow-airfield-v346-inventory.json.gz", inventory)
  print("RESULT", {k: v for k, v in proof.items() if k != "airfield"}, flush=True)
  return manifest


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--prepare", action="store_true")
  p.add_argument("--out", type=Path)
  args = p.parse_args()
  if args.prepare:
    prepare()
  if args.out:
    build(args.out)
