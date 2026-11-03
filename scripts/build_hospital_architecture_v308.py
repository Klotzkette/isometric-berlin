"""Two complete measured hospitals and bounded retained-campus recognition.

Original LoD2 sheets, mapped owners and every prior payload remain evidence.
The one false automatic CBF main gable is independently bounded by mapped roof
parts, current official height samples and DOP; no other source sheet is refit.
"""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
import math
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_litten_instanz_v257 import edge
from build_moabit_mitte_v300 import Mesh, clipped_member_ranges, read, sha, write
from build_neukoelln_landmarks_v305 import box_surfaces, roof_heights

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/hospitals-v308"
SOURCE = GEO / "hospitals-v308-source.json.gz"
HEIGHTS = GEO / "hospitals-v308-height-evidence.json.gz"
CORE = DATA / "hospitalArchitectureV308Core.json"
PROFILE = DATA / "hospitalArchitectureV308Profile.json"
CBF_PARENT = "DEBE06YYB0000JRN"
CBF_MAIN = "DEBE3Dklzwy5PFJG"
SITE_NAMES = {
  "benjamin-franklin": "Charité Campus Benjamin Franklin",
  "friedrichshain": "Vivantes Klinikum im Friedrichshain",
  "bundeswehr": "Bundeswehrkrankenhaus Berlin",
  "charite-mitte": "Charité Campus Mitte treatment building",
}


def extract() -> None:
  """Read every leaf of the finite two mapped campuses from original archives."""
  prior = read(GEO / "hospitals-source-v228.json")
  osm = read(GEO / "hospitals-osm-v228.json")
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  scopes = {}
  for site in prior["sites"]:
    if site["key"] == "benjamin-franklin":
      scopes[site["key"]] = shape(site["retainedOwners"][0]["geometry"])
    elif site["key"] == "friedrichshain":
      campus = next(s for s in osm["sites"] if s["key"] == site["key"])
      g = transform(project, shape(campus["campus"]["geometry"]))
      scopes[site["key"]] = transform(lambda x, y: (x - 389500, 5820000 - y), g)
  sites: dict[str, list] = {key: [] for key in scopes}
  archives = []
  for name in [
    "LoD2_385_5811.zip",
    "LoD2_386_5811.zip",
    "LoD2_393_5820.zip",
    "LoD2_394_5820.zip",
  ]:
    path = GEO / "raw/lod2" / name
    archives.append(
      dict(
        url="https://gdi.berlin.de/data/a_lod2/atom/" + name,
        sha256=sha(path),
        license="dl-de/zero-2-0",
      )
    )
    with zipfile.ZipFile(path) as archive:
      member = next(
        n for n in archive.namelist() if n.lower().endswith((".xml", ".gml"))
      )
      with archive.open(member) as stream:
        for _, parent in ET.iterparse(stream, events=("end",)):
          if parent.tag != f"{{{NS['bldg']}}}Building":
            continue
          rings = []
          for pos in parent.findall(
            ".//bldg:GroundSurface//gml:Polygon/gml:exterior//gml:posList", NS
          ):
            values = list(map(float, pos.text.split()))
            rings.append(
              Polygon(
                [(x - 389500, 5820000 - y) for x, y in zip(values[::3], values[1::3])]
              )
            )
          footprint = unary_union(rings)
          if not footprint.is_empty:
            for key, scope in scopes.items():
              area = footprint.intersection(scope).area
              if area / min(footprint.area, scope.area) < 0.15:
                continue
              if area / footprint.area < 0.8:
                continue
              sites[key].append(
                dict(
                  id=parent.get(GML_ID),
                  archive=name,
                  parts=[
                    part_profile(p) for p in leaf_building_parts(parent) or [parent]
                  ],
                  sourceCreated=parent.findtext("core:creationDate", namespaces=NS),
                )
              )
          parent.clear()
  assert len(sites["benjamin-franklin"]) == 1
  assert sites["benjamin-franklin"][0]["id"] == CBF_PARENT
  assert len(sites["friedrichshain"]) == 37
  site_rows = []
  for key, parents in sites.items():
    previous = next(s for s in prior["sites"] if s["key"] == key)
    owner_ids = (
      ["OSM-relation-5943188"]
      if key == "benjamin-franklin"
      else [p["id"] for p in parents]
    )
    old_path = GEO / (
      "raw/outskirts-v187/resolved-outlines.gpkg"
      if key == "benjamin-franklin"
      else "raw/outer-v159/resolved-outlines.gpkg"
    )
    selection = ",".join("'" + key + "'" for key in owner_ids)
    frame = pyogrio.read_dataframe(
      old_path, layer="buildings", where=f"sourceId IN ({selection})"
    )
    old_owners = [
      dict(
        sourceId=r["sourceId"],
        height=float(r["height"]),
        minHeight=float(r["minHeight"]),
        geometry=mapping(r["geometry"]),
      )
      for r in frame.to_dict("records")
    ]
    assert set(p["sourceId"] for p in old_owners) == set(owner_ids)
    packet_dir = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
    ground_pins = []
    candidates = [
      d
      for d in read(packet_dir / "manifest.json")["chunks"]
      if not d.get("detailCompanionOf")
      and any(
        shape(o["geometry"]).intersection(box(*d["bounds"])).area > 1e-6
        for o in old_owners
      )
    ]
    for owner in old_owners:
      offsets = set()
      for desc in candidates:
        path = packet_dir / desc["drawn"]["url"]
        packet = read(path)
        for nav in packet["nav"]["buildings"]:
          if nav["sourceId"] == owner["sourceId"]:
            offsets.add(nav.get("groundOffset", 0))
      assert len(offsets) == 1, (owner["sourceId"], offsets)
      owner["groundOffset"] = offsets.pop()
    ground_pins = [
      dict(path=d["drawn"]["url"], sha256=sha(packet_dir / d["drawn"]["url"]))
      for d in candidates
    ]
    by_owner = {r["sourceId"]: r for r in old_owners}
    for parent in parents:
      previous_owner = (
        by_owner["OSM-relation-5943188"]
        if key == "benjamin-franklin"
        else by_owner[parent["id"]]
      )
      parent["renderOffset"] = (
        3
        + previous_owner["minHeight"]
        + previous_owner["groundOffset"]
        - min(p["ground_y_m"] for p in parent["parts"])
      )
    site_rows.append(
      dict(
        key=key,
        name=SITE_NAMES[key],
        parents=parents,
        previousProfiles=previous,
        oldOwners=old_owners,
        oldSourcePath=str(old_path.relative_to(ROOT)),
        oldSourceSha256=sha(old_path),
        oldGroundPackets=ground_pins,
        yOffset=3 - min(p["ground_y_m"] for b in parents for p in b["parts"]),
      )
    )
  samples = dict(
    broad=read(RAW / "cbf-bdom-v308.json"),
    mappedParts=read(RAW / "cbf-parts-bdom-v308.json"),
    dop=dict(
      url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
      layer="dop_2025",
      bbox=[385750, 5811400, 386110, 5811740],
      imageSha256=sha(RAW / "cbf-dop2025.png"),
      license="dl-de/zero-2-0",
    ),
  )
  write(HEIGHTS, samples)
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      sites=site_rows,
      archives=archives,
      originalV228Sha256=sha(GEO / "hospitals-source-v228.json"),
      originalOsmV228Sha256=sha(GEO / "hospitals-osm-v228.json"),
      heightEvidenceSha256=sha(HEIGHTS),
      policy="Complete original LoD2 leaves and sheets, including every original faulty CBF gable sheet, remain immutable evidence. Only the exactly identified CBF main component has a separate mapped-part/DOP/bDOM correction. Small facade/roof material subdivisions are reference-guided display estimates. All unrelated sources, details, city coverage and runtime caps remain.",
    ),
  )


