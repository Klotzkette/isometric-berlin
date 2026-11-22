"""Resolve double OSM park surfaces and four-metre grass tops inside surveyed Tiergarten woodland."""

import argparse
import gzip
import json
from pathlib import Path

import numpy as np
import shapely as sh
from build_exterior_street_margins_v373 import MESH, dm_polygon, polygon_only, world
from build_gate_forecourts_v374 import encode, faces, merged
from shapely.geometry import Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "simson-woods-v375-source.json.gz"
WOOD_IDS = {"1189808042", "1189808041", "1189808040", "1189808043", "1653527"}


def write_packet(path, obj):
  path.write_bytes(
    gzip.compress(json.dumps(obj, separators=(",", ":")).encode(), mtime=0)
  )


def capture(folder, baseline):
  import pyogrio

  parks = pyogrio.read_dataframe(
    GEO / "osm.gpkg", layer="parks", bbox=(389600, 5819670, 389895, 5819900)
  )
  wooded = sorted(
    [row.id, row.geometry.wkb_hex]
    for _, row in parks.iterrows()
    if row.id in WOOD_IDS and row.natural == "wood"
  )
  assert {i for i, _ in wooded} == WOOD_IDS
  bbox = merged([world(sh.from_wkb(wkb)) for _, wkb in wooded]).envelope.buffer(2)
  captures = json.loads(baseline.read_bytes())
  rows = [r for r in captures["rows"] if bbox.intersects(box(*r[:4]))]
  triangles = []
  for group, name, id_, indices, xyz in captures["tris"]:
    if not (group.startswith("parks-") or group == "rasterComplement"):
      continue
    if group.startswith("parks-") and name != "smooth parkland lawns":
      continue
    if bbox.intersects(Polygon(np.array(xyz).reshape(3, 3)[:, [0, 2]])):
      triangles.append([group, name, id_, indices, xyz])
  extra = []
  underground = []
  urls = {}
  for layer in ("cl_gehweg", "cm_fahrbahn", "bauwerkeflaechen", "bn_baumscheibe"):
    f = json.loads((folder / (layer + ".json")).read_bytes())
    assert len(f["features"]) == f["numberMatched"]
    urls[layer] = (folder / (layer + ".url")).read_text()
    for feat in f["features"]:
      geom = shape(feat["geometry"])
      if bbox.intersects(world(geom)):
        props = feat["properties"]
        if (
          layer == "bauwerkeflaechen"
          and props["bezeich"] == "AX_BauwerkImVerkehrsbereich"
          and props.get("bwf") == "1870"
        ):
          underground.append(
            [feat["id"], props["bwf"], props.get("bezbwf"), geom.wkb_hex]
          )
        else:
          extra.append([feat["id"], geom.wkb_hex])
  write_packet(
    SOURCE,
    {
      "wood": wooded,
      "source": "geo_data/regierungsviertel/osm.gpkg; parks, natural=wood",
      "queries": urls,
      "protected": extra,
      "underground": underground,
      "rows": rows,
      "tris": triangles,
    },
  )


def load():
  return json.loads(gzip.decompress(SOURCE.read_bytes()))


def faces_cover(data):
  import base64

  def words(key):
    return np.frombuffer(gzip.decompress(base64.b64decode(data[key])), "<u2")

  v = words("vertices").reshape(-1, 3)
  ids = words("indices").reshape(-1, 3)
  return merged(sh.polygons(v[:, :2][ids] / 100))


def wood_cover(wood, primary, path, gate):
  cad = next(
    world(sh.from_wkb(w))
    for i, _, w in primary["features"]
    if i.startswith("tatsaechlichenutzungflaechen.")
  )
  woodland = merged([world(sh.from_wkb(w)) for _, w in wood["wood"]]).intersection(cad)
  protected = [world(sh.from_wkb(w)) for i, w in wood["protected"]]
  protected.extend(
    world(sh.from_wkb(w))
    for i, _, w in primary["osm"]
    if i in ("8329726", "8329727", "591200197")
  )
  protected.extend([path, gate])
  # Some small paths through the woodland never had a material polygon in
  # the cadastral survey. Preserve all physically retained canonical OSM
  # road and water rings (with holes) as well as all local building prisms.
  mapped = json.loads((MESH / "surface-polygons.json").read_bytes())
  for feature in mapped["roads"] + mapped["water"]:
    ring = feature.get("ring", [])
    if not ring:
      continue
    pts = np.asarray(ring) / 10
    if not sh.intersects(woodland.envelope, box(*pts.min(axis=0), *pts.max(axis=0))):
      continue
    protected.append(
      sh.make_valid(
        Polygon(pts, [np.asarray(h) / 10 for h in feature.get("holes", [])])
      )
    )
  for b in json.loads((MESH / "lod2-prisms.json").read_bytes())["buildings"]:
    r = b["ring"]
    if (
      r
      and max(x for x, z in r) > 1100
      and min(x for x, z in r) < 3770
      and max(z for x, z in r) > 1390
      and min(z for x, z in r) < 3070
    ):
      protected.append(dm_polygon(b))
  return polygon_only(woodland.difference(merged(protected), grid_size=0.01))


