"""Step 10: exact north-Alexanderplatz sources and bounded procedural facades."""

from __future__ import annotations

import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import Point, Polygon, box

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data"
GROUND = 3.0
CELL = 2.0
# These are independently inspected OSM building identities, not a broad bbox
# selection. The bounded corridor ends at Torstraße, with two named west sites.
WAYS = {
  "23723125": "Park Inn",
  "25003253": "Hofbräu Berlin, Karl-Liebknecht-Straße 30",
  "41404376": "Karl-Liebknecht-Straße east office slab",
  "48378686": "Karl-Liebknecht-Straße east office block",
  "23711084": "Ärztehaus, Weydingerstraße 18",
  "85826472": "Memhardstraße corner tower",
  "23723078": "Memhardstraße low commercial link",
  "23723074": "Pressehaus",
  "75052153": "Pressehaus northern service block",
  "75050879": "Karl-Liebknecht-Straße low annex",
  "23723071": "Memhardstraße residential slab",
  "38531389": "ADN-Gebäude",
  "101309885": "Karl-Liebknecht-Straße west slab",
  "23278760": "Karl-Liebknecht-Straße / Torstraße corner",
  "23278333": "Soho House Berlin, Torstraße 1",
  "369224563": "Karl-Liebknecht-Straße 31/33 link",
  "369224565": "Karl-Liebknecht-Straße 31/33 (former archive site)",
  "386199309": "Weydingerstraße courtyard wing",
  "979745223": "New Podium",
  "1104394722": "Karl-Liebknecht-Straße 34a",
  "305213433": "Schönhauser Tor, Torstraße 49",
  "23733609": "Alte Schönhauser Straße 46 / Monsieur Vuong",
  "1335157930": "The Berlinian / former MYND: structural shell",
}
PARK = "DEBE01ALcj000001"
TOR = "DEBE03YY600008OF"
PRESS = "DEBE01YYK00009bU"
SOHO = "DEBE03YY60000BLX"
VUONG = {"DEBE01YYK00005mk", "DEBE01YYK00005Ll"}
SOURCES = [
  "https://www.berlin.de/en/attractions-and-sights/3561782-3104052-park-inn-hotel.en.html",
  "https://cdn.parkinn-berlin.de/wp-content/uploads/2025/01/Factsheet-Summary-Jan2025_DE.pdf",
  "https://deka-sterne-berlin.de/sterne/Schoenhauser_Tor",
  "https://www.deka-immobilien.de/de/insights-news/aktuelles-aus-der-immobilienwelt-von-deka-immobilien/deka-immobilien-verkauft-schoenhauser-tor-in-berlin/",
  "https://monsieurvuong.de/",
  "https://pressehausberlin.de/",
  "https://www.bundesarchiv.de/nachricht/umzug-abgeschlossen-akteneinsicht-buergerberatung-und-bibliotheksnutzung-wieder-moeglich/",
  "https://www.berlin.de/sen/stadtentwicklung/staedtebau/berliner-mitte/alexanderplatz/",
  "https://www.unidome.de/post/april-2026-the-berlinian-mit-unidome-technologie",
]


def world_polygon(p: Polygon) -> dict[str, Any]:
  """Retain source millimetres in the established viewer coordinate frame."""

  def ring(r: Any) -> list:
    return [[round(x - 389500, 3), round(5820000 - y, 3)] for x, y in r.coords[:-1]]

  return {"ring": ring(p.exterior), "holes": [ring(h) for h in p.interiors]}


