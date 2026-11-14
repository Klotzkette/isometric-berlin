"""Finite, surveyed Heinrich-von-Gagern / Paul-Löbe road-edge transaction.

The 2014 survey is admitted only where the 2025 orthophoto and owner's street
photographs confirm the same street. The removed road north of the Swiss
embassy is deliberately not part of this transaction.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import affine_transform, rotate, translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "mitte-roads-v343-source.json.gz"
OUT = DATA / "mitteRoadsV343.json"
ROAD_IDS = {"cm_fahrbahn.24972", "cm_fahrbahn.25080", "cm_fahrbahn.25145"}
WINDOW = box(-225, -92, 46, 117)
COLORS = {"02": 0x858D89, "04": 0xA09E95, "08": 0xB7B3A5, "13": 0xB7AD99}


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def parts(g, kind="Polygon"):
  if g.is_empty:
    return []
  if g.geom_type == kind:
    return [g]
  return [p for child in getattr(g, "geoms", []) for p in parts(child, kind)]


def poly(g):
  return unary_union(parts(shapely.make_valid(g)))


def world(g):
  return affine_transform(g, [1, 0, 0, -1, -389500, 5820000])


def encoded(g):
  """Centimetre indexed faces, with bounded terrain interpolation edges."""
  vertices, indices, lookup = [], [], {}
  todo = [
    list(t.exterior.coords)[:3]
    for p in parts(g)
    for t in shapely.constrained_delaunay_triangles(p).geoms
  ]
  while todo:
    pts = todo.pop()
    lengths = [math.dist(pts[i], pts[(i + 1) % 3]) for i in range(3)]
    n = int(np.argmax(lengths))
    if lengths[n] > 8:
      a, b, c = (pts[(n + i) % 3] for i in range(3))
      m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      todo.extend([[a, m, c], [m, b, c]])
      continue
    row = []
    for x, z in pts:
      p = (round(x * 100), round(z * 100))
      if p not in lookup:
        lookup[p] = len(vertices)
        vertices.append(p)
      row.append(lookup[p])
    if len(set(row)) == 3:
      indices.extend(row)
  return dict(
    positions_cm_b64=base64.b64encode(
      np.array(vertices, dtype="<i4").tobytes()
    ).decode(),
    indices_b64=base64.b64encode(np.array(indices, dtype="<u4").tobytes()).decode(),
  )


def lines(g):
  return [
    [[round(x, 2), round(z, 2)] for x, z in shapely.segmentize(p, 3).coords]
    for p in parts(g, "LineString")
    if p.length > 0.05
  ]


def extract(folder):
  features = []
  road_shapes = []
  for f in json.loads((folder / "cm_fahrbahn.response.json").read_text())["features"]:
    if f["id"] in ROAD_IDS:
      g = poly(world(shape(f["geometry"])).intersection(WINDOW))
      road_shapes.append(g)
      features.append(
        dict(
          id=f["id"],
          layer="road",
          material=f["properties"]["material"],
          properties=f["properties"],
          geometry=mapping(g),
          originalGeometry=f["geometry"],
        )
      )
  assert len(road_shapes) == 3
  road = unary_union(road_shapes)
  # Exact cadastral survey surfaces near these three owners only. Unknown
  # materials are not guessed and the wider Ehrenhof garden is not claimed.
  support = road.buffer(8).intersection(WINDOW)
  pits = unary_union(
    [
      world(shape(f["geometry"]))
      for f in json.loads((folder / "bn_baumscheibe.response.json").read_text())[
        "features"
      ]
    ]
  )
  for f in json.loads((folder / "cl_gehweg.response.json").read_text())["features"]:
    material = f["properties"]["material"]
    if material not in COLORS:
      continue
    g = poly(
      world(shape(f["geometry"]))
      .intersection(support)
      .difference(road)
      .difference(pits)
    )
    if g.area < 0.05:
      continue
    features.append(
      dict(
        id=f["id"],
        layer="walk",
        material=material,
        properties=f["properties"],
        geometry=mapping(g),
        originalGeometry=f["geometry"],
      )
    )
  source = dict(
    schemaVersion=1,
    features=features,
    survey=dict(
      url="https://gdi.berlin.de/services/wfs/strassenbefahrung",
      date="2014–2015",
      licence="dl-de/zero-2-0",
      requests=json.loads((folder / "survey-requests.json").read_text()),
    ),
    currentReference=json.loads(
      (folder / "kanzleramt-dop2025-request.json").read_text()
    ),
    ownerPhotoEvidence=[
      "government-street-furniture-v286-evidence.json",
      "chancellery-photo-v287-evidence.json",
    ],
    materialReference="https://gdi.berlin.de/data/strassenbefahrung/docs/Datenformatbeschreibung_Stra%C3%9Fenbefahrung_2014.pdf",
    excludedHistoricRoads=["cm_fahrbahn.24862"],
    policy="Exact retained survey footprints; present alignment compared to 2025 DOP and user photos. Not a 2026 engineering survey. Natural-stone seam spacing and kerb height remain display estimates.",
    originalDistrictSha256=sha(DATA / "districtStreets.json"),
  )
  curb_ids = {"bd_bordstein.237701", "bd_bordstein.468448"}
  verge_ids = {"ce_gruenflaeche.21337", "ce_gruenflaeche.41415"}
  source["raisedVergeKerbs"] = [
    dict(
      id=f["id"],
      properties=f["properties"],
      geometry=mapping(world(shape(f["geometry"]))),
      originalGeometry=f["geometry"],
    )
    for f in json.loads((folder / "bd_bordstein.response.json").read_text())["features"]
    if f["id"] in curb_ids
  ]
  source["retainedGrassVergeEvidence"] = [
    dict(
      id=f["id"],
      properties=f["properties"],
      geometry=mapping(world(shape(f["geometry"]))),
      originalGeometry=f["geometry"],
    )
    for f in json.loads((folder / "ce_gruenflaeche.response.json").read_text())[
      "features"
    ]
    if f["id"] in verge_ids
  ]
  source["vergeRequests"] = [
    json.loads((folder / (layer + ".request.json")).read_text())
    for layer in ["bd_bordstein", "ce_gruenflaeche", "ch_radweg"]
  ]
  source["vergeAssessment"] = (
    "The two 3 m strips on Heinrich-von-Gagern are mapped municipal green verges, not missing cycleways. Their boundaries agree with the 2025 orthophoto; retained grass stays. BOR=1 is a raised kerb (>3 cm); the existing 14 cm presentation rise remains an estimate."
  )
  assert (
    len(source["raisedVergeKerbs"]) == len(source["retainedGrassVergeEvidence"]) == 2
  )
  SOURCE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def build():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  old = json.loads((DATA / "districtStreets.json").read_text())
  assert source["originalDistrictSha256"] == sha(DATA / "districtStreets.json")
  groups = defaultdict(list)
  for r in source["features"]:
    groups[(r["layer"], r["material"])].append(shape(r["geometry"]))
  regions = {key: poly(unary_union(value)) for key, value in groups.items()}
  focus = poly(unary_union(list(regions.values())))
  roads = poly(unary_union([g for (layer, _), g in regions.items() if layer == "road"]))
  walks = poly(unary_union([g for (layer, _), g in regions.items() if layer == "walk"]))
  removed, complements, statistics = [], [], {}
  for surface in old["surfaces"]:
    v = np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), "<i4").reshape(
      -1, 2
    )
    ix = np.frombuffer(base64.b64decode(surface["indices_b64"]), "<u4").reshape(-1, 3)
    receipts, outside, inside = [], [], []
    # Only decode/intersect faces that can meet this finite source ownership.
    coords = v[ix] / 100
    lo, hi = coords.min(axis=1), coords.max(axis=1)
    a, b, c, d = focus.bounds
    candidates = np.flatnonzero(
      (hi[:, 0] >= a) & (lo[:, 0] <= c) & (hi[:, 1] >= b) & (lo[:, 1] <= d)
    )
    for n in candidates:
      triangle = Polygon(coords[n])
      overlap = triangle.intersection(focus)
      if overlap.area < 1e-7:
        continue
      rest = poly(triangle.difference(focus))
      receipts.append([int(n), [int(k) for k in ix[n]], v[ix[n]].tolist()])
      outside.append(rest)
      inside.append(overlap)
      assert abs(triangle.area - rest.area - overlap.area) < 1e-5
    if receipts:
      retained = poly(unary_union(outside))
      removed.append(
        dict(
          kind=surface["kind"],
          positionLength=len(surface["positions_cm_b64"]),
          indexLength=len(surface["indices_b64"]),
          faces=receipts,
        )
      )
      if retained.area:
        complements.append(dict(kind=surface["kind"], **encoded(retained)))
      statistics[surface["kind"]] = dict(
        removedFaces=len(receipts),
        outsideAreaM2=retained.area,
        claimedAreaM2=unary_union(inside).area,
      )
  curb_replacements = []
  for i, points in enumerate(old["curbs_m"]):
    line = LineString(points)
    if line.intersection(focus.buffer(0.12)).length < 0.01:
      continue
    remain = line.difference(focus.buffer(0.12))
    curb_replacements.append(dict(index=i, original=points, replacement=lines(remain)))
  # The measured carriageway border supplies curvature. Only borders beside
  # measured pedestrian ground become raised kerbs, and all mapped crossing
  # approaches remain open; never close an arbitrary extraction boundary.
  osm = pyogrio.read_dataframe(GEO / "osm.gpkg", layer="roads").to_crs(25833)
  access = []
  for row in osm.to_dict("records"):
    if row.get("highway") in ("footway", "path", "cycleway", "steps"):
      g = world(row["geometry"])
      if g.intersects(focus):
        access.append(g.buffer(1.6))
  raised_verge_kerbs = unary_union(
    [shape(f["geometry"]) for f in source["raisedVergeKerbs"]]
  )
  assert all(f["properties"]["bor"] == 1 for f in source["raisedVergeKerbs"])
  # Exact raised borders against the retained grass verges are independent
  # municipal line owners; a sidewalk-only selection would omit both sides.
  kerbs = unary_union(
    [
      roads.boundary.intersection(walks.buffer(0.24)),
      raised_verge_kerbs.intersection(roads.boundary.buffer(0.025)),
    ]
  ).difference(unary_union(access))
  kerbs = kerbs.difference(WINDOW.boundary.buffer(0.3))
  old_joints = json.loads((DATA / "reichstagPublicRealmV256.json").read_text())
  joint_replacements = []
  for i, row in enumerate(old_joints["boxes"]):
    if i < old_joints["counts"]["drawnFountainMembers"]:
      continue
    x, y, z, w, h, d, angle, color = row
    foot = translate(
      rotate(box(-w / 2, -d / 2, w / 2, d / 2), -angle, use_radians=True), x, z
    )
    # A partial owner at the focus edge is kept whole. Only complete old
    # kerb-joint boxes may yield, never fountain members or outside details.
    if focus.covers(foot):
      joint_replacements.append(dict(index=i, original=row))
  kerb_seams = []
  for run in parts(kerbs, "LineString"):
    for distance in np.arange(1.1, run.length - 0.2, 2.2):
      p = run.interpolate(float(distance))
      a = run.interpolate(max(0, float(distance) - 0.05))
      b = run.interpolate(min(run.length, float(distance) + 0.05))
      dx, dz = b.x - a.x, b.y - a.y
      length = math.hypot(dx, dz)
      if length > 0.001:
        kerb_seams.append(
          [
            [round(p.x - dz / length * 0.095, 3), round(p.y + dx / length * 0.095, 3)],
            [round(p.x + dz / length * 0.095, 3), round(p.y - dx / length * 0.095, 3)],
          ]
        )
  seams = []
  for (layer, material), area in regions.items():
    if layer != "walk" or material != "08":
      continue
    # Stone slabs only where the municipal material explicitly says
    # natural-stone pavement. No lattice over asphalt, cobbles or gravel.
    inner = area.buffer(-0.07)
    for x in np.arange(math.floor(area.bounds[0]), math.ceil(area.bounds[2]), 0.8):
      seams.extend(
        lines(
          LineString(
            [(float(x), area.bounds[1] - 1), (float(x), area.bounds[3] + 1)]
          ).intersection(inner)
        )
      )
    for z in np.arange(math.floor(area.bounds[1]), math.ceil(area.bounds[3]), 0.6):
      seams.extend(
        lines(
          LineString(
            [(area.bounds[0] - 1, float(z)), (area.bounds[2] + 1, float(z))]
          ).intersection(inner)
        )
      )
  surfaces = []
  for (layer, material), area in regions.items():
    surfaces.append(
      dict(
        layer=layer,
        material=material,
        color=COLORS[material],
        lift=0.18 if layer == "road" else 0.32,
        **encoded(area),
      )
    )
  result = dict(
    schemaVersion=1,
    sourceSha256=sha(SOURCE),
    surfacePatches=removed,
    curbReplacements=curb_replacements,
    supplement=dict(
      source={"id": "mitte-roads-v343", "licence": "Geoportal Berlin, dl-de/zero-2-0"},
      surfaces=complements,
      curbs_m=lines(kerbs),
      markings_m=[],
      elevated_path_ids=[],
    ),
    surfaces=surfaces,
    seams=seams,
    kerbSeams=kerb_seams,
    jointReplacements=joint_replacements,
    navigation=dict(
      policy="Retained continuous DGM ground; no building, water or path blocking changes. New pavement uses the existing 0.14 m display kerb rise.",
      road=mapping(roads),
      walk=mapping(walks),
    ),
    stats=dict(
      surfaceTransactions=statistics,
      roadAreaM2=roads.area,
      walkAreaM2=walks.area,
      kerbLengthM=kerbs.length,
      slabSeamRuns=len(seams),
      sourceFeatureCount=len(source["features"]),
      oldKerbJointOwners=len(joint_replacements),
      newKerbJointRuns=len(kerb_seams),
      surveyedGrassVergeKerbOwners=len(source["raisedVergeKerbs"]),
    ),
  )
  OUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(json.dumps(result["stats"], indent=2))
  print("payload bytes", OUT.stat().st_size)


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", type=Path)
  args = parser.parse_args()
  if args.extract:
    extract(args.extract)
  build()