def cbf_corrected_parts(parent: dict, heights: dict) -> tuple[list, dict]:
  """Refit only the automatic main gable using independently measured regions."""
  original = next(p for p in parent["parts"] if p["id"] == CBF_MAIN)
  footprint = Polygon(original["ring"], original["holes"])
  mapped = heights["mappedParts"]
  additions = []
  covered = []
  receipts = []
  # Higher mapped regions take the physically visible upper envelope. Every
  # region retains its own independent measured observations, never a campus cap.
  ordered = sorted(
    mapped["regions"],
    key=lambda p: (
      -int(p["oldProfile"]["tags"].get("building:levels", "0")),
      p["owner"],
    ),
  )
  for record in ordered:
    old = record["oldProfile"]
    geometry = Polygon(old["ring"], old["holes"]).intersection(footprint)
    if geometry.area < 100:
      continue
    values = sorted(
      r["nhn"] for r in mapped["samples"] if r["owner"] == record["owner"]
    )
    assert values and all(math.isfinite(v) for v in values)
    # The median rejects small air-handler/parapet returns; centimetre variation
    # remains evidence. Each selected part has its own bounded observation set.
    roof_nhn = round(float(np.median(values)) / 0.05) * 0.05
    if covered:
      geometry = geometry.difference(unary_union(covered))
    if geometry.area < 0.01:
      continue
    parts = box_surfaces(
      geometry,
      original["ground_y_m"],
      roof_nhn - 30,
      f"{CBF_MAIN}:mapped:{record['owner']}",
    )
    for part in parts:
      part["roofBasis"] = record["owner"]
    additions.extend(parts)
    covered.append(geometry)
    receipts.append(
      dict(
        owner=record["owner"],
        roofNhnM=roof_nhn,
        observationsNhnM=values,
        areaM2=geometry.area,
      )
    )
  complement = footprint.difference(unary_union(covered))
  broad = [
    r["nhn"]
    for r in heights["broad"]["samples"]
    if r["kind"] == "main-exposed" and r["nhn"] < 55
  ]
  assert len(broad) >= 10 and max(broad) - min(broad) < 1.0
  low_roof = round(float(np.median(broad)) / 0.05) * 0.05
  additions.extend(
    box_surfaces(
      complement,
      original["ground_y_m"],
      low_roof - 30,
      CBF_MAIN + ":remaining-low-roof",
    )
  )
  assert (
    unary_union([Polygon(p["ring"], p["holes"]) for p in additions])
    .symmetric_difference(footprint)
    .area
    < 1e-6
  )
  untouched = [copy.deepcopy(p) for p in parent["parts"] if p["id"] != CBF_MAIN]
  assert len(untouched) == 31
  return untouched + additions, dict(
    parent=parent["id"],
    sourcePart=CBF_MAIN,
    originalPartSha256=hashlib.sha256(
      json.dumps(original, sort_keys=True).encode()
    ).hexdigest(),
    originalPart=original,
    regions=receipts,
    remainingLowRoofNhnM=low_roof,
    remainingObservationsNhnM=broad,
    untouchedParts=31,
    exactFootprintAndAllCourtyardHolesPreserved=True,
  )


def transformed_parts(site: dict, heights: dict) -> tuple[list, list]:
  """One common retained street-datum translation, no per-leaf flattening."""
  result, corrections = [], []
  for parent in site["parents"]:
    offset = parent["renderOffset"]
    if parent["id"] == CBF_PARENT:
      originals, correction = cbf_corrected_parts(parent, heights)
      corrections.append(correction)
    else:
      originals = copy.deepcopy(parent["parts"])
    for part in originals:
      part.update(parent=parent["id"], site=site["key"])
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for point in ring:
            point[1] = round(point[1] + offset, 6)
      part["ground_y_m"] += offset
      part["top_y_m"] += offset
      result.append(part)
  # Keep every exact old outside fragment. No source mismatch may quietly trim
  # an adjacent wing or turn an earlier mapped roof into empty ground.
  measured = unary_union([Polygon(p["ring"], p["holes"]) for p in result])
  previous = [
    dict(
      owner=r["sourceId"],
      geometry=shape(r["geometry"]),
      low=3 + r["minHeight"] + r["groundOffset"],
      high=3 + r["height"] + r["groundOffset"],
    )
    for r in site["oldOwners"]
  ]
  if site["key"] == "benjamin-franklin":
    previous.extend(
      dict(
        owner=p["owner"],
        geometry=Polygon(p["ring"], p["holes"]),
        low=p["ground_y_m"],
        high=p["top_y_m"],
      )
      for p in site["previousProfiles"]["parts"][1:]
    )
  for old in previous:
    outside = old["geometry"].difference(measured)
    for part in box_surfaces(outside, old["low"], old["high"], old["owner"]):
      part.update(
        parent=old["owner"] + ":retained-outside",
        site=site["key"],
        outsideComplement=True,
      )
      result.append(part)
  return result, corrections


def material(site: str, parent: str, kind: str) -> int:
  """Restrained documented material families; no random or tenant palette."""
  if site == "benjamin-franklin":
    return 0x858B84 if kind == "RoofSurface" else 0xC2C1B4
  modern = parent in {"DEBE02YY200006vi", "DEBE02YY2000050L", "DEBE02AL5bf0000N"}
  return (
    (0x858D86 if modern else 0x8F6049)
    if kind == "RoofSurface"
    else (0xBBB7AB if modern else 0xA17C61)
  )


def roof_material(site: str, parent: str, triangle: list) -> int:
  """DOP confirms grey flat roofs and red pitched historic pavilions separately."""
  if site == "benjamin-franklin":
    return material(site, parent, "RoofSurface")
  a, b, c = np.asarray(triangle)
  normal = np.cross(b - a, c - a)
  magnitude = np.linalg.norm(normal)
  pitched = magnitude > 1e-9 and abs(normal[1]) / magnitude < 0.995
  return 0x8F6049 if pitched else 0x858D86


