"""Freeze only Nordic/KAS facade support; never rewrite existing city assets."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, mapping

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = PRISMS.with_name("minecraft-voxels.json")
OSM = GEO / "raw/outer-v159/candidate.gpkg"
OLD = GEO / "spree-tiergarten-v237-source.json.gz"
OLD_EVIDENCE = GEO / "spree-tiergarten-v237-evidence.json"
SOURCE = GEO / "nordic-kas-v246-source.json.gz"
DATA = ROOT / "src/app/src/data/nordicAndKasV246.json"
OWNERS = {
  "26746070": "denmark",
  "37428406": "iceland",
  "26746069": "norway",
  "26746068": "sweden",
  "26746067": "finland",
  "26746071": "felleshus",
  "33135651": "kas-office",
  "609711202": "kas-extension",
}
REFERENCES = [
  "https://www.nordischebotschaften.org/der-botschaftskomplex/",
  *[
    "https://www.nordischebotschaften.org/der-botschaftskomplex/" + name + "/"
    for name in ("felleshus", "daenemark", "finnland", "island", "norwegen", "schweden")
  ],
  "https://www.kas.de/de/kontakt",
  "https://cn-architekten.de/projekte/erweiterung-der-konrad-adenauer-stiftung",
]


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def extract():
  source_prisms = read(PRISMS)["buildings"]
  polys = [
    (
      p,
      Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])]),
    )
    for p in source_prisms
  ]
  ids = ",".join("'" + s + "'" for s in [*OWNERS, "25999438"])
  rows = pyogrio.read_dataframe(
    OSM, layer="multipolygons", where=f"osm_way_id IN ({ids})"
  ).to_crs(25833)
  buildings, footprint = [], None
  for row in rows.itertuples():
    g = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    if row.osm_way_id == "25999438":
      footprint = dict(osmWayId=row.osm_way_id, geometry=mapping(g))
      continue
    parts = [
      p
      for p, q in polys
      if q.is_valid
      and q.area > 0
      and q.intersects(g)
      and q.intersection(g).area / q.area > 0.75
    ]
    assert parts
    tags = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', row.other_tags or ""))
    buildings.append(
      dict(
        osmWayId=row.osm_way_id,
        name=row.name,
        style=OWNERS[row.osm_way_id],
        tags=tags,
        geometry=mapping(g),
        parts=parts,
      )
    )
  assert footprint and len(buildings) == len(OWNERS)
  # Source ring follows the copper screen on its curved three sides. The two
  # long southern entrance edges close the site polygon, not the copper band.
  ring = footprint["geometry"]["coordinates"][0][0]
  copper = []
  for i, (a, b) in enumerate(zip(ring, ring[1:])):
    if min(a[1], b[1]) > 1109 and LineString([a, b]).length > 20:
      continue
    copper.append(dict(edge=i, a=a, b=b))
  copper_length = sum(LineString([x["a"], x["b"]]).length for x in copper)
  assert 220 < copper_length < 240, copper_length
  # Exposed source wall candidates; the complete underlying prism inventory
  # stays in its original city asset. Keep roof forms and central courts open.
  faces = []
  nearby_polys = [
    (p, q)
    for p, q in polys
    if q.is_valid and q.bounds[0] > -1600 and q.bounds[2] < -1200
  ]
  main_ids = {"K0002LJv", "ZB0heBiQ", "mp1kppcd", "K0002NBo", "NpnGzgPh", "g8hjxb07"}
  old = read(OLD)
  old_walls = {r["owner"]: r["walls"] for r in read(OLD_EVIDENCE)["records"]}
  for building in buildings:
    for p in building["parts"]:
      kas = building["style"].startswith("kas")
      if not kas and p["id"] not in main_ids:
        continue
      if kas:
        assert any(x["prism"] == p for x in old["buildings"])
      poly = shapely.orient_polygons(
        Polygon(np.array(p["ring"]) / 10), exterior_cw=False
      )
      low, high = p["y0_dm"] / 10, (p["y0_dm"] + p["h_dm"]) / 10
      for index, (a, b) in enumerate(
        zip(poly.exterior.coords, list(poly.exterior.coords)[1:])
      ):
        a, b = np.array(a), np.array(b)
        # KAS is a refinement of existing v237 openings, not a second
        # unbound window grid on previously untreated court walls.
        if kas and not any(
          w["a"] == a.tolist() and w["b"] == b.tolist()
          for w in old_walls.get(p["id"], [])
        ):
          continue
        length = np.linalg.norm(b - a)
        if length < 3:
          continue
        t = (b - a) / length
        n = np.array([t[1], -t[0]])
        mid = (a + b) / 2
        # Nordic house details face the plaza or Rauchstraße; the outer
        # facades already receive the independently sourced copper band.
        plaza = np.array([-1449.0, 1080.0]) - mid
        if not kas and np.dot(n, plaza) < 0 and n[1] < 0.75:
          continue
        # Never put a panel through an adjacent source building.
        samples = [
          Point(*(a + (b - a) * f + n * 0.24)) for f in (0.06, 0.3, 0.5, 0.7, 0.94)
        ]
        if any(
          q.covers(point)
          and other["id"] != p["id"]
          and (other["y0_dm"] + other["h_dm"]) / 10 > low + 5
          for point in samples
          for other, q in nearby_polys
        ):
          continue
        faces.append(
          dict(
            owner=p["id"],
            osmWayId=building["osmWayId"],
            style=building["style"],
            edge=index,
            a=a.tolist(),
            b=b.tolist(),
            low=low,
            high=high,
            normal=n.tolist(),
          )
        )
  # The native binding is taken from delivered columns, not rounded drawn
  # normals. This finite slice is sufficient for the two exact sites only.
  vox = read(VOXELS)
  cell, grid = vox["cell_m"], vox["grid"]
  cells = []
  for iz, runs in enumerate(vox["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not 1024 <= z <= 1210:
      continue
    for start, count, low, high, *_ in runs:
      for ix in range(start, start + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if -1504 <= x <= -1280:
          cells.append([x, z, low / 10, high / 10])
  assert cells and len(cells) < 1800
  source = dict(
    schemaVersion=1,
    inputHashes={
      str(p.relative_to(ROOT)): sha(p) for p in (PRISMS, VOXELS, OSM, OLD, OLD_EVIDENCE)
    },
    buildings=buildings,
    footprint=footprint,
    copper=copper,
    copperLengthM=copper_length,
    faces=faces,
    nativeCellM=cell,
    nativeCells=cells,
    references=REFERENCES,
  )
  save(SOURCE, source)
  return source


def build():
  source = read(SOURCE) if SOURCE.exists() else extract()
  for p, digest in source["inputHashes"].items():
    assert sha(ROOT / p) == digest, p
  save(
    DATA,
    dict(
      copper=source["copper"],
      faces=source["faces"],
      nativeCellM=source["nativeCellM"],
      nativeCells=source["nativeCells"],
    ),
  )
  print(
    json.dumps(
      dict(
        faces=len(source["faces"]),
        nativeCells=len(source["nativeCells"]),
        copperLengthM=source["copperLengthM"],
        runtimeBytes=DATA.stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  build()
