"""Step 10: mapped CityWest road paint and open ZOB/Busbahnhof architecture.

No street vertex, measured shell or packet is rewritten. The only retirements
are two exactly reproduced OSM building=roof fallback prisms at the ZOB.
"""

from __future__ import annotations

import argparse
import copy
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from build_citywest_streets_v235 import supports
from build_euref_v262 import fingerprint, json_for_js, mesh_fingerprint, remove_old
from build_feuerwache_kreuzberg_v267 import cuboid, read, sha, write
from build_house_curbs_v233 import flat_ground, flat_levels
from build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  native_polygon,
  navigation_polygons,
)
from build_transport_refinements_v205 import world
from extract_outer_connectors_v180 import identity, tags
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import substring, transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
CACHE = Path("/Users/klotzkette/.cache/codex-berlin-v281")
SOURCE = GEO / "citywest-transport-v281-source.json"
OUTPUT = DATA / "citywestTransportV281.json"
EVIDENCE = GEO / "citywest-transport-v281-evidence.json"
KIND = "citywest-transport-v281"
CANOPIES = {"OSM-way-693733275", "OSM-way-671765756"}
RECEPTION = "OSM-way-1226659408"
ZOB = box(-6310, 1010, -6180, 1215)
ZOO = box(-2710, 1090, -2500, 1365)
MOTORWAY = box(-6790, 850, -5750, 2460)
# Current 2026 construction and obsolete AVUS transfer: retained axes remain
# available as old cartographic evidence, but receive no new road furniture.
WORKS = box(-6600, 1570, -6110, 2070)
WHITE, GLASS, FRAME, ROOF = (
  (232, 228, 210),
  (67, 98, 105),
  (151, 159, 156),
  (191, 195, 188),
)


