"""Re-register verified northern waterfront finishes on existing viewer shorelines.

The regular build is offline. To refresh the selected OSM reference polygons use
uv run --no-sync --with osmium python scripts/build_waterway_banks_north_v370.py --osm berlin.osm.pbf .
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import defaultdict
from itertools import groupby
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import substring, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "waterway-banks-north-v370-source.json.gz"
DEST = DATA / "waterwayBanksV370North.json"
# All markers correspond to source polygons on the actual Tegeler See water
# owner. Avoid registering on a new sand/reed polygon edge out in the lake.
REEDS = {89476593, 89476595, 90544504, 238292900, 561441669}
BEACH = {
  17369406: "reiswerder-strand",
  24260759: "arbeiterstrand",
  55293725: "reiherwerder-forsthaus",
  1228016345: "strandbad-tegelsee",
}
PROMENADE = 655271825
OWNERS = REEDS | BEACH.keys() | {PROMENADE}
MODELS = ("drawn", "minecraft")
WATER_Y = -1.15


def read(path):
  if path.suffix == ".gz":
    return json.loads(gzip.decompress(path.read_bytes()))
  return json.loads(path.read_bytes())


def write(path, payload):
  data = (
    json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    + "\n"
  ).encode()
  path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == ".gz" else data)


def capture(path):
  import osmium
  from pyproj import Transformer

  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  records = []
  ways = (
    osmium.FileProcessor(str(path))
    .with_locations()
    .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
  )
  for way in ways:
    if way.id not in OWNERS:
      continue
    points = []
    for node in way.nodes:
      e, n = transform.transform(node.lon, node.lat)
      points.append([round(e - 389500, 2), round(5820000 - n, 2)])
    t = dict(way.tags)
    geom = LineString(points) if way.id == PROMENADE else Polygon(points)
    assert geom.is_valid
    records.append(
      {
        "id": way.id,
        "tags": {
          k: t[k]
          for k in ("name", "natural", "wetland", "surface", "highway")
          if k in t
        },
        "geometry": mapping(geom),
      }
    )
  assert {r["id"] for r in records} == OWNERS
  with path.open("rb") as f:
    sha = hashlib.file_digest(f, "sha256").hexdigest()
  with osmium.io.Reader(str(path)) as reader:
    stamp = reader.header().get("osmosis_replication_timestamp")
  write(
    SOURCE,
    {
      "provider": "© OpenStreetMap contributors, ODbL 1.0",
      "source": "https://download.geofabrik.de/europe/germany/berlin.html",
      "timestamp": stamp,
      "pbfSha256": sha,
      "frame": "EPSG:25833, world x=E-389500, z=5820000-N (m)",
      "records": sorted(records, key=lambda r: r["id"]),
    },
  )


def lines(g):
  if g.geom_type == "LineString" and not g.is_empty:
    yield g
  elif hasattr(g, "geoms"):
    for child in g.geoms:
      yield from lines(child)


def pieces(g, limit=105.0):
  for line in lines(g):
    if line.length < 3:
      continue
    n = math.ceil(line.length / limit)
    for i in range(n):
      yield substring(line, line.length * i / n, line.length * (i + 1) / n)


def rounded(line):
  result = []
  for x, z in line.coords:
    p = [round(x, 4), round(z, 4)]
    if not result or p != result[-1]:
      result.append(p)
  return result


def selected_shores(poly, mask):
  """The drawn and native outlines keep their own corners and holes."""
  poly = orient(poly, sign=1.0)
  for loop in [poly.exterior, *poly.interiors]:
    for piece in pieces(LineString(loop.coords).intersection(mask)):
      points = rounded(piece)
      if len(points) > 1:
        yield points


def lake(mode, geoms):
  lake_nav = read(DATA / "westLakesV194Navigation.json")
  site = next(
    item
    for item in lake_nav["native" if mode == "minecraft" else mode]
    if item["key"] == "tegel-water"
  )
  polygons = [Polygon(parts[0], parts[1:]) for parts in site["polygons"]]
  masks = []
  # The location of the photograph of the sloping stone revetment and the
  # independently mapped paved promenade determine the observed reach.
  stone = geoms[PROMENADE].buffer(16).intersection(box(-6650, -7798, -6250, -7575))
  masks.append(("greenwich-anleger", stone, "stone", "paved-slope", 4.9, "greenwich"))
  sand = []
  for ident, name in sorted(BEACH.items()):
    edge = geoms[ident].buffer(2.2)
    if name == "strandbad-tegelsee":
      # LAGeSo distinguishes central sand, a lawn in the FKK part to the
      # north and the wooded lawn to the south. Only model the central beach.
      edge = edge.intersection(box(-8600, -6854, -8150, -6736))
    sand.append(edge)
    masks.append((name, edge, "natural", "sand", 4.6, "badegewaesser"))
  beaches = unary_union(sand)
  for ident in sorted(REEDS):
    name = f"roehricht-{ident}"
    edge = geoms[ident].buffer(2.2).difference(beaches.buffer(1.0))
    masks.append((name, edge, "natural", "reeds", 2.5, "roehricht"))
  for name, mask, material, profile, width, source in masks:
    ranges = [pts for poly in polygons for pts in selected_shores(poly, mask)]
    for i, pts in enumerate(ranges):
      yield dict(
        id=f"tegel-{name}-{mode}-{i}",
        water="Tegeler See",
        material=material,
        profile=profile,
        width=width,
        points=pts,
        waterY=lake_nav["waterY"],
        height=4.15,
        waterSide=1,
        modes=[mode],
        host="west-lakes-v194",
        source=source,
      )


def face_chains(rows):
  # Model curves and native steps can have multiple starts and disjoint
  # branches at crossings. A different reference height splits the run.
  starts = defaultdict(list)
  ends = defaultdict(list)
  for n, (a, b, _) in enumerate(rows):
    starts[a].append(n)
    ends[b].append(n)
  pending = set(range(len(rows)))
  while pending:
    n = next(
      (j for j in sorted(pending) if not any(k in pending for k in ends[rows[j][0]])),
      min(pending),
    )
    chain = []
    distance = 0.0
    while n in pending:
      pending.remove(n)
      a, b, idx = rows[n]
      chain.append((a, b, idx))
      distance += math.dist(a[:2], b[:2])
      following = [j for j in starts[b] if j in pending]
      if len(following) != 1 or distance > 90:
        break
      n = following[0]
    yield chain


def painted_spans(rows):
  """Reproduce the paint-placement condition of createPankeBanksV229.

  Reserve the whole subdivision holding a motif, including both ends. This
  also protects the width of the old Native paint boxes at a corner.
  """
  painted = []
  for ax, az, bx, bz, _, _, material, *_ in rows:
    length = math.hypot(bx - ax, bz - az)
    subdivisions = max(1, math.ceil(length / 12))
    if material != "brick" or length / subdivisions <= 2.2:
      continue

    def point(t):
      return ax + (bx - ax) * t, az + (bz - az) * t

    for i in range(subdivisions):
      x, z = point((i + 0.5) / subdivisions)
      if (math.floor(x / 24) + math.floor(z / 24)) % 3 == 0:
        painted.append(
          LineString([point(i / subdivisions), point((i + 1) / subdivisions)])
        )
  return unary_union(painted).buffer(3)


def wall_runs(rows, paint):
  for chain in face_chains(rows):
    if paint is None:
      yield chain, False
      continue

    def free(face):
      a, b, _ = face
      return (
        min(a[1], b[1]) >= -3240
        and max(a[1], b[1]) <= -3192
        and paint.disjoint(LineString([a[:2], b[:2]]))
      )

    groups = [(clear, list(faces)) for clear, faces in groupby(chain, free)]
    # Give the green upper slope enough uninterrupted length to read as a
    # bank; merge short paint-free scraps back into adjacent vertical brick.
    for sloped, parts in groupby(
      groups,
      lambda group: (
        group[0] and sum(math.dist(a[:2], b[:2]) for a, b, _ in group[1]) >= 16
      ),
    ):
      yield [face for _, part in parts for face in part], sloped


def panke_brick(mode):
  native = mode == "minecraft"
  model = read(
    DATA / ("pankeNativeBanksV229.json" if native else "pankeBanksV229.json")
  )
  # Keep complete previously verified owner faces. Their bounds avoid every
  # bridge landing and neither cross a tunnel nor bridge the oppositely facing
  # walls of a narrow canal. Coordinates are in the existing viewer frame.
  reaches = [
    ("walter-roeber", box(65, -3280, 168, -3156), "walter-roeber"),
    ("kolberger-strasse", box(150, -2886, 334, -2778), "kolberger"),
  ]
  paint = painted_spans(model["banks"])
  for key, scope, source in reaches:
    selected = []
    for idx, r in enumerate(model["banks"]):
      a = tuple(r[:2])
      b = tuple(r[2:4])
      if not scope.buffer(0.01).covers(LineString([a, b])):
        continue
      nx, nz = r[4:6]
      left = (-b[1] + a[1]) * nx + (b[0] - a[0]) * nz
      a = (*a, r[7])
      b = (*b, r[8])
      selected.append((a, b, idx) if left > 0 else (b, a, idx))
    for i, (chain, sloped) in enumerate(
      wall_runs(selected, paint if key == "walter-roeber" else None)
    ):
      pts = [chain[0][0]] + [b for a, b, idx in chain]
      yield dict(
        id=f"panke-{key}-{mode}-{i}",
        water="Panke",
        material="brick",
        points=[list(p[:2]) for p in pts],
        waterSide=1,
        waterY=WATER_Y,
        topY=[p[2] for p in pts],
        modes=[mode],
        host="panke-v229",
        source=source,
        **(
          {"brickPlinthHeight": 1.2, "width": 0.9, "faceOffset": 0}
          if sloped
          else {"faceOffset": -0.012 if native else -0.055}
        ),
        **{
          ("nativePankeFaces" if native else "pankeFaces"): [idx for a, b, idx in chain]
        },
      )


def packet_shore(mode, host, limits, name, material, **finish):
  packet = read(PACK / f"{host}.{mode}.json.gz")
  ox, _, oz = packet["origin"]

  def plan(item):
    return translate(Polygon(item["ring"], item.get("holes", [])), ox, oz)

  bridges = unary_union([plan(b) for b in packet["nav"]["bridges"]])
  water = unary_union([plan(w) for w in packet["nav"]["water"]])
  polys = [water] if water.geom_type == "Polygon" else list(water.geoms)
  mask = limits.difference(bridges.buffer(5))
  runs = [pts for poly in polys for pts in selected_shores(poly, mask)]
  for i, pts in enumerate(runs):
    yield dict(
      id=f"panke-{name}-{mode}-{i}",
      water="Panke",
      material=material,
      points=pts,
      waterSide=1,
      waterY=WATER_Y,
      height=packet["nav"]["groundY"] - WATER_Y,
      modes=[mode],
      host=host,
      source=name,
      **finish,
    )


def outer_panke(mode):
  park = shape(
    read(GEO / "park-paths-v329-source.json.gz")["parks"]["Bürgerpark Pankow"][
      "boundary"
    ]
  )
  # Only the park-facing bank west of the mapped footbridge.
  limits = park.buffer(2).intersection(box(1557, -5730, 1769, -5650))
  yield from packet_shore(
    mode, "north190-3_-12", limits, "buergerpark", "natural", profile="bank", width=1.55
  )
  # Open walled reach opposite the Gropiusstraße, cutting off well before
  # the north portal of the covered reach below Badstraße. In Native the
  # actual streamed water steps here differ from the long drawn V229 chord.
  tunnels = shape(read(GEO / "panke-banks-v229-source.json")["tunnels"])
  limits = box(397, -3760, 460, -3685).difference(tunnels.buffer(5))
  yield from packet_shore(mode, "0_-8", limits, "gropius-badstrasse", "brick")


def build():
  geoms = {r["id"]: shape(r["geometry"]) for r in read(SOURCE)["records"]}
  records = []
  for mode in MODELS:
    records.extend(lake(mode, geoms))
    records.extend(panke_brick(mode))
    records.extend(outer_panke(mode))
  assert len({r["id"] for r in records}) == len(records)
  write(DEST, {"records": records})


if __name__ == "__main__":
  cli = argparse.ArgumentParser(description=__doc__)
  cli.add_argument("--osm", type=Path)
  args = cli.parse_args()
  if args.osm is not None:
    capture(args.osm)
  build()
