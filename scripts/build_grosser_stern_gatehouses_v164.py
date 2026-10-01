"""Step 10: retain eight LoD2 gatehouse parts and their four OSM identities.

The source export stays uncorrected. The separate presentation profile uses
measured plans and reference-bounded elevations because eastern roofs contain
incompatible 16–20 m heights. No raw source is silently discarded.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw"
DEST = ROOT / "src/app/src/data/grosserSternGatehousesV164Source.json"
GROUND = 5.245
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
HOUSES = [
  ("north-west", "106952577", "K0002QbK", "K0003UBR", 1),
  ("south-west", "106952579", "K0002ODQ", "K0003Url", -1),
  ("south-east", "106953928", "K0002UGA", "K0003UFM", -1),
  ("north-east", "106953934", "K0002Ovc", "K0003VYp", 1),
]


def make_payload() -> dict:
  """Return source evidence and explicit, independently authored display fits."""
  ids = {v for h in HOUSES for v in h[2:4]}
  parts = []
  archives = []
  for tile in ["387_5819", "388_5819"]:
    path = RAW / f"lod2/LoD2_{tile}.zip"
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "license": "dl-de/zero-2-0",
      }
    )
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    for b in tree.findall(".//b:Building", NS):
      identity = b.get("{" + NS["g"] + "}id")
      if identity.removeprefix("DEBE01YY") not in ids:
        continue
      surfaces = []
      for boundary in b.findall("b:boundedBy", NS):
        for s in boundary:
          for poly in s.findall(".//g:Polygon", NS):
            rings = []
            for pos in poly.findall(".//g:posList", NS):
              values = list(map(float, pos.text.split()))
              r = [
                [
                  round(values[i] - 389500, 3),
                  values[i + 2],
                  round(5820000 - values[i + 1], 3),
                ]
                for i in range(0, len(values), 3)
              ]
              if r[0] == r[-1]:
                r.pop()
              rings.append(r)
            surfaces.append(
              {"kind": s.tag.rsplit("}", 1)[-1], "ringsWorldXZandNHN": rings}
            )
      foot = next(
        s["ringsWorldXZandNHN"][0] for s in surfaces if s["kind"] == "GroundSurface"
      )
      parts.append(
        {
          "id": identity,
          "legacyId": identity.removeprefix("DEBE01YY"),
          "footprint": [[p[0], p[2]] for p in foot],
          "sourceSurfaces": surfaces,
        }
      )
  houses = []
  project = Transformer.from_crs(4326, 25833, always_xy=True)
  for name, oid, body_id, portico_id, side in HOUSES:
    tree = ET.parse(RAW / f"gatehouses-v164/way-{oid}.xml")
    nodes = {
      n.get("id"): project.transform(float(n.get("lon")), float(n.get("lat")))
      for n in tree.findall("node")
    }
    w = tree.find("way")
    ring = [
      [
        round(nodes[n.get("ref")][0] - 389500, 3),
        round(5820000 - nodes[n.get("ref")][1], 3),
      ]
      for n in w.findall("nd")
    ]
    body = next(p for p in parts if p["legacyId"] == body_id)
    portico = next(p for p in parts if p["legacyId"] == portico_id)
    a, c = Polygon(body["footprint"]).centroid, Polygon(portico["footprint"]).centroid
    # z runs from the stair hall to its road-facing portico; x remains right-handed.
    fx, fz = c.x - a.x, c.y - a.y
    length = math.hypot(fx, fz)
    fx, fz = fx / length, fz / length
    ux, uz = fz, -fx
    projected = [
      ((x - a.x) * ux + (z - a.y) * uz, (x - a.x) * fx + (z - a.y) * fz)
      for x, z in body["footprint"]
    ]
    width = max(p[0] for p in projected) - min(p[0] for p in projected)
    depth = max(p[1] for p in projected) - min(p[1] for p in projected)
    houses.append(
      {
        "name": name,
        "osmId": oid,
        "osmTags": {n.get("k"): n.get("v") for n in w.findall("tag")},
        "osmFootprint": ring,
        "bodyId": body_id,
        "porticoId": portico_id,
        "center": [round(a.x, 3), round(a.y, 3)],
        "right": [round(ux, 8), round(uz, 8)],
        "front": [round(fx, 8), round(fz, 8)],
        "widthM": round(width, 3),
        "bodyDepthM": round(depth, 3),
        "porticoDepthM": 2.2,
        "eaveM": 6.65,
        "ridgeM": 7.98,
        "groundY": GROUND,
        "presentationStatus": "Measured LoD2 ground planes; uniform reference-bounded elevation fitted to western 7.9–8.4 m roofs. Eastern 16.6–19.9 m raw roofs retained as documented conflicts, not presented as real buildings.",
      }
    )
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  return {
    "schemaVersion": 1,
    "archives": archives,
    "houses": houses,
    "parts": parts,
    "legacyPrisms": [p for p in prisms if p["id"] in ids],
    "heritageUrl": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419",
    "referenceElevationStatus": "Procedural fit; source roots remain complete. Broad shallow front pediments, square piers and ashlar/upper windows are photograph-based recognition cues, not measured elevations.",
  }


if __name__ == "__main__":
  payload = make_payload()
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    f"{len(payload['houses'])} houses / {len(payload['parts'])} retained parts / {DEST.stat().st_size} bytes"
  )
