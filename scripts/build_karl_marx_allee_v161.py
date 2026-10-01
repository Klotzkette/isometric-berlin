"""Step 10: source-bound heritage architecture in existing outer-city packets.

No geometry is generated on a phone. Exactly named LoD2 parents replace their
old flat envelopes; every other source triangle and navigation record survives.
Photographs supply recognition cues only, never sampled colours or textures.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from build_concert_halls_v160 import normal_of, triangulate
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  GROUND_Y,
  ROOT,
  PackedMesh,
  chunk_payload,
  load_projected_polygon,
  navigation_polygons,
  polygonal,
  world,
  write_json,
)
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

SOURCE = ROOT / "geo_data/regierungsviertel/karl-marx-allee-v161.json"
RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENT_IDS = frozenset(
  """DEBE02YY20001fZh DEBE02YY200002M0 DEBE02YY200008Dh DEBE02YY200007S4
  DEBE02YY200006i2 DEBE02YY200004Lt DEBE02YY200009Yo DEBE02YY200000TG
  DEBE02YY200000dY DEBE02YY200003oi DEBE02YY200008lg DEBE02YY200003NT
  DEBE02YY200002TY DEBE02YY200009Sb DEBE02YY2000027F DEBE02YY200001O0
  DEBE02YY200002tt DEBE02YY200008Ns DEBE02YY200009gx DEBE02YY200009jf
  DEBE02YY200004rc DEBE02YY200004Wo DEBE02YY200009sh DEBE02YY200004Vo
  DEBE02YY200006xJ DEBE02YY200007xs DEBE02YY200000ho DEBE02YY200008uh
  DEBE02YY200000og DEBE02YY200007Pw DEBE02YY200009Vv DEBE02YY20001fZi
  DEBE02YY200009tU DEBE02YY20001fZf DEBE02YY2000051o DEBE02YY200006Q5
  DEBE02YY200006ci DEBE02YY200004G7 DEBE02YY200000LA DEBE02YY200003Yy
  DEBE02YY20001fZe""".split()
)
TOWERS = {
  "DEBE02YY200001O0": ("Haus Berlin", "222405403"),
  "DEBE02YY200002tt": ("Haus des Kindes", "286744641"),
  "DEBE02YY20001fZe": ("Frankfurter Tor Nordturm", "288230369"),
  "DEBE02YY20001fZf": ("Frankfurter Tor Südturm", "316933471"),
}
CUPOLA_PARTS = {"DEBE3Dc7k2aJikEh", "DEBE3DQk7OOGlYOE"}
PALETTE = {
  "plaster": (220, 208, 181),
  "ceramic": (208, 201, 178),
  "stone": (176, 174, 153),
  "cream": (231, 223, 197),
  "roof": (139, 137, 126),
  "glass": (66, 84, 86),
  "frame": (215, 222, 210),
  "copper": (90, 140, 124),
  "copperSeam": (60, 105, 91),
}


def extract_source() -> dict[str, Any]:
  """Retain original source rings separately from authored component geometry."""
  buildings, archives = [], []
  for tile in ("393_5819", "394_5819", "395_5819"):
    path = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )
    with zipfile.ZipFile(path) as archive:
      tree = ET.fromstring(archive.read(archive.namelist()[0]))
    for parent in tree.findall(".//b:Building", NS):
      identity = parent.get(f"{{{NS['g']}}}id")
      if identity not in PARENT_IDS:
        continue
      ground = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in e.text.split()[2::3]
      )
      parts = []
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        surfaces = []
        for boundary in part.findall("b:boundedBy", NS):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for element in polygon.findall(".//g:posList", NS):
                a = [float(v) for v in element.text.split()]
                ring = [
                  [
                    round(a[i] - 389500, 3),
                    round(a[i + 2] - ground + GROUND_Y, 3),
                    round(5820000 - a[i + 1], 3),
                  ]
                  for i in range(0, len(a), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              if rings:
                surfaces.append({"kind": surface.tag.split("}")[-1], "rings": rings})
        parts.append({"id": part.get(f"{{{NS['g']}}}id"), "surfaces": surfaces})
      buildings.append(
        {
          "id": identity,
          "name": TOWERS.get(identity, ("Karl-Marx-Allee heritage frontage", None))[0],
          "osmWay": TOWERS.get(identity, (None, None))[1],
          "groundNHN": ground,
          "parts": parts,
        }
      )
  assert {b["id"] for b in buildings} == PARENT_IDS
  return {
    "schemaVersion": 1,
    "licence": "dl-de/zero-2-0",
    "sourceArchives": archives,
    "frame": "EPSG:25833 x=easting-389500, z=5820000-northing; each source parent translated vertically to existing outer ground y=3, all measured local differences retained",
    "selection": "41 fixed LoD2 identities in the historic avenue frontage from Strausberger Platz to Frankfurter Tor; no runtime distance mask",
    "buildings": buildings,
    "references": [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085179",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085171",
      "https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558619.php",
      "https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558621.php",
      "https://commons.wikimedia.org/wiki/File:Berlin_Frankfurter_Tor_01.jpg",
      "https://commons.wikimedia.org/wiki/File:Strausberger_Platz_-_Haus_Berlin_-_geo.hlipp.de_-_31758.jpg",
    ],
    "conflict": "Frankfurter Tor's LoD2 square hip roofs enclose the actual circular glazed colonnades. Both named highest parts keep their exact footprint below y=34.5; procedural two-stage rotundas, copper cupolas, lanterns and finials use a common 53.06 m height above display ground (the larger of their two source envelopes). The originals, including different 47.85/53.06 m parent heights, remain here. Component proportions and facade subdivisions are visual-reference estimates, not a measurement survey.",
  }


def clip_polygon(
  points: list[list[float]], axis: int, edge: float, lower: bool
) -> list[list[float]]:
  """Sutherland–Hodgman with interpolation preserving exact source roof slopes."""
  output = []
  for a, b in zip(points, points[1:] + points[:1], strict=True):
    inside_a = a[axis] >= edge - 1e-9 if lower else a[axis] <= edge + 1e-9
    inside_b = b[axis] >= edge - 1e-9 if lower else b[axis] <= edge + 1e-9
    if inside_a:
      output.append(a)
    if inside_a != inside_b:
      t = (edge - a[axis]) / (b[axis] - a[axis])
      p = [a[j] + t * (b[j] - a[j]) for j in range(3)]
      p[axis] = edge
      output.append(p)
  return output


class Detail:
  """Offline triangles, with explicit role/source IDs kept for the audit."""

  def __init__(self) -> None:
    self.triangles: list[tuple[list[list[float]], tuple[int, ...], str]] = []

  def polygon(
    self, points: list[list[float]], color: tuple[int, ...], role: str
  ) -> None:
    for i in range(1, len(points) - 1):
      self.triangles.append(([points[0], points[i], points[i + 1]], color, role))

  def box(
    self, center: list[float], size: list[float], color: tuple[int, ...], role: str
  ) -> None:
    x, y, z = center
    sx, sy, sz = [v / 2 for v in size]
    vertices = [
      [x + a * sx, y + b * sy, z + c * sz]
      for a, b, c in [
        (-1, -1, -1),
        (1, -1, -1),
        (1, 1, -1),
        (-1, 1, -1),
        (-1, -1, 1),
        (1, -1, 1),
        (1, 1, 1),
        (-1, 1, 1),
      ]
    ]
    for indices in [
      (0, 3, 2, 1),
      (4, 5, 6, 7),
      (0, 4, 7, 3),
      (1, 2, 6, 5),
      (3, 7, 6, 2),
      (0, 1, 5, 4),
    ]:
      self.polygon([vertices[i] for i in indices], color, role)

  def lathe(
    self,
    x: float,
    z: float,
    profile: list[tuple[float, float]],
    color: tuple[int, ...],
    role: str,
    segments: int = 32,
  ) -> None:
    for (ya, ra), (yb, rb) in zip(profile, profile[1:]):
      for i in range(segments):
        a, b = 2 * math.pi * i / segments, 2 * math.pi * (i + 1) / segments
        self.polygon(
          [
            [x + ra * math.cos(a), ya, z + ra * math.sin(a)],
            [x + ra * math.cos(b), ya, z + ra * math.sin(b)],
            [x + rb * math.cos(b), yb, z + rb * math.sin(b)],
            [x + rb * math.cos(a), yb, z + rb * math.sin(a)],
          ],
          color,
          role,
        )


def wall_details(
  detail: Detail,
  rings: list[list[list[float]]],
  cap: float,
  warm: bool,
  native: bool = False,
) -> None:
  """Thin source-plane windows, stone sills and cornices; no invented wings."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.08:
    return
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  dx, dz = b[0] - a[0], b[2] - a[2]
  length = math.hypot(dx, dz)
  if length < 2.4:
    return
  dx, dz = dx / length, dz / length
  projected = [
    [((p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]) for p in ring] for ring in rings
  ]
  poly = Polygon(projected[0], projected[1:]).intersection(
    box(-1e5, GROUND_Y, 1e5, cap)
  )
  if poly.is_empty or poly.area < 12:
    return
  u0, y0, u1, y1 = poly.bounds

  def pane(
    u: float,
    y: float,
    w: float,
    h: float,
    color: tuple[int, ...],
    out: float,
    role: str,
  ) -> None:
    field = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    if not poly.buffer(-0.035).covers(field):
      return
    points = [
      [a[0] + dx * q + n[0] * out, v, a[2] + dz * q + n[2] * out]
      for q, v in list(field.exterior.coords)[:-1]
    ]
    detail.polygon(points, color, role)

  pitch = 3.35 if warm else 3.1
  bays = max(1, round((u1 - u0) / pitch))
  pitch = (u1 - u0) / bays
  # Higher parts retain the same floor register as the lower avenue wings.
  for y in np.arange(GROUND_Y + 6.55, y1 - 0.7, 3.1):
    for i in range(bays):
      u = u0 + (i + 0.5) * pitch
      pane(u, y, 1.42, 1.98, PALETTE["cream"], 0.06, "window surround")
      pane(u, y, 1.16, 1.73, PALETTE["glass"], 0.095, "window glazing")
      pane(u, y, 0.075, 1.72, PALETTE["frame"], 0.12, "window mullion")
      pane(u, y - 0.88, 1.55, 0.11, PALETTE["cream"], 0.14, "stone window sill")
  for y, h in [(GROUND_Y + 4.35, 0.26), (y1 - 0.33, 0.24), (y1 - 0.65, 0.12)]:
    for part in getattr(
      poly.intersection(LineString([(u0, y), (u1, y)])),
      "geoms",
      [poly.intersection(LineString([(u0, y), (u1, y)]))],
    ):
      if part.is_empty or part.geom_type != "LineString" or part.length < 1:
        continue
      lo, hi = part.bounds[0], part.bounds[2]
      pane(
        (lo + hi) / 2,
        y,
        hi - lo - 0.14,
        h,
        PALETTE["cream"],
        0.13,
        "continuous cornice",
      )
  for i in range(bays):
    u = u0 + (i + 0.5) * pitch
    pane(
      u,
      GROUND_Y + 1.9,
      min(2.55, pitch - 0.3),
      2.85,
      PALETTE["stone"],
      0.05,
      "shopfront reveal",
    )
    pane(
      u,
      GROUND_Y + 1.9,
      min(2.23, pitch - 0.55),
      2.58,
      PALETTE["glass"],
      0.085,
      "shopfront glazing",
    )
    pane(u, GROUND_Y + 1.9, 0.12, 2.58, PALETTE["frame"], 0.12, "shopfront frame")


