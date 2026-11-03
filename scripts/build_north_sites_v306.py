"""Finite northern school, memorial and park source refinements, Step 10.

Only v306 derivatives are written. Original LoD2/OSM/terrain evidence and every
published packet remain immutable. Photographs are external references only.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely import make_valid
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, transform, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_karl_marx_allee_v161 import Detail
from scripts.build_rixdorf_v304 import merge_caps
from scripts.build_surrounding_outlines import load_projected_polygon, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/north-v306"
SOURCE = GEO / "north-sites-v306-source.json.gz"
HOUSING = [
  42496471,
  42496472,
  18676873,
  18676769,
  118620586,
  125758990,
  125972756,
  125972757,
]


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def tags(row: Any) -> dict[str, str]:
  return dict(
    re.findall(
      r'"([^\"]+)"=>"([^\"]*)"',
      row.other_tags if isinstance(row.other_tags, str) else "",
    )
  )


def extract() -> dict[str, Any]:
  """Keep complete exact school families and the finite eight housing owners."""
  candidate = GEO / "raw/outer-v159/candidate.gpkg"
  ids = [111657919, 145641190, 24634435, *HOUSING]
  selected = pyogrio.read_dataframe(
    candidate,
    layer="multipolygons",
    where="osm_way_id IN (" + ",".join("'" + str(i) + "'" for i in ids) + ")",
  ).to_crs(25833)
  osm = {}
  for row in selected.itertuples():
    key = str(row.osm_way_id)
    osm[key] = dict(
      name=row.name if isinstance(row.name, str) else "",
      id="way/" + key,
      tags=tags(row),
      geometry=mapping(world(row.geometry)),
    )
  assert set(osm) == set(map(str, ids))
  school = shape(osm["111657919"]["geometry"])
  archive = RAW / "LoD2_387_5824.zip"
  parents = []
  with zipfile.ZipFile(archive) as zipped:
    member = next(n for n in zipped.namelist() if n.lower().endswith(("gml", "xml")))
    with zipped.open(member) as stream:
      for _, element in ET.iterparse(stream, events=("end",)):
        if element.tag != f"{{{NS['bldg']}}}Building":
          continue
        rings = []
        for ground in element.findall(".//bldg:GroundSurface//gml:Polygon", NS):
          coords = ground.find("gml:exterior//gml:posList", NS)
          if coords is not None:
            v = list(map(float, coords.text.split()))
            rings.append(
              Polygon([(x - 389500, 5820000 - z) for x, z in zip(v[::3], v[1::3])])
            )
        footprint = unary_union(rings)
        if (
          not footprint.is_empty
          and footprint.intersection(school).area > 8
          and footprint.intersection(school).area / footprint.area > 0.65
        ):
          parts = [part_profile(p) for p in leaf_building_parts(element) or [element]]
          parents.append(
            dict(
              id=element.get(GML_ID),
              parts=parts,
              archive=archive.name,
              schoolCoverage=footprint.intersection(school).area / footprint.area,
            )
          )
        element.clear()
  assert parents
  # Every older rendered footprint is excluded exactly; the outline alone is
  # not mistaken for filled Berlin-wide building coverage.
  manifest = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  previous = unary_union(
    [make_valid(Polygon(p["ring"], p["holes"])) for p in manifest["footprint"]]
  ).union(world(load_projected_polygon(GEO / "bounds.geojson")))
  buildings = unary_union(
    [Polygon(p["ring"], p["holes"]) for q in parents for p in q["parts"]]
  )
  requested = school.union(buildings)
  new = requested.difference(previous)
  inverse = Transformer.from_crs(25833, 4326, always_xy=True).transform
  geo = transform(inverse, affine_transform(new, [1, 0, 0, -1, 389500, 5820000]))
  write(
    GEO / "bounds-named-v306.geojson",
    dict(
      type="FeatureCollection",
      features=[
        dict(
          type="Feature",
          properties=dict(
            revision="v306",
            name="Lessing-Gymnasium",
            scope="Exact mapped Schöningstraße17 school parcel and complete named LoD2 families; previous filled source footprint subtracted",
            osm="way/111657919",
            areaM2=round(new.area, 6),
            requestedAreaM2=round(requested.area, 6),
            oldOverlapM2=round(requested.intersection(previous).area, 6),
          ),
          geometry=mapping(geo),
        )
      ],
    ),
  )
  # House fittings follow existing complete owners, not new district infill.
  old_path = GEO / "raw/outer-v159/resolved-outlines.gpkg"
  old = pyogrio.read_dataframe(
    old_path, layer="buildings", bbox=(3800, -2700, 4450, -1850)
  )
  housing = []
  for key in HOUSING:
    target = shape(osm[str(key)]["geometry"])
    hits = []
    for r in old.itertuples():
      overlap = r.geometry.intersection(target).area
      if overlap > 3 and overlap / min(r.geometry.area, target.area) > 0.45:
        hits.append(
          dict(
            id=r.sourceId,
            height=float(r.height),
            sourceGroundY=float(r.sourceGroundY),
            heightSource=r.heightSource,
            geometry=mapping(r.geometry),
            mappedCoverage=overlap / target.area,
          )
        )
    assert hits, key
    housing.append(
      dict(
        osm=str(key),
        levels=int(osm[str(key)]["tags"]["building:levels"]),
        predecessors=hits,
      )
    )
  pool = [
    dict(
      id=r.sourceId,
      height=float(r.height),
      sourceGroundY=float(r.sourceGroundY),
      geometry=mapping(r.geometry),
    )
    for r in old.itertuples()
    if r.sourceId == "DEBE03YY60000BxN"
  ]
  assert len(pool) == 1
  streets = pyogrio.read_dataframe(
    candidate, layer="lines", where="name IN ('Schöningstraße','Greifswalder Straße')"
  ).to_crs(25833)
  road_geometries = {
    name: mapping(world(unary_union(streets[streets.name == name].geometry)))
    for name in ["Schöningstraße", "Greifswalder Straße"]
  }
  result = dict(
    schemaVersion=1,
    school=dict(
      parents=parents,
      parcel=osm["111657919"],
      newFootprint=mapping(new),
      requestedFootprint=mapping(requested),
      priorOverlapM2=requested.intersection(previous).area,
    ),
    housing=housing,
    swimmingHallPredecessors=pool,
    osm=osm,
    roads=road_geometries,
    sourceFiles={
      str(p.relative_to(ROOT)): sha(p) for p in [candidate, old_path, archive]
    },
    officialArchive=dict(
      url="https://gdi.berlin.de/data/a_lod2/atom/" + archive.name,
      sha256=sha(archive),
      license="dl-de/zero-2-0",
    ),
    references=[
      dict(
        url="https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?IDSchulzweig=30422",
        credit="Senatsverwaltung für Bildung, Jugend und Familie",
        use="Current01Y08 Schöningstraße17 identity; historical Pankstraße school is distinct",
      ),
      dict(
        url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030319",
        credit="Landesdenkmalamt Berlin, LDA2004 photograph",
        imageSha256=sha(RAW / "lessing-lda.jpg"),
        use="Two distinct school houses, three courts, rusticated stone entrance, three arches, Ionic pilasters, mansard roof and triangular dormer; fine dimensions estimated",
      ),
      dict(
        url="https://www.wbm.de/neubau-berlin/plattenbau/ernst-thaelmann-park/",
        credit="WBM",
        use="WBS70 high-rises and eight-storey courtyard slabs; old native source materials retained",
      ),
      dict(
        url="https://www.berlin.de/museum-pankow/geschichte-vor-ort/gedenktafeln/2023/artikel.1504809.php",
        credit="Museum Pankow",
        use="LewKerbel monument, raised fist and flag,14m overall; critical historical context",
      ),
      dict(
        url="https://www.berlin.de/sehenswuerdigkeiten/5589940-3558930-ernstthaelmanndenkmal.html",
        credit="Berlin.de / dpa",
        imageSha256=sha(RAW / "thaelmann-berlin-dpa.jpg"),
        use="Reference-only bronze bust, raised fist, swept flag and three-step granite plinth; no image pixels or changing graffiti copied",
      ),
      dict(
        url="https://www.berlinerbaeder.de/baeder/detail/schwimmhalle-ernst-thaelmann-park/",
        credit="Berliner Bäder-Betriebe",
        use="Lilli-Henoch-Straße20, two-storey1986 building and2023 refurbishment; no opening schedule bundled",
      ),
      dict(
        url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
        credit="Geoportal Berlin DOP2025 dl-de/zero-2-0",
        images={n: sha(RAW / n) for n in ["lessing-dop2025.png", "estate-dop2025.png"]},
        use="Roof/court/parcel QA only; no photographic pixels shipped",
      ),
    ],
    policy="Complete original school surfaces retained; existing housing bodies, roofs and source paint remain. Small openings, relief and statue proportions are explicit reference-guided estimates. No textures, timer, new tour stop or broad district fill.",
  )
  write(SOURCE, result)
  print(
    dict(
      parents=len(parents),
      parts=sum(len(p["parts"]) for p in parents),
      schoolNewArea=new.area,
      housingOwners=sum(len(h["predecessors"]) for h in housing),
    )
  )
  return result


def rgb(value: int) -> tuple[int, int, int]:
  return value >> 16 & 255, value >> 8 & 255, value & 255


def pack(detail: Detail) -> dict[str, Any]:
  """Float32 world coordinates, exact complete topology and linear vertex paint."""
  positions, colors, indices, lookup = [], [], [], {}
  from scripts.build_ost_housing_v301 import linear

  for triangle, color, _ in detail.triangles:
    tint = linear((color[0] << 16) | (color[1] << 8) | color[2])
    normal = np.cross(
      np.array(triangle[1], dtype=float) - triangle[0],
      np.array(triangle[2], dtype=float) - triangle[0],
    )
    length = np.linalg.norm(normal)
    if length > 1e-9:
      normal /= length
      weights = [
        0.83 if normal[0] >= 0 else 0.73,
        1.0 if normal[1] >= 0 else 0.66,
        0.91 if normal[2] >= 0 else 0.79,
      ]
      shade = sum(abs(n) * w for n, w in zip(normal, weights)) / sum(abs(normal))
    else:
      shade = 1.0
    color = tuple(round(v * shade) for v in tint)
    for v in triangle:
      key = tuple(v) + tuple(color)
      if key not in lookup:
        lookup[key] = len(positions)
        positions.append(v)
        colors.append(color)
      indices.append(lookup[key])
  return dict(
    position=base64.b64encode(np.array(positions, dtype="<f4").tobytes()).decode(),
    color=base64.b64encode(np.array(colors, dtype="u1").tobytes()).decode(),
    index=base64.b64encode(np.array(indices, dtype="<u4").tobytes()).decode(),
    vertices=len(positions),
    triangles=len(indices) // 3,
  )


def native_surface(detail: Detail) -> tuple[Detail, list]:
  """Independent hollow one-metre cells, merged only into exact rectangles.

  Greedy unit-face rectangles keep concave window/roof holes exactly, avoiding
  a floating-point polygon-union triangulation of touching voxel boundaries.
  """
  from collections import defaultdict

  cells, caps = {}, {}
  for triangle, color, role in detail.triangles:
    a, b, c = np.array(triangle)
    normal = np.cross(b - a, c - a)
    mag = np.linalg.norm(normal)
    if mag < 1e-9:
      continue
    normal /= mag
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.45
      ),
    )
    ii, jj = np.triu_indices(steps + 1)
    points = (
      a
      + (ii / steps)[:, None] * (b - a)
      + ((jj - ii) / steps)[:, None] * (c - a)
      + normal * 0.01
    )
    for row in np.unique(np.floor(points - [0, 3, 0]).astype(int), axis=0):
      k = tuple(map(int, row))
      cells[k] = color
      if role == "source RoofSurface":
        caps[(k[0], k[2])] = max(caps.get((k[0], k[2]), -math.inf), k[1] + 4)
  faces = defaultdict(set)
  for xyz, color in cells.items():
    for axis in range(3):
      rest = [i for i in range(3) if i != axis]
      for sign in [-1, 1]:
        other = list(xyz)
        other[axis] += sign
        if tuple(other) in cells:
          continue
        plane = xyz[axis] + (1 if sign > 0 else 0) + (3 if axis == 1 else 0)
        u, v = (xyz[k] + (3 if k == 1 else 0) for k in rest)
        faces[(axis, sign, plane, tuple(color))].add((u, v))
  out = Detail()
  out.native_cells = cells
  for (axis, sign, plane, color), squares in sorted(faces.items()):
    rows = defaultdict(list)
    for u, v in squares:
      rows[v].append(u)
    strips = defaultdict(list)
    for v, us in sorted(rows.items()):
      us = sorted(us)
      start = end = us[0]
      for u in [*us[1:], None]:
        if u is not None and u == end + 1:
          end = u
          continue
        strips[(start, end + 1)].append(v)
        start = end = u
    rest = [i for i in range(3) if i != axis]
    for (u0, u1), vs in sorted(strips.items()):
      start = end = vs[0]
      for v in [*vs[1:], None]:
        if v is not None and v == end + 1:
          end = v
          continue
        points = []
        for u, w in [(u0, start), (u1, start), (u1, end + 1), (u0, end + 1)]:
          p = [0.0, 0.0, 0.0]
          p[axis] = plane
          p[rest[0]] = u
          p[rest[1]] = w
          points.append(p)
        normal = np.cross(
          np.array(points[1]) - points[0], np.array(points[2]) - points[0]
        )
        if normal[axis] * sign < 0:
          points.reverse()
        out.polygon(points, color, "independent cardinal native cell rectangle")
        start = end = v
  return out, [[x, z, x + 1, z + 1, y] for (x, z), y in sorted(caps.items())]


def source_detail(source: dict[str, Any]) -> tuple[Detail, list[dict[str, Any]]]:
  result, nav = Detail(), []
  road = shape(source["roads"]["Schöningstraße"])
  occupied = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for q in source["school"]["parents"]
      for p in q["parts"]
    ]
  )
  for parent in source["school"]["parents"]:
    low = min(p["ground_y_m"] for p in parent["parts"])
    near = (
      min(Polygon(p["ring"], p["holes"]).distance(road) for p in parent["parts"]) < 8
    )
    for part in parent["parts"]:
      roofs = []
      for surface in part["surfaces"]:
        rings = [[[x, y - low + 3, z] for x, y, z in ring] for ring in surface["rings"]]
        tint = (
          0x777978
          if near and surface["kind"] == "RoofSurface"
          else (0xAA644C if surface["kind"] == "RoofSurface" else 0xDAD8C9)
        )
        triangles = triangles_for(rings)
        result.triangles.extend(
          (t, rgb(tint), "source " + surface["kind"]) for t in triangles
        )
        if surface["kind"] == "RoofSurface":
          roofs.extend(triangles)
        if surface["kind"] == "WallSurface":
          school_windows(result, rings, occupied, near, road)
      nav.append(
        dict(
          sourceId=parent["id"] + ":" + part["id"],
          ring=part["ring"],
          holes=part["holes"],
          low=3 + part["ground_y_m"] - low,
          high=3 + part["top_y_m"] - low,
          roofs=roofs,
        )
      )
  return result, nav


def school_ground_detail(
  source: dict[str, Any], native: bool = False
) -> tuple[Detail, list]:
  """Exact named parcel floor; its open courts are not new building fill."""
  ground = shape(source["school"]["requestedFootprint"])
  result = Detail()
  cells = []
  if not native:
    for g in [ground] if ground.geom_type == "Polygon" else ground.geoms:
      result.polygon(
        [[x, 3.015, z] for x, z in list(g.exterior.coords)[:-1]],
        rgb(0xB7B3A4),
        "mapped school parcel floor",
      )
  else:
    for x in range(math.floor(ground.bounds[0]), math.ceil(ground.bounds[2])):
      for z in range(math.floor(ground.bounds[1]), math.ceil(ground.bounds[3])):
        if ground.covers(box(x, z, x + 1, z + 1)):
          cells.append([x, z, x + 1, z + 1, 3.015])
    for x, z, x1, z1, y in merge_caps(cells):
      result.polygon(
        [[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]],
        rgb(0xB7B3A4),
        "independent cardinal school ground cell",
      )
  return result, cells


def school_windows(
  detail: Detail, rings: list, occupied: Any, street_house: bool, road: Any
) -> None:
  points = np.array(rings[0])
  a = points[np.argmin(points[:, 1])][[0, 2]]
  far = max((p[[0, 2]] for p in points), key=lambda p: np.linalg.norm(p - a))
  length = float(np.linalg.norm(far - a))
  if length < 3:
    return
  d = (far - a) / length
  n = np.array([-d[1], d[0]])
  mid = a + d * length / 2
  if occupied.contains(Point(mid + n * 0.15)):
    n = -n
  if occupied.contains(Point(mid + n * 0.15)):
    return
  plane = Polygon([[float(np.dot(p[[0, 2]] - a, d)), p[1]] for p in points])
  if not plane.is_valid:
    plane = plane.buffer(0)
  if plane.is_empty or plane.area < 12:
    return
  lo, hi = float(min(points[:, 1])), float(max(points[:, 1]))
  floors = 3 if street_house else 4
  if hi - lo < 8:
    return
  front = street_house and LineString([a, far]).distance(road) < 4
  columns = max(1, round(length / (3.0 if front else 3.25)))

  def panel(
    u: float, y: float, w: float, h: float, color: int, out: float = 0.10
  ) -> None:
    if not plane.buffer(0.015).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    q = []
    for du, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]:
      p = a + d * (u + du) + n * out
      q.append([float(p[0]), y + dy, float(p[1])])
    detail.polygon(q, rgb(color), "school source-supported fitting")

  for floor in range(floors):
    y = lo + (floor + 0.54) * (hi - lo - 0.45) / floors
    for col in range(columns):
      u = (col + 0.5) * length / columns
      if front and floor == 0 and abs(u - length / 2) < 4.1:
        continue
      panel(u, y, 1.56, 2.02, 0xECE9DD, 0.09)
      panel(u, y, 1.3, 1.78, 0x415961, 0.13)
      panel(u, y, 0.06, 1.78, 0xF0EDE1, 0.16)
      panel(u, y + 0.26, 1.3, 0.06, 0xF0EDE1, 0.16)
      panel(u, y - 0.33, 1.3, 0.05, 0xDCD9CD, 0.17)
      if front and floor > 0:
        panel(u, y - 1.05, 1.73, 0.11, 0xBEBBAA, 0.20)
        for q in [-0.48, -0.24, 0, 0.24, 0.48]:
          panel(u + q, y - 0.88, 0.06, 0.28, 0xC6C3B3, 0.23)
  if front:
    for col in range(columns + 1):
      u = col * length / columns
      panel(u, (lo + hi) / 2, 0.38, hi - lo - 0.5, 0xBEBBAA, 0.16)
      panel(u, hi - 0.45, 0.68, 0.22, 0xD8D3C3, 0.23)
    for centre in [-2.55, 0, 2.55]:
      u = length / 2 + centre
      outline = [[u - 1, lo + 0.1], [u + 1, lo + 0.1], [u + 1, lo + 1.8]]
      outline.extend(
        [[u + math.cos(t), lo + 1.8 + math.sin(t)] for t in np.linspace(0, math.pi, 13)]
      )
      if plane.buffer(0.01).covers(Polygon(outline)):
        q = []
        for x, y in outline:
          p = a + d * x + n * 0.28
          q.append([float(p[0]), y, float(p[1])])
        detail.polygon(q, rgb(0x293332), "three source-front entrance arches")


def memorial_detail(source: dict[str, Any]) -> tuple[Detail, list[dict[str, Any]]]:
  """Original bounded relief interpretation: head, fist, swept flag and plinth."""
  result = Detail()
  nav: list[dict[str, Any]] = []
  footprint = shape(source["osm"]["145641190"]["geometry"])
  centre = np.array(footprint.centroid.coords[0])
  road = shape(source["roads"]["Greifswalder Straße"])
  nearest = nearest_points(Point(centre), road)[1]
  n = np.array(nearest.coords[0]) - centre
  n = n / np.linalg.norm(n)
  d = np.array([n[1], -n[0]])

  def point(u: float, y: float, v: float) -> list[float]:
    p = centre + d * u + n * v
    return [float(p[0]), 3 + y, float(p[1])]

  def extrusion(
    ring: list[list[float]], back: float, front: float, tint: int, role: str
  ) -> None:
    ulo, uhi = min(p[0] for p in ring), max(p[0] for p in ring)
    nav.append(
      dict(
        sourceId="thaelmann-piece-" + str(len(nav)),
        ring=[
          [point(u, 0, v)[0], point(u, 0, v)[2]]
          for u, v in [(ulo, back), (uhi, back), (uhi, front), (ulo, front)]
        ],
        holes=[],
        low=3 + min(p[1] for p in ring),
        high=3 + max(p[1] for p in ring),
        roofs=[],
      )
    )
    pts = [point(u, y, front) for u, y in ring]
    result.polygon(pts, rgb(tint), role)
    result.polygon([point(u, y, back) for u, y in reversed(ring)], rgb(tint), role)
    for a, b in zip(ring, ring[1:] + ring[:1]):
      result.polygon(
        [point(*a, back), point(*b, back), point(*b, front), point(*a, front)],
        rgb(tint),
        role,
      )

  # Three shallow source-contained granite courses, no arbitrary square plaza.
  for k, (inset, y, h) in enumerate(
    [(0, 0, 0.25), (1.0, 0.25, 0.30), (2.6, 0.55, 0.45)]
  ):
    g = footprint.buffer(-inset, join_style=2)
    for part in [g] if g.geom_type == "Polygon" else g.geoms:
      ring = list(part.exterior.coords)[:-1]
      nav.append(
        dict(
          sourceId="thaelmann-step-" + str(k),
          ring=ring,
          holes=[],
          low=3 + y,
          high=3 + y + h,
          roofs=[],
        )
      )
      result.polygon(
        [[x, 3 + y + h, z] for x, z in ring], rgb(0xA29287), "granite plinth top"
      )
      for a, b in zip(ring, ring[1:] + ring[:1]):
        result.polygon(
          [
            [a[0], 3 + y, a[1]],
            [b[0], 3 + y, b[1]],
            [b[0], 3 + y + h, b[1]],
            [a[0], 3 + y + h, a[1]],
          ],
          rgb(0x8D7D73),
          "granite plinth side",
        )
  extrusion(
    [[-6, 1.0], [5.5, 1.0], [5.5, 2.85], [-6, 2.85]],
    -1.4,
    1.45,
    0x9B8E78,
    "name-bearing stone base",
  )
  flag = [
    [-6.4, 2.85],
    [-6.2, 13.6],
    [-5.8, 14],
    [-5.4, 13.6],
    [-5.2, 12.7],
    [-2.0, 12.45],
    [-0.1, 11.4],
    [-0.6, 8.6],
    [1.2, 6.4],
    [5.2, 4.2],
    [4.9, 2.85],
  ]
  extrusion(flag, -1.0, -0.45, 0x4C5B53, "swept bronze flag")
  for i, ring in enumerate(
    [
      [[-5.9, 12.35], [-3.5, 12.05], [-1.0, 11.25], [-3.2, 11.65]],
      [[-5.9, 10.9], [-3.1, 10.55], [-1.2, 9.2], [-3.9, 10.0]],
      [[-5.95, 8.8], [-3.6, 8.4], [-1.3, 6.9], [-4.5, 7.8]],
    ]
  ):
    extrusion(
      ring, -0.44, -0.20, 0x65766A if i % 2 == 0 else 0x3E4D47, "flag folded relief"
    )
  extrusion(
    [
      [-4.4, 2.85],
      [-4.0, 6.8],
      [-2.4, 8.2],
      [-0.5, 8.5],
      [0.1, 9.0],
      [1.0, 9.1],
      [1.8, 8.3],
      [3.1, 7.4],
      [5.2, 5.2],
      [5.4, 2.85],
    ],
    -0.3,
    1.3,
    0x526159,
    "bronze shoulders and coat",
  )
  head = [
    [-0.2, 8.4],
    [-0.65, 9.2],
    [-0.7, 10.6],
    [-0.45, 11.55],
    [0.2, 12.0],
    [1.2, 12.05],
    [2.05, 11.6],
    [2.4, 10.5],
    [2.15, 9.2],
    [1.55, 8.45],
    [0.6, 8.1],
  ]
  extrusion(head, 0.25, 2.1, 0x607064, "individual bronze head")
  extrusion(
    [[0.65, 9.45], [0.72, 10.65], [0.95, 11.0], [1.15, 9.65], [1.35, 9.4]],
    2.11,
    2.63,
    0x748175,
    "angular nose",
  )
  for u in [0.15, 1.65]:
    extrusion(
      [[u - 0.33, 10.7], [u + 0.28, 10.68], [u + 0.27, 10.85], [u - 0.35, 10.88]],
      2.12,
      2.28,
      0x35483D,
      "brow and eye relief",
    )
  extrusion(
    [[0.35, 9.15], [1.58, 9.15], [1.45, 9.0], [0.55, 8.97]],
    2.12,
    2.24,
    0x3F5145,
    "closed mouth relief",
  )
  extrusion(
    [
      [-4.4, 6.5],
      [-4.6, 8.0],
      [-4.15, 9.0],
      [-3.5, 9.45],
      [-2.45, 9.2],
      [-1.85, 8.3],
      [-2.05, 7.6],
      [-2.7, 7.1],
      [-2.9, 6.15],
    ],
    0.6,
    2.5,
    0x67786B,
    "raised clenched fist and wrist",
  )
  for i in range(4):
    u = -4.05 + i * 0.45
    extrusion(
      [[u, 8.2], [u + 0.34, 8.22], [u + 0.37, 8.8], [u + 0.03, 8.95]],
      2.51,
      2.65,
      0x728477,
      "four knuckle reliefs",
    )
  return result, nav


def build_models(source: dict[str, Any]) -> None:
  school, school_nav = source_detail(source)
  memorial, memorial_nav = memorial_detail(source)
  records = []
  profile = []
  for key, d, nav in [
    ("lessing", school, school_nav),
    ("thaelmann", memorial, memorial_nav),
  ]:
    n, caps = native_surface(d)
    if key == "lessing":
      floor, groundcells = school_ground_detail(source)
      nativefloor, groundcells = school_ground_detail(source, True)
      d.triangles.extend(floor.triangles)
      n.triangles.extend(nativefloor.triangles)
    records.append(dict(key=key, drawn=pack(d), native=pack(n)))
    native_nav = []
    if key == "thaelmann":
      # Native collision is the actual occupied one-metre cell skin, not the
      # smooth statue ring or one tall invisible monument bounding box.
      from collections import defaultdict

      levels = defaultdict(list)
      for x, y, z in n.native_cells:
        levels[y].append([x, z, x + 1, z + 1, y + 4])
      for y, cells in sorted(levels.items()):
        for i, (x, z, x1, z1, top) in enumerate(merge_caps(cells)):
          native_nav.append(
            dict(
              sourceId=f"thaelmann-native-{y}-{i}",
              ring=[[x, z], [x1, z], [x1, z1], [x, z1]],
              holes=[],
              low=y + 3,
              high=top,
              roofs=[],
              nativeCaps=[[x, z, x1, z1, top]],
            )
          )
    else:
      for item in nav:
        poly = Polygon(item["ring"], item["holes"])
        cells = [c for c in caps if box(*c[:4]).intersection(poly).area > 1e-6]
        if not cells:
          continue
        outline = unary_union([box(*c[:4]) for c in cells])
        for i, g in enumerate(
          [outline] if outline.geom_type == "Polygon" else outline.geoms
        ):
          native_nav.append(
            dict(
              sourceId=item["sourceId"] + f"-cardinal-{i}",
              ring=list(g.exterior.coords)[:-1],
              holes=[list(h.coords)[:-1] for h in g.interiors],
              low=math.floor(item["low"]),
              high=max(c[4] for c in cells),
              roofs=[],
              nativeCaps=merge_caps(
                [c for c in cells if g.intersection(box(*c[:4])).area > 1e-6]
              ),
            )
          )
    profile.append(dict(key=key, drawn=nav, native=native_nav))
  write(DATA / "northSitesV306.json", dict(schemaVersion=1, sites=records))
  write(DATA / "northSitesV306Navigation.json", dict(schemaVersion=1, sites=profile))
  write(
    DATA / "northSchoolGroundV306.json",
    dict(
      schemaVersion=1,
      groundY=3.015,
      geometry=source["school"]["requestedFootprint"],
      nativeCells=merge_caps(groundcells),
    ),
  )
  write(
    GEO / "north-sites-v306-evidence.json",
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(DATA / "northSitesV306.json"),
      navigationSha256=sha(DATA / "northSitesV306Navigation.json"),
      geometry=[
        dict(
          key=s["key"],
          drawnVertices=s["drawn"]["vertices"],
          drawnTriangles=s["drawn"]["triangles"],
          nativeVertices=s["native"]["vertices"],
          nativeTriangles=s["native"]["triangles"],
        )
        for s in records
      ],
      schoolParents=[
        dict(
          id=p["id"],
          leaves=len(p["parts"]),
          sheets=sum(len(q["surfaces"]) for q in p["parts"]),
        )
        for p in source["school"]["parents"]
      ],
      sourcePolicy=source["policy"],
      newNamedAreaM2=shape(source["school"]["newFootprint"]).area,
      newNamedOutsidePreviousFootprint=True,
      groundDatum="Existing flat scene3m; complete source-family relative elevations retained",
    ),
  )
  print([(r["key"], r["drawn"]["vertices"], r["native"]["vertices"]) for r in records])


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  source = extract() if args.extract else read(SOURCE)
  build_models(source)


if __name__ == "__main__":
  main()