def extract() -> dict:
  features = []
  junction_edges = {}
  for area in ("icc", "zoo"):
    for layer in ("lines", "multipolygons", "points"):
      for f in read(CACHE / f"{area}-{layer}.json")["features"]:
        t, geometry = tags(f), transform(world, shape(f["geometry"]))
        key = f"node/{t['osm_id']}" if layer == "points" else identity(f)
        if (
          layer == "lines"
          and t.get("highway")
          in {
            "motorway",
            "motorway_link",
            "trunk",
            "primary",
            "secondary",
            "tertiary",
            "unclassified",
            "residential",
            "service",
          }
          and t.get("layer", "0") == "0"
          and t.get("bridge") != "yes"
          and t.get("tunnel") != "yes"
          and geometry.geom_type == "LineString"
        ):
          route = list(geometry.coords)
          for a, b in zip(route, route[1:]):
            aa, bb = tuple(round(v, 3) for v in a), tuple(round(v, 3) for v in b)
            junction_edges.setdefault(aa, set()).add(bb)
            junction_edges.setdefault(bb, set()).add(aa)
        motorway = (
          area == "icc"
          and t.get("highway") in {"motorway", "motorway_link"}
          and geometry.intersects(MOTORWAY)
        )
        street = (
          area == "zoo"
          and t.get("name") in {"Joachimsthaler Straße", "Hardenbergplatz"}
          and t.get("highway") in {"secondary", "residential", "service"}
        )
        terminal = (
          area == "icc"
          and ZOB.intersects(geometry)
          and (
            t.get("public_transport") == "platform"
            or t.get("building") in {"roof", "yes"}
          )
        )
        forecourt = (
          area == "zoo"
          and ZOO.covers(geometry)
          and (
            t.get("barrier") == "kerb"
            or t.get("amenity") in {"shelter", "bench"}
            or t.get("public_transport") == "platform"
          )
        )
        if motorway or street or terminal or forecourt:
          features.append(
            dict(
              key=key,
              area=area,
              role="motorway"
              if motorway
              else "street"
              if street
              else "terminal"
              if terminal
              else "forecourt",
              tags={k: v for k, v in t.items() if k not in {"osm_id", "osm_way_id"}},
              geometry=mapping(geometry),
            )
          )
  old = pyogrio.read_dataframe(
    GEO / "raw/outskirts-v187/resolved-outlines.gpkg",
    layer="buildings",
    bbox=ZOB.bounds,
  )
  owners = [
    dict(
      id=r.sourceId,
      oldOwner=dict(wkb=r.geometry.wkb_hex, height=r.height, minHeight=r.minHeight),
    )
    for r in old.itertuples()
    if r.sourceId in CANOPIES | {RECEPTION}
  ]
  assert {r["id"] for r in owners} == CANOPIES | {RECEPTION}
  # CityWest core geometry is delivered by the shared terrain, not the outer
  # packet's (empty) ground navigation. Freeze its actual local supports too.
  core_scope = box(-2850, 1090, -2490, 2110)
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  surfaces_path = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  ground = read(ground_path)
  grid = ground["grid"]
  height = ground["ground_height"]
  cell = ground["cell_m"]
  solid, asphalt, ys = [], [], set()
  for row, runs in enumerate(ground["ground_rows"]):
    z = (grid["min_z_idx"] + row) * cell
    if z + cell < core_scope.bounds[1] or z > core_scope.bounds[3]:
      continue
    for start, count, kind in runs:
      for ix in range(start, start + count):
        x = (grid["min_x_idx"] + ix) * cell
        if x + cell < core_scope.bounds[0] or x > core_scope.bounds[2]:
          continue
        y = (
          height["y_dm"][
            (row // height["stride_cells"]) * height["cols"]
            + ix // height["stride_cells"]
          ]
          / 10
        )
        ys.add(y)
        name = ground["classes"][kind]
        if name in {"grass", "asphalt", "concrete", "plazaBrick"}:
          solid.append(box(x, z, x + cell, z + cell))
        if name == "asphalt":
          asphalt.append(box(x, z, x + cell, z + cell))
  assert ys == {5.2}, ys
  road = []
  for r in read(surfaces_path)["roads"]:
    if r["kind"] != "asphalt":
      continue
    p = shapely.make_valid(
      Polygon(
        [[x / 10, z / 10] for x, z in r["ring"]],
        [[[x / 10, z / 10] for x, z in h] for h in r.get("holes", [])],
      )
    )
    if p.intersects(core_scope):
      road.append(p.intersection(core_scope))
  core = dict(
    ground=mapping(unary_union(solid)),
    drawnRoads=mapping(unary_union(road)),
    nativeRoads=mapping(unary_union(asphalt)),
    groundY=5.2,
    inputs={str(p.relative_to(ROOT)): sha(p) for p in [ground_path, surfaces_path]},
  )
  result = dict(
    schema=1,
    step=10,
    features=sorted(features, key=lambda f: f["key"]),
    junctions=[
      list(p) for p, neighbours in sorted(junction_edges.items()) if len(neighbours) > 2
    ],
    owners=owners,
    core=core,
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    license="ODbL-1.0",
    routePolicy="Every selected source vertex retained; geometry is already projected into viewer metres. No source route edits.",
    references=[
      "https://diebruecke.berlin/projekt/zentraler-omnibusbahnhof-berlin-zob",
      "https://diebruecke.berlin/projekt/empfangsgebaude-am-zob",
      "https://zob.berlin/de",
      "https://www.deges.de/presse/pressemitteilung/ad-funkturm-a-115-a-100-geaenderte-verkehrsfuehrung-ab-05-10/",
      "https://gemeinsamdigital.berlin.de/de/smart-space-hardenbergplatz/",
    ],
    dimensions="OSM plans and retained envelopes exact. New canopy clearance, small fittings and facade subdivisions are conservative display estimates; reception retains the existing 9 m envelope and has two above-ground floors, plus its unrendered basement.",
  )
  write(SOURCE, result)
  return result


def raster(poly, step=0.25, require_full=False, support=None):
  """Independent cardinal cells, sampled before mesh generation."""
  if poly.is_empty:
    return Polygon()
  if poly.geom_type != "Polygon":
    return unary_union(
      [raster(p, step, require_full, support) for p in poly.geoms if p.area > 0]
    )
  a, b, c, d = poly.bounds
  cells = []
  for iz in range(math.floor(b / step), math.ceil(d / step)):
    for ix in range(math.floor(a / step), math.ceil(c / step)):
      cell = box(ix * step, iz * step, (ix + 1) * step, (iz + 1) * step)
      if (poly.covers(cell) if require_full else poly.covers(cell.centroid)) and (
        support is None or support.covers(cell)
      ):
        cells.append(cell)
  return unary_union(cells)


def prism(mesh, poly, low, high, color, native=False, step=0.5):
  p = raster(poly, step) if native else poly
  if not p.is_empty:
    mesh.surface(p, high, color)
    for line in line_parts(p.boundary):
      for a, b in zip(list(line.coords), list(line.coords)[1:]):
        aa, bb, cc, dd = (
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        )
        mesh.triangle([aa, bb, cc], color)
        mesh.triangle([aa, cc, dd], color)
  return p


def road_paint(source):
  paint, audit = [], []
  junctions = unary_union([Point(p).buffer(7) for p in source["junctions"]])
  roads = [f for f in source["features"] if f["role"] in {"motorway", "street"}]
  for f in roads:
    t, g = f["tags"], shape(f["geometry"])
    reason = None
    if g.geom_type != "LineString":
      reason = "not a single source line"
    elif (
      t.get("bridge") == "yes" or t.get("tunnel") == "yes" or t.get("layer", "0") != "0"
    ):
      reason = "layered/bridge/tunnel has no reliable delivered elevation"
    elif not str(t.get("lanes", "")).isdigit():
      reason = "lane count not mapped"
    elif t.get("placement") or t.get("placement:start") or t.get("placement:end"):
      reason = "noncentral placement needs a lane-alignment survey"
    elif f["role"] == "motorway" and (
      g.intersects(WORKS) or t.get("highway") == "motorway_link"
    ):
      reason = "current Ringbahn bridge / AVUS ramp construction or unresolved interchange alignment"
    lanes = int(t.get("lanes", "0")) if str(t.get("lanes", "")).isdigit() else 0
    if not reason and not 1 <= lanes <= 5:
      reason = "lane count outside bounded renderer"
    if reason:
      audit.append(
        dict(
          key=f["key"],
          status="retained without new paint",
          reason=reason,
          bounds=list(g.bounds),
        )
      )
      continue
    motorway = f["role"] == "motorway"
    width = (
      float(t["width"])
      if str(t.get("width", "")).replace(".", "", 1).isdigit()
      else lanes * (3.5 if motorway else 3)
    )
    candidates = []
    # Butt caps and joined source offsets retain bends without square segment
    # patches. Lane spacing follows mapped width/count; no turn arrows guessed.
    for lane in range(1, lanes):
      offset = (lane / lanes - 0.5) * width
      for course in line_parts(g.offset_curve(offset, join_style="round")):
        for start in np.arange(7, course.length - 7, 18 if motorway else 9):
          candidates.append(
            substring(
              course,
              float(start),
              min(
                float(start) + 6 if motorway else float(start) + 3, course.length - 7
              ),
            ).buffer(0.11, cap_style="flat")
          )
    if motorway:
      for offset in (-width / 2, width / 2):
        for course in line_parts(g.offset_curve(offset, join_style="round")):
          if course.length > 16:
            candidates.append(
              substring(course, 7, course.length - 7).buffer(0.13, cap_style="flat")
            )
    p = unary_union(candidates)
    p = p.difference(junctions)
    if motorway:
      p = p.intersection(MOTORWAY).difference(WORKS)
    if not p.is_empty:
      paint.append(p)
    audit.append(
      dict(
        key=f["key"],
        status="paint candidate",
        lanes=lanes,
        widthM=width,
        widthSource="mapped width" if "width" in t else "lane-width display estimate",
        candidateAreaM2=p.area,
      )
    )
  return unary_union(paint), audit


def reception(mesh, owner, native):
  """Two storeys only, fitted to complete unchanged fallback exterior."""
  poly = shapely.from_wkb(bytes.fromhex(owner["oldOwner"]["wkb"]))
  if native:
    # Fit the independently retained two-metre source body, not smooth facade
    # planes that would alternate inside and outside its stepped perimeter.
    poly = native_polygon(poly)
  top = 3 + (
    round(owner["oldOwner"]["height"] / 2) * 2
    if native
    else owner["oldOwner"]["height"]
  )
  middle = 3 + (top - 3) / 2
  contour = shapely.orient_polygons(poly, exterior_cw=True)
  edges = [
    (a, b)
    for p in getattr(contour, "geoms", [contour])
    for a, b in zip(list(p.exterior.coords), list(p.exterior.coords)[1:])
  ]
  for a, b in edges:
    a, b = np.array(a), np.array(b)
    d = b - a
    length = float(np.linalg.norm(d))
    if length < 2:
      continue
    d /= length
    n = np.array([-d[1], d[0]])
    if poly.covers(Point((a + b) / 2 + n * 0.2)):
      n = -n
    for start in np.arange(0.18, length - 0.5, 2.1):
      end = min(start + 1.88, length - 0.18)
      if end - start < 0.35:
        continue
      for low, high in [(3.4, middle - 0.3), (middle + 0.2, top - 0.5)]:
        aa = a + d * start + n * 0.07
        bb = a + d * end + n * 0.07
        if native:
          course = LineString([aa, bb])
          steps = max(1, math.ceil(course.length / 0.5))
          for i in range(steps):
            p = course.interpolate((i + 0.5) / steps, normalized=True)
            cuboid(
              mesh,
              [round(p.x * 2) / 2, (low + high) / 2, round(p.y * 2) / 2],
              [0.5, high - low, 0.5],
              GLASS,
            )
        else:
          pts = [
            [aa[0], low, aa[1]],
            [bb[0], low, bb[1]],
            [bb[0], high, bb[1]],
            [aa[0], high, aa[1]],
          ]
          mesh.triangle(pts[:3], GLASS)
          mesh.triangle([pts[0], pts[2], pts[3]], GLASS)
  return poly


def terminal(mesh, source, native, bounds, include_buildings=True):
  nav = []
  for owner in source["owners"] if include_buildings else []:
    if owner["id"] == RECEPTION:
      reception(mesh, owner, native)
      continue
    poly = shapely.from_wkb(bytes.fromhex(owner["oldOwner"]["wkb"]))
    # Old 3 m value was an explicit building=roof fallback, not a measured roof.
    # Full mapped outline survives; 4.8 m clearance is marked as an estimate.
    roof = prism(mesh, poly, 7.8, 8.1, ROOF, native)
    for r in navigation_polygons(roof, bounds[0], bounds[1]):
      nav.append(
        dict(
          **r,
          sourceId=owner["id"],
          partId="open-roof",
          height=5.1,
          minHeight=4.8,
          heightSource="OSM complete roof plan; estimated bus clearance",
        )
      )
    axis = poly.minimum_rotated_rectangle
    coords = list(axis.exterior.coords)
    a, b = max(zip(coords, coords[1:]), key=lambda p: math.dist(*p))
    a, b = np.array(a), np.array(b)
    d = (b - a) / np.linalg.norm(b - a)
    center = np.array([poly.centroid.x, poly.centroid.y])
    length = float(np.linalg.norm(b - a))
    for u in np.arange(-length / 2 + 4, length / 2 - 2, 12):
      point = center + d * u
      post = box(point[0] - 0.2, point[1] - 0.2, point[0] + 0.2, point[1] + 0.2)
      if not poly.covers(post):
        continue
      if native:
        post = box(
          round(point[0] * 2) / 2 - 0.25,
          round(point[1] * 2) / 2 - 0.25,
          round(point[0] * 2) / 2 + 0.25,
          round(point[1] * 2) / 2 + 0.25,
        )
      prism(mesh, post, 3, 7.8, FRAME)
      for r in navigation_polygons(post, bounds[0], bounds[1]):
        nav.append(
          dict(
            **r,
            sourceId=owner["id"],
            partId=f"post-{u:.1f}",
            height=4.8,
            minHeight=0,
            heightSource="estimated support on exact mapped roof",
          )
        )
  gates = []
  gate_features = {}
  for f in source["features"]:
    if (
      f["role"] == "terminal"
      and f["tags"].get("public_transport") == "platform"
      and f["tags"].get("name", "").startswith("Gate")
    ):
      gate_features.setdefault(f["tags"]["name"], f)
  for f in gate_features.values():
    if f["role"] != "terminal" or f["tags"].get("public_transport") != "platform":
      continue
    t = f["tags"]
    g = shape(f["geometry"])
    if not t.get("name", "").startswith("Gate"):
      continue
    p = (
      g.representative_point()
      if g.geom_type in {"Polygon", "MultiPolygon", "Point"}
      else g.interpolate(0.5, normalized=True)
    )
    x, z = (round(p.x * 2) / 2, round(p.y * 2) / 2) if native else (p.x, p.y)
    tile = box(*bounds)
    if not tile.intersects(box(x - 0.7, z - 0.3, x + 1.6, z + 0.3)):
      continue
    # A mapped platform marker / information pillar, not a guessed platform or
    # bus pose. Source name stays in audit; symbols are simple readable bars.
    prism(
      mesh, box(x - 0.11, z - 0.11, x + 0.11, z + 0.11).intersection(tile), 3, 5, FRAME
    )
    prism(
      mesh,
      box(x - 0.65, z - 0.07, x + 0.65, z + 0.07).intersection(tile),
      4.69,
      5.41,
      (34, 66, 67),
    )
    if t.get("bench") == "yes":
      prism(
        mesh,
        box(x + 0.05, z - 0.25, x + 1.55, z + 0.25).intersection(tile),
        3.35,
        3.55,
        (122, 129, 119),
      )
    gates.append(f["key"])
  return nav, gates


def build():
  source = read(SOURCE)
  paint, road_audit = road_paint(source)
  west_drawn, west_native, previous = supports()
  core_ground = shape(source["core"]["ground"])
  paint = paint.difference(previous.buffer(0.05))
  entries = read(PUB / "manifest.json")["chunks"]
  packets, evidence = {}, []
  counts = Counter()
  scope = unary_union([paint, ZOB, ZOO])
  for entry in entries:
    bounds = entry["bounds"]
    tile = box(*bounds)
    if entry.get("detailCompanionOf") or not tile.intersects(scope):
      continue
    # finite local source scope, never a runtime proximity test
    if not (
      tile.intersects(MOTORWAY) or tile.intersects(box(-2850, 1090, -2500, 2110))
    ):
      continue
    for family in ("drawn", "minecraft"):
      native = family == "minecraft"
      path = PUB / entry[family]["url"]
      packet = read(path)
      mesh = PackedMesh(bounds[0], bounds[1])
      coverage = []
      levels = flat_levels(packet, flat_ground(packet))
      for y, support in [
        (3.09, levels.get(3.09, Polygon())),
        (
          5.2 if native else 5.34,
          shape(source["core"]["nativeRoads" if native else "drawnRoads"])
          .intersection(tile)
          .difference(west_native if native else west_drawn),
        ),
        (
          5.60 if native else 5.54,
          (west_native if native else west_drawn).intersection(tile),
        ),
      ]:
        p = paint.intersection(support.buffer(-0.035)).intersection(tile)
        if native:
          p = raster(p, 0.25, support=support)
        if p.is_empty:
          continue
        mesh.surface(p, y + 0.02, WHITE)
        coverage.append(
          dict(y=y + 0.02, areaM2=p.area, supportOutsideM2=p.difference(support).area)
        )
      # Mapped platforms/kerbs and furniture remain in their actual forecourt,
      # on delivered ground only. Existing U-canopy owner is untouched.
      core_piece = core_ground.intersection(tile)
      localground = flat_ground(packet).intersection(tile).union(core_piece)
      for f in source["features"]:
        if f["role"] != "forecourt":
          continue
        g = shape(f["geometry"])
        t = f["tags"]
        if not tile.covers(g):
          continue
        ground_y = 5.2 if core_piece.covers(g.representative_point()) else 3
        if t.get("barrier") == "kerb" and g.geom_type == "LineString":
          curb = g.buffer(0.10, cap_style="flat", join_style="round").intersection(
            localground
          )
          prism(
            mesh, curb, ground_y + 0.14, ground_y + 0.28, (183, 180, 163), native, 0.25
          )
          counts[f"{family}MappedKerbs"] += 1
        elif t.get("amenity") == "shelter" and g.geom_type in {
          "Polygon",
          "MultiPolygon",
        }:
          # building=roof owners elsewhere are not duplicated. These six mapped
          # amenity-only bus shelters have no existing building shell owner.
          if not localground.buffer(0.02).covers(g):
            continue
          prism(mesh, g, ground_y + 2.6, ground_y + 2.8, ROOF, native)
          p = g.representative_point()
          cuboid(mesh, [p.x, ground_y + 1.3, p.y], [0.25, 2.6, 0.25], FRAME)
          counts[f"{family}MappedShelters"] += 1
        elif (
          t.get("amenity") == "bench"
          and g.geom_type == "Point"
          and localground.covers(g)
        ):
          x, z = (round(g.x * 2) / 2, round(g.y * 2) / 2) if native else (g.x, g.y)
          cuboid(mesh, [x, ground_y + 0.55, z], [1.8, 0.18, 0.48], (129, 122, 99))
          cuboid(mesh, [x, ground_y + 0.28, z], [1.1, 0.5, 0.28], FRAME)
          counts[f"{family}MappedBenches"] += 1
      retirement = None
      navigation = []
      gates = []
      if entry["id"] == "outer187--13_2":
        owners = [o for o in source["owners"] if o["id"] in CANOPIES]
        retirement = remove_old(copy.deepcopy(packet), owners, family, bounds)
        navigation, gates = terminal(mesh, source, native, bounds)
      elif entry["id"] == "outer187--13_1":
        _, gates = terminal(mesh, source, native, bounds, False)
      payload = mesh.payload(KIND)
      if not payload:
        continue
      assert len(packet["meshes"]) < 16
      record = dict(
        origin=packet["origin"],
        records=retirement["runtimeRecords"] if retirement else [],
        lineFingerprint=retirement["runtimeLineFingerprint"] if retirement else None,
        segments=retirement["runtimeSegments"] if retirement else [],
        navigationFingerprint=fingerprint([json_for_js(packet["nav"])]),
        replacement=payload,
        replacementFingerprint=mesh_fingerprint(payload),
        retiredOwners=sorted(CANOPIES) if retirement else [],
        buildings=navigation,
      )
      packets[f"{family}:{entry['id']}"] = record
      evidence.append(
        dict(
          key=f"{family}:{entry['id']}",
          asset=str(path.relative_to(ROOT)),
          sha256=sha(path),
          retirement=retirement,
          paint=coverage,
          gates=gates,
          triangles=len(mesh.indices) // 3,
        )
      )
  output = dict(
    schema=1,
    profile="Step 10 source-bound CityWest transport v281",
    sourceSha256=sha(SOURCE),
    keys=sorted(packets),
    packets=packets,
  )
  write(OUTPUT, output)
  assert OUTPUT.stat().st_size < 1_200_000, OUTPUT.stat().st_size
  result = dict(
    step=10,
    sourceSha256=sha(SOURCE),
    runtimeSha256=sha(OUTPUT),
    runtimeBytes=OUTPUT.stat().st_size,
    packets=evidence,
    roads=road_audit,
    counts=counts,
    excludedConstruction=mapping(WORKS),
    policy=source["dimensions"],
  )
  write(EVIDENCE, result)
  print(
    dict(
      runtimeBytes=result["runtimeBytes"],
      packets=len(packets),
      triangles=sum(r["triangles"] for r in evidence),
      counts=dict(counts),
    )
  )
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  build()
