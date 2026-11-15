"""Nine exact mapped restaurants absent from preceding surrounding coverage.

Independent cardinal Native bodies and photographed roof/material families.
Roof rise, storey heights, facade glazing bays and sign placement are estimates;
OSM footprints and DGM1 terrain are source geometry. No inferred entrance, sign
pylon, playground or drive-through route is introduced.
"""

from __future__ import annotations

import json
import math
import subprocess
from collections import Counter
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

from scripts.build_fuel_packets_v351 import Mesh, navsolid, rgb
from scripts.build_mcdonalds_inventory_v351 import GEO, ROOT, read, sha, write

DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v351"
)
PROFILE = {
  "312": dict(
    wall=[182, 138, 99],
    roof=[49, 75, 65],
    shape="hipped",
    body=3.5,
    rise=1.4,
    fascia=[147, 105, 69],
  ),
  "385": dict(
    wall=[225, 224, 209],
    roof=[44, 79, 63],
    shape="hipped",
    body=3.2,
    rise=1.5,
    fascia=[219, 221, 209],
  ),
  "717": dict(
    wall=[199, 160, 138],
    roof=[46, 55, 46],
    shape="flat",
    body=4.2,
    rise=0,
    fascia=[51, 65, 50],
  ),
  "788": dict(
    wall=[196, 190, 177],
    roof=[67, 72, 68],
    shape="hipped",
    body=3.1,
    rise=1.8,
    fascia=[60, 61, 56],
  ),
  "1173": dict(
    wall=[176, 144, 111],
    roof=[40, 72, 57],
    shape="hipped",
    body=3.2,
    rise=1.6,
    fascia=[113, 83, 57],
  ),
  "1202": dict(
    wall=[203, 157, 125],
    roof=[93, 96, 87],
    shape="flat",
    body=4.1,
    rise=0,
    fascia=[184, 184, 175],
  ),
  "1477": dict(
    wall=[202, 156, 115],
    roof=[153, 157, 149],
    shape="flat",
    body=6.9,
    rise=0,
    fascia=[71, 88, 78],
  ),
  "1564": dict(
    wall=[182, 154, 124],
    roof=[57, 77, 58],
    shape="flat",
    body=4.6,
    rise=0,
    fascia=[68, 88, 64],
  ),
  "1688": dict(
    wall=[182, 137, 94],
    roof=[69, 85, 65],
    shape="hipped",
    body=3.2,
    rise=1.5,
    fascia=[144, 104, 71],
  ),
}


def cardinal(p):
  x0, z0, x1, z1 = p.bounds
  cells = [
    box(x, z, x + 1, z + 1)
    for x in range(math.floor(x0), math.ceil(x1))
    for z in range(math.floor(z0), math.ceil(z1))
    if p.covers(Point(x + 0.5, z + 0.5))
  ]
  q = unary_union(cells)
  if not isinstance(q, Polygon):
    raise ValueError("Non-contiguous Native restaurant")
  return q.simplify(0)


def facade(mesh, a, b, normal, lo, hi, color, offset=0.025):
  a = np.array(a) + normal * offset
  b = np.array(b) + normal * offset
  q = [(a[0], lo, a[1]), (b[0], lo, b[1]), (b[0], hi, b[1]), (a[0], hi, a[1])]
  mesh.triangle(q[:3], [color] * 3)
  mesh.triangle([q[0], q[2], q[3]], [color] * 3)
  mesh.triangle(q[:3][::-1], [color] * 3)
  mesh.triangle([q[0], q[2], q[3]][::-1], [color] * 3)


def street_face(p, roads, tree, native=False):
  choices = []
  ring = list(p.exterior.coords)
  for a, b in zip(ring, ring[1:]):
    length = math.dist(a, b)
    if length < 1.7:
      continue
    d = (np.array(b) - a) / length
    n = np.array([-d[1], d[0]])
    c = (np.array(a) + b) / 2
    if p.covers(Point(*(c + n * 0.15))):
      n = -n
    road = roads[int(tree.nearest(Point(*c)))]
    near = nearest_points(Point(*c), road)[1]
    v = np.array([near.x, near.y]) - c
    distance = np.linalg.norm(v)
    if distance < 0.1 or np.dot(v, n) / distance < 0.4:
      continue
    choices.append((distance, -length, a, b, n))
  if not choices:
    raise ValueError("No road-facing actual building wall")
  _, _, a, b, n = min(choices, key=lambda v: v[:2])
  return np.array(a), np.array(b), n


