"""Step 10: sparse cultivation cues inside retained mapped allotment grounds."""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

import pyogrio
from shapely import make_valid, set_precision, union_all
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "raw/outskirts-v187/candidate.gpkg"
CONTEXT = GEO / "allotments-v264-context.json.gz"
EVIDENCE = GEO / "allotments-v264-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/allotmentsV264.json"
MAX_GROUPS = 48
POLICY = (
  "Mapped allotment polygons and delivered ground only. Three planted strips "
  "and two discontinuous low hedge accents are illustrative cultivation cues, "
  "not measured beds, parcel boundaries or a cadastral allotment layout. "
  "No huts, fences, trees or paths are invented. Existing geometry is untouched. "
  "At most 48 groups per existing packet, independently checked in drawn and "
  "orthogonal native form. All live delivery and residency budgets are unchanged."
)
PATTERN = r"(?:(?:outer187|east200|north190|ring182|city183|marzahn230)-)?-?\d+_-?\d+"


def navigation_guard(nav: dict) -> int:
  """Bind the recipe to every delivered avoidance and ground polygon."""
  value = 2166136261

  def feed(text: str) -> None:
    nonlocal value
    for char in text:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF

  def numbers(values: list) -> None:
    feed(",".join(str(math.floor(float(v) * 1000 + 0.5)) for v in values) + ";")

  numbers([nav["groundY"]])
  for key in ["ground", "roads", "water", "bridges", "buildings"]:
    feed(key)
    for polygon in nav.get(key, []):
      if key == "buildings":
        feed(polygon["sourceId"])
        numbers([polygon["minHeight"], polygon["height"]])
      for ring in [polygon["ring"], *polygon["holes"]]:
        feed("[")
        for point in ring:
          numbers(point)
        feed("]")
  return value


def packet_polygons(packet: dict, key: str) -> Any:
  """Return complete existing local navigation polygons in scene coordinates."""
  ox, _, oz = packet["origin"]
  return union_all(
    [
      set_precision(
        make_valid(translate(Polygon(p["ring"], p["holes"]), ox, oz)), 0.001
      )
      for p in packet["nav"].get(key, [])
    ],
    grid_size=0.001,
  )


def footprint(x: float, z: float, dx: float, dz: float) -> Polygon:
  """Conservative full envelope, including all hedge and bed vertices."""
  return Polygon(
    [
      (x + dx * u - dz * v, z + dz * u + dx * v)
      for u, v in [(-4.2, -3.2), (4.2, -3.2), (4.2, 3.2), (-4.2, 3.2)]
    ]
  )


