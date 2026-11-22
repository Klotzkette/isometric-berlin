"""Bake the two first-paint tree stands and field-measured additions in central Mitte."""

import argparse
import gzip
import hashlib
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

from shapely import LineString, Point, Polygon, STRtree, box

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SURVEY = ROOT / "geo_data/regierungsviertel/mitte-trees-v375-survey.json.gz"
CONTACTS = ROOT / "geo_data/regierungsviertel/mitte-tree-contacts-v375.json.gz"
OUTPUT = DATA / "mitteTreesV375.json"
BOUNDS = (-600, -1400, 1300, 700)
FOCUS = ((5, -50, 445, 300), (425, -1100, 575, -945))
SERVICE = "https://gdi.berlin.de/services/wfs/baumbestand"
LAYER = ("anlagenbaeume", "strassenbaeume")
CATALOGUE = ("anlagenbaum", "strassenbaum")


def read(path):
  return json.loads(path.read_bytes())


def export_survey(cache=None):
  """Retain the WFS point identity, coordinates and botanical measurements."""
  x0, z0, x1, z1 = BOUNDS
  bbox = f"{389500 + x0},{5820000 - z1},{389500 + x1},{5820000 - z0},EPSG:25833"
  rows = []
  for k, layer in enumerate(LAYER):
    if cache:
      data = read(cache / f"inner-{layer}.json")
    else:
      query = urllib.parse.urlencode(
        {
          "service": "WFS",
          "version": "2.0.0",
          "request": "GetFeature",
          "typeNames": f"baumbestand:{layer}",
          "srsName": "EPSG:25833",
          "bbox": bbox,
          "outputFormat": "application/json",
          "count": 100000,
        }
      )
      with urllib.request.urlopen(f"{SERVICE}?{query}", timeout=90) as response:
        data = json.load(response)
    if len(data["features"]) != int(data["numberMatched"]):
      raise ValueError(f"Incomplete tree inventory for {layer}")
    for feature in data["features"]:
      if feature["geometry"]["type"] != "Point":
        raise ValueError("Expected municipal point geometry")
      x, y = feature["geometry"]["coordinates"][:2]
      p = feature["properties"]
      rows.append(
        [
          k,
          p["gisid"],
          round(x - 389500, 4),
          round(5820000 - y, 4),
          p["baumhoehe"],
          p["kronedurch"],
          p["stammumfg"],
          p["art_dtsch"],
          p["art_gruppe"],
        ]
      )
  source = dict(
    url=SERVICE,
    layers=LAYER,
    bounds=BOUNDS,
    crs="EPSG:25833",
    license="dl-de/zero-2-0",
    rows=sorted(rows),
  )
  SURVEY.write_bytes(gzip.compress(encode(source), mtime=0))


def encode(value):
  return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def polygon(record, scale=1):
  def ring(points):
    return [(x * scale, z * scale) for x, z in points]

  return Polygon(ring(record["ring"]), [ring(h) for h in record.get("holes", [])])


def protected_geometry(park):
  surfaces = read(PUBLIC / "surface-polygons.json")
  geometries = [
    polygon(record, 0.1)
    for record in surfaces["roads"]
    + surfaces["water"]
    + read(PUBLIC / "lod2-prisms.json")["buildings"]
  ]
  for entry in read(DATA / "altMitteV169Navigation.json")["chunkFiles"]:
    if entry["field"] == "parts":
      geometries.extend(polygon(record) for record in read(DATA / entry["file"]))
  for p in park["paths"]:
    points = [(x, z) for x, _, z in p["points"]]
    if len(points) >= 2:
      geometries.append(LineString(points).buffer(p.get("w", 200) / 200))
  return STRtree(geometries)


def ground_y(x, z, ground):
  """The same ground-top cell used for the visible 4 m drawn ground slab."""
  grid = ground["grid"]
  hg = ground["ground_height"]
  cx = math.floor((x / ground["cell_m"] - grid["min_x_idx"]) / hg["stride_cells"])
  cz = math.floor((z / ground["cell_m"] - grid["min_z_idx"]) / hg["stride_cells"])
  if not (0 <= cx < hg["cols"] and 0 <= cz < hg["rows"]):
    raise ValueError("Tree outside the measured terrain grid")
  return hg["y_dm"][cz * hg["cols"] + cx] / 10


