"""Step 10: three finite Prenzlauer Berg landmarks, preserving complete sources.

Planetarium's documented reconstruction replaces two exactly receipted coarse
proxies. Their complete original sheets remain immutable evidence. All new
dimensions except the published 30 m dome diameter are labelled estimates.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_school_culture_v228 import box
from build_schools_places_v205 import Face, group
from build_steglitz_v182 import native_blocks
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, mapping

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "prenzlberg-v264-source.json"
CORRECTION = GEO / "prenzlberg-v264-correction.json"
OWNER = "DEBE03YY6000044a"
ARC_OWNER = "DEBE00YYMM000010"
INPUTS = [
  "geo_data/regierungsviertel/central-named-v230-source.json",
  "src/app/src/data/centralNamedV230.json",
  "src/app/src/data/centralNamedV230Envelopes.json",
  "src/app/src/data/centralNamedV230Native.json",
  "geo_data/regierungsviertel/religious-sites-v205-source.json",
  "src/app/src/data/religiousSitesV205.json",
  "src/app/public/mesh/surrounding-berlin-v159/7_-6.drawn.json.gz",
  "src/app/public/mesh/surrounding-berlin-v159/7_-6.minecraft.json.gz",
]


def read(path: Path) -> dict:
  """Read retained sources only."""
  return json.loads(path.read_text())


def save(path: Path, data: dict) -> None:
  """Write a deterministic bounded artifact."""
  path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def digest(path: Path) -> str:
  """Hash independently retained input bytes."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict:
  """Freeze the exact cached source; no network or citywide regeneration."""
  archive = GEO / "raw/lod2/LoD2_393_5822.zip"
  planet = part_profile(extract_parent(archive, OWNER))
  assert len(planet["surfaces"]) == 342
  old = read(GEO / "central-named-v230-source.json")
  osm_path = GEO / "raw/outer-v159/candidate.gpkg"
  osm = (
    gpd.read_file(osm_path, layer="multipolygons", where="osm_way_id='329262981'")
    .to_crs(25833)
    .iloc[0]
  )
  ryke = next(
    s
    for s in read(DATA / "religiousSitesV205.json")["sites"]
    if s["id"] == "rykestrasse"
  )
  return {
    "schemaVersion": 1,
    "inputSha256": {p: digest(ROOT / p) for p in INPUTS},
    "archive": {
      "path": str(archive.relative_to(ROOT)),
      "sha256": digest(archive),
      "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_393_5822.zip",
    },
    "planetariumOsm": {
      "id": "way329262981",
      "name": osm["name"],
      "sourcePath": str(osm_path.relative_to(ROOT)),
      "sourceSha256": digest(osm_path),
      "license": "ODbL-1.0",
      "geometry": mapping(
        affine_transform(osm.geometry, [1, 0, 0, -1, -389500, 5820000])
      ),
      "otherTags": osm["other_tags"],
    },
    "water": old["water"],
    "rykestrasse": {k: ryke[k] for k in ["walls", "windowEvidence"]},
    "sites": [
      {
        "key": "planetarium",
        "parents": [
          {
            "id": OWNER,
            "geometrySource": "complete-official-lod2-leaf-sheets",
            "existingOwnership": {"family": "surrounding-city", "ids": [OWNER]},
            "parts": [planet],
          }
        ],
      }
    ],
    "status": "Complete retained source sheets; facade fittings, material fields and panel subdivisions are display estimates. No photograph or source simplification.",
  }


def new(key: str, name: str, owner: str, camera: list, target: list) -> dict:
  """A separate bounded culling family per site."""
  return {**group(name, owner), "key": key, "camera": camera, "target": target}


