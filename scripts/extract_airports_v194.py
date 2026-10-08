"""Re-extract only the six exact THF source parents and mapped former airport context."""

import argparse
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon, shape

sys.path.insert(0, "scripts")
import build_surrounding_outlines as e

from isometric_berlin.data.fetch_lod2 import GML_ID, NS

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
  "--output",
  type=Path,
  default=ROOT / "geo_data/regierungsviertel/airports-v194-source.json",
)
out = parser.parse_args().output
features = []
for site, bbox in [
  ("tegel", (13.25, 52.547, 13.32, 52.575)),
  ("tempelhof", (13.38, 52.472, 13.407, 52.49)),
]:
  for layer in ["multipolygons", "lines"]:
    d = gpd.read_file(RAW / "outer-v159/candidate.gpkg", layer=layer, bbox=bbox).to_crs(
      25833
    )
    for _, r in d.iterrows():
      t = e.tags_for(r)
      ident = (
        "way/" + str(r.osm_id)
        if layer == "lines"
        else e.source_identity(r)
        .replace("OSM-way-", "way/")
        .replace("OSM-relation-", "relation/")
      )
      select = (
        site == "tegel"
        and (
          ident
          in [
            "relation/13234",
            "relation/611684",
            "way/24378140",
            "way/24378177",
            "way/24378279",
            "way/56455515",
            "way/56459643",
          ]
          or any(t.get(k) == "runway" for k in ["abandoned:aeroway", "disused:aeroway"])
        )
      ) or (
        site == "tempelhof"
        and (
          ident in ["relation/10466358", "way/1416928765", "way/181407909"]
          or t.get("building:part")
          and r.geometry.is_ring
        )
      )
      if select:
        from shapely.geometry import mapping

        features.append(
          {
            "site": site,
            "id": ident,
            "tags": t,
            "geometry": mapping(e.world(r.geometry)),
          }
        )
parents = []
ids = {
  "DEBE07YY90002daO",
  "DEBE07YY9000088X",
  "DEBE07YY900008Ks",
  "DEBE07YY900002ol",
  "DEBE07YY90002dsj",
  "DEBE07YY90002dwR",
}
tiles = []
for tile in ["390_5815", "390_5816", "391_5815", "391_5816"]:
  p = RAW / f"lod2/LoD2_{tile}.zip"
  tiles.append(
    {
      "file": p.name,
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/{p.name}",
      "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
    }
  )
  with zipfile.ZipFile(p) as z:
    for n in z.namelist():
      if not n.endswith((".gml", ".xml")):
        continue
      with z.open(n) as stream:
        for _, b in ET.iterparse(stream, events=("end",)):
          if b.tag != f"{{{NS['bldg']}}}Building":
            continue
          if b.get(GML_ID) not in ids:
            b.clear()
            continue
          values = [
            float(v)
            for pos in b.findall(".//gml:posList", NS)
            for v in (pos.text or "").split()[2::3]
          ]
          datum = min(values)
          surfaces = []
          for surface in b.iter():
            kind = surface.tag.split("}")[-1]
            if kind not in [
              "RoofSurface",
              "WallSurface",
              "GroundSurface",
              "ClosureSurface",
            ]:
              continue
            for poly in surface.findall(".//gml:Polygon", NS):
              rings = []
              for pos in poly.findall(".//gml:posList", NS):
                v = list(map(float, (pos.text or "").split()))
                ring = [
                  [
                    round(v[i] - 389500, 3),
                    round(v[i + 2] - datum + 3, 3),
                    round(5820000 - v[i + 1], 3),
                  ]
                  for i in range(0, len(v), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              surfaces.append({"kind": kind, "id": poly.get(GML_ID), "rings": rings})
          parents.append(
            {
              "id": b.get(GML_ID),
              "tile": p.name,
              "datumNHN": datum,
              "height": max(values) - datum,
              "surfaces": surfaces,
            }
          )
          b.clear()

terminal = shape(
  next(f["geometry"] for f in features if f["id"] == "relation/10466358")
)
features = [
  f
  for f in features
  if f["site"] == "tegel"
  or f["geometry"]["type"] != "LineString"
  or Polygon(f["geometry"]["coordinates"]).intersection(terminal).area > 10
]
print(
  {
    "parents": len(parents),
    "sourceSurfaces": sum(len(p["surfaces"]) for p in parents),
    "features": len(features),
  }
)
out.write_text(
  json.dumps(
    {
      "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "osmSha256": "9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9",
      "features": features,
      "lod2Tiles": tiles,
      "parents": parents,
    },
    separators=(",", ":"),
  )
)