def cupola(detail: Detail, center: tuple[float, float]) -> None:
  """Two glazed drums, columns, gallery rings, verdigris dome and open lantern."""
  x, z = center
  detail.lathe(
    x,
    z,
    [(34.5, 7.8), (35.05, 7.8), (35.05, 6.25), (35.65, 6.25)],
    PALETTE["stone"],
    "octagonal cupola footing",
    8,
  )
  for bottom, top, radius in [(35.65, 41.45, 5.5), (42.2, 47.55, 4.7)]:
    detail.lathe(
      x,
      z,
      [(bottom, radius - 0.45), (top, radius - 0.45)],
      PALETTE["glass"],
      "cupola glazed drum",
    )
    for i in range(12):
      angle = i * math.pi / 6
      px, pz = x + radius * math.cos(angle), z + radius * math.sin(angle)
      detail.lathe(
        px, pz, [(bottom, 0.19), (top, 0.19)], PALETTE["frame"], "cupola column", 8
      )
      # Muntin bands on glazing are geometry, never a raster texture.
    for y in np.arange(bottom + 0.7, top, 0.75):
      detail.lathe(
        x,
        z,
        [(y, radius - 0.415), (y + 0.055, radius - 0.415)],
        PALETTE["frame"],
        "drum glazing transom",
      )
    detail.lathe(
      x,
      z,
      [(top, radius + 0.37), (top + 0.25, radius + 0.37), (top + 0.25, radius - 0.1)],
      PALETTE["cream"],
      "cupola balcony cornice",
    )
  detail.lathe(
    x, z, [(41.7, 5.95), (42.2, 5.95)], PALETTE["stone"], "lower cupola balcony"
  )
  detail.lathe(
    x, z, [(47.8, 5.1), (48.12, 5.1)], PALETTE["stone"], "dome springing ring"
  )
  profile = [
    (
      48.12 + 4.05 * math.sin(i * math.pi / 2 / 12),
      5.05 * math.cos(i * math.pi / 2 / 12),
    )
    for i in range(13)
  ]
  detail.lathe(x, z, profile, PALETTE["copper"], "copper cupola")
  # Radial standing seams emphasize the double curvature from distant iso views.
  for j in range(24):
    angle = j * math.pi / 12
    for (y0, r0), (y1, r1) in zip(profile, profile[1:]):
      width = 0.014
      detail.polygon(
        [
          [
            x + (r0 + 0.025) * math.cos(angle - width),
            y0 + 0.02,
            z + (r0 + 0.025) * math.sin(angle - width),
          ],
          [
            x + (r0 + 0.025) * math.cos(angle + width),
            y0 + 0.02,
            z + (r0 + 0.025) * math.sin(angle + width),
          ],
          [
            x + (r1 + 0.025) * math.cos(angle + width),
            y1 + 0.02,
            z + (r1 + 0.025) * math.sin(angle + width),
          ],
          [
            x + (r1 + 0.025) * math.cos(angle - width),
            y1 + 0.02,
            z + (r1 + 0.025) * math.sin(angle - width),
          ],
        ],
        PALETTE["copperSeam"],
        "copper standing seam",
      )
  for i in range(8):
    angle = i * math.pi / 4
    detail.lathe(
      x + 0.72 * math.cos(angle),
      z + 0.72 * math.sin(angle),
      [(52.05, 0.075), (53.65, 0.075)],
      PALETTE["stone"],
      "open lantern column",
      6,
    )
  detail.lathe(
    x,
    z,
    [(53.6, 0.96), (54.4, 0.5), (54.65, 0.08)],
    PALETTE["copper"],
    "lantern cap",
    24,
  )
  detail.lathe(x, z, [(54.65, 0.06), (56.06, 0.06)], PALETTE["stone"], "finial", 8)