def context() -> dict:
  """Keep only local existing garden/path/tree evidence; never download data."""
  manifest = base.read_json(OUT / "manifest.json")
  descriptors = [d for d in manifest["chunks"] if re.fullmatch(PATTERN, d["id"])]
  tile_tree = STRtree([box(*d["bounds"]) for d in descriptors])
  frame = pyogrio.read_dataframe(
    SOURCE,
    layer="multipolygons",
    where="landuse='allotments'",
    columns=["osm_id", "osm_way_id", "name"],
  ).to_crs(25833)
  sites = []
  for row in frame.itertuples():
    geom = base.world(row.geometry).buffer(0)
    if not len(tile_tree.query(geom, predicate="intersects")):
      continue
    sites.append(
      {
        "id": ("way/" + row.osm_way_id)
        if isinstance(row.osm_way_id, str)
        else "relation/" + row.osm_id,
        "name": row.name if isinstance(row.name, str) else "Unnamed mapped allotment",
        "geometry": mapping(geom),
      }
    )
  garden_tree = STRtree([shape(s["geometry"]).buffer(15) for s in sites])
  # Read only transport columns, then retain only garden-adjacent source lines.
  lines = pyogrio.read_dataframe(
    SOURCE,
    layer="lines",
    where="highway IS NOT NULL",
    columns=["osm_id", "highway", "other_tags"],
  ).to_crs(25833)
  paths = []
  for row in lines.itertuples():
    geom = base.world(row.geometry)
    if not len(garden_tree.query(geom, predicate="intersects")):
      continue
    tags = dict(
      re.findall(
        r'"([^"]+)"=>"([^"]*)"',
        row.other_tags if isinstance(row.other_tags, str) else "",
      )
    )
    pedestrian = row.highway in {"path", "footway", "cycleway", "steps"}
    fallback = 2.5 if pedestrian else 5 if row.highway in {"track", "service"} else 12
    try:
      width = float(tags.get("width", str(fallback)).split(" ")[0])
      if not math.isfinite(width) or width <= 0:
        width = fallback
    except ValueError:
      width = fallback
    paths.append(
      {
        "id": "way/" + row.osm_id,
        "geometry": mapping(geom),
        "width": min(30, max(1.5, width)),
        "widthStatus": "OSM width" if "width" in tags else "display estimate",
      }
    )
  trees = []
  for path, layer in [
    (GEO / "official_details.gpkg", "trees"),
    (GEO / "osm.gpkg", "vegetation"),
  ]:
    data = pyogrio.read_dataframe(path, layer=layer)
    for row in data.itertuples():
      geom = base.world(row.geometry)
      if geom.geom_type != "Point" or not len(garden_tree.query(geom)):
        continue
      crown = getattr(row, "crown_diameter_m", 6)
      radius = max(2, float(crown or 6) / 2) if crown is not None else 3
      if not math.isfinite(radius):
        radius = 3
      trees.append([geom.x, geom.y, radius])
  result = {
    "schemaVersion": 1,
    "policy": POLICY,
    "source": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": base.digest(SOURCE),
    "sourceAllotmentCount": len(frame),
    "sites": sites,
    "paths": paths,
    "retainedTreeClearances": trees,
    "treeInputs": {
      str(p.relative_to(ROOT)): base.digest(p)
      for p in [GEO / "official_details.gpkg", GEO / "osm.gpkg"]
    },
  }
  base.write_json(CONTEXT, result)
  return result


def candidate_points(area: Any, spacing: int = 18) -> list[Point]:
  """Stable dispersed samples, not an asserted plot grid or fence network."""
  minx, minz, maxx, maxz = area.bounds
  result = []
  for ix in range(math.floor(minx / spacing), math.ceil(maxx / spacing) + 1):
    for iz in range(math.floor(minz / spacing), math.ceil(maxz / spacing) + 1):
      # Small deterministic stagger avoids a continuous pseudo-cadastral grid.
      x = ix * spacing + ((iz * 13 + ix * 7) % 7 - 3)
      z = iz * spacing + ((ix * 11 + iz * 3) % 7 - 3)
      p = Point(x, z)
      if area.covers(p):
        result.append(p)
  return sorted(
    result, key=lambda p: (int(p.x) * 73856093 ^ int(p.y) * 19349663) % 2147483647
  )


