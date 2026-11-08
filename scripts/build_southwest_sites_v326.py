"""Step10: finite Pfaueninsel, Brücke-Museum and Kunsthaus Dahlem refinement.

Old source payloads stay immutable. Only five complete, evidenced Kunsthaus,
Meierei and Maschinenhaus fallback owners yield through exact packet receipts. Landscape and
small architectural fittings remain explicitly estimated recognition details.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import geopandas as gpd
import numpy as np
from shapely import constrained_delaunay_triangles, orient_polygons
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_grunewald_terrain_v190 import offset_at
from scripts.build_rixdorf_v304 import fingerprint, prepared_packets
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  native_polygon,
  polygons_from_geometry,
  source_identity,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/outskirts-v187"
KIND = "southwest-sites-v326"
OLD = {"OSM-way-32212224", "OSM-way-112235457"}
PARENTS = ["DEBE06YYB0000UZz", "DEBE06YYB00003OO", "DEBE06YYB0004usJ"]
ISLAND_FAMILIES = {
  "kavalierhaus": ("DEBE06YYD00005ve", "372_5810"),
  "meierei": ("DEBE06YYD00002Kr", "373_5811"),
  "maschinenhaus": ("DEBE06YYD000034z", "372_5810"),
  "luisentempel": ("DEBE06YYD00002M3", "373_5811"),
  "schloss-source-only": ("DEBE06YYD00003CI", "372_5810"),
}
ISLAND_OLD = {
  "OSM-way-73427143": "meierei",
  "OSM-way-25015199": "maschinenhaus",
  "OSM-way-1545433869": "maschinenhaus",
}


def references():
  primary = [
    (
      "Schloss Pfaueninsel: current official site",
      "https://www.spsg.de/schloesser-gaerten/objekt/schloss-pfaueninsel",
    ),
    (
      "Schloss restoration completed 2025",
      "https://www.spsg.de/presse-foto-film/pressematerial-aktuell/2025-05-21-gesamtsanierung-schloss-pfaueninsel-abgeschlossen",
    ),
    (
      "Brücke-Museum architecture",
      "https://www.bruecke-museum.de/en/museum/63/architecture",
    ),
    (
      "Kunsthaus Dahlem history",
      "https://kunsthaus-dahlem.de/haus/geschichte-des-hauses/von-1945-bis-heute/",
    ),
    (
      "Kunsthaus measured heritage identity",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075361",
    ),
    (
      "Pfaueninsel ensemble heritage",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075495",
    ),
    (
      "Kavalierhaus original architecture",
      "https://schinkel.smb.museum/image_orte.php?id=11",
    ),
    (
      "Luisentempel: relocated portico and new rear wall",
      "https://www.spsg.de/fileadmin/user_upload/SPSG_UNESCO-Welterbe_25.pdf",
    ),
    (
      "Peafowl on Pfaueninsel 2025",
      "https://www.spsg.de/presse-foto-film/pressematerial-aktuell/2025-04-05-patenschaften-fuer-die-pfauen-auf-der-pfaueninsel-moeglich",
    ),
  ]
  photos = [
    (
      "Pfaueninsel-Schloss-aussen-hoch-2025-07-HS.jpg",
      "HubertSt",
      "2025-07-05",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "2021-05-26-Kunsthaus-Dahlem.jpg",
      "Gunnar Klack",
      "2021-05-26",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "Dahlem_Käuzchensteig_Kunsthaus_Dahlem.jpg",
      "Fridolin freudenfett",
      "2016-05-09",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "2021-05-26-Bruecke-Museum-Berlin-Dahlem-Bussardsteig-Werner-Duettmann-A.jpg",
      "Gunnar Klack",
      "2021-05-26",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "Freier_Pfau_auf_der_Pfaueninsel.jpg",
      "Luana 113",
      "2021-05-24",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "Berlin_Pfaueninsel_lub_2025-07-06_img14.jpg",
      "Lukas Beck",
      "2025-07-06",
      "CC BY 4.0",
      "by/4.0",
    ),
    (
      "Kavalierhaus_Pfaueninsel_Berlin_2022.jpg",
      "Nhondima",
      "2022-09-09",
      "CC BY-SA 4.0",
      "by-sa/4.0",
    ),
    (
      "Pfaueninsel_Portikus_K.jpg",
      "Manfred Brueckels / Eisenacher",
      "2007",
      "Public domain (author release)",
      None,
    ),
    (
      "Pfaueninsel_-_Maschinenhaus_(Peacock_Island_-_Engine_House)_-_geo.hlipp.de_-_35066.jpg",
      "Colin Smith",
      "2013-04-19",
      "CC BY-SA 2.0",
      "by-sa/2.0",
    ),
  ]
  from urllib.parse import quote

  return [
    dict(kind="primary", title=t, url=u, accessed="2026-11-08") for t, u in primary
  ] + [
    dict(
      kind="external-photo-reference",
      title=t,
      url="https://commons.wikimedia.org/wiki/File:" + quote(t),
      author=a,
      date=d,
      license=license_name,
      licenseUrl="https://creativecommons.org/licenses/" + lu + "/"
      if lu
      else "https://commons.wikimedia.org/wiki/Commons:Licensing",
      accessed="2026-11-08",
      use="Reference page and license checked; no image pixels distributed or rendered",
    )
    for t, a, d, license_name, lu in photos
  ]


def read(path: Path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value):
  raw = (
    json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def record(row, linear=False):
  return dict(
    id=("OSM-way-" + str(row["osm_id"]) if linear else source_identity(row)),
    tags=tags_for(row),
    geometry=mapping(world(row.geometry)),
  )


def horizontal(g, y, color):
  return dict(
    color=color,
    triangles=[
      [[x, y, z] for x, z in list(t.exterior.coords)[:3]]
      for p in polygons_from_geometry(g)
      for t in constrained_delaunay_triangles(p).geoms
    ],
  )


def put(site, p, y, w, h, d, yaw, color, role):
  site["boxes"].append(
    [
      round(float(p[0]), 4),
      round(float(y), 4),
      round(float(p[1]), 4),
      round(float(w), 4),
      round(float(h), 4),
      round(float(d), 4),
      round(float(yaw), 7),
      color,
    ]
  )
  site["roles"].append(role)


def perimeter(site, g, y, width, height, color, role):
  for line in line_parts(g.boundary):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      length = math.dist(a, b)
      if length < 0.08:
        continue
      put(
        site,
        ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
        y,
        length,
        height,
        width,
        math.atan2(a[1] - b[1], b[0] - a[0]),
        color,
        role,
      )


def site(key, name):
  return dict(key=key, name=name, boxes=[], roles=[], surfaces=[])


def cardinal_rows(rows):
  """Independent cardinal surface interpretation; never rotate native cubes.

  Thin fittings follow their own world-axis stepped centreline. This is not a
  rasterization of a smooth scene mesh and introduces no hidden solid infill.
  """
  result = []
  for x, y, z, w, h, d, yaw, color in rows:
    if abs(math.sin(yaw)) < 1e-7:
      result.append([x, y, z, w, h, d, 0, color])
      continue
    if abs(math.cos(yaw)) < 1e-7:
      result.append([x, y, z, d, h, w, 0, color])
      continue
    count = max(1, math.ceil(w / 0.4))
    for i in range(count):
      u = w * ((i + 0.5) / count - 0.5)
      # A finite rectangular support point, with cardinal exterior thickness.
      result.append(
        [
          round(x + math.cos(yaw) * u, 4),
          y,
          round(z - math.sin(yaw) * u, 4),
          round(abs(math.cos(yaw)) * w / count + abs(math.sin(yaw)) * d, 4),
          h,
          round(abs(math.sin(yaw)) * w / count + abs(math.cos(yaw)) * d, 4),
          0,
          color,
        ]
      )
  return result


def shell_native(surfaces, step=0.5):
  """Complete exterior-only orthogonal shell sampled on a fixed half-metre grid."""
  cells = {}
  for s in surfaces:
    for triangle in s["triangles"]:
      a, b, c = map(np.array, triangle)
      count = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / (step * 0.55)
        ),
      )
      for i in range(count + 1):
        for j in range(count + 1 - i):
          p = a + (b - a) * i / count + (c - a) * j / count
          cells[tuple(math.floor(float(v) / step) for v in p)] = s["color"]
  rows = []
  columns = {}
  for (x, y, z), color in cells.items():
    columns.setdefault((x, z, color), []).append(y)
  for (x, z, color), ys in sorted(columns.items()):
    ys = sorted(set(ys))
    start = end = ys[0]
    for y in [*ys[1:], None]:
      if y is not None and y == end + 1:
        end = y
        continue
      rows.append(
        [
          (x + 0.5) * step,
          (start + end + 1) * step / 2,
          (z + 0.5) * step,
          step,
          (end - start + 1) * step,
          step,
          0,
          color,
        ]
      )
      start = end = y
  return rows


def extract_sources():
  osm = RAW / "candidate.gpkg"
  island = (
    gpd.read_file(osm, layer="multipolygons", where="osm_way_id='25179280'")
    .to_crs(25833)
    .geometry.iloc[0]
  )
  # Read only the finite island envelope, then test the complete actual domain.
  geo_bounds = gpd.GeoSeries([island], crs=25833).to_crs(4326).total_bounds
  polygons = gpd.read_file(osm, layer="multipolygons", bbox=tuple(geo_bounds)).to_crs(
    25833
  )
  polygons = [
    record(r)
    for _, r in polygons.iterrows()
    if isinstance(r.get("osm_way_id"), str)
    and island.covers(r.geometry.representative_point())
  ]
  lines = gpd.read_file(osm, layer="lines", bbox=tuple(geo_bounds)).to_crs(25833)
  paths = [
    record(r, True)
    for _, r in lines.iterrows()
    if tags_for(r).get("highway") in {"path", "footway", "track", "service", "steps"}
    and r.geometry.intersects(island)
  ]
  archive = GEO / "raw/grunewald-v190/LoD2_382_5814.zip"
  families = []
  for parent in PARENTS:
    element = extract_parent(archive, parent)
    families.append(
      dict(
        id=parent,
        parts=[part_profile(p) for p in leaf_building_parts(element) or [element]],
      )
    )
  island_families = {}
  for key, (parent, code) in ISLAND_FAMILIES.items():
    element = extract_parent(GEO / f"raw/southwest-v326/LoD2_{code}.zip", parent)
    island_families[key] = dict(
      id=parent,
      parts=[part_profile(p) for p in leaf_building_parts(element) or [element]],
    )
  old = gpd.read_file(
    RAW / "resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('OSM-way-32212224','OSM-way-112235457')",
  )
  originals = []
  for r in old.to_dict("records"):
    originals.append(
      {
        k: (None if isinstance(v, float) and not math.isfinite(v) else v)
        for k, v in r.items()
        if k != "geometry"
      }
      | {"geometry": mapping(r["geometry"])}
    )
  island_old = gpd.read_file(
    RAW / "resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN (" + ",".join("'" + q + "'" for q in ISLAND_OLD) + ")",
  )
  island_originals = [
    {
      k: (None if isinstance(v, float) and not math.isfinite(v) else v)
      for k, v in r.items()
      if k != "geometry"
    }
    | {"geometry": mapping(r["geometry"])}
    for r in island_old.to_dict("records")
  ]
  return dict(
    schemaVersion=1,
    island=mapping(world(island)),
    polygons=polygons,
    paths=paths,
    kunsthaus=families,
    oldKunsthaus=originals,
    islandFamilies=island_families,
    oldIsland=island_originals,
    archives=[
      dict(
        url="https://gdi.berlin.de/data/a_lod2/atom/LoD2_382_5814.zip",
        sha256=sha(archive),
        license="dl-de/zero-2-0",
      )
    ]
    + [
      dict(
        url=f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{code}.zip",
        sha256=sha(GEO / f"raw/southwest-v326/LoD2_{code}.zip"),
        license="dl-de/zero-2-0",
      )
      for code in ["372_5810", "372_5811", "373_5810", "373_5811"]
    ],
    preservedInputs={
      p: sha(ROOT / p)
      for p in [
        "src/app/src/data/westLakesV194.json",
        "src/app/src/data/westLakesV194Native.json",
        "src/app/src/data/grunewaldLandmarksV190.json",
        "src/app/src/data/grunewaldLandmarksV190Native.json",
        "geo_data/regierungsviertel/west-lakes-v194-source.geojson",
        "geo_data/regierungsviertel/grunewald-landmarks-v190-source.json.gz",
      ]
    },
  )


def path_landscape(source):
  island = shape(source["island"])
  buildings = unary_union(
    [
      shape(p["geometry"])
      for p in source["polygons"]
      if p["tags"].get("building") or p["tags"].get("building:part")
    ]
  )
  water = unary_union(
    [
      shape(p["geometry"])
      for p in source["polygons"]
      if p["tags"].get("natural") == "water" or p["tags"].get("water")
    ]
  )
  paths = []
  for p in source["paths"]:
    width = p["tags"].get("width", "2")
    try:
      width = min(6, max(0.8, float(width.split()[0])))
    except ValueError:
      width = 2
    paths.append(shape(p["geometry"]).buffer(width / 2, cap_style=2, join_style=2))
  path = unary_union(paths).intersection(island).difference(buildings).difference(water)
  s = site("pfaueninsel-paths", "Pfaueninsel: complete mapped island path network")
  s["surfaces"] = [horizontal(path, 3.025, 0xB8AF94)]
  s["nativeSurfaces"] = [
    horizontal(native_polygon(path.intersection(island.buffer(-1.5))), 3.025, 0xB8AF94)
  ]
  # Six cardinal two-point routes are selected on real supported path interior.
  # Maximum tail/body clearance .9 m is covered throughout, not only centres.
  routes = []
  candidates = sorted(
    source["paths"], key=lambda q: shape(q["geometry"]).length, reverse=True
  )
  for p in candidates:
    line = shape(p["geometry"])
    for at in [0.28, 0.55, 0.78]:
      centre = line.interpolate(at, normalized=True)
      for dx, dz in [(6, 0), (0, 6), (-4, 0), (0, -4)]:
        a = (round(centre.x, 3), round(centre.y, 3))
        b = (a[0] + dx, a[1] + dz)
        route = LineString([a, b])
        if (
          path.buffer(0.001).covers(route.buffer(0.9))
          and island.difference(buildings).difference(water).covers(route.buffer(2.5))
          and all(route.distance(LineString(q["routeXZ"])) > 20 for q in routes)
        ):
          routes.append(
            dict(
              id=f"pfaueninsel-peacock-{len(routes) + 1}",
              siteId="pfaueninsel",
              sourcePath=p["id"],
              routeXZ=[list(a), list(b)],
              groundY=3.025,
              speed=0.34,
              phase=len(routes) / 6,
              white=len(routes) >= 4,
            )
          )
          break
      if len(routes) == 6:
        break
    if len(routes) == 6:
      break
  if len(routes) != 6:
    raise ValueError(f"Only {len(routes)} fully source-backed peacock routes")
  return s, path, routes


def castle_details(source):
  old = read(DATA / "westLakesV194.json")
  shell = next(s for s in old["sites"] if s["key"] == "schloss-pfaueninsel")
  sf = read(GEO / "west-lakes-v194-source.geojson")
  f = (
    next(
      f for f in sf["features"] if f["properties"].get("key") == "schloss-pfaueninsel"
    )
    if any(f["properties"].get("key") == "schloss-pfaueninsel" for f in sf["features"])
    else next(f for f in sf["features"] if "25014562" in str(f["properties"]))
  )
  from pyproj import Transformer
  from shapely.ops import transform

  g = world(
    transform(
      Transformer.from_crs(4326, 25833, always_xy=True).transform, shape(f["geometry"])
    )
  )
  g = max(polygons_from_geometry(g), key=lambda q: q.area)
  s = site(
    "schloss-pfaueninsel",
    "Schloss Pfaueninsel: white-board ruin, tower windows and iron bridge",
  )
  # Painted-board seams enrich the original full outline without a second body.
  for line in line_parts(g.boundary):
    coords = list(line.coords)
    for a, b in zip(coords, coords[1:]):
      length = math.dist(a, b)
      if length < 0.2:
        continue
      d = np.array(b) - a
      d = d / length
      n = np.array([-d[1], d[0]])
      if g.contains(Point(*(np.array(a) + np.array(b)) / 2 + n * 0.04)):
        n = -n
      yaw = math.atan2(-d[1], d[0])
      for u in np.arange(0.15, length, 0.24):
        p = np.array(a) + d * u + n * 0.018
        # Do not run seams through the preserved original ninety-nine fittings.
        if any(
          abs(float(p[0]) - r[0]) < 0.8 and abs(float(p[1]) - r[2]) < 0.8
          for r in shell["boxes"]
          if r[7] in {0x53646A, 0x566467}
        ):
          continue
        put(s, p, 6.8, 0.014, 6.8, 0.018, yaw, 0xC9CABD, "white-board-joint")
  coords = list(g.exterior.coords)
  towers = [
    Polygon(coords[2:33]).intersection(g),
    Polygon(coords[63:94]).intersection(g),
  ]
  centers = [np.array(t.centroid.coords[0]) for t in towers]
  a, b = centers
  d = b - a
  length = np.linalg.norm(d)
  d /= length
  n = np.array([-d[1], d[0]])
  yaw = math.atan2(-d[1], d[0])
  # Open bridge lattice: thin cross members, no closed opaque bridge volume.
  for side in [-1, 1]:
    for u in np.arange(2.8, length - 2.8, 0.75):
      p = a + d * u + n * side * 0.52
      put(s, p, 14.57, 0.62, 0.045, 0.055, yaw, 0x47514B, "iron-bridge-lattice-rail")
  for tower in towers:
    c = np.array(tower.centroid.coords[0])
    for angle in np.arange(0, math.tau, math.pi / 3):
      p = c + np.array([math.cos(angle), math.sin(angle)]) * 3.015
      tangent = math.pi / 2 - angle
      # Bounded round-headed window trim around retained upper glazing.
      for v in [-0.45, 0.45]:
        put(
          s,
          p + np.array([math.cos(tangent), -math.sin(tangent)]) * v,
          13.65,
          0.065,
          1.8,
          0.10,
          tangent,
          0xF2F0E7,
          "tower-window-white-jamb",
        )
      for t in np.linspace(0, math.pi, 9):
        pp = p + np.array([math.cos(tangent), -math.sin(tangent)]) * math.cos(t) * 0.45
        put(
          s,
          pp,
          14.54 + math.sin(t) * 0.38,
          0.13,
          0.065,
          0.10,
          tangent,
          0xF2F0E7,
          "round-headed-tower-window",
        )
  return s


def museum_details():
  old = read(DATA / "grunewaldLandmarksV190.json")
  museum = next(q for q in old["sites"] if q["key"] == "museum")
  s = site(
    "bruecke-museum", "Brücke-Museum: concrete tie holes, olive glazing and oak portal"
  )
  for surf in museum["surfaces"]:
    if surf.get("kind") != "WallSurface":
      continue
    pts = np.array([p for t in surf["triangles"] for p in t])
    lo, hi = pts[:, 1].min(), pts[:, 1].max()
    a, b = max(
      ((a, b) for a in pts for b in pts),
      key=lambda q: np.linalg.norm((q[1] - q[0])[[0, 2]]),
    )
    d = b - a
    d[1] = 0
    length = np.linalg.norm(d)
    if length < 8.5 or hi - lo < 1.5:
      continue
    d /= length
    n = np.cross(d, [0, 1, 0])
    yaw = math.atan2(-d[2], d[0])
    # Concrete tie-hole dots occupy blank long walls, not the earlier glazing.
    for u in np.arange(1.1, length - 0.5, 1.8):
      for y in np.arange(lo + 0.75, hi - 0.3, 1.3):
        p = a + d * u + n * 0.035
        put(
          s,
          [p[0], p[2]],
          y,
          0.055,
          0.055,
          0.022,
          yaw,
          0x737A70,
          "concrete-formwork-tie-hole",
        )
  return s


def island_gardens(source):
  """Complete mapped garden identities; illustrative roses and interior woods.

  Existing V187 woods stay unchanged. Only the exact former V194 ground-only
  interior receives crowns; every new whole crown clears paths/water/buildings.
  """
  from scripts.build_surrounding_outlines import load_projected_polygon

  s = site(
    "pfaueninsel-gardens",
    "Pfaueninsel: rose gardens, aviaries and mapped interior woodland",
  )
  old = world(load_projected_polygon(GEO / "bounds-outskirts-v187.geojson"))
  domain = shape(source["island"]).difference(old)
  paths = unary_union([shape(p["geometry"]).buffer(5) for p in source["paths"]])
  buildings = unary_union(
    [
      shape(p["geometry"]).buffer(5)
      for p in source["polygons"]
      if p["tags"].get("building") or p["tags"].get("building:part")
    ]
  )
  water = unary_union(
    [
      shape(p["geometry"]).buffer(3)
      for p in source["polygons"]
      if p["tags"].get("natural") == "water" or p["tags"].get("water")
    ]
  )
  woods = unary_union(
    [
      shape(p["geometry"])
      for p in source["polygons"]
      if p["tags"].get("natural") == "wood" or p["tags"].get("landuse") == "forest"
    ]
  )
  clear = (
    woods.intersection(domain)
    .difference(paths)
    .difference(buildings)
    .difference(water)
    .buffer(-4.5)
  )
  crowns = 0
  if not clear.is_empty:
    minx, minz, maxx, maxz = clear.bounds
    for x in np.arange(math.ceil(minx / 26) * 26, maxx, 26):
      for z in np.arange(math.ceil(minz / 26) * 26, maxz, 26):
        if not clear.covers(Point(x, z)):
          continue
        h = 11 + (int(x + z) % 4)
        r = 3.4
        put(
          s,
          [x, z],
          3 + h * 0.38,
          0.42,
          h * 0.76,
          0.42,
          0,
          0x7B735A,
          "illustrative-interior-tree-trunk",
        )
        # Faceted leafy crown, independent of the new native stepped crown.
        top = [x, 3 + h, z]
        bottom = [x, 3 + h * 0.48, z]
        rim = [
          [x + math.cos(a) * r, 3 + h * 0.76, z + math.sin(a) * r]
          for a in np.arange(0, math.tau, math.pi / 3)
        ]
        tris = []
        for a, b in zip(rim, rim[1:] + rim[:1]):
          tris.extend([[top, a, b], [bottom, b, a]])
        s["surfaces"].append(dict(color=0x71865C, triangles=tris))
        s.setdefault("nativeBoxes", []).extend(
          [
            [float(x), 3 + h * 0.62, float(z), 5.8, 3.2, 5.8, 0, 0x71865C],
            [float(x), 3 + h * 0.82, float(z), 4.2, 2.4, 4.2, 0, 0x71865C],
            [float(x), 3 + h * 0.96, float(z), 2.4, 1.4, 2.4, 0, 0x71865C],
          ]
        )
        crowns += 1
  for p in source["polygons"]:
    tags = p["tags"]
    g = shape(p["geometry"])
    if tags.get("name") in {"Rosengarten", "Ergänzungs-Rosengarten"}:
      inside = g.buffer(-1.2).difference(paths).difference(buildings)
      if inside.is_empty:
        continue
      minx, minz, maxx, maxz = inside.bounds
      for x in np.arange(math.ceil(minx / 4) * 4, maxx, 4):
        for z in np.arange(math.ceil(minz / 4) * 4, maxz, 4):
          if inside.covers(box(x - 0.4, z - 0.4, x + 0.4, z + 0.4)):
            put(
              s, [x, z], 3.30, 0.65, 0.55, 0.65, 0, 0x69825A, "illustrative-rose-shrub"
            )
            for dx, dz in [(-0.16, -0.1), (0.17, 0.12), (0.08, -0.2)]:
              put(
                s,
                [x + dx, z + dz],
                3.62,
                0.13,
                0.13,
                0.13,
                0,
                0xD9A6AE,
                "illustrative-rose-bloom",
              )
    if tags.get("name") in {"Voliere", "Pfauenhaus"} and tags.get("building"):
      # Open mesh-wire cues around exact mapped aviaries, no opaque new body.
      for line in line_parts(g.boundary):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          length = math.dist(a, b)
          if length < 0.2:
            continue
          d = (np.array(b) - a) / length
          yaw = math.atan2(-d[1], d[0])
          height = 6 if tags.get("name") == "Voliere" else 4
          for u in np.arange(0, length, 1.4):
            put(
              s,
              np.array(a) + d * u,
              3 + height / 2,
              0.035,
              height,
              0.035,
              0,
              0x647B6C,
              "mapped-aviary-wire-post",
            )
          for y in np.arange(3.5, 3 + height, 0.65):
            put(
              s,
              (np.array(a) + np.array(b)) / 2,
              y,
              length,
              0.018,
              0.018,
              yaw,
              0x7C9080,
              "mapped-aviary-wire-course",
            )
  s["nativeBoxes"] = cardinal_rows(s["boxes"]) + s.get("nativeBoxes", [])
  s["illustrativeTreeCount"] = crowns
  return s


def measured_site(source, key="kunsthaus-dahlem"):
  names = {
    "kunsthaus-dahlem": "Kunsthaus Dahlem: complete former Breker studio and annex",
    "kavalierhaus": "Kavalierhaus: complete measured neo-Gothic wings and gables",
    "meierei": "Meierei: complete measured Gothic dairy",
    "maschinenhaus": "Maschinenhaus: complete measured pumping-house and turret",
    "luisentempel": "Luisentempel: source gabled roof and open Doric portico",
  }
  s = site(key, names[key])
  # Retain exact main-house local datum from the existing source-bound terrain.
  families = (
    source["kunsthaus"]
    if key == "kunsthaus-dahlem"
    else [source["islandFamilies"][key]]
  )
  main = next(q for q in source["oldKunsthaus"] if q["sourceId"] == "OSM-way-32212224")
  anchor = shape(main["geometry"]).representative_point()
  base = 3 + round(offset_at(anchor.x, anchor.y), 2) if key == "kunsthaus-dahlem" else 3
  datum = min(p["ground_y_m"] for f in families for p in f["parts"])
  shift = base - datum
  parts = []
  for family in families:
    for p in family["parts"]:
      part = {
        **p,
        "parent": family["id"],
        "groundY": p["ground_y_m"] + shift,
        "topY": p["top_y_m"] + shift,
      }
      parts.append(part)
      for sheet in p["surfaces"]:
        rings = [
          [[x, round(y + shift, 3), z] for x, y, z in ring] for ring in sheet["rings"]
        ]
        color = (
          {
            "kunsthaus-dahlem": 0xB9AC87,
            "kavalierhaus": 0xD8CEAF,
            "meierei": 0xE5E4D5,
            "maschinenhaus": 0xAD8D69,
            "luisentempel": 0xD7D5C2,
          }[key]
          if sheet["kind"] == "WallSurface"
          else 0x6F7064
        )
        if key == "luisentempel" and sheet["kind"] != "RoofSurface":
          # The retained LoD2 closes an entire rectangular portico. The actual
          # structure has four front columns, a rear wall and open sides.
          # Retain original sheets as evidence; use the exact rear sheet and
          # source pediments, never a circular eight-column monopteros.
          pts = np.array(rings[0])
          height = float(pts[:, 1].max() - pts[:, 1].min())
          if height > 2 and float(pts[:, 2].mean()) > 8696:
            continue
          if height > 2 and float(pts[:, 0].max() - pts[:, 0].min()) < 4:
            continue
        s["surfaces"].append(
          dict(
            color=color,
            triangles=triangles_for(rings),
            owner=family["id"],
            part=p["id"],
            kind=sheet["kind"],
          )
        )
        if sheet["kind"] != "WallSurface":
          continue
        pts = np.array(rings[0])
        a, b = max(
          ((a, b) for a in pts for b in pts),
          key=lambda q: np.linalg.norm((q[1] - q[0])[[0, 2]]),
        )
        d = b - a
        d[1] = 0
        length = np.linalg.norm(d)
        if length < 3:
          continue
        d /= length
        n = np.cross(d, [0, 1, 0])
        yaw = math.atan2(-d[2], d[0])
        lo, hi = pts[:, 1].min(), pts[:, 1].max()

        # Full source plane containment, including every hole and roof slope.
        def projection(r):
          return [(float(np.dot(np.array(v) - a, d)), float(v[1])) for v in r]

        plane = Polygon(projection(rings[0]), [projection(r) for r in rings[1:]])

        def pane(u, y, w, h, c, role, depth=0.07):
          if plane.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
            p = a + d * u + n * (0.035 + depth / 2)
            put(s, [p[0], p[2]], y, w, h, depth, yaw, c, role)

        pane(length / 2, hi - 0.18, length - 0.1, 0.20, 0xCEC4A6, "stone-cornice")
        # Monumental tall studio windows, not a generic office storey grid.
        height = hi - lo
        if key == "kunsthaus-dahlem" and height > 7.5:
          for u in np.arange(2.4, length - 1.5, 4.4):
            pane(
              u,
              lo + height * 0.54,
              2.6,
              height * 0.64,
              0x696F67,
              "studio-window-reveal",
            )
            pane(
              u,
              lo + height * 0.54,
              2.32,
              height * 0.59,
              0x7F9695,
              "tall-northlight-glazing",
              0.10,
            )
            for dx in [-0.78, 0, 0.78]:
              pane(
                u + dx,
                lo + height * 0.54,
                0.055,
                height * 0.59,
                0xC1B797,
                "studio-window-mullion",
                0.13,
              )
        elif height > 3 and key != "luisentempel":
          floors = max(1, round(height / (3.3 if key != "kavalierhaus" else 3.8)))
          for level in range(floors):
            for u in np.arange(1.6, length - 1, 3.3):
              y = lo + (level + 0.55) * height / floors
              pane(
                u,
                y,
                0.86,
                min(1.5, height / floors * 0.54),
                0x66736E,
                "source-bound-heritage-window",
              )
        # Course accents retain pale yellow brick; never blanket new facade paint.
        if key in {"kunsthaus-dahlem", "maschinenhaus"}:
          for y in np.arange(lo + 0.5, hi - 0.3, 0.72):
            pane(
              length / 2,
              y,
              length - 0.1,
              0.018,
              0xAFA482,
              "restrained-brick-course",
              0.024,
            )
  if key == "luisentempel":
    p = families[0]["parts"][0]
    a = np.array(p["ring"][0])
    b = np.array(p["ring"][3])
    d = (b - a) / np.linalg.norm(b - a)
    length = np.linalg.norm(b - a)
    yaw = math.atan2(-d[1], d[0])
    rooflow = min(
      p[1]
      for q in s["surfaces"]
      if q.get("kind") == "RoofSurface"
      for t in q["triangles"]
      for p in t
    )
    rear_a = np.array(p["ring"][1])
    rear_b = np.array(p["ring"][2])
    rear = (rear_a + rear_b) / 2
    put(
      s,
      rear,
      (base + rooflow) / 2,
      float(np.linalg.norm(rear_b - rear_a)),
      rooflow - base,
      0.18,
      yaw,
      0xD7D5C2,
      "portico-rear-wall-thickness",
    )
    for u in np.linspace(0.65, length - 0.65, 4):
      pt = a + d * u
      put(
        s,
        pt,
        (base + rooflow) / 2,
        0.66,
        rooflow - base,
        0.66,
        yaw,
        0xD7D5C2,
        "open-Doric-portico-column",
      )
      put(s, pt, base + 0.18, 0.85, 0.36, 0.85, yaw, 0xD7D5C2, "Doric-column-base")
      put(s, pt, rooflow - 0.18, 0.9, 0.36, 0.9, yaw, 0xD7D5C2, "Doric-column-capital")
  shell = shell_native(s["surfaces"])
  fittings = cardinal_rows(s["boxes"])
  s["nativeBoxes"] = shell + fittings
  # Actual rendered native wall/roof columns, retained for matching navigation.
  columns = {}
  for x, y, z, w, h, d, _, _ in shell + (fittings if key == "luisentempel" else []):
    key = (x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    low, high = columns.get(key, (math.inf, -math.inf))
    columns[key] = (min(low, y - h / 2), max(high, y + h / 2))
  s["nativeColumns"] = [[*k, *v] for k, v in sorted(columns.items())]
  s["parts"] = parts
  s["datumOffset"] = shift
  return s


def position_keys(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [b"".join(sorted(q.tobytes() for q in t)) for t in p[ix]]


def elevated_keys(mesh, origin, navigation):
  """Replay V190's actual first contributing source-owner datum, per triangle.

  A party-wall triangle can legitimately inherit the neighbouring owner's rigid
  offset in that published constructor. Do not invent a tolerance or discard it.
  """
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  owners = [
    (
      translate(Polygon(q["ring"], q["holes"]), origin[0], origin[2]).buffer(0.1),
      q.get("groundOffset", 0),
    )
    for q in navigation
  ]
  result = []
  for tri in p[ix]:
    centre = Point(
      float(tri[:, 0].mean()) / 100 + origin[0],
      float(tri[:, 2].mean()) / 100 + origin[2],
    )
    dy = next((dy for g, dy in owners if g.covers(centre)), None)
    if dy is None:
      raise ValueError(
        f"Unowned old building triangle datum at {centre.wkt}; bounds {[g.bounds for g, _ in owners]}"
      )
    moved = tri.copy()
    moved[:, 1] += round(dy * 100)
    result.append(b"".join(sorted(q.tobytes() for q in moved)))
  return result


def packet_plans(source, models):
  manifest = read(GEO / "public-fidelity-v326-published206-manifest.json.gz")
  allold = source["oldKunsthaus"] + source["oldIsland"]
  newshapes = [
    Polygon(p["ring"], p["holes"]) for m in models.values() for p in m.get("parts", [])
  ]
  rootids = {
    q["id"]
    for q in manifest["chunks"]
    if not q.get("detailCompanionOf")
    and (
      any(
        shape(r["geometry"]).intersection(box(*q["bounds"])).area > 0.00001
        for r in allold
      )
      or any(g.intersection(box(*q["bounds"])).area > 0.00001 for g in newshapes)
    )
  }
  descs = [
    q
    for q in manifest["chunks"]
    if q["id"] in rootids or q.get("detailCompanionOf") in rootids
  ]
  plans = {}
  proof = []
  for rootid in sorted(rootids):
    ds = [q for q in descs if q["id"] == rootid or q.get("detailCompanionOf") == rootid]
    subsource = {
      **source,
      "oldKunsthaus": [
        r
        for r in allold
        if shape(r["geometry"]).intersection(box(*ds[0]["bounds"])).area > 0.00001
      ],
    }
    relevant = [
      m
      for m in models.values()
      if any(
        Polygon(p["ring"], p["holes"]).intersection(box(*ds[0]["bounds"])).area
        > 0.00001
        for p in m.get("parts", [])
      )
    ]
    model = dict(
      parts=[{**p, "siteKey": m["key"]} for m in relevant for p in m["parts"]],
      surfaces=[s for m in relevant for s in m["surfaces"]],
      nativeColumns=[c for m in relevant for c in m["nativeColumns"]],
      openBoxes=[r for m in relevant if m["key"] == "luisentempel" for r in m["boxes"]],
    )
    p, e = packet_family_plans(subsource, model, ds, rootid)
    plans.update(p)
    proof.extend(e)
  return dict(schemaVersion=1, keys=list(plans), packets=plans), proof


def packet_family_plans(source, model, descs, rootid):
  owners = {r["sourceId"] for r in source["oldKunsthaus"]}
  parents = sorted({p["parent"] for p in model["parts"]})
  paths = [PUBLIC / q[mode]["url"] for q in descs for mode in ["drawn", "minecraft"]]
  preds = prepared_packets(paths)
  plans = {}
  proof = []
  # Exact source-native cells, with all actual neighbouring navigation owners.
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    packets = [read(PUBLIC / q[mode]["url"]) for q in descs]
    primary = packets[0]
    ox, oy, oz = primary["origin"]
    tile = box(ox, oz, ox + 512, oz + 512)
    expected = Counter()
    ink = Counter()
    oldnav = [b for b in primary["nav"]["buildings"] if b["sourceId"] in owners]
    assert {b["sourceId"] for b in oldnav} == owners
    for old in source["oldKunsthaus"]:
      g = shape(old["geometry"])
      nav = next(q for q in oldnav if q["sourceId"] == old["sourceId"])
      if native:
        original_cells = native_polygon(g)
        g = unary_union(
          [
            translate(Polygon(q["ring"], q["holes"]), ox, oz)
            for q in oldnav
            if q["sourceId"] == old["sourceId"]
          ]
        )
        if g.difference(original_cells).area > 1e-8:
          raise ValueError("Actual old native footprint escaped original cell support")
        # Coverage-clipped native cells retain the actual delivered footprint;
        # a whole source footprint is not proof that an absent island cell exists.
        foreign = unary_union(
          [
            translate(Polygon(q["ring"], q["holes"]), ox, oz)
            for q in primary["nav"]["buildings"]
            if q["sourceId"] not in owners
          ]
        )
        if g.intersection(foreign).area > 1e-8:
          raise ValueError(
            "A native replacement cell also has a foreign contributor "
            + str(
              [
                (
                  q["sourceId"],
                  g.intersection(
                    translate(Polygon(q["ring"], q["holes"]), ox, oz)
                  ).area,
                )
                for q in primary["nav"]["buildings"]
                if q["sourceId"] not in owners
                and g.intersection(
                  translate(Polygon(q["ring"], q["holes"]), ox, oz)
                ).area
                > 1e-8
              ]
            )
          )
        if g.symmetric_difference(original_cells.intersection(tile)).area == 0:
          g = original_cells
      g = g.intersection(tile)
      base = 3
      top = base + (max(2, round(old["height"] / 2) * 2) if native else old["height"])
      p = PackedMesh(ox, oz)
      p.building(g, base, top, orient_polygons(g, exterior_cw=True).boundary)
      q = p.payload("city")
      expected.update(elevated_keys(q, primary["origin"], primary["nav"]["buildings"]))
      if not native:
        for line in line_parts(g.boundary):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            midpoint = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            dy = next(
              q.get("groundOffset", 0)
              for q in primary["nav"]["buildings"]
              if translate(Polygon(q["ring"], q["holes"]), ox, oz)
              .buffer(0.1)
              .covers(midpoint)
            )
            v = np.array(
              [
                [
                  round((x - ox) * 100),
                  round((top + dy + 0.02 - oy) * 100),
                  round((z - oz) * 100),
                ]
                for x, z in [a, b]
              ],
              dtype="<u2",
            )
            ink[b"".join(sorted(vv.tobytes() for vv in v))] += 1
    initial = sum(expected.values())
    total = 0
    for desc, p in zip(descs, packets):
      path = PUBLIC / desc[mode]["url"]
      pred = preds[str(path)]
      prepared = pred["prepared"]
      retire = []
      for mi, m in enumerate(prepared["meshes"]):
        if m["kind"] != "city":
          continue
        selected = []
        for i, k in enumerate(position_keys(m)):
          if expected[k]:
            expected[k] -= 1
            selected.append(i)
        if selected:
          retire.append(dict(mesh=mi, triangles=selected))
          total += len(selected)
      lines = []
      if not native and prepared.get("lines"):
        ps = np.frombuffer(
          base64.b64decode(prepared["lines"]["positions"]), "<u2"
        ).reshape(-1, 2, 3)
        for i, vs in enumerate(ps):
          k = b"".join(sorted(v.tobytes() for v in vs))
          if ink[k]:
            ink[k] -= 1
            lines.append(i)
      if not retire and not lines and desc["id"] != rootid:
        continue
      nav = [b for b in prepared["nav"]["buildings"] if b["sourceId"] in owners]
      appendnav = []
      if desc["id"] == rootid:
        if native:
          for x0, z0, x1, z1, lo, hi in model["nativeColumns"]:
            appendnav.append(
              dict(
                ring=[
                  [x0 - ox, z0 - oz],
                  [x1 - ox, z0 - oz],
                  [x1 - ox, z1 - oz],
                  [x0 - ox, z1 - oz],
                ],
                holes=[],
                minHeight=lo - 3,
                height=hi - 3,
                sourceId="kunsthaus-native-v326",
                nativeRoofCaps=[[x0 - ox, z0 - oz, x1 - ox, z1 - oz, hi - 3]],
              )
            )
        else:
          for part in model["parts"]:
            for poly in polygons_from_geometry(
              Polygon(part["ring"], part["holes"]).intersection(tile)
            ):
              local = translate(poly, -ox, -oz)
              roofs = [
                t
                for s in model["surfaces"]
                if s.get("part") == part["id"] and s.get("kind") == "RoofSurface"
                for t in s["triangles"]
              ]
              bottom = (
                min(p[1] for t in roofs for p in t) - 0.16
                if part.get("siteKey") == "luisentempel"
                else part["groundY"]
              )
              appendnav.append(
                dict(
                  ring=[list(v) for v in list(local.exterior.coords)[:-1]],
                  holes=[
                    [list(v) for v in list(r.coords)[:-1]] for r in local.interiors
                  ],
                  minHeight=bottom - 3,
                  height=part["topY"] - 3,
                  sourceId=part["parent"] + ":" + part["id"],
                  roofTriangles=[
                    [[p[0] - ox, p[1] - 3, p[2] - oz] for p in t] for t in roofs
                  ],
                )
              )
          for x, y, z, w, h, d, yaw, _ in model.get("openBoxes", []):
            ring = [
              [
                x + math.cos(yaw) * u + math.sin(yaw) * v - ox,
                z - math.sin(yaw) * u + math.cos(yaw) * v - oz,
              ]
              for u, v in [
                (-w / 2, -d / 2),
                (w / 2, -d / 2),
                (w / 2, d / 2),
                (-w / 2, d / 2),
              ]
            ]
            appendnav.append(
              dict(
                ring=ring,
                holes=[],
                minHeight=y - h / 2 - 3,
                height=y + h / 2 - 3,
                sourceId="luisentempel-open-portico-v326",
              )
            )

      def rec(q):
        return [
          dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
          for i, m in enumerate(q["meshes"])
        ]

      plans[mode + ":" + desc["id"]] = dict(
        origin=p["origin"],
        records=rec(p),
        preparedRecords=rec(prepared),
        navGuard=pred["navGuard"],
        lineGuard=pred["lineGuard"],
        preparedNavGuard=pred["preparedNavGuard"],
        preparedLineGuard=pred["preparedLineGuard"],
        retire=retire,
        retireLines=lines,
        retireNav=nav,
        appendNav=appendnav,
        owners=parents,
      )
      proof.append(
        dict(
          key=mode + ":" + desc["id"],
          sourceSha256=sha(path),
          retiredTriangles=sum(len(r["triangles"]) for r in retire),
          retiredLines=len(lines),
          oldNavigation=nav,
        )
      )
    if +expected:
      missing = [np.frombuffer(k, "<u2").reshape(-1, 3).tolist() for k in (+expected)]
      raise ValueError(
        f"{rootid} {mode}: {sum((+expected).values())}/{initial} missing exact old body triangles; matched {total}; missing{missing}"
      )
    if +ink:
      raise ValueError(f"Missing {sum((+ink).values())} old ink")
  return plans, proof


def build():
  source = extract_sources()
  landscape, path, routes = path_landscape(source)
  sites = [
    landscape,
    castle_details(source),
    museum_details(),
    island_gardens(source),
    *[
      measured_site(source, k)
      for k in [
        "kunsthaus-dahlem",
        "kavalierhaus",
        "meierei",
        "maschinenhaus",
        "luisentempel",
      ]
    ],
  ]
  for s in sites:
    s.setdefault("nativeBoxes", cardinal_rows(s["boxes"]))
    s.setdefault("nativeSurfaces", [])
  plans, packetproof = packet_plans(source, {s["key"]: s for s in sites})
  write(GEO / "southwest-sites-v326-source.json.gz", source)
  write(
    DATA / "southWestSitesV326.json",
    dict(
      schemaVersion=1,
      sites=sites,
      peacocks=routes,
      references=references(),
      sourceSha256=sha(GEO / "southwest-sites-v326-source.json.gz"),
    ),
  )
  write(DATA / "southWestSitesV326Packets.json", plans)
  write(
    GEO / "southwest-sites-v326-evidence.json",
    dict(
      schemaVersion=1,
      preservedInputs=source["preservedInputs"],
      packets=packetproof,
      sites=[
        dict(
          key=s["key"],
          drawnBoxes=len(s["boxes"]),
          nativeBoxes=len(s["nativeBoxes"]),
          surfaces=len(s["surfaces"]),
        )
        for s in sites
      ],
      pathArea=path.area,
      routeCount=len(routes),
      references=references(),
      policy="All old island/museum source and authored detail remains immutable. Exactly five old fallback owners at Kunsthaus (2), Meierei (1) and Maschinenhaus (2, including its source building part) retire after private complete model admission. Complete measured families replace them. All unmeasured fittings, added tree positions, path widths and peacock population/routes are illustrative. No reference pixels.",
    ),
  )
  print([(s["key"], len(s["boxes"]), len(s["nativeBoxes"])) for s in sites])
  print("plans", len(plans["keys"]))


if __name__ == "__main__":
  build()