def building_detail(building: dict[str, Any]) -> tuple[Detail, list[dict[str, Any]]]:
  """Exact source shells except the explicitly recorded two cupola envelopes."""
  detail = Detail()
  nav = []
  warm = building["id"] in {"DEBE02YY200001O0", "DEBE02YY200002tt"}
  for part in building["parts"]:
    special = part["id"] in CUPOLA_PARTS
    grounds = []
    roof_heights = []
    for surface in part["surfaces"]:
      if surface["kind"] == "GroundSurface":
        rings = surface["rings"]
        grounds.append(
          Polygon(
            [(p[0], p[2]) for p in rings[0]],
            [[(p[0], p[2]) for p in r] for r in rings[1:]],
          )
        )
      if surface["kind"] == "RoofSurface":
        roof_heights.extend(p[1] for r in surface["rings"] for p in r)
    footprint = unary_union(grounds)
    if not roof_heights or footprint.is_empty:
      continue
    top = 34.5 if special else max(roof_heights)
    nav.append(
      {
        "sourceId": building["id"],
        "partId": part["id"],
        "geometry": footprint,
        "height": top - GROUND_Y,
        "minHeight": 0,
        "heightSource": "Berlin LoD2 part envelope; source-aligned cupola estimate"
        if special
        else "Berlin LoD2 part vertical envelope",
      }
    )
    for surface in part["surfaces"]:
      kind = surface["kind"]
      if kind not in {"RoofSurface", "WallSurface"}:
        continue
      if kind == "RoofSurface" and special:
        continue
      color = (
        PALETTE["roof"]
        if kind == "RoofSurface"
        else PALETTE["plaster" if warm else "ceramic"]
      )
      for triangle in triangulate(surface["rings"]):
        clipped = clip_polygon(triangle, 1, top, False) if special else triangle
        if len(clipped) >= 3:
          detail.polygon(clipped, color, "source " + kind)
      if kind == "WallSurface":
        wall_details(detail, surface["rings"], top, warm)
    if special:
      # The reference rotunda sits on a real square roof terrace. Keep the
      # source footprint closed around its smaller circular footing.
      for triangle in shapely.constrained_delaunay_triangles(footprint).geoms:
        detail.polygon(
          [[x, top, z] for x, z in list(triangle.exterior.coords)[:3]],
          PALETTE["roof"],
          "source-aligned tower roof terrace",
        )
      c = footprint.centroid
      cupola(detail, (c.x, c.y))
      # The footing is collidable only over its circular, reduced support.
      nav.append(
        {
          "sourceId": building["id"],
          "partId": part["id"] + "-rotunda",
          "geometry": c.buffer(6.25, quad_segs=16),
          "height": 48.12 - GROUND_Y,
          "minHeight": 34.5 - GROUND_Y,
          "heightSource": "reference-derived cupola display solid",
        }
      )
  return detail, nav


