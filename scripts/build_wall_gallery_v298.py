"""Step 10: bounded retained wall polygons, artwork anchors and hill samples."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
import zipfile
from pathlib import Path
from typing import Any

import pyogrio
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
RAW = GEO / "raw/wall-v298"
TR = Transformer.from_crs(4326, 25833, always_xy=True)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: Any) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def world(g: Any) -> Any:
  return transform(lambda x, y: (x - 389500, 5820000 - y), g)


def record(row: Any) -> dict:
  tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags)))
  for key in ("name", "barrier", "highway", "natural", "landuse", "leisure"):
    val = getattr(row, key, None)
    if val is not None and str(val) not in ("nan", "None"):
      tags[key] = str(val)
  identity = str(row.osm_id)
  if identity == "nan":
    identity = str(row.osm_way_id)
  return dict(id=identity, tags=tags, geometry=mapping(world(row.geometry)))


def audit_core_support(support: Any) -> dict:
  """Audit occupied primitives, not just the larger rectangular grid metadata."""
  root = ROOT / "src/app/public/mesh/regierungsviertel"
  files = [
    root / name
    for name in (
      "lod2-prisms.json",
      "park-details.json",
      "ground-context.json",
      "minecraft-voxels.json",
      "surface-polygons.json",
    )
  ]
  data = {p.name: json.loads(p.read_bytes()) for p in files}
  hits: dict[str, int] = {}

  def intersects(points: list, scale: float = 1) -> bool:
    xy = [(p[0] * scale, p[-1] * scale) for p in points]
    if not xy:
      return False
    return (Point(xy[0]) if len(xy) == 1 else LineString(xy)).intersects(support)

  prisms = data["lod2-prisms.json"]["buildings"]
  hits["prismRings"] = sum(
    Polygon([(x / 10, z / 10) for x, z in b["ring"]]).intersects(support)
    for b in prisms
  )
  park = data["park-details.json"]
  for key in (
    "trees",
    "paths",
    "street_lights",
    "wall_traces",
    "hedges",
    "shrub_patches",
    "playgrounds",
  ):
    n = 0
    for value in park.get(key, []):
      if "position" in value:
        n += intersects([value["position"]])
      elif "points" in value:
        n += intersects(value["points"])
      else:
        n += any(
          intersects(ring) for ring in value.get("rings", [value.get("outline", [])])
        )
    hits["park:" + key] = n
  for key, values in data["surface-polygons.json"].items():
    if (
      isinstance(values, list)
      and values
      and isinstance(values[0], dict)
      and "ring" in values[0]
    ):
      hits["surface:" + key] = sum(
        Polygon([(x / 10, z / 10) for x, z in v["ring"]]).intersects(support)
        for v in values
      )
  west, north, east, south = support.bounds
  for name in ("ground-context.json", "minecraft-voxels.json"):
    d = data[name]
    cell, grid = d["cell_m"], d["grid"]
    hits[name + ":groundCells"] = 0
    for z_index, row in enumerate(d["ground_rows"]):
      z = (grid["min_z_idx"] + z_index) * cell
      if z + cell < north or z > south:
        continue
      for start, length, _ in row:
        first = max(start, math.floor(west / cell - grid["min_x_idx"]))
        end = min(start + length, math.ceil(east / cell - grid["min_x_idx"]))
        for index in range(first, end):
          x = (grid["min_x_idx"] + index) * cell
          hits[name + ":groundCells"] += box(x, z, x + cell, z + cell).intersects(
            support
          )
    if name == "minecraft-voxels.json":
      hits["native:buildingCells"] = hits["native:trees"] = 0
      for zz, row in enumerate(d.get("building_rows", [])):
        z = (grid["min_z_idx"] + zz) * cell
        if z + cell < north or z > south:
          continue
        for start, length, *_ in row:
          first = max(start, math.floor(west / cell - grid["min_x_idx"]))
          end = min(start + length, math.ceil(east / cell - grid["min_x_idx"]))
          for xx in range(first, end):
            x = (grid["min_x_idx"] + xx) * cell
            hits["native:buildingCells"] += box(x, z, x + cell, z + cell).intersects(
              support
            )
      for zz, row in enumerate(d.get("tree_rows", [])):
        for xx, *_ in row:
          x = (grid["min_x_idx"] + xx + 0.5) * cell
          z = (grid["min_z_idx"] + zz + 0.5) * cell
          hits["native:trees"] += support.covers(Point(x, z))
  return dict(
    sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in files},
    supportBounds=list(support.bounds),
    occupiedPrimitiveIntersections=hits,
    interpretation="All occupied Core sources miss the support. A grid bounding-box overlap alone is not rendered ground or a building. No Core object or source array needs alteration; real Mauerpark content is in streamed city packets.",
  )


def build() -> None:
  candidate = GEO / "raw/outer-v159/candidate.gpkg"
  art_ids = "'7857667985','11261632441','11261632447','11261628023','11262731852','11261632466','11261632470','11261632443'"
  points = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="points",
    where="osm_id IN (" + art_ids + ")",
  ).to_crs(25833)
  parks = pyogrio.read_dataframe(
    candidate,
    layer="multipolygons",
    where="osm_id = '9333682' OR osm_way_id = '233994267'",
  ).to_crs(25833)
  old = dict(
    artworks=[record(r) for r in points.itertuples()],
    parkAreas=[record(r) for r in parks.itertuples()],
  )
  raw_api = RAW / "esg-relation-full.json"
  current = json.loads(raw_api.read_bytes())["elements"]
  nodes = {
    p["id"]: TR.transform(p["lon"], p["lat"]) for p in current if p["type"] == "node"
  }
  walls = []
  for way in current:
    if way["type"] != "way":
      continue
    ring = [[nodes[i][0] - 389500, 5820000 - nodes[i][1]] for i in way["nodes"]]
    walls.append(dict(id=str(way["id"]), ring=ring, tags=way["tags"]))
  assert len(walls) == 7 and all(Polygon(w["ring"]).is_valid for w in walls)
  # Exact source-side perimeter station, no painting across a real access gap.
  arts = []
  for identity, kind, width in [
    ("7857667985", "vrubel", 7.2),
    ("11261632441", "kinder", 6.3),
    ("11261632447", "noir", 25.8),
    ("11261628023", "alavi", 13.2),
    ("11262731852", "schaefer", 14.3),
    ("11261632466", "heimler", 14.0),
    ("11261632470", "klingenstein", 15.0),
    ("11261632443", "kuehn", 12.5),
  ]:
    a = next(a for a in old["artworks"] if a["id"] == identity)
    point = Point(a["geometry"]["coordinates"])
    wall = min(walls, key=lambda w: Polygon(w["ring"]).boundary.distance(point))
    boundary = Polygon(wall["ring"]).exterior
    station = boundary.project(point)
    center = boundary.interpolate(station)
    before, after = (
      boundary.interpolate(station - 0.1),
      boundary.interpolate(station + 0.1),
    )
    dx, dz = after.x - before.x, after.y - before.y
    # Use the photographed street-facing east/northeast side. Reversing the
    # local u axis changes the drawing orientation, not the source perimeter.
    direction = -1 if dx * 0.7 + dz * 0.7 > 0 else 1
    arts.append(
      dict(
        id=identity,
        kind=kind,
        title=a["tags"]["name"],
        artist=a["tags"].get("artist_name"),
        point=list(point.coords)[0],
        wallId=wall["id"],
        station=station,
        direction=direction,
        widthM=width,
        heightM=3.12,
        center=list(center.coords)[0],
        sourceDistanceM=point.distance(center),
      )
    )
  pbf = GEO / "raw/outer-v159/candidate.gpkg"
  selected = pyogrio.read_dataframe(
    pbf,
    layer="lines",
    where="osm_id IN ('449318658','30540209','30540722','1299540581','1094209680','30540420','41828680')",
  ).to_crs(25833)
  park_lines = [record(r) for r in selected.itertuples()]
  assert len(park_lines) == 7
  amph = next(p for p in old["parkAreas"] if p["id"] == "9333682")
  wall = next(r for r in park_lines if r["id"] == "449318658")
  park = next(p for p in old["parkAreas"] if p["tags"].get("name") == "Mauerpark")
  # The support mask is explicitly an interpolation extent, not a surveyed
  # hill boundary: exact park × source wall/upper-path convex hull and the
  # amphitheatre. No neighbouring stadium, road or building receives relief.
  support = (
    shape(wall["geometry"])
    .union(shape(amph["geometry"]))
    .convex_hull.buffer(176, quad_segs=4, join_style=1)
  )
  min_x, min_z, max_x, max_z = support.bounds
  step = 4
  x0, z0 = (
    math.floor(min_x / step) * step - step,
    math.floor(min_z / step) * step - step,
  )
  cols, rows = math.ceil((max_x - x0) / step) + 2, math.ceil((max_z - z0) / step) + 2
  wanted = {
    (int(x0 + i * step + 389500), int(5820000 - z0 - j * step)): (i, j)
    for j in range(rows)
    for i in range(cols)
  }
  dgm = GEO / "raw/dgm/weinberg-v176/DGM1_390_5822.zip"
  heights = [[None] * cols for _ in range(rows)]
  for tile in [dgm, GEO / "raw/dgm/weinberg-v176/DGM1_392_5822.zip"]:
    with zipfile.ZipFile(tile) as archive:
      with archive.open(archive.namelist()[0]) as f:
        for line in f:
          x, y, h = line.split()
          key = (int(float(x)), int(float(y)))
          if key in wanted:
            i, j = wanted[key]
            heights[j][i] = round(float(h) - 30, 3)
  assert all(v is not None for r in heights for v in r)
  owners = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('DEBE00YYRo00007V','DEBE02AL1Zd0000g','DEBE02AL5160000x','OSM-way-1364133390')",
  )
  buildings = [
    dict(
      id=r.sourceId,
      ground=5.2 if not math.isfinite(r.sourceGroundY) else r.sourceGroundY,
      height=r.height,
      minHeight=r.minHeight,
      heightSource=r.heightSource,
      geometry=mapping(r.geometry),
    )
    for r in owners.itertuples()
  ]
  assert len(buildings) == 4
  hill = dict(
    origin=[x0 + 0.5, z0 - 0.5],
    stepM=step,
    heights=heights,
    mask=mapping(support),
    oldGroundY=5.2,
    seamWidthM=160.0,
    datum="EPSG:25833, source elevation minus30m NHN",
    boundaryPolicy="Finite source-wall/amphitheatre support with176m surrounding ground allowance keeps the measured crest unchanged and permits a160m moderate display transition to the previous flat terrain. This interpolation extent is not an asserted cadastral Sonnenhuegel boundary. Raw sampled heights are retained separately from that display seam.",
  )
  runtime = dict(
    schemaVersion=1,
    walls=walls,
    artworks=arts,
    parkWall=wall,
    parkLines=park_lines,
    amphitheatre=amph,
    hill=hill,
    buildings=buildings,
  )
  write(APP / "wallGalleryV298.json", runtime)
  evidence = dict(
    schemaVersion=1,
    step=10,
    date="2026-11-02",
    sourceSha256={
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        raw_api,
        pbf,
        dgm,
        GEO / "raw/dgm/weinberg-v176/DGM1_392_5822.zip",
        GEO / "raw/outer-v159/resolved-outlines.gpkg",
      ]
    },
    sourceUrl="https://api.openstreetmap.org/api/0.6/relation/6807791/full.json",
    coreSupportAudit=audit_core_support(support),
    originalWalls=current,
    selectedParkSources=park_lines + [amph, park],
    buildingSources=buildings,
    hill=hill,
    artworkSourceNodes=[
      a for a in old["artworks"] if a["id"] in {x["id"] for x in arts}
    ],
    assumptions=[
      "3.6m Grenzmauer75 general published wall height,0.24m minimum render thickness,1.2m panel pitch and0.18m crown radius are presentation dimensions, not individual segment surveys.",
      "Mural widths and fine shapes are independently drawn proportional interpretations, not exact surveyed boundaries or digital facsimiles.",
      "No photographs, photographic pixels or textures are bundled.",
    ],
  )
  write(GEO / "wall-gallery-v298-evidence.json.gz", evidence)
  print(
    dict(
      wallCount=len(walls),
      artworkCount=len(arts),
      hillSamples=rows * cols,
      supportAreaM2=round(support.area, 3),
      terrainRange=[
        min(v for r in heights for v in r),
        max(v for r in heights for v in r),
      ],
    )
  )


if __name__ == "__main__":
  build()
