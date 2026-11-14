"""Stage source-bound planting details inside retained Mitte parks and riverbanks."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import random
import subprocess
from pathlib import Path

import pyogrio
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

from scripts.build_spree_bridges_v242 import extrusion
from scripts.build_spree_details_v337 import GEO, PUBLIC, ROOT, json_bytes, sha
from scripts.build_surrounding_outlines import PackedMesh, polygonal, tags_for, world

PREVIOUS = "4f62439888017004188570f6e815041a6cc146df"
KIND = "mitte-garden-details"
FROZEN = GEO / f"{KIND}-source.json.gz"
CORE = ROOT / "src/app/public/mesh/regierungsviertel"
CANDIDATES = GEO / "raw/outer-v159/candidate.gpkg"
GRIS = GEO / "raw/public-green-v329/gruenanlagen.gpkg"
FLOWERS = {
  "1413092017",
  "1413119406",
  "1430182908",
  "1074476456",
  "1074476460",
  "1074476461",
  "1074504209",
  "1074504210",
  "1096688334",
}
OTTOPARK_SCRUB = {"323636807", "1096693035", "1096693036", "1096694486", "1096694488"}
HANSAVIERTEL = {"1418319434", "1418319818"}
HOLSTEINER_UFER = {"1252289605", "1436636390", "1436636391"}
HOLSTEINER_GRIS = "00008100:0014b875"
MARSH = {"28583053", "121807634"}
HISTORIC_TIERGARTEN = "00008100:0014bc1d"
HISTORIC_ROCK_GARDEN = "00008100:0028a2cd"
MOABIT_PARKS = {"00008100:0014bbf2", "00008100:0014bbf3", "00008100:0029e2ff"}
HOSTS = {
  (-5, 0): "hansa237--5_0",
  (-4, 0): "hansa237--4_0",
  (-4, -1): "hansa237--4_-1",
  (-5, -2): "moabit237--5_-2",
  (-4, -2): "moabit237--4_-2",
}
REFERENCES = {
  "hansaplatz": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046313",
  "hansaviertel": "https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2020/998-2020-anlage-3-1-erhv-hansaviertel_textteil.pdf",
  "englischer-garten": "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/grossbritannien/mitte/englischer-garten-647982.php",
  "moabit-parks": "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/parks-und-gaerten/",
  "tiergarten": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318%2CT",
  "osm": "https://www.openstreetmap.org/copyright",
  "gris": "https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/gruenflaecheninformationssystem-gris/karten-online/",
}
PALETTES = {
  "flowerbed": ((62, 91, 56), (93, 114, 61), (114, 143, 77)),
  "river-scrub": ((47, 76, 51), (64, 96, 62), (77, 114, 68)),
  "ottopark-scrub": ((57, 87, 54), (73, 103, 62), (86, 116, 70)),
  "marsh": ((76, 106, 62), (112, 133, 70), (150, 149, 87)),
}
FLOWER_TOPS = ((186, 148, 114), (175, 134, 157), (207, 178, 106), (214, 204, 165))
SPACING = {
  "river-scrub": 1.65,
  "ottopark-scrub": 2.45,
  "flowerbed": 1.35,
  "marsh": 2.65,
}
RADIUS = {"river-scrub": 0.78, "ottopark-scrub": 1.03, "flowerbed": 0.48, "marsh": 0.48}


def file_sha(path: Path) -> str:
  with path.open("rb") as file:
    return hashlib.file_digest(file, "sha256").hexdigest()


def predecessor(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{PREVIOUS}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def polygon_dm(row):
  def ring(points):
    return [(x / 10, z / 10) for x, z in points]

  return Polygon(ring(row["ring"]), [ring(hole) for hole in row.get("holes", [])])


def exact_green():
  ids = {HISTORIC_TIERGARTEN, HISTORIC_ROCK_GARDEN, HOLSTEINER_GRIS, *MOABIT_PARKS}
  sql = ",".join(repr(value) for value in sorted(ids))
  records = pyogrio.read_dataframe(GRIS, where=f"pitid IN ({sql})").to_crs(25833)
  result = {
    row.pitid: (row.namenr, world(row.geometry))
    for row in records.itertuples()
    if row.widmung == "gewidmet"
  }
  assert set(result) == ids
  return result


class Terrain:
  """Replicate the current Drawn drape and the existing Native run-top placement."""

  def __init__(self, payload: dict, native: bool):
    self.payload = payload
    self.native = native
    self.cell = payload["cell_m"]
    self.grid = payload["grid"]
    self.height = payload["ground_height"]

  def locate(self, x, z):
    return x / self.cell - self.grid["min_x_idx"], z / self.cell - self.grid[
      "min_z_idx"
    ]

  def sample(self, col, row):
    grid = self.height
    col = max(0, min(grid["cols"] - 1, col))
    row = max(0, min(grid["rows"] - 1, row))
    return grid["y_dm"][row * grid["cols"] + col] / 10

  def at(self, x, z):
    u, v = self.locate(x, z)
    stride = self.height["stride_cells"]
    row = math.floor(v)
    for start, length, kind in self.payload["ground_rows"][row]:
      if not start <= u < start + length:
        continue
      name = self.payload["classes"][kind]
      if self.native:
        y = self.sample(math.floor((start + length / 2) / stride), row // stride)
      else:
        a, b = u / stride - 0.5, v / stride - 0.5
        col, r = math.floor(a), math.floor(b)
        da, db = a - col, b - r
        y = (self.sample(col, r) * (1 - da) + self.sample(col + 1, r) * da) * (
          1 - db
        ) + (self.sample(col, r + 1) * (1 - da) + self.sample(col + 1, r + 1) * da) * db
      return name, y
    return "", None


def capture():
  """Freeze only source-owned green areas and tested decorative anchors."""
  geo_ids = sorted(FLOWERS | HANSAVIERTEL | HOLSTEINER_UFER | MARSH | OTTOPARK_SCRUB)
  sql = ",".join(repr(value) for value in geo_ids)
  rows = pyogrio.read_dataframe(
    CANDIDATES, layer="multipolygons", where=f"osm_way_id IN ({sql})"
  ).to_crs(25833)
  old = json.loads((CORE / "park-details.json").read_bytes())
  surfaces = json.loads((CORE / "surface-polygons.json").read_bytes())
  shell = json.loads((CORE / "lod2-prisms.json").read_bytes())
  green = exact_green()
  paths = [polygon_dm(s).buffer(0) for s in surfaces["roads"]]
  water = [polygon_dm(s).buffer(0) for s in surfaces["water"]]
  buildings = [polygon_dm(s).buffer(0) for s in shell["buildings"]]
  scrub = [
    Point(x / 10, z / 10).buffer(r / 10) for x, z, r, *_ in surfaces["scrub_points"]
  ]
  shrubs = [
    Point(x, z).buffer(r)
    for patch in old["shrub_patches"]
    for x, _, z, r, *_ in patch["clusters"]
  ]
  terrain = [
    Terrain(json.loads((CORE / file).read_bytes()), index == 1)
    for index, file in enumerate(("ground-context.json", "minecraft-voxels.json"))
  ]
  recorded = set()
  result = []
  official_green = unary_union([green[identifier][1] for identifier in MOABIT_PARKS])
  covered = {}
  for row in sorted(rows.to_dict("records"), key=lambda item: item["osm_way_id"]):
    tags = tags_for(row)
    identifier = tags["osm_way_id"]
    if identifier in recorded:
      raise ValueError(f"Duplicate source polygon {identifier}")
    recorded.add(identifier)
    mapped = world(row["geometry"]).buffer(0)
    if identifier in HANSAVIERTEL:
      assert tags.get("natural") == "scrub"
      style, owner, support = "river-scrub", "Hansaplatz", mapped
    elif identifier in HOLSTEINER_UFER:
      assert tags.get("natural") == "scrub"
      style, owner = "river-scrub", "Holsteiner Ufer"
      support = mapped.intersection(green[HOLSTEINER_GRIS][1])
    elif identifier in OTTOPARK_SCRUB:
      assert tags.get("natural") == "scrub"
      style, owner = "ottopark-scrub", "Ottopark"
      support = mapped.intersection(green["00008100:0014bbf2"][1])
    elif identifier in MARSH:
      assert tags.get("wetland") == "marsh"
      style, owner = "marsh", "Großer Tiergarten"
      support = mapped.intersection(green[HISTORIC_TIERGARTEN][1])
    else:
      assert tags.get("landuse") == "flowerbed"
      style, owner, official = (
        ("flowerbed", "Englischer Garten – Steingarten", green[HISTORIC_ROCK_GARDEN][1])
        if mapped.centroid.y > 0
        else ("flowerbed", "Kleiner Tiergarten/Ottoplatz", official_green)
      )
      support = mapped.intersection(official)
    support = support.difference(covered.get(owner, Polygon()))
    covered[owner] = unary_union([covered.get(owner, Polygon()), support])
    radius = RADIUS[style]
    local = support.buffer(3)
    obstacles = unary_union(
      [
        geometry.intersection(local)
        for geometry in (*paths, *water, *buildings, *scrub, *shrubs)
        if geometry.intersects(local)
      ]
    ).buffer(0.34)
    visible = polygonal(support.difference(obstacles).buffer(-radius - 0.04))
    placement = []
    step = SPACING[style]
    rng = random.Random(int(identifier))
    if not visible.is_empty:
      x0, z0, x1, z1 = visible.bounds
      for xi in range(math.floor(x0 / step), math.ceil(x1 / step)):
        for zi in range(math.floor(z0 / step), math.ceil(z1 / step)):
          x = round((xi + rng.uniform(0.2, 0.8)) * step, 2)
          z = round((zi + rng.uniform(0.2, 0.8)) * step, 2)
          if not visible.covers(Point(x, z)):
            continue
          dx, dz = x % 512, z % 512
          if min(dx, dz, 512 - dx, 512 - dz) <= radius:
            continue
          samples = [t.at(x, z) for t in terrain]
          if not all(name == "grass" and y is not None for name, y in samples):
            continue
          placement.append(
            [
              x,
              z,
              samples[0][1],
              samples[1][1],
              rng.randint(0, 2),
              rng.randint(0, 3),
              rng.uniform(0.76, 1.0),
            ]
          )
    if placement:
      result.append(
        dict(
          id=f"way/{identifier}",
          tags=tags,
          style=style,
          area=owner,
          sourceGeometry=mapping(mapped),
          placementSupport=mapping(visible),
          points=placement,
        )
      )
  assert recorded == set(geo_ids)
  return {
    "schemaVersion": 1,
    "sources": {
      str(p.relative_to(ROOT)): file_sha(p)
      for p in (
        CANDIDATES,
        GRIS,
        CORE / "park-details.json",
        CORE / "surface-polygons.json",
        CORE / "lod2-prisms.json",
        CORE / "ground-context.json",
        CORE / "minecraft-voxels.json",
      )
    },
    "references": REFERENCES,
    "omittedFeatures": sorted(recorded - {f["id"].split("/")[1] for f in result}),
    "features": result,
  }


def blade(mesh, base, angle, height, width, lean, color):
  x, y, z = base
  dx, dz = math.cos(angle), math.sin(angle)
  tip = (x - dz * lean, y + height, z + dx * lean)
  middle = (x - dz * lean * 0.37, y + height * 0.56, z + dx * lean * 0.37)
  left = (x - dx * width, y, z - dz * width)
  right = (x + dx * width, y, z + dz * width)
  outer = (middle[0] + dx * width * 0.66, middle[1], middle[2] + dz * width * 0.66)
  mesh.triangle([left, right, outer], color)
  mesh.triangle([left, outer, tip], color)


def canopy(mesh, x, y, z, radius, height, color, facets=8):
  points = [
    (x + radius * math.cos(angle), z + radius * math.sin(angle))
    for angle in (i * math.tau / facets for i in range(facets + 1))
  ]
  for a, b in zip(points, points[1:]):
    mesh.triangle(
      [
        (a[0], y + height * 0.36, a[1]),
        (b[0], y + height * 0.36, b[1]),
        (x, y + height, z),
      ],
      color,
    )
    mesh.triangle(
      [(b[0], y + height * 0.36, b[1]), (a[0], y + height * 0.36, a[1]), (x, y, z)],
      color,
    )


def model(mesh, row, item, native):
  x, z, drawn_y, native_y, color, accent, size = item
  style = row["style"]
  r = RADIUS[style] * size
  y = native_y if native else drawn_y + 0.08
  palette = PALETTES[style]
  tint = palette[color]
  if style in {"river-scrub", "ottopark-scrub"}:
    height = (1.65 if style == "river-scrub" else 1.32) * size
    if native:
      extrusion(mesh, box(x - r, z - r, x + r, z + r), y, y + height * 0.56, tint)
      q = r * 0.58
      extrusion(
        mesh,
        box(x - q, z - q, x + q, z + q),
        y + height * 0.56,
        y + height,
        palette[(color + 1) % 3],
      )
    else:
      for offset, ratio, index in ((-0.27, 0.65, 0), (0.28, 0.59, 1), (0, 0.78, 2)):
        canopy(
          mesh,
          x + r * offset,
          y,
          z + r * offset * 0.7,
          r * ratio,
          height * (ratio + 0.22),
          palette[(color + index) % 3],
        )
    return
  if style == "marsh":
    for i in range(5):
      angle = i * math.tau / 5 + accent
      px, pz = x + math.cos(angle) * r * 0.57, z + math.sin(angle) * r * 0.57
      height = (0.60 + 0.14 * ((i + accent) % 4)) * size
      if native:
        extrusion(
          mesh,
          box(px - 0.035, pz - 0.035, px + 0.035, pz + 0.035),
          y,
          y + height,
          palette[(color + i) % 3],
        )
      else:
        blade(mesh, (px, y, pz), angle, height, 0.045, 0.2, palette[(color + i) % 3])
    return
  height = 0.24 + 0.13 * size
  if native:
    extrusion(mesh, box(x - r, z - r, x + r, z + r), y, y + height, tint)
    q = r * 0.26
    extrusion(
      mesh,
      box(x - q, z - q, x + q, z + q),
      y + height,
      y + height + 0.085,
      FLOWER_TOPS[accent],
    )
  else:
    canopy(mesh, x, y, z, r, height, tint)
    for i in range(2):
      angle = accent + i * math.tau / 2
      q = r * 0.51
      canopy(
        mesh,
        x + math.cos(angle) * q,
        y + height * 0.65,
        z + math.sin(angle) * q,
        0.07,
        0.12,
        FLOWER_TOPS[accent],
        facets=4,
      )


def stage(directory):
  source = json.loads(gzip.decompress(FROZEN.read_bytes()))
  manifest = json.loads(predecessor(PUBLIC / "manifest.json"))
  hosts = {row["id"]: row for row in manifest["chunks"]}
  tiles = {}
  for feature in source["features"]:
    for point in feature["points"]:
      x, z = point[:2]
      tiles.setdefault((math.floor(x / 512), math.floor(z / 512)), []).append(
        (feature, point)
      )
  receipt, additions = {}, []
  for (ix, iz), plants in sorted(tiles.items()):
    host = HOSTS.get((ix, iz))
    chunk_id = host or f"{KIND}-{ix}_{iz}"
    x, z = ix * 512, iz * 512
    descriptor = dict(id=chunk_id, bounds=[x, z, x + 512, z + 512])
    for family in ("drawn", "minecraft"):
      mesh = PackedMesh(x, z)
      for feature, point in plants:
        model(mesh, feature, point, family == "minecraft")
      geometry = mesh.payload(KIND)
      assert geometry is not None
      if host:
        asset = hosts[host][family]
        path = PUBLIC / asset["url"]
        original = predecessor(path)
        assert sha(original) == asset["sha256"] and len(original) == asset["bytes"]
        packet = json.loads(gzip.decompress(original))
        assert packet["origin"] == [x, -10, z]
        assert len(packet["meshes"]) < 16
      else:
        asset = None
        path = PUBLIC / f"{chunk_id}.{family}.json.gz"
        packet = dict(
          schemaVersion=1,
          origin=[x, -10, z],
          meshes=[],
          nav=dict(ground=[], water=[], buildings=[], groundY=5.2),
        )
      packet["meshes"].append(geometry)
      raw = json_bytes(packet)
      wire = gzip.compress(raw, compresslevel=9, mtime=0)
      assert len(raw) <= 12 * 1024 * 1024
      after = dict(
        url=path.name,
        encoding="gzip",
        bytes=len(wire),
        decodedBytes=len(raw),
        sha256=sha(wire),
      )
      descriptor[family] = after
      (directory / path.name).write_bytes(wire)
      receipt[f"{family}:{chunk_id}"] = dict(
        before=asset,
        after=after,
        kind=KIND,
        owners=sorted({feature["id"] for feature, _ in plants}),
        placements=len(plants),
        triangles=len(mesh.indices) // 3,
        geometryBytes=len(mesh.vertices) * 12 + len(mesh.indices) * 4,
      )
    if not host:
      additions.append(descriptor)
  receipt = dict(
    previous=PREVIOUS,
    sourceSha256=file_sha(FROZEN),
    additions=additions,
    packets=receipt,
  )
  (directory / "receipt.json").write_bytes(json_bytes(receipt))
  return receipt


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("output", type=Path)
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source:
    FROZEN.write_bytes(gzip.compress(json_bytes(capture()), compresslevel=9, mtime=0))
  args.output.mkdir(exist_ok=True, parents=True)
  print(stage(args.output))