def merge_navigation(cells: dict, step: float, key: str) -> list:
  """Coalesce only identical cap rectangles; retain every actual cardinal cell."""
  by_row: dict = defaultdict(list)
  for (x, z), (low, high, wall, roof) in cells.items():
    by_row[(z, low, high, wall, roof)].append(x)
  strips = defaultdict(list)
  for (z, low, high, wall, roof), xs in sorted(by_row.items()):
    start = end = min(xs)
    for x in [*sorted(set(xs))[1:], None]:
      if x is not None and x == end + 1:
        end = x
        continue
      strips[(start, end + 1, low, high, wall, roof)].append(z)
      start = end = x
  result = []
  for (x0, x1, low, high, wall, roof), zs in sorted(strips.items()):
    start = end = min(zs)
    for z in [*sorted(set(zs))[1:], None]:
      if z is not None and z == end + 1:
        end = z
        continue
      result.append([key, x0, start, x1, end + 1, low, high, wall, roof])
      start = end = z
  return result


def model_site(site: dict, heights: dict) -> tuple[dict, dict]:
  """Compile exact drawn sheets and precomputed independent half-metre bodies."""
  parts, corrections = transformed_parts(site, heights)
  drawn, blocks = Mesh(), Mesh()
  nav = []
  cells: dict[tuple[int, int], tuple[float, float, int, int]] = {}
  step = 0.5
  for part in parts:
    roofs, pitched_roofs = [], []
    for surface in part["surfaces"]:
      triangles = triangles_for(surface["rings"])
      if surface["kind"] == "RoofSurface":
        roofs.extend(triangles)
        pitched_roofs.extend(
          t
          for t in triangles
          if roof_material(site["key"], part["parent"], t) == 0x8F6049
        )
      for triangle in triangles:
        tone = (
          roof_material(site["key"], part["parent"], triangle)
          if surface["kind"] == "RoofSurface"
          else material(site["key"], part["parent"], surface["kind"])
        )
        drawn.triangle(triangle, tone, "complete-source-sheet")
    nav.append(
      dict(
        id=part["id"],
        parent=part["parent"],
        site=site["key"],
        ring=part["ring"],
        holes=part["holes"],
        low=part["ground_y_m"],
        high=part["top_y_m"],
        roofTriangles=roofs,
      )
    )
    geometry = Polygon(part["ring"], part["holes"])
    x0, z0, x1, z1 = geometry.bounds
    xs, zs = np.meshgrid(
      np.arange(math.floor(x0 / step), math.ceil(x1 / step)),
      np.arange(math.floor(z0 / step), math.ceil(z1 / step)),
    )
    xs, zs = xs.ravel(), zs.ravel()
    inside = shapely.contains_xy(geometry, (xs + 0.5) * step, (zs + 0.5) * step)
    xs, zs = xs[inside], zs[inside]
    tops = roof_heights(roofs, (xs + 0.5) * step, (zs + 0.5) * step)
    pitched_tops = roof_heights(pitched_roofs, (xs + 0.5) * step, (zs + 0.5) * step)
    tops[~np.isfinite(tops)] = part["top_y_m"]
    low = math.floor(part["ground_y_m"] / step) * step
    for x, z, top, pitched_top in zip(xs, zs, tops, pitched_tops, strict=True):
      wall = material(site["key"], part["parent"], "WallSurface")
      roof = (
        0x8F6049
        if np.isfinite(pitched_top) and abs(pitched_top - top) < 0.02
        else 0x858B84
        if site["key"] == "benjamin-franklin"
        else 0x858D86
      )
      previous = cells.get((int(x), int(z)), (low, low, wall, roof))
      high = math.ceil(top / step) * step
      cells[(int(x), int(z))] = (
        min(low, previous[0]),
        max(high, previous[1]),
        wall if high >= previous[1] else previous[2],
        roof if high >= previous[1] else previous[3],
      )
  native_rectangles = merge_navigation(cells, step, site["key"])
  # A rectangle is exactly the union of identical original cardinal cells. The
  # shared cube is instanced, so neither hidden per-cell faces nor CPU voxels are
  # materialised during browser construction.
  for _, x0, z0, x1, z1, low, high, wall, roof in native_rectangles:
    blocks.box(
      [(x0 + x1) * step / 2, (low + high) / 2, (z0 + z1) * step / 2],
      [(x1 - x0) * step, high - low, (z1 - z0) * step],
      wall,
      "cardinal-source-body",
    )
    blocks.box(
      [(x0 + x1) * step / 2, high + 0.025, (z0 + z1) * step / 2],
      [(x1 - x0) * step, 0.05, (z1 - z0) * step],
      roof,
      "cardinal-roof-cap",
    )
  fittings, native_fittings, faces = facade_fittings(site["key"], parts, cells)
  blocks.boxes.extend(native_fittings)
  by_low = defaultdict(list)
  for _, x0, z0, x1, z1, low, high, *_ in native_rectangles:
    by_low[low].append((box(x0 * step, z0 * step, x1 * step, z1 * step), high + 0.05))
  native_regions = []
  for low, rows in by_low.items():
    union = unary_union([g for g, _ in rows])
    for g in [union] if union.geom_type == "Polygon" else union.geoms:
      native_regions.append(
        dict(
          site=site["key"],
          low=low,
          high=max(high for original, high in rows if original.intersects(g)),
          ring=[list(v) for v in g.exterior.coords],
          holes=[[list(v) for v in r.coords] for r in g.interiors],
        )
      )
  return dict(
    key=site["key"],
    name=site["name"],
    drawn=drawn.packed(),
    fittings=packed_rows(fittings),
    nativeBoxes=packed_rows(blocks.boxes),
    counts=dict(
      sourceTriangles=len(drawn.indices) // 3,
      fittings=len(fittings),
      nativeInstances=len(blocks.boxes),
    ),
  ), dict(
    key=site["key"],
    navigation=nav,
    nativeNavigation=[[*row[:6], row[6] + 0.05] for row in native_rectangles],
    corrections=corrections,
    sourceParents=len(site["parents"]),
    sourceLeaves=sum(len(p["parts"]) for p in site["parents"]),
    sourceSheets=sum(len(p["surfaces"]) for b in site["parents"] for p in b["parts"]),
    representedLeaves=len(parts),
    nativeCells=len(cells),
    step=step,
    faces=faces,
    nativeRegions=native_regions,
  )