def extract_correction(source: dict) -> dict:
  """Retain the newly identified same-site arc without rewriting the first source."""
  arc = part_profile(extract_parent(ROOT / source["archive"]["path"], ARC_OWNER))
  assert len(arc["surfaces"]) == 94
  return {
    "schemaVersion": 1,
    "retainedPrimary": {
      "path": str(SOURCE.relative_to(ROOT)),
      "sha256": digest(SOURCE),
      "surfaceCount": 342,
    },
    "archive": source["archive"],
    "sites": [
      {
        "key": "planetarium",
        "parents": [
          {
            "id": OWNER,
            "geometrySource": "complete-official-lod2-leaf-sheets",
            "existingOwnership": {"family": "surrounding-city", "ids": [OWNER]},
            "sourceReference": str(SOURCE.relative_to(ROOT)),
          },
          {
            "id": ARC_OWNER,
            "geometrySource": "complete-official-lod2-leaf-sheets",
            "existingOwnership": {"family": "surrounding-city", "ids": [ARC_OWNER]},
            "parts": [arc],
          },
        ],
      }
    ],
    "association": "The second complete source ring is the concentric west arc immediately adjoining the main dome footprint. Its approximately 14–16 m radii and shared boundary place it within the same published 30 m dome/foyer, not a neighboring building.",
    "correction": {
      "reason": "The cached coarse LoD2 cone and tall extruded annex contradict the operator/Landesdenkmalamt exterior. Preserve all 342+94 sheets as evidence; explicitly replace only their displayed vertical envelope.",
      "publishedDiameterM": 30,
      "diameterSource": "https://www.planetarium.berlin/zeiss-grossplanetarium",
      "photoSource": "https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2025/artikel.1521460.php",
      "footprintPolicy": "Retain both original source rings and holes verbatim. Reconstructed upper bodies stay within their union. No ground, path or unrelated building owner transfers.",
      "displayEstimates": {
        "domeCenter": [3895.408, -2594.857],
        "domeBaseY": 8.4,
        "domeEquatorY": 17.721,
        "domeTopY": 32.721,
        "annexRoofY": 8.4,
        "foyerGlazingTopY": 7.6,
        "concreteCylinderCenter": [3875.5941, -2584.1225],
        "concreteCylinderRadius": 4.42,
        "concreteCylinderTopY": 20.5,
        "blueCrownTopY": 23.0,
      },
      "uncertainty": "Only dome external diameter is independently published. Center uses retained crown plan; equator/base, annex/foyer height, cylinder proportions, panel pitch and colors are photograph-based display estimates, not a measured survey. Dome top retains the previous source maximum as a contextual estimate, not independent confirmation of physical height.",
    },
  }


def rod(
  g: dict, a: list, b: list, width: float, color: int, native: bool = True
) -> None:
  """Thin drawn member and independent unrotated block samples."""
  g["rods"].append([*a, *b, width, color])
  if native:
    if abs(a[0] - b[0]) < 1e-8 and abs(a[2] - b[2]) < 1e-8:
      g["nativeRows"].append(
        [
          a[0],
          (a[1] + b[1]) / 2,
          a[2],
          max(0.16, width),
          abs(a[1] - b[1]) + max(0.18, width),
          max(0.16, width),
          color,
        ]
      )
      return
    count = max(1, math.ceil(math.dist(a, b) / 0.5))
    for j in range(count):
      p = [a[i] + (b[i] - a[i]) * (j + 0.5) / count for i in range(3)]
      g["nativeRows"].append(
        [*p, max(0.16, width), max(0.18, width), max(0.16, width), color]
      )