def inventory() -> tuple[list, dict, list]:
  """Join exact OSM identities to complete official parent families."""
  areas = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.406, 52.522, 13.419, 52.530),
  ).to_crs(25833)
  official = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/official-outlines.gpkg",
    bbox=(391500, 5820100, 392800, 5821200),
  )
  semantics, parents = [], {}
  for _, row in areas[areas.osm_way_id.isin(WAYS)].iterrows():
    osm_id = row.osm_way_id
    semantics.append(
      {
        "id": "way/" + osm_id,
        "name": WAYS[osm_id],
        "tags": dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags))),
        "polygons": [world_polygon(p) for p in row.geometry.geoms],
      }
    )
    if osm_id == "1335157930":
      continue
    for _, p in official[official.intersects(row.geometry)].iterrows():
      if (
        p.geometry.intersection(row.geometry).area
        / min(p.geometry.area, row.geometry.area)
        > 0.35
      ):
        # The source cache stores an incidental trailing space on some ids.
        parents.setdefault(p.sourceId.strip(), []).append("way/" + osm_id)
  assert len(semantics) == len(WAYS), "An explicitly selected OSM identity is missing"
  retained = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(2000, -1200, 3300, -100),
  )
  owners = []
  for _, row in retained.iterrows():
    if row.sourceId.strip() not in parents and row.sourceId != "OSM-way-1335157930":
      continue
    polygons = (
      [row.geometry] if row.geometry.geom_type == "Polygon" else row.geometry.geoms
    )
    owners.append(
      {
        "id": row.sourceId,
        "height": row.height,
        "minHeight": row.minHeight,
        "nativeHeight": max(2, round(row.height / 2) * 2),
        "polygons": [
          {
            "ring": list(map(list, p.exterior.coords[:-1])),
            "holes": [list(map(list, h.coords[:-1])) for h in p.interiors],
          }
          for p in polygons
        ],
      }
    )
  return semantics, parents, owners


def exact_parts(parents: dict) -> tuple[list, list]:
  """Stream each ZIP once and keep every original leaf wall and roof sheet."""
  families, parts = [], []
  for tile in ("391_5820", "391_5821", "392_5820", "392_5821"):
    path = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with archive.open(name) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            pid = element.get(GML_ID)
            if pid not in parents or any(p["id"] == pid for p in families):
              element.clear()
              continue
            raw = [part_profile(p) for p in leaf_building_parts(element) or [element]]
            offset = round(GROUND - min(p["ground_y_m"] for p in raw), 3)
            families.append(
              {
                "id": pid,
                "osmIds": parents[pid],
                "sourceParts": raw,
                "displayOffsetY": offset,
                "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
                "sourceSha256": digest,
                "created": element.findtext("core:creationDate", namespaces=NS),
              }
            )
            for original in raw:
              p = json.loads(json.dumps(original))
              p.update(parentId=pid)
              for key in ("ground_y_m", "top_y_m"):
                p[key] = round(p[key] + offset, 3)
              for surface in p["surfaces"]:
                for ring in surface["rings"]:
                  for q in ring:
                    q[1] = round(q[1] + offset, 3)
              parts.append(p)
            element.clear()
  assert {p["id"] for p in families} == set(parents)
  return families, parts


def color_for(pid: str, roof: bool) -> int:
  """Reference-informed swatches; no photograph pixels enter the model."""
  if roof:
    return 0x6E716E
  return {PARK: 0x91A7B2, TOR: 0x737C7C, PRESS: 0xD5DDDE, SOHO: 0xD8D2BC}.get(
    pid, 0xC5C4B8
  )