def facade_fittings(
  key: str,
  parts: list[dict],
  cells: dict | None = None,
  retained_walls: dict | None = None,
) -> tuple[list, list, list]:
  """Fit complete rectangles to actual walls; exclude buried and party faces."""
  drawn, native = Mesh(), Mesh()
  shapes = [Polygon(p["ring"], p["holes"]) for p in parts]
  tree = STRtree(shapes)
  faces = []
  seen = set()
  step = 0.5
  for pi, part in enumerate(parts):
    if part.get("outsideComplement"):
      continue
    for surface_index, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      face = edge(surface)
      if not face:
        continue
      a, b = face["a"], face["b"]
      length = math.dist(a, b)
      if length < 2.4 or face["top"] - face["bottom"] < 3:
        continue
      direction = [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
      normal = face["normal"]
      center = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      if shapes[pi].covers(
        Point(center.x + normal[0] * 0.08, center.y + normal[1] * 0.08)
      ):
        normal = [-normal[0], -normal[1]]
      signature = tuple(round(v, 5) for v in [*a, *b, face["bottom"], face["top"]])
      if signature in seen:
        continue
      seen.add(signature)
      uv = [
        [
          [(q[0] - a[0]) * direction[0] + (q[2] - a[1]) * direction[1], q[1]]
          for q in ring
        ]
        for ring in surface["rings"]
      ]
      wall = shapely.make_valid(Polygon(uv[0], uv[1:]))
      if wall.area < 1:
        continue
      start_drawn, start_native = len(drawn.boxes), len(native.boxes)

      def exposed(u: float, y: float) -> bool:
        point = Point(
          a[0] + direction[0] * u + normal[0] * 0.35,
          a[1] + direction[1] * u + normal[1] * 0.35,
        )
        for j in tree.query(point):
          if j == pi:
            continue
          other = parts[j]
          if other["ground_y_m"] <= y < other["top_y_m"] - 0.08 and shapes[j].covers(
            point
          ):
            return False
        return True

      def member(
        u: float,
        y: float,
        width: float,
        height: float,
        depth: float,
        out: float,
        tone: int,
        role: str,
        strip: bool = False,
      ) -> None:
        for cu, cw in clipped_member_ranges(wall, u, y, width, height, strip):
          if not exposed(cu, y):
            continue
          x = a[0] + direction[0] * cu + normal[0] * out
          z = a[1] + direction[1] * cu + normal[1] * out
          drawn.box([x, y, z], [cw, height, depth], tone, role, direction, normal)
          # Native members follow actual exterior cardinal cells. Short pieces
          # retain diagonal stair steps rather than one rotated floating panel.
          count = max(1, math.ceil(cw / 0.5))
          for i in range(count):
            off = ((i + 0.5) / count - 0.5) * cw
            wx, wz = x + direction[0] * off, z + direction[1] * off
            axis = 0 if abs(normal[0]) >= abs(normal[1]) else 1
            sign = 1 if normal[axis] > 0 else -1
            extent = max(0.08, cw / count * max(abs(direction[0]), abs(direction[1])))
            coords = [math.floor(wx / step), math.floor(wz / step)]
            if cells is not None:
              candidates = []
              for delta in range(-4, 5):
                candidate = coords.copy()
                candidate[axis] += delta
                own = cells.get(tuple(candidate))
                if own is None or own[0] > y - height / 2 or own[1] < y + height / 2:
                  continue
                neighbor = candidate.copy()
                neighbor[axis] += sign
                other = cells.get(tuple(neighbor))
                if (
                  other is not None
                  and other[0] < y + height / 2
                  and other[1] > y - height / 2
                ):
                  continue
                plane = (candidate[axis] + (1 if sign > 0 else 0)) * step
                candidates.append((abs(plane - (wx if axis == 0 else wz)), plane))
              if not candidates:
                continue
              _, plane = min(candidates)
            else:
              # Query actual delivered cardinal wall polygons, with the v215
              # retired gable excluded. No guessed source-plane rounding may
              # bury these fittings inside the older two-metre surface cells.
              assert retained_walls is not None
              tangent = wz if axis == 0 else wx
              rectangle = box(
                tangent - extent / 2,
                y - height / 2,
                tangent + extent / 2,
                y + height / 2,
              )
              candidates = []
              for candidate in retained_walls.get(
                (axis, sign, math.floor(tangent / 2), math.floor(y / 2)), []
              ):
                plane, polygon = candidate
                value = wx if axis == 0 else wz
                if abs(plane - value) < 5 and polygon.buffer(1e-6).covers(rectangle):
                  candidates.append((abs(plane - value), plane))
              if not candidates:
                continue
              _, plane = min(candidates)
            if axis == 0:
              wx = plane + sign * max(out, depth / 2 + 0.02)
            else:
              wz = plane + sign * max(out, depth / 2 + 0.02)
            native.box(
              [wx, y, wz],
              [depth if axis == 0 else extent, height, extent if axis == 0 else depth],
              tone,
              role + "-cardinal",
            )

      modern = key == "friedrichshain" and part["parent"] in {
        "DEBE02YY200006vi",
        "DEBE02YY2000050L",
        "DEBE02AL5bf0000N",
      }
      low, high = face["bottom"], face["top"]
      if key == "benjamin-franklin":
        levels = [
          v
          for v in [*np.arange(5.3, 21, 4.5), *np.arange(23, 44.5, 4.2)]
          if low + 1 < v < high - 1.0
        ]
        pitch, glass_h, trim = 3.2, 2.35, 0xC9CBBF
      elif key == "bundeswehr":
        # DBV and the primary project photo identify six real main-ward storeys.
        levels = [5.2 + (33.878 - 5.2) * (i + 0.61) / 6 for i in range(6)]
        pitch, glass_h, trim = 2.65, 1.9, 0xDCE0D7
      elif key == "charite-mitte":
        levels = [y for y in np.arange(23.6, 34, 3.7) if low + 0.9 < y < high - 1]
        pitch, glass_h, trim = 2.3, 2.05, 0xDADFD9
      else:
        levels_count = max(1, min(6, round((high - low) / (3.8 if modern else 3.7))))
        level_pitch = (high - low) / levels_count
        levels = [low + level_pitch * (i + 0.58) for i in range(levels_count)]
        pitch, glass_h, trim = 2.9 if modern else 2.8, 1.9, 0xE0DECF
      bays = max(1, round(length / pitch))
      bay_width = length / bays
      for y in levels:
        if key == "bundeswehr":
          member(
            length / 2,
            float(y),
            length - 0.2,
            glass_h,
            0.065,
            0.095,
            0x526263,
            "six-storey-continuous-window-ribbon",
            True,
          )
        for i in range(bays):
          u = (i + 0.5) * bay_width
          width = min(2.3 if key == "benjamin-franklin" else 1.8, bay_width * 0.73)
          member(
            u,
            float(y),
            width + 0.16,
            glass_h + 0.16,
            0.085,
            0.13,
            trim,
            "individual-window-reveal",
          )
          member(
            u, float(y), width, glass_h, 0.07, 0.205, 0x526263, "paired-window-glazing"
          )
          member(
            u, float(y), 0.055, glass_h, 0.10, 0.255, trim, "paired-window-mullion"
          )
          member(
            u,
            float(y - glass_h / 2 - 0.13),
            width + 0.28,
            0.13,
            0.25,
            0.23,
            trim,
            "projecting-window-sill",
          )
          if modern:
            member(
              u + width * 0.31,
              float(y),
              0.045,
              glass_h,
              0.11,
              0.27,
              0xECEDE5,
              "modern-asymmetric-window-leaf",
            )
        if key == "benjamin-franklin":
          member(
            length / 2,
            float(y - 1.5),
            length - 0.12,
            0.24,
            0.35,
            0.18,
            0xA7AAA1,
            "documented-concrete-floor-spandrel",
            True,
          )
        if modern and y == levels[-1] and high - low > 15:
          member(
            length / 2,
            float(y - 0.65),
            length - 0.1,
            0.075,
            0.09,
            0.32,
            0x707B77,
            "upper-loggia-rail",
            True,
          )
      if key in {"charite-mitte", "bundeswehr"}:
        # Metallic joints/louvers supplement retained opaque walls; no new
        # entrance volume or unsupported walking route is invented.
        for y in np.arange(
          max(low + 0.7, 23 if key == "charite-mitte" else 31), high - 0.15, 0.42
        ):
          member(
            length / 2,
            float(y),
            length - 0.15,
            0.045,
            0.08,
            0.08,
            0x82938F,
            "fine-metallic-roof-or-cladding-joint",
            True,
          )
      if len(drawn.boxes) > start_drawn:
        faces.append(
          dict(
            parent=part["parent"],
            part=part["id"],
            site=key,
            surface=surface_index,
            sourceRings=surface["rings"],
            generatedDrawnRange=[start_drawn, len(drawn.boxes)],
            generatedNativeRange=[start_native, len(native.boxes)],
            rangeSpace="Source-wall generation order before exact native interval union and canonical opaque-member sorting",
          )
        )
  return drawn.boxes, merge_native_fittings(native.boxes), faces


def merge_native_fittings(rows: list) -> list:
  """Union touching equal cardinal strips, preserving every occupied interval."""
  groups: dict = defaultdict(list)
  for x, y, z, w, h, d, yaw, tone in rows:
    assert yaw == 0
    axis = 0 if w >= d else 2
    values = [x, y, z, w, h, d]
    extent = values[3 + axis]
    values[axis] = values[3 + axis] = 0
    groups[(axis, *[round(v, 7) for v in values], tone)].append(
      ((x if axis == 0 else z) - extent / 2, (x if axis == 0 else z) + extent / 2)
    )
  result = []
  for (axis, *record), intervals in sorted(groups.items()):
    *values, tone = record
    start, end = sorted(intervals)[0]
    for interval in [*sorted(intervals)[1:], None]:
      if interval is not None and interval[0] <= end + 1e-7:
        end = max(end, interval[1])
        continue
      row = values.copy()
      row[axis], row[3 + axis] = (start + end) / 2, end - start
      result.append([*row, 0, int(tone)])
      if interval is not None:
        start, end = interval
  return result


def packed_rows(rows: list) -> dict:
  """Exact Float32 bit deltas after a deterministic opaque-member sort."""
  a = np.asarray(rows, dtype="<f4")
  assert a.ndim == 2 and a.shape[1] == 8 and np.isfinite(a).all()
  order = [7, 6, 3, 4, 5, 0, 2, 1]
  a = a[np.lexsort(tuple(a[:, i] for i in reversed(order)))].copy()
  columns = []
  for column in a.T:
    previous, encoded = 0, bytearray()
    for bits in column.copy().view("<u4"):
      bits = int(bits)
      delta = (bits - previous + 2**31) % 2**32 - 2**31
      previous = bits
      value = ((delta << 1) ^ (delta >> 31)) & 0xFFFFFFFF
      while value >= 128:
        encoded.append((value & 127) | 128)
        value >>= 7
      encoded.append(value)
    columns.append(base64.b64encode(encoded).decode())
  return dict(
    codec="f32-delta-zigzag-varint-columns-v1", count=len(rows), columns=columns
  )


def retained_core_fittings() -> tuple[list, list]:
  """Refine exact retained BWK/Charité owners, without duplicating their bodies."""
  extras, profiles = [], []
  source = read(GEO / "bundeswehr-hospital-v214-source.json")
  correction = read(GEO / "bundeswehr-hospital-v215-correction.json")
  old = next(
    p for o in source["owners"] for p in o["parts"] if p["id"] == correction["part"]
  )
  fixed = correction["correctedPart"]
  parts = [
    dict(
      id=fixed["id"],
      parent=correction["owner"],
      ring=old["ring"],
      holes=old["holes"],
      ground_y_m=fixed["groundY"],
      top_y_m=fixed["topY"],
      surfaces=[s for s in fixed["surfaces"] if s["kind"] == "WallSurface"],
    )
  ]
  walls, wall_receipt = retained_native_walls(parts)
  drawn, native, faces = facade_fittings("bundeswehr", parts, retained_walls=walls)
  extras.append(
    dict(
      key="bundeswehr",
      name=SITE_NAMES["bundeswehr"],
      fittings=packed_rows(drawn),
      nativeBoxes=packed_rows(native),
      counts=dict(sourceTriangles=0, fittings=len(drawn), nativeInstances=len(native)),
    )
  )
  profiles.append(
    dict(
      key="bundeswehr",
      faces=faces,
      navigation=[],
      nativeNavigation=[],
      retainedNativeWallReceipt=wall_receipt,
    )
  )
  allowed = {"fTIktpn9", "lnJPRqrv", "xyl6wGjY", "32tVlJUu", "0hYL1BJs", "1Mr0004q"}
  parts = []
  folder = GEO / "alt-mitte-v169"
  for chunk in read(folder / "source-manifest.json")["chunks"]:
    if chunk["tile"] != "390_5820":
      continue
    for building in read(folder / chunk["file"])["buildings"]:
      for p in building["parts"]:
        if p["id"][-8:] not in allowed:
          continue
        for i, fp in enumerate(p["footprintPolygons"]):
          parts.append(
            dict(
              id=p["id"] + f":{i}",
              parent=building["id"],
              ring=fp["ring"],
              holes=fp["holes"],
              ground_y_m=p["groundY"],
              top_y_m=p["topY"],
              surfaces=[s for s in p["surfaces"] if s["kind"] == "WallSurface"],
            )
          )
  assert len(parts) >= 6
  walls, wall_receipt = retained_native_walls(parts)
  drawn, native, faces = facade_fittings("charite-mitte", parts, retained_walls=walls)
  extras.append(
    dict(
      key="charite-mitte",
      name=SITE_NAMES["charite-mitte"],
      fittings=packed_rows(drawn),
      nativeBoxes=packed_rows(native),
      counts=dict(sourceTriangles=0, fittings=len(drawn), nativeInstances=len(native)),
    )
  )
  profiles.append(
    dict(
      key="charite-mitte",
      faces=faces,
      navigation=[],
      nativeNavigation=[],
      retainedNativeWallReceipt=wall_receipt,
    )
  )
  return extras, profiles


def retained_native_walls(parts: list[dict]) -> tuple[dict, dict]:
  """Read exact delivered native wall planes, after the v215 gable retirement."""
  footprints = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  bounds = footprints.buffer(3).bounds
  ownership = read(DATA / "bundeswehrHospitalV215Ownership.json")
  retired = {
    r["tile"]: set(r["triangles"])
    for r in ownership["records"]
    if r["mode"] == "minecraft"
  }
  groups = defaultdict(list)
  pins, triangle_count = [], 0
  records = read(DATA / "altMitteNativeV169Source.json")["chunkFiles"]
  paths = [DATA / r["file"] for r in records]
  paths.append(DATA / "bundeswehrHospitalV215Minecraft.json")
  for path in paths:
    packet = read(path)
    if not box(
      packet["origin"][0],
      packet["origin"][2],
      packet["origin"][0] + 512,
      packet["origin"][2] + 512,
    ).intersects(box(*bounds)):
      continue
    used = False
    for mesh in packet["meshes"]:
      positions = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
        / 100
      )
      positions += packet["origin"]
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      for i, triangle in enumerate(positions[indices]):
        if i in retired.get("alt-mitte-v169-" + packet["id"], set()):
          continue
        if (
          triangle[:, 0].max() < bounds[0]
          or triangle[:, 0].min() > bounds[2]
          or triangle[:, 2].max() < bounds[1]
          or triangle[:, 2].min() > bounds[3]
        ):
          continue
        normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
        axis = int(np.argmax(abs(normal)))
        if (
          axis == 1
          or abs(normal[axis]) < 1e-8
          or np.any(abs(np.delete(normal, axis)) > 1e-6)
        ):
          continue
        plane = float(triangle[0, axis])
        tangent = 2 if axis == 0 else 0
        polygon = Polygon(triangle[:, [tangent, 1]])
        if polygon.area <= 1e-8:
          continue
        groups[(axis, 1 if normal[axis] > 0 else -1, plane)].append(polygon)
        triangle_count += 1
        used = True
    if used:
      pins.append(dict(path=str(path.relative_to(ROOT)), sha256=sha(path)))
  # The five retained Charité treatment pieces belong to the original measured
  # core columns, not the additive Alt-Mitte resident packets. Use those exact
  # delivered four-metre columns and subtract their actual neighbour intervals.
  if parts[0]["parent"] == "DEBE01YYK00003w7":
    path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
    payload = read(path)
    step = payload["cell_m"]
    columns = {}
    for zi, row in enumerate(payload["building_rows"]):
      z = payload["grid"]["min_z_idx"] + zi
      if z * step > bounds[3] + step or (z + 1) * step < bounds[1] - step:
        continue
      for start, run, low, high, _ in row:
        for x in range(
          start + payload["grid"]["min_x_idx"],
          start + payload["grid"]["min_x_idx"] + run,
        ):
          if x * step <= bounds[2] + step and (x + 1) * step >= bounds[0] - step:
            columns[(x, z)] = (low / 10, high / 10)
    for (x, z), (low, high) in columns.items():
      for axis, sign in [(0, -1), (0, 1), (2, -1), (2, 1)]:
        neighbor = (x + sign, z) if axis == 0 else (x, z + sign)
        tangent = z if axis == 0 else x
        polygon = box(tangent * step, low, (tangent + 1) * step, high)
        if neighbor in columns:
          nlow, nhigh = columns[neighbor]
          polygon = polygon.difference(
            box(tangent * step, nlow, (tangent + 1) * step, nhigh)
          )
        if polygon.is_empty:
          continue
        plane = (x + (sign > 0)) * step if axis == 0 else (z + (sign > 0)) * step
        groups[(axis, sign, plane)].append(polygon)
    pins.append(dict(path=str(path.relative_to(ROOT)), sha256=sha(path)))
  index = defaultdict(list)
  plane_count = 0
  for (axis, sign, plane), polygons in groups.items():
    union = unary_union(polygons)
    for polygon in [union] if union.geom_type == "Polygon" else union.geoms:
      if polygon.geom_type != "Polygon":
        continue
      a, b, c, d = polygon.bounds
      for u in range(math.floor(a / 2), math.floor(c / 2) + 1):
        for y in range(math.floor(b / 2), math.floor(d / 2) + 1):
          index[(axis, sign, u, y)].append((plane, polygon))
      plane_count += 1
  assert triangle_count and plane_count
  return index, dict(
    packets=pins,
    wallTriangles=triangle_count,
    wallPlanePolygons=plane_count,
    correctionOwnershipSha256=sha(DATA / "bundeswehrHospitalV215Ownership.json"),
    policy="Every added retained-core native member fits wholly on an actual outward delivered cardinal wall polygon; obsolete v215 gable triangles are excluded before plane extraction.",
  )


