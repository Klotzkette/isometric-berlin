"""Step 10: bounded retained-source recognition at Wedding and Poststadion.

Original LoD2 shells, park surfaces and station datasets remain immutable. The
only previous presentation correction is the source-identified Wedding group
height; its exact data digests and source level are recorded separately.
"""

from __future__ import annotations

import hashlib
import json
import math
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
DATA = ROOT / "src/app/src/data"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
SOURCE = GEO / "wedding-moabit-v229-source.json"
PITCHES = {
  4676152,
  4676157,
  4676158,
  4676160,
  17189008,
  181445238,
  564153647,
  104391778,
  104391779,
  104391780,
  104391784,
  104391785,
  104391786,
  104391787,
}
STAIRS = {
  363581647,
  47908978,
  242094102,
  437595034,
  437595043,
  437595046,
  437595035,
  437595040,
  437595042,
}
BBOXES = {
  "fritz": (13.349, 52.523, 13.363, 52.535),
  "wedding": (13.358, 52.538, 13.379, 52.548),
}


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")


def extract() -> dict:
  """Retain only named mapped objects plus exact official pool source sheets."""
  tr = Transformer.from_crs(4326, 25833, always_xy=True)

  def world(g):
    def f(x, y, z=None):
      x, y = tr.transform(x, y)
      return x - 389500, 5820000 - y

    return transform(f, g)

  objects = []
  for site, bbox in BBOXES.items():
    for layer in ["multipolygons", "lines", "points"]:
      for _, r in gpd.read_file(
        PBF, layer=layer, bbox=bbox, engine="pyogrio"
      ).iterrows():
        tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(r.get("other_tags", ""))))
        for k, v in r.items():
          if (
            k not in ["geometry", "other_tags"]
            and v is not None
            and not (isinstance(v, float) and math.isnan(v))
          ):
            tags[k] = str(v)
        ident = int(tags.get("osm_id") or tags.get("osm_way_id"))
        selected = (site == "fritz" and ident in PITCHES | {30912220, 1242653753}) or (
          site == "wedding"
          and ident
          in STAIRS
          | {
            5559039,
            26556185,
            4717544,
            25277454,
            9060548518,
            3788640177,
            732650379,
            12474526913,
            3772920428,
          }
        )
        if selected:
          objects.append(
            dict(
              site=site,
              layer=layer,
              id=(
                "node/"
                if layer == "points"
                else "relation/"
                if tags.get("type") == "multipolygon"
                else "way/"
              )
              + str(ident),
              tags=tags,
              geometry=mapping(world(r.geometry)),
            )
          )
  pool = shape(next(o["geometry"] for o in objects if o["id"] == "way/30912220"))
  prisms = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  path = GEO / "raw/lod2/LoD2_388_5820.zip"
  owners = []
  with zipfile.ZipFile(path) as archive:
    for member in archive.namelist():
      if not member.lower().endswith((".gml", ".xml")):
        continue
      with archive.open(member) as stream:
        for _, parent in ET.iterparse(stream, events=("end",)):
          if parent.tag != f"{{{NS['bldg']}}}Building":
            continue
          fp = building_footprint(parent)
          if fp is not None and fp.area:
            fp = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), fp)
            if fp.intersection(pool).area / fp.area > 0.5:
              parts = []
              for element in leaf_building_parts(parent) or [parent]:
                p = part_profile(element)
                prism = prisms.get(p["id"][-8:])
                p["prismId"] = p["id"][-8:] if prism else None
                p["displayOffsetY"] = (
                  round(prism["y0_dm"] / 10 - p["ground_y_m"], 3) if prism else 0
                )
                parts.append(p)
              owners.append(dict(id=parent.get(GML_ID), parts=parts))
          parent.clear()
  assert owners and len(
    [o for o in objects if int(o["id"].split("/")[1]) in PITCHES]
  ) == len(PITCHES)
  return dict(
    objects=objects,
    poolOwners=owners,
    source=dict(
      pbf=str(PBF.relative_to(ROOT)),
      lod2=str(path.relative_to(ROOT)),
      lod2Sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
      lod2Url="https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5820.zip",
    ),
    stationCorrection=dict(
      anchor="node/614445865",
      platform="relation/5559039",
      previousCoreRoof=prisms["26556185"],
      previousCoreRoofs=[prisms[k] for k in ["26556185", "73863640", "65379920"]],
      accessRoofHeightSource="Illustrative continuous ascending plane 3.6m above access start, aligned with retained mapped level0 to level1 route; no measured height claim.",
      previousCorePayloadSha256=hashlib.sha256(
        (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
      ).hexdigest(),
      roofBottomY=14.84,
      roofTopY=14.96,
      oldPlatformY=3.96,
      newPlatformY=10.46,
      deltaY=6.5,
      groundY=5.2,
      evidence="Retained platform level=1, roof layer=2 and mapped ascending access with three 15-step eastern flights; 5.26m rise is explicit display estimate, not surveyed height.",
      oldDatasetSha256={
        name: hashlib.sha256((DATA / name).read_bytes()).hexdigest()
        for name in ["railStationsV190.json", "ringStationDetailsV205.json"]
      },
    ),
  )


def build(source: dict) -> dict:
  """Compact footprints and measured source faces; no output duplicates bodies."""
  objects = {o["id"]: o for o in source["objects"]}
  pitches = []
  for ident in sorted(PITCHES):
    o = objects[f"way/{ident}"]
    poly = shape(o["geometry"])
    rect = poly.minimum_rotated_rectangle
    ring = list(rect.exterior.coords)[:-1]
    a, b = max(zip(ring, ring[1:] + ring[:1]), key=lambda ab: math.dist(*ab))
    length = math.dist(a, b)
    ux = (b[0] - a[0]) / length
    uz = (b[1] - a[1]) / length
    pitches.append(
      dict(
        id=o["id"],
        name=o["tags"].get("name", "Tennisplatz"),
        sport=o["tags"].get("sport"),
        ring=[[round(x, 3), round(z, 3)] for x, z in poly.geoms[0].exterior.coords],
        frame=[
          round(poly.centroid.x, 3),
          round(poly.centroid.y, 3),
          round(ux, 8),
          round(uz, 8),
          round(length, 3),
          round(rect.area / length, 3),
        ],
      )
    )
  walls = []
  for owner in source["poolOwners"]:
    for p in owner["parts"]:
      if not p["prismId"]:
        continue
      for s in p["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        rings = [
          [[x, round(y + p["displayOffsetY"], 3), z] for x, y, z in ring]
          for ring in s["rings"]
        ]
        # Only broad exterior hall faces; no new building fill or replacement roof.
        span = max(
          math.dist((a[0], a[2]), (b[0], b[2])) for a in rings[0] for b in rings[0]
        )
        height = max(v[1] for v in rings[0]) - min(v[1] for v in rings[0])
        if span > 14 and height > 3:
          walls.append(dict(owner=p["id"], rings=rings))

  def polygon(ident):
    p = shape(objects[ident]["geometry"])
    return [[round(x, 3), round(z, 3)] for x, z in p.geoms[0].exterior.coords]

  stairs = []
  for ident in sorted(STAIRS):
    o = objects[f"way/{ident}"]
    stairs.append(
      dict(
        id=o["id"],
        tags=o["tags"],
        points=[[round(x, 3), round(z, 3)] for x, z in shape(o["geometry"]).coords],
      )
    )
  fountain = shape(objects["way/25277454"]["geometry"])
  payload = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_text()
  )
  field = payload["ground_height"]
  step = payload["cell_m"] * field["stride_cells"]
  ox = payload["grid"]["min_x_idx"] * payload["cell_m"]
  oz = payload["grid"]["min_z_idx"] * payload["cell_m"]
  grounds = []
  for w, n, e, s in [(-1070, -1530, -570, -1010), (-130, -2930, -10, -2810)]:
    i0 = math.floor((w - ox) / step) - 2
    j0 = math.floor((n - oz) / step) - 2
    i1 = math.ceil((e - ox) / step) + 2
    j1 = math.ceil((s - oz) / step) + 2
    grounds.append(
      dict(
        origin=[ox + i0 * step, oz + j0 * step],
        step=step,
        heights=[
          field["y_dm"][j * field["cols"] + i0 : j * field["cols"] + i1 + 1]
          for j in range(j0, j1 + 1)
        ],
      )
    )
  return dict(
    schemaVersion=1,
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    platformRings=[
      [[round(x, 3), round(z, 3)] for x, z in ring.coords]
      for ring in [
        shape(objects["relation/5559039"]["geometry"]).geoms[0].exterior,
        *shape(objects["relation/5559039"]["geometry"]).geoms[0].interiors,
      ]
    ],
    roofRings=[
      [[round(x, 3), round(z, 3)] for x, z in ring.coords]
      for ring in [
        shape(objects["way/26556185"]["geometry"]).geoms[0].exterior,
        *shape(objects["way/26556185"]["geometry"]).geoms[0].interiors,
      ]
    ],
    grounds=grounds,
    poolWalls=walls,
    pitches=pitches,
    stairs=stairs,
    fountain=dict(
      id="way/25277454",
      ring=polygon("way/25277454"),
      center=[round(fountain.centroid.x, 3), round(fountain.centroid.y, 3)],
      radius=round(math.sqrt(fountain.area / math.pi), 3),
    ),
    square=dict(
      id="relation/4717544",
      ring=polygon("relation/4717544"),
      name="Martha-Ndumbe-Platz",
    ),
    stationCorrection=source["stationCorrection"],
    entrances=[
      dict(id=o["id"], point=[round(v, 3) for v in o["geometry"]["coordinates"]])
      for o in source["objects"]
      if o["id"] in ["node/3788640177", "node/732650379", "node/12474526913"]
    ],
  )


if __name__ == "__main__":
  import sys

  if "--extract" in sys.argv:
    write(SOURCE, extract())
  result = build(json.loads(SOURCE.read_text()))
  write(DATA / "weddingMoabitV229.json", result)
  print(
    "walls",
    len(result["poolWalls"]),
    "pitches",
    len(result["pitches"]),
    "stairs",
    len(result["stairs"]),
    "bytes",
    (DATA / "weddingMoabitV229.json").stat().st_size,
  )
