"""Step 10: extract only the mapped hospital and ground helipad from retained data."""

from __future__ import annotations

import hashlib
import json
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


def build_source(root: Path = ROOT) -> dict:
  """Keep full measured sheets; suppress no current owner or runtime packet."""
  geo = root / "geo_data/regierungsviertel"
  projection = Transformer.from_crs(4326, 25833, always_xy=True)

  def world(g: object) -> object:
    def project(x: float, y: float, z: float | None = None) -> tuple:
      xx, yy = projection.transform(x, y)
      return xx - 389500, 5820000 - yy

    return transform(project, g)

  table = gpd.read_file(
    geo / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="multipolygons",
    bbox=(13.367, 52.533, 13.375, 52.538),
  )
  sites = {
    str(r.osm_way_id): dict(
      geometry=mapping(world(r.geometry)), name=r["name"], osmWay=str(r.osm_way_id)
    )
    for _, r in table.iterrows()
    if str(r.osm_way_id) in ["24931203", "51804908"]
  }
  assert len(sites) == 2
  campus = shape(sites["24931203"]["geometry"])
  prisms = {
    p["id"]: p
    for p in json.loads(
      (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    )["buildings"]
  }
  path = geo / "raw/lod2/LoD2_389_5821.zip"
  owners = []
  with zipfile.ZipFile(path) as archive:
    for name in archive.namelist():
      if not name.endswith((".xml", ".gml")):
        continue
      with archive.open(name) as file:
        for _, parent in ET.iterparse(file, events=("end",)):
          if parent.tag != f"{{{NS['bldg']}}}Building":
            continue
          fp = building_footprint(parent)
          if fp is not None and fp.area > 0:
            fp = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), fp)
            if fp.intersection(campus).area / fp.area > 0.8:
              parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
              for part in parts:
                part["prism"] = prisms[part["id"][-8:]]
                part["displayOffsetY"] = round(
                  part["prism"]["y0_dm"] / 10 - part["ground_y_m"], 3
                )
              owners.append(
                dict(id=parent.get(GML_ID), parts=parts, footprint=mapping(fp))
              )
          parent.clear()
  return dict(
    sites=sites,
    owners=owners,
    sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5821.zip",
    sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
    sourceCreated="2026-03-02",
    groundDisplayY=5.2,
  )


if __name__ == "__main__":
  result = build_source()
  (ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-source.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  print(
    "owners",
    len(result["owners"]),
    "parts",
    sum(len(o["parts"]) for o in result["owners"]),
  )