def compile_data() -> None:
  """Write only compact v308 derivatives; original older sources stay unchanged."""
  source, heights = read(SOURCE), read(HEIGHTS)
  assert source["heightEvidenceSha256"] == sha(HEIGHTS)
  sites, profiles = [], []
  for site in source["sites"]:
    compiled, profile = model_site(site, heights)
    sites.append(compiled)
    profiles.append(profile)
  extras, extra_profiles = retained_core_fittings()
  sites.extend(extras)
  profiles.extend(extra_profiles)
  old_native = next(
    s
    for s in read(DATA / "hospitalV228Native.json")["sites"]
    if s["key"] == "benjamin-franklin"
  )
  old_bounds = next(
    s
    for s in read(DATA / "hospitalV228Navigation.json")["sites"]
    if s["key"] == "benjamin-franklin"
  )["bounds"]
  for x, _, z, w, _, d, *_ in old_native["blocks"]:
    old_bounds = [
      min(old_bounds[0], x - w / 2),
      min(old_bounds[1], z - d / 2),
      max(old_bounds[2], x + w / 2),
      max(old_bounds[3], z + d / 2),
    ]
  write(CORE, dict(schemaVersion=1, sites=sites))
  write(
    PROFILE,
    dict(
      schemaVersion=1,
      sites=profiles,
      oldCBFOverrideBounds=old_bounds,
      sourceSha256=sha(SOURCE),
      heightEvidenceSha256=sha(HEIGHTS),
    ),
  )
  reference_evidence(source)
  print(
    dict(
      coreBytes=CORE.stat().st_size,
      coreGzipBytes=len(gzip.compress(CORE.read_bytes(), mtime=0)),
      profileBytes=PROFILE.stat().st_size,
      profileGzipBytes=len(gzip.compress(PROFILE.read_bytes(), mtime=0)),
      sites=[(s["key"], s["counts"]) for s in sites],
    )
  )


