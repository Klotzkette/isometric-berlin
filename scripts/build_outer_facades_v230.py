"""Step 10: small, source-bound window hints in previously untreated outer tiles.

Uses immutable source walls and the existing offline facade recipe. At most ninety
new tile companions enter the existing bounded queue; no resident cap changes.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base

GEO, OUT, ROOT = base.GEO, base.OUT, base.ROOT
CONTEXT = GEO / "outer-facades-v230-context.json.gz"
EVIDENCE = GEO / "outer-facades-v230-evidence.json.gz"
PREFIX = "outerfacade230-"
POLICY = (
  "Restrained new window hints only on verified existing generic exterior walls, "
  "excluding previous facade owners and mapped named/non-residential/material owners. "
  "One street front per owner; ninety spatially distributed existing tiles at most. "
  "Window spacing and colours are display estimates, never individual facade surveys. "
  "All source geometry, previous assets and resident limits stay unchanged."
)


def extract_context() -> None:
  """Reuse the complete retained Berlin OSM snapshot without another download."""
  import pyogrio

  p = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  roads = []
  frame = pyogrio.read_dataframe(
    p,
    layer="lines",
    where="highway IN ('primary','secondary','tertiary','residential','unclassified','living_street','pedestrian') AND name IS NOT NULL",
  ).to_crs(25833)
  for r in frame.itertuples():
    tags = str(r.other_tags)
    if '"tunnel"=>"yes"' in tags or '"bridge"=>"yes"' in tags:
      continue
    roads.append(
      dict(id=str(r.osm_id), name=r.name, geometry=base.mapping(base.world(r.geometry)))
    )
  protected = []
  frame = pyogrio.read_dataframe(
    p, layer="multipolygons", where="building IS NOT NULL"
  ).to_crs(25833)
  for r in frame.itertuples():
    tags = str(r.other_tags)
    if (
      r.building
      not in {"yes", "apartments", "residential", "house", "detached", "terrace"}
      or any(isinstance(getattr(r, k), str) for k in ["name", "amenity", "tourism"])
      or any(
        f'"{k}"=>' in tags
        for k in [
          "building:colour",
          "building:material",
          "facade:colour",
          "facade:material",
        ]
      )
    ):
      protected.append(base.mapping(base.world(r.geometry)))
  ids = set()
  for pattern in [
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
    "src/app/src/*Prisms.json",
  ]:
    for path in ROOT.glob(pattern):
      if path.name != "buildingAttributeSource.json":
        ids.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  # Earlier individually fitted fronts always win over this generic pass.
  for name in [
    "district-facades-v188-evidence.json.gz",
    "kiez-facades-v209-evidence.json.gz",
  ]:
    ids.update(f["owner"] for f in base.read_json(GEO / name)["faces"])
  base.write_json(
    CONTEXT,
    dict(
      roads=roads,
      protected=protected,
      authoredIds=sorted(ids),
      sourceSha256=base.digest(p),
    ),
  )


def native_faces(face: dict, packet: dict, triangles: set, bounds: list) -> list[dict]:
  """Only independently emitted orthogonal block-wall spans can receive marks."""
  result = []
  ox, oy, oz = packet["origin"]
  corridor = LineString([face["a"], face["b"]]).buffer(1.6, cap_style=2)
  for b in packet["nav"]["buildings"]:
    if b["sourceId"] != face["owner"]:
      continue
    low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
    high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
    poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
    for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
      if a[0] != end[0] and a[1] != end[1]:
        continue
      if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
        continue
      clipped = LineString(
        [np.array(a) + [ox, oz], np.array(end) + [ox, oz]]
      ).intersection(corridor)
      if clipped.geom_type != "LineString" or clipped.length < 3:
        continue
      wa, wb = np.array(clipped.coords[0]), np.array(clipped.coords[-1])
      d = (wb - wa) / clipped.length
      n = np.array([-d[1], d[0]])
      if np.dot(n, face["normal"]) < 0:
        n = -n
      if np.dot(n, face["normal"]) < 0.65 or not box(*bounds).covers(
        LineString([wa + n * 0.05, wb + n * 0.05])
      ):
        continue
      if any(
        poly.covers(Point(*(wa + (wb - wa) * t + n * 0.2)))
        for t in [0.05, 0.25, 0.5, 0.75, 0.95]
      ):
        continue
      result.append(
        dict(face, a=wa.tolist(), b=wb.tolist(), normal=n.tolist(), low=low, high=high)
      )
  return result


def build() -> dict:
  """Select distributed source tiles, then publish additive bounded companions."""
  if not CONTEXT.exists():
    extract_context()
  context = base.read_json(CONTEXT)
  streets = [shape(r["geometry"]) for r in context["roads"]]
  roads = STRtree(streets)
  protected = STRtree([shape(g) for g in context["protected"]])
  authored = set(context["authoredIds"])
  manifest = base.read_json(OUT / "manifest.json")
  manifest["chunks"] = [d for d in manifest["chunks"] if not d["id"].startswith(PREFIX)]
  primary = [
    d
    for d in manifest["chunks"]
    if not d.get("detailCompanionOf")
    and d["id"].startswith(("outer187-", "east200-", "north190-"))
  ]
  inventory = []
  by_chunk = defaultdict(list)
  for desc in primary:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      p = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if p.is_valid and not p.is_empty:
        inventory.append(p)
        by_chunk[desc["id"]].append((b, p))
  occupied = STRtree(inventory)
  candidates = defaultdict(list)
  for desc in primary:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    ox, oy, oz = packet["origin"]
    triangles = base.mesh_wall_triangles(packet)
    for b, p in by_chunk[desc["id"]]:
      owner = b["sourceId"]
      if (
        not owner.startswith("DEBE")
        or owner in authored
        or len(protected.query(p, predicate="intersects"))
      ):
        continue
      low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
      high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
      if not 7 <= high - low <= 36 or b["minHeight"] > 0.1:
        continue
      for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
        if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
          continue
        wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
        selected = base.exposed_front(wa, wb, p, streets, roads, occupied)
        if selected is None:
          continue
        width, _, normal, ri = selected
        if not box(*desc["bounds"]).covers(
          LineString([wa + normal * 0.11, wb + normal * 0.11])
        ):
          continue
        candidates[owner].append(
          (
            width,
            dict(
              owner=owner,
              chunk=desc["id"],
              a=wa.tolist(),
              b=wb.tolist(),
              low=low,
              high=high,
              normal=normal.tolist(),
              streetId=context["roads"][ri]["id"],
              streetName=context["roads"][ri]["name"],
            ),
          )
        )
  faces = [
    max(rows, key=lambda r: (r[0], r[1]["chunk"]))[1]
    for _, rows in sorted(candidates.items())
  ]
  grouped = defaultdict(list)
  for f in faces:
    grouped[f["chunk"]].append(f)
  # Spatially stratified round robin: distant suburbs are not displaced by one dense area.
  cells = defaultdict(list)
  for d in primary:
    if grouped[d["id"]]:
      cells[(int(d["bounds"][0] // 2048), int(d["bounds"][1] // 2048))].append(d)
  for ds in cells.values():
    ds.sort(key=lambda d: (-len(grouped[d["id"]]), d["id"]))
  selected = []
  while len(selected) < 90 and any(cells.values()):
    for key in sorted(cells):
      if cells[key] and len(selected) < 90:
        selected.append(cells[key].pop(0))
  companions = []
  evidence = []
  counts = Counter()
  for desc in selected:
    source = base.read_json(OUT / desc["drawn"]["url"])
    native_source = base.read_json(OUT / desc["minecraft"]["url"])
    drawn = base.FacadeMesh(source["origin"])
    native = base.FacadeMesh(native_source["origin"])
    nt = base.mesh_wall_triangles(native_source)
    for f in grouped[desc["id"]]:
      f["windowCount"] = base.window_grid(drawn, f, occupied=occupied)
      f["nativeSpans"] = native_faces(f, native_source, nt, desc["bounds"])
      f["nativeWindowCount"] = sum(
        base.window_grid(native, nf, True) for nf in f["nativeSpans"]
      )
      counts["windows"] += f["windowCount"]
      counts["nativeWindows"] += f["nativeWindowCount"]
      evidence.append(f)
    c = dict(
      id=PREFIX + desc["id"], detailCompanionOf=desc["id"], bounds=desc["bounds"]
    )
    for family, mesh in [("drawn", drawn), ("minecraft", native)]:
      payload = mesh.payload()
      for p in payload["meshes"]:
        p["kind"] = "outer-facades-v230"
      url = c["id"] + "." + family + ".json.gz"
      base.write_json(OUT / url, dict(id=c["id"], **payload))
      import gzip

      c[family] = dict(
        url=url,
        bytes=(OUT / url).stat().st_size,
        decodedBytes=len(gzip.decompress((OUT / url).read_bytes())),
        encoding="gzip",
        sha256=base.digest(OUT / url),
      )
      counts[family + "Bytes"] += c[family]["bytes"]
    companions.append(c)
  old_assets = [
    dict(url=d[f]["url"], sha256=d[f]["sha256"])
    for d in manifest["chunks"]
    for f in ["drawn", "minecraft"]
  ]
  manifest["chunks"] += companions
  assert len(manifest["chunks"]) <= 2048
  manifest["outerFacadesV230"] = dict(
    policy=POLICY, counts=dict(counts), companions=len(companions), fronts=len(evidence)
  )
  base.write_json(OUT / "manifest.json", manifest)
  result = dict(
    policy=POLICY,
    counts=dict(counts),
    faces=evidence,
    companions=companions,
    oldAssets=old_assets,
    contextSha256=base.digest(CONTEXT),
  )
  base.write_json(EVIDENCE, result)
  print(
    json.dumps(dict(fronts=len(evidence), companions=len(companions), **counts)),
    flush=True,
  )
  return result


if __name__ == "__main__":
  build()