def packed_detail(detail: Detail, tile: Polygon) -> dict[str, Any] | None:
  """Clip every face to the existing chunk; no owner-chunk visibility holes."""
  minx, minz, maxx, maxz = tile.bounds
  mesh = PackedMesh(minx, minz)
  for triangle, color, _role in detail.triangles:
    if (
      max(p[0] for p in triangle) < minx
      or min(p[0] for p in triangle) > maxx
      or max(p[2] for p in triangle) < minz
      or min(p[2] for p in triangle) > maxz
    ):
      continue
    points = triangle
    for axis, edge, lower in [
      (0, minx, True),
      (0, maxx, False),
      (2, minz, True),
      (2, maxz, False),
    ]:
      points = clip_polygon(points, axis, edge, lower)
      if len(points) < 3:
        break
    for i in range(1, len(points) - 1):
      mesh.triangle([points[0], points[i], points[i + 1]], color)
  return mesh.payload("karl-marx-allee-heritage")


def native_detail(detail: Detail) -> Detail:
  """Surface-only native blocks; all faces orthogonal, no hidden solid infill."""
  cells: dict[tuple[int, int, int], tuple[int, ...]] = {}
  windows = []
  wall_color = PALETTE["ceramic"]
  for triangle, color, role in detail.triangles:
    if role in {
      "window surround",
      "window mullion",
      "stone window sill",
      "shopfront reveal",
      "shopfront frame",
      "copper standing seam",
      "drum glazing transom",
    }:
      continue
    a, b, c = np.array(triangle, dtype=float)
    normal = np.cross(b - a, c - a)
    magnitude = np.linalg.norm(normal)
    if magnitude < 1e-9:
      continue
    normal /= magnitude
    if role == "source WallSurface":
      wall_color = color
    # Keep the same occupied cells while deciding their material by the
    # projected cell centre. Any-overlap window sampling painted nearly every
    # two-metre cell dark and merged the narrow windows into glass curtains.
    if role in {"window glazing", "shopfront glazing"}:
      center = (a + b + c) / 3 + normal * 0.8
      cell = tuple(np.floor((center - np.array([0, GROUND_Y, 0])) / 2).astype(int))
      cells.setdefault(cell, wall_color)
      windows.append((cell, a, b, c, normal, color))
      continue
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.95
      ),
    )
    ii, jj = np.triu_indices(steps + 1)
    u = ii / steps
    v = (jj - ii) / steps
    samples = a + u[:, None] * (b - a) + v[:, None] * (c - a)
    indices = np.floor((samples - np.array([0, GROUND_Y, 0])) / 2).astype(int)
    for row in np.unique(indices, axis=0):
      cells[tuple(row)] = color
  for cell, a, b, c, normal, color in windows:
    center = (np.array(cell, dtype=float) + 0.5) * 2 + np.array([0, GROUND_Y, 0])
    projected = center - normal * np.dot(center - a, normal)
    ab, ac, ap = b - a, c - a, projected - a
    aa, bb, cc = np.dot(ab, ab), np.dot(ab, ac), np.dot(ac, ac)
    denominator = aa * cc - bb * bb
    if denominator <= 1e-12:
      continue
    u = (cc * np.dot(ap, ab) - bb * np.dot(ap, ac)) / denominator
    v = (aa * np.dot(ap, ac) - bb * np.dot(ap, ab)) / denominator
    if u >= -1e-8 and v >= -1e-8 and u + v <= 1 + 1e-8:
      cells[cell] = color
  output = Detail()
  # Emit only outside faces of the surface-cell set: adjacent blocks never
  # retain their internal faces. Two-metre grid is identical across chunks.
  for (ix, iy, iz), color in cells.items():
    x, y, z = ix * 2, (iy * 2) + GROUND_Y, iz * 2
    face_definitions = [
      ((-1, 0, 0), [[x, y, z], [x, y, z + 2], [x, y + 2, z + 2], [x, y + 2, z]]),
      (
        (1, 0, 0),
        [[x + 2, y, z + 2], [x + 2, y, z], [x + 2, y + 2, z], [x + 2, y + 2, z + 2]],
      ),
      ((0, -1, 0), [[x, y, z + 2], [x, y, z], [x + 2, y, z], [x + 2, y, z + 2]]),
      (
        (0, 1, 0),
        [[x, y + 2, z], [x, y + 2, z + 2], [x + 2, y + 2, z + 2], [x + 2, y + 2, z]],
      ),
      ((0, 0, -1), [[x + 2, y, z], [x, y, z], [x, y + 2, z], [x + 2, y + 2, z]]),
      (
        (0, 0, 1),
        [[x, y, z + 2], [x + 2, y, z + 2], [x + 2, y + 2, z + 2], [x, y + 2, z + 2]],
      ),
    ]
    for (dx, dy, dz), points in face_definitions:
      if (ix + dx, iy + dy, iz + dz) not in cells:
        output.polygon(points, color, "native surface block")
  return output


