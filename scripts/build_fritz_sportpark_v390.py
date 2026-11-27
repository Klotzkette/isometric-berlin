"""Fit the Poststadion courts and the Fritz-Schloß-Park hill to mapped and measured surfaces."""

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
import pyogrio
import shapely as sh
from PIL import Image
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
X, Z = -1240, -1560
EXTENT = (388260, 5820780, 388980, 5821560)
AREA = (13.3475, 52.5228, 13.362, 52.5345)
COLORS = [
  "b49a83",
  "7c9454",
  "729966",
  "ad6147",
  "af6657",
  "aaa79b",
  "8b9895",
  "aeaaa0",
  "717c77",
]
OWNERS = ["t5WhhQNJ", "j50000ZC"]


def read(path):
  return json.loads(path.read_bytes())


def write(path, value):
  content = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  if not path.exists() or path.read_bytes() != content:
    path.write_bytes(content)


def pieces(g):
  if g.geom_type == "Polygon" and g.area > 0.001:
    yield g
  elif hasattr(g, "geoms"):
    for child in g.geoms:
      yield from pieces(child)


def field_sources(pbf):
  frame = pyogrio.read_dataframe(pbf, layer="multipolygons", bbox=AREA).to_crs(25833)
  areas = {}
  for row in frame.itertuples():
    idx = str(getattr(row, "osm_way_id", None) or row.osm_id)
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags)))
    areas[idx] = (affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000]), tags)
  return areas


def blob(values):
  return base64.b64encode(np.asarray(values, dtype="<i2").tobytes()).decode()


