"""Step 10: complete measured roof replacements for ordinary existing houses.

The immutable source packets remain untouched. A small packet-specific receipt
atomically replaces only reconstructed flat envelopes by complete LoD2 sheets.
"""

from __future__ import annotations

import argparse
import base64
import copy
import functools
import hashlib
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_alt_mitte_appearance_v213 import ROOF_MATERIAL, colour
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_district_facades_v188 import digest, read_json, world, write_json
from build_surrounding_outlines import PackedMesh, native_polygon

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "roof-house-v233-source.json.gz"
EVIDENCE = GEO / "roof-house-v233-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/roofHouseV233.json"
BOUNDARY = GEO / "house-districts-v233.geojson"
MAX_PER_REGION = 32
EXTENSION_REGION = "Steglitz-Zehlendorf"
POLICY = (
  "Existing unnamed ordinary owners only; exact original packet assets retained. "
  "Every transferred flat envelope has a complete official LoD2 leaf-sheet "
  "replacement in the same packet transaction, including all holes and roofs. "
  "Gutter widths and neutral material hues are explicit display estimates. "
  "No invented pitch, dormer, source coverage, runtime budget or mobile reduction."
)


def fingerprint(parts: list[str]) -> int:
  """Match the bounded existing runtime FNV-1a encoded-identity contract."""
  value = 2166136261
  for text in parts:
    for c in text:
      value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def regions() -> dict[str, Any]:
  """The shared official district selector never creates new source coverage."""
  result = {}
  for feature in read_json(BOUNDARY)["features"]:
    props = feature["properties"]
    code = str(props["sch"])
    name = (
      "Mitte"
      if code.startswith("11000001")
      else "Friedrichshain-Kreuzberg"
      if code.startswith("11000002")
      else "Charlottenburg-Wilmersdorf"
      if code.startswith("11000004")
      else EXTENSION_REGION
      if code.startswith("11000006")
      else "Schöneberg"
    )
    result.setdefault(name, []).append(world(shape(feature["geometry"])))
  return {name: unary_union(parts) for name, parts in result.items()}


def protected_ids() -> set[str]:
  """Prior authored shells, specific uses and older fitted facades always win."""
  result = set(read_json(GEO / "outer-facades-v230-context.json.gz")["authoredIds"])
  for pattern in (
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
  ):
    for path in ROOT.glob(pattern):
      if path.name != "buildingAttributeSource.json" and "V233" not in path.name:
        result.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  for name in ("district-facades-v188", "kiez-facades-v209", "outer-facades-v230"):
    result.update(
      f["owner"] for f in read_json(GEO / f"{name}-evidence.json.gz")["faces"]
    )
  return result


