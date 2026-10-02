"""Step 10: additive, bounded Oranienstraße/Oranienburger corridor packets."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

import build_west_streets_v163 as streets
import geopandas as gpd
import numpy as np
import shapely
from build_concert_halls_v160 import normal_of
from build_karl_marx_allee_v161 import (
  Detail,
  mesh_signature,
  native_detail,
  packed_detail,
)
from build_mitte_streets_v166 import reserved_owners
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  POSITION_ORIGIN_Y,
  ROOT,
  navigation_polygons,
  tags_for,
  world,
  write_json,
)
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union

SOURCE = ROOT / "geo_data/regierungsviertel/oranien-corridors-v167.json"
AUDIT = ROOT / "geo_data/regierungsviertel/oranien-corridors-v167-audit.json"
NAMES = (
  "Oranienstraße",
  "Oranienburger Straße",
  "Mariannenstraße",
  "Mariannenplatz",
  "Skalitzer Straße",
)
KIND = "oranien-corridors-v167"
ORIGINAL_BOUNDS = streets.read_bounds
EXPLICIT_RESERVED = {
  "DEBE01YYK00007VT",
  "24054915",
  "OSM-way-24054915",
  "DEBE01YYK0000D41",
  "DEBE01YYK0000B92",
  "40754304",
  "19283679",
  "OSM-way-940754304",
  "OSM-way-419283679",
  "K0000D41",
  "K0000B92",
}
HERITAGE = {"DEBE02YY400000xk": "Bethanien", "DEBE02YY4000000T": "St.-Thomas-Kirche"}


def semantic_context(source: dict[str, Any]) -> None:
  """Retain dated OSM identities independently from authoring and dimensions."""
  polygons = gpd.read_file(
    streets.RAW / "candidate.gpkg",
    layer="multipolygons",
    bbox=(13.409, 52.498, 13.431, 52.507),
  ).to_crs(25833)
  mapped = [(row, world(row.geometry)) for _, row in polygons.iterrows()]
  for building in source["buildings"]:
    ground = footprint(building)
    candidates = [
      (ground.intersection(g).area, row, g)
      for row, g in mapped
      if tags_for(row).get("building") and g.intersects(ground)
    ]
    if candidates:
      area, row, geometry = max(candidates, key=lambda item: item[0])
      if area > 1:
        way = row.get("osm_way_id")
        identity = f"way/{way}" if isinstance(way, str) else f"relation/{row['osm_id']}"
        building["osm"] = {
          "id": identity,
          "tags": tags_for(row),
          "geometry": mapping(geometry),
        }
    if building["id"] in HERITAGE:
      building["name"] = HERITAGE[building["id"]]
  identities = {
    "17966278",
    "51688847",
    "49038362",
    "49038363",
    "441641842",
    "311559051",
  }
  source["places"] = [
    {
      "id": f"way/{row['osm_way_id']}"
      if isinstance(row.get("osm_way_id"), str)
      else f"relation/{row['osm_id']}",
      "tags": tags_for(row),
      "geometry": mapping(g),
    }
    for row, g in mapped
    if row.get("osm_way_id") in identities or row.get("osm_id") == "7921395"
  ]
  points = gpd.read_file(
    streets.RAW / "berlin-260929.osm.pbf",
    layer="points",
    where="osm_id='2464442845' OR osm_id='3875882001' OR osm_id='10002834368'",
  ).to_crs(25833)
  source["pois"] = [
    {
      "id": f"node/{row['osm_id']}",
      "tags": tags_for(row),
      "geometry": mapping(world(row.geometry)),
    }
    for _, row in points.iterrows()
  ]
  station = next(p for p in source["places"] if p["id"] == "way/311559051")
  coarse = gpd.read_file(
    streets.RAW / "resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId='OSM-way-311559051'",
  ).iloc[0]
  source["extraMovedOuterSourceIds"] = ["OSM-way-311559051"]
  source["station"] = {
    "sourceId": "OSM-way-311559051",
    "roof": station,
    "platforms": [
      p for p in source["places"] if p["id"] in {"way/49038362", "way/49038363"}
    ],
    "coarseEnvelope": {
      "geometry": mapping(coarse.geometry),
      "height": float(coarse["height"]),
      "minHeight": float(coarse["minHeight"]),
      "heightSource": coarse["heightSource"],
    },
    "displayHeights": {"platformY": 8.8, "canopyEaveY": 12.2, "canopyTopY": 16.2},
    "conflict": "OSM bridge=yes/layer3 train_station is incorrectly represented by a6m ground enclosure in v159. Retain original footprint and level-derived6m envelope as evidence; use exact OSM roof/platform polygons with explicitly estimated elevated deck/canopy heights. Open ground below is preserved; only columns have ground collision.",
  }
  source["identityNotes"] = (
    "Cafe Jenseits is retained at OSM node2464442845 [13.4230002,52.5005854], checked2025-01-20 in the2026-09-29 PBF. It is beside Rio-Reiser-Platz, not Mariannenplatz. Historical operator closure in2009 is not evidence that this later mapped café is closed; current operation is unverified. Bethanien is the distinct Kunstquartier at Mariannenplatz2. Görlitzer Bahnhof is the present U1/U3 elevated station, not the demolished mainline terminus."
  )
  source["recognitionSolids"] = [
    {
      "sourceId": "DEBE02YY400000xk",
      "id": "bethanien-north-tower",
      "center": [3564.6, 1750.1],
      "radius": 1.85,
      "sides": 8,
      "rotation": 0.414,
      "baseY": 19.8,
      "shoulderY": 29,
      "topY": 38,
      "topRadius": 0.07,
      "color": [166, 149, 104],
    },
    {
      "sourceId": "DEBE02YY400000xk",
      "id": "bethanien-south-tower",
      "center": [3559.7, 1761.35],
      "radius": 1.85,
      "sides": 8,
      "rotation": 0.414,
      "baseY": 19.8,
      "shoulderY": 29,
      "topY": 38,
      "topRadius": 0.07,
      "color": [166, 149, 104],
    },
    {
      "sourceId": "DEBE02YY4000000T",
      "id": "thomas-west-tower",
      "center": [3689.0, 1604.5],
      "radius": 4.3,
      "sides": 4,
      "rotation": 0.414 + math.pi / 4,
      "baseY": 24,
      "shoulderY": 48.8,
      "topY": 51,
      "topRadius": 0.06,
      "color": [179, 140, 95],
    },
    {
      "sourceId": "DEBE02YY4000000T",
      "id": "thomas-east-tower",
      "center": [3702.5, 1610.5],
      "radius": 4.3,
      "sides": 4,
      "rotation": 0.414 + math.pi / 4,
      "baseY": 24,
      "shoulderY": 48.8,
      "topY": 51,
      "topRadius": 0.06,
      "color": [179, 140, 95],
    },
    {
      "sourceId": "DEBE02YY4000000T",
      "id": "thomas-drum",
      "center": [3706.5, 1580.3],
      "radius": 11.2,
      "sides": 32,
      "rotation": 0.414,
      "baseY": 27,
      "shoulderY": 44.5,
      "topY": 48.5,
      "topRadius": 0.8,
      "color": [179, 140, 95],
    },
    {
      "sourceId": "DEBE02YY4000000T",
      "id": "thomas-lantern",
      "center": [3706.5, 1580.3],
      "radius": 0.8,
      "sides": 12,
      "rotation": 0.414,
      "baseY": 48.5,
      "shoulderY": 54.5,
      "topY": 59,
      "topRadius": 0.06,
      "color": [179, 140, 95],
    },
  ]
  source["sourceConflicts"] = [
    {
      "sourceId": "DEBE02YY400000xk",
      "observed": "LoD2 retained source top21.677m above family ground omits twin pointed towers.",
      "resolution": "Add two35m overall towers documented by the Kunstquartier operator, anchored to the small octagonal projections in the measured front. Intermediate heights and subcomponents are estimates; original sheets are unchanged.",
      "reference": "https://kunstquartierbethanien.wordpress.com/portfolio/geschichte/",
    },
    {
      "sourceId": "DEBE02YY4000000T",
      "observed": "LoD2 retained source top26.49m omits much of the twin towers and domed drum.",
      "resolution": "Retain exact source base and add twin48m display towers and56m drum roof. Heights agree with secondary architectural accounts and near50m Berlin tourism tower description; not a new measured survey. Primary LDA09031197 and parish describe the twin front and arcaded domed drum; footprint placement and subcomponents are explicit estimates.",
      "reference": "https://www.evkgk.de/st-thomas-kirche/st-thomas-beschreibung-des-bauwerks",
    },
  ]


def scoped_bounds() -> tuple[Any, Any]:
  """Two finite already-approved rectangles, excluding the southern Kiez."""
  bounds, core = ORIGINAL_BOUNDS()
  return bounds.intersection(
    unary_union(
      [
        box(2565, 1370, 3930, 2335),
        box(1020, -870, 2120, -420),
      ]
    )
  ), core


def footprint(building: dict[str, Any]) -> Any:
  """Complete ground coverage, including holes and independent source parts."""
  return unary_union(
    [
      Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      )
      for part in building["parts"]
      for s in part["surfaces"]
      if s["kind"] == "GroundSurface"
    ]
  )


def core_footprint(record: dict[str, Any]) -> Any:
  """Retained centimetre-frame core polygon for additive ornament selection."""
  return Polygon([(x / 10, z / 10) for x, z in record["ring"]])


def extract() -> dict[str, Any]:
  """Keep complete source families; never re-own a prior detailed building."""
  streets.read_bounds = scoped_bounds
  source = streets.extract_source(NAMES)
  for road in source["roads"]:
    if road["name"] == "Mariannenstraße":
      road["geometry"] = mapping(
        shape(road["geometry"]).intersection(box(3400, 1370, 3930, 2160))
      )
    elif road["name"] == "Skalitzer Straße":
      road["geometry"] = mapping(
        shape(road["geometry"]).intersection(box(3660, 2210, 3890, 2320))
      )
  source["roads"] = [r for r in source["roads"] if not shape(r["geometry"]).is_empty]
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  zone = roads.buffer(43)
  previous = json.loads(
    (ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json").read_text()
  )
  try:
    reserved = reserved_owners() | EXPLICIT_RESERVED
  except subprocess.CalledProcessError:
    # Independent generation may run while the shared world imports a new
    # hero module that its owner has not yet written. Root authorised using
    # this complete released ownership record plus the explicit v167 owners.
    reserved = (
      set(previous["excludedDetailedOwners"])
      | {b["id"] for b in previous["buildings"]}
      | EXPLICIT_RESERVED
    )
    manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
    for descriptor in manifest["chunks"]:
      packet = json.loads(
        gzip.decompress((DEFAULT_OUTPUT / descriptor["drawn"]["url"]).read_bytes())
      )
      reserved.update(
        n["sourceId"] for n in packet["nav"]["buildings"] if n.get("partId")
      )
  prior_core = {p["id"] for p in previous["corePrisms"]}
  source["buildings"] = [
    b
    for b in source["buildings"]
    if b["id"] not in reserved and footprint(b).intersects(zone)
  ]
  source["corePrisms"] = [
    p
    for p in source["corePrisms"]
    if p["id"] not in reserved | prior_core and core_footprint(p).intersects(zone)
  ]
  oranienburger = unary_union(
    [
      shape(r["geometry"])
      for r in source["roads"]
      if r["name"] == "Oranienburger Straße"
    ]
  )
  # Existing v166 panes, sills, streets and measured shells remain immutable.
  # Only new shallow lintel/pier detail is added to these exact source walls.
  source["retainedDetailedBuildings"] = [
    b
    for b in previous["buildings"]
    if footprint(b).intersects(oranienburger.buffer(43))
    and b["id"] not in EXPLICIT_RESERVED
  ]
  source["retainedDetailedCorePrisms"] = [
    p
    for p in previous["corePrisms"]
    if core_footprint(p).intersects(oranienburger.buffer(43))
    and p["id"] not in EXPLICIT_RESERVED
  ]
  source["excludedDetailedOwners"] = sorted(reserved | prior_core)
  source["selection"] = (
    "Oranienstraße from Moritzplatz to Görlitzer Bahnhof and north Mariannenstraße/Mariannenplatz spurs; complete Oranienburger Straße. World rectangles [2565,1370,3930,2335] and [1020,-870,2120,-420], clipped to current release bounds. Mariannenstraße stops at z=2160 beside Rio-Reiser-Platz. No bounds revision."
  )
  source["publication"] = (
    "Candidate packets preserve every previous mesh. Central publication subtracts only the listed newly owned coarse source parents, then appends this mesh and full part navigation. Existing v166 Oranienburger shells, facade detail, curbs and nav are preserved; shallow extra detail adds no replacement owner."
  )
  source["references"] = [
    "https://www.berlin.de/ba-friedrichshain-kreuzberg/aktuelles/pressemitteilungen/2022/pressemitteilung.1231834.php",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046160",
    "https://www.bvg.de/de/verbindungen/stationsuebersicht/u-goerlitzer-bahnhof",
  ]
  source["displayEstimates"] = (
    "Window and shopfront bay spacing, shallow lintels/pier strips, masonry bands, untagged pavement width and curb profile are procedural display estimates. Exact source surfaces, heights and courts remain unchanged. No photograph pixels or sampled colour are bundled."
  )
  semantic_context(source)
  return source


def ornament(
  detail: Detail, rings: list, roads: Any, ground: float, top: float
) -> None:
  """New shallow heads/piers occupy gaps around, not over, retained windows."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.05:
    return
  center = np.mean(np.array(rings[0]), axis=0)
  nearest = nearest_points(Point(center[0], center[2]), roads)[1]
  vx, vz = nearest.x - center[0], nearest.y - center[2]
  if math.hypot(vx, vz) > 48 or vx * normal[0] + vz * normal[2] < 0.1:
    return
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
  )
  dx, dz = b[0] - a[0], b[2] - a[2]
  length = math.hypot(dx, dz)
  if length < 2.4:
    return
  dx, dz = dx / length, dz / length
  planar = [
    [[(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]] for p in ring] for ring in rings
  ]
  poly = shapely.make_valid(Polygon(planar[0], planar[1:])).buffer(-0.04)
  if poly.is_empty:
    return
  u0, _, u1, y1 = poly.bounds
  bays = max(1, round(length / 3.4))
  pitch = length / bays

  def plaque(
    u: float, y: float, width: float, height: float, color: tuple, role: str
  ) -> None:
    panel = box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
    if not poly.covers(panel):
      return
    detail.polygon(
      [
        [a[0] + dx * v + normal[0] * 0.17, h, a[2] + dz * v + normal[2] * 0.17]
        for v, h in list(panel.exterior.coords)[:-1]
      ],
      color,
      role,
    )

  for y in np.arange(ground + 5.95, min(top, y1) - 0.9, 3.25):
    for i in range(bays):
      u = u0 + (i + 0.5) * pitch
      plaque(u, y + 1.16, 1.88, 0.16, (225, 216, 193), "lintel cap")
      plaque(u, y - 1.32, 1.28, 0.28, (190, 183, 169), "spandrel inset")
  for i in range(1, bays):
    u = u0 + i * pitch
    plaque(u, ground + 1.8, 0.20, 3.25, (194, 188, 171), "shopfront pier")
  for u in np.arange(u0 + 0.5, u1 - 0.5, 0.7):
    plaque(u, min(top, y1) - 0.65, 0.23, 0.29, (180, 174, 157), "cornice dentil")


