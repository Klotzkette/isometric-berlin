"""Refresh the exact existing-core Wedding source receipt from retained caches.

Only two small official 1 km LoD2 archives and a bounded retained OSM read are
needed. This extractor neither downloads data nor rebuilds any existing asset.
"""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)
from scripts.build_bebelplatz_building_source import part_profile

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
BBOX = (13.35, 52.537, 13.395, 52.553)
T = Transformer.from_crs(4326, 25833, always_xy=True)


def world(g):
  def f(x, y, z=None):
    xx, yy = T.transform(x, y)
    return xx - 389500, 5820000 - yy

  return transform(f, g)


def clean(v):
  if hasattr(v, "item"):
    v = v.item()
  return None if v is None or isinstance(v, float) and v != v else v


def build_source():
  selected = {}
  table = gpd.read_file(PBF, layer="multipolygons", bbox=BBOX, engine="pyogrio")
  for _, row in table.iterrows():
    osm_id = str(clean(row.get("osm_id")) or clean(row.get("osm_way_id")))
    if osm_id not in ["6255291", "16183708", "32979869"]:
      continue
    properties = {k: clean(v) for k, v in row.items() if k != "geometry"}
    selected[osm_id] = dict(
      properties=properties, geometry=mapping(world(row.geometry))
    )
  assert len(selected) == 3
  campus = shape(selected["6255291"]["geometry"])
  hall = shape(selected["16183708"]["geometry"])
  rink = shape(selected["32979869"]["geometry"])
  prisms = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    )["buildings"]
  }
  owners = []
  for x, path in [
    (388, GEO / "raw/wedding-v210/LoD2_388_5822.zip"),
    (389, GEO / "raw/lod2/LoD2_389_5822.zip"),
  ]:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".xml", ".gml")):
          continue
        with archive.open(member) as f:
          for _, parent in ET.iterparse(f, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            fp = building_footprint(parent)
            if fp is not None and fp.area > 0:
              fp = transform(lambda xx, yy, z=None: (xx - 389500, 5820000 - yy), fp)
              site = (
                "bayer"
                if fp.intersection(campus).area / fp.area > 0.5
                else "erika"
                if fp.intersection(hall).area / fp.area > 0.5
                else None
              )
              if site:
                parts = [
                  part_profile(p) for p in leaf_building_parts(parent) or [parent]
                ]
                for p in parts:
                  p["prism"] = prisms[p["id"][-8:]]
                  p["displayOffsetY"] = round(
                    p["prism"]["y0_dm"] / 10 - p["ground_y_m"], 3
                  )
                owners.append(
                  dict(
                    id=parent.get(GML_ID),
                    site=site,
                    parts=parts,
                    footprint=mapping(fp),
                    sourceUrl=f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{x}_5822.zip",
                    sha256=digest,
                    sourceCreated="2026-03-02",
                  )
                )
            parent.clear()
  perimeter = []
  for layer in ["lines", "points"]:
    for _, row in gpd.read_file(
      PBF, layer=layer, bbox=BBOX, engine="pyogrio"
    ).iterrows():
      if row.get("barrier") not in ["fence", "wall", "gate"]:
        continue
      tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.get("other_tags", ""))))
      tags["barrier"] = row["barrier"]
      g = world(row.geometry)
      site = (
        "bayer"
        if g.distance(campus.boundary) < 2 and campus.buffer(2).covers(g)
        else "erika"
        if g.distance(hall.union(rink)) < 4
        else None
      )
      if site:
        perimeter.append(
          dict(
            id=("way/" if layer == "lines" else "node/") + str(row["osm_id"]),
            site=site,
            tags=tags,
            geometry=mapping(g),
          )
        )
  return dict(
    sites=selected,
    owners=owners,
    perimeter=perimeter,
    metadata=dict(
      worldFrame="x=easting-389500,y=NHN-30,z=5820000-northing",
      coreGround=5.2,
      coreCoverageFraction=1,
      sourceRole="Complete retained LoD2 sheet evidence; additive runtime, no old source owner suppressed.",
      osmPbf=str(PBF.relative_to(ROOT)),
    ),
  )


if __name__ == "__main__":
  source = build_source()
  (GEO / "wedding-sites-v210-source.json").write_text(
    json.dumps(source, separators=(",", ":"), allow_nan=False) + "\n"
  )
  print(
    "owners",
    len(source["owners"]),
    "parts",
    sum(len(o["parts"]) for o in source["owners"]),
    "perimeter",
    len(source["perimeter"]),
  )
