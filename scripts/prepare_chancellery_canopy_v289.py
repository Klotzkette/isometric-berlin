"""Prepare exact source receipts and original Ehrenhof canopy roof sheets."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import shapely
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
OUT = ROOT / "src/app/src/data/chancelleryCanopyV289.json"
IDS = ("K0003Umc", "1rlNcfOH")


def prepare() -> None:
  """Keep source coordinates; correct only the erroneous ground extrusion."""
  prisms = json.loads((MESH / "lod2-prisms.json").read_text())
  voxels = json.loads((MESH / "minecraft-voxels.json").read_text())
  archive = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5820.zip"
  with zipfile.ZipFile(archive) as source_zip:
    xml_name = source_zip.namelist()[0]
    xml = source_zip.read(xml_name)
  root = ET.fromstring(xml)
  gid = "{http://www.opengis.net/gml}id"
  roofs: list[dict] = []
  source_summary = []
  datum = 5.1 - 33.951
  for source_id in ("DEBE01YYK0003Umc", "DEBE3Djn1rlNcfOH"):
    owner = next(e for e in root.iter() if e.get(gid) == source_id)
    counts: dict[str, int] = {}
    for surface in owner.iter():
      kind = surface.tag.split("}")[-1]
      if kind not in {"RoofSurface", "WallSurface", "GroundSurface", "ClosureSurface"}:
        continue
      counts[kind] = counts.get(kind, 0) + 1
      if kind != "RoofSurface":
        continue
      for polygon in surface.findall(".//{http://www.opengis.net/gml}Polygon"):
        rings = []
        for pos in polygon.findall(".//{http://www.opengis.net/gml}posList"):
          numbers = list(map(float, pos.text.split()))
          ring = [
            [
              round(numbers[i] - 389500, 3),
              round(numbers[i + 2] + datum, 3),
              round(5820000 - numbers[i + 1], 3),
            ]
            for i in range(0, len(numbers), 3)
          ]
          if ring[0] == ring[-1]:
            ring.pop()
          rings.append(ring)
        points = [p for ring in rings for p in ring]
        lookup = {(p[0], p[2]): i for i, p in enumerate(points)}
        polygon_2d = Polygon(
          [(p[0], p[2]) for p in rings[0]],
          [[(p[0], p[2]) for p in r] for r in rings[1:]],
        )
        triangles = []
        for triangle in shapely.get_parts(
          shapely.constrained_delaunay_triangles(polygon_2d)
        ):
          triangles.append(
            [lookup[(x, z)] for x, z in list(triangle.exterior.coords)[:3]]
          )
        roofs.append(
          {
            "sourceId": source_id,
            "surfaceId": surface.get(gid),
            "polygonId": polygon.get(gid),
            "rings": rings,
            "triangles": triangles,
          }
        )
    source_summary.append(
      {
        "id": source_id,
        "surfaceCounts": counts,
        "originalElementSha256": hashlib.sha256(ET.tostring(owner)).hexdigest(),
      }
    )
  old = [b for b in prisms["buildings"] if b["id"] in IDS]
  bounds = {"minXIdx": -33, "maxXIdx": -25, "minZIdx": -42, "maxZIdx": -30}
  columns = []
  for iz in range(bounds["minZIdx"], bounds["maxZIdx"] + 1):
    for offset, length, low, high, kind in voxels["building_rows"][
      iz - voxels["grid"]["min_z_idx"]
    ]:
      start = voxels["grid"]["min_x_idx"] + offset
      for ix in range(
        max(bounds["minXIdx"], start), min(bounds["maxXIdx"] + 1, start + length)
      ):
        columns.append([ix, iz, low, high, kind])
  corridor = box(-136, -172, -96, -116)
  neighbours = []
  for part in prisms["buildings"]:
    poly = shapely.make_valid(
      Polygon(
        [(x / 10, z / 10) for x, z in part["ring"]],
        [[(x / 10, z / 10) for x, z in r] for r in part.get("holes", [])],
      )
    )
    if poly.intersection(corridor).area > 1e-8:
      neighbours.append((part, poly))
  exclusive = []
  shared = []
  for column in columns:
    ix, iz = column[:2]
    cell = box(ix * 4, iz * 4, (ix + 1) * 4, (iz + 1) * 4)
    owners = [
      part["id"] for part, poly in neighbours if poly.intersection(cell).area > 1e-8
    ]
    if set(owners).intersection(IDS):
      if set(owners).issubset(IDS):
        exclusive.append(column)
      else:
        shared.append({"column": column, "owners": owners})
  result = {
    "schemaVersion": 1,
    "source": {
      "archive": str(archive.relative_to(ROOT)),
      "xml": xml_name,
      "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "xmlSha256": hashlib.sha256(xml).hexdigest(),
      "surfaces": source_summary,
      "sourceDatumNHN": 33.951,
      "displayGroundY": 5.1,
      "rigidYTranslationM": round(datum, 3),
      "geometryStatus": "Original Berlin LoD2 roof vertices and constrained triangles, rigidly aligned to retained courtyard ground; zero footprint simplification. Original closed wall sheets remain in the retained source archive. Glazing, membrane thickness and slender fittings are photo-guided display interpretations.",
    },
    "oldPrisms": old,
    "retainedPrisms": [part for part, _ in neighbours if part["id"] not in IDS],
    "native": {
      "schema": voxels["schema_version"],
      "cellM": voxels["cell_m"],
      "grid": voxels["grid"],
      "classes": voxels["classes"],
      "bounds": bounds,
      "columns": columns,
      "exclusiveColumns": exclusive,
      "sharedColumns": shared,
    },
    "roofs": roofs,
  }
  OUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(
    f"{OUT}: {OUT.stat().st_size} bytes; {len(exclusive)} exclusive native columns; {len(shared)} shared columns retained"
  )


if __name__ == "__main__":
  prepare()