def water(source: dict) -> dict:
  """Crown arcading and pilasters retain all old windows and source roof sheets."""
  p = copy.deepcopy(source["water"][0])
  shift = 3 - p["ground_y_m"]
  g = new(
    "wasserturm",
    "Wasserturm Prenzlauer Berg",
    p["id"],
    [3288, 65, -1683],
    [3236.36, 25, -1629.52],
  )
  poly = Polygon(p["ring"], p["holes"])
  center = np.array(poly.centroid.coords[0])

  def frame(angle: float):
    n = np.array([math.cos(angle), math.sin(angle)])
    hits = poly.boundary.intersection(LineString([center, center + n * 40]))
    pts = list(hits.geoms) if hasattr(hits, "geoms") else [hits]
    at = np.array(max(pts, key=lambda q: Point(center).distance(q)).coords[0])
    t = np.array([-n[1], n[0]])

    def point(u, y, out=0.24):
      q = at + t * u + n * out
      return [float(q[0]), y, float(q[1])]

    return point, -math.atan2(t[1], t[0])

  # Existing v230 windows remain on their twelve axes. Slender brick pilasters
  # occupy only the intervals, preserving every earlier opening and frame.
  for k in range(12):
    at, yaw = frame(math.radians(50 + 30 * k))
    box(g, at(0, 16.2), [0.64, 25.3, 0.22], yaw, 0x9A8261)
    for y in [3.8, 28.8]:
      box(g, at(0, y, 0.31), [0.95, 0.30, 0.34], yaw, 0xAC9670)
  # Narrow vertical blind slots and round corbel arches of the tank frieze.
  for k in range(72):
    at, yaw = frame(math.radians(35 + 5 * k))
    box(g, at(0, 31.0, 0.24), [0.20, 1.8, 0.045], yaw, 0x665D4B)
    box(g, at(0, 29.8, 0.30), [0.42, 0.18, 0.27], yaw, 0xB29A72)
    for j in range(5):
      a, b = math.pi * j / 5, math.pi * (j + 1) / 5
      rod(
        g,
        at(0.32 * math.cos(a), 32.4 + 0.40 * math.sin(a), 0.26),
        at(0.32 * math.cos(b), 32.4 + 0.40 * math.sin(b), 0.26),
        0.105,
        0x8B7657,
      )
  # The source's upper polygonal wall sheets, not a new invented octagon.
  upper = []
  for s in p["surfaces"]:
    if s["kind"] != "WallSurface":
      continue
    rings = [[[v[0], v[1] + shift, v[2]] for v in r] for r in s["rings"]]
    ys = [v[1] for r in rings for v in r]
    if min(ys) < 34.7 or max(ys) - min(ys) < 2:
      continue
    f = Face(g, rings)
    if f.length < 4:
      continue
    upper.append(f)
    count = max(1, round(f.length / 4.0))
    for i in range(count):
      u = (i + 0.5) * f.length / count
      f.member(u, f.base + 1.9, 1.45, 2.25, 0x788F8B, 0.045, 0.22)
      for du in [-0.78, 0, 0.78]:
        f.member(u + du, f.base + 1.9, 0.085, 2.5, 0xDDD5BB, 0.07, 0.3)
      f.arch(u, f.base + 3.08, 1.55, 0.28, 0xD1C8AB)
    for y in [f.base + 0.25, f.base + 1.10]:
      f.member(f.length / 2, y, f.length - 0.12, 0.075, 0xD1C8AB, 0.09, 0.46)
    for u in np.arange(0.18, f.length, 0.40):
      f.member(float(u), f.base + 0.65, 0.05, 0.88, 0xD1C8AB, 0.06, 0.46)
  g["recognition"] = {
    "pilasters": 12,
    "tankFriezeSlots": 72,
    "upperSourceFaces": len(upper),
    "existingSixStoreyWindowsRetained": True,
    "heightConflictRetained": "Official historic 30 m figure versus 40.842 m retained source extent; no height change.",
  }
  return g


def synagogue(source: dict) -> dict:
  """Arcaded cornices and existing-window mullions on exact basilica walls."""
  g = new(
    "rykestrasse",
    "Synagoge Rykestraße",
    "DEBE03YY600004DV",
    [3196, 38, -1687],
    [3230, 16, -1743],
  )
  walls = source["rykestrasse"]["walls"]
  for wi, w in enumerate(walls):
    if w["length"] < 4.5:
      continue
    a, b, n = w["a"], w["b"], w["normal"]
    d = [(b[j] - a[j]) / w["length"] for j in range(2)]
    rings = [[[a[0] + d[0] * u, y, a[1] + d[1] * u] for u, y in w["polygon"]]]
    f = Face(g, rings, [n[0], 0, n[1]])
    if w["low"] < 4:
      # Pilaster heads and a brick corbel course above the existing upper row.
      for u in [0.25, f.length - 0.25]:
        f.member(u, 9.0, 0.28, 9.8, 0xB58362, 0.17, 0.25)
        f.member(u, 13.8, 0.52, 0.20, 0xD2B38D, 0.24, 0.30)
      for u in np.arange(0.55, f.length - 0.45, 0.72):
        f.arch(float(u), 13.45, 0.57, 0.25, 0x8E5A45)
      for e in source["rykestrasse"]["windowEvidence"]:
        if e["wallIndex"] != wi:
          continue
        # Match prior openings, never a second unrelated facade grid.
        y, h, u = e["bottomY"], e["height"], e["u"]
        for fraction in [0.22, 0.58]:
          f.member(u, y + h * fraction, e["width"] - 0.1, 0.065, 0xC9AE8B, 0.04, 0.20)
    else:
      # Source sloped gable edges with brick coping and tiny repeated corbels.
      for a2, b2 in zip(w["polygon"], w["polygon"][1:]):
        if a2[1] <= w["low"] + 0.1 or b2[1] <= w["low"] + 0.1:
          continue
        f.stroke((a2[0], a2[1] - 0.18), (b2[0], b2[1] - 0.18), 0xBB9470, 0.18)
    # Front three-light gable: preserve all three old rose windows and add only
    # the photographed brick drip course and small star above the central rose.
    if w["low"] > 14 and f.length > 14:
      for u, r in [(f.length * 0.22, 1), (f.length * 0.5, 2), (f.length * 0.78, 1)]:
        f.arch(u, 19.0, 2 * r + 0.55, r + 0.23, 0xAA7754)
      u, y, r = f.length * 0.487, 24.1, 0.52
      for phase in [math.pi / 2, -math.pi / 2]:
        pts = [
          (
            u + r * math.cos(phase + i * math.tau / 3),
            y + r * math.sin(phase + i * math.tau / 3),
          )
          for i in range(3)
        ]
        for a2, b2 in zip(pts, pts[1:] + pts[:1]):
          f.stroke(a2, b2, 0xD7BD8D, 0.075)
  g["recognition"] = {
    "earlierSourceWindows": len(source["rykestrasse"]["windowEvidence"]),
    "earlierRosesRetained": 3,
    "courtyardBasilica": True,
    "status": "Brick cornices, shallow pilasters and mullions are unsurveyed recognition estimates on retained source planes.",
  }
  return g