def mesh_signature(payload: dict[str, Any]) -> Counter[bytes]:
  """Colour and position triangle multiset, invariant under buffer reindexing."""
  result: Counter[bytes] = Counter()
  for mesh in payload["meshes"]:
    positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    )
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
    vertices = np.column_stack([positions, colors])
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    for triangle in vertices[indices]:
      result[b"".join(sorted(row.tobytes() for row in triangle))] += 1
  return result


def publish(
  output: Path = DEFAULT_OUTPUT, source_path: Path = SOURCE
) -> dict[str, Any]:
  """Regenerate only intersected packets and prove other source triangles survive."""
  source = (
    json.loads(source_path.read_text()) if source_path.exists() else extract_source()
  )
  write_json(source_path, source)
  all_details = {}
  all_nav = []
  for building in source["buildings"]:
    drawn, nav = building_detail(building)
    all_details[building["id"]] = {"drawn": drawn, "minecraft": native_detail(drawn)}
    all_nav.extend(nav)
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  scope = world(
    load_projected_polygon(
      ROOT / "geo_data/regierungsviertel/bounds.geojson"
    ).difference(
      load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
    )
  )
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  manifest = json.loads((output / "manifest.json").read_text())
  audit = []
  old_refinement = manifest.get("source", {}).get("karlMarxAllee")
  for descriptor in manifest["chunks"]:
    tile = box(*descriptor["bounds"])
    selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
    identities = PARENT_IDS.intersection(b["sourceId"] for b in selected)
    # Bounded block skin/facade projections may straddle the next tile even
    # when the source footprint does not; include the adjacent detail too.
    detail_ids = PARENT_IDS.intersection(
      b["sourceId"] for b in buildings if b["geometry"].distance(tile) < 2.1
    )
    if not detail_ids:
      continue
    ground = tile.intersection(scope)
    local = {
      kind: polygonal(shapely.make_valid(shapely.clip_by_rect(geom, *tile.bounds)))
      for kind, geom in surfaces.items()
    }
    entry = {"chunk": descriptor["id"], "sourceIds": sorted(identities)}
    for mode in ["drawn", "minecraft"]:
      original = json.loads(
        gzip.decompress((output / descriptor[mode]["url"]).read_bytes())
      )
      baseline = chunk_payload(
        descriptor["id"], tile, ground, selected, local, minecraft=mode == "minecraft"
      )
      if not old_refinement:
        assert mesh_signature(original) == mesh_signature(baseline), (
          f"Existing chunk differs from prepared source: {descriptor['id']} {mode}"
        )
        assert original["nav"] == baseline["nav"]
      payload = chunk_payload(
        descriptor["id"],
        tile,
        ground,
        selected,
        local,
        minecraft=mode == "minecraft",
        replaced_source_ids=PARENT_IDS,
      )
      unowned = mesh_signature(payload)
      detail = Detail()
      for identity in sorted(detail_ids):
        detail.triangles.extend(all_details[identity][mode].triangles)
      mesh = packed_detail(detail, tile)
      if mesh:
        payload["meshes"].append(mesh)
      for record in all_nav:
        geometry = record["geometry"].intersection(tile)
        if geometry.is_empty:
          continue
        for polygon in navigation_polygons(geometry, *tile.bounds[:2]):
          height = record["height"]
          minimum = record["minHeight"]
          if mode == "minecraft":
            height = math.ceil(height / 2) * 2 + 2
          payload["nav"]["buildings"].append(
            {
              **polygon,
              **{
                k: v
                for k, v in record.items()
                if k not in {"geometry", "height", "minHeight"}
              },
              "height": round(height, 3),
              "minHeight": round(minimum, 3),
            }
          )
      assert not (unowned - mesh_signature(payload)), "Unowned source triangles lost"
      assert [
        b for b in original["nav"]["buildings"] if b["sourceId"] not in PARENT_IDS
      ] == [b for b in payload["nav"]["buildings"] if b["sourceId"] not in PARENT_IDS]
      for key in ["ground", "water", "roads", "bridges"]:
        assert payload["nav"][key] == original["nav"][key]
      for mesh in payload["meshes"]:
        assert len(base64.b64decode(mesh["positions"])) // 6 <= 400000
        assert len(base64.b64decode(mesh["indices"])) // 4 <= 2400000
      data = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      assert len(data) < 12 * 1024 * 1024
      packed = gzip.compress(data, compresslevel=9, mtime=0)
      (output / descriptor[mode]["url"]).write_bytes(packed)
      descriptor[mode].update(
        bytes=len(packed),
        decodedBytes=len(data),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      entry[mode] = {
        "retainedUnownedTriangles": sum(unowned.values()),
        "refinedTriangles": len(base64.b64decode(payload["meshes"][-1]["indices"]))
        // 12,
        "decodedBytes": len(data),
        "bytes": len(packed),
      }
    audit.append(entry)
    print(
      descriptor["id"], entry["drawn"]["bytes"], entry["minecraft"]["bytes"], flush=True
    )
  manifest["source"]["karlMarxAllee"] = {
    "version": "1.0.61",
    "sourceIds": sorted(PARENT_IDS),
    "sourceEvidence": "geo_data/regierungsviertel/karl-marx-allee-v161.json",
    "policy": "Exact LoD2 part roofs replace only 41 named outer parent envelopes. Texture-free reference-derived facades and two explicitly approximate Frankfurter Tor cupolas. Existing other city surfaces and all unowned triangles remain unchanged. Full drawn detail identical on mobile. Source-data originals retained.",
  }
  write_json(output / "manifest.json", manifest)
  report = {
    "sourceParents": len(PARENT_IDS),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "chunks": audit,
    "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
  }
  write_json(
    ROOT / "geo_data/regierungsviertel/karl-marx-allee-v161-audit.json", report
  )
  return report


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    write_json(SOURCE, extract_source())
  print(json.dumps(publish(args.out)))


if __name__ == "__main__":
  main()