def candidate_owners(only_region: str | None = None) -> tuple[list[dict], dict]:
  """Select complete existing ordinary envelopes; never a tile-cut roof piece."""
  selected_regions = regions()
  if only_region:
    selected_regions = {only_region: selected_regions[only_region]}
  context = read_json(GEO / "outer-facades-v230-context.json.gz")
  protected = STRtree([shape(p) for p in context["protected"]])
  roads = [shape(p["geometry"]) for p in context["roads"]]
  road_tree = STRtree(roads)
  protected_owners = protected_ids()
  manifest = read_json(OUT / "manifest.json")
  candidates = []
  occurrences: dict[str, set] = defaultdict(set)
  packets = {}
  for descriptor in manifest["chunks"]:
    if descriptor.get("detailCompanionOf") or not descriptor.get("buildingCount"):
      continue
    if not any(
      g.intersects(box(*descriptor["bounds"])) for g in selected_regions.values()
    ):
      continue
    packet = read_json(OUT / descriptor["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for building in packet["nav"]["buildings"]:
      occurrences[building["sourceId"]].add(descriptor["id"])
    if not any(p["kind"] == "city" for p in packet["meshes"]):
      continue
    packets[descriptor["id"]] = descriptor
    for building in packet["nav"]["buildings"]:
      owner = building["sourceId"]
      if not owner.startswith("DEBE") or owner in protected_owners:
        continue
      polygon = translate(Polygon(building["ring"], building["holes"]), ox, oz)
      if not polygon.is_valid or not 65 < polygon.area < 1800:
        continue
      if not box(*descriptor["bounds"]).buffer(-2.1).covers(polygon):
        continue
      if protected.query(polygon.buffer(-0.12), predicate="intersects").size:
        continue
      region = next((n for n, g in selected_regions.items() if g.covers(polygon)), None)
      if region is None or not 5 < building["height"] < 35 or building["minHeight"]:
        continue
      if road_tree.nearest(polygon) is None:
        continue
      distance = polygon.distance(roads[int(road_tree.nearest(polygon))])
      if not 1 < distance < 35:
        continue
      candidates.append(
        dict(
          owner=owner,
          tile=descriptor["id"],
          region=region,
          original=building,
          origin=packet["origin"],
          groundY=packet["nav"]["groundY"],
          center=list(polygon.centroid.coords[0]),
        )
      )
  candidates = [r for r in candidates if len(occurrences[r["owner"]]) == 1]
  return candidates, packets


def decode(part: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  """Retain exact source integer positions, colours and original index order."""
  return (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3),
    np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3),
  )


def triangle_keys(part: dict) -> list[tuple]:
  """A triangle key includes every position and colour, independent of winding."""
  positions, colors, indices = decode(part)
  vertices = np.column_stack((positions, colors))
  return [tuple(sorted(tuple(map(int, vertices[i])) for i in tri)) for tri in indices]


def old_envelope(packet: dict, owner: str) -> dict | None:
  """Reconstruct only this exact already-rendered owner, including native cells."""
  ox, _, oz = packet["origin"]
  mesh = PackedMesh(ox, oz)
  for building in packet["nav"]["buildings"]:
    if building["sourceId"] != owner:
      continue
    polygon = translate(Polygon(building["ring"], building["holes"]), ox, oz)
    low = (
      packet["nav"]["groundY"] + building["minHeight"] + building.get("groundOffset", 0)
    )
    high = (
      packet["nav"]["groundY"] + building["height"] + building.get("groundOffset", 0)
    )
    mesh.building(
      polygon, low, high, shapely.orient_polygons(polygon, exterior_cw=True).boundary
    )
  return mesh.payload("city")


def match_owner(packet: dict, owner: str) -> dict[int, list[int]] | None:
  """Exact multiset matching protects neighbours with duplicate party-wall faces."""
  envelope = old_envelope(packet, owner)
  if envelope is None:
    return None
  needed = Counter(triangle_keys(envelope))
  found: dict[int, list[int]] = defaultdict(list)
  for index, part in enumerate(packet["meshes"]):
    if part["kind"] != "city":
      continue
    for tri, key in enumerate(triangle_keys(part)):
      if needed[key]:
        needed[key] -= 1
        found[index].append(tri)
  return dict(found) if not any(needed.values()) else None


def canonical_digest(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def extract(append_steglitz_zehlendorf: bool = False) -> dict:
  """Read only existing local official archives; retain selected complete sheets."""
  previous = read_json(SOURCE) if append_steglitz_zehlendorf else None
  if previous and any(o["region"] == EXTENSION_REGION for o in previous["owners"]):
    raise ValueError("Extension already retained; use ordinary replay")
  candidates, descriptors = candidate_owners(
    EXTENSION_REGION if append_steglitz_zehlendorf else None
  )
  if previous:
    # Preserve every released recipe byte-for-byte, including shared tile guards.
    old_tiles = {o["tile"] for o in previous["owners"]}
    candidates = [r for r in candidates if r["tile"] not in old_tiles]
  print("candidates", Counter(r["region"] for r in candidates), flush=True)
  by_owner = {r["owner"]: r for r in candidates}
  archives = {p.name: p for p in (GEO / "raw").rglob("LoD2_*.zip")}
  tile_candidates: dict[str, dict] = defaultdict(dict)
  for row in candidates:
    x, z = row["center"]
    name = (
      f"LoD2_{math.floor((x + 389500) / 1000)}_{math.floor((5820000 - z) / 1000)}.zip"
    )
    tile_candidates[name][row["owner"]] = row
  accepted = []
  archive_receipts = {}
  cached_packets = {}
  for name, wanted in sorted(tile_candidates.items()):
    if name not in archives:
      continue
    path = archives[name]
    with zipfile.ZipFile(path) as zipped:
      for member in zipped.namelist():
        if not member.lower().endswith((".gml", ".xml", ".citygml")):
          continue
        with zipped.open(member) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            owner = parent.get(GML_ID)
            if owner in wanted:
              row = by_owner[owner]
              try:
                parts = [
                  part_profile(p) for p in leaf_building_parts(parent) or [parent]
                ]
                roofs = [
                  s for p in parts for s in p["surfaces"] if s["kind"] == "RoofSurface"
                ]
                roof_heights = [
                  v[1] for s in roofs for ring in s["rings"] for v in ring
                ]
                footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
                ox, _, oz = row["origin"]
                old = translate(
                  Polygon(row["original"]["ring"], row["original"]["holes"]), ox, oz
                )
                low = min(p["ground_y_m"] for p in parts)
                high = max(p["top_y_m"] for p in parts)
                eaves = min(roof_heights)
                valid = (
                  1.2 < max(roof_heights) - eaves < 12
                  and len(parts) <= 8
                  and sum(len(p["surfaces"]) for p in parts) <= 100
                  and footprint.symmetric_difference(old).area
                  < max(0.20, old.area * 0.001)
                  and abs(high - low - row["original"]["height"]) < 0.12
                )
                if valid:
                  matches = {}
                  for mode in ("drawn", "minecraft"):
                    descriptor = descriptors[row["tile"]]
                    url = descriptor[mode]["url"]
                    if url not in cached_packets:
                      cached_packets[url] = read_json(OUT / url)
                    packet = cached_packets[url]
                    match = match_owner(packet, owner)
                    if match is None:
                      valid = False
                      break
                    matches[mode] = match
                  if valid:
                    accepted.append(
                      dict(
                        row,
                        parts=parts,
                        sourceTile=name,
                        sourceGroundY=low,
                        sourceRoofLowY=eaves,
                        sourceTopY=high,
                        matches=matches,
                      )
                    )
              except (ValueError, KeyError, shapely.errors.GEOSException):
                pass
            parent.clear()
    print(name, "eligible", len(accepted), flush=True)
    archive_receipts[name] = dict(
      url=f"https://gdi.berlin.de/data/a_lod2/atom/{name}", sha256=digest(path)
    )
  # Farthest-point selection covers a district rather than clustering at one ZIP.
  chosen = []
  for region in sorted({r["region"] for r in accepted}):
    remaining = sorted(
      [r for r in accepted if r["region"] == region], key=lambda r: r["owner"]
    )
    group = []
    tile_counts: Counter = Counter()
    target = 64 if region == EXTENSION_REGION else MAX_PER_REGION
    while remaining and len(group) < target:
      if group:
        selected = max(
          remaining,
          key=lambda r: min(math.dist(r["center"], p["center"]) for p in group),
        )
      else:
        selected = remaining[0]
      remaining.remove(selected)
      if tile_counts[selected["tile"]] >= 5:
        continue
      group.append(selected)
      tile_counts[selected["tile"]] += 1
    chosen.extend(group)
    if len(group) != target:
      raise ValueError(f"Insufficient measured {region} owners: {len(group)}/{target}")
  source = dict(
    schema=1,
    policy=POLICY,
    boundarySha256=digest(BOUNDARY),
    manifestSha256=digest(OUT / "manifest.json"),
    archives={
      name: archive_receipts[name] for name in sorted({r["sourceTile"] for r in chosen})
    },
    owners=chosen,
    eligible=len(accepted),
    candidates=len(candidates),
  )
  if previous:
    old_runtime = read_json(RUNTIME)
    source.update(
      owners=previous["owners"] + chosen,
      archives={**previous["archives"], **source["archives"]},
      eligible=previous["eligible"] + len(accepted),
      candidates=previous["candidates"] + len(candidates),
      additiveExtension=dict(
        region=EXTENSION_REGION,
        owners=len(chosen),
        previousOwnerCount=len(previous["owners"]),
        previousOwnersSha256=canonical_digest(previous["owners"]),
        previousPackets={
          key: canonical_digest(value) for key, value in old_runtime["packets"].items()
        },
      ),
    )
  write_json(SOURCE, source)
  print("selected", Counter(r["region"] for r in chosen), flush=True)
  return source


def roof_height(triangle: list, x: float, z: float) -> float | None:
  """Barycentric interpolation of an original measured roof triangle."""
  a, b, c = triangle
  den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
  if abs(den) < 1e-8:
    return None
  u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
  v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
  return (
    u * a[1] + v * b[1] + (1 - u - v) * c[1] if min(u, v, 1 - u - v) >= -1e-6 else None
  )


def gutter_segments(parts: list[dict]) -> list[list]:
  """Only level lower outside roof edges qualify, never ridges or gable rakes."""
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  edges = {}
  for part in parts:
    for surface in part["surfaces"]:
      if surface["kind"] != "RoofSurface":
        continue
      heights = [v[1] for r in surface["rings"] for v in r]
      for ring in surface["rings"]:
        for a, b in zip(ring, ring[1:] + ring[:1]):
          line = LineString([(a[0], a[2]), (b[0], b[2])])
          if (
            abs(a[1] - b[1]) > 0.015
            or line.length < 1.5
            or max(heights) - a[1] < 0.6
            or not footprint.boundary.buffer(0.025).covers(line)
          ):
            continue
          key = tuple(sorted((tuple(a), tuple(b))))
          center = np.array(line.interpolate(0.5, normalized=True).coords[0])
          direction = np.array([b[0] - a[0], b[2] - a[2]]) / line.length
          normal = np.array([-direction[1], direction[0]])
          if footprint.covers(Point(*(center + normal * 0.2))):
            normal = -normal
          edges[key] = [a, b, normal.tolist()]
  return list(edges.values())


def cuboid(mesh: PackedMesh, a: list, b: list, normal: list, native: bool) -> None:
  """Estimated 16 cm rainwater course, separately orthogonal in native mode."""
  aa, bb = np.array(a, dtype=float), np.array(b, dtype=float)
  aa += [normal[0] * 0.07, -0.065, normal[1] * 0.07]
  bb += [normal[0] * 0.07, -0.065, normal[1] * 0.07]
  if native:
    length = float(np.linalg.norm(bb - aa))
    steps = max(1, math.ceil(length / 0.7))
    for i in range(steps):
      center = aa + (bb - aa) * (i + 0.5) / steps
      cell = box(center[0] - 0.36, center[2] - 0.36, center[0] + 0.36, center[2] + 0.36)
      mesh.surface(cell, center[1] + 0.1, (106, 116, 114))
    return
  d = np.array([normal[0] * 0.08, 0, normal[1] * 0.08])
  up = np.array([0, 0.07, 0])
  corners = [
    aa - d - up,
    bb - d - up,
    bb + d - up,
    aa + d - up,
    aa - d + up,
    bb - d + up,
    bb + d + up,
    aa + d + up,
  ]
  for face in ((0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)):
    q = [corners[i].tolist() for i in face]
    mesh.triangle(q[:3], (106, 116, 114))
    mesh.triangle([q[0], q[2], q[3]], (106, 116, 114))


def render_owner(mesh: PackedMesh, owner: dict, native: bool) -> dict:
  """Full source wall/roof sheets; native is a separately sampled stepped skin."""
  parts = copy.deepcopy(owner["parts"])
  low = owner["groundY"] + owner["original"].get("groundOffset", 0)
  shift = low - owner["sourceGroundY"]
  roofs, triangle_count = [], 0
  # Hues are neutral material suggestions, not a new claim of measured paint.
  wall_color = (211, 208, 195)
  roof_color = tuple(owner.get("roofTone", (131, 128, 120)))
  for part in parts:
    for surface in part["surfaces"]:
      for ring in surface["rings"]:
        for vertex in ring:
          vertex[1] += shift
      triangles = triangles_for(surface["rings"])
      is_roof = surface["kind"] == "RoofSurface"
      if is_roof:
        roofs.extend(triangles)
      if not native:
        for triangle in triangles:
          # Existing flat-shaded drawing, with individual measured planes legible.
          aa, bb, cc = map(np.array, triangle)
          normal = np.cross(bb - aa, cc - aa)
          normal /= max(float(np.linalg.norm(normal)), 1e-9)
          shade = 0.86 + 0.14 * abs(float(normal @ np.array([0.42, 0.75, 0.51])))
          color = tuple(
            round(c * shade) for c in (roof_color if is_roof else wall_color)
          )
          mesh.triangle(triangle, color)
          triangle_count += 1
  native_cells = 0
  gutters = gutter_segments(parts)
  if native:
    source_footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    footprint = native_polygon(source_footprint)
    cells: dict[float, list] = defaultdict(list)
    tops = {}
    minx, minz, maxx, maxz = footprint.bounds
    for z in np.arange(minz + 1, maxz, 2):
      for x in np.arange(minx + 1, maxx, 2):
        if not footprint.covers(Point(x, z)):
          continue
        heights = [h for t in roofs if (h := roof_height(t, x, z)) is not None]
        if not heights:
          raise ValueError(
            f"Measured roof does not cover native owner cell: {owner['owner']}"
          )
        top = low + max(2, round((max(heights) - low) / 2) * 2)
        cells[top].append(box(x - 1, z - 1, x + 1, z + 1))
        tops[(x, z)] = top
        native_cells += 1
    for top, cells_at_top in sorted(cells.items()):
      geometry = unary_union(cells_at_top)
      mesh.surface(geometry, top, roof_color)
    # Exposed vertical skin only: internal full-height walls between roof steps
    # would waste memory and are not visible architectural evidence.
    strips: dict[tuple, list] = defaultdict(list)
    for (x, z), top in tops.items():
      for dx, dz in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
        bottom = tops.get((x + dx, z + dz), low)
        if top <= bottom:
          continue
        axis = 0 if dx else 2
        const = x + dx / 2 if dx else z + dz / 2
        along = z if dx else x
        strips[(axis, const, bottom, top)].append(along)
    for (axis, const, bottom, top), values in sorted(strips.items()):
      values.sort()
      start = end = values[0]
      for value in [*values[1:], None]:
        if value is not None and value == end + 2:
          end = value
          continue
        aa, bb = (
          ([const, start - 1], [const, end + 1])
          if axis == 0
          else ([start - 1, const], [end + 1, const])
        )
        q = [
          [aa[0], bottom, aa[1]],
          [bb[0], bottom, bb[1]],
          [bb[0], top, bb[1]],
          [aa[0], top, aa[1]],
        ]
        mesh.triangle(q[:3], wall_color)
        mesh.triangle([q[0], q[2], q[3]], wall_color)
        edge = LineString([aa, bb])
        # Native gutters follow the represented orthogonal outside roof edge.
        if bottom == low and any(
          edge.distance(LineString([(a[0], a[2]), (b[0], b[2])])) < 1.5
          and abs(top - a[1]) < 2.1
          for a, b, _ in gutters
        ):
          n = [1, 0] if axis == 0 else [0, 1]
          mid = (np.array(aa) + np.array(bb)) / 2
          if footprint.covers(Point(*(mid + np.array(n) * 0.2))):
            n = [-v for v in n]
          cuboid(mesh, [aa[0], top, aa[1]], [bb[0], top, bb[1]], n, False)
        start = end = value
  else:
    for a, b, n in gutters:
      cuboid(mesh, a, b, n, False)
  return dict(
    sheets=sum(len(p["surfaces"]) for p in parts),
    triangles=triangle_count,
    gutters=len(gutters),
    nativeCells=native_cells,
    rigidYOffset=shift,
  )


@functools.lru_cache(maxsize=1)
def roof_materials() -> tuple[list, STRtree]:
  """Existing retained OSM tags, never material inferred solely from roof pitch."""
  rows = read_json(GEO / "outer-materials-v232-context.json.gz")["records"]
  return rows, STRtree([shape(r["geometry"]) for r in rows])


def mapped_roof_tone(owner: dict) -> tuple | None:
  """Only a unique >=97% reciprocal footprint match may paint the source roof."""
  polygon = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
  rows, tree = roof_materials()
  matches = []
  for index in tree.query(polygon):
    other = shape(rows[index]["geometry"])
    overlap = polygon.intersection(other).area
    if overlap / max(polygon.area, other.area) < 0.97:
      continue
    tags = rows[index]["tags"]
    tone = colour(tags.get("roof:colour")) or ROOF_MATERIAL.get(
      tags.get("roof:material")
    )
    if tone:
      matches.append((tone, rows[index]["id"], tags))
  return matches[0] if len(matches) == 1 else None


def line_receipt(packet: dict, owners: list[dict]) -> list[int]:
  """Remove only exact cap-height ink belonging to the superseded flat roofs."""
  if not packet.get("lines", {}).get("positions"):
    return []
  points = (
    np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
      -1, 2, 3
    )
    / 100
    + packet["origin"]
  )
  selected = []
  for index, (a, b) in enumerate(points):
    for row in owners:
      old = row["original"]
      high = row["groundY"] + old["height"] + old.get("groundOffset", 0)
      ox, _, oz = row["origin"]
      boundary = translate(Polygon(old["ring"], old["holes"]), ox, oz).boundary
      if max(
        abs(a[1] - high - 0.02), abs(b[1] - high - 0.02)
      ) < 0.015 and boundary.buffer(0.015).covers(LineString([a[[0, 2]], b[[0, 2]]])):
        selected.append(index)
        break
  return selected


def build() -> dict:
  """Replay retained sources into bounded per-packet replacement receipts."""
  source = read_json(SOURCE)
  assert source["boundarySha256"] == digest(BOUNDARY)
  manifest = read_json(OUT / "manifest.json")
  by_tile = {d["id"]: d for d in manifest["chunks"]}
  groups: dict[str, list] = defaultdict(list)
  for owner in source["owners"]:
    groups[owner["tile"]].append(owner)
  runtime, evidence = {}, []
  for tile, owners in sorted(groups.items()):
    for mode in ("drawn", "minecraft"):
      descriptor = by_tile[tile][mode]
      path = OUT / descriptor["url"]
      assert digest(path) == descriptor["sha256"]
      packet = read_json(path)
      replacement = PackedMesh(packet["origin"][0], packet["origin"][2])
      transfers: dict[int, list[int]] = defaultdict(list)
      counts = []
      for row in owners:
        row = dict(row)
        mapped = mapped_roof_tone(row)
        if mapped:
          row["roofTone"] = mapped[0]
        matches = match_owner(packet, row["owner"])
        assert matches is not None, row["owner"]
        for mesh, triangles in matches.items():
          assert not set(transfers[mesh]) & set(triangles), "Ambiguous shared old face"
          transfers[mesh].extend(triangles)
        counts.append(
          dict(
            owner=row["owner"],
            roofMaterial=mapped,
            **render_owner(replacement, row, mode == "minecraft"),
          )
        )
      packed = replacement.payload("roof-house-v233")
      records = []
      for mesh, triangles in sorted(transfers.items()):
        part = packet["meshes"][mesh]
        records.append(
          dict(
            mesh=mesh,
            fingerprint=fingerprint(
              [part[k] for k in ("positions", "colors", "indices")]
            ),
            triangles=sorted(triangles),
          )
        )
      lines = line_receipt(packet, owners) if mode == "drawn" else []
      runtime[f"{mode}:{tile}"] = dict(
        origin=packet["origin"],
        records=records,
        lineFingerprint=fingerprint(
          [packet["lines"]["positions"], packet["lines"].get("colors", "")]
        )
        if lines
        else None,
        segments=lines,
        replacement=packed,
      )
      evidence.append(
        dict(
          tile=tile,
          mode=mode,
          oldAsset=descriptor,
          owners=[r["owner"] for r in owners],
          counts=counts,
          transferredTriangles=sum(len(r["triangles"]) for r in records),
          removedFlatInk=len(lines),
          addedVertices=len(replacement.vertices),
          addedTriangles=len(replacement.indices) // 3,
        )
      )
  output = dict(schema=1, keys=sorted(runtime), packets=runtime)
  if extension := source.get("additiveExtension"):
    assert (
      canonical_digest(source["owners"][: extension["previousOwnerCount"]])
      == extension["previousOwnersSha256"]
    )
    for key, expected in extension["previousPackets"].items():
      assert canonical_digest(runtime[key]) == expected, (
        f"Changed previous roof recipe: {key}"
      )
  write_json(RUNTIME, output)
  result = dict(
    policy=POLICY,
    sourceSha256=digest(SOURCE),
    runtimeSha256=digest(RUNTIME),
    regions=dict(Counter(o["region"] for o in source["owners"])),
    owners=len(source["owners"]),
    runtimeBytes=RUNTIME.stat().st_size,
    packets=evidence,
  )
  write_json(EVIDENCE, result)
  print({k: v for k, v in result.items() if k != "packets"}, flush=True)
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--append-steglitz-zehlendorf", action="store_true")
  options = parser.parse_args()
  if options.extract or options.append_steglitz_zehlendorf:
    extract(options.append_steglitz_zehlendorf)
  build()