def reference_evidence(source: dict) -> None:
  """Keep photographic checks and the explicit-material negative audit finite."""
  ids = {r["sourceId"] for s in source["sites"] for r in s["oldOwners"]}
  ids.update(p["id"] for s in source["sites"] for b in s["parents"] for p in b["parts"])
  ids.update(
    p["owner"].replace("way/", "OSM-way-").replace("relation/", "OSM-relation-")
    for s in source["sites"]
    for p in s["previousProfiles"]["parts"]
  )
  audits = []
  for name in [
    "outer-materials-v232-evidence.json.gz",
    "outer-materials-v254-evidence.json.gz",
    "outer-materials-v263-evidence.json.gz",
  ]:
    path = GEO / name
    hit = {
      owner: record for owner, record in read(path)["owners"].items() if owner in ids
    }
    assert not hit, (
      "An explicit earlier hospital material must be inherited, never overwritten"
    )
    audits.append(
      dict(path=str(path.relative_to(ROOT)), sha256=sha(path), exactOwnerHits=hit)
    )
  references = [
    dict(
      url="https://www.vivantes.de/gesundheitsnetzwerk/krankenhaeuser/klinikum-im-friedrichshain/",
      credit="Vivantes, hospital operator",
      use="Resolves Vivantes to the previously represented Landsberger Allee 49 campus; no unsurveyed additional hospital campus is claimed.",
    ),
    dict(
      url="https://www.vivantes.de/fileadmin/vivantes/Content/Krankenhaeuser/Klinikum-Friedrichshain/PDFs/260709_Plakat-KFH-Lageplan-A3_ND.pdf",
      credit="Vivantes, July 2026 campus plan",
      use="Current finite campus identity and modern connected ward blocks.",
    ),
    dict(
      url="https://www.kossmann-maslo-architekten.de/400-3.html",
      credit="Kossmann + Maslo Architekten",
      image="vivantes-kmf-1531751160.jpg",
      use="Inspected finished exterior: six storeys, grey/brown horizontal facade bands, white paired/asymmetric window frames, recessed upper loggia and thin dark rail; fine dimensions remain display estimates.",
    ),
    dict(
      url="https://www.gse-berlin.de/referenzen/bautechnische-pruefung/vivantesklinikumimfriedrichshain/",
      credit="GSE Ingenieur-Gesellschaft",
      image="vivantes-new.jpg",
      use="Two six-storey wings with connecting magistrale. The saved image is an architectural model photograph, not a current completed-building photograph.",
    ),
    dict(
      url="https://www.dbv-ingenieure.de/referenzen/bundeswehrkrankenhaus-berlin-hauptgebaeude/",
      credit="DBV Ingenieure, 2014–2020 main-building project",
      image="bundeswehr-main.jpg",
      use="Six real storeys, pale cladding, broad dark window ribbons; replace only the exact old CNY wall fittings after the v215 correction. All pavilion courses, pad markings and helicopter remain.",
    ),
    dict(
      url="https://schweger-architects.com/projects/fassadengestaltung-charite-berlin/",
      credit="Schweger Architekten, 2015–2016 facade project",
      image="charite-cube.jpg",
      use="Metallic vertical joints and cladding; treatment zone EG–4OG and ward tower above. The saved image shows the tower in context, not an invented close-up of the treatment roof. Existing v207 tower articulation is retained.",
    ),
    dict(
      url="https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/charite-campus-benjamin-franklin-641031.php",
      credit="Landesdenkmalamt Berlin; historical facade photograph by Mila Hacke",
      image="cbf-screen.jpg",
      use="Historical structural concrete/glass rhythm and layered hospital form; historical full screen panels are not asserted as an intact 2026 facade.",
    ),
    dict(
      url="https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2026/ein-stueck-klinikum-benjamin-franklin-fuer-zuhause-1690942.php",
      credit="Landesdenkmalamt Berlin, 27 August 2026",
      use="Documents concrete-screen removal; no completed restored 2026 screen is invented.",
    ),
    dict(
      url="https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1673652.php",
      credit="Bezirksamt Steglitz-Zehlendorf, 2026",
      use="Restoration intent is distinct from completed facade state.",
    ),
    dict(
      url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
      credit="Geoportal Berlin, DOP 2025 spring",
      image="friedrichshain-dop2025.png",
      use="Inspected complete campus roofs: grey flat modern roofs and distinct red pitched historic pavilions; open landscaped courts and the north helipad are retained.",
    ),
  ]
  for ref in references:
    ref["checked"] = "2026-11-02"
    if ref.get("image"):
      ref["imageSha256"] = sha(RAW / ref["image"])
      ref["image"] = "Ignored offline reference only: " + ref["image"]
  previous_ids = {
    p["owner"] for s in source["sites"] for p in s["previousProfiles"]["parts"]
  }
  district_path = GEO / "district-facades-v188-evidence.json.gz"
  district_hits = [f for f in read(district_path)["faces"] if f["owner"] in ids]
  assert not district_hits
  write(
    GEO / "hospitals-v308-reference-evidence.json",
    dict(
      schemaVersion=1,
      references=references,
      materialAudit=dict(
        exactOwnerIds=sorted(ids),
        predecessorDisplayOwners=sorted(previous_ids),
        sources=audits,
        policy="No positive exact earlier wall/roof material receipt matches any complete hospital parent, leaf or replaced mapped upper owner. Reference-guided new display estimates do not override an observation.",
      ),
      district188Audit=dict(
        path=str(district_path.relative_to(ROOT)),
        sha256=sha(district_path),
        exactOwnerHits=district_hits,
      ),
      preserved=[
        "Charité v207 tower",
        "Charité historical campus",
        "Charité bridges",
        "BWK eleven other parts and all pavilions",
        "BWK pad and helicopter",
        "all previous source sheets and raw tiles",
        "all source XZ and courtyard holes",
        "all unrelated packet triangles and navigation",
        "all full drawn touch detail",
        "all six modes and 93 stops",
      ],
      policy="No downloaded photo pixels, textures, logos, signs or speculative tenant changes enter the product. Small reference-guided subdivisions and colours are explicitly estimated; measured source geometry and the finite measured CBF correction control the envelope.",
    ),
  )


