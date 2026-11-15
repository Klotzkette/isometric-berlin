"""Finite Clayallee exteriors, mapped Hastings and Domäne agricultural details.

Only complete named fallback bodies are exchanged. Every previous source stays
on disk; actual raw and prepared packet pins admit both renderer families.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import inspect
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_rixdorf_v304 as r
import build_surrounding_outlines as outer
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail, mesh_signature, packed_detail
from integrate_city_refinements_v166 import line_signature

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/clay-dahlem-v347"
KIND = "clay-dahlem-v347"
SOURCE = GEO / (KIND + "-source.json.gz")
TARGETS = {
  "way/96924281": (
    "consulate",
    [
      "DEBE06YYB0000UVT",
      "DEBE06YYB0004v6c",
      "DEBE06YYB0004vGQ",
      "DEBE06YYB0004v3B",
      "DEBE06YYB0004vEY",
    ],
  ),
  "way/192647261": ("retail", ["DEBE06YYB0000M7N"]),
  "way/216974000": ("village", ["DEBE06AL2NG00028"]),
  "way/216974007": ("village", ["DEBE06AL2NG0001v"]),
  "way/216974021": ("village", ["DEBE06AL2NG0003H"]),
  "way/216974009": ("village", ["DEBE06AL2NG0003o"]),
  "way/216974020": ("village", ["DEBE06AL2NG0002k"]),
}
REFERENCES = [
  "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/steglitz-zehlendorf/hauptquartier-general-lucius-d-clay-647598.php",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075385",
  "https://educationusa.state.gov/node/646",
  "https://www.bollinger-fehlig.de/projekte/5-morgen/",
  "https://www.bollinger-fehlig.de/wp-content/uploads/2021/01/210104_5MMI_BFA_PB_EN.pdf",
  "https://www.edeka.de/maerkte/801006/",
  "https://www.alliiertenmuseum.de/sammlung/",
  "https://www.alliiertenmuseum.de/veranstaltung/flugzeug/",
  "https://paradata.org.uk/content/4663321",
  "https://www.domaene-dahlem.de/wp-content/uploads/2025/06/Lageplan-Domaene-Dahlem.pdf",
  "https://www.domaene-dahlem.de/landgut/landwirtschaft/",
  "https://www.domaene-dahlem.de/wildbienen-auf-der-domaene-dahlem/",
]


def extract() -> dict[str, Any]:
  """Freeze bounded permitted records, complete families and original fallback."""
  records = r.read(RAW / "osm-selected.json")["features"]
  by_id = {q["id"]: q for q in records}
  candidates = {p["id"]: p for p in r.read(RAW / "lod2-candidates.json")}
  parents, old = [], []
  manifest = r.read(PUBLIC / "manifest.json")
  packets = [
    r.read(PUBLIC / c["drawn"]["url"])
    for c in manifest["chunks"]
    if c["id"] in {"outer187--14_13", "outer187--14_14"}
  ]
  for oid, (style, ids) in TARGETS.items():
    osm = by_id[oid]
    sid = "OSM-" + oid.replace("/", "-")
    nav = [q for p in packets for q in p["nav"]["buildings"] if q["sourceId"] == sid]
    if not nav or len({q["height"] for q in nav}) != 1:
      raise ValueError("Unambiguous old fallback missing: " + sid)
    old.append(
      dict(
        sourceId=sid,
        geometry=osm["geometry"],
        height=nav[0]["height"],
        minHeight=nav[0]["minHeight"],
        heightSource=nav[0]["heightSource"],
        osm=osm,
      )
    )
    for pid in ids:
      p = candidates[pid]
      parents.append(
        dict(
          id=pid,
          parts=p["parts"],
          style=style,
          labels=[oid],
          mappedStoreys=int(osm["tags"].get("building:levels", 2)),
          displayDatumY=min(
            q["ground_y_m"] for i in ids for q in candidates[i]["parts"]
          ),
        )
      )
  farmland = shape(by_id["way/22566415"]["geometry"])
  context = [
    q
    for q in records
    if shape(q["geometry"]).intersects(farmland.buffer(10))
    and (
      q["tags"].get("highway")
      or q["tags"].get("building")
      or q["tags"].get("natural") == "water"
      or q["tags"].get("water")
    )
  ]
  return dict(
    schemaVersion=1,
    baseline="84d3c452",
    retrieved="2026-11-15",
    parents=parents,
    oldOwners=old,
    siteFeatures=[
      by_id[k]
      for k in [
        "way/22566415",
        "way/30432424",
        "way/108631421",
        "node/13176697933",
        "way/210753143",
        "way/83811523",
      ]
    ],
    context=context,
    sources=[
      dict(
        url="https://gdi.berlin.de/data/a_lod2/atom/LoD2_382_5812.zip",
        sha256=r.sha(GEO / "raw/lod2/LoD2_382_5812.zip"),
        license="dl-de/zero-2-0",
      ),
      dict(
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        sha256=r.sha(GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"),
        license="ODbL-1.0",
      ),
    ],
    references=REFERENCES,
    visualReferences=[
      dict(file=n, sha256=r.sha(RAW / n), pixelsDistributed=False)
      for n in ["clay.jpg", "five-morgen.pdf", "hastings.jpg", "domaene-map.pdf"]
    ],
    policy="Complete official named exteriors and mapped external exhibits only. No consulate operational or security interiors. Previous source bodies remain immutable on disk. Facade apertures/material tones, aircraft sectional heights and agricultural row phase/crop choices are explicit recognition estimates. The museum confirms one Hastings on this outdoor site; other collection aircraft are not placed here. Honey-bee hives are a bounded estimated display adjacent to the mapped Imkerei; the distinct mapped Bienenburg remains a wild-bee insect hotel. No field ownership, walking path, road or dedicated V187 Domäne building is replaced.",
  )


def prepare(paths: list[Path]) -> dict[str, Any]:
  """Use exactly the production predecessors before this finite transaction."""
  code = r"""
