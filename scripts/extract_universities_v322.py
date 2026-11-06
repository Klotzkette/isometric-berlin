"""Retain complete official families inside finite mapped university sites.

This extractor never edits a previous source, packet, coverage or model. Campus
polygons establish identity; the complete official family establishes geometry.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import shapely
from pyproj import Transformer
from shapely.geometry import Polygon, mapping
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import part_profile

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUTPUT = GEO / "universities-v322-source.json.gz"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
SITES = {
  "hu-grimm-hegel": ["43174774", "47293194", "486200232"],
  "fu-henry-ford": ["28848503"],
  "tu-mathematik": ["40451892"],
  "tu-architektur": ["40451513", "40451510"],
  "tu-udk-bibliothek": ["28492570"],
  "fu-holzlaube": ["4844277"],
  "hwr-schoeneberg": ["8422596"],
  "bht-wedding": ["4751140"],
  "hu-adlershof": ["17857502"],
  "htw-treskowallee": ["151370246"],
  "ash-main": ["690171013"],
  "ash-extension": ["1227439417", "982919760"],
  "ehb": ["30432728"],
  "khsb": ["42505551"],
  "hwr-lichtenberg": [
    "31625922",
    "31626223",
    "31626291",
    "31626309",
    "31626352",
    "31626144",
  ],
  "udk-hardenberg": ["395094", "32510898"],
  "weissensee": ["59359987"],
  "htw-wilhelminenhof": ["25346348", "32636540", "32636569", "407280948", "137980000"],
}


def sha(path):
  return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def gpkg_geometry(blob):
  envelope = (blob[3] >> 1) & 7
  return shapely.from_wkb(blob[8 + [0, 32, 48, 48, 64][envelope] :])


def world(x, y, z=None):
  east, north = PROJECT(x, y)
  return east - 389500, 5820000 - north


def mapped_sites():
  path = GEO / "raw/outskirts-v187/candidate.gpkg"
  database = sqlite3.connect(path)
  result = {}
  for key, ids in SITES.items():
    records = []
    for identity in ids:
      rows = database.execute(
        "SELECT osm_id,osm_way_id,name,building,other_tags,geom FROM multipolygons WHERE osm_id=? OR osm_way_id=?",
        (identity, identity),
      ).fetchall()
      if len(rows) != 1:
        raise ValueError((key, identity, "Mapped identity is not unique"))
      relation, way, name, building, tags, geometry = rows[0]
      records.append(
        {
          "id": ("relation/" + relation if relation else "way/" + way),
          "name": name,
          "building": building,
          "tags": tags,
          "geometry": mapping(transform(world, gpkg_geometry(geometry))),
        }
      )
    result[key] = {"mapped": records, "families": []}
  return result, {"path": str(path.relative_to(ROOT)), "sha256": sha(path)}


def extract():
  sites, osm_source = mapped_sites()
  polygons = {
    key: unary_union([shapely.geometry.shape(r["geometry"]) for r in site["mapped"]])
    for key, site in sites.items()
  }
  wanted = {}
  for key, polygon in polygons.items():
    lo_x, lo_z, hi_x, hi_z = polygon.bounds
    for east in range(int((lo_x + 389500) // 1000), int((hi_x + 389500) // 1000) + 1):
      for north in range(
        int((5820000 - hi_z) // 1000), int((5820000 - lo_z) // 1000) + 1
      ):
        wanted.setdefault(f"{east}_{north}", []).append(key)
  archives = {}
  for path in sorted((GEO / "raw").rglob("LoD2_*.zip")):
    archives.setdefault(path.stem[5:], path)
  sources = []
  seen = set()
  for tile, keys in sorted(wanted.items()):
    if tile not in archives:
      raise ValueError((tile, "Exact named-campus archive missing"))
    path = archives[tile]
    digest = sha(path)
    sources.append(
      {
        "tile": tile,
        "path": str(path.relative_to(ROOT)),
        "sha256": digest,
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      }
    )
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with archive.open(name) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = parent.get(GML_ID)
            profiles = None
            for key in keys:
              if (key, identity) in seen:
                continue
              campus = polygons[key]
              # Test a source GroundSurface before retaining any complete family.
              leaves = leaf_building_parts(parent) or [parent]
              matched = False
              for leaf in leaves:
                ground = leaf.find(
                  ".//bldg:GroundSurface//gml:exterior//gml:posList", NS
                )
                if ground is None:
                  continue
                values = list(map(float, ground.text.split()))
                ring = [
                  (values[i] - 389500, 5820000 - values[i + 1])
                  for i in range(0, len(values), 3)
                ]
                footprint = Polygon(ring)
                if (
                  footprint.is_valid
                  and footprint.area > 2
                  and campus.intersects(footprint)
                  and campus.intersection(footprint).area / footprint.area > 0.55
                ):
                  matched = True
                  break
              if not matched:
                continue
              if profiles is None:
                profiles = [part_profile(leaf) for leaf in leaves]
              sites[key]["families"].append(
                {
                  "id": identity,
                  "tile": tile,
                  "archiveSha256": digest,
                  "parts": profiles,
                }
              )
              seen.add((key, identity))
            parent.clear()
    print(tile, {key: len(sites[key]["families"]) for key in keys}, flush=True)
  # The current ASH extension postdates this official LoD2 edition. Its mapped
  # footprint remains evidence; a later display model must label its vertical
  # dimensions as estimates rather than inventing an official source family.
  if any(not site["families"] for key, site in sites.items() if key != "ash-extension"):
    raise ValueError("A named university site has no complete official family")
  return {
    "schemaVersion": 1,
    "sourceBaseline": "c3f8ca120908d264ab5921f1fe090b4bf2db3767",
    "osmSource": osm_source,
    "archives": sources,
    "sites": sites,
  }


if __name__ == "__main__":
  result = extract()
  raw = (json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n").encode()
  OUTPUT.write_bytes(gzip.compress(raw, mtime=0))
  print(OUTPUT.name, len(raw), OUTPUT.stat().st_size)
