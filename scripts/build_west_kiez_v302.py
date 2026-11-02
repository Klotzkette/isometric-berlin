"""Step 10: exact West-Berlin fallback corrections and bounded facade packets.

All original assets are immutable inputs. Only this module's dedicated data,
evidence and reference files are written; root owns controller integration.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
import pyogrio
from shapely import Point, Polygon, box
from shapely.geometry import LineString, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh"
DATA = ROOT / "src/app/src/data"
CORE_SOURCE = GEO / "west-kiez-v302-core-source.json.gz"
CORE = DATA / "westKiezV302Core.json"
OWNERS = DATA / "westKiezV302CoreOwners.json"
NAVIGATION = DATA / "westKiezV302CoreNavigation.json"

# Each named house is resolved to its own retained address identity and actual
# complete official parent. These do not denote rectangular district selection.
CORE_ADDRESSES = {
  "Fasanenstraße": ["23", "24", "25"],
  "Bleibtreustraße": ["15", "16", "17", "40", "42"],
  "Schlüterstraße": ["45"],
  "Wielandstraße": ["5", "13"],
  "Knesebeckstraße": ["33/34", "68-69"],
  "Savignyplatz": ["3", "4", "13"],
}


def read(path: Path):
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def write(path: Path, value):
  data = (
    json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == ".gz" else data)


def digest(path: Path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def encode(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def linear(rgb):
  return [
    round(
      (v / 255 / 12.92 if v <= 10.31475 else ((v / 255 + 0.055) / 1.055) ** 2.4) * 255
    )
    for v in rgb
  ]


def addresses(selection=CORE_ADDRESSES):
  """Retain actual OSM tags, point/polygon identities and EPSG-frame geometry."""
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  result = []
  for layer in ["points", "multipolygons"]:
    frame = pyogrio.read_dataframe(
      pbf,
      layer=layer,
      bbox=(13.285, 52.475, 13.365, 52.518),
      where="other_tags LIKE '%addr:street%'",
    ).to_crs(25833)
    for row in frame.itertuples():
      tags = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(row.other_tags)))
      if (
        tags.get("addr:street") not in selection
        or tags.get("addr:housenumber") not in selection[tags["addr:street"]]
      ):
        continue
      point = row.geometry.representative_point()
      result.append(
        dict(
          element="way" if layer == "multipolygons" else "node",
          id=str(getattr(row, "osm_way_id", None) or row.osm_id),
          tags=tags,
          xz=[round(point.x - 389500, 3), round(5820000 - point.y, 3)],
          geometry=__import__("shapely").geometry.mapping(row.geometry),
        )
      )
  selected = []
  for street, numbers in selection.items():
    for number in numbers:
      found = [
        r
        for r in result
        if r["tags"]["addr:street"] == street
        and r["tags"]["addr:housenumber"] == number
      ]
      if not found:
        raise ValueError(f"Missing actual address {street} {number}")
      # Prefer a mapped building over a shop node carrying the same address.
      found.sort(
        key=lambda r: (
          r["element"] != "way",
          r["tags"].get("building") is None,
          r["tags"].get("shop") is not None,
          r["id"],
        )
      )
      selected.append(
        dict(address=f"{street} {number}", street=street, number=number, osm=found[0])
      )
  return selected


def extract_core_source():
  selected = addresses()
  tiles = sorted(
    {
      (
        math.floor((s["osm"]["xz"][0] + 389500) / 1000),
        math.floor((5820000 - s["osm"]["xz"][1]) / 1000),
      )
      for s in selected
    }
  )
  records = {}
  archives = []
  for tx, ty in tiles:
    path = GEO / f"raw/lod2/LoD2_{tx}_{ty}.zip"
    archives.append(
      dict(
        url=f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}", sha256=digest(path)
      )
    )
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.lower().endswith((".xml", ".gml", ".citygml")):
          continue
        with archive.open(name) as stream:
          for _, element in ET.iterparse(stream, events=["end"]):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(element)
            matches = (
              []
              if footprint is None
              else [
                s
                for s in selected
                if footprint.distance(
                  Point(s["osm"]["xz"][0] + 389500, 5820000 - s["osm"]["xz"][1])
                )
                <= 0.5
              ]
            )
            if matches:
              identity = element.get(GML_ID)
              if identity not in records:
                records[identity] = dict(
                  parent=identity,
                  tile=f"{tx}_{ty}",
                  addresses=[],
                  parts=[
                    part_profile(p)
                    for p in list(leaf_building_parts(element)) or [element]
                  ],
                )
              for match in matches:
                if match not in records[identity]["addresses"]:
                  records[identity]["addresses"].append(match)
            element.clear()
  actual = {a["address"] for r in records.values() for a in r["addresses"]}
  expected = {a["address"] for a in selected}
  if actual != expected:
    raise ValueError(f"Missing official full parents: {expected - actual}")
  original_path = PUBLIC / "regierungsviertel/lod2-prisms.json"
  original = read(original_path)["buildings"]
  polygons = [
    Polygon(
      [(x / 10, z / 10) for x, z in p["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
    )
    for p in original
  ]
  tree = STRtree(polygons)
  old_seen = set()
  for site in records.values():
    shape = unary_union([Polygon(p["ring"], p["holes"]) for p in site["parts"]])
    site["oldPrisms"] = []
    site["alignment"] = []
    for i in tree.query(shape):
      p, geometry = original[int(i)], polygons[int(i)]
      if not geometry.area:
        continue
      ratio = geometry.intersection(shape).area / geometry.area
      if ratio > 0.96:
        if p["id"] in old_seen:
          raise ValueError(
            "One coarse owner cannot transfer to two complete official families"
          )
        old_seen.add(p["id"])
        site["oldPrisms"].append(p)
        site["alignment"].append(
          dict(
            oldId=p["id"],
            overlapFraction=ratio,
            originalAreaM2=geometry.area,
            outsideAreaM2=geometry.difference(shape).area,
            outsideGeometry=__import__("shapely").geometry.mapping(
              geometry.difference(shape)
            ),
          )
        )
    if not site["oldPrisms"]:
      raise ValueError(f"No exact complete fallback at {site['addresses']}")
  source = dict(
    schemaVersion=1,
    frame="EPSG:25833; X=E-389500; Y=NHN-30; Z=5820000-N",
    geometryLicense="dl-de/zero-2-0",
    semanticsLicense="ODbL-1.0",
    archives=archives,
    originalPrismsSha256=digest(original_path),
    osmSourceSha256=digest(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
    sites=list(records.values()),
    policy="Complete exact false source-owner transfer; original coarse prisms and alignment differences retained as evidence, complete official walls/roofs/holes retained; no unrelated owner transfer",
  )
  write(CORE_SOURCE, source)
  return source


def native_sheets(parts, wall_rgb, roof_rgb):
  """Offline independent cardinal wall/roof sheets, no rotated native boxes.

  Columns retain each polygon's actual vertical section. Roof cells are
  clipped to each actual source triangle, so true courtyard holes stay open.
  """
  rows = []
  for part in parts:
    for surface in part["surfaces"]:
      if surface["kind"] == "WallSurface":
        points = np.array(surface["rings"][0])
        unique = list(dict.fromkeys((float(p[0]), float(p[2])) for p in points))
        if len(unique) < 2:
          continue
        a, b = max(
          ((a, b) for a in unique for b in unique), key=lambda pair: math.dist(*pair)
        )
        length = math.dist(a, b)
        if length < 0.01:
          continue
        dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        count = max(1, math.ceil(length / 0.8))
        for i in range(count):
          u = (i + 0.5) * length / count
          cross = []
          for p, q in zip(points, np.roll(points, -1, axis=0)):
            lo = (p[0] - a[0]) * dx + (p[2] - a[1]) * dz
            hi = (q[0] - a[0]) * dx + (q[2] - a[1]) * dz
            if abs(hi - lo) > 1e-8 and min(lo, hi) - 1e-7 <= u <= max(lo, hi) + 1e-7:
              cross.append(p[1] + (q[1] - p[1]) * (u - lo) / (hi - lo))
          if len(cross) < 2 or max(cross) - min(cross) < 0.005:
            continue
          rows.append(
            [
              a[0] + dx * u,
              (min(cross) + max(cross)) / 2,
              a[1] + dz * u,
              abs(dx) * length / count + 0.20,
              max(cross) - min(cross),
              abs(dz) * length / count + 0.20,
              wall_rgb,
            ]
          )
      else:
        for triangle in triangles_for(surface["rings"]):
          points = np.array(triangle)
          polygon = Polygon(points[:, [0, 2]])
          if polygon.area < 1e-7:
            continue
          coefficients = np.linalg.solve(
            np.column_stack((points[:, 0], points[:, 2], np.ones(3))), points[:, 1]
          )
          x0, z0, x1, z1 = polygon.bounds
          for x in range(math.floor(x0), math.ceil(x1)):
            for z in range(math.floor(z0), math.ceil(z1)):
              clipped = polygon.intersection(box(x, z, x + 1, z + 1))
              if clipped.area < 1e-5:
                continue
              a, b, c, d = clipped.bounds
              rows.append(
                [
                  (a + c) / 2,
                  float(coefficients @ [(a + c) / 2, (b + d) / 2, 1]),
                  (b + d) / 2,
                  c - a,
                  0.22,
                  d - b,
                  roof_rgb,
                ]
              )
  return [
    [round(float(v), 4) if i != 6 else v for i, v in enumerate(row)] for row in rows
  ]


def core_fittings(site, native_body, neighbours):
  """Shallow joinery clipped to each actual source wall, never a second shell.

  The official bay and gable geometry supplies individuality. Pane spacing,
  joinery widths and courses remain labelled display estimates. Modern
  Wielandstraße 5 has its independent narrow tall glazing/horizontal bands;
  no invented historic bay or tenant sign is applied to it.
  """
  context = read(GEO / "district-facades-v188-context.json.gz")
  names = {a["street"] for a in site["addresses"]}
  roads = [shape(r["geometry"]) for r in context["roads"] if r["name"] in names]
  if not roads:
    return [], [], []
  road = unary_union(roads)
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in site["parts"]])
  modern = any(a["address"] == "Wielandstraße 5" for a in site["addresses"])
  pitch, pane_w, pane_h = (3.2, 1.55, 2.1) if modern else (3.7, 1.25, 1.85)
  rows, native, proof = [], [], []
  old, shapes, tree = neighbours
  own_ids = {p["id"] for p in site["oldPrisms"]}
  part_shapes = [(p, Polygon(p["ring"], p["holes"])) for p in site["parts"]]

  def emit(face, u, y, out, w, h, depth, tint, role):
    a, direction, normal = face
    x, z = a + direction * u + normal * out
    yaw = -math.atan2(direction[1], direction[0])
    rows.append(
      [
        round(x, 4),
        round(y, 4),
        round(z, 4),
        round(w, 4),
        round(h, 4),
        depth,
        round(yaw, 9),
        tint,
      ]
    )
    # Cardinal members are fitted against the actual precompiled native
    # surface at this same elevation and outward face, never just rotated.
    axis = 0 if abs(normal[0]) >= abs(normal[1]) else 2
    sign = 1 if normal[axis // 2] >= 0 else -1
    cross_axis = 2 if axis == 0 else 0
    target = [x, y, z]
    candidates = []
    for b in native_body:
      if (
        abs(y - b[1]) > b[4] / 2 + 0.15
        or abs(target[cross_axis] - b[cross_axis]) > b[cross_axis + 3] / 2 + 0.12
      ):
        continue
      plane = b[axis] + sign * b[axis + 3] / 2
      if abs(plane - target[axis]) < 1.6:
        candidates.append(plane)
    if not candidates:
      return
    target[axis] = (max(candidates) if sign > 0 else min(candidates)) + sign * (
      out + 0.025
    )
    width = abs(direction[0]) * w + abs(normal[0]) * depth
    length = abs(direction[1]) * w + abs(normal[1]) * depth
    if axis == 0:
      width = max(depth, 0.045)
    else:
      length = max(depth, 0.045)
    native.append(
      [
        round(target[0], 4),
        round(y, 4),
        round(target[2], 4),
        round(width, 4),
        round(h, 4),
        round(length, 4),
        tint,
      ]
    )

  for part in site["parts"]:
    for surface_index, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      p = np.array(surface["rings"][0])
      horizontal = list(dict.fromkeys((float(q[0]), float(q[2])) for q in p))
      if len(horizontal) < 2:
        continue
      a, b = max(
        ((a, b) for a in horizontal for b in horizontal),
        key=lambda pair: math.dist(*pair),
      )
      a, b = np.array(a), np.array(b)
      length = float(np.linalg.norm(b - a))
      if length < 1.8:
        continue
      direction = (b - a) / length
      normal = np.array([-direction[1], direction[0]])
      middle = (a + b) / 2
      part_polygon = Polygon(part["ring"], part["holes"])
      if part_polygon.covers(Point(*(middle + normal * 0.2))):
        normal = -normal
      nearest = nearest_points(Point(*middle), road)[1]
      toward = np.array([nearest.x, nearest.y]) - middle
      distance = float(np.linalg.norm(toward))
      street_face = (
        1.5 <= distance <= 36
        and float(np.dot(toward, normal)) / max(distance, 0.001) >= 0.72
      )
      # Avoid side/party pieces whose apparent street ray crosses the
      # actual neighbouring building volume of this same source parent.
      approach = LineString([middle + normal * 0.25, [nearest.x, nearest.y]])
      street_face = street_face and footprint.intersection(approach).length <= 0.05
      projected = [
        [(float(np.dot(np.array(q)[[0, 2]] - a, direction)), q[1]) for q in ring]
        for ring in surface["rings"]
      ]
      wall = Polygon(projected[0], projected[1:])
      low, high = float(p[:, 1].min()), float(p[:, 1].max())
      columns = max(1, round((length - 0.5) / (2.55 if modern else 3.15)))
      pane_width = min(pane_w, length / columns * 0.65)
      count = 0
      for row in range(max(1, math.ceil((high - low) / pitch))):
        y = low + 2.0 + row * pitch
        for column in range(columns):
          u = (column + 0.5) * length / columns
          if not wall.covers(
            box(
              u - pane_width / 2 - 0.11,
              y - pane_h / 2 - 0.12,
              u + pane_width / 2 + 0.11,
              y + pane_h / 2 + 0.12,
            )
          ):
            continue
          # Complete neutral courtyard/rear complement: an exact old
          # prism's removal must not leave formerly detailed free
          # walls blank. Never decorate party/interior walls through
          # another source part or a neighbouring original owner.
          probe = Point(*(a + direction * u + normal * 0.30))
          if any(
            other["id"] != part["id"]
            and polygon.covers(probe)
            and other["ground_y_m"] <= y <= other["top_y_m"]
            for other, polygon in part_shapes
          ):
            continue
          if any(
            old[int(i)]["id"] not in own_ids
            and shapes[int(i)].covers(probe)
            and old[int(i)]["y0_dm"] / 10
            <= y
            <= (old[int(i)]["y0_dm"] + old[int(i)]["h_dm"]) / 10
            for i in tree.query(probe)
          ):
            continue
          face = (a, direction, normal)
          glass = 0x526D74 if modern else 0x688187
          frame = 0xB3B8B2 if modern else 0xDDD4C2
          emit(face, u, y, 0.115, pane_width, pane_h, 0.035, glass, "glazing")
          for sign in [-1, 1]:
            emit(
              face,
              u + sign * (pane_width + 0.08) / 2,
              y,
              0.15,
              0.07,
              pane_h + 0.16,
              0.07,
              frame,
              "jamb",
            )
            emit(
              face,
              u,
              y + sign * (pane_h + 0.08) / 2,
              0.15,
              pane_width + 0.15,
              0.07,
              0.07,
              frame,
              "lintel",
            )
          emit(face, u, y, 0.17, 0.045, pane_h, 0.045, frame, "mullion")
          emit(
            face, u, y + pane_h * 0.15, 0.17, pane_width, 0.045, 0.045, frame, "transom"
          )
          if not modern:
            emit(
              face,
              u,
              y - pane_h / 2 - 0.12,
              0.21,
              pane_width + 0.30,
              0.12,
              0.22,
              0xBBB39F,
              "stone-sill",
            )
          count += 1
      if count:
        proof.append(
          dict(
            parent=site["parent"],
            part=part["id"],
            surface=surface_index,
            sourceRings=surface["rings"],
            paneCount=count,
            modern=modern,
            faceRole="named-street"
            if street_face
            else "estimated-free-rear-court-complement",
            status="source wall/bay/gable exact; joinery centres and dimensions are display estimates",
          )
        )
        for y in [low + 0.65, high - 0.35]:
          if wall.covers(box(0.20, y - 0.08, length - 0.20, y + 0.08)):
            emit(
              (a, direction, normal),
              length / 2,
              y,
              0.19,
              length - 0.40,
              0.16,
              0.14,
              0xB9B6AB if modern else 0xD2C7AF,
              "source-following-course",
            )
  return rows, native, proof


def build_core(source):
  """Compile source once offline, retaining provenance independently of model buffers."""
  old = read(PUBLIC / "regierungsviertel/lod2-prisms.json")["buildings"]
  shapes = [
    Polygon(
      [(x / 10, z / 10) for x, z in p["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
    )
    for p in old
  ]
  tree = STRtree(shapes)
  old_prisms = [p for s in source["sites"] for p in s["oldPrisms"]]
  old_ids = {p["id"] for p in old_prisms}
  native = read(PUBLIC / "regierungsviertel/minecraft-voxels.json")
  native_columns, source_rows, shared = [], [], []
  selected_shape = unary_union(
    [shapes[i] for i, p in enumerate(old) if p["id"] in old_ids]
  )
  x0, z0, x1, z1 = selected_shape.bounds
  for iz, runs in enumerate(native["building_rows"]):
    zi = native["grid"]["min_z_idx"] + iz
    if not z0 - 4 <= zi * 4 <= z1 + 4:
      continue
    row_hit = False
    for start, count, low, high, kind in runs:
      for offset in range(start, start + count):
        xi = native["grid"]["min_x_idx"] + offset
        if not x0 - 4 <= xi * 4 <= x1 + 4:
          continue
        point = Point(xi * 4 + 2, zi * 4 + 2)
        owners = {old[int(i)]["id"] for i in tree.query(point, predicate="intersects")}
        if owners & old_ids:
          row_hit = True
          record = [xi, zi, low, high, kind]
          if owners <= old_ids:
            native_columns.append(record)
          else:
            shared.append(dict(column=record, owners=sorted(owners)))
    if row_hit:
      source_rows.append(dict(index=iz, row=runs))
  sites, navigation, fitting_proof, streamed_fittings = [], [], [], []
  for site in source["sites"]:
    positions, colors, indices = [], [], []
    parts = site["parts"]
    shape = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    origin = [math.floor(shape.bounds[0]) - 1, -5, math.floor(shape.bounds[1]) - 1]
    wall_rgb, roof_rgb = 0xD0C7B2, 0x747A76
    for part in parts:
      roof_triangles = []
      for surface in part["surfaces"]:
        roof = surface["kind"] == "RoofSurface"
        tint = linear(
          [
            (roof_rgb if roof else wall_rgb) >> 16,
            ((roof_rgb if roof else wall_rgb) >> 8) & 255,
            (roof_rgb if roof else wall_rgb) & 255,
          ]
        )
        for triangle in triangles_for(surface["rings"]):
          start = len(positions)
          positions.extend(
            [[round(q[i] - origin[i], 3) for i in range(3)] for q in triangle]
          )
          colors.extend([tint] * 3)
          indices.extend([start, start + 1, start + 2])
          if roof:
            roof_triangles.append(triangle)
      navigation.append(
        dict(
          id=part["id"],
          parent=site["parent"],
          ring=part["ring"],
          holes=part["holes"],
          low=part["ground_y_m"],
          high=part["top_y_m"],
          roofTriangles=roof_triangles,
        )
      )
    native_rows = native_sheets(parts, wall_rgb, roof_rgb)
    fittings, native_fittings, proof = core_fittings(
      site, native_rows, (old, shapes, tree)
    )
    fitting_proof.extend(proof)
    # These three actual old v163 frontages share the old packet lifetime
    # and retire the false registers atomically there, without a double.
    if any(a["street"] == "Fasanenstraße" for a in site["addresses"]):
      streamed_fittings.append(
        dict(
          parent=site["parent"],
          oldIds=[p["id"] for p in site["oldPrisms"]],
          drawnRows=fittings,
          nativeRows=native_fittings,
        )
      )
      fittings, native_fittings = [], []
    sites.append(
      dict(
        parent=site["parent"],
        addresses=[a["address"] for a in site["addresses"]],
        origin=origin,
        drawn=dict(
          positions=encode(positions, "<f4"),
          colors=encode(colors, "u1"),
          indices=encode(indices, "<u4"),
        ),
        nativeRows=native_rows,
        fittings=fittings,
        nativeFittings=native_fittings,
      )
    )
  write(CORE, dict(schemaVersion=1, sites=sites))
  write(
    OWNERS,
    dict(
      schemaVersion=1,
      oldPrisms=old_prisms,
      nativeGrid=native["grid"],
      nativeClasses=native["classes"],
      nativeRows=source_rows,
      nativeColumns=native_columns,
      sharedColumns=shared,
    ),
  )
  write(NAVIGATION, dict(schemaVersion=1, parts=navigation))
  write(
    GEO / "west-kiez-v302-core-fittings.json.gz",
    dict(
      schemaVersion=1,
      faces=fitting_proof,
      streamed=streamed_fittings,
      policy="No invented erker volume: complete official source bays, faceted projections and gables retain their measured geometry. Small joinery/course dimensions are source-clipped display estimates; modern Wielandstraße 5 has a distinct narrow tall register.",
    ),
  )
  print(
    json.dumps(
      dict(
        parents=len(sites),
        addresses=sum(len(s["addresses"]) for s in sites),
        parts=len(navigation),
        oldPrisms=len(old_prisms),
        nativeBodyRows=sum(len(s["nativeRows"]) for s in sites),
        nativeExclusiveColumns=len(native_columns),
        nativeSharedColumns=len(shared),
        coreBytes=CORE.stat().st_size,
        ownerBytes=OWNERS.stat().st_size,
        sourceBytes=CORE_SOURCE.stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("--extract-core", action="store_true")
  args = parser.parse_args()
  source = (
    extract_core_source()
    if args.extract_core or not CORE_SOURCE.exists()
    else read(CORE_SOURCE)
  )
  build_core(source)