def roof_y(triangles: list, x: float, z: float) -> float | None:
  """Exact piecewise height of the retained source roof, no guessed dome radius."""
  heights = []
  for a, b, c in triangles:
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) < 1e-8:
      continue
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
    if u >= -1e-5 and v >= -1e-5 and u + v <= 1.00001:
      heights.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
  return max(heights) if heights else None


def planetarium(source: dict) -> tuple[dict, dict, dict, dict]:
  """Explicitly correct the coarse roof while preserving all source evidence/XZ."""
  correction = read(CORRECTION)
  assert digest(SOURCE) == correction["retainedPrimary"]["sha256"]
  p = source["sites"][0]["parents"][0]["parts"][0]
  arc = correction["sites"][0]["parents"][1]["parts"][0]
  estimates = correction["correction"]["displayEstimates"]
  cx, cz = estimates["domeCenter"]
  tx, tz = estimates["concreteCylinderCenter"]
  ground, annex = 3.0, estimates["annexRoofY"]
  g = new(
    "planetarium", "Zeiss-Großplanetarium", OWNER, [3846, 45, -2540], [3896, 18, -2596]
  )
  surfaces, roof = [], []

  def surface(ts, color, kind, walkable=False):
    # Display precision only; the independently retained source is untouched.
    ts = [[[round(float(v), 4) for v in point] for point in tri] for tri in ts]
    if ts:
      surfaces.append({"color": color, "triangles": ts, "sourceKind": kind})
      if walkable:
        roof.extend(ts)

  # Both original footprints, every vertex and every hole, remain represented.
  # Only their ambiguous coarse vertical profile is explicitly reconstructed.
  # This is low brick ancillary building and curved glazed foyer, not a 30 m
  # extrusion of the whole site. No detached building or ground/path transfers.
  foyer = 0
  for part in [p, arc]:
    rings = [part["ring"], *part["holes"]]
    surface(
      triangles_for([[[x, annex, z] for x, z in r] for r in rings]),
      0x68716B,
      "EstimatedAnnexRoof",
      True,
    )
    for ring in rings:
      for a, b in zip(ring, ring[1:] + ring[:1]):
        if math.dist(a, b) < 0.02:
          continue
        mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        concrete = math.hypot(mx - tx, mz - tz) < 4.7
        glazed = not concrete and math.hypot(mx - cx, mz - cz) < 17.0 and mx < cx + 1
        color = 0xA5A49A if concrete else (0x628184 if glazed else 0xAA7959)
        face = [
          [
            [a[0], ground, a[1]],
            [b[0], ground, b[1]],
            [b[0], annex, b[1]],
            [a[0], annex, a[1]],
          ]
        ]
        surface(triangles_for(face), color, "EstimatedLowWall")
        # Dark coping and sparse frames follow exactly the original curved edges.
        rod(
          g,
          [*a[:1], annex + 0.04, a[1]],
          [*b[:1], annex + 0.04, b[1]],
          0.12,
          0x3D4543,
          native=False,
        )
        if glazed:
          foyer += 1
          for y in [3.18, 7.6]:
            rod(g, [a[0], y, a[1]], [b[0], y, b[1]], 0.12, 0x303D3C)
          rod(g, [a[0], 3.1, a[1]], [a[0], 7.6, a[1]], 0.13, 0x303D3C)

  # Published diameter fixes only the largest horizontal section. The rounded
  # vertical profile is a photographic estimate; the old source maximum is a
  # contextual top anchor, not independent metric verification.
  equator, top = estimates["domeEquatorY"], estimates["domeTopY"]
  profile = [(8.4, 14.2), (11.5, 14.64), (14.6, 14.91), (equator, 15.0)]
  profile += [
    (equator + 15 * math.sin(math.radians(a)), 15 * math.cos(math.radians(a)))
    for a in [10, 20, 30, 40, 50, 60, 70, 80, 85]
  ]
  profile.append((top, 0.0))

  def point(center, y, radius, angle):
    return [
      center[0] + radius * math.cos(angle),
      y,
      center[1] + radius * math.sin(angle),
    ]

  def loft(center, levels, count, color, kind):
    tris = []
    for (y0, r0), (y1, r1) in zip(levels, levels[1:]):
      for i in range(count):
        a0, a1 = i * math.tau / count, (i + 1) * math.tau / count
        a, b = point(center, y0, r0, a0), point(center, y0, r0, a1)
        c, d = point(center, y1, r1, a1), point(center, y1, r1, a0)
        tris.append([a, c, b])
        if r1 > 0:
          tris.append([a, d, c])
    surface(tris, color, kind, True)

  loft([cx, cz], profile, 64, 0xC1C8C7, "ReconstructedDome")
  # Sparse seams on the curved surface, with coarser independent native marks.
  # Offsets avoid z-fighting and are explicitly ornamental, not another shell.
  for i in range(32):
    a = i * math.tau / 32
    for (y0, r0), (y1, r1) in zip(profile[:-2], profile[1:-1]):
      rod(
        g,
        point([cx, cz], y0, r0 + 0.065, a),
        point([cx, cz], y1, r1 + 0.065, a),
        0.045,
        0x879796,
        native=False,
      )
  for j, (y, radius) in enumerate(profile[:-1]):
    for i in range(64):
      a, b = i * math.tau / 64, (i + 1) * math.tau / 64
      rod(
        g,
        point([cx, cz], y + 0.045, radius + 0.065, a),
        point([cx, cz], y + 0.045, radius + 0.065, b),
        0.04,
        0x94A09E,
        native=False,
      )
      if j % 2 == 0 and i % 2 == 0:
        q = point([cx, cz], math.floor(y) + 1.08, radius, a)
        g["nativeRows"].append([*q, 0.28, 0.16, 0.28, 0x879A9A])

  # The source footprint has a separately legible circular lobe. Its center is
  # fitted to those original arc vertices, and this slightly inset circular skin
  # stays inside that footprint. Height and blue glazed crown are photo estimates.
  tr = estimates["concreteCylinderRadius"]
  tower_top, crown_top = estimates["concreteCylinderTopY"], estimates["blueCrownTopY"]
  loft(
    [tx, tz], [(ground, tr), (tower_top, tr)], 48, 0xA5A49A, "EstimatedConcreteCylinder"
  )
  loft(
    [tx, tz],
    [(tower_top, tr), (crown_top - 0.25, 2.7), (crown_top, 2.4)],
    48,
    0x637FA6,
    "EstimatedBlueCrown",
  )
  surface(
    triangles_for(
      [[point([tx, tz], crown_top, 2.4, i * math.tau / 48) for i in range(48)]]
    ),
    0x899CA9,
    "EstimatedBlueCrown",
    True,
  )
  for i in range(24):
    a = i * math.tau / 24
    rod(
      g,
      point([tx, tz], tower_top + 0.03, tr + 0.04, a),
      point([tx, tz], crown_top, 2.45, a),
      0.08,
      0xBBC5C4,
    )
    # The concrete shaft's rough vertical channels are represented sparingly.
    rod(
      g,
      point([tx, tz], 3.1, tr + 0.045, a),
      point([tx, tz], tower_top - 0.1, tr + 0.045, a),
      0.055,
      0x91968C,
      native=False,
    )
  for y, r in [(tower_top, tr + 0.12), (crown_top, 2.5)]:
    for i in range(48):
      rod(
        g,
        point([tx, tz], y, r, i * math.tau / 48),
        point([tx, tz], y, r, (i + 1) * math.tau / 48),
        0.14,
        0xC2C9BC,
        native=False,
      )

  g["recognition"] = {
    "immutableSourceSurfaceCounts": [342, 94],
    "publishedExteriorDiameterM": 30,
    "sourceHeightM": p["top_y_m"] - p["ground_y_m"],
    "foyerFaces": foyer,
    "displayEstimates": estimates,
    "status": correction["correction"]["uncertainty"],
    "explicitReplacementReason": correction["correction"]["reason"],
  }
  common = {"key": "planetarium", "name": g["name"], "owners": [OWNER, ARC_OWNER]}
  drawn = {**common, "surfaces": surfaces}
  native = {
    **common,
    "blocks": native_blocks({"surfaces": surfaces, "boxes": [], "rods": []}),
  }
  poly = Polygon(p["ring"], p["holes"]).union(Polygon(arc["ring"], arc["holes"]))
  nav = {
    "key": "planetarium",
    "bounds": list(poly.bounds),
    "owners": [
      {
        "id": part["id"],
        "ring": part["ring"],
        "holes": part["holes"],
        "low": ground,
        "high": top,
      }
      for part in [p, arc]
    ],
    "roofTriangles": roof,
    "pads": [],
  }
  return g, drawn, native, nav


