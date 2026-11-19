"""Reconcile the 60/61 cultural ensemble with the retained prism and cardinal shells."""

import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "src/app/src/data"
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_388_5821.zip"
PARENTS = {"DEBE01YYK0002PaQ", "DEBE01YYK0002O7J", "DEBE01YYK0002QDt"}
GML_ID = "{http://www.opengis.net/gml}id"
# The two old complex-roof parts had been capped at ridge level. Both measured
# lower shells terminate in a single horizontal plane.
PITCHED = {"24ruzruS", "mO1M4nzw"}


def roof(part, prism):
  def rings(sheet):
    return [
      np.asarray([float(t) for t in p.text.split()]).reshape(-1, 3)[:-1]
      for p in sheet.findall(".//{*}posList")
    ]

  ground = rings(part.find(".//{*}GroundSurface"))[0][0, 2]
  vertices = []
  indices = []
  eave = math.inf
  surfaces = part.findall(".//{*}RoofSurface")
  for surface in surfaces:
    coords = []
    for ring in rings(surface):
      ring = [
        [
          round(e - 389500, 3),
          round(prism["y0_dm"] / 10 + up - ground, 3),
          round(5820000 - n, 3),
        ]
        for e, n, up in ring
      ]
      coords.append(ring)
      eave = min(eave, *(p[1] for p in ring))
    for triangle in triangles_for(coords):
      v = np.asarray(triangle)
      if np.cross(v[1] - v[0], v[2] - v[0])[1] < 0:
        triangle.reverse()
      for point in triangle:
        quant = [round(c * 1000) for c in point]
        if quant not in vertices:
          vertices.append(quant)
        indices.append(vertices.index(quant))
  return {
    "eaveMm": round(eave * 1000),
    "positionsMm": vertices,
    "indices": indices,
    "sourceSheets": len(surfaces),
  }


def main():
  prism_list = json.loads((PUBLIC / "lod2-prisms.json").read_text())["buildings"]
  old = {p["id"]: p for p in prism_list}
  polygons = {
    k: Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    for k, p in old.items()
    if p["ring"]
  }
  voxel = json.loads((PUBLIC / "minecraft-voxels.json").read_text())
  grid = voxel["grid"]
  buildings = {}
  roofs = {}
  with zipfile.ZipFile(ARCHIVE) as archive:
    city = ET.fromstring(archive.read(archive.namelist()[0]))
  for parent in city.findall(".//{*}Building"):
    if parent.get(GML_ID) not in PARENTS:
      continue
    for part in parent.findall(".//{*}BuildingPart"):
      key = part.get(GML_ID)[-8:]
      buildings[key] = old[key]
      if key in PITCHED:
        roofs[key] = roof(part, old[key])
  assert len(buildings) == 12 and set(roofs) == PITCHED
  # Each edge is an exposed measured face seen in the architectural photos.
  # Counts on the court front follow its published east elevation. Elsewhere
  # omitted/recessed/repeating bays are interpreted, not measured apertures.
  tagged = {
    "mO1M4nzw": [(19, "atelier", 4), (21, "atelier", 2), (23, "oriel", 3)],
    "24ruzruS": [
      (8, "music-front", 18),
      (0, "music-yard", 5),
      (2, "music-yard", 5),
      (4, "music-yard", 5),
      (5, "music-yard", 7),
      (6, "music-end", 1),
      (10, "music-end", 1),
      (11, "music-yard", 3),
    ],
    "ia66KyBc": [(7, "court", 4), (11, "court", 4), (3, "court-entry", 1)],
    "TluIell9": [(2, "court-end", 1)],
    "7s8cBB6l": [(0, "court-end", 1)],
  }
  records = []

  def cells(x, z):
    if not 0 <= z - grid["min_z_idx"] < len(voxel["building_rows"]):
      return []
    return [
      row[2:]
      for row in voxel["building_rows"][z - grid["min_z_idx"]]
      if row[0] <= x - grid["min_x_idx"] < row[0] + row[1]
    ]

  for key, faces in tagged.items():
    p = buildings[key]
    poly = polygons[key]
    for index, style, bays in faces:
      a = np.array(p["ring"][index]) / 10
      b = np.array(p["ring"][(index + 1) % len(p["ring"])]) / 10
      d = b - a
      d /= np.linalg.norm(d)
      normal = np.array([d[1], -d[0]])
      if poly.contains(Point((a + b) / 2 + normal * 0.04)):
        normal *= -1
      line = LineString([a, b])
      normalside = -1 if d[0] * normal[1] - d[1] * normal[0] < 0 else 1
      close = [g for id, g in polygons.items() if id != key and g.distance(line) < 3.1]
      cutters = unary_union([g for g in close if g.is_valid])
      # The court's two projecting ends partly cover its main long facet.
      visible = LineString([a + normal * 0.1, b + normal * 0.1]).difference(cutters)
      spans = []
      for piece in getattr(visible, "geoms", [visible]):
        if piece.geom_type != "LineString" or piece.length < 1.1:
          continue
        spans.append(
          sorted(
            round(float((np.array(q) - a) @ d), 3)
            for q in [piece.coords[0], piece.coords[-1]]
          )
        )
      if not spans:
        continue
      native = []
      x0, z0, x1, z1 = line.bounds
      for x in range(math.floor((x0 - 3) / 4), math.ceil((x1 + 3) / 4)):
        for z in range(math.floor((z0 - 3) / 4), math.ceil((z1 + 3) / 4)):
          column = cells(x, z)
          if len(column) != 1:
            continue
          cx, cz = x * 4 + 2, z * 4 + 2
          # At least half of the cell belongs to this exact host.
          cell = box(cx - 2, cz - 2, cx + 2, cz + 2)
          if poly.intersection(cell).area < 8.0:
            continue
          for dx, dz in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            if normal @ [dx, dz] < 0.34 or cells(x + dx, z + dz):
              continue
            m = np.array([cx + 2 * dx, cz + 2 * dz])
            u = (m - a) @ d
            if abs((m - a) @ normal) > 2.65 or not any(
              lo - 0.5 <= u <= hi + 0.5 for lo, hi in spans
            ):
              continue
            native.append([x, z, dx, dz, *column[0]])
      records.append(
        dict(
          owner=key,
          edge=index,
          style=style,
          bays=bays,
          side=normalside,
          spans=spans,
          native=native,
        )
      )
  for name, value in [
    ("lehrterKulturhausOwnersV366", buildings),
    ("lehrterKulturhausRoofsV366", roofs),
    ("lehrterKulturhausFrontsV366", records),
  ]:
    (DATA / f"{name}.json").write_text(json.dumps(value, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
