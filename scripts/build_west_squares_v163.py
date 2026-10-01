"""Step 10: retain full official West-square architecture and mapped public realm."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/westSquaresV163Source.json"
RAW = ROOT / "geo_data/regierungsviertel/raw"
GROUND = 5.2
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
BUILDINGS = {
  "DEBE07YY900002p7": ("KaDeWe", "387_5818", "60541581", 0xB9AA96, 0x8F6659),
  "DEBE07YY90000A5U": (
    "Wittenbergplatz pavilion",
    "387_5818",
    "26369724",
    0xCECABC,
    0x668477,
  ),
  "DEBE04YY500005HS": (
    "Telefunken-Hochhaus",
    "385_5819",
    "40452037",
    0xC8CAC4,
    0x8B9391,
  ),
}


def facade(rings: list, name: str) -> list:
  """Interpretive facade subdivisions strictly clipped to surveyed wall polygons."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = np.linalg.norm(d)
  if length < 2:
    return []
  d /= length
  rs = [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings]
  poly = Polygon(rs[0], rs[1:]).buffer(-0.06)
  yaw = math.atan2(-d[2], d[0])
  rows = []
  tele = name.startswith("Tele")
  station = name.startswith("Witten")
  pitch = 3.2 if tele else 3.1 if station else 3.85
  count = max(1, round(length / pitch))
  dx = length / count
  ys = (
    [GROUND + 4.1]
    if station
    else [GROUND + 2.8 + i * (3.38 if tele else 3.9) for i in range(24 if tele else 9)]
  )
  for floor, y in enumerate(ys):
    for col in range(count):
      u = (col + 0.5) * dx
      w = dx * (0.85 if tele else 0.62)
      h = 1.7 if station else 2.35 if tele else 2.5
      if not poly.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
        continue
      p = base + d * u + n * 0.08
      rows.append(
        [
          *map(lambda v: round(float(v), 3), [p[0], y, p[2], w, h, 0.14]),
          round(yaw, 6),
          0x445F59 if station else 0x53676C,
          1,
        ]
      )
      # Paired light stone jambs and thin central metal mullion.
      for du, width, color in [
        (-w / 2 - 0.05, 0.12, 0xD5D3C7),
        (w / 2 + 0.05, 0.12, 0xD5D3C7),
        (0, 0.055, 0xB6C3BC),
      ]:
        q = p + d * du + n * 0.045
        rows.append(
          [
            round(float(q[0]), 3),
            y,
            round(float(q[2]), 3),
            width,
            h + 0.15,
            0.15,
            round(yaw, 6),
            color,
            2,
          ]
        )
  return rows


