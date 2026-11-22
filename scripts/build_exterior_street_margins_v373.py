"""Fit surveyed exterior street edges into otherwise unsupported raster cutouts.

An asphalt-labelled voxel is omitted in the Drawn scene. Keep only its part
outside every original vector road whose ground finish is also positively
identified in the Berlin 2014/15 street survey. All clipping is offline.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
GEO = ROOT / "geo_data/regierungsviertel"
SURVEY = GEO / "exterior-street-margins-v373-survey.json.gz"
OUTPUT = DATA / "exteriorStreetMarginsV373.json"
DISTRICTS = GEO / "house-districts-v233.geojson"
STYLES = ["lawn", "pavers", "asphalt", "setts", "mosaic", "slabs", "gravel"]
# Published material dictionary, as used in the Invaliden street mosaic.
LEGEND = {
  "01": "pavers",
  "02": "asphalt",
  "03": "setts",
  "04": "mosaic",
  "05": "setts",
  "06": "pavers",
  "07": "pavers",
  "08": "slabs",
  "13": "gravel",
  "14": "gravel",
  "15": "lawn",
}


def read(path):
  return json.loads(path.read_bytes())


def world(geometry):
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def polygon_parts(geometry):
  if geometry.geom_type == "Polygon":
    if not geometry.is_empty:
      yield geometry
  elif geometry.geom_type in {"GeometryCollection", "MultiPolygon"}:
    for item in geometry.geoms:
      yield from polygon_parts(item)


def polygon_only(geometry):
  if geometry.geom_type in {"Polygon", "MultiPolygon"}:
    return geometry
  return shapely.union_all(list(polygon_parts(geometry)))


def dm_polygon(record):
  return Polygon(
    np.asarray(record["ring"]) / 10,
    [np.asarray(h) / 10 for h in record.get("holes", [])],
  )


def exterior_cutouts():
  ground = read(MESH / "ground-context.json")
  payload = read(MESH / "surface-polygons.json")
  core = read(DATA / "surroundingCityScope.json")["core"]
  core = Polygon(core["ring"], core["holes"])
  districts = {}
  for f in read(DISTRICTS)["features"]:
    if f["properties"]["sch"][6:8] == "01":
      continue
    zone = world(shape(f["geometry"])).intersection(core)
    if zone.area > 0:
      districts[f["properties"]["nam"]] = zone
  scope = shapely.union_all(list(districts.values()))
  grid = ground["grid"]
  cell = ground["cell_m"]
  asphalt = ground["classes"].index("asphalt")
  runs = [
    [
      cell * (grid["min_x_idx"] + c),
      cell * (grid["min_z_idx"] + r),
      cell * (grid["min_x_idx"] + c + n),
      cell * (grid["min_z_idx"] + r + 1),
    ]
    for r, row in enumerate(ground["ground_rows"])
    for c, n, k in row
    if k == asphalt
  ]
  rectangles = shapely.box(*np.asarray(runs).T)
  raster = shapely.coverage_union_all(
    rectangles[shapely.intersects(rectangles, scope)]
  ).intersection(scope)
  roads = shapely.make_valid([dm_polygon(f) for f in payload["roads"]])
  vector = shapely.union_all(roads[shapely.intersects(roads, scope)])
  return raster.difference(vector), districts, payload


def capture(cache, cutouts):
  """Retain complete polygon coordinates, stable feature IDs and original material."""
  queries, features = [], {}
  raw = list(polygon_parts(cutouts))
  tree = shapely.STRtree(raw)
  for path in sorted(cache.glob("*.json.gz")):
    batch = json.loads(gzip.decompress(path.read_bytes()))
    queries.extend(batch["requests"])
    for f in batch["features"]:
      fid = f["id"]
      if fid in features:
        continue
      layer = fid.split(".")[0]
      material = str(f["properties"].get("material"))
      if layer != "ce_gruenflaeche" and material not in LEGEND:
        continue
      g = shape(f["geometry"])
      if len(tree.query(world(g), predicate="intersects")):
        features[fid] = [fid, material, shapely.to_wkb(g, hex=True)]
  archive = {
    "source": "Geoportal Berlin / Straßenbefahrung 2014/15",
    "crs": "EPSG:25833",
    "queries": queries,
    "features": [features[k] for k in sorted(features)],
  }
  SURVEY.write_bytes(
    gzip.compress(json.dumps(archive, separators=(",", ":")).encode(), mtime=0)
  )


def protections(payload):
  # Even where newer ground geometry diverges slightly from the old street
  # survey, keep all source buildings, open water, railway and park owners.
  records = [
    *payload["parks"],
    *payload["water"],
    *payload["sunken_walls"],
    *read(MESH / "lod2-prisms.json")["buildings"],
  ]
  rail = read(MESH / "rail-lines.json")
  records.extend([*rail["viaduct"], *rail["embankment"]])
  polys = [dm_polygon(rec) for rec in records if len(rec.get("ring", [])) >= 3]
  # Include surveyed plaza owners independently of whether the optional later
  # layer is currently present. Stair voids must also remain open before load.
  for name in ("innerCitySquareStreetsV368.json", "mitteSquareStreetsV367.json"):
    for part in read(DATA / name)["groups"]:
      dtype = "<i2" if "origin" in part else "<i4"
      xz = np.frombuffer(base64.b64decode(part["xz"]), dtype).reshape(-1, 2)
      xz = (xz + np.asarray(part.get("origin", [0, 0]))) / 100
      inds = np.frombuffer(base64.b64decode(part["index"]), "<u2").reshape(-1, 3)
      polys.extend(shapely.polygons(xz[inds]))
  for num in (261, 281):
    for stair in read(DATA / f"ubahnEntrancesV{num}.json")["stairs"]:
      polys.append(
        LineString([stair["top"], stair["bottom"]]).buffer(
          stair["width"] / 2 + 0.05, cap_style="square"
        )
      )
  for f in read(DATA / "ubahnAccessV326.json")["entries"]:
    if f["stair"]:
      polys.append(Polygon(f["stair"]["ring"]).buffer(0.05))
  return shapely.make_valid(polys)


def pack_words(words, dtype):
  data = np.asarray(words, dtype=dtype).tobytes()
  return base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode()


def build(*, cache=None):
  cutouts, districts, payload = exterior_cutouts()
  if cache:
    capture(cache, cutouts)
  raw = list(polygon_parts(cutouts))
  protected = protections(payload)
  tree = shapely.STRtree(protected)
  eligible = []
  for gap in raw:
    hits = tree.query(gap, predicate="intersects")
    if len(hits):
      # Keep clear of the protected owner even after centimetre encoding.
      gap = gap.difference(shapely.union_all(protected[hits]).buffer(0.012))
    eligible.extend(polygon_parts(gap))
  possible = shapely.STRtree(eligible)
  per_gap = defaultdict(lambda: defaultdict(list))
  features = json.loads(gzip.decompress(SURVEY.read_bytes()))["features"]
  for fid, material, wkb in features:
    layer = fid.split(".")[0]
    style = "lawn" if layer == "ce_gruenflaeche" else LEGEND[material]
    priority = {"ce_gruenflaeche": 0, "cl_gehweg": 1, "cm_fahrbahn": 2}[layer]
    g = shapely.make_valid(world(shapely.from_wkb(wkb)))
    for i in possible.query(g, predicate="intersects"):
      part = eligible[i].intersection(g)
      if part.area > 0:
        per_gap[int(i)][(priority, STYLES.index(style))].extend(polygon_parts(part))
  chunks = defaultdict(list)
  district_area = Counter()
  material_area = Counter()
  for i, candidates in sorted(per_gap.items()):
    remaining = polygon_only(shapely.set_precision(eligible[i], 0.01))
    for (_, style), geometry in sorted(candidates.items()):
      part = shapely.intersection(
        remaining,
        polygon_only(shapely.union_all(geometry, grid_size=0.01)),
        grid_size=0.01,
      )
      part = polygon_only(part)
      if part.area < 0.0001:
        continue
      remaining = polygon_only(shapely.difference(remaining, part, grid_size=0.01))
      for polygon in polygon_parts(part):
        for tri in shapely.constrained_delaunay_triangles(polygon).geoms:
          pts = np.rint(np.array(tri.exterior.coords)[:3] * 100).astype(int)
          a, b, c = pts.tolist()
          cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
          if not cross:
            continue
          if cross > 0:
            pts = pts[::-1]
          tile = tuple(np.floor_divide(pts.min(axis=0), 51200))
          chunks[tile].append((style, pts.tolist()))
          material_area[STYLES[style]] += abs(cross) / 20000
      for name, district in districts.items():
        if part.intersects(district):
          district_area[name] += part.intersection(district).area
  output, nvert, ni = [], 0, 0
  for (ix, iz), tris in sorted(chunks.items()):
    ox, oz = 51200 * int(ix), 51200 * int(iz)
    known, values, indices, styles = {}, [], [], []
    for style, triangle in tris:
      for x, z in triangle:
        key = (x, z, style)
        if key not in known:
          known[key] = len(styles)
          values.extend([x - ox, z - oz])
          styles.append(style)
        indices.append(known[key])
    assert 0 <= min(values) <= max(values) <= 65535 and len(styles) < 65536
    output.append(
      {
        "origin": [ox, oz],
        "vertices": len(styles),
        "indices": len(indices),
        "xz": pack_words(values, "<u2"),
        "style": pack_words(styles, "u1"),
        "index": pack_words(indices, "<u2"),
      }
    )
    nvert += len(styles)
    ni += len(indices)
  inputs = [
    DISTRICTS,
    MESH / "ground-context.json",
    MESH / "surface-polygons.json",
    MESH / "lod2-prisms.json",
    MESH / "rail-lines.json",
    SURVEY,
    *(
      DATA / n
      for n in [
        "surroundingCityScope.json",
        "ubahnAccessV326.json",
        "ubahnEntrancesV261.json",
        "ubahnEntrancesV281.json",
        "innerCitySquareStreetsV368.json",
        "mitteSquareStreetsV367.json",
      ]
    ),
  ]
  ground = read(MESH / "ground-context.json")
  guard = 2166136261
  for row in ground["ground_rows"]:
    guard = ((guard ^ len(row)) * 16777619) & 0xFFFFFFFF
    for run in row:
      for n in run:
        guard = ((guard ^ n) * 16777619) & 0xFFFFFFFF
  return {
    "groundRowsGuard": guard,
    "sources": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
    "styles": STYLES,
    "materialM2": {n: round(a, 2) for n, a in sorted(material_area.items())},
    "districtM2": {n: round(a, 2) for n, a in sorted(district_area.items())},
    "candidateM2": round(cutouts.area, 2),
    "surveyFeatures": len(features),
    "vertexCount": nvert,
    "indexCount": ni,
    "chunks": output,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--capture", type=Path, help="Archive completed WFS GeoJSON query batches"
  )
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  result = build(cache=args.capture)
  text = json.dumps(result, separators=(",", ":")) + "\n"
  if args.check:
    assert OUTPUT.read_text() == text
  else:
    OUTPUT.write_text(text)
  print({k: v for k, v in result.items() if k not in {"sources", "chunks"}})