def facade(p: dict, surface: dict, neighbours: list) -> list:
  """Clip estimated subdivisions to exact walls and reject concealed fields."""
  rings = surface["rings"]
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.05:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 1.2:
    return []
  d /= length
  wall = Polygon(
    [[(float(np.dot(np.subtract(q, base), d)), q[1]) for q in r] for r in rings][0],
    [[(float(np.dot(np.subtract(q, base), d)), q[1]) for q in r] for r in rings[1:]],
  )
  pid, out = p["parentId"], []
  pitch_y = 3.1 if pid == PARK else 3.5 if pid == PRESS else 3.8 if pid == SOHO else 3.6
  pitch_x = 1.75 if pid == PARK else 1.6 if pid == TOR else 2.2 if pid == PRESS else 3.1
  bays = max(1, round(length / pitch_x))
  pitch_x = length / bays
  yaw = math.atan2(-d[2], d[0])

  def emit(
    u: float,
    y: float,
    w: float,
    h: float,
    c: int,
    depth: float = 0.10,
    reach: float = 0.10,
  ) -> None:
    if not wall.buffer(-0.03).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    probe = base + d * u + normal * 0.6
    if any(
      n["id"] != p["id"]
      and n["ground_y_m"] < y < n["top_y_m"]
      and shape.contains(Point(probe[0], probe[2]))
      for n, shape in neighbours
    ):
      return
    point = base + d * u + normal * reach
    out.append(
      [
        round(point[0], 3),
        round(y, 3),
        round(point[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        c,
      ]
    )

  for floor in range(42):
    y = GROUND + 2.3 + floor * pitch_y
    for bay in range(bays):
      u = (bay + 0.5) * pitch_x
      glazed = (
        pid == PARK or (pid == TOR and y > 23) or (pid == PRESS and p["top_y_m"] < 23)
      )
      w = pitch_x * (0.90 if glazed else 0.76 if pid == TOR else 0.65)
      h = pitch_y * (0.89 if glazed else 0.60)
      c = [0x68828E, 0x7C96A1, 0x536D7B][(floor + bay) % 3] if glazed else 0x50676C
      emit(u, y, w, h, c)
      emit(
        u - w / 2 - 0.05,
        y,
        0.10,
        h + 0.08,
        0xC1CBCE if glazed else 0xE0DED1,
        0.13,
        0.15,
      )
      if pid == TOR and y < 23:
        emit(u, y - h / 2 - 0.24, pitch_x - 0.08, 0.38, 0x414C50, 0.13, 0.15)
      elif pid == PRESS:
        emit(u + pitch_x * 0.40, y, 0.22, h + 0.7, 0xE5E7DE, 0.26, 0.22)
      elif pid != PARK:
        emit(u, y - h / 2 - 0.10, w + 0.20, 0.13, 0xDEDDD2, 0.20, 0.18)
  return out


def native_skin(surfaces: list, boxes: list) -> tuple[list, list, int]:
  """Vectorized sampling, then exact run merging; never solid hidden infill."""
  cells: dict = {}
  for surface in surfaces:
    for triangle in surface["triangles"]:
      a, b, c = map(np.array, triangle)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.9
        ),
      )
      ii, jj = np.triu_indices(n + 1)
      # 0 <= i <= j <= n forms a complete triangular barycentric lattice.
      qs = a + (b - a) * ii[:, None] / n + (c - a) * (jj - ii)[:, None] / n
      keys = np.unique(np.floor((qs - [0, GROUND, 0]) / CELL).astype(int), axis=0)
      for x, y, z in keys:
        key = (int(x), int(y), int(z))
        if surface["kind"] == "RoofSurface" or key not in cells:
          cells[key] = surface["color"]
  for x, y, z, w, h, _, yaw, color in boxes:
    if color not in (0x68828E, 0x7C96A1, 0x536D7B, 0x50676C):
      continue
    for u in np.arange(-w / 2, w / 2, 0.8):
      for v in np.arange(-h / 2, h / 2, 0.8):
        k = (
          math.floor((x + math.cos(yaw) * u) / CELL),
          math.floor((y + v - GROUND) / CELL),
          math.floor((z - math.sin(yaw) * u) / CELL),
        )
        if k in cells:
          cells[k] = color
  roofs: dict = {}
  runs = []
  for (x, y, z), c in cells.items():
    roofs[(x, z)] = max(roofs.get((x, z), -999), GROUND + (y + 1) * CELL)
    runs.append([x, y, z, 1, 1, 1, c])
  for axis in [0, 2, 1]:
    groups: dict = {}
    for r in runs:
      groups.setdefault(
        tuple(r[i] for i in range(7) if i not in (axis, axis + 3)), []
      ).append(r)
    runs = []
    for group in groups.values():
      group.sort(key=lambda r: r[axis])
      for r in group:
        if (
          runs
          and all(r[i] == runs[-1][i] for i in range(7) if i not in (axis, axis + 3))
          and runs[-1][axis] + runs[-1][axis + 3] == r[axis]
        ):
          runs[-1][axis + 3] += r[axis + 3]
        else:
          runs.append(r.copy())
  return (
    [
      [
        (x + w / 2) * CELL,
        GROUND + (y + h / 2) * CELL,
        (z + d / 2) * CELL,
        w * CELL,
        h * CELL,
        d * CELL,
        c,
      ]
      for x, y, z, w, h, d, c in runs
    ],
    [[(x + 0.5) * CELL, (z + 0.5) * CELL, y] for (x, z), y in roofs.items()],
    len(cells),
  )


