"""Add mapped-storey fittings on exact retained ordinary walls across Berlin.

The complete official principal-road network defines the search, not a district
sample. Source walls, roofs, colour passes and navigation are immutable. Aperture
widths and joinery are explicit display estimates; this is not a photo survey.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.strtree import STRtree

from scripts import build_cluster_facades_v320 as fitting
from scripts import build_district_facades_v188 as base
from scripts import build_outer_facades_v230 as native
from scripts import build_outer_facades_v262 as protection

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/city-v346"
PUBLIC = fitting.PUBLIC
KIND = "main-road-fronts-v346"
RECEIPT = GEO / (KIND + "-receipt.json.gz")
MAX_OWNERS_PER_PACKET = 16
BASELINE = "daa0c5e372f6c86147dd89962da3fdbd2947e861"


def road_context():
  cache = RAW / "named-roads.geojson.gz"
  if cache.exists():
    return fitting.read(cache)["features"]
  frame = pyogrio.read_dataframe(
    RAW / "berlin-2026-11-13.osm.pbf",
    layer="lines",
    where="highway IS NOT NULL AND name IS NOT NULL",
  ).to_crs(25833)
  rows = []
  for row in frame.to_dict("records"):
    if row.get("highway") not in {
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "primary",
      "primary_link",
      "secondary",
      "secondary_link",
      "tertiary",
      "tertiary_link",
      "residential",
      "living_street",
      "unclassified",
    }:
      continue
    rows.append(
      dict(
        type="Feature",
        geometry=mapping(base.world(row["geometry"])),
        properties=dict(id=str(row["osm_id"]), name=row["name"]),
      )
    )
  fitting.write(cache, dict(type="FeatureCollection", features=rows))
  return rows


def build():
  manifest = fitting.read(PUBLIC / "manifest.json")
  housing = fitting.read(RAW / "eligible-housing.geojson.gz")["features"]
  housing = [
    r
    for r in housing
    if not re.search(
      r'"(?:building|facade):(?:colour|material)"',
      r["properties"].get("other_tags") or "",
    )
  ]
  shapes = [shapely.make_valid(shape(r["geometry"])) for r in housing]
  housing_tree = STRtree(shapes)
  road_rows = road_context()
  roads = [shape(r["geometry"]) for r in road_rows]
  road_tree = STRtree(roads)
  context = base.read_json(native.CONTEXT)
  blocked = protection.protected_owners(context)
  protected = STRtree([shape(g) for g in context["protected"]])
  for name in [
    "cluster-facades-v320-evidence.json.gz",
    "wedding-gesundbrunnen-fronts-v340-receipt.json",
    "wedding-ring-west-v345-receipt.json",
  ]:
    blocked |= fitting.owner_ids(fitting.read(GEO / name))
  for name in fitting.MATERIAL_EVIDENCE:
    blocked.update(fitting.read(GEO / name)["owners"])
  doors = fitting.read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  primary = [
    d
    for d in manifest["chunks"]
    if re.fullmatch(
      r"(?:(?:outer187|east200|north190|ring182|city183|marzahn230)-)?-?\d+_-?\d+",
      d["id"],
    )
  ]
  pshapes = [box(*d["bounds"]) for d in primary]
  ptree = STRtree(pshapes)
  plans, reports, inputs, seen = {}, [], {}, set()
  rejects = Counter()
  cache = {}

  def packet(desc, mode):
    key = mode + ":" + desc["id"]
    if key not in cache:
      cache[key] = fitting.read(PUBLIC / desc[mode]["url"])
    return cache[key]

  for index, desc in enumerate(primary):
    candidates = housing_tree.query(pshapes[index], predicate="intersects")
    if not len(candidates):
      continue
    source, block = packet(desc, "drawn"), packet(desc, "minecraft")
    ox, oy, oz = source["origin"]
    # Neighbouring retained buildings, not just the selected positive-use subset,
    # prove that a fitting is street-facing and does not cross a party wall.
    occupied_shapes = []
    neighbours = ptree.query(pshapes[index].buffer(32), predicate="intersects")
    for ni in neighbours:
      near = packet(primary[int(ni)], "drawn")
      for building in near["nav"]["buildings"]:
        poly = translate(
          Polygon(building["ring"], building.get("holes", [])),
          near["origin"][0],
          near["origin"][2],
        )
        if poly.is_valid and not poly.is_empty:
          occupied_shapes.append(poly)
    occupied = STRtree(occupied_shapes)
    tri, ntri = base.mesh_wall_triangles(source), base.mesh_wall_triangles(block)
    options = []
    for b in source["nav"]["buildings"]:
      owner = b["sourceId"]
      if owner in blocked or owner in seen or b.get("minHeight", 0) > 0.1:
        continue
      poly = translate(Polygon(b["ring"], b.get("holes", [])), ox, oz)
      if (
        not poly.is_valid
        or poly.area < 30
        or len(protected.query(poly, predicate="intersects"))
      ):
        continue
      match = []
      for hi in housing_tree.query(poly, predicate="intersects"):
        mapped = shapes[int(hi)]
        iou = poly.intersection(mapped).area / poly.union(mapped).area
        if iou >= 0.97:
          match.append((iou, int(hi)))
      if len(match) != 1:
        continue
      iou, hi = match[0]
      row = housing[hi]
      tags = row["properties"]
      levels = tags["mappedStoreys"]
      low = source["nav"]["groundY"] + b.get("groundOffset", 0) + b["minHeight"]
      high = source["nav"]["groundY"] + b.get("groundOffset", 0) + b["height"]
      if not 2.5 <= (high - low - 0.6) / levels <= 5:
        continue
      faces = []
      for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
        if not base.source_wall_exists(tri, a, end, low - oy, high - oy):
          continue
        wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
        visible = base.exposed_front(wa, wb, poly, roads, road_tree, occupied)
        if visible is None:
          continue
        width, _, normal, ri = visible
        if not pshapes[index].covers(
          LineString([wa + normal * 0.18, wb + normal * 0.18])
        ):
          continue
        face = dict(
          owner=owner,
          chunk=desc["id"],
          a=wa.tolist(),
          b=wb.tolist(),
          normal=normal.tolist(),
          low=low,
          high=high,
          streetId=road_rows[ri]["properties"]["id"],
          streetName=road_rows[ri]["properties"]["name"],
        )
        spans = native.native_faces(face, block, ntri, desc["bounds"])
        if not spans or any(
          not 2.5 <= (s["high"] - s["low"] - 0.6) / levels <= 5 for s in spans
        ):
          continue
        faces.append((width, face, spans))
      if faces:
        _, face, spans = max(faces, key=lambda f: f[0])
        options.append((tags["streetDistance"], owner, face, spans, levels, row, iou))
    meshes = {
      mode: fitting.FrontMesh(p["origin"])
      for mode, p in [("drawn", source), ("minecraft", block)]
    }
    accepted = []
    # The finite per-packet work allowance is independent of camera/mobile mode.
    # Include near side streets when present, then favour the principal road.
    ranked = sorted(options, key=lambda o: (o[0], o[1]))
    side = [o for o in ranked if o[0] > 55][:3]
    ranked = sorted(
      [o for o in ranked if o not in side][: MAX_OWNERS_PER_PACKET - len(side)] + side,
      key=lambda o: (o[0], o[1]),
    )
    for distance, owner, face, spans, levels, row, iou in ranked:
      rendered, counts = {}, {}
      for mode, p in [("drawn", source), ("minecraft", block)]:
        mesh = fitting.FrontMesh(p["origin"])
        counts[mode] = []
        for f in spans if mode == "minecraft" else [face]:
          style = fitting.normalized_style(
            dict(floorPitchM=(f["high"] - f["low"] - 0.6) / levels)
          )
          counts[mode].append(
            fitting.build_front(
              mesh, dict(f, owner=owner), style, doors, mode == "minecraft"
            )
          )
        mesh.compact()
        rendered[mode] = mesh
      if any(
        not sum(r["windows"] for r in counts[m])
        or any(r["floors"] != levels for r in counts[m])
        for m in counts
      ):
        rejects["unsupportedRhythm"] += 1
        continue
      if any(
        sum(len(fitting.arrays(p)[0]) for p in original["meshes"])
        + len(meshes[mode].positions)
        + len(rendered[mode].positions)
        > 350000
        for mode, original in [("drawn", source), ("minecraft", block)]
      ):
        rejects["packetGeometryAllowance"] += 1
        continue
      for mode, mesh in meshes.items():
        add = rendered[mode]
        offset = len(mesh.positions)
        mesh.positions.extend(add.positions)
        mesh.colours.extend(add.colours)
        mesh.indices.extend(i + offset for i in add.indices)
      accepted.append(
        dict(
          owner=owner,
          host=desc["id"],
          face=face,
          nativeSpans=spans,
          mappedStoreys=levels,
          footprintIoU=iou,
          sourceRecord=row,
          distanceToMajorRoadM=distance,
          principalRoad=row["properties"]["majorRoad"],
          district=row["properties"]["district"],
          modes=counts,
        )
      )
      seen.add(owner)
    if accepted:
      for mode, p in [("drawn", source), ("minecraft", block)]:
        mesh = meshes[mode]
        mesh.compact()
        part = mesh.payload()["meshes"][0]
        part["kind"] = KIND
        plans[mode + ":" + desc["id"]] = dict(
          origin=p["origin"],
          navGuard=0,
          lineGuard=None,
          records=[
            dict(mesh=i, kind=q["kind"], fingerprint=fitting.part_fingerprint(q))
            for i, q in enumerate(p["meshes"])
          ],
          append=part,
          appendFingerprint=fitting.part_fingerprint(part),
          retire=[],
          owners=[r["owner"] for r in accepted],
        )
        inputs[mode + ":" + desc["id"]] = desc[mode]
      reports.extend(accepted)
      print(desc["id"], len(accepted), "owners; cumulative", len(reports), flush=True)
    # Bound exporter RAM too; retained packet bytes are never rewritten.
    cache = {
      k: v
      for k, v in cache.items()
      if any(k.endswith(":" + primary[int(n)]["id"]) for n in neighbours)
    }
  recipe = dict(schemaVersion=1, keys=sorted(plans), packets=plans)
  counts = dict(
    owners=len(reports),
    hosts=len(plans) // 2,
    principalRoadFronts=sum(r["distanceToMajorRoadM"] <= 55 for r in reports),
    sideStreetFronts=sum(r["distanceToMajorRoadM"] > 55 for r in reports),
    districts=dict(Counter(r["district"] for r in reports)),
    drawnWindows=sum(s["windows"] for r in reports for s in r["modes"]["drawn"]),
    nativeWindows=sum(s["windows"] for r in reports for s in r["modes"]["minecraft"]),
  )
  receipt = dict(
    schemaVersion=1,
    kind=KIND,
    sourceBaseline=BASELINE,
    sourceInputs=inputs,
    sourceOwners=reports,
    counts=counts,
    rejections=dict(rejects),
    pendingBunPrimaryGuards=sorted(plans),
    sourceFiles={
      name: hashlib.sha256((RAW / name).read_bytes()).hexdigest()
      for name in [
        "berlin-2026-11-13.osm.pbf",
        "major-roads.geojson.gz",
        "eligible-housing.geojson.gz",
      ]
    },
    policy=__doc__,
  )
  fitting.write(RAW / "main-road-fronts-recipe.json", recipe)
  fitting.write(RECEIPT, receipt)
  print(json.dumps(counts), flush=True)


def publish_recipes():
  """Keep each packet weak and split transport into finite sixteen-host modules."""
  source = fitting.read(RAW / "main-road-fronts-recipe.json")
  receipt = fitting.read(RECEIPT)
  if receipt["pendingBunPrimaryGuards"]:
    raise ValueError("Finalize every actual production predecessor before publication")
  hosts = sorted({key.split(":", 1)[1] for key in source["keys"]})
  modules = []
  for start in range(0, len(hosts), 16):
    keys = sorted(
      mode + ":" + host
      for host in hosts[start : start + 16]
      for mode in ["drawn", "minecraft"]
    )
    file = f"mainRoadFrontsV346Packets{len(modules):02d}.json"
    value = dict(
      schemaVersion=1, keys=keys, packets={key: source["packets"][key] for key in keys}
    )
    fitting.write(fitting.DATA / file, value)
    modules.append(dict(file=file, keys=keys))
  fitting.write(fitting.DATA / "mainRoadFrontsV346Index.json", dict(sources=modules))
  streets = {r["face"]["streetId"] for r in receipt["sourceOwners"]}
  receipt["streetSources"] = [
    r for r in road_context() if r["properties"]["id"] in streets
  ]
  receipt["officialRoadNetwork"] = dict(
    file="main-road-network-v346-source.geojson.gz",
    url="https://gdi.berlin.de/services/wfs/strnetz",
    layer="strnetz:uebergeordnetes_strnetz",
    features=9363,
    crs="EPSG:25833",
    license="dl-de-zero-2.0",
    sha256=hashlib.sha256((RAW / "major-roads.geojson.gz").read_bytes()).hexdigest(),
  )
  receipt["runtimeSources"] = {
    m["file"]: hashlib.sha256((fitting.DATA / m["file"]).read_bytes()).hexdigest()
    for m in modules
  }
  fitting.write(RECEIPT, receipt)
  (GEO / "main-road-network-v346-source.geojson.gz").write_bytes(
    (RAW / "major-roads.geojson.gz").read_bytes()
  )
  return modules


if __name__ == "__main__":
  build()
  subprocess.run(
    [
      "bun",
      "--bun",
      "src/app/scripts/finalize-main-road-fronts-v346.ts",
      str(RAW / "main-road-fronts-recipe.json"),
      str(RECEIPT),
    ],
    cwd=ROOT,
    check=True,
  )
  publish_recipes()