def build(source: dict) -> tuple[dict, dict, dict, dict]:
  """Build additive details and complete, exactly owned replacement shells."""
  planet, drawn, native, nav = planetarium(source)
  sites = [water(source), synagogue(source), planet]
  for s in sites:
    # Remove empty audit faces and non-runtime labels, retaining detailed audit
    # records separately. Explicit rounding is display-fitting precision only.
    for field in ["boxes", "rods", "nativeRows"]:
      s[field] = [
        [round(v, 4) if isinstance(v, float) else v for v in row] for row in s[field]
      ]
    s["faces"] = [f for f in s["faces"] if f["boxes"] or f["rods"]]
  return (
    {"schemaVersion": 1, "sites": sites},
    {"sites": [drawn]},
    {"sites": [native]},
    {"sites": [nav]},
  )


def main() -> None:
  """Offline build plus independently replayed exact proxy receipt."""
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--ownership", action="store_true")
  args = parser.parse_args()
  if args.extract:
    save(SOURCE, extract())
  source = read(SOURCE)
  if args.extract or not CORRECTION.exists():
    save(CORRECTION, extract_correction(source))
  details, drawn, native, nav = build(source)
  evidence = {
    "inputs": source["inputSha256"],
    "sites": [
      {k: s[k] for k in ["key", "owner", "recognition", "camera", "target", "faces"]}
      for s in details["sites"]
    ],
  }
  save(GEO / "prenzlberg-v264-evidence.json", evidence)
  for s in details["sites"]:
    s.pop("faces")
    s.pop("labels")
  for suffix, data in [
    ("", details),
    ("Envelopes", drawn),
    ("Native", native),
    ("Navigation", nav),
  ]:
    save(DATA / f"prenzlbergV264{suffix}.json", data)
  if args.ownership:
    import build_townhall_ownership_v227 as replay

    previous = replay.SOURCE
    try:
      replay.SOURCE = CORRECTION
      receipt = replay.build()
    finally:
      replay.SOURCE = previous
    assert (
      set(receipt["authorizedOwners"]) == {OWNER, ARC_OWNER} and not receipt["blocked"]
    ), receipt["blocked"]
    save(DATA / "prenzlbergV264Ownership.json", receipt)
  print(
    json.dumps(
      {
        "sites": [
          {
            "key": s["key"],
            "boxes": len(s["boxes"]),
            "rods": len(s["rods"]),
            "native": len(s["nativeRows"]),
          }
          for s in details["sites"]
        ],
        "visibleTriangles": sum(
          len(s["triangles"]) for s in drawn["sites"][0]["surfaces"]
        ),
        "nativeSurfaceBlocks": len(native["sites"][0]["blocks"]),
      }
    )
  )


if __name__ == "__main__":
  main()