def build() -> None:
  """Write small source, navigation and audit files; never mutate outer packets."""
  semantics, ids, owners = inventory()
  families, parts = exact_parts(ids)
  berlinian = next(s for s in semantics if s["id"] == "way/1335157930")
  ring = berlinian["polygons"][0]["ring"]
  extra = {
    "id": "OSM-way-1335157930",
    "parentId": "OSM-way-1335157930",
    "ground_y_m": GROUND,
    "top_y_m": 149.0,
    "height_m": 146.0,
    "ring": ring,
    "holes": [],
    "surfaces": [],
  }
  for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
    extra["surfaces"].append(
      {
        "kind": "WallSurface",
        "rings": [
          [
            [a[0], GROUND, a[1]],
            [b[0], GROUND, b[1]],
            [b[0], 149.0, b[1]],
            [a[0], 149.0, a[1]],
          ]
        ],
      }
    )
  extra["surfaces"].append(
    {"kind": "RoofSurface", "rings": [[[x, 149.0, z] for x, z in ring]]}
  )
  parts.append(extra)
  neighbours = [(p, Polygon(p["ring"], p["holes"])) for p in parts]
  surfaces, details = [], []
  for p in parts:
    local = [n for n in neighbours if Polygon(p["ring"]).distance(n[1]) < 1]
    for sheet in p["surfaces"]:
      roof = sheet["kind"] == "RoofSurface"
      surfaces.append(
        {
          "partId": p["id"],
          "kind": sheet["kind"],
          "color": color_for(p["parentId"], roof),
          "triangles": triangles_for(sheet["rings"]),
        }
      )
      if not roof:
        if p is extra:
          # Current sourced envelope is retained. Structural floor seams are
          # estimates, without asserting completed curtain-wall installation.
          for r in facade(p, sheet, local):
            if r[7] == 0x50676C:
              r[7] = 0x777D7D
              r[4] = 0.30
              r[3] *= 1.4
              details.append(r)
        else:
          details.extend(facade(p, sheet, local))
  runs, roofs, count = native_skin(surfaces, details)
  navigation = {
    "parts": [{k: v for k, v in p.items() if k != "surfaces"} for p in parts],
    "legacyPrisms": [],
    "outerOwners": owners,
    "roofTriangles": [
      t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    "nativeRoofCells": roofs,
  }
  evidence = {
    "schemaVersion": 1,
    "license": "dl-de/zero-2-0; ODbL-1.0",
    "families": families,
    "parts": parts,
    "osmBuildings": semantics,
    "outerOwners": owners,
    "sources": SOURCES,
    "poi": {
      "id": "node/567837367",
      "name": "Monsieur Vuong",
      "longitude": 13.4078977,
      "latitude": 52.5266247,
      "address": "Alte Schönhauser Straße 46",
    },
    "conflicts": [
      "Every original LoD2 wall/roof and courtyard retained. Source elevations undergo only per-family rigid translation to the established outer y=3 plane.",
      "The Berlinian retains the exact existing 146 m OSM envelope. The construction participant confirms its structural shell reached 146 m in April 2026; Berlin planning lists completion 2027, overriding the stale OSM opening_date=2026. The model does not assert completed glazing or occupancy, nor identify it as the user's ambiguous replacement tower.",
      "Karl-Liebknecht-Straße 31/33 is identified by address; Bundesarchiv confirms its former offices/public functions moved in January 2024.",
      "Schönhauser Tor source geometry governs height/parts; Deka's 1995/1996 and seven/eight upper-floor descriptions conflict and do not alter measured source geometry.",
      "Park Inn published 125/150 m claims do not replace survey geometry. The former coarse 123.88 m parent envelope stays in outerOwners; the complete 123.306 m tower leaf governs the refined body. Roof masts and all fine facade divisions are explicitly illustrative.",
      "All facade bays, swatches, lettering strokes and floor subdivisions are procedural visual estimates. No photographic texture or protected facade artwork is copied.",
    ],
  }
  source = {
    "schemaVersion": 1,
    "groundY": GROUND,
    "nativeCellSize": CELL,
    "partIds": [p["id"] for p in parts],
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeRuns": runs,
    "nativeCellCount": count,
  }
  for name, data in [
    ("Source", source),
    ("Evidence", evidence),
    ("Navigation", navigation),
  ]:
    (DEST / f"alexanderNorthV166{name}.json").write_text(
      json.dumps(data, separators=(",", ":")) + "\n"
    )
  print(
    {
      "families": len(families),
      "parts": len(parts),
      "surfaces": len(surfaces),
      "facadeBoxes": len(details),
      "nativeRuns": len(runs),
      "nativeCells": count,
      "outerOwners": len(owners),
    }
  )


if __name__ == "__main__":
  build()