def roof(mesh, p, base, rise, color, native):
  if not rise:
    mesh.surface(p, base, color)
    return
  if native:
    for y in np.arange(0, rise, 0.5):
      inset = p.buffer(-2 * y / rise, join_style="mitre")
      if inset.is_empty:
        continue
      q = cardinal(inset)
      mesh.prism(q, base + y, base + min(y + 0.5, rise), color)
  else:
    inset = p.buffer(-2, join_style="mitre")
    if inset.is_empty:
      mesh.surface(p, base, color)
      return
    rim = p.difference(inset)
    for t in shapely.constrained_delaunay_triangles(rim).geoms:
      q = [
        (x, base + rise * min(1, p.boundary.distance(Point(x, z)) / 2), z)
        for x, z in list(t.exterior.coords)[:3]
      ]
      if np.cross(np.subtract(q[1], q[0]), np.subtract(q[2], q[0]))[1] < 0:
        q.reverse()
      mesh.triangle(q, [color] * 3)
    mesh.surface(inset, base + rise, color)


def build():
  source = read(GEO / "mcdonalds-v351-source.json.gz")
  official = {r["identifier"]: r for r in source["records"]}
  inventory = {
    r["officialId"]: r
    for r in read(GEO / "mcdonalds-v351-inventory.json.gz")["records"]
  }
  mapped = read(GEO / "mcdonalds-v351-address-buildings.json.gz")["features"]
  terrain = {
    r["siteId"]: r for r in read(GEO / "mcdonalds-v351-terrain.json.gz")["sites"]
  }
  rows = read(GEO / "raw/city-v346/named-roads.geojson.gz")["features"]
  roads = [shape(r["geometry"]) for r in rows]
  tree = STRtree(roads)
  manifest = read(PUBLIC / "manifest.json")
  descriptors = []
  evidence = []
  sign_jobs = []
  packets = {}
  for fid, profile in PROFILE.items():
    record = inventory[fid]
    fid_full = record["id"]
    features = [f for f in mapped if fid_full in f["properties"]["facilityIds"]]
    if len(features) != 1:
      raise ValueError(f"Nonunique actual mapped building {fid}")
    feature = features[0]
    p = shape(feature["geometry"])
    p = p.geoms[0] if p.geom_type == "MultiPolygon" and len(p.geoms) == 1 else p
    samples = terrain[fid_full]["samples"]
    if terrain[fid_full]["roofId"] != feature["properties"]["osmId"]:
      raise ValueError("Wrong source terrain footprint")
    # Both mode footprints are checked against every earlier literal owner.
    # Ground is added only in the independently audited, uncovered footprint.
    nativep = cardinal(p)
    overlap_audit = {}
    for mode, candidate in [("drawn", p), ("minecraft", nativep)]:
      inspected = 0
      max_overlap = 0.0
      old_grounds = []
      for desc in manifest["chunks"]:
        if desc["id"].startswith("mcdonalds351-"):
          continue
        if not box(*desc["bounds"]).intersects(candidate):
          continue
        old = read(PUBLIC / desc[mode]["url"])
        ox, _, oz = old["origin"]
        for existing_ground in old["nav"]["ground"]:
          old_grounds.append(
            shapely.affinity.translate(
              Polygon(existing_ground["ring"], existing_ground.get("holes", [])), ox, oz
            )
          )
        for building in old["nav"]["buildings"]:
          inspected += 1
          poly = shapely.affinity.translate(
            Polygon(building["ring"], building.get("holes", [])), ox, oz
          )
          overlap = poly.intersection(candidate).area
          max_overlap = max(max_overlap, overlap)
          if overlap > max(0.1, candidate.area * 0.002):
            raise ValueError(
              f"Existing {mode} building intersects new site {fid}: {building['sourceId']}"
            )
      old_ground = unary_union(old_grounds)
      ground_overlap = old_ground.intersection(candidate).area
      complement = candidate.difference(old_ground)
      overlap_audit[mode] = dict(
        oldGroundOverlapArea=ground_overlap,
        newGroundComplementArea=complement.area,
        newGroundGeometry=shapely.geometry.mapping(complement),
        oldBuildingsInspected=inspected,
        maximumOverlapArea=max_overlap,
        oldGroundMeshesChanged=0,
      )
    ground = round(float(np.median([s["worldY"] for s in samples])), 2)
    foundation = round(min(s["worldY"] for s in samples) - 0.05, 2)
    extent = p.buffer(1.5).bounds
    origin = [math.floor(extent[0]), math.floor(foundation) - 1, math.floor(extent[1])]
    nativep = cardinal(p)
    bounds = [
      min(p.bounds[0], nativep.bounds[0]) - 1,
      min(p.bounds[1], nativep.bounds[1]) - 1,
      max(p.bounds[2], nativep.bounds[2]) + 1,
      max(p.bounds[3], nativep.bounds[3]) + 1,
    ]
    host = "mcdonalds351-" + fid
    descriptor = {"id": host, "bounds": [round(v, 2) for v in bounds]}
    site = {
      "id": fid_full,
      "host": host,
      "osmId": feature["properties"]["osmId"],
      "sourceGeometry": feature["geometry"],
      "groundY": ground,
      "foundationY": foundation,
      "terrainSamples": len(samples),
      "profile": profile,
      "sourceTags": feature["properties"]["tags"],
      "referencePhoto": next(
        v["url"] for v in official[fid]["referencePhotos"] if v["type"] == "MAIN"
      ),
      "heightEvidence": "OSM mapped storeys when supplied; storey metres and photograph-based single-storey/roof profile are disclosed display estimates",
      "modes": {},
      "precedingOwnershipAudit": overlap_audit,
    }
    for mode in ["drawn", "minecraft"]:
      native = mode == "minecraft"
      polygon = nativep if native else p
      mesh = Mesh(origin)
      body = profile["body"]
      rise = profile["rise"]
      wall = rgb(profile["wall"])
      roofcolor = rgb(profile["roof"])
      mesh.prism(polygon, foundation, ground + body, wall, roofcolor)
      roof(mesh, polygon, ground + body, rise, roofcolor, native)
      a, b, n = street_face(polygon, roads, tree, native)
      length = math.dist(a, b)
      d = (b - a) / length
      # Photographs support large ground-floor glazing and a fascia family;
      # bay widths are compact display estimates, never an invented doorway.
      for floor in range(2 if fid == "1477" else 1):
        low = ground + 0.55 + floor * 3.1
        high = min(ground + body - 0.85, low + 2.1)
        if high <= low:
          continue
        left = a + d * 0.6
        right = b - d * 0.6
        facade(mesh, left, right, n, low, high, rgb((64, 88, 86)))
        for t in np.arange(0.6, length - 0.4, 1.5):
          facade(
            mesh,
            a + d * t,
            a + d * min(t + 0.07, length - 0.5),
            n,
            low,
            high,
            rgb((61, 62, 55)),
            0.045,
          )
      facade(
        mesh,
        a + d * 0.1,
        b - d * 0.1,
        n,
        ground + body - 0.75,
        ground + body - 0.05,
        rgb(profile["fascia"]),
        0.04,
      )
      width = min(4.8, length - 0.5)
      center = (a + b) / 2
      sign = [
        round((center[0] - origin[0]) * 100),
        round((ground + body - 0.4 - origin[1]) * 100),
        round((center[1] - origin[2]) * 100),
        round(d[0] * 1e6),
        round(d[1] * 1e6),
        round(n[0] * 1e6),
        round(n[1] * 1e6),
        round(width * 100),
        65,
        int(profile["roof"][1] > profile["roof"][0] + 10),
      ]
      # The exact source footprint is also the finite ground admission domain.
      # Independent mode subtraction keeps every previous ground polygon intact.
      ground_complement = shape(overlap_audit[mode]["newGroundGeometry"])
      mesh.surface(ground_complement, ground, rgb((139, 137, 125)))
      ground_nav = []
      for part in (
        [ground_complement]
        if isinstance(ground_complement, Polygon)
        else list(ground_complement.geoms)
      ):
        if part.is_empty:
          continue
        ground_nav.append(
          {
            "ring": [
              [round(x - origin[0], 2), round(z - origin[2], 2)]
              for x, z in part.exterior.coords
            ],
            "holes": [
              [[round(x - origin[0], 2), round(z - origin[2], 2)] for x, z in r.coords]
              for r in part.interiors
            ],
          }
        )
      bodymesh = mesh.payload()
      bodymesh["kind"] = "mcdonalds-buildings-v351"
      nav = navsolid(
        polygon,
        foundation,
        ground + body + rise,
        origin,
        ground,
        "MCD351-" + feature["properties"]["osmId"],
      )
      nav["heightSource"] = (
        "OSM footprint; photograph/storey-based height estimate; DGM1 foundation"
      )
      packet = {
        "schemaVersion": 1,
        "origin": origin,
        "meshes": [bodymesh],
        "nav": {
          "ground": ground_nav,
          "water": [],
          "buildings": [nav],
          "groundY": ground,
        },
      }
      key = mode + ":" + host
      packets[key] = packet
      sign_jobs.append({"key": key, "native": native, "plates": [sign]})
      site["modes"][mode] = {
        "sign": sign,
        "face": {"a": a.tolist(), "b": b.tolist(), "normal": n.tolist()},
        "footprint": shapely.geometry.mapping(polygon),
        "surfaceY": ground + body,
      }
    descriptors.append(descriptor)
    evidence.append(site)
  jobs = TASK / "mcdonalds-supplement-sign-jobs.json"
  write(jobs, sign_jobs)
  result = subprocess.run(
    ["bun", "run", "src/app/scripts/expand-mcdonalds-signs-v351.ts", str(jobs)],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
  )
  signs = json.loads(result.stdout)
  for descriptor in descriptors:
    for mode in ["drawn", "minecraft"]:
      key = mode + ":" + descriptor["id"]
      packet = packets[key]
      packet["meshes"].append(signs[key])
      file = f"{descriptor['id']}.{mode}.json.gz"
      path = PUBLIC / file
      write(path, packet)
      raw = (
        json.dumps(packet, ensure_ascii=False, separators=(",", ":")).encode() + b"\n"
      )
      descriptor[mode] = {
        "url": file,
        "encoding": "gzip",
        "bytes": path.stat().st_size,
        "decodedBytes": len(raw),
        "sha256": sha(path.read_bytes()),
      }
  write(TASK / "mcdonalds-manifest-delta.json", descriptors)
  write(
    GEO / "mcdonalds-v351-supplements.json.gz",
    {
      "schemaVersion": 1,
      "policy": __doc__,
      "sourceFiles": {
        str(p.relative_to(ROOT)): sha(p.read_bytes())
        for p in [
          GEO / "mcdonalds-v351-source.json.gz",
          GEO / "mcdonalds-v351-inventory.json.gz",
          GEO / "mcdonalds-v351-address-buildings.json.gz",
          GEO / "mcdonalds-v351-terrain.json.gz",
        ]
      },
      "sites": evidence,
      "descriptors": descriptors,
      "bytes": sum(d[m]["bytes"] for d in descriptors for m in ["drawn", "minecraft"]),
    },
  )
  receipt_path = GEO / "mcdonalds-v351-evidence.json.gz"
  receipt = read(receipt_path)
  for site in evidence:
    receipt["outcomes"][site["id"]] = {
      "status": "source-owned-exact-footprint-restaurant",
      "host": site["host"],
      "osmId": site["osmId"],
    }
  receipt["counts"]["statuses"] = dict(
    Counter(r["status"] for r in receipt["outcomes"].values())
  )
  receipt["counts"]["supplementHosts"] = len(descriptors)
  receipt["counts"]["visibleImprovedRestaurants"] = receipt["counts"][
    "admittedPlates"
  ] + len(descriptors)
  write(receipt_path, receipt)
  print(
    "new source-owned hosts",
    len(descriptors),
    "bytes",
    sum(d[m]["bytes"] for d in descriptors for m in ["drawn", "minecraft"]),
  )


if __name__ == "__main__":
  build()
