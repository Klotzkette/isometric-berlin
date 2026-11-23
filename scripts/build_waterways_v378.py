"""Compile the versioned shoreline and bridge surveys into independently streamed cells."""

import gzip
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from shapely import STRtree, from_wkb, union_all
from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PACKETS = DATA / "waterwaysV378"
PACKETS.mkdir(exist_ok=True)


def read(p):
  return json.loads(
    gzip.decompress(p.read_bytes()) if p.suffix == ".gz" else p.read_bytes()
  )


def save(p, obj):
  p.write_text(
    json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  )


bank = read(GEO / "waterway-bank-survey-v378.json.gz")
spans = read(GEO / "landwehr-crossing-survey-v378.json.gz")
ground = read(DATA / "boulevardTransportGroundV210.json")
core = Polygon(ground["core"]["ring"], ground["core"]["holes"])
core_bounds = core.bounds


def grade(x, z, native):
  """Same origin, grid samples and bilinear/nearest family as the city ground."""

  def at(ix, iz):
    return ground["heightsDm"][
      max(0, min(ground["rows"] - 1, iz)) * ground["cols"]
      + max(0, min(ground["cols"] - 1, ix))
    ]

  u, v = [
    (q - offset) / ground["step"] - (0 if native else 0.5)
    for q, offset in zip((x, z), ground["origin"])
  ]
  a, b = math.floor(u), math.floor(v)
  if native:
    return at(a, b)
  du, dv = u - a, v - b
  return round(
    (at(a, b) * (1 - du) + at(a + 1, b) * du) * (1 - dv)
    + (at(a, b + 1) * (1 - du) + at(a + 1, b + 1) * du) * dv
  )


def heights(x, z):
  if (
    core_bounds[0] <= x <= core_bounds[2]
    and core_bounds[1] <= z <= core_bounds[3]
    and core.covers(Point(x, z))
  ):
    return [grade(x, z, False), grade(x, z, True)]
  return []


def flatten(g):
  if g.is_empty:
    return []
  if hasattr(g, "geoms"):
    return [s for p in g.geoms for s in flatten(p)]
  return [g]


special = defaultdict(list)
for rows in read(GEO / "tegel-landscape-source-v378.json.gz")["survey"].values():
  for id, kind, tags, wkb in rows:
    if kind in ("way", "fence", "bridge", "planks", "pier", "pier_area"):
      special[id].append(from_wkb(bytes.fromhex(wkb)))
special = {k: union_all(v).buffer(0.32, quad_segs=2) for k, v in special.items()}
paths = [LineString(r[-1]) for r in bank["features"] if r[2] in ("walk", "cycle")]
on_path = STRtree(paths)
hostsize = 1024
payloads = defaultdict(lambda: {"lines": [], "bridges": [], "gates": []})
bounds = {}
counts = Counter()
lengths = Counter()


def host(x, z):
  return (math.floor(x / hostsize), math.floor(z / hostsize))


def expand(key, pts, margin):
  x0, z0, x1, z1 = bounds.get(key, (math.inf, math.inf, -math.inf, -math.inf))
  for x, z in pts:
    x0, z0, x1, z1 = (
      min(x0, x - margin),
      min(z0, z - margin),
      max(x1, x + margin),
      max(z1, z + margin),
    )
  bounds[key] = [math.floor(x0), math.floor(z0), math.ceil(x1), math.ceil(z1)]


def cpoints(key, coords):
  return [
    [
      round((x - key[0] * hostsize) * 10),
      round((z - key[1] * hostsize) * 10),
      *heights(x, z),
    ]
    for x, z in coords
  ]


surfaces = {
  "asphalt": 1,
  "paved": 2,
  "paving_stones": 2,
  "concrete:plates": 2,
  "concrete:lanes": 2,
  "concrete": 3,
  "sett": 4,
  "cobblestone": 4,
  "unhewn_cobblestone": 4,
  "pebblestone": 4,
  "stone": 4,
  "compacted": 5,
  "gravel": 6,
  "fine_gravel": 6,
  "dirt": 7,
  "earth": 7,
  "ground": 7,
  "unpaved": 7,
  "grass": 8,
  "grass_paver": 8,
  "sand": 9,
  "wood": 10,
  "woodchips": 10,
  "steel": 11,
  "metal": 11,
}
kinds = {"walk": 0, "cycle": 1, "rail": 2, "guard": 3, "hedge": 4, "shrubs": 5}


def metre(value, nominal, lo, hi):
  m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*(?:m)?", str(value or "").strip())
  return round(max(lo, min(hi, float(m[1].replace(",", ".")) if m else nominal)) * 10)