def make_payload() -> dict:
  areas = gpd.read_file(RAW / "outer-v159/candidate.gpkg", layer="multipolygons")
  to_utm = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def world_poly(p):
    return transform(lambda x, y: (x - 389500, 5820000 - y), transform(to_utm, p))

  osm = {}
  for identity in ["60541581", "26369724", "40452037", "4598245", "42023136"]:
    r = areas[areas.osm_way_id == identity].iloc[0]
    p = world_poly(r.geometry)
    osm[identity] = {
      "id": identity,
      "rings": [
        [[round(x, 3), round(z, 3)] for x, z in po.exterior.coords[:-1]]
        for po in p.geoms
      ],
    }
  out = {
    "schemaVersion": 1,
    "groundY": GROUND,
    "archives": [],
    "buildings": [],
    "parts": [],
    "surfaces": [],
    "facadeBoxes": [],
    "nativeBlocks": [],
    "osm": osm,
  }
  blocks = {}
  all_foot = []
  for tile in sorted({v[1] for v in BUILDINGS.values()}):
    path = RAW / f"lod2/LoD2_{tile}.zip"
    out["archives"].append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "licence": "dl-de/zero-2-0",
      }
    )
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    for parent in tree.findall(".//b:Building", NS):
      pid = parent.get("{" + NS["g"] + "}id")
      if pid not in BUILDINGS:
        continue
      name, _, oid, wall, roof = BUILDINGS[pid]
      datum = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in e.text.split()[2::3]
      )
      out["buildings"].append(
        {"id": pid, "name": name, "osmWay": oid, "groundNHN": datum}
      )
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        sid = part.get("{" + NS["g"] + "}id")
        surfaces = []
        foot = []
        for boundary in part.findall("b:boundedBy", NS):
          for s in boundary:
            kind = s.tag.split("}")[-1]
            for polygon in s.findall(".//g:Polygon", NS):
              rings = []
              for e in polygon.findall(".//g:posList", NS):
                v = [float(x) for x in e.text.split()]
                ring = [
                  [
                    round(v[i] - 389500, 3),
                    round(v[i + 2] - datum + GROUND, 3),
                    round(5820000 - v[i + 1], 3),
                  ]
                  for i in range(0, len(v), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              surfaces.append({"kind": kind, "rings": rings})
              if kind == "GroundSurface":
                foot.append(
                  Polygon(
                    [(p[0], p[2]) for p in rings[0]],
                    [[(p[0], p[2]) for p in r] for r in rings[1:]],
                  )
                )
        points = [p for s in surfaces for r in s["rings"] for p in r]
        fp = unary_union(foot)
        all_foot.append(fp)
        polygons = list(fp.geoms) if hasattr(fp, "geoms") else [fp]
        out["parts"].append(
          {
            "id": sid,
            "parentId": pid,
            "name": name,
            "rings": [
              [list(p) for p in po.exterior.coords[:-1]]
              for po in polygons
              if not po.is_empty
            ],
            "groundY": min(p[1] for p in points),
            "topY": max(p[1] for p in points),
            "sourceSurfaces": surfaces,
          }
        )
        for s in surfaces:
          if s["kind"] not in ["WallSurface", "RoofSurface"]:
            continue
          triangles = triangles_for(s["rings"])
          color = roof if s["kind"] == "RoofSurface" else wall
          out["surfaces"].append(
            {"partId": sid, "kind": s["kind"], "color": color, "triangles": triangles}
          )
          if s["kind"] == "WallSurface":
            out["facadeBoxes"].extend(facade(s["rings"], name))
          for tri in triangles:
            a, b, c = [np.array(p) for p in tri]
            steps = max(
              1,
              math.ceil(
                max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
                / 1.1
              ),
            )
            for i in range(steps + 1):
              for j in range(steps + 1 - i):
                p = a + (b - a) * i / steps + (c - a) * j / steps
                cell = (
                  math.floor(p[0] / 2),
                  math.floor((p[1] - GROUND) / 2),
                  math.floor(p[2] / 2),
                )
                blocks[cell] = [
                  cell[0] * 2 + 1,
                  round(GROUND + cell[1] * 2 + 1, 3),
                  cell[2] * 2 + 1,
                  color,
                ]
  for x, y, z, w, h, _, yaw, color, role in out["facadeBoxes"]:
    if role != 1:
      continue
    for u in np.arange(-w / 2 + 0.2, w / 2, 0.8):
      for v in np.arange(-h / 2 + 0.2, h / 2, 0.8):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v - GROUND) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          blocks[cell][3] = color
  out["nativeBlocks"] = list(blocks.values())
  all_foot = unary_union(all_foot)
  core = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  out["legacyPrisms"] = [
    p
    for p in core
    if (q := Polygon([(x / 10, z / 10) for x, z in p["ring"]]).buffer(0)).area > 0
    and q.intersection(all_foot).area / q.area > 0.5
  ]
  # Exact present-day map polygons, with all courtyard/hole rings retained.
  out["publicRealm"] = []
  selected = {"7146579", "4717303", "6152712", "411717025", "411717032", "26556151"}
  for r in areas.to_dict("records"):
    sid = (
      str(r.get("osm_way_id"))
      if str(r.get("osm_way_id")) != "nan"
      else str(r.get("osm_id"))
    )
    if sid not in selected:
      continue
    p = world_poly(r["geometry"])
    out["publicRealm"].append(
      {
        "id": sid,
        "kind": "grass" if r.get("landuse") == "grass" else "paving",
        "polygons": [
          [
            [[round(x, 3), round(z, 3)] for x, z in rr.coords[:-1]]
            for rr in [po.exterior, *po.interiors]
          ]
          for po in p.geoms
        ],
      }
    )
  bench_points = gpd.read_file(
    RAW / "outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=(13.3208, 52.5120, 13.3229, 52.51315),
  )
  out["benches"] = []
  for r in bench_points.to_dict("records"):
    if '"amenity"=>"bench"' not in str(r.get("other_tags")):
      continue
    p = world_poly(r["geometry"])
    out["benches"].append(
      {"osmNode": r["osm_id"], "position": [round(p.x, 3), round(p.y, 3)]}
    )
  out["memorial"] = {
    "osmNode": "7912441064",
    "position": list(
      transform(
        lambda x, y: (x - 389500, 5820000 - y),
        transform(to_utm, Point(13.3426655, 52.5017923)),
      ).coords
    )[0],
  }
  return out


def main() -> None:
  data = make_payload()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  nav = {k: data[k] for k in ["buildings", "legacyPrisms"]}
  nav["parts"] = [
    {k: v for k, v in p.items() if k != "sourceSurfaces"} for p in data["parts"]
  ]
  nav["roofTriangles"] = [
    t for s in data["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
  ]
  nav["nativeRoofCells"] = []
  roofs = {}
  for x, y, z, _ in data["nativeBlocks"]:
    roofs[x, z] = max(roofs.get((x, z), -100), y + 1)
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in roofs.items()]
  DEST.with_name("westSquaresV163Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(data[k])
      for k in ["parts", "surfaces", "facadeBoxes", "nativeBlocks", "legacyPrisms"]
    },
    DEST.stat().st_size,
  )
  print([p["id"] for p in data["legacyPrisms"]])


if __name__ == "__main__":
  main()