def building_ornament(building: dict, roads: Any) -> Detail:
  """Source-bound extra ornament only; no complete duplicate wall shell."""
  result = Detail()
  for part in building["parts"]:
    points = [p for s in part["surfaces"] for ring in s["rings"] for p in ring]
    top = max((p[1] for p in points), default=3)
    for surface in part["surfaces"]:
      if surface["kind"] == "WallSurface":
        ornament(result, surface["rings"], roads, 3, top)
  return result


def core_ornament(record: dict, roads: Any) -> Detail:
  """Same extra detail on unchanged prior core planes."""
  result = Detail()
  poly = shapely.orient_polygons(core_footprint(record), exterior_cw=True)
  low, top = record["y0_dm"] / 10, (record["y0_dm"] + record["h_dm"]) / 10
  for (ax, az), (bx, bz) in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
    ornament(
      result,
      [[(ax, low, az), (bx, low, bz), (bx, top, bz), (ax, top, az)]],
      roads,
      low,
      top,
    )
  return result


def arch_panel(
  detail: Detail,
  a: list,
  b: list,
  y: float,
  width: float,
  height: float,
  color: tuple,
  out: float = 0.06,
) -> None:
  """A bounded round arch in a source-aligned wall; proportions are estimates."""
  ax, az = a
  bx, bz = b
  length = math.hypot(bx - ax, bz - az)
  if length < width + 0.2:
    return
  dx, dz = (bx - ax) / length, (bz - az) / length
  nx, nz = dz, -dx
  cx, cz = (ax + bx) / 2 + nx * out, (az + bz) / 2 + nz * out
  radius = width / 2
  spring = y + height - radius
  points = [[-radius, y], [radius, y]] + [
    [radius * math.cos(t), spring + radius * math.sin(t)]
    for t in np.linspace(0, math.pi, 13)
  ]
  detail.polygon(
    [[cx + dx * u, h, cz + dz * u] for u, h in points], color, "arched window reveal"
  )


