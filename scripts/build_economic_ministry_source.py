"""Rebuild the bounded ministry source supplement from the retained LoD2 tile.

Run from the repository root after downloading the permitted source ZIP named
below. The optional DOP reference remains outside the production viewer. See
``docs/economic-ministry-refinement-v114.md`` for source roles and uncertainty.
"""

import json
from pathlib import Path
from xml.etree import ElementTree as E
from zipfile import ZipFile

from shapely import Point, Polygon, constrained_delaunay_triangles

ids = ["K00008CN", "yAAWS2KQ", "K0000EU2", "K0000B4S", "K0000A7g"]
prisms = json.loads(
  Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
)
by = {b["id"]: b for b in prisms["buildings"]}
n = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
with ZipFile("geo_data/regierungsviertel/raw/lod2/LoD2_389_5821.zip") as z:
  root = E.fromstring(z.read(z.namelist()[0]))
parts = []
for id in ids:
  b = next(
    x for x in root.iter() if x.attrib.get("{" + n["g"] + "}id", "").endswith(id)
  )
  surfaces = []
  for bound in b.findall("b:boundedBy", n):
    for s in bound:
      kind = s.tag.split("}")[-1]
      for poly in s.findall(".//g:Polygon", n):
        rings = []
        for pos in poly.findall("./g:exterior//g:posList", n) + poly.findall(
          "./g:interior//g:posList", n
        ):
          values = list(map(float, pos.text.split()))
          ring = [
            [
              round(values[i] - 389500, 3),
              values[i + 2],
              round(5820000 - values[i + 1], 3),
            ]
            for i in range(0, len(values), 3)
          ]
          if ring[-1] == ring[0]:
            ring.pop()
          rings.append(ring)
        if rings:
          surfaces.append({"kind": kind, "rings": rings})
  ground = min(
    p[1]
    for s in surfaces
    if s["kind"] == "GroundSurface"
    for r in s["rings"]
    for p in r
  )
  for s in surfaces:
    for r in s["rings"]:
      for p in r:
        p[1] = round(p[1] - ground + by[id]["y0_dm"] / 10, 3)
  parts.append(
    {
      "id": id,
      "sourceId": b.attrib["{" + n["g"] + "}id"],
      "sourceGroundM": ground,
      "viewerYOffsetM": round(by[id]["y0_dm"] / 10 - ground, 3),
      "surfaces": [s for s in surfaces if s["kind"] != "GroundSurface"],
    }
  )
main = by["K00008CN"]
poly = Polygon(
  [(x / 10, z / 10) for x, z in main["ring"]],
  holes=[[(x / 10, z / 10) for x, z in r] for r in main["holes"]],
)
eaves = 18.85
top = (main["y0_dm"] + main["h_dm"]) / 10
rise = top - eaves
triangles = []
for i in range(7):
  d0 = rise * i / 6
  d1 = rise * (i + 1) / 6
  outer = poly.buffer(-d0, join_style="mitre")
  inner = poly.buffer(-d1, join_style="mitre") if i < 6 else Polygon()
  band = outer.difference(inner)
  for t in constrained_delaunay_triangles(band).geoms:
    a = []
    for x, z in list(t.exterior.coords)[:3]:
      a.extend(
        [
          round(x, 3),
          round(min(top, eaves + poly.boundary.distance(Point(x, z))), 3),
          round(z, 3),
        ]
      )
    triangles.append(a)
result = {
  "schemaVersion": 1,
  "source": {
    "title": "Geoportal Berlin LoD2 2026-03-02, tile389_5821",
    "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5821.zip",
    "license": "dl-de/zero-2-0",
    "retrieved": "2026-09-10",
    "mapping": "x=easting-389500, z=5820000-northing, y=sourceHeight-sourceGround+retainedPrismGround",
    "dop": "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    "dopRequest": {
      "layer": "dop_2025",
      "crs": "EPSG:25833",
      "bbox": [389520, 5820990, 389840, 5821380],
      "width": 1280,
      "height": 1560,
    },
  },
  "prisms": [by[id] for id in ids + ["-3202585"]],
  "parts": parts,
  "mainRoof": {
    "status": "DOP-guided procedural pitched perimeter and court-wing subdivision; original flat roof retained above as conflicting source evidence. Local roof pitches/ridges are not surveyed.",
    "eavesM": eaves,
    "topM": top,
    "triangles": triangles,
  },
  "solar": {
    "status": "DOP2025 and owner observation confirm continuous strip on canal-facing pitch of modern tall wing; width, module count and frame divisions are procedural display estimates.",
    "sourceId": "yAAWS2KQ",
    "alongStartM": 2.1,
    "alongEndMarginM": 2.1,
    "inwardStartM": 0.55,
    "inwardEndM": 3.35,
    "columnPitchM": 1.18,
    "rows": 3,
  },
}
Path("src/app/src/economicMinistrySource.json").write_text(
  json.dumps(result, separators=(",", ":")) + "\n"
)
print(
  "parts",
  len(parts),
  "surfaces",
  sum(len(p["surfaces"]) for p in parts),
  "mainRoofTriangles",
  len(triangles),
  "bytes",
  Path("src/app/src/economicMinistrySource.json").stat().st_size,
)