def build() -> dict:
  """Prepare small append-only recipes with full source/clearance receipts."""
  ctx = base.read_json(CONTEXT) if CONTEXT.exists() else context()
  sites = [shape(s["geometry"]) for s in ctx["sites"]]
  site_tree = STRtree(sites)
  paths = [shape(p["geometry"]) for p in ctx["paths"]]
  path_tree = STRtree(paths)
  trees = [
    Point(x, z).buffer(radius + 0.5) for x, z, radius in ctx["retainedTreeClearances"]
  ]
  tree_index = STRtree(trees)
  manifest = base.read_json(OUT / "manifest.json")
  output, receipts, counts, used_sites = {}, {}, Counter(), set()
  for desc in manifest["chunks"]:
    if not re.fullmatch(PATTERN, desc["id"]):
      continue
    bounds = box(*desc["bounds"])
    nearby_sites = site_tree.query(bounds, predicate="intersects")
    if not len(nearby_sites):
      continue
    near_paths = path_tree.query(bounds.buffer(40), predicate="intersects")
    path_obstacles = unary_union(
      [paths[i].buffer(ctx["paths"][i]["width"] / 2 + 1.2) for i in near_paths]
    )
    tree_obstacles = unary_union(
      [trees[i] for i in tree_index.query(bounds, predicate="intersects")]
    )
    tile_plans, tile_receipts = {}, {}
    for family in ["drawn", "minecraft"]:
      path = OUT / desc[family]["url"]
      packet = base.read_json(path)
      ground = packet_polygons(packet, "ground").intersection(bounds.buffer(-0.2))
      blockers = unary_union(
        [
          packet_polygons(packet, k).buffer(1.2)
          for k in ["roads", "water", "buildings"]
        ]
      )
      blocked = unary_union([blockers, path_obstacles, tree_obstacles])
      groups, rows, already = [], [], Polygon()
      for si in sorted(nearby_sites, key=lambda i: ctx["sites"][i]["id"]):
        allowed = sites[si].intersection(ground).buffer(-0.4).difference(blocked)
        if allowed.is_empty or allowed.area < 100:
          continue
        for p in candidate_points(allowed):
          nearest = path_tree.nearest(p)
          line = paths[nearest]
          position = line.project(p)
          a, b = (
            line.interpolate(max(0, position - 2)),
            line.interpolate(min(line.length, position + 2)),
          )
          dx, dz = b.x - a.x, b.y - a.y
          length = math.hypot(dx, dz)
          dx, dz = (dx / length, dz / length) if length > 0.01 else (1.0, 0.0)
          if family == "minecraft":
            dx, dz = (1.0, 0.0) if abs(dx) >= abs(dz) else (0.0, 1.0)
          dx, dz = round(dx, 8), round(dz, 8)
          envelope = footprint(p.x, p.y, dx, dz)
          if not allowed.covers(envelope) or envelope.distance(already) < 1:
            continue
          ox, oy, oz = packet["origin"]
          groups.append(
            [
              round(p.x - ox, 3),
              round(packet["nav"]["groundY"] - oy, 3),
              round(p.y - oz, 3),
              dx,
              dz,
              int((p.x + p.y) % 3),
            ]
          )
          rows.append(
            {"site": int(si), "path": int(nearest), "envelope": mapping(envelope)}
          )
          already = already.union(envelope)
          used_sites.add(int(si))
          if len(groups) == MAX_GROUPS:
            break
        if len(groups) == MAX_GROUPS:
          break
      if groups:
        tile_plans[family] = {
          "origin": packet["origin"],
          "guard": navigation_guard(packet["nav"]),
          "groups": groups,
        }
        tile_receipts[family] = {
          "url": desc[family]["url"],
          "sha256": base.digest(path),
          "groups": rows,
        }
        counts[family + "Groups"] += len(groups)
        counts[family + "Packets"] += 1
    if tile_plans:
      output[desc["id"]], receipts[desc["id"]] = tile_plans, tile_receipts
  result = {
    "schemaVersion": 1,
    "policy": POLICY,
    "keys": list(output),
    "chunks": output,
  }
  base.write_json(OUTPUT, result)
  summary = {
    **counts,
    "sourceAllotments": ctx["sourceAllotmentCount"],
    "candidateAllotments": len(sites),
    "representedAllotments": len(used_sites),
    "packets": len(output),
    "recipeBytes": OUTPUT.stat().st_size,
    "maxGroupsPerPacket": MAX_GROUPS,
  }
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "contextSha256": base.digest(CONTEXT),
    "summary": summary,
    "sourceSites": [{"index": i, **ctx["sites"][i]} for i in sorted(used_sites)],
    "packets": receipts,
  }
  base.write_json(EVIDENCE, evidence)
  print(summary, flush=True)
  return summary


if __name__ == "__main__":
  build()
