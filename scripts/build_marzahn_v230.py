"""Step 10: two finite, source-bound Marzahn housing clusters and window hints."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely import make_valid
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_district_facades_v188 as facades
import build_surrounding_outlines as out
from build_city_coverage_v183 import bounds_payload

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/marzahn-v230"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
PREFIX = "marzahn230-"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"


def prepare() -> None:
  """Buffer the two named mapped axes, then include complete adjacent footprints."""
  RAW.mkdir(parents=True, exist_ok=True)
  axes = gpd.read_file(
    PBF, layer="lines", where="name IN ('Marzahner Promenade','Helene-Weigel-Platz')"
  ).to_crs(25833)
  areas = gpd.read_file(
    PBF, layer="multipolygons", bbox=(13.52, 52.515, 13.57, 52.56)
  ).to_crs(25833)
  spine = unary_union(list(axes.geometry))
  assert not spine.is_empty
  scope = spine.buffer(190, quad_segs=4)
  buildings = [
    r.geometry
    for _, r in areas.iterrows()
    if isinstance(r.building, str) and r.geometry.intersects(scope)
  ]
  scope = unary_union([scope, *buildings])
  manifest = out.json.loads((PUBLIC / "manifest.json").read_bytes())
  assert not any(c["id"].startswith(PREFIX) for c in manifest["chunks"])
  previous = unary_union(
    [
      out.load_projected_polygon(GEO / "bounds.geojson"),
      *[
        affine_transform(
          out.polygonal(make_valid(Polygon(p["ring"], p["holes"]))),
          [1, 0, 0, -1, 389500, 5820000],
        )
        for p in manifest["footprint"]
      ],
    ]
  )
  # Previously required townhall envelopes are absent from the streamed footprint.
  townhall = json.loads((DATA / "townhallV227Navigation.json").read_bytes())
  for site in townhall["sites"]:
    if site["key"] != "marzahn":
      continue
    for b in site["owners"] + site["pads"]:
      previous = previous.union(
        affine_transform(Polygon(b["ring"], b["holes"]), [1, 0, 0, -1, 389500, 5820000])
      )
  out.write_json(
    GEO / "bounds-marzahn-v230.geojson",
    bounds_payload(
      scope,
      dict(
        step=10,
        revision="v1.0.130",
        policy="Two named housing clusters; 190m mapped-street margin is a display scope, expanded only to complete intersecting mapped buildings. Not the whole Marzahn district.",
      ),
    ),
  )
  out.write_json(
    GEO / "bounds-marzahn-v230-retained.geojson",
    bounds_payload(
      previous,
      dict(
        policy="Exact retained streamed footprint, core and preexisting Marzahn townhall shells; subtraction only"
      ),
    ),
  )
  out.write_json(GEO / "marzahn-v230-axes.geojson", json.loads(axes.to_json()))
  tiles = RAW / "lod2"
  tiles.mkdir(exist_ok=True)
  local = {p.name: p for p in (GEO / "raw").rglob("LoD2_*.zip")}
  for x in range(
    math.floor(scope.bounds[0] / 1000), math.floor(scope.bounds[2] / 1000) + 1
  ):
    for y in range(
      math.floor(scope.bounds[1] / 1000), math.floor(scope.bounds[3] / 1000) + 1
    ):
      name = f"LoD2_{x}_{y}.zip"
      target = tiles / name
      if target.exists():
        continue
      if name in local:
        target.symlink_to(local[name].resolve())
      else:
        print("Retrieve", name, flush=True)
        subprocess.run(
          [
            "curl",
            "--fail",
            "--location",
            "--retry",
            "3",
            "--output",
            str(target),
            "https://gdi.berlin.de/data/a_lod2/atom/" + name,
          ],
          check=True,
        )
  if not (RAW / PBF.name).exists():
    (RAW / PBF.name).symlink_to(PBF.resolve())


def add_windows(payload: dict, native: bool) -> None:
  """Bounded facade hints on new measured high-rise envelopes, not copied façades."""
  mesh = facades.FacadeMesh(payload["origin"])
  ox, oy, oz = payload["origin"]
  source_walls = facades.mesh_wall_triangles(payload)
  for b in payload["nav"]["buildings"]:
    if b["height"] - b["minHeight"] < 24:
      continue
    ring = b["ring"]
    poly = Polygon(ring, b["holes"])
    candidates = []
    for a, end in zip(ring, ring[1:] + ring[:1]):
      wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
      length = np.linalg.norm(wb - wa)
      if length < 8 or (native and a[0] != end[0] and a[1] != end[1]):
        continue
      if not facades.source_wall_exists(
        source_walls,
        a,
        end,
        payload["nav"]["groundY"] + b["minHeight"] - oy,
        payload["nav"]["groundY"] + b["height"] - oy,
      ):
        continue
      d = (wb - wa) / length
      n = np.array([-d[1], d[0]])
      if poly.covers(Point(*((np.array(a) + np.array(end)) / 2 + n * 0.1))):
        n = -n
      shifted = np.array([a, end]) + n * 0.1
      if shifted.min() < 0 or shifted.max() > 655.35:
        continue
      candidates.append(
        (
          length,
          dict(
            a=wa.tolist(),
            b=wb.tolist(),
            normal=n.tolist(),
            low=payload["nav"]["groundY"] + b["minHeight"],
            high=payload["nav"]["groundY"] + b["height"],
          ),
        )
      )
    # Every exterior side remains visible, with the same simple estimated recipe.
    for _, f in candidates:
      facades.window_grid(mesh, f, native)
  for part in mesh.payload()["meshes"]:
    part["kind"] = "outer-facades-v230"
    payload["meshes"].append(part)


def build() -> dict:
  if (
    not (GEO / "bounds-marzahn-v230.geojson").exists() or not (RAW / PBF.name).exists()
  ):
    prepare()
  out.RAW = RAW
  supplement = out.build(
    bounds_path=GEO / "bounds-marzahn-v230.geojson",
    core_path=GEO / "bounds-marzahn-v230-retained.geojson",
    pbf=RAW / PBF.name,
    lod2_dir=RAW / "lod2",
    output=RAW / "packets",
  )
  supplement["version"] = "1.0.130"
  supplement["source"]["policy"] = (
    "Finite Marzahner Promenade and Helene-Weigel-Platz housing clusters. Complete original official footprints and parent height envelopes, retained OSM context. Window rhythm, flat baseline terrain and unmeasured roof treatment are display estimates. Existing city sources and resident limits unchanged."
  )
  for c in supplement["chunks"]:
    c["id"] = PREFIX + c["id"]
    for family in ["drawn", "minecraft"]:
      a = c[family]
      payload = json.loads(gzip.decompress((RAW / "packets" / a["url"]).read_bytes()))
      payload["id"] = c["id"]
      add_windows(payload, family == "minecraft")
      raw = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
      packed = gzip.compress(raw, mtime=0)
      a.update(
        url=PREFIX + a["url"],
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      (PUBLIC / a["url"]).write_bytes(packed)
  inventory = supplement["source"]["inventory"]
  inventory["url"] = PREFIX + inventory["url"]
  shutil.copyfile(RAW / "packets/source-inventory.json.gz", PUBLIC / inventory["url"])
  out.write_json(GEO / "marzahn-v230-manifest.json", supplement)
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  assert not any(c["id"].startswith(PREFIX) for c in manifest["chunks"])
  manifest["chunks"] += supplement["chunks"]
  manifest["footprint"] += supplement["footprint"]
  manifest["marzahnV230"] = supplement["source"]
  assert len(manifest["chunks"]) <= 2048
  manifest["bounds"] = [
    min(manifest["bounds"][i], supplement["bounds"][i])
    if i < 2
    else max(manifest["bounds"][i], supplement["bounds"][i])
    for i in range(4)
  ]
  out.write_json(PUBLIC / "manifest.json", manifest)
  out.write_json(
    DATA / "marzahnScopeV230.json",
    dict(groundY=3, bounds=supplement["bounds"], footprint=supplement["footprint"]),
  )
  print(
    json.dumps(dict(chunks=len(supplement["chunks"]), source=supplement["source"])),
    flush=True,
  )
  return supplement


if __name__ == "__main__":
  build()