def run(pbf, cache):
  geom = field_sources(pbf)
  bdom, dgm = [np.asarray(Image.open(cache / (k + ".tif"))) for k in ["bdom", "dgm"]]
  assert Image.open(cache / "truedop_2026.jpg").size == (1440, 1560)
  assert bdom.shape == dgm.shape == (780, 720)
  ground = read(MESH / "ground-context.json")
  vox = read(MESH / "minecraft-voxels.json")
  cell = ground["cell_m"]
  grid = ground["grid"]
  step = cell * ground["ground_height"]["stride_cells"]
  west, north = grid["min_x_idx"] * cell, grid["min_z_idx"] * cell
  heights = (
    np.array(ground["ground_height"]["y_dm"]).reshape(
      -1, ground["ground_height"]["cols"]
    )
    / 10
  )

  def terrain(x, z, native=False):
    u, v = (x - west) / step, (z - north) / step
    if native:
      return heights[math.floor(v), math.floor(u)]
    i, j = math.floor(u - 0.5), math.floor(v - 0.5)
    a, b = u - 0.5 - i, v - 0.5 - j
    return (heights[j, i] * (1 - a) + heights[j, i + 1] * a) * (1 - b) + (
      heights[j + 1, i] * (1 - a) + heights[j + 1, i + 1] * a
    ) * b

  structures = read(MESH / "lod2-prisms.json")["buildings"]
  owners = [next(p for p in structures if p["id"] == k) for k in OWNERS]

  def outline(p):
    return Polygon(
      np.array(p["ring"]) / 10, [np.array(r) / 10 for r in p.get("holes", [])]
    )

  arena, terrace = [outline(p) for p in owners]
  neighbours = [
    outline(p)
    for p in structures
    if p["id"] not in OWNERS and arena.envelope.intersects(outline(p).envelope)
  ]
  other = sh.union_all([p for p in neighbours if p.intersects(arena.buffer(5))])
  runs = []
  for iz, row in enumerate(vox["building_rows"]):
    z = iz + grid["min_z_idx"]
    if not -340 <= z <= -283:
      continue
    for start, count, lo, hi, kind in row:
      if (lo, hi) != (52, 92):
        continue
      accepted = []
      for x in range(start + grid["min_x_idx"], start + grid["min_x_idx"] + count):
        if not -226 <= x <= -168:
          continue
        pt = Point((x + 0.5) * cell, (z + 0.5) * cell)
        if (arena.covers(pt) or terrace.covers(pt)) and not other.covers(pt):
          accepted.append(x)
      for x in accepted:
        if runs and runs[-1][0] == z and runs[-1][2] + 1 == x and runs[-1][3] == kind:
          runs[-1][2] = x
        else:
          runs.append([z, x, x, kind])
  assert any(a <= -199 <= b and z == -315 for z, a, b, _ in runs)
  write(DATA / "fritzArenaOwnersV390.json", {"owners": owners, "columns": runs})

  pitches = read(DATA / "weddingMoabitV229.json")["pitches"]
  frame = next(p["frame"] for p in pitches if p["id"] == "way/17189008")
  cx, cz, ux, uz, *_ = frame

  def position(u, v):
    return (cx + ux * u - uz * v, cz + uz * u + ux * v)

  def station(x, z):
    return (x - cx) * ux + (z - cz) * uz, (z - cz) * ux - (x - cx) * uz

  # The red all-weather field and jumping areas are visible inside the mapped
  # athletics circuit. Retain its outer edge and subtract the grass infield.
  ring = next(pieces(geom["4064202"][0]))
  pitch = geom["17189008"][0]
  sports = [(Polygon(ring.exterior).difference(pitch), 4)]
  for p in pitches:
    idx = p["id"].split("/")[1]
    surface = geom[idx][1]["surface"]
    sports.append(
      (geom[idx][0], {"clay": 3, "grass": 1, "artificial_turf": 2}[surface])
    )
  sports.extend(
    [(geom["618370862"][0], 5), (geom["117686185"][0], 5), (geom["355080039"][0], 5)]
  )
  # Terrace treads follow the measured rise of the uncovered north bank. Long
  # runs are split at the radial aisles visible in the overhead photograph.
  tier_surfaces = []
  x0, z0, x1, z1 = terrace.bounds
  for tier in range(8):
    a = -45 - tier * 1.35
    for left, right in [(-49, -26), (-24, -1), (1, 23), (25, 52)]:
      slab = Polygon(
        [
          position(left, a),
          position(right, a),
          position(right, a - 1.29),
          position(left, a - 1.29),
        ]
      ).intersection(terrace)
      if not slab.is_empty:
        tier_surfaces.append((slab, 6 + (tier % 2), 0.26 + tier * 0.31))
  for part in pieces(geom["20352416"][0]):
    # East curves retain a narrower grey terrace ring. Keep the mapped outlines
    # open and outside the athletics track.
    for tier in range(4):
      shell = part.intersection(
        Polygon(ring.exterior)
        .buffer(1.8 + tier * 2.5)
        .difference(Polygon(ring.exterior).buffer(tier * 2.5))
      )
      if not shell.is_empty:
        tier_surfaces.append((shell, 7 if tier % 2 else 8, 0.17 + tier * 0.24))

  # Block and drawn ground use different height samples; both sport finishes
  # have a small clearance underneath the existing surveyed painted markings.
  vertices = []
  indices = []
  lookup = {}
  native = []

  def vertex(x, z, h, col):
    key = (round((x - X) * 10), round(h * 100), round((z - Z) * 10), col)
    if key not in lookup:
      lookup[key] = len(vertices)
      vertices.append(key)
    return lookup[key]

  for g, col, rise in [(g, c, 0.065) for g, c in sports] + tier_surfaces:
    if g.is_empty:
      continue
    minx, minz, maxx, maxz = g.bounds
    for zi in range(
      math.floor((minz - north - 8) / 8), math.ceil((maxz - north - 8) / 8)
    ):
      for xi in range(
        math.floor((minx - west - 8) / 8), math.ceil((maxx - west - 8) / 8)
      ):
        left, top = west + 8 + 8 * xi, north + 8 + 8 * zi
        for poly in pieces(g.intersection(box(left, top, left + 8, top + 8))):
          for face in sh.constrained_delaunay_triangles(poly).geoms:
            tri = [
              vertex(x, z, terrain(x, z) + rise, col)
              for x, z in list(face.exterior.coords)[:3]
            ]
            if len(set(tri)) == 3:
              indices.extend(tri)
    if col >= 6:
      for poly in pieces(g):
        for (ax, az), (bx, bz) in zip(
          poly.exterior.coords, list(poly.exterior.coords)[1:]
        ):
          ay, by = terrain(ax, az), terrain(bx, bz)
          a, b = vertex(ax, az, ay + rise, col), vertex(bx, bz, by + rise, col)
          c, d = vertex(bx, bz, by + 0.02, 8), vertex(ax, az, ay + 0.02, 8)
          indices.extend([a, b, c, a, c, d])
    # One-metre cardinal silhouette, merging equal-height neighbours per row.
    for z in range(math.floor(minz), math.ceil(maxz)):
      xs = np.arange(math.floor(minx), math.ceil(maxx))
      inside = xs[sh.contains_xy(g, xs + 0.5, z + 0.5)]
      for x0 in inside:
        x = int(x0)
        y = round((terrain(x + 0.5, z + 0.5, True) + rise) * 100)
        if (
          native
          and native[-1][1] == z - Z
          and native[-1][0] + native[-1][2] == x - X
          and native[-1][3:] == [y, col]
        ):
          native[-1][2] += 1
        else:
          native.append([x - X, z - Z, 1, y, col])
  assert max(indices) < 32768
  details = read(MESH / "park-details.json")
  built = [
    outline(p).buffer(0.45)
    for p in structures
    if p["id"] not in OWNERS
    and -1500 < p["ring"][0][0] / 10 < -500
    and -1750 < p["ring"][0][1] / 10 < -550
    and geom["323366732"][0].intersects(outline(p))
  ]
  # Preserve previously modelled trunks in both detail families. Measured
  # stems, heights and crown diameters are read from the city tree register.
  register = read(cache / "baumbestand.json")
  assert len(register["features"]) == register["numberMatched"]
  existing_xy = [
    (r["position"][0], r["position"][2])
    for r in details["trees"]
    if -1250 < r["position"][0] < -500 and -1560 < r["position"][2] < -760
  ]
  native_cells = {
    (grid["min_x_idx"] + r[0], grid["min_z_idx"] + j)
    for j, line in enumerate(vox["tree_rows"])
    for r in line
  }
  forbidden = sh.union_all([geom["121068797"][0], *[g for g, _ in sports], *built])
  crowns = []
  tree_receipts = []
  for record in sorted(register["features"], key=lambda f: f["id"]):
    props = record["properties"]
    park = props.get("namenr") or ""
    if not any(
      k in park for k in ["Fritz-Schloß-Park", "Poststadion", "Tennisplatz Lehrter"]
    ):
      continue
    x, yy = record["geometry"]["coordinates"]
    x -= 389500
    z = 5820000 - yy
    height_m = props.get("baumhoehe")
    diam = props.get("kronedurch")
    if not height_m or not diam or diam <= 0 or height_m <= 0:
      continue
    if forbidden.covers(Point(x, z)) or any(
      (x - a) ** 2 + (z - b) ** 2 < 2.4**2 for a, b in existing_xy
    ):
      continue
    native_has_tree = (math.floor(x / cell), math.floor(z / cell)) in native_cells
    tree_receipts.append(
      [
        record["id"],
        props["gisid"],
        props["namenr"],
        props.get("art_bot"),
        props.get("art_gruppe"),
        record["geometry"]["coordinates"],
        height_m,
        diam,
        native_has_tree,
      ]
    )
    flags = int(native_has_tree) + 2 * int(props.get("art_gruppe") == "Nadelbäume")
    crowns.append(
      [
        round((x - X) * 10),
        round((z - Z) * 10),
        round(terrain(x, z) * 10),
        round(terrain(x, z, True) * 10),
        round(height_m * 10),
        round(diam * 5),
        flags,
      ]
    )
  assert len(crowns) > 200
  out = {
    "origin": [X, Z],
    "paint": [int(c, 16) for c in COLORS],
    "vertices": blob(vertices),
    "indices": blob(indices),
    "native": blob(native),
    "crowns": blob(crowns),
  }
  write(DATA / "fritzSportparkV390.json", out)
  print(
    "mapped sport surfaces",
    len(sports),
    "terrace strips",
    len(tier_surfaces),
    "drawn vertices",
    len(vertices),
    "triangles",
    len(indices) // 3,
    "native runs",
    len(native),
    "observed crowns",
    len(crowns),
    "arena columns",
    sum(b - a + 1 for _, a, b, _ in runs),
  )
  print("native crowns", sum(1 for r in crowns if not r[-1] & 1), flush=True)
  evidence = {
    "bboxEPSG25833": EXTENT,
    "source": {
      "register": "https://gdi.berlin.de/services/wfs/baumbestand?service=WFS&request=GetCapabilities",
      "ortho": "https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&request=GetCapabilities",
      "bdom": "https://isk.geobasis-bb.de/ows/bdom_wcs",
      "dgm": "https://isk.geobasis-bb.de/ows/dgm_wcs",
      "osm": "https://download.geofabrik.de/europe/germany/berlin.html",
    },
    "sha256": {
      n: hashlib.sha256((cache / n).read_bytes()).hexdigest()
      for n in ["bdom.tif", "dgm.tif", "truedop_2026.jpg", "baumbestand.json"]
    },
    "registerColumns": [
      "source id",
      "GIS id",
      "site",
      "botanical name",
      "type",
      "EPSG:25833 stem",
      "height m",
      "crown diameter m",
      "previous native tree",
    ],
    "register": tree_receipts,
    "mappedGeometryWorldWKB": {
      i: g.wkb_hex
      for i, (g, _) in geom.items()
      if i
      in (
        {p["id"].split("/")[1] for p in pitches}
        | {
          "4064202",
          "20352416",
          "863113270",
          "323366732",
          "15803725",
          "121068797",
          "618370862",
          "117686185",
          "355080039",
        }
      )
    },
  }
  target = ROOT / "geo_data/regierungsviertel/fritz-sportpark-v390-survey.json.gz"
  payload = json.dumps(evidence, ensure_ascii=False, separators=(",", ":")).encode()
  target.write_bytes(gzip.compress(payload, mtime=0))
  print("input SHA-256", evidence["sha256"])


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("pbf", type=Path)
  p.add_argument("cache", type=Path)
  args = p.parse_args()
  run(args.pbf, args.cache)