def build():
  park = read(PUBLIC / "park-details.json")
  vocabulary = park["tree_vocabulary"]
  # Re-intern only the names actually used in the small first-paint packet.
  words = {key: [] for key in vocabulary}
  keys = dict(s="source", c="catalogue", sp="species", g="tree_group", lt="leaf_type")

  def intern(key, word):
    if word not in words[key]:
      words[key].append(word)
    return words[key].index(word)

  ground_receipt = json.loads(gzip.decompress(CONTACTS.read_bytes()))
  first_ground = {(x, z): y for x, z, y, _ in ground_receipt["firstGround"]}
  contacts = {(x, before, z): top for x, z, before, top, _ in ground_receipt["rows"]}
  focus = [[] for _ in FOCUS]
  points = []
  for i, t in enumerate(park["trees"]):
    x, _, z = t["position"]
    points.append(Point(x, z))
    for patch, (x0, z0, x1, z1) in zip(focus, FOCUS, strict=True):
      if x0 <= x <= x1 and z0 <= z <= z1:
        row = {
          k: intern(keys[k], vocabulary[keys[k]][v]) if k in keys else v
          for k, v in t.items()
        }
        row["i"] = t.get("i", f"tree-{i}")
        ground = contacts.pop(tuple(t["position"]), None)
        if ground is not None and ground != t["position"][1]:
          row["y"] = ground
        first = first_ground.pop((x, z), None)
        if first is not None and ground is not None and ground - first >= 0.099:
          row["firstY"] = first
        patch.append(row)
  if contacts or first_ground:
    raise ValueError("A captured trunk no longer matches the source position")
  for prop in read(DATA / "mitteHeritageV166Source.json")["props"]:
    if prop["tags"].get("natural") == "tree" and prop["y"] == 3:
      points.append(Point(prop["x"], prop["z"]))
  existing = STRtree(points)
  protected = protected_geometry(park)
  ground = read(PUBLIC / "ground-context.json")
  candidates = []
  for layer, gid, x, z, height, crown, circumference, species, group in json.loads(
    gzip.decompress(SURVEY.read_bytes())
  )["rows"]:
    p = Point(x, z)
    if existing.query(p, predicate="dwithin", distance=3).size:
      continue
    if not all(n and n > 0 for n in (height, crown, circumference)):
      continue
    radius = round(circumference / (200 * math.pi), 3)
    if protected.query(p, predicate="dwithin", distance=max(0.35, radius)).size:
      continue
    candidates.append(
      (
        p,
        {
          "i": gid,
          "s": intern("source", "berlin_official"),
          "c": intern("catalogue", CATALOGUE[layer]),
          "position": [round(x, 2), ground_y(x, z, ground), round(z, 2)],
          "h": height,
          "cr": crown / 2,
          "tr": radius,
          "sp": intern("species", species),
          "g": intern("tree_group", group),
          "v": int(hashlib.sha256(gid.encode()).hexdigest()[:8], 16) % 3,
        },
      )
    )
  # Two very close unmatched municipal records can describe a replacement.
  # Preserve only independently isolated positions when their relationship is uncertain.
  new_positions = STRtree([p for p, _ in candidates])
  extra = [
    r
    for p, r in candidates
    if len(new_positions.query(p, predicate="dwithin", distance=3)) == 1
  ]
  # The native city draws a square 1.8 m trunk at the centre of each 4 m cell.
  # Reject quantization onto buildings/paths, or a cell with an existing native tree.
  native = read(PUBLIC / "minecraft-voxels.json")
  grid = native["grid"]
  occupied = {
    (grid["min_x_idx"] + offset, grid["min_z_idx"] + row)
    for row, entries in enumerate(native["tree_rows"])
    for offset, _, _ in entries
  }
  blocks = {}
  for tree in extra:
    x, _, z = tree["position"]
    cx, cz = math.floor(x / 4), math.floor(z / 4)
    bx, bz = cx * 4 + 2, cz * 4 + 2
    if (cx, cz) in occupied or protected.query(
      box(bx - 0.9, bz - 0.9, bx + 0.9, bz + 0.9), predicate="intersects"
    ).size:
      continue
    occupied.add((cx, cz))
    blocks[tree["i"]] = [
      cx,
      cz,
      round(ground_y(bx, bz, ground) * 10),
      40 * math.ceil(tree["h"] / 4),
    ]
  return dict(vocabulary=words, focus=focus, additions=extra, nativeBlocks=blocks)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", action="store_true")
  parser.add_argument("--cache", type=Path, help="previously downloaded WFS responses")
  args = parser.parse_args()
  if args.capture:
    export_survey(args.cache)
  packet = build()
  OUTPUT.write_bytes(encode(packet) + b"\n")
  print([len(t) for t in packet["focus"]], len(packet["additions"]))
