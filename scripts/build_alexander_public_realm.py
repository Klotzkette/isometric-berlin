"""Step 10: retain mapped Forum sculpture anchors and only missing tree points."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]


def build_source(root: Path = ROOT) -> dict:
  """Use exact OSM points; never infer tree rows or replace existing vegetation."""
  path = root / "geo_data/regierungsviertel/raw/east_v148/east.osm"
  tree_path = root / "src/app/public/mesh/regierungsviertel/park-details.json"
  document = ET.parse(path).getroot()
  nodes = {e.attrib["id"]: e for e in document.findall("node")}
  ways = {e.attrib["id"]: e for e in document.findall("way")}
  transform = Transformer.from_crs(4326, 25833, always_xy=True)

  def point(node: ET.Element) -> tuple[float, float]:
    x, north = transform.transform(float(node.attrib["lon"]), float(node.attrib["lat"]))
    return x - 389500, 5820000 - north

  def polygon(key: str) -> Polygon:
    return Polygon([point(nodes[n.attrib["ref"]]) for n in ways[key].findall("nd")])

  def sheet(key: str) -> dict:
    p = polygon(key)
    return {
      "osm_key": "way/" + key,
      "center_xz": [round(p.centroid.x, 6), round(p.centroid.y, 6)],
      "outline_xz": [[round(x, 6), round(z, 6)] for x, z in p.exterior.coords],
      "area_m2": p.area,
    }

  forum = polygon("16872940")
  existing = json.loads(tree_path.read_text())["trees"]
  old_points = [e["position"] for e in existing]
  trees, duplicates = [], []
  for key, node in nodes.items():
    tags = {t.attrib["k"]: t.attrib["v"] for t in node.findall("tag")}
    p = point(node)
    if tags.get("natural") != "tree" or not forum.covers(Point(*p)):
      continue
    distance = min(((p[0] - v[0]) ** 2 + (p[1] - v[2]) ** 2) ** 0.5 for v in old_points)
    if distance <= 2:
      duplicates.append("node/" + key)
      continue
    trees.append(
      {
        "osm_key": "node/" + key,
        "position": [round(p[0], 6), 5.245, round(p[1], 6)],
        "height_m": float(tags.get("height", 10)),
        "crown_radius_m": 3.4,
        "nearest_existing_m": round(distance, 6),
        "leaf_type": tags.get("leaf_type", "broadleaved"),
        "dimensions_status": "height/crown are display estimates unless OSM height is present",
        "height_measured": "height" in tags,
      }
    )
  native_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  native = json.loads(native_path.read_text())
  grid, cell = native["grid"], native["cell_m"]
  native_points = [
    ((grid["min_x_idx"] + x + 0.5) * cell, (grid["min_z_idx"] + z + 0.5) * cell)
    for z, row in enumerate(native["tree_rows"])
    for x, _, _ in row
  ]
  for tree in trees:
    x, _, z = tree["position"]
    tree["nearest_native_tree_m"] = round(
      min(((x - a) ** 2 + (z - b) ** 2) ** 0.5 for a, b in native_points), 6
    )
    if tree["nearest_native_tree_m"] < 3:
      raise ValueError("New mapped tree overlaps a retained Minecraft tree cell")
  secondary = []
  for key in [
    "8324218492",
    "9994971966",
    "9994971967",
    "9994971968",
    "8324218495",
    "9994971965",
  ]:
    n = nodes[key]
    p = point(n)
    secondary.append(
      {
        "osm_key": "node/" + key,
        "center_xz": [round(v, 6) for v in p],
        "kind": "double-stele"
        if key in ["8324218492", "9994971966", "9994971967", "9994971968"]
        else "bronze-relief",
      }
    )
  return {
    "schema_version": 1,
    "license": "ODbL-1.0",
    "source_url": "https://api.openstreetmap.org/api/0.6/map?bbox=13.396,52.5135,13.4155,52.5240",
    "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "existing_tree_sha256": hashlib.sha256(tree_path.read_bytes()).hexdigest(),
    "native_tree_sha256": hashlib.sha256(native_path.read_bytes()).hexdigest(),
    "ground_y_m": 5.245,
    "ground_status": "retained local park-details terrain level; not a new terrain survey",
    "forum": sheet("16872940"),
    "ensemble": sheet("895523112"),
    "marx_engels": sheet("895523111"),
    "alte_welt": sheet("895523113"),
    "neptun": sheet("23813204"),
    "secondary": secondary,
    "added_trees": trees,
    "retained_existing_tree_count_in_forum": sum(
      forum.covers(Point(p[0], p[2])) for p in old_points
    ),
    "deduplicated_osm_trees": duplicates,
    "tree_merge_radius_m": 2,
    "current_layout_note": "Original monument layout restored August 2022. Grün Berlin reports ongoing 2025–2028 reconstruction. Only mapped current objects are added; future paths, ramps and trees are not invented.",
  }


if __name__ == "__main__":
  data = build_source()
  output = ROOT / "src/app/src/alexanderPublicRealmSource.json"
  output.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    f"{len(data['added_trees'])} added OSM trees; {len(data['deduplicated_osm_trees'])} existing points retained"
  )