def packet_plans() -> None:
  """Retire exact baseline predecessor bodies/ink/nav, never their neighbours."""
  import build_surrounding_outlines as exporter
  from build_rixdorf_v304 import fingerprint, prepared_packets

  out = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  source = read(SOURCE)
  old = [r for site in source["sites"] for r in site["oldOwners"]]
  selected = [
    d
    for d in read(out / "manifest.json")["chunks"]
    if not d.get("detailCompanionOf")
    and any(
      shape(r["geometry"]).intersection(box(*d["bounds"])).area > 1e-6 for r in old
    )
  ]
  assert len(selected) == 4
  paths = [out / d[mode]["url"] for d in selected for mode in ["drawn", "minecraft"]]
  prepared_all = prepared_packets(paths)
  packets, audit = {}, []

  def triangles(mesh: dict) -> list:
    p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    return [tuple(sorted(tuple(map(int, v)) for v in p[t])) for t in ix]

  def records(packet: dict) -> list:
    return [
      dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
      for i, m in enumerate(packet["meshes"])
    ]

  for desc in selected:
    for mode in ["drawn", "minecraft"]:
      native = mode == "minecraft"
      path = out / desc[mode]["url"]
      raw, pred = read(path), prepared_all[str(path)]
      prepared = pred["prepared"]
      write(RAW / f"{desc['id']}.{mode}.prepared.json.gz", prepared)
      key = mode + ":" + desc["id"]
      ox, _, oz = raw["origin"]
      tile = box(ox, oz, ox + 512, oz + 512)
      wanted, wanted_lines = Counter(), Counter()
      line_offsets = defaultdict(set)
      known_offsets = {
        round(n.get("groundOffset", 0) * 100) for n in raw["nav"]["buildings"]
      }
      owners = []
      for owner in old:
        full = shape(owner["geometry"])
        g = exporter.polygonal(full.intersection(tile))
        if native:
          g = exporter.native_polygon(g).intersection(tile)
        if g.is_empty:
          continue
        owners.append(owner["sourceId"])
        offset = owner["groundOffset"]
        low, high = (
          3 + owner["minHeight"] + offset,
          3 + max(owner["height"], owner["minHeight"] + 1),
        )
        if native:
          high = 3 + max(2, round((high - 3) / 2) * 2)
        high += offset
        outline = (
          shapely.orient_polygons(g, exterior_cw=True).boundary
          if native
          else shapely.orient_polygons(full, exterior_cw=True).boundary.intersection(
            tile
          )
        )
        mesh = exporter.PackedMesh(ox, oz)
        mesh.building(g, low, high, outline)
        wanted.update(triangles(mesh.payload("city")))
        for line in (
          ()
          if native
          else exporter.line_parts(g.boundary.difference(tile.boundary.buffer(0.02)))
        ):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            value = tuple(
              sorted(
                (
                  tuple(
                    round(v * 100) for v in [a[0] - ox, high + 0.02 + 10, a[1] - oz]
                  ),
                  tuple(
                    round(v * 100) for v in [b[0] - ox, high + 0.02 + 10, b[1] - oz]
                  ),
                )
              )
            )
            wanted_lines[value] += 1
            line_offsets[value].add(round(offset * 100))
      retire = []
      for mi, mesh in enumerate(prepared["meshes"]):
        if mesh["kind"] != "city":
          continue
        rows = []
        for i, triangle in enumerate(triangles(mesh)):
          if wanted[triangle] > 0:
            rows.append(i)
            wanted[triangle] -= 1
        if rows:
          retire.append(dict(mesh=mi, triangles=rows))
      shifted_faces = []
      if sum(wanted.values()):
        # v182 placed shared boundary faces through the first buffered owner.
        # A finite face can consequently have an adjacent owner's retained
        # terrain offset. Match its complete XZ/relative-Y topology, require a
        # single remaining actual occurrence and a known original nav offset.
        used = {(r["mesh"], i) for r in retire for i in r["triangles"]}
        known_offsets = {
          round(n.get("groundOffset", 0) * 100) for n in raw["nav"]["buildings"]
        }

        def relative(triangle: tuple) -> tuple:
          bottom = min(v[1] for v in triangle)
          return tuple(sorted((x, y - bottom, z) for x, y, z in triangle))

        remaining = defaultdict(list)
        for mi, mesh in enumerate(prepared["meshes"]):
          if mesh["kind"] == "city":
            for i, triangle in enumerate(triangles(mesh)):
              if (mi, i) not in used:
                remaining[relative(triangle)].append((mi, i, triangle))
        for triangle, count in (+wanted).items():
          if len({v[1] for v in triangle}) < 2:
            raise ValueError(f"{key}: unmatched source roof may not be inferred")
          choices = []
          for mi, i, actual in remaining[relative(triangle)]:
            original_low = min(v[1] for v in actual) - 1300
            if original_low in known_offsets:
              choices.append((mi, i, actual))
          if len(choices) != count:
            raise ValueError(f"{key}: ambiguous/missing actual relocated source wall")
          for mi, i, actual in choices:
            row = next((r for r in retire if r["mesh"] == mi), None)
            if row is None:
              row = dict(mesh=mi, triangles=[])
              retire.append(row)
            row["triangles"].append(i)
            shifted_faces.append(
              dict(
                mesh=mi,
                triangle=i,
                requestedTopology=triangle,
                actualTopology=actual,
                actualGroundOffsetM=(min(v[1] for v in actual) - 1300) / 100,
              )
            )
          wanted[triangle] = 0
      for row in retire:
        row["triangles"].sort()
      retire_lines = []
      shifted_lines = []
      if prepared.get("lines"):
        positions = np.frombuffer(
          base64.b64decode(prepared["lines"]["positions"]), "<u2"
        ).reshape(-1, 2, 3)
        for i, segment in enumerate(positions):
          value = tuple(sorted(tuple(map(int, v)) for v in segment))
          if wanted_lines[value] > 0:
            retire_lines.append(i)
            wanted_lines[value] -= 1
      if sum(wanted_lines.values()):
        remaining_lines = defaultdict(list)
        for i, segment in enumerate(positions):
          if i not in retire_lines:
            value = tuple(sorted(tuple(map(int, v)) for v in segment))
            remaining_lines[tuple((x, z) for x, _, z in value)].append((i, value))
        for value, count in (+wanted_lines).items():
          choices = []
          for i, actual in remaining_lines[tuple((x, z) for x, _, z in value)]:
            deltas = {actual[j][1] - value[j][1] for j in range(2)}
            if len(deltas) == 1 and any(
              offset + next(iter(deltas)) in known_offsets
              for offset in line_offsets[value]
            ):
              choices.append((i, actual))
          if len(choices) != count:
            raise ValueError(
              f"{key}: ambiguous/missing relocated source roof ink {value}"
            )
          for i, actual in choices:
            retire_lines.append(i)
            shifted_lines.append(
              dict(segment=i, requestedTopology=value, actualTopology=actual)
            )
          wanted_lines[value] = 0
        retire_lines.sort()
      nav = [n for n in prepared["nav"]["buildings"] if n["sourceId"] in owners]
      if set(n["sourceId"] for n in nav) != set(owners):
        raise ValueError(f"{key}: incomplete predecessor navigation")
      packets[key] = dict(
        origin=raw["origin"],
        records=records(raw),
        navGuard=pred["navGuard"],
        lineGuard=pred["lineGuard"],
        preparedRecords=records(prepared),
        preparedNavGuard=pred["preparedNavGuard"],
        preparedLineGuard=pred["preparedLineGuard"],
        retire=retire,
        retireLines=retire_lines,
        retireNav=nav,
        appendNav=[],
        owners=owners,
      )
      write(RAW / f"{desc['id']}.{mode}.prepared.json.gz", prepared)
      audit.append(
        dict(
          key=key,
          owners=owners,
          retiredTriangles=sum(len(r["triangles"]) for r in retire),
          retiredRoofSegments=len(retire_lines),
          retiredNavigation=len(nav),
          requiredCompleteReplacement=True,
          noAppendGeometry=True,
          earlierSharedBoundaryPlacements=shifted_faces,
          earlierSharedRoofInkPlacements=shifted_lines,
        )
      )
  write(
    DATA / "hospitalArchitectureV308Packets.json",
    dict(schemaVersion=1, keys=list(packets), packets=packets),
  )
  write(
    GEO / "hospitals-v308-packet-evidence.json",
    dict(
      schemaVersion=1,
      baseline="9727870f79db9c6a6e9d6437668e5ac13229522f",
      sourceSha256=sha(SOURCE),
      packets=audit,
      policy="Whole exact source-supported predecessor bodies, roof ink and navigation only. Original raw tiles and every foreign triangle/line/owner remain unchanged. Both complete required campus models, their exact outside complements and navigation must exist before retirement. Compose overlapping v306/v307 plans offline against these identical raw/prepared pins; one atomic transaction per tile.",
    ),
  )
  print(json.dumps(audit))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--packets", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  if args.packets:
    packet_plans()
  else:
    compile_data()
