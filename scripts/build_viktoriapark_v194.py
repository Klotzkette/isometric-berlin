"""Step 10: retained metric source for the Kreuzberg monument and cascade."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_park_relief_v182 import sample
from shapely.affinity import affine_transform
from shapely.geometry import mapping

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
DEST = DATA / "viktoriaparkV194.json"
PARENT = "DEBE02YY400001Vu"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
BBOX = (13.376, 52.486, 13.384, 52.49)


def tags(row: dict) -> dict:
  """Decode the retained OGR OSM tags without guessing missing dimensions."""
  result = {
    k: v
    for k, v in row.items()
    if k not in ("geometry", "other_tags") and v is not None and str(v) != "nan"
  }
  result.update(
    dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(row.get("other_tags") or "")))
  )
  return result


def make_payload() -> dict:
  """Small OSM rings and full official base surfaces, never photo textures."""
  source = GEO / "raw/outer-v159/candidate.gpkg"
  source_pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  features = []
  wanted = {
    "31791743",
    "9874451",
    "544767",
    "16749494",
    "1066660520",
    "1039863704",
    "1039863703",
    "171168191",
  }
  for layer in ["multipolygons", "lines"]:
    frame = gpd.read_file(source, layer=layer, bbox=BBOX).to_crs(25833)
    for _, r in frame.iterrows():
      t = tags(r)
      oid = t.get("osm_way_id") or t.get("osm_id")
      centre = r.geometry.centroid
      if layer == "multipolygons":
        if oid not in wanted:
          continue
      elif not (
        390070 < centre.x < 390175
        and 5816480 < centre.y < 5816740
        and (t.get("highway") == "steps" or oid in {"51166738", "33284443"})
      ):
        continue
      world = affine_transform(r.geometry, [1, 0, 0, -1, -389500, 5820000])
      features.append(
        {
          "id": (
            "relation/"
            if layer == "multipolygons" and not t.get("osm_way_id")
            else "way/"
          )
          + oid,
          "tags": t,
          "geometry": mapping(world),
        }
      )
  point_frame = gpd.read_file(source_pbf, layer="points", bbox=BBOX).to_crs(25833)
  points = []
  for _, row in point_frame.iterrows():
    t = tags(row)
    if t["osm_id"] not in {"241490725", "355920610", "1578634748", "9574969111"}:
      continue
    points.append(
      {
        "id": "node/" + t["osm_id"],
        "tags": t,
        "point": [
          round(row.geometry.x - 389500, 5),
          round(5820000 - row.geometry.y, 5),
        ],
      }
    )
  source_zip = GEO / "raw/lod2/LoD2_390_5816.zip"
  surfaces = []
  with zipfile.ZipFile(source_zip) as zipped:
    with zipped.open(zipped.namelist()[0]) as stream:
      for _, element in ET.iterparse(stream, events=["end"]):
        if not element.tag.endswith("}Building"):
          continue
        if element.attrib.get("{" + NS["g"] + "}id") != PARENT:
          element.clear()
          continue
        for kind in ["GroundSurface", "WallSurface", "RoofSurface"]:
          for surface in element.findall(".//b:" + kind, NS):
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for pos in polygon.findall(".//g:posList", NS):
                a = np.fromstring(pos.text, sep=" ").reshape(-1, 3)
                rings.append(
                  [
                    [round(x - 389500, 3), round(y - 30, 3), round(5820000 - z, 3)]
                    for x, z, y in a
                  ]
                )
              surfaces.append(
                {
                  "kind": kind,
                  "sourcePolygonId": polygon.attrib["{" + NS["g"] + "}id"],
                  "rings": rings,
                  "triangles": triangles_for(rings),
                }
              )
        break
  profile = json.loads((DATA / "parkReliefV182.json").read_text())["profiles"][0]
  assert profile["name"] == "Viktoriapark" and len(surfaces) > 10
  anchor = next(p["point"] for p in points if p["id"] == "node/241490725")
  baseline_packet = json.loads(
    gzip.decompress(
      subprocess.check_output(
        [
          "git",
          "show",
          "v1.0.93:src/app/public/mesh/surrounding-berlin-v159/1_6.drawn.json.gz",
        ],
        cwd=ROOT,
      )
    )
  )
  ox, _, oz = baseline_packet["origin"]
  water_rings = [
    [[round(x + ox, 2), round(z + oz, 2)] for x, z in ring]
    for pond in baseline_packet["nav"]["water"]
    for ring in [pond["ring"], *pond["holes"]]
  ]
  return {
    "schemaVersion": 1,
    "waterRings": water_rings,
    "parentId": PARENT,
    "anchor": anchor,
    "baseGroundY": min(p[1] for s in surfaces for ring in s["rings"] for p in ring),
    "baseTopY": max(p[1] for s in surfaces for ring in s["rings"] for p in ring),
    "ironHeightM": 18,
    "existingGroundY": round(3 + sample(profile, *anchor), 6),
    "surfaces": surfaces,
    "features": features,
    "points": points,
    "sources": {
      "lod2Url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5816.zip",
      "lod2Sha256": hashlib.sha256(source_zip.read_bytes()).hexdigest(),
      "terrainSha256": hashlib.sha256(
        (DATA / "parkReliefV182.json").read_bytes()
      ).hexdigest(),
      "osm": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    },
    "policy": "Exact retained LoD2 base shell replaces only its coarse proxy. Existing 10m DGM hill and all unrelated geometry stay unchanged. Iron subdivisions, figures, rock shapes and untagged rail/stair widths are reference-guided display estimates; OSM rings and tagged step counts are retained.",
    "heightConflict": "DSD conservation account specifies an 18m iron finial. BiB lists22m without an unambiguous base datum. Use DSD18m above the measured octagonal base, not22m plus an invented pedestal.",
    "factSources": [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031258",
      "https://www.denkmalschutz.de/denkmal/kreuzbergdenkmal.html",
      "https://bildhauerei-in-berlin.de/bildwerk/denkmal-der-befreiungskriege-5177/",
      "https://www.berlin.de/tourismus/parks-und-gaerten/3560783-1740419-viktoriapark.html",
    ],
  }


if __name__ == "__main__":
  result = make_payload()
  DEST.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    DEST.name,
    DEST.stat().st_size,
    "bytes;",
    len(result["surfaces"]),
    "surfaces;",
    len(result["features"]),
    "OSM features",
  )