def make_wood_mesh(cover):
  vertices = []
  lookup = {}
  indices = []
  for x in range(104, 384, 8):
    for z in range(136, 312, 8):
      cell = box(x, z, x + 8, z + 8)
      if not cover.intersects(cell):
        continue
      for t in faces(cover.intersection(cell, grid_size=0.01)):
        for xx, zz in t:
          key = (xx, zz)
          if key not in lookup:
            lookup[key] = len(vertices)
            vertices.append([xx, zz, 0])
          indices.append(lookup[key])
  assert len(vertices) < 65535
  return {
    "vertices": encode(vertices, "<u2"),
    "indices": encode(indices, "<u2"),
    "area": round(cover.area, 2),
  }


def raster_remainders(wood, cover):
  ground = json.loads((MESH / "ground-context.json").read_bytes())
  grid = ground["grid"]
  grass = ground["classes"].index("grass")
  hosts = []
  left = []
  for row in wood["rows"]:
    x, z, X, Z, top, depth = row
    if depth != 3 or Z - z != 4 or (X - x) % 4 or x % 4 or z % 4:
      continue
    cell = box(x, z, X, Z)
    if cell.intersection(cover).area < 0.005:
      continue
    source = ground["ground_rows"][int(z / 4 - grid["min_z_idx"])]
    col1 = x / 4 - grid["min_x_idx"]
    col2 = X / 4 - grid["min_x_idx"]
    if not any(
      k == grass and c <= col1 and col2 <= c + width for c, width, k in source
    ):
      continue
    remains = list(faces(cell.difference(cover)))
    hosts.extend([*row, len(remains)])
    left.extend(q for t in remains for v in t for q in v)
  return {"hosts": encode(hosts, "<f4"), "fragments": encode(left, "<i4")}


def retained_lawns(cover):
  """Read the exact earlier GIS-trimmed park faces that the progressive worker installs."""
  import base64

  def unpack(text, dtype):
    lanes = np.frombuffer(gzip.decompress(base64.b64decode(text)), np.uint8).reshape(
      np.dtype(dtype).itemsize, -1
    )
    return np.bitwise_xor.accumulate(lanes, axis=1).T.copy().view(dtype).ravel()

  rows = []
  removed = {}
  for n, packet in enumerate(
    json.loads((DATA / "mittePathLawnV375.json").read_bytes()), 1
  ):
    group = f"parks-{n}"
    removed[group] = set(map(int, unpack(packet["faces"], "<u4")))
    # Positions have 12 byte lanes per complete XYZ vertex (not 4).
    lanes = np.frombuffer(
      gzip.decompress(base64.b64decode(packet["positions"])), np.uint8
    ).reshape(12, -1)
    xyz = np.bitwise_xor.accumulate(lanes, axis=1).T.copy().view("<f4").reshape(-1, 3)
    idx = unpack(packet["remainder"], "<u4" if packet["wide"] else "<u2").reshape(-1, 3)
    polys = sh.polygons(xyz[idx][:, :, [0, 2]])
    for i in np.flatnonzero(sh.intersects(polys, cover)):
      rows.append(
        [
          group,
          "Retained park lawn beside mapped paths in Mitte v375",
          int(i),
          idx[i].tolist(),
          xyz[idx[i]].ravel().tolist(),
        ]
      )
  return rows, removed


def bake():
  from build_simson_paths_v375 import ARCHIVE, gate_ownership

  src = json.loads(gzip.decompress(ARCHIVE.read_bytes()))
  wood = load()
  path = faces_cover(json.loads((DATA / "simsonPathsV375.json").read_bytes()))
  cover = wood_cover(wood, src, path, gate_ownership())
  return {
    "simsonWoodsV375.json": make_wood_mesh(cover),
    "simsonWoodRasterV375.json": raster_remainders(wood, cover),
  }


if __name__ == "__main__":
  ap = argparse.ArgumentParser(description=__doc__)
  ap.add_argument("--capture", type=Path)
  ap.add_argument("--baseline", type=Path)
  ap.add_argument("--check", action="store_true")
  args = ap.parse_args()
  if args.capture:
    capture(args.capture, args.baseline)
  for name, data in bake().items():
    text = json.dumps(data, separators=(",", ":")) + "\n"
    if args.check:
      assert (DATA / name).read_text() == text
    else:
      (DATA / name).write_text(text)
    print(name, len(text), data.get("area"))
