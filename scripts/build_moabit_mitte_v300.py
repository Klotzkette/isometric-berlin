"""Bounded address-proved Moabit/Mitte source corrections and facade evidence.

Every predecessor remains retained. Only complete, exclusive, source-admitted
fallbacks may yield; all fitting dimensions remain reference-derived estimates.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import pyogrio
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "moabit-mitte-v300-source.json.gz"
DATA = ROOT / "src/app/src/data/moabitMitteV300Core.json"
OWNERS = ROOT / "src/app/src/data/moabitMitteV300Owners.json"
PROFILE = ROOT / "src/app/src/data/moabitMitteV300Profile.json"
TARGETS = []


def target(street, numbers, docs, style):
  for number, doc in zip(numbers, docs, strict=True):
    TARGETS.append(dict(street=street, number=str(number), doc=doc, style=style))


target(
  "Waldstraße", [53, 54, 55], ["09050357", "09050357", "09050293"], "reform-loggias"
)
target(
  "Turmstraße", [4, 38, 76], ["09050349", "09050352", "09050354"], "reform-commercial"
)
target(
  "Alt-Moabit",
  [87, 88, 89, 90, 92, 93],
  ["09050421", "09050420", "09050423", "09050423", "09050223", "09050224"],
  "historic-belt-cornice",
)
target("Lehrter Straße", [6, 7, 8, 9, 10], ["09050389"] * 5, "railway-historic")
target(
  "Lehrter Straße",
  [21, 22],
  ["https://www.sauerbruchhutton.de/de/project/ler"] * 2,
  "retained-mapped-storeys",
)
target(
  "Tucholskystraße",
  [26, 28, 30, 32, 37, 38, 39, 41, 42, 43, 44],
  [
    "09035061",
    "09035062",
    "09035063",
    "09035064",
    "09035092",
    "09035087",
    "09035093",
    "09035094",
    "09035089",
    "09035285",
    "09035286",
  ],
  "historic-belt-cornice",
)
target(
  "Torstraße",
  [58, 60, 62, 64, 66, 68, 70, 72],
  [
    "09080123",
    "09080124",
    "09080125",
    "09080126",
    "09080127",
    "09080128",
    "09080129",
    "09080130",
  ],
  "historic-belt-cornice",
)
target(
  "Jägerstraße",
  [27, 28, 29, 30, 31, 32],
  ["09030033", "09030034", "09030035", "09030035", "09030035", "09030036"],
  "stone-commercial",
)
target("Charlottenstraße", [75, 76, 77], ["09030023"] * 3, "stone-commercial")


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def poly(part):
  return Polygon(
    [(x / 10, z / 10) for x, z in part["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in part.get("holes", [])],
  )


def tags(row):
  return dict(
    re.findall(
      r'"([^\"]+)"=>"([^\"]*)"',
      row.other_tags if isinstance(row.other_tags, str) else "",
    )
  )


def annotate_storeys(evidence):
  """Retain explicit original OSM counts and narrower authoritative corrections."""
  path = ROOT / "src/app/src/buildingAttributeSource.json"
  attributes = read(path)
  evidence["retainedStoreyMetadata"] = dict(
    file=str(path.relative_to(ROOT)), sha256=sha(path), records=[]
  )
  for site in evidence["sites"]:
    key = site["old"]["id"]
    index = attributes["prisms"].get(key)
    if index is not None:
      evidence["retainedStoreyMetadata"]["records"].append(
        dict(
          street=site["street"],
          number=site["number"],
          old=key,
          record=attributes["records"][index],
        )
      )
    if site["street"] == "Lehrter Straße" and site["number"] in {"21", "22"}:
      site["style"] = "retained-mapped-storeys"
      site["referenceBoundary"] = (
        "Sauerbruch Hutton documents six/eight-storey new courtyard buildings for the wider21–25 site, not these exact retained five-storey source street fronts. No new glass balcony is inferred here."
      )
  evidence["storeySourceCorrections"] = [
    dict(
      street="Turmstraße",
      number="4",
      storeys=6,
      doc="09050349",
      basis="Explicit LDA: six storeys, supersedes retained mapped5",
    ),
    dict(
      street="Alt-Moabit",
      number="92",
      storeys=3,
      doc="09050223",
      basis="Explicit LDA: three-storey body, supersedes retained mapped4",
    ),
    dict(
      street="Lehrter Straße",
      numbers=["6", "7", "8", "9", "10"],
      storeys=4,
      doc="09050389",
      basis="Explicit LDA count, agrees with retained mapped4",
    ),
  ]


def extract():
  """Resolve retained address nodes, exact old owners and whole official parents."""
  core_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  parts = read(core_path)["buildings"]
  polys = [poly(p) for p in parts]
  tree = STRtree(polys)
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  points = pyogrio.read_dataframe(
    pbf, layer="points", bbox=(13.31, 52.505, 13.425, 52.56)
  ).to_crs(25833)
  addresses = defaultdict(list)
  wanted = {(t["street"], t["number"]) for t in TARGETS}
  for row in points.itertuples():
    t = tags(row)
    key = (t.get("addr:street"), t.get("addr:housenumber"))
    if key not in wanted:
      continue
    p = [row.geometry.x - 389500, 5820000 - row.geometry.y]
    q = Point(p)
    hits = [int(i) for i in tree.query(q.buffer(3)) if polys[i].distance(q) < 3]
    for i in hits:
      addresses[key].append(dict(osm="node/" + str(row.osm_id), point=p, old=parts[i]))
  # Address tags attached to actual OSM buildings fill only missing nodes.
  buildings = pyogrio.read_dataframe(
    pbf, layer="multipolygons", bbox=(13.31, 52.505, 13.425, 52.56)
  ).to_crs(25833)
  for row in buildings.itertuples():
    t = tags(row)
    key = (t.get("addr:street"), t.get("addr:housenumber"))
    if key not in wanted or addresses[key]:
      continue
    p0 = row.geometry.representative_point()
    p = [p0.x - 389500, 5820000 - p0.y]
    q = Point(p)
    for i in tree.query(q):
      if polys[i].covers(q):
        addresses[key].append(
          dict(osm="way/" + str(row.osm_way_id), point=p, old=parts[int(i)])
        )
  selected = []
  omissions = []
  for t in TARGETS:
    choices = addresses[(t["street"], t["number"])]
    if not choices:
      omissions.append(dict(**t, reason="no retained unambiguous core address"))
      continue
    # Prefer actual address/entrance nodes; house POIs stay supporting evidence.
    chosen = min(
      choices, key=lambda r: polys[parts.index(r["old"])].distance(Point(r["point"]))
    )
    selected.append(
      dict(**t, addresses=choices, old=chosen["old"], point=chosen["point"])
    )
  tiles = {
    (int((r["point"][0] + 389500) // 1000), int((5820000 - r["point"][1]) // 1000))
    for r in selected
  }
  parents = []
  archives = []
  for east, north in sorted(tiles):
    path = GEO / f"raw/lod2/LoD2_{east}_{north}.zip"
    if not path.exists():
      subprocess.run(
        [
          "curl",
          "--fail",
          "--silent",
          "--show-error",
          "--max-time",
          "60",
          "--output",
          str(path),
          "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
        ],
        check=True,
      )
    archives.append(
      dict(
        path=str(path.relative_to(ROOT)),
        url="https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
        sha256=sha(path),
      )
    )
    with zipfile.ZipFile(path) as archive:
      member = next(
        n
        for n in archive.namelist()
        if n.lower().endswith((".gml", ".xml", ".citygml"))
      )
      with archive.open(member) as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
          if element.tag != f"{{{NS['bldg']}}}Building":
            continue
          grounds = element.findall(".//bldg:GroundSurface//gml:Polygon", NS)
          points2 = []
          for ground in grounds:
            exterior = ground.find("gml:exterior//gml:posList", NS)
            if exterior is None:
              continue
            v = list(map(float, exterior.text.split()))
            ring = [
              (x - 389500, 5820000 - y) for x, y in zip(v[::3], v[1::3], strict=True)
            ]
            if len(ring) >= 4:
              points2.append(Polygon(ring))
          footprint = unary_union(points2)
          matches = [
            r for r in selected if footprint.buffer(0.5).covers(Point(r["point"]))
          ]
          if matches:
            profiles = [
              part_profile(p) for p in leaf_building_parts(element) or [element]
            ]
            parents.append(
              dict(
                id=element.get(GML_ID),
                parts=profiles,
                addresses=[
                  dict(street=r["street"], number=r["number"]) for r in matches
                ],
                archive=str(path.relative_to(ROOT)),
              )
            )
          element.clear()
  result = []
  for r in selected:
    candidates = [
      p
      for p in parents
      if dict(street=r["street"], number=r["number"]) in p["addresses"]
    ]
    if len(candidates) != 1:
      omissions.append(
        dict(
          street=r["street"],
          number=r["number"],
          reason="official parent absent or ambiguous",
          matches=len(candidates),
        )
      )
      continue
    parent = candidates[0]
    ground = min(p["ground_y_m"] for p in parent["parts"])
    height = max(p["top_y_m"] for p in parent["parts"]) - ground
    r.update(parent=parent["id"], officialHeight=height)
    result.append(r)
  refs = {}
  for doc in sorted({r["doc"] for r in result}):
    url = (
      doc
      if doc.startswith("https:")
      else "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=" + doc
    )
    html = urlopen(url, timeout=30).read().decode()
    photos = sorted(
      set(re.findall(r'(?:href|src)=["\']([^"\']+\.(?:jpg|jpeg|png))["\']', html))
    )
    refs[doc] = dict(
      url=url,
      checked="2026-11-02",
      pageSha256=hashlib.sha256(html.encode()).hexdigest(),
      photos=[
        (
          "https://denkmaldatenbank.berlin.de" + p
          if p.startswith("/media/uploads/")
          else p
        )
        for p in photos
        if "/media/uploads/" in p or "media/projekte/ler/" in p
      ],
      status="Reference only. LDA images have their embedded historical dates; no current paint or tenant is inferred.",
    )
  evidence = dict(
    schemaVersion=1,
    policy="Exact retained address+old source and complete official parents only; no district fill. All source records, source roofs and holes retained. Photo-derived facade fittings are display estimates, not measured openings. Historical LDA photographs are never described as current photos.",
    coreSourceSha256=sha(core_path),
    addressSourceSha256=sha(pbf),
    archives=archives,
    sites=result,
    parents=parents,
    omissions=omissions,
    references=refs,
  )
  annotate_storeys(evidence)
  write(SOURCE, evidence)
  print(
    json.dumps(
      dict(
        sites=len(result),
        parents=len(parents),
        omissions=omissions,
        sourceBytes=SOURCE.stat().st_size,
      ),
      ensure_ascii=False,
    )
  )


if __name__ == "__main__":
  if "--extract" in sys.argv:
    extract()

FLOORS = {
  "Waldstraße": {"53": 5, "54": 5, "55": 5},
  "Turmstraße": {"4": 6, "38": 5, "76": 5},
  "Alt-Moabit": {"87": 5, "88": 7, "89": 4, "90": 4, "92": 3, "93": 4},
  "Lehrter Straße": {"6": 4, "7": 4, "8": 4, "9": 4, "10": 4, "21": 5, "22": 5},
  "Tucholskystraße": {
    "26": 4,
    "28": 4,
    "30": 4,
    "32": 5,
    "37": 5,
    "38": 4,
    "39": 5,
    "41": 5,
    "42": 3,
    "43": 5,
    "44": 3,
  },
}


class Mesh:
  def __init__(self):
    self.positions = []
    self.colors = []
    self.indices = []
    self.lookup = {}
    self.roles = defaultdict(int)
    self.boxes = []

  def triangle(self, points, tone, role):
    rgb = tuple(
      round(
        (v / 255 / 12.92 if v <= 10.31475 else ((v / 255 + 0.055) / 1.055) ** 2.4) * 255
      )
      for v in [(tone >> 16) & 255, (tone >> 8) & 255, tone & 255]
    )
    ids = []
    for p in points:
      p = tuple(float(np.float32(v)) for v in p)
      key = (*p, *rgb)
      if key not in self.lookup:
        self.lookup[key] = len(self.positions) // 3
        self.positions.extend(p)
        self.colors.extend(rgb)
      ids.append(self.lookup[key])
    if len(set(ids)) == 3:
      self.indices.extend(ids)
      self.roles[role] += 1

  def box(self, p, s, tone, role, d=(1, 0), n=(0, 1)):
    if min(s) <= 0:
      raise ValueError("Invalid fitting size")
    self.boxes.append(
      [*[round(v, 6) for v in p + s], round(math.atan2(-d[1], d[0]), 9), tone]
    )
    self.roles[role] += 12

  def packed(self):
    return dict(
      positions=base64.b64encode(
        np.array(self.positions, dtype="<f4").tobytes()
      ).decode(),
      colors=base64.b64encode(bytes(self.colors)).decode(),
      indices=base64.b64encode(np.array(self.indices, dtype="<u4").tobytes()).decode(),
    )


def roof_at(triangles, x, z):
  highest = None
  for a, b, c in triangles:
    det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(det) < 1e-8:
      continue
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det
    if min(u, v, 1 - u - v) >= -1e-7:
      h = u * a[1] + v * b[1] + (1 - u - v) * c[1]
      highest = h if highest is None else max(highest, h)
  return highest


def clipped_member_ranges(wall, u, y, width, height, strip=False):
  """Complete fitting rectangles only; long courses may end at true wall steps."""

  def fits(left, right):
    return wall.buffer(0.0001).covers(box(left, y - height / 2, right, y + height / 2))

  left, right = u - width / 2, u + width / 2
  if fits(left, right):
    return [(u, width)]
  if not strip:
    return []
  count = max(1, math.ceil(width / 0.25))
  step = width / count
  runs = []
  start = None
  for i in range(count + 1):
    valid = i < count and fits(left + i * step, left + (i + 1) * step)
    if valid and start is None:
      start = i
    if not valid and start is not None:
      lo, hi = left + start * step, left + i * step
      runs.append(((lo + hi) / 2, hi - lo))
      start = None
  return runs


def offset_wall_blocked_ranges(a, b, normal, foreign_shapes):
  """Project every covered offset-wall interval, not only its midpoint."""
  length = math.dist(a, b)
  d = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
  line = LineString(
    [
      (a[0] + normal[0] * 0.4, a[1] + normal[1] * 0.4),
      (b[0] + normal[0] * 0.4, b[1] + normal[1] * 0.4),
    ]
  )
  intervals = []

  def accept(hit):
    if hasattr(hit, "geoms"):
      for geometry in hit.geoms:
        accept(geometry)
    elif hit.geom_type == "LineString" and hit.length > 0.001:
      values = [
        (x - a[0] - normal[0] * 0.4) * d[0] + (z - a[1] - normal[1] * 0.4) * d[1]
        for x, z in hit.coords
      ]
      intervals.append([min(values), max(values)])

  for shape in foreign_shapes:
    if shape.intersects(line):
      accept(shape.intersection(line))
  return intervals


def compile_data():
  """Compile complete measured source bodies and restrained individual fronts."""
  from build_litten_instanz_v257 import edge
  from shapely.affinity import affine_transform

  evidence = read(SOURCE)
  allparts = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  allpolys = [poly(p) for p in allparts]
  tree = STRtree(allpolys)
  protected = set(
    read(GEO / "core-house-colours-v273-protected.json")["registries"][
      "PRISM_SUPPRESSED_IDS"
    ]
  )
  roads_frame = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg", layer="lines"
  ).to_crs(25833)
  road_names = {r["street"] for r in evidence["sites"]}
  roads = defaultdict(list)
  for row in roads_frame.itertuples():
    if row.name in road_names:
      roads[row.name].append(
        affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
      )
  roads = {name: unary_union(lines) for name, lines in roads.items()}
  drawn, native = Mesh(), Mesh()
  old_prisms = {}
  retained_prisms = {}
  sites = []
  nav = []
  fronts = []
  complementary_faces = []
  conservative_omissions = []
  native_roofs = []
  source_triangles = 0
  body_cells = {}
  source_parent_receipts = []
  for parent in evidence["parents"]:
    refs = [s for s in evidence["sites"] if s["parent"] == parent["id"]]
    active = [s for s in refs if s["old"]["id"] not in protected]
    if not active:
      continue
    r = active[0]
    parts = parent["parts"]
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    old_ground = min(s["old"]["y0_dm"] / 10 for s in active)
    offset = old_ground - min(p["ground_y_m"] for p in parts)
    involved = []
    for i in tree.query(footprint):
      p = allparts[int(i)]
      q = allpolys[int(i)]
      if q.area <= 0 or p["id"] in protected:
        continue
      if footprint.buffer(0.25).intersection(q).area / q.area > 0.995:
        involved.append(p)
    if not involved:
      conservative_omissions.append(
        dict(
          parent=parent["id"],
          reason="No completely accounted predecessor footprint; original retained",
          addresses=[dict(street=t["street"], number=t["number"]) for t in active],
          oldIds=[t["old"]["id"] for t in active],
          officialAreaM2=footprint.area,
          oldCoverage=[
            dict(
              id=t["old"]["id"],
              areaM2=poly(t["old"]).area,
              coveredFraction=footprint.intersection(poly(t["old"])).area
              / poly(t["old"]).area,
            )
            for t in active
          ],
        )
      )
      print(
        "Conservative omission: unmatched complete predecessor",
        parent["id"],
        file=sys.stderr,
      )
      continue
    correction = any(re.fullmatch("-?[0-9]+", s["old"]["id"]) for s in active)
    for p in involved:
      (old_prisms if correction else retained_prisms)[p["id"]] = p
    wall_tone = 0xCAC4B7 if r["style"] != "modern-glass-balconies" else 0xBB7560
    roof_tone = 0x645D56
    if r["street"] == "Waldstraße":
      wall_tone = 0xC9C3B4
      roof_tone = 0x755B4D
    roof_tris = []
    transformed = []
    for part in parts:
      p = json.loads(json.dumps(part))
      p["ground_y_m"] += offset
      p["top_y_m"] += offset
      for surface in p["surfaces"]:
        for ring in surface["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 6)
        triangles = triangles_for(surface["rings"])
        role = "measured-roof" if surface["kind"] == "RoofSurface" else "measured-wall"
        if surface["kind"] == "RoofSurface":
          roof_tris.extend(triangles)
        if correction:
          for tri in triangles:
            drawn.triangle(
              tri, roof_tone if role == "measured-roof" else wall_tone, role
            )
            source_triangles += 1
      own_roofs = [
        t
        for s in p["surfaces"]
        if s["kind"] == "RoofSurface"
        for t in triangles_for(s["rings"])
      ]
      nav.append(
        dict(
          id=p["id"],
          parent=parent["id"],
          ring=p["ring"],
          holes=p["holes"],
          low=p["ground_y_m"],
          high=p["top_y_m"],
          roofTriangles=own_roofs,
        )
      )
      transformed.append(p)
    # Independent cardinal half-metre exterior columns, merged along each row.
    cells = {}
    step = 0.5
    for p in transformed:
      shape = Polygon(p["ring"], p["holes"])
      minx, minz, maxx, maxz = shape.bounds
      p_roofs = [
        t
        for s in p["surfaces"]
        if s["kind"] == "RoofSurface"
        for t in triangles_for(s["rings"])
      ]
      for iz in range(math.floor(minz / step), math.ceil(maxz / step)):
        for ix in range(math.floor(minx / step), math.ceil(maxx / step)):
          x, z = (ix + 0.5) * step, (iz + 0.5) * step
          if not shape.covers(Point(x, z)):
            continue
          top = roof_at(p_roofs, x, z)
          if top is None:
            continue
          low = round(p["ground_y_m"] / step) * step
          top = math.ceil(top / step) * step
          key = (ix, iz)
          previous = cells.get(key)
          if previous:
            low = min(low, previous[0])
            top = max(top, previous[1])
          cells[key] = (low, top)
    for iz in sorted({key[1] for key in cells}):
      xs = sorted(x for x, z in cells if z == iz)
      at = 0
      while at < len(xs):
        x0 = xs[at]
        last = x0
        lo, hi = cells[(x0, iz)]
        at += 1
        while at < len(xs) and xs[at] == last + 1 and cells[(xs[at], iz)] == (lo, hi):
          last = xs[at]
          at += 1
        native_roofs.append([parent["id"], x0, iz, last - x0 + 1, lo, hi + 0.05])
        native.box(
          [(x0 + last + 1) * step / 2, (lo + hi) / 2, (iz + 0.5) * step],
          [(last - x0 + 1) * step, hi - lo, step],
          wall_tone,
          "independent-native-source-body",
        )
        native.box(
          [(x0 + last + 1) * step / 2, hi + 0.025, (iz + 0.5) * step],
          [(last - x0 + 1) * step, 0.05, step],
          roof_tone,
          "independent-native-stepped-roof",
        )
    body_cells[parent["id"]] = cells
    # Primary fronts and a conservative continuation of the former estimated
    # rhythm on free source backs/courts. Interior seams and covered party walls
    # never gain fabricated openings. Correct drawn Lehrter backs remain intact.
    valid_faces = []
    other_faces = []
    involved_ids = {p["id"] for p in involved}
    for p in transformed:
      for si, s in enumerate(p["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        f = edge(s)
        if not f or math.dist(f["a"], f["b"]) < 5 or f["top"] - f["bottom"] < 7:
          continue
        centre = Point((f["a"][0] + f["b"][0]) / 2, (f["a"][1] + f["b"][1]) / 2)
        n = f["normal"]
        if footprint.contains(Point(centre.x + n[0] * 0.3, centre.y + n[1] * 0.3)):
          n = [-n[0], -n[1]]
        road = roads[r["street"]]
        near = road.interpolate(road.project(centre))
        vx, vz = near.x - centre.x, near.y - centre.y
        dist = math.hypot(vx, vz)
        street_front = 1 <= dist <= 36 and (vx * n[0] + vz * n[1]) / dist >= 0.65
        if not street_front:
          outside = Point(centre.x + n[0] * 0.4, centre.y + n[1] * 0.4)
          if footprint.covers(outside):
            continue
          # A shared party wall remains plain even if the neighbour's old
          # fallback happens to be lower than its real building.
          if any(
            allparts[int(i)]["id"] not in involved_ids
            and allpolys[int(i)].covers(outside)
            for i in tree.query(outside)
          ):
            continue
        f = {
          **f,
          "normal": n,
          "owner": parent["id"],
          "part": p["id"],
          "surface": si,
          "street": r["street"],
          "address": r["number"],
          "doc": r["doc"],
          "style": r["style"],
          "complementary": not street_front,
          "wallRings": s["rings"],
        }
        (valid_faces if street_front else other_faces).append(f)
    # Do not repeat overlapping source wall sheets of neighbouring leaf parts.
    face_keys = set()
    for f in valid_faces + other_faces:
      complementary = f["complementary"]
      key = tuple(round(v, 3) for v in f["a"] + f["b"] + [f["bottom"], f["top"]])
      if key in face_keys:
        continue
      face_keys.add(key)
      (complementary_faces if complementary else fronts).append(f)
      drawn_start, native_start = len(drawn.boxes), len(native.boxes)
      dx, dz = f["b"][0] - f["a"][0], f["b"][1] - f["a"][1]
      length = math.hypot(dx, dz)
      d = [dx / length, dz / length]
      n = f["normal"]
      height = f["top"] - f["bottom"]
      uv_rings = [
        [[(q[0] - f["a"][0]) * d[0] + (q[2] - f["a"][1]) * d[1], q[1]] for q in ring]
        for ring in f["wallRings"]
      ]
      wall_shape = Polygon(uv_rings[0], uv_rings[1:])
      if not wall_shape.is_valid:
        wall_shape = wall_shape.buffer(0)
      offset_line = LineString(
        [
          (f["a"][0] + n[0] * 0.4, f["a"][1] + n[1] * 0.4),
          (f["b"][0] + n[0] * 0.4, f["b"][1] + n[1] * 0.4),
        ]
      )
      blockers = [
        allpolys[int(i)]
        for i in tree.query(offset_line)
        if allparts[int(i)]["id"] not in involved_ids
      ]
      blocked = offset_wall_blocked_ranges(f["a"], f["b"], n, blockers)
      for lo, hi in blocked:
        wall_shape = wall_shape.difference(
          box(lo - 0.001, f["bottom"] - 1, hi + 0.001, f["top"] + 1)
        )
      f["wallUvRings"] = uv_rings
      f["blockedRanges"] = blocked
      floors = (
        max(1, round(height / 3.6))
        if complementary
        else FLOORS.get(r["street"], {}).get(r["number"], max(3, round(height / 3.8)))
      )
      bays = max(
        2, min(16, round(length / (2.8 if r["style"] == "railway-historic" else 3.2)))
      )
      pitch = length / bays
      floor_h = height / floors
      f["floorCount"] = floors
      f["bayCount"] = bays
      f["storeysBasis"] = (
        "Explicit LDA count"
        if (r["street"], r["number"])
        in {
          ("Turmstraße", "4"),
          ("Alt-Moabit", "92"),
          *(("Lehrter Straße", str(i)) for i in range(6, 11)),
        }
        else "Retained mapped count where available and compatible with complete parent; otherwise display estimate"
      )
      f["fittingDimensionsStatus"] = (
        "Continuation of former estimated ordinary rhythm on a free measured back/court wall; not photographically surveyed."
        if complementary
        else "Reference-derived display estimates; measured wall clipping retained."
      )

      def member(u, y, w, h, depth, out, tone, role):
        for centre, width in clipped_member_ranges(
          wall_shape, u, y, w, h, "continuous-profile" in role
        ):
          emit_member(centre, y, width, h, depth, out, tone, role)

      def emit_member(u, y, w, h, depth, out, tone, role):
        world = [
          f["a"][0] + d[0] * u + n[0] * out,
          y,
          f["a"][1] + d[1] * u + n[1] * out,
        ]
        if complementary:
          role = "complementary-" + role
        if not complementary or correction:
          drawn.box(world, [w, h, depth], tone, role, d, n)
        # The independent native wall is fitted to an actually present outer cell face.
        axis = 0 if abs(n[0]) >= abs(n[1]) else 1
        across = 1 - axis
        sgn = 1 if n[axis] > 0 else -1
        pos = [world[0], world[2]]
        # Project each strip independently to an actually present exposed
        # cardinal face. A broad rectangle must not float across stair faces.
        candidates = {}
        for (ix, iz), (low, high) in cells.items():
          coords = [ix, iz]
          plane = (coords[axis] + (1 if sgn > 0 else 0)) * step
          across_index = coords[across]
          left = max(across_index * step, pos[across] - w / 2)
          right = min((across_index + 1) * step, pos[across] + w / 2)
          if (
            right - left <= 0.004
            or low > y - h / 2 + 0.0001
            or high < y + h / 2 - 0.0001
            or abs(plane - pos[axis]) >= 1.3
          ):
            continue
          neighbour = cells.get(
            (
              coords[0] + (sgn if axis == 0 else 0),
              coords[1] + (sgn if axis == 1 else 0),
            )
          )
          if (
            neighbour
            and neighbour[0] < y + h / 2 - 0.0001
            and neighbour[1] > y - h / 2 + 0.0001
          ):
            continue
          candidate = (abs(plane - pos[axis]), plane, left, right)
          if (
            across_index not in candidates or candidate[0] < candidates[across_index][0]
          ):
            candidates[across_index] = candidate
        runs = []
        for _, plane, left, right in sorted(candidates.values(), key=lambda q: q[2]):
          if (
            runs and abs(runs[-1][0] - plane) < 1e-8 and abs(runs[-1][2] - left) < 1e-8
          ):
            runs[-1][2] = right
          else:
            runs.append([plane, left, right])
        for plane, left, right in runs:
          p3 = [world[0], y, world[2]]
          p3[0 if axis == 0 else 2] = plane + sgn * max(0.04, out - 0.06)
          p3[2 if axis == 0 else 0] = (left + right) / 2
          sizes = [right - left, h, depth] if axis == 1 else [depth, h, right - left]
          native.box(p3, sizes, tone, role + "-native")

      # Each house has its own whole measured envelope, storey count and bay rhythm.
      trim = 0xDED8C8
      dark = 0x526263
      for course, thick, out in [
        (f["bottom"] + floor_h, 0.18, 0.18),
        (f["top"] - 0.24, 0.22, 0.24),
        (f["top"] - 0.08, 0.10, 0.31),
      ]:
        member(
          length / 2,
          course,
          length - 0.04,
          thick,
          0.12,
          out,
          trim,
          "house-specific-continuous-profile",
        )
      for floor in range(floors):
        cy = f["bottom"] + (floor + 0.54) * floor_h
        window_h = min(2.25, floor_h * 0.62)
        for bay in range(bays):
          u = (bay + 0.5) * pitch
          w = min(1.55, pitch * 0.53)
          if r["style"] == "modern-glass-balconies":
            w = min(2.0, pitch * 0.72)
            window_h = min(2.35, floor_h * 0.78)
          if floor == 0 and r["style"] in {"reform-commercial", "stone-commercial"}:
            w = min(2.3, pitch * 0.78)
            window_h = min(2.6, floor_h * 0.76)
          if cy + window_h / 2 > f["top"] - 0.35:
            continue
          # Accept a complete window group, never floating remnants of a
          # rectangular estimate outside a gable, stepped wall or party edge.
          if not wall_shape.buffer(0.0001).covers(
            box(
              u - (w + 0.36) / 2,
              cy - window_h / 2 - 0.24,
              u + (w + 0.36) / 2,
              cy + window_h / 2 + 0.31,
            )
          ):
            continue
          member(
            u,
            cy,
            w + 0.24,
            window_h + 0.22,
            0.09,
            0.105,
            trim,
            "distinct-window-reveal",
          )
          member(
            u, cy, w, window_h, 0.055, 0.168, dark, "reference-estimated-window-glazing"
          )
          member(u, cy, w - 0.10, 0.055, 0.04, 0.21, 0xB8C0B9, "window-crossbar")
          member(
            u, cy, 0.055, window_h - 0.1, 0.04, 0.21, 0xB8C0B9, "window-middle-mullion"
          )
          member(
            u,
            cy - window_h / 2 - 0.17,
            w + 0.36,
            0.13,
            0.24,
            0.22,
            trim,
            "projecting-stone-sill",
          )
          if floor > 0 and r["style"] != "modern-glass-balconies":
            member(
              u,
              cy + window_h / 2 + 0.19,
              w + 0.31,
              0.12,
              0.16,
              0.19,
              trim,
              "individual-window-head",
            )
          balcony = (
            r["style"] == "modern-glass-balconies"
            and floor > 0
            and floor < floors - 1
            and bay % 3 == 1
          ) or (
            r["street"] == "Waldstraße" and floor in {1, 2, 3} and bay in {1, bays - 2}
          )
          if balcony and not complementary:
            bw = min(3.1, pitch * 1.35)
            bottom = cy - window_h / 2 - 0.15
            member(
              u,
              bottom,
              bw,
              0.13,
              0.80,
              0.48,
              0xBEBFB1,
              "photo-guided-projecting-balcony-slab",
            )
            member(
              u, bottom + 0.65, bw, 0.045, 0.055, 0.9, 0x424D4D, "balcony-top-rail"
            )
            if r["style"] == "modern-glass-balconies":
              member(
                u,
                bottom + 0.37,
                bw - 0.08,
                0.50,
                0.045,
                0.87,
                0xB0C9C4,
                "documented-frosted-balcony-glass",
              )
            else:
              for bal in range(9):
                member(
                  u + (bal - 4) * bw / 9,
                  bottom + 0.37,
                  0.035,
                  0.56,
                  0.05,
                  0.88,
                  0x424D4D,
                  "photo-guided-balcony-balusters",
                )
      f["drawnFittingRange"] = [drawn_start, len(drawn.boxes) - drawn_start]
      f["nativeFittingRange"] = [native_start, len(native.boxes) - native_start]
    sites.append(
      dict(
        parent=parent["id"],
        addresses=[
          dict(street=s["street"], number=s["number"], doc=s["doc"]) for s in active
        ],
        oldIds=[p["id"] for p in involved],
        correctedBody=correction,
        sourceGround=min(p["ground_y_m"] for p in parts),
        displayOffsetY=offset,
        measuredHeight=max(p["top_y_m"] for p in parts)
        - min(p["ground_y_m"] for p in parts),
        frontCount=len(valid_faces),
        referenceOnly=True,
      )
    )
    source_parent_receipts.append(
      dict(
        parent=parent["id"],
        parts=[p["id"] for p in parts],
        surfaces=sum(len(p["surfaces"]) for p in parts),
        sourceXZRetained=True,
        oldIds=[p["id"] for p in involved],
      )
    )
  # Exclusive old native columns, with complete affected rows including neighbours.
  voxel = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  columns = []
  row_ids = set()
  shared = []
  all_ours = set(old_prisms) | set(retained_prisms)
  for rz, row in enumerate(voxel["building_rows"]):
    z = voxel["grid"]["min_z_idx"] + rz
    for run in row:
      # schema2 RLE: [x offset, length, y0 dm, y1 dm, kind]. Every real
      # source cell has its own full five-field ownership receipt.
      if len(run) != 5:
        raise ValueError("Unknown complete native row schema")
      for dx in range(run[1]):
        x = voxel["grid"]["min_x_idx"] + run[0] + dx
        pt = Point((x + 0.5) * 4, (z + 0.5) * 4)
        owners = [
          allparts[int(i)]["id"] for i in tree.query(pt) if allpolys[int(i)].covers(pt)
        ]
        ours = [i for i in owners if i in all_ours]
        if not ours:
          continue
        foreign = [i for i in owners if i not in all_ours]
        if foreign:
          shared.append(dict(tuple=[x, z, *run[2:]], ours=ours, foreign=foreign))
          continue
        columns.append([x, z, *run[2:]])
        row_ids.add(rz)
  ownership = dict(
    schemaVersion=1,
    oldPrisms=list(old_prisms.values()),
    retainedPrisms=list(retained_prisms.values()),
    nativeGrid=voxel["grid"],
    nativeClasses=voxel["classes"],
    nativeRows=[dict(index=i, row=voxel["building_rows"][i]) for i in sorted(row_ids)],
    nativeColumns=columns,
  )
  payload = dict(
    schemaVersion=1,
    drawn=drawn.packed(),
    fittings=drawn.boxes,
    nativeBoxes=native.boxes,
    counts=dict(
      sites=len(sites),
      fronts=len(fronts),
      sourceTriangles=source_triangles,
      drawnTriangles=len(drawn.indices) // 3 + len(drawn.boxes) * 12,
      nativeTriangles=len(native.boxes) * 12,
    ),
    roles=dict(drawn=drawn.roles, native=native.roles),
  )
  profile = dict(
    schemaVersion=1,
    sites=sites,
    navigation=nav,
    fronts=fronts,
    complementaryFaces=complementary_faces,
    conservativeOmissions=conservative_omissions,
    nativeRoofs=native_roofs,
    sourceReceipt="moabit-mitte-v300-source.json.gz",
    nativeGridM=0.5,
    sourceParentReceipts=source_parent_receipts,
    sharedNativeColumns=shared,
    limitsUnchanged=True,
  )
  write(DATA, payload)
  write(OWNERS, ownership)
  write(PROFILE, profile)
  print(
    json.dumps(
      dict(
        counts=payload["counts"],
        oldPrisms=len(old_prisms),
        retainedPrisms=len(retained_prisms),
        nativeColumns=len(columns),
        sharedColumns=len(shared),
        dataBytes=DATA.stat().st_size,
        profileBytes=PROFILE.stat().st_size,
      )
    )
  )


if __name__ == "__main__" and "--compile" in sys.argv:
  compile_data()