import {gunzipSync} from 'node:zlib';
import {basename} from 'node:path';
import {prepareSurroundingQuarterPredecessorV303 as prepare,groundOverlayKindsV329} from './src/SurroundingCityGeometry.ts';
import {loadSourceQuarterRecipesV309 as load} from './src/SourceQuarterCatalogueV309.ts';
import {captureSourceQuarterPacketV303 as capture,prepareSourceQuarterPacketV303 as apply} from './src/SourceQuarterPacketV303.ts';
import {captureNeighbourhoodPacketV300 as simple} from './src/NeighbourhoodPacketV300.ts';
const done=g=>{let r=g.next();while(!r.done)r=g.next();return r.value};
const ownership={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
const out={};for(const path of Bun.argv.slice(1)){const raw=await Bun.file(path).bytes(),p=JSON.parse(gunzipSync(raw).toString()),id=basename(path).split('.')[0],native=path.includes('.minecraft.');const tickets=[];
for(const e of await load(id,native)){if(e.kind==='clay-dahlem-v347')break;if(groundOverlayKindsV329.has(e.kind))continue;const plan=e.source.packets[`${native?'minecraft':'drawn'}:${id}`];const t=done(plan.preparedRecords?capture(p,id,native,true,e.source,e.kind,e.requiredReplacement):simple(p,id,native,true,e.source,e.kind));if(t)tickets.push(t);}
let n=done(prepare(p,id,native,ownership));for(const t of tickets)n=done(apply(n,t));out[path]={prepared:n,navGuard:fnv(JSON.stringify(p.nav)),lineGuard:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null,preparedNavGuard:fnv(JSON.stringify(n.nav)),preparedLineGuard:n.lines?fnv(n.lines.positions+(n.lines.colors??'')):null};}process.stdout.write(JSON.stringify(out));
"""
  result = subprocess.run(
    ["bun", "-e", code, *map(str, paths)],
    cwd=ROOT / "src/app",
    capture_output=True,
    text=True,
    check=True,
  )
  return json.loads(result.stdout)


def facade(
  d: Detail,
  surface: dict[str, Any],
  parent: dict[str, Any],
  occupied: Any,
  footprint: Any,
) -> int:
  """Small visible relief follows complete wall sheets, never a guessed hull."""
  ring = surface["rings"][0]
  horizontal = [
    (a, b) for a, b in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - b[1]) < 0.02
  ]
  if not horizontal:
    return 0
  a, b = max(horizontal, key=lambda q: math.dist(q[0], q[1]))
  av, bv = np.array(a)[[0, 2]], np.array(b)[[0, 2]]
  length = float(np.linalg.norm(bv - av))
  if length < 3:
    return 0
  direction = (bv - av) / length
  normal = np.array([-direction[1], direction[0]])
  if footprint.covers(Point((av + bv) / 2 + normal * 0.1)):
    normal = -normal
  if occupied.contains(Point((av + bv) / 2 + normal * 0.4)):
    return 0
  plane = shapely.make_valid(
    Polygon([[(np.array(p)[[0, 2]] - av).dot(direction), p[1]] for p in ring])
  )
  low = min(p[1] for p in ring)
  high = min(
    (max(a[1], b[1]) for a, b in horizontal if max(a[1], b[1]) > low + 0.5),
    default=max(p[1] for p in ring),
  )
  if high - low < 2.6:
    return 0
  style = parent["style"]
  levels = max(1, round((high - low) / (4.0 if style == "consulate" else 3.1)))
  columns = max(1, round(length / (3.4 if style == "consulate" else 4.2)))
  count = 0

  def pane(
    u: float,
    y: float,
    w: float,
    h: float,
    color: tuple[int, ...],
    role: str,
    out: float,
  ) -> bool:
    if not plane.buffer(0.001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return False
    q = []
    for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
      xz = av + direction * (u + dx * w / 2) + normal * out
      q.append([float(xz[0]), y + dy * h / 2, float(xz[1])])
    if np.cross(np.array(q[1]) - q[0], np.array(q[2]) - q[0])[[0, 2]].dot(normal) < 0:
      q.reverse()
    d.polygon(q, color, role)
    return True

  for row in range(levels):
    y = low + (row + 0.51) * (high - low) / levels
    h = min(2.35 if style != "consulate" else 1.85, (high - low) / levels * 0.68)
    for col in range(columns):
      u = (col + 0.5) * length / columns
      w = min(2.45 if style != "consulate" else 1.12, length / columns * 0.63)
      if pane(
        u, y, w + 0.20, h + 0.18, (201, 194, 175), "estimated window reveal", 0.06
      ):
        pane(u, y, w, h, (69, 86, 87), "estimated window glazing", 0.09)
        pane(u, y, 0.06, h, (113, 119, 112), "estimated window mullion", 0.12)
        if style == "consulate":
          pane(u, y + 0.12, w, 0.06, (188, 190, 178), "estimated window transom", 0.12)
        pane(
          u,
          y - h / 2 - 0.10,
          w + 0.20,
          0.14,
          (200, 194, 177),
          "estimated stone sill",
          0.15,
        )
        count += 1
  pane(
    length / 2,
    low + 0.24,
    length - 0.18,
    0.35,
    (174, 169, 153),
    "estimated plinth",
    0.07,
  )
  pane(
    length / 2,
    high - 0.15,
    length - 0.18,
    0.18,
    (226, 221, 204),
    "estimated eave course",
    0.09,
  )
  return count


def buildings(
  source: dict[str, Any],
) -> tuple[dict[str, Detail], dict[str, Detail], dict[str, Any]]:
  """Keep all official sheets; derive a separate cardinal native exterior."""
  polys = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in source["parents"]
  }
  occupied = unary_union(list(polys.values()))
  drawn, native, metrics = {}, {}, {}
  for parent in source["parents"]:
    pid = parent["id"]
    d = Detail()
    sheets, _ = r.translated_surfaces(parent)
    delta = min(q["ground_y_m"] for q in parent["parts"]) - parent["displayDatumY"]
    for sheet in sheets:
      for ring in sheet["rings"]:
        for point in ring:
          point[1] = round(point[1] + delta, 3)
    wall = (219, 215, 202) if parent["style"] == "consulate" else (220, 211, 190)
    roof = (102, 109, 107) if parent["style"] == "consulate" else (146, 145, 135)
    roofs = []
    for s in sheets:
      tris = triangles_for(s["rings"])
      d.triangles.extend(
        (t, roof if s["kind"] == "RoofSurface" else wall, "source " + s["kind"])
        for t in tris
      )
      if s["kind"] == "RoofSurface":
        roofs.extend(tris)
    openings = sum(
      facade(d, s, parent, occupied, polys[pid])
      for s in sheets
      if s["kind"] == "WallSurface"
    )
    n, caps = r.native_model(d)
    drawn[pid] = d
    native[pid] = n
    metrics[pid] = dict(
      parts=len(parent["parts"]),
      sourceSheets=len(sheets),
      drawnTriangles=len(d.triangles),
      nativeTriangles=len(n.triangles),
      estimatedOpenings=openings,
      roofTriangles=roofs,
      nativeRoofCaps=caps,
    )
    print(pid, len(d.triangles), len(n.triangles), flush=True)
  return drawn, native, metrics


def aircraft(feature: dict[str, Any]) -> tuple[Detail, dict[str, Any]]:
  """Hastings: mapped nose/tail axis, published span, photo-guided section."""
  ring = list(shape(feature["geometry"]).geoms[0].exterior.coords)
  nose = (np.array(ring[0]) + np.array(ring[-2])) / 2
  tail = (np.array(ring[8]) + np.array(ring[9])) / 2
  axis = (nose - tail) / np.linalg.norm(nose - tail)
  side = np.array([-axis[1], axis[0]])
  center = (nose + tail) / 2
  d = Detail()
  silver = (186, 193, 190)
  dark = (38, 49, 53)
  blue = (34, 65, 101)
  yellow = (221, 187, 54)

  def point(u: float, y: float, v: float) -> list[float]:
    xz = center + axis * u + side * v
    return [float(xz[0]), y, float(xz[1])]

  def polygon(points: list[list[float]], color: tuple[int, ...], role: str) -> None:
    d.polygon([point(*p) for p in points], color, role)

  # Twenty sides and eight photo-estimated section stations keep the rounded nose,
  # cylindrical passenger body and narrowing tail distinct.
  profiles = [
    (-12.2, 0.25),
    (-10.4, 0.65),
    (-7.0, 1.2),
    (-3, 1.52),
    (6.6, 1.58),
    (9.7, 1.35),
    (11.6, 0.75),
    (12.3, 0.10),
  ]
  for (u0, r0), (u1, r1) in zip(profiles, profiles[1:]):
    for j in range(20):
      a, b = 2 * math.pi * j / 20, 2 * math.pi * (j + 1) / 20
      polygon(
        [
          [u0, 5.75 + 0.055 * u0 + r0 * math.sin(a), r0 * math.cos(a)],
          [u1, 5.75 + 0.055 * u1 + r1 * math.sin(a), r1 * math.cos(a)],
          [u1, 5.75 + 0.055 * u1 + r1 * math.sin(b), r1 * math.cos(b)],
          [u0, 5.75 + 0.055 * u0 + r0 * math.sin(b), r0 * math.cos(b)],
        ],
        silver,
        "Hastings aluminium fuselage",
      )
  # Thin tapered lifting surfaces, not generic rectangular slabs.
  for sign in [-1, 1]:
    points = [
      [3.6, 5.0, sign * 1.1],
      [1.4, 5.8, sign * 17.22],
      [-0.3, 5.8, sign * 17.22],
      [-2.5, 5.0, sign * 1.1],
    ]
    polygon(points, silver, "Hastings 34.44m wing")
    polygon(
      [[u, y - 0.16, v] for u, y, v in reversed(points)],
      (145, 155, 155),
      "wing underside",
    )
    polygon(
      [
        [-8.0, 5.4, sign * 0.55],
        [-9.6, 5.7, sign * 6.6],
        [-11.1, 5.7, sign * 6.6],
        [-11.1, 5.4, sign * 0.55],
      ],
      silver,
      "Hastings horizontal stabilizer",
    )

    def skin(u: float, dy: float, out: float = 0.035) -> list[float]:
      radius = float(np.interp(u, [p[0] for p in profiles], [p[1] for p in profiles]))
      return [
        u,
        5.75 + 0.055 * u + dy,
        sign * (math.sqrt(max(0.001, radius * radius - dy * dy)) + out),
      ]

    for u in np.arange(-7.8, 7.9, 1.7):
      polygon(
        [
          skin(float(u) + 0.22 * math.cos(a), 0.55 + 0.22 * math.sin(a))
          for a in np.arange(12) * math.pi / 6
        ],
        (91, 119, 123),
        "Hastings circular cabin glazing",
      )
    for (u0, _), (u1, _) in zip(profiles, profiles[1:]):
      polygon(
        [skin(u0, -0.09), skin(u1, -0.09), skin(u1, 0.09), skin(u0, 0.09)],
        blue,
        "Hastings blue fuselage stripe",
      )
    polygon(
      [
        [8.3, 7.15, sign * 0.85],
        [9.7, 7.10, sign * 0.69],
        [10.4, 6.95, sign * 0.40],
        [8.8, 7.39, sign * 0.44],
      ],
      (88, 113, 115),
      "Hastings cockpit glazing",
    )
  polygon(
    [[-11.9, 5.0, 0], [-11.5, 9.86, 0], [-9.45, 9.05, 0], [-7.5, 5.4, 0]],
    silver,
    "Hastings vertical tail",
  )
  engines = []
  for v in [-10, -5.2, 5.2, 10]:
    engines.append(point(2, 5.25, v))
    for j in range(16):
      a, b = 2 * math.pi * j / 16, 2 * math.pi * (j + 1) / 16
      polygon(
        [
          [-0.6, 5.25 + 0.73 * math.sin(a), v + 0.73 * math.cos(a)],
          [3.6, 5.25 + 0.73 * math.sin(a), v + 0.73 * math.cos(a)],
          [3.6, 5.25 + 0.73 * math.sin(b), v + 0.73 * math.cos(b)],
          [-0.6, 5.25 + 0.73 * math.sin(b), v + 0.73 * math.cos(b)],
        ],
        silver,
        "Hastings radial nacelle",
      )
    for a in [0, math.pi / 2, math.pi, 3 * math.pi / 2]:
      dy, dv = math.sin(a), math.cos(a)
      polygon(
        [
          [3.75, 5.25 + dy * 0.15 - dv * 0.12, v + dv * 0.15 + dy * 0.12],
          [3.75, 5.25 + dy * 1.75 - dv * 0.10, v + dv * 1.75 + dy * 0.10],
          [3.75, 5.25 + dy * 1.82 + dv * 0.1, v + dv * 1.82 - dy * 0.1],
          [3.75, 5.25 + dy * 0.15 + dv * 0.12, v + dv * 0.15 - dy * 0.12],
        ],
        dark,
        "Hastings four-bladed propeller",
      )
      polygon(
        [
          [3.76, 5.25 + dy * 1.6 - dv * 0.12, v + dv * 1.6 + dy * 0.12],
          [3.76, 5.25 + dy * 1.82 - dv * 0.1, v + dv * 1.82 + dy * 0.1],
          [3.76, 5.25 + dy * 1.82 + dv * 0.1, v + dv * 1.82 - dy * 0.1],
          [3.76, 5.25 + dy * 1.6 + dv * 0.12, v + dv * 1.6 - dy * 0.12],
        ],
        yellow,
        "yellow propeller tips",
      )
  for u, v in [(0, 5.2), (0, -5.2), (-10.8, 0)]:
    c = point(u, 3.65, v)
    d.box(c, [0.65, 1.3, 0.7], (42, 45, 43), "Hastings wheels")
    d.box(
      point(u, 4.55, v), [0.14, 1.2, 0.14], (118, 126, 125), "Hastings landing strut"
    )
  return d, dict(
    osm=feature["id"],
    nose=nose.tolist(),
    tail=tail.tolist(),
    center=center.tolist(),
    axis=axis.tolist(),
    spanM=34.44,
    referenceLengthM=24.89,
    engines=engines,
    aircraftCount=1,
    estimate="Section diameters/heights, window pitch and ground attitude are photo-derived display estimates; current OSM nose/tail fixes position and orientation.",
  )


def navigation(
  parent: dict[str, Any],
  metric: dict[str, Any],
  tile: Any,
  origin: list[float],
  native: bool,
) -> list[dict[str, Any]]:
  """Use one rigid vertical calibration for every connected building family."""
  rows = r.navigation(parent, metric, tile, origin, native)
  low = min(p["ground_y_m"] for p in parent["parts"])
  delta = low - parent["displayDatumY"]
  parts = {p["id"]: p for p in parent["parts"]}
  for row in rows:
    part = parts[row["sourceId"].split(":", 1)[1]]
    row["minHeight"] = (
      math.floor(part["ground_y_m"] - parent["displayDatumY"])
      if native
      else round(row["minHeight"] + delta, 3)
    )
    if not native:
      row["height"] = round(row["height"] + delta, 3)
      for triangle in row.get("roofTriangles", []):
        for point in triangle:
          point[1] = round(point[1] + delta, 3)
  return rows


def details(source: dict[str, Any], native: bool) -> tuple[Detail, dict[str, Any]]:
  """Mapped farmland holes/access lanes and separately documented bee displays."""
  features = {f["id"]: f for f in source["siteFeatures"]}
  d, plane = aircraft(features["way/210753143"])
  if native:
    # All smooth aircraft surfaces become an independent cardinal surface skin.
    d, _ = r.native_model(d)
  farm = shapely.make_valid(shape(features["way/22566415"]["geometry"]))
  obstacles = []
  for q in source["context"]:
    g = shapely.make_valid(shape(q["geometry"]))
    tags = q["tags"]
    if tags.get("highway") and g.geom_type in {"LineString", "MultiLineString"}:
      width = outer.parse_length_m(tags.get("width")) or 3.0
      obstacles.append(g.buffer(max(1.8, width / 2 + 0.5)))
    elif tags.get("building") or tags.get("natural") == "water" or tags.get("water"):
      obstacles.append(g.buffer(1.5))
  domain = farm.buffer(-2).difference(unary_union(obstacles))
  if native:
    domain = outer.native_polygon(domain)
  # Finite interpretive crop rows follow the cadastral farm field. Neither crop
  # type per parcel nor annual phase is claimed to be a current survey.
  area = 0.0
  row_count = 0
  for z in np.arange(domain.bounds[1], domain.bounds[3], 3.2):
    line = LineString([(domain.bounds[0] - 20, z), (domain.bounds[2] + 20, z + 36)])
    row = domain.intersection(line.buffer(0.42, cap_style="flat"))
    if native:
      row = outer.native_polygon(row).intersection(domain)
    if row.is_empty:
      continue
    area += row.area
    row_count += 1
    for p in outer.polygons_from_geometry(row):
      for tri in shapely.constrained_delaunay_triangles(p).geoms:
        points = [[x, 3.15, z] for x, z in list(tri.exterior.coords)[:3]]
        d.polygon(points[::-1], (104, 125, 66), "interpreted crop row")
  # The operator map locates Imkerei in the south-west yard. Adjacent exterior
  # display is an explicit arrangement estimate; it is not a surveyed hive census.
  apiary = shape(features["way/108631421"]["geometry"])
  cx, cz = apiary.centroid.coords[0]
  hives = []
  for i in range(4):
    x, z = cx - 3 + i * 1.8, cz + 4.4
    stand = box(x - 0.41, z - 0.39, x + 0.41, z + 0.39)
    if not shape(features["way/30432424"]["geometry"]).covers(
      stand
    ) or apiary.intersects(stand):
      raise ValueError(
        "Bee display must remain in the farmyard outside the apiary building"
      )
    hives.append([x, z])
    d.box([x, 3.18, z], [0.82, 0.28, 0.78], (103, 88, 60), "beehive stand")
    for j in range(3):
      d.box(
        [x, 3.43 + j * 0.25, z],
        [0.68, 0.23, 0.62],
        (172, 147 + 8 * (i % 2), 92),
        "honey-bee hive tier",
      )
    d.box([x, 4.12, z], [0.78, 0.08, 0.72], (133, 144, 137), "beehive weather lid")
    d.box(
      [x, 3.43, z - 0.34], [0.38, 0.055, 0.13], (63, 72, 51), "beehive entrance ledge"
    )
  bx, bz = features["node/13176697933"]["geometry"]["coordinates"]
  d.box(
    [bx, 4.05, bz], [1.35, 1.5, 0.38], (113, 91, 58), "mapped Bienenburg wooden case"
  )
  for y in [3.48, 3.86, 4.24, 4.62]:
    for dx in [-0.45, -0.15, 0.15, 0.45]:
      d.box(
        [bx + dx, y, bz - 0.21],
        [0.22, 0.25, 0.035],
        (176, 153, 98),
        "Bienenburg nesting compartments",
      )
  d.box([bx, 4.86, bz], [1.55, 0.12, 0.57], (97, 100, 86), "Bienenburg weather roof")
  return d, dict(
    aircraft=plane,
    fieldAreaM2=farm.area,
    cropDomainAreaM2=domain.area,
    cropRows=row_count,
    cropRowsAreaM2=area,
    pathExclusionCount=len(obstacles),
    apiarySource=features["way/108631421"]["id"],
    hiveDisplayCenters=hives,
    hiveCountEstimate=4,
    bienenburgPoint=[bx, bz],
    domain=mapping(domain),
  )


def build(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
  """Compile exact replacements and additive small details into owner packets."""
  parents = {p["id"]: p for p in source["parents"]}
  signature = hashlib.sha256(
    (
      json.dumps(source, sort_keys=True)
      + inspect.getsource(buildings)
      + inspect.getsource(facade)
      + inspect.getsource(r.native_model)
    ).encode()
  ).hexdigest()[:20]
  cache = RAW / f"buildings-{signature}.json.gz"
  if cache.exists():
    saved = r.read(cache)
    drawn, native = {}, {}
    for name, target in [("drawn", drawn), ("native", native)]:
      for pid, triangles in saved[name].items():
        obj = Detail()
        obj.triangles = triangles
        target[pid] = obj
    metrics = saved["metrics"]
  else:
    drawn, native, metrics = buildings(source)
    r.write(
      cache,
      dict(
        drawn={p: d.triangles for p, d in drawn.items()},
        native={p: d.triangles for p, d in native.items()},
        metrics=metrics,
      ),
    )
  addition = {}
  addproof = {}
  for mode in ["drawn", "minecraft"]:
    addition[mode], addproof[mode] = details(source, mode == "minecraft")
  footprints = {
    pid: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for pid, p in parents.items()
  }
  ids = {
    "outer187--14_13",
    "outer187--14_14",
    "outer187--12_11",
    "outer187--12_12",
    "outer187--11_11",
    "outer187--11_12",
  }
  descriptors = [
    c for c in r.read(PUBLIC / "manifest.json")["chunks"] if c["id"] in ids
  ]
  paths = [PUBLIC / c[m]["url"] for c in descriptors for m in ["drawn", "minecraft"]]
  prior = prepare(paths)
  plans = {}
  receipts = []
  for desc in descriptors:
    tile = box(*desc["bounds"])
    actualold = [
      o for o in source["oldOwners"] if shape(o["geometry"]).intersects(tile)
    ]
    nearby = [
      pid for pid, g in footprints.items() if g.intersection(tile).area > 0.00001
    ]
    for mode in ["drawn", "minecraft"]:
      is_native = mode == "minecraft"
      path = PUBLIC / desc[mode]["url"]
      raw = r.read(path)
      data = prior[str(path)]
      packet = data["prepared"]
      key = f"{mode}:{desc['id']}"
      expected, expectedlines = Counter(), Counter()
      for old in actualold:
        record = {**old, "geometry": shape(old["geometry"])}
        whole = outer.chunk_payload(
          desc["id"], tile, tile, [record], {}, minecraft=is_native
        )
        empty = outer.chunk_payload(desc["id"], tile, tile, [], {}, minecraft=is_native)
        expected.update(mesh_signature(whole) - mesh_signature(empty))
        if not is_native:
          expectedlines.update(
            line_signature(whole["lines"]) - line_signature(empty["lines"])
          )
      retired = r.exact_retirement(packet, expected)
      retiredlines = r.line_retirement(packet, expectedlines)
      detail = Detail()
      detail.triangles.extend(addition[mode].triangles)
      for pid in nearby:
        detail.triangles.extend((native if is_native else drawn)[pid].triangles)
      append = packed_detail(detail, tile)
      if append is None:
        continue
      append["kind"] = KIND
      oldnav = [
        q
        for q in packet["nav"]["buildings"]
        if q["sourceId"] in {o["sourceId"] for o in actualold}
      ]
      appendnav = [
        q
        for pid in nearby
        for q in navigation(parents[pid], metrics[pid], tile, raw["origin"], is_native)
      ]

      def pins(p: dict[str, Any]) -> list[dict[str, Any]]:
        return [
          dict(mesh=i, kind=m["kind"], fingerprint=r.fingerprint(m))
          for i, m in enumerate(p["meshes"])
        ]

      plan = dict(
        origin=raw["origin"],
        records=pins(raw),
        preparedRecords=pins(packet),
        navGuard=data["navGuard"],
        lineGuard=data["lineGuard"],
        preparedNavGuard=data["preparedNavGuard"],
        preparedLineGuard=data["preparedLineGuard"],
        append=append,
        appendFingerprint=r.fingerprint(append),
        retire=retired,
        retireLines=retiredlines,
        retireNav=oldnav,
        appendNav=appendnav,
        owners=nearby
        + [
          "OSM-way-210753143",
          "OSM-way-22566415",
          "OSM-way-108631421",
          "OSM-node-13176697933",
        ],
      )
      ink = None if is_native else r.roof_lines(detail, tile, raw["origin"])
      if ink:
        plan["appendLines"] = ink
      vertices = sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"] + [append]
      )
      indices = sum(
        len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"] + [append]
      )
      if vertices > 400000 or indices > 2400000 or len(packet["meshes"]) + 1 > 16:
        raise ValueError("Unchanged live packet limits exceeded")
      plans[key] = plan
      receipts.append(
        dict(
          key=key,
          sourceSha256=r.sha(path),
          oldOwners=[o["sourceId"] for o in actualold],
          newParents=nearby,
          retiredTriangles=sum(len(t["triangles"]) for t in retired),
          retiredLines=len(retiredlines),
          newTriangles=len(base64.b64decode(append["indices"])) // 12,
          vertices=vertices,
          indices=indices,
        )
      )
  coverage = []
  for old in source["oldOwners"]:
    oid = old["osm"]["id"]
    selected = [parents[p] for p in TARGETS[oid][1]]
    official = unary_union(
      [Polygon(q["ring"], q["holes"]) for p in selected for q in p["parts"]]
    )
    osm = shape(old["geometry"])
    coverage.append(
      dict(
        owner=old["sourceId"],
        completeParents=[p["id"] for p in selected],
        oldAreaM2=osm.area,
        officialAreaM2=official.area,
        footprintIoU=osm.intersection(official).area / osm.union(official).area,
      )
    )
  return dict(schemaVersion=1, keys=sorted(plans), packets=plans), dict(
    schemaVersion=1,
    kind=KIND,
    sourceSha256=r.sha(SOURCE),
    completeSourceFamilies=len(parents),
    completeSourceParts=sum(len(p["parts"]) for p in parents.values()),
    models={
      pid: {k: v for k, v in m.items() if k not in {"roofTriangles", "nativeRoofCaps"}}
      for pid, m in metrics.items()
    },
    coverage=coverage,
    packets=receipts,
    details=addproof,
    photographicLimits=source["policy"],
  )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  if args.extract:
    r.write(SOURCE, extract())
  result, evidence = build(r.read(SOURCE))
  values = {
    DATA / "clayDahlemV347.json": result,
    DATA / "clayDahlemV347Index.json": dict(keys=result["keys"]),
    GEO / (KIND + "-evidence.json"): evidence,
  }
  for path, value in values.items():
    if args.check:
      if r.read(path) != json.loads(json.dumps(value)):
        raise ValueError("Non-reproducible derivative: " + str(path))
    else:
      r.write(path, value)
  print(
    json.dumps(
      dict(
        packets=len(result["keys"]),
        families=evidence["completeSourceFamilies"],
        parts=evidence["completeSourceParts"],
        runtimeBytes=(DATA / "clayDahlemV347.json").stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  main()