for id, v, kind, water, tags, pts in bank["features"]:
  if kind == "shrubs":
    safe = [
      p
      for p in pts
      if not len(on_path.query(Point(p), predicate="dwithin", distance=2.4))
    ]
    if safe:
      key = host(*safe[0])
      payloads[key]["lines"].append([kinds[kind], 0, 0, cpoints(key, safe)])
      expand(key, safe, 2.5)
      counts[kind] += len(safe)
    continue
  line = LineString(pts)
  pieces = flatten(line.difference(special[id])) if id in special else [line]
  for part in pieces:
    if part.geom_type != "LineString" or part.length < 1:
      continue
    key = host(*part.interpolate(0.5, normalized=True).coords[0])
    pts = list(part.coords)
    width = metre(tags.get("width"), 2.5 if kind == "cycle" else 1.8, 0.6, 7.5)
    if kind == "hedge":
      width = metre(tags.get("height"), 1.05, 0.3, 3.2)
    if kind in ("rail", "guard"):
      width = metre(tags.get("height"), 0.83 if kind == "guard" else 1.05, 0.4, 2.0)
    # Retain all source bends. Resample in the historic core only, where
    # the terrain varies over short runs, as the game does for road curves.
    if part.intersects(core):
      pts = list(part.segmentize(5).coords)
    tone = surfaces.get(tags.get("surface"), 0)
    packed = cpoints(key, pts)
    clean = [packed[0]]
    for p in packed[1:]:
      if p[:2] != clean[-1][:2]:
        clean.append(p)
    if len(clean) < 2:
      continue
    payloads[key]["lines"].append([kinds[kind], tone, width, clean])
    expand(key, pts, width / 20 + 1)
    counts[kind] += 1
    lengths[kind] += part.length
for span in spans["crossings"]:
  x, z = span["center"]
  key = host(x, z)
  row = {
    k: span[k]
    for k in (
      "id",
      "name",
      "center",
      "course",
      "sections",
      "openings",
      "role",
      "form",
      "material",
    )
  }
  a, b = span["course"]

  def ends(section):
    s, u, v = section
    return [(x + s * a - w * b, z + s * b + w * a) for w in (u, v)]

  ends_ground = [Point(ends(span["sections"][i])[0]).coords[0] for i in (0, -1)]
  row["landing"] = [heights(ex, ez) or None for ex, ez in ends_ground]
  row["paths"] = [
    [
      kind,
      pts,
      metre(span["ways"][sid][1].get("width"), 1.8 if kind == "walk" else 1.5, 0.65, 4),
    ]
    for sid, kind, pts in span["paths"]
  ]
  if span.get("lamps"):
    row["lamps"] = [pt for _, _, _, pt in span["lamps"]]
  if any(
    tags.get("surface") == "sett"
    and tags.get("highway") in ("living_street", "residential")
    for _, tags in span["ways"].values()
  ):
    row["sett"] = True
  row["ironwork"] = bool(span["heritage"])
  if span["id"] == "w1000916523":
    existing = read(DATA / "steelRailSpansV369.json")["tiles"]["southrail238-0_4"][
      "drawn"
    ]
    same = [
      r
      for r in existing
      if r["form"] == "truss"
      or any(400 < q[0] < 497 and 2170 < q[2] < 2196 for q in r["course"])
    ]
    same = min(same, key=lambda r: abs(r["width"] - 7.85))
    course = [(pt[0], pt[2], pt[1]) for pt in same["course"]]
    row["railDatum"] = [
      [round((px - x) * a + (pz - z) * b, 2), y] for px, pz, y in course
    ]
    row["railDatum"].sort()

  if span["id"] == "w659058363":
    row["pier"] = "sandstone"
  if span["id"] == "w23218755":
    row["covered"] = True
  if span["id"] == "w28492572" or span["role"] in ("former-rail", "utility", "rail"):
    row["walking"] = False
  payloads[key]["bridges"].append(row)
  expand(key, [p for sec in row["sections"] for p in ends(sec)], 2)
for id, v, kind, pts, obs in spans["lockWorks"]:
  key = host(*pts[0])
  payloads[key]["gates"].append([kind, pts])
  expand(key, pts, 1.5)