def heritage_detail(building: dict, roads: Any) -> tuple[Detail, list]:
  """Keep every original sheet while matching brick and round-arch character."""
  basic, nav = streets.outer_detail(building, roads)
  detail = Detail()
  brick = (166, 149, 104) if building["id"].endswith("00xk") else (179, 140, 95)
  for triangle, _, role in basic.triangles:
    if role.startswith("source "):
      detail.triangles.append(
        (triangle, brick if role == "source WallSurface" else (109, 112, 101), role)
      )
  for part in building["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      rings = surface["rings"]
      n = normal_of(rings[0])
      if abs(n[1]) > 0.05:
        continue
      a, b = max(
        ((a, b) for a in rings[0] for b in rings[0]),
        key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
      )
      dx, dz = b[0] - a[0], b[2] - a[2]
      length = math.hypot(dx, dz)
      if length < 3:
        continue
      dx, dz = dx / length, dz / length
      # Align a->b so arch_panel's outward normal matches the original sheet.
      if dz * n[0] - dx * n[2] < 0:
        a, b = b, a
        dx, dz = -dx, -dz
      planar = [
        [[(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]] for p in r] for r in rings
      ]
      poly = shapely.make_valid(Polygon(planar[0], planar[1:])).buffer(-0.08)
      if poly.is_empty:
        continue
      u0, y0, u1, y1 = poly.bounds
      pitch = 3.8 if building["id"].endswith("00xk") else 5
      for y in np.arange(max(5, y0 + 1), y1 - 3, 5.1):
        for u in np.arange(u0 + pitch / 2, u1 - pitch / 3, pitch):
          if not poly.covers(box(u - 0.85, y, u + 0.85, y + 3)):
            continue
          aa = [a[0] + dx * (u - 1.05), a[2] + dz * (u - 1.05)]
          bb = [a[0] + dx * (u + 1.05), a[2] + dz * (u + 1.05)]
          arch_panel(detail, aa, bb, y, 1.7, 3, (208, 190, 146), 0.04)
          arch_panel(detail, aa, bb, y + 0.13, 1.4, 2.70, (65, 78, 77), 0.07)
  return detail, nav


def recognition_detail(source: dict) -> tuple[Detail, list[dict]]:
  """Separate documented tower/drum solids with matching navigation envelopes."""
  detail, nav = Detail(), []
  for solid in source["recognitionSolids"]:
    x, z = solid["center"]
    angles = np.arange(solid["sides"]) * math.tau / solid["sides"] + solid["rotation"]
    ring = [
      [x + solid["radius"] * math.cos(a), z + solid["radius"] * math.sin(a)]
      for a in angles
    ]
    low, shoulder, top = solid["baseY"], solid["shoulderY"], solid["topY"]
    color = tuple(solid["color"])
    for i, (a, b) in enumerate(zip(ring, ring[1:] + ring[:1])):
      ax, az = a
      bx, bz = b
      detail.polygon(
        [[ax, low, az], [bx, low, bz], [bx, shoulder, bz], [ax, shoulder, az]],
        color,
        "estimated heritage tower wall",
      )
      at = [
        x + (ax - x) * solid["topRadius"] / solid["radius"],
        top,
        z + (az - z) * solid["topRadius"] / solid["radius"],
      ]
      bt = [
        x + (bx - x) * solid["topRadius"] / solid["radius"],
        top,
        z + (bz - z) * solid["topRadius"] / solid["radius"],
      ]
      detail.polygon(
        [[ax, shoulder, az], [bx, shoulder, bz], bt, at],
        (91, 108, 102),
        "estimated heritage crown",
      )
      if "lantern" not in solid["id"]:
        face = math.dist(a, b)
        arch_panel(
          detail, a, b, shoulder - 5, min(1.0, face * 0.65), 3.8, (48, 56, 52), 0.06
        )
        if "drum" in solid["id"] and i % 2 == 0:
          arch_panel(
            detail, a, b, low + 2, min(1.7, face * 0.75), 8, (56, 69, 69), 0.07
          )
      for band_y in [shoulder - 0.7, shoulder - 5.5]:
        radial = 1.025
        detail.polygon(
          [
            [x + (ax - x) * radial, band_y, z + (az - z) * radial],
            [x + (bx - x) * radial, band_y, z + (bz - z) * radial],
            [x + (bx - x) * radial, band_y + 0.2, z + (bz - z) * radial],
            [x + (ax - x) * radial, band_y + 0.2, z + (az - z) * radial],
          ],
          (212, 184, 133),
          "heritage tower stringcourse",
        )
    nav.append(
      {
        "sourceId": solid["sourceId"],
        "partId": "display:" + solid["id"],
        "geometry": Polygon(ring),
        "height": top - 3,
        "minHeight": low - 3,
        "heightSource": "documented height / explicit procedural recognition estimate",
      }
    )
  return detail, nav


def station_detail(station: dict) -> tuple[Detail, list[dict]]:
  """Mapped elevated canopy and platforms, with genuinely open space below."""
  roof = shape(station["roof"]["geometry"])
  rectangle = list(roof.minimum_rotated_rectangle.exterior.coords)
  a, b = max(zip(rectangle, rectangle[1:]), key=lambda pair: math.dist(*pair))
  length = math.dist(a, b)
  dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  nx, nz = -dz, dx
  local = affine_transform(roof, [dx, dz, nx, nz, 0, 0])
  u0, v0, u1, v1 = local.bounds
  middle, radius = (v0 + v1) / 2, (v1 - v0) / 2
  heights = station["displayHeights"]

  def xyz(u: float, v: float, y: float) -> list[float]:
    return [dx * u + nx * v, y, dz * u + nz * v]

  def crown(v: float) -> float:
    return heights["canopyEaveY"] + (
      heights["canopyTopY"] - heights["canopyEaveY"]
    ) * math.sqrt(max(0, 1 - ((v - middle) / radius) ** 2))

  result, nav = Detail(), []
  # Split the full exact OSM roof outline into strips before triangulating;
  # no rectangular substitute erases its mapped end cuts.
  for va, vb in zip(np.linspace(v0, v1, 17), np.linspace(v0, v1, 17)[1:]):
    strip = shapely.make_valid(local.intersection(box(u0 - 1, va, u1 + 1, vb)))
    for triangle in shapely.constrained_delaunay_triangles(strip).geoms:
      result.polygon(
        [xyz(u, v, crown(v)) for u, v in list(triangle.exterior.coords)[:3]],
        (101, 129, 111),
        "estimated elevated canopy on OSM roof",
      )
  nav.append(
    {
      "sourceId": station["sourceId"],
      "partId": "display:elevated-canopy",
      "geometry": roof,
      "height": heights["canopyTopY"] - 3,
      "minHeight": heights["canopyEaveY"] - 3,
      "heightSource": "OSM footprint, explicit estimated elevated canopy height",
    }
  )
  for index, platform in enumerate(station["platforms"]):
    polygon = shape(platform["geometry"])
    result.triangles.extend(
      streets.surface_detail(
        polygon, heights["platformY"], (171, 174, 162), "mapped elevated platform"
      ).triangles
    )
    nav.append(
      {
        "sourceId": station["sourceId"],
        "partId": f"display:platform-{index}",
        "geometry": polygon,
        "height": heights["platformY"] - 3,
        "minHeight": heights["platformY"] - 3.3,
        "heightSource": "OSM platform, explicit estimated deck height",
      }
    )
    for ring in getattr(polygon, "geoms", [polygon]):
      for (ax, az), (bx, bz) in zip(
        ring.exterior.coords, list(ring.exterior.coords)[1:]
      ):
        result.polygon(
          [
            [ax, heights["platformY"] - 0.25, az],
            [bx, heights["platformY"] - 0.25, bz],
            [bx, heights["platformY"], bz],
            [ax, heights["platformY"], az],
          ],
          (86, 102, 94),
          "steel platform edge",
        )
    local_platform = affine_transform(polygon, [dx, dz, nx, nz, 0, 0])
    low, _, high, _ = local_platform.bounds
    for j, u in enumerate(np.arange(low + 8, high - 3, 14)):
      cut = local_platform.intersection(box(u - 0.02, -10000, u + 0.02, 10000))
      if cut.is_empty:
        continue
      center = cut.representative_point()
      x, _, z = xyz(center.x, center.y, 3)
      height = heights["platformY"] - 3
      result.box(
        [x, 3 + height / 2, z],
        [0.45, height, 0.45],
        (76, 104, 90),
        "estimated elevated station column",
      )
      nav.append(
        {
          "sourceId": station["sourceId"],
          "partId": f"display:column-{index}-{j}",
          "geometry": box(x - 0.225, z - 0.225, x + 0.225, z + 0.225),
          "height": height,
          "minHeight": 0,
          "heightSource": "explicit procedural support estimate",
        }
      )
  return result, nav


def tacheles_removal(output: Path) -> None:
  """Exact old Tacheles/synagogue facades; root subtracts these multisets."""
  previous = json.loads(
    (ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json").read_text()
  )
  roads = unary_union([shape(r["geometry"]) for r in previous["roads"]])
  details = {"drawn": Detail(), "minecraft": Detail()}
  identities = {"40754304", "19283679", "24054915"}
  found = set()
  for record in previous["corePrisms"]:
    if record["id"] not in identities:
      continue
    found.add(record["id"])
    d = streets.core_detail(record, roads)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
  assert found == identities
  chunks = []
  parts = {mode: streets.partition_detail(d) for mode, d in details.items()}
  for ix, iz in sorted(set(parts["drawn"]) | set(parts["minecraft"])):
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    chunks.append(
      {
        "id": f"{ix}_{iz}",
        "modes": {
          mode: packed_detail(parts[mode].get((ix, iz), Detail()), tile)
          for mode in parts
        },
      }
    )
  write_json(
    output / "tacheles-v166-facade-removal.json",
    {
      "sourceMeshKind": "mitte-street-fronts-v166",
      "corePrismIds": sorted(identities),
      "policy": "Exact triangle/color multisets only. Keep all other v166 detail, roads, navigation and source records.",
      "chunks": chunks,
    },
  )


def digest(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def publish(output: Path, source: dict) -> dict:
  """Append bounded details without rebuilding or writing any published packet."""
  streets.read_bounds = scoped_bounds
  output.mkdir(parents=True, exist_ok=True)
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  owners = {b["id"] for b in source["buildings"]} | set(
    source["extraMovedOuterSourceIds"]
  )
  buildings = gpd.read_file(
    streets.RAW / "resolved-outlines.gpkg", layer="buildings"
  ).to_dict("records")
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      streets.RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  details = {"drawn": Detail(), "minecraft": Detail()}
  navigation, roles = [], Counter()
  for building in source["buildings"]:
    if building["id"] in HERITAGE:
      d, nav = heritage_detail(building, roads)
      extra, extra_nav = recognition_detail(
        {
          "recognitionSolids": [
            s for s in source["recognitionSolids"] if s["sourceId"] == building["id"]
          ]
        }
      )
      d.triangles.extend(extra.triangles)
      nav.extend(extra_nav)
    else:
      d, nav = streets.outer_detail(building, roads)
      d.triangles.extend(building_ornament(building, roads).triangles)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
    navigation.extend(nav)
    roles.update(role for _, _, role in d.triangles)
  for record in source["corePrisms"]:
    d = streets.core_detail(record, roads)
    d.triangles.extend(core_ornament(record, roads).triangles)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
    roles.update(role for _, _, role in d.triangles)
  for building in source["retainedDetailedBuildings"]:
    d = building_ornament(building, roads)
    details["drawn"].triangles.extend(d.triangles)
    roles.update(role for _, _, role in d.triangles)
  for record in source["retainedDetailedCorePrisms"]:
    d = core_ornament(record, roads)
    details["drawn"].triangles.extend(d.triangles)
    roles.update(role for _, _, role in d.triangles)
  station, station_nav = station_detail(source["station"])
  details["drawn"].triangles.extend(station.triangles)
  details["minecraft"].triangles.extend(native_detail(station).triangles)
  roles.update(role for _, _, role in station.triangles)
  navigation.extend(station_nav)
  new_streets = {
    **source,
    "roads": [r for r in source["roads"] if r["name"] != "Oranienburger Straße"],
  }
  metrics = {}
  for mode in details:
    d, metrics[mode] = streets.street_detail(
      new_streets, surfaces, buildings, mode == "minecraft"
    )
    details[mode].triangles.extend(d.triangles)
  print(
    {
      "parents": len(owners),
      "corePrisms": len(source["corePrisms"]),
      "triangles": {m: len(d.triangles) for m, d in details.items()},
    },
    flush=True,
  )
  partitions = {m: streets.partition_detail(d) for m, d in details.items()}
  descriptors = {
    d["id"]: d
    for d in json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())["chunks"]
  }
  patches, audits, preservation = [], [], {}
  for ix, iz in sorted(set(partitions["drawn"]) | set(partitions["minecraft"])):
    identity = f"{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    entry = {"id": identity, "bounds": list(tile.bounds)}
    before = {}
    audit = {"id": identity, "modes": {}}
    for mode in details:
      descriptor = descriptors.get(identity)
      path = DEFAULT_OUTPUT / descriptor[mode]["url"] if descriptor else None
      payload = (
        json.loads(gzip.decompress(path.read_bytes()))
        if path
        else {
          "schemaVersion": 1,
          "id": identity,
          "origin": [ix * 512, POSITION_ORIGIN_Y, iz * 512],
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "buildings": [],
            "roads": [],
            "bridges": [],
            "groundY": 3,
          },
        }
      )
      payload["meshes"] = [m for m in payload["meshes"] if m["kind"] != KIND]
      retained = mesh_signature(payload)
      before[mode] = {
        "meshes": digest(payload["meshes"]),
        "unownedNavigation": digest(
          {
            **payload["nav"],
            "buildings": [
              b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
            ],
          }
        ),
      }
      mesh = packed_detail(partitions[mode].get((ix, iz), Detail()), tile)
      if mesh:
        mesh["kind"] = KIND
        payload["meshes"].append(mesh)
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      for n in navigation:
        for p in navigation_polygons(
          n["geometry"].intersection(tile), *tile.bounds[:2]
        ):
          payload["nav"]["buildings"].append(
            {
              **p,
              **{k: v for k, v in n.items() if k != "geometry"},
              "height": math.ceil(n["height"] / 2) * 2 + 2
              if mode == "minecraft"
              else n["height"],
            }
          )
      assert not retained - mesh_signature(payload)
      assert before[mode]["unownedNavigation"] == digest(
        {
          **payload["nav"],
          "buildings": [
            b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
          ],
        }
      )
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      assert len(raw) < 12 * 1024 * 1024, (identity, mode, len(raw))
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      name = f"{identity}.{mode}.json.gz"
      (output / name).write_bytes(packed)
      entry[mode] = {
        "url": name,
        "encoding": "gzip",
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      audit["modes"][mode] = {
        "retainedTriangles": sum(retained.values()),
        "addedTriangles": len(base64.b64decode(mesh["indices"])) // 12 if mesh else 0,
        "bytes": len(packed),
        "decodedBytes": len(raw),
      }
    preservation[identity] = before
    patches.append(entry)
    audits.append(audit)
    print(identity, entry["drawn"]["bytes"], entry["minecraft"]["bytes"], flush=True)
  write_json(
    output / "oranien-corridors-manifest-patch.json",
    {
      "chunks": patches,
      "source": {
        "oranienCorridorsV167": {
          "version": "1.0.67",
          "sourceIds": sorted(owners),
          "sourceEvidence": str(SOURCE.relative_to(ROOT)),
          "streets": list(NAMES),
          "policy": source["publication"],
        }
      },
    },
  )
  write_json(
    ROOT / "geo_data/regierungsviertel/oranien-corridors-v167-preservation.json",
    preservation,
  )
  result = {
    "sourceParents": len(owners),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "corePrisms": len(source["corePrisms"]),
    "retainedDetailedParents": len(source["retainedDetailedBuildings"]),
    "retainedDetailedCorePrisms": len(source["retainedDetailedCorePrisms"]),
    "streetMetrics": metrics,
    "roles": dict(roles),
    "chunks": audits,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  }
  write_json(AUDIT, result)
  tacheles_removal(output)
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/v167-corridor-packets"))
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    write_json(SOURCE, extract())
  result = publish(args.out, json.loads(SOURCE.read_text()))
  print(json.dumps(result))


if __name__ == "__main__":
  main()
