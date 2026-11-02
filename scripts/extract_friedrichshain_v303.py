"""Extract four exact retained-source families; original archives remain unchanged."""

import gzip
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile

R = Path(__file__).resolve().parents[1]
G = R / "geo_data/regierungsviertel"
OUTPUT = R / "src/app/public/mesh/surrounding-berlin-v159"
targets = {
  "OSM-way-444562270": ("Boxhagener Straße 70", "ring182-12_2"),
  "OSM-way-444562271": ("Boxhagener Straße 71", "ring182-12_2"),
  "OSM-way-32539802": ("Boxhagener Straße 72", "ring182-12_2"),
  "OSM-way-606036708": ("Bänschstraße 74", "ring182-12_0"),
}
old = {}
for own, (adr, p) in targets.items():
  raw = json.loads(gzip.decompress((OUTPUT / f"{p}.drawn.json.gz").read_bytes()))
  bs = [b for b in raw["nav"]["buildings"] if b["sourceId"] == own]
  shape = unary_union(
    [
      Polygon([[x + raw["origin"][0], z + raw["origin"][2]] for x, z in b["ring"]])
      for b in bs
    ]
  )
  old[own] = (shape, adr, p)
parents = []
archives = []
for fn in ["LoD2_396_5818.zip", "LoD2_396_5819.zip"]:
  path = G / "raw/lod2" / fn
  archives.append(
    {
      "file": str(path.relative_to(R)),
      "url": "https://gdi.berlin.de/data/a_lod2/atom/" + fn,
      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
  )
  with zipfile.ZipFile(path) as z:
    mem = next(n for n in z.namelist() if n.lower().endswith((".gml", ".xml")))
    with z.open(mem) as stream:
      for _, elem in ET.iterparse(stream, events=("end",)):
        if elem.tag != f"{{{NS['bldg']}}}Building":
          continue
        rings = []
        for ground in elem.findall(".//bldg:GroundSurface//gml:Polygon", NS):
          pos = ground.find("gml:exterior//gml:posList", NS)
          if pos is None:
            continue
          v = list(map(float, pos.text.split()))
          rings.append(
            Polygon([(x - 389500, 5820000 - y) for x, y in zip(v[::3], v[1::3])])
          )
        shape = unary_union(rings)
        for own, (poly, adr, p) in old.items():
          area = shape.intersection(poly).area
          if area / poly.area > 0.5:
            parts = [part_profile(x) for x in leaf_building_parts(elem) or [elem]]
            parents.append(
              {
                "id": elem.get(GML_ID),
                "parts": parts,
                "owner": own,
                "address": adr,
                "packet": p,
                "coverage": area / poly.area,
                "oldArea": poly.area,
                "archive": fn,
              }
            )
        elem.clear()
res = {"schemaVersion": 1, "archives": archives, "parents": parents}
out = G / "friedrichshain-v303-source.json.gz"
out.write_bytes(gzip.compress(json.dumps(res, separators=(",", ":")).encode(), mtime=0))
print(
  [
    (
      p["address"],
      p["id"],
      len(p["parts"]),
      p["coverage"],
      [(v["top_y_m"] - v["ground_y_m"]) for v in p["parts"]],
    )
    for p in parents
  ]
)
print(out.stat().st_size)