# Match complete old raster clusters before reassigning individual source cells.
# Many clusters also include distant U-Bahn approaches. Keep all residual cells.
ground_mesh = read(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")
grid = ground_mesh["grid"]
cols = grid["cols"]
cell = ground_mesh["cell_m"]
bridges = {row["id"]: row for packet in payloads.values() for row in packet["bridges"]}
shapes = []
owners = []
for name, r in bridges.items():
  x, z = r["center"]
  dx, dz = r["course"]

  def side(q, w):
    return (x + q[0] * dx - dz * q[w], z + q[0] * dz + dx * q[w])

  polygon = Polygon(
    [side(q, 1) for q in r["sections"]] + [side(q, 2) for q in r["sections"][::-1]]
  ).buffer(2.9)
  shapes.append(polygon)
  owners.append(name)
surfaces = STRtree(shapes)
eligible = set()
for j, record in enumerate(ground_mesh["ground_rows"]):
  for i, n, value in record:
    if value == ground_mesh["classes"].index("bridge"):
      eligible.update((j, i + x) for x in range(n))
cluster_rows = []
core_ids = set()


def delta(numbers):
  return [numbers[0], *[b - a for a, b in zip(numbers, numbers[1:])]]


while eligible:
  seed = eligible.pop()
  stack = [seed]
  group = [seed]
  while stack:
    j, i = stack.pop()
    for v in range(j - 2, j + 3):
      for u in range(i - 2, i + 3):
        if (v, u) in eligible:
          eligible.remove((v, u))
          stack.append((v, u))
          group.append((v, u))
  covered = defaultdict(list)
  for j, i in sorted(group):
    point = Point(
      (grid["min_x_idx"] + i + 0.5) * cell, (grid["min_z_idx"] + j + 0.5) * cell
    )
    for n in surfaces.query(point, predicate="intersects"):
      covered[owners[n]].append(j * cols + i)
  if covered:
    cells = sorted(j * cols + i for j, i in group)
    core_ids.update(covered)
    cluster_rows.append(
      [delta(cells), {name: delta(block) for name, block in sorted(covered.items())}]
    )
cluster_rows.sort(key=lambda q: q[0][0])
source_rows = [bridges[name] for name in sorted(core_ids)]
core_numbers = {span["id"]: i for i, span in enumerate(source_rows)}
for packet in payloads.values():
  packet["core"] = sorted(
    core_numbers[r["id"]] for r in packet["bridges"] if r["id"] in core_numbers
  )
  packet["bridges"] = [r for r in packet["bridges"] if r["id"] not in core_numbers]
save(
  DATA / "waterwayCoreV378.json",
  dict(
    grid=[grid["min_x_idx"], grid["min_z_idx"], cols, grid["rows"], cell],
    clusters=cluster_rows,
    spans=source_rows,
  ),
)
regions = defaultdict(dict)
index = {}
for k, packet in sorted(payloads.items()):
  id = f"water378-{k[0]}_{k[1]}"
  region = f"r{k[0] // 4}_{k[1] // 4}"
  regions[region][id] = packet
  index[id] = bounds[k]
for name, region in regions.items():
  save(PACKETS / (name + ".json"), region)
for old in PACKETS.glob("*.json"):
  if old.stem not in regions:
    old.unlink()
save(DATA / "waterwaysV378Hosts.json", index)
print(
  "hosts",
  len(index),
  "regions",
  len(regions),
  "render",
  dict(counts),
  "length m",
  {k: round(v) for k, v in lengths.items()},
)
views = {}
for r in spans["crossings"]:
  x, z = r["center"]
  dx, dz = r["course"]
  name = r["name"]
  if name == "Rohrbrücke":
    name = f"Rohrbrücke am Landwehrkanal, km {r['wsaKm']:.2f}".replace(".", ",")
  if r["id"] == "w574155311":
    name = "Stadtbahnbrücke über den Zooarm"
  if r["id"] == "w1000916523":
    name = "Hochbahnbrücke U1/U3 am Technikmuseum"
  if r["id"] == "w266285056":
    name = "Stadtbahnbrücke an der Unterschleuse"
  wide = max(q[2] - q[1] for q in r["sections"])
  dist = min(78, max(42, wide * 0.85 + 22))
  y = 8 if r["role"] == "rail" else 3
  assert name not in views
  views[name] = dict(
    position=[
      round(x + dz * dist - dx * dist * 0.28, 1),
      round(13 + dist * 0.18, 1),
      round(z - dx * dist - dz * dist * 0.28, 1),
    ],
    target=[x, y, z],
    fov=48,
  )
for name, x, z, off in [
  ("Unterschleuse am Landwehrkanal", -2420, 772, [-47, 28, 48]),
  ("Oberschleuse am Landwehrkanal", 5230, 2451, [54, 27, 29]),
  ("Spreeufer mit Ufergeländer", -1235, 78, [31, 23, -44]),
  ("Südpanke am Ufergeländer", 220, -1905, [41, 18, 30]),
  ("Wuhle am Gehölzsaum", 14641, -1074, [58, 29, -22]),
]:
  views[name] = dict(
    position=[x + off[0], off[1], z + off[2]], target=[x, 3, z], fov=50
  )
save(DATA / "waterwayViewsV378.json", views)
