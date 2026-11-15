"""Finite BBB, football, ice and named leisure source bindings and refinements.

Never assigns an operator point to an arbitrary nearby building. Public operator
facts and OSM site containment are distinct from measured architectural evidence.
"""

from __future__ import annotations

import argparse
import math
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_cluster_facades_v320 import part_fingerprint
from scripts.build_mcdonalds_inventory_v351 import read, write
from scripts.build_sports_leisure_inventory_v352 import (
  GEO,
  OSM,
  ROOT,
  SOURCE,
)

PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v352/sports"
)
INVENTORY = GEO / "sports-leisure-v352-inventory.json.gz"
DATA = ROOT / "src/app/src/data"
KIND = "sports-leisure-v352"
# Manually reviewed semantic identities; distances never imply an entrance.
ALIASES = {
  "bbb:79": "way/1013578299",
  "bbb:75": "way/758242718",
  "bbb:24": "way/38863016",
  "bbb:39": "node/1800383252",
}
NO_MATCH = {"bbb:71", "bbb:34", "bbb:23", "bbb:20", "bbb:14", "bbb:15"}
LEISURE = {
  "way/12271505": (
    "jump-reinickendorf",
    "JUMP House Berlin Reinickendorf",
    "https://www.jumphouse.de/berlin/",
  ),
  "node/9282901515": (
    "myjump-nordbahnhof",
    "MYJUMP Berlin Mitte",
    "https://myjump.de/berlin-mitte/kontakt-anfahrt/",
  ),
  "way/71882068": ("mountmitte", "MountMitte", "https://beachmitte.de/mountmitte/"),
  "way/69547558": (
    "jungfernheide",
    "Waldhochseilgarten Jungfernheide",
    "https://waldhochseilgarten-jungfernheide.de/kontakt-anfahrt/",
  ),
  "way/46181323": (
    "schwedter-nordwand",
    "Kletteranlage Schwedter Nordwand",
    "https://www.alpinclub-berlin.de/Kletteranlagen/Aussenanlagen/Schwedter_Nordwand",
  ),
}
# Complete permanent state-owned site census, Sportstättenstatistik 2025 p.13.
# OSM site identity is separate from a survey of all sixteen individual surfaces.
ICE_CENSUS = [
  ("erika-hess", "Erika-Heß-Eisstadion", "way/16183708", 1, 1),
  ("horst-dohm", "Horst-Dohm-Eisstadion", "way/9770708", 2, 0),
  ("lankwitz", "Eisbahn Lankwitz", "way/27012752", 2, 0),
  (
    "werner-seelenbinder",
    "Eisstadion im Werner-Seelenbinder-Sportpark",
    "way/45336440",
    2,
    0,
  ),
  ("paul-heyse", "Sportkomplex Berlin (Paul-Heyse-Straße)", "relation/11758036", 0, 1),
  ("charlottenburg", "Eissporthalle Charlottenburg (PO9)", "way/152946723", 0, 2),
  ("sportforum", "Sportforum Berlin", "way/156581602", 0, 5),
]


def norm(s):
  return re.sub(
    "[^a-z0-9]", "", unicodedata.normalize("NFKD", s.lower().replace("ß", "ss"))
  )


def registry():
  source = read(SOURCE)
  objects = read(OSM)["records"]
  by_id = {r["id"]: r for r in objects}
  geoms = {r["id"]: shape(r["geometry"]) for r in objects}
  rows = []
  features = {}

  def add_feature(o, facility, category):
    if o["id"] not in features:
      features[o["id"]] = {**o, "category": category, "facilities": []}
    features[o["id"]]["facilities"].append(facility)

  for b in source["records"]:
    point = Point(b["point"])
    candidates = []
    for o in objects:
      t = o["tags"]
      g = geoms[o["id"]]
      name = norm(t.get("name", ""))
      if (
        not name
        or g.distance(point) > 550
        or t.get("leisure")
        not in ("sports_centre", "stadium", "swimming_pool", "swimming_area")
      ):
        continue
      score = (
        SequenceMatcher(None, norm(b["name"]), name).ratio()
        + (0.2 if g.covers(point) else 0)
        - g.distance(point) / 4000
      )
      if score > 0.64:
        candidates.append((score, o))
    candidates.sort(key=lambda x: -x[0])
    o = by_id.get(ALIASES.get(b["id"], "")) or (
      candidates[0][1] if candidates and b["id"] not in NO_MATCH else None
    )
    row = {k: b[k] for k in ["id", "name", "url", "point", "types", "address"]}
    row["category"] = "bbb"
    row["sourceObject"] = o["id"] if o else None
    row["status"] = (
      "mapped-site-existing-geometry-retained"
      if o
      else "unresolved-exact-site-footprint"
    )
    row["improvements"] = []
    if o:
      site = geoms[o["id"]]
      siteExtent = (
        unary_union([Polygon(p.exterior) for p in getattr(site, "geoms", [site])])
        if site.area
        else site
      )
      row["geometry"] = o["geometry"]
      row["mappedName"] = o["tags"].get("name")
      row["binding"] = "reviewed-operator-name-and-exact-mapped-site"
      outdoor = any(t in b["types"] for t in ["Freibad", "Strandbad"])
      if outdoor and site.area > 0:
        for pool in objects:
          if (
            pool["tags"].get("leisure") != "swimming_pool"
            or pool["tags"].get("indoor") == "yes"
            or pool["tags"].get("location") == "indoor"
          ):
            continue
          pg = geoms[pool["id"]]
          if pg.area > 15 and siteExtent.covers(pg):
            add_feature(pool, b["id"], "outdoor-pool")
      elif o["tags"].get("building"):
        add_feature(o, b["id"], "pool-building")
    rows.append(row)
  for o in objects:
    t = o["tags"]
    g = geoms[o["id"]]
    n = t.get("name", "")
    sport = t.get("sport", "")
    stadium = t.get("leisure") == "stadium" or "stadion" in n.lower()
    if stadium:
      pitches = [
        p
        for p in objects
        if p["tags"].get("leisure") == "pitch"
        and "soccer" in p["tags"].get("sport", "")
        and geoms[p["id"]].area > 3500
        and unary_union([Polygon(z.exterior) for z in getattr(g, "geoms", [g])])
        .buffer(0.05)
        .covers(geoms[p["id"]])
      ]
      row = dict(
        id="stadium:" + o["id"],
        name=n or o["id"],
        category="football-stadium"
        if pitches or "soccer" in sport
        else "other-stadium",
        sourceObject=o["id"],
        geometry=o["geometry"],
        url="https://www.berlin.de/sen/inneres/sportmetropole-berlin/sportinfrastruktur/",
        status="mapped-site-existing-geometry-retained",
        improvements=[],
      )
      for p in pitches:
        add_feature(p, row["id"], "soccer-pitch")
      if row["category"] == "other-stadium":
        row["status"] = "non-football-or-unclassified-stadium-retained"
      rows.append(row)
    if t.get("leisure") == "ice_rink":
      row = dict(
        id="ice:" + o["id"],
        name=n or "Mapped ice rink " + o["id"],
        category="ice-rink",
        sourceObject=o["id"],
        geometry=o["geometry"],
        url="https://www.berlin.de/sen/inneres/sportmetropole-berlin/veroeffentlichungen/sportstaettenstatistik-2025.pdf",
        status="mapped-ice-owner-retained",
        improvements=[],
      )
      if (
        not t.get("building")
        and t.get("covered") not in ("yes", "building")
        and t.get("indoor") != "yes"
      ):
        add_feature(o, row["id"], "outdoor-ice")
      rows.append(row)
    if o["id"] in LEISURE:
      ident, name, url = LEISURE[o["id"]]
      rows.append(
        dict(
          id=ident,
          name=name,
          url=url,
          category="named-leisure",
          sourceObject=o["id"],
          geometry=o["geometry"],
          status="existing-specialized-model-retained"
          if ident in ["myjump-nordbahnhof", "jungfernheide"]
          else "mapped-site-source-detail-review",
          improvements=[],
        )
      )
    if o["id"] in ("way/172422438", "way/172422439"):
      add_feature(o, "schwedter-nordwand", "climbing-wall")
  for ident, name, source_id, outdoor, indoor in ICE_CENSUS:
    o = by_id.get(source_id)
    rows.append(
      dict(
        id="public-ice:" + ident,
        name=name,
        category="official-ice-site",
        sourceObject=source_id if o else None,
        geometry=o["geometry"] if o else None,
        outdoorFacilities=outdoor,
        coveredFacilities=indoor,
        url="https://www.berlin.de/sen/inneres/sportmetropole-berlin/veroeffentlichungen/sportstaettenstatistik-2025.pdf",
        sourcePage=13,
        status="authored-erika-hess-hall-and-outdoor-rink-preserved"
        if ident == "erika-hess"
        else "physical-site-retained-individual-interiors-not-surveyed",
        improvements=[],
      )
    )
  # Explicitly keep the unproven Mauerpark operator identities unresolved.
  rows.append(
    dict(
      id="mauerpark-jump-house",
      name="JUMP House am Mauerpark",
      category="requested-identity",
      status="no-official-branch-found-central-site-is-myjump-nordbahnhof",
      improvements=[],
    )
  )
  write(
    INVENTORY,
    dict(
      schemaVersion=1,
      records=rows,
      features=list(features.values()),
      counts=dict(
        records=len(rows),
        bbb=67,
        officialIceSites=7,
        officialIceFacilities=16,
        features=len(features),
        categories=dict(Counter(r["category"] for r in rows)),
      ),
      policy="All official BBB entries retained with outcomes. All seven permanent state-owned ice sites have explicit outcomes. OSM stadium classification is not a completeness claim for every informal football ground; no indoor ice is drawn outdoors. Operator point is never an entrance. Public ice season/closure does not change physical geometry.",
    ),
  )
  print(
    "records",
    len(rows),
    "features",
    len(features),
    Counter(f["category"] for f in features.values()),
  )


def scan():
  inv = read(INVENTORY)
  features = inv["features"]
  chunks = read(PUBLIC / "manifest.json")["chunks"]
  jobs = []
  for c in chunks:
    if c.get("detailCompanionOf"):
      continue
    near = [
      f
      for f in features
      if shape(f["geometry"]).intersects(box(*c["bounds"]))
      and f["category"] != "pool-building"
    ]
    if not near:
      continue
    for mode in ("drawn", "minecraft"):
      jobs.append(
        dict(
          id=c["id"],
          mode=mode,
          path=str(PUBLIC / c[mode]["url"]),
          windows=[list(shape(f["geometry"]).bounds) for f in near],
          featureIds=[f["id"] for f in near],
        )
      )
  write(TASK / "capture-jobs.json", jobs)
  print("capture jobs", len(jobs), "hosts", len(jobs) // 2)


def horizontal_support(capture, desired):
  groups = defaultdict(list)
  triangles = np.asarray(capture["triangles"]).reshape(-1, 3, 3)
  for t in triangles:
    if np.ptp(t[:, 1]) > 0.011:
      continue
    p = Polygon(t[:, [0, 2]])
    if p.area < 0.001 or not p.intersects(desired):
      continue
    groups[round(float(t[0, 1]), 2)].append(p)
  return {y: unary_union(ps) for y, ps in groups.items()}, triangles


def blocked_buildings(capture, desired):
  ox, _, oz = capture["plan"]["origin"]
  return unary_union(
    [
      translate(Polygon(b["ring"], b.get("holes", [])), ox, oz).buffer(0)
      for b in capture["nav"]["buildings"]
      if b["height"] - b["minHeight"] > 0.5
    ]
  ).intersection(desired)


def frame(g):
  r = g.minimum_rotated_rectangle
  if g.area / r.area < 0.94:
    return None
  a, b, c, _ = list(r.exterior.coords)[:4]
  if math.dist(a, b) < math.dist(b, c):
    a, b = b, c
  a, b = np.array(a), np.array(b)
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])
  coords = np.asarray(r.exterior.coords)
  center = np.array([r.centroid.x, r.centroid.y])
  u = (coords - center) @ d
  v = (coords - center) @ n
  return center, d, n, float(np.ptp(u)), float(np.ptp(v))


def climbing_detail(f, cap, native):
  """Small relief holds attached to actual decoded faces of the two mapped stelae.

  The DAV establishes concrete relief and artificial holds, but does not publish
  a survey of individual routes. Their neutral colours and spacing are display
  estimates; the old independently shaped body is never moved or replaced.
  """
  from scripts.build_fuel_packets_v351 import Mesh, rgb

  origin = cap["plan"]["origin"]
  owner = "OSM-" + f["id"].replace("/", "-")
  body = next((b for b in cap["nav"]["buildings"] if b["sourceId"] == owner), None)
  if body is None:
    return None
  poly = translate(Polygon(body["ring"]), origin[0], origin[2])
  tri = np.asarray(cap["triangles"]).reshape(-1, 3, 3)
  faces = []
  coords = list(poly.exterior.coords)
  for a, b in zip(coords, coords[1:]):
    a, b = np.array(a), np.array(b)
    length = np.linalg.norm(b - a)
    if length < 1.5:
      continue
    d = (b - a) / length
    n = np.array([-d[1], d[0]])
    if poly.contains(Point(*((a + b) / 2 + n * 0.1))):
      n = -n
    projected = []
    for t in tri:
      xz = t[:, [0, 2]]
      dist = (xz - a) @ n
      if abs(dist).max() > 0.025:
        continue
      p = Polygon(np.column_stack(((xz - a) @ d, t[:, 1])))
      if p.area > 0.05:
        projected.append(p)
    if not projected:
      continue
    support = unary_union(projected)
    u0, lo, u1, hi = support.bounds
    if hi - lo < 3:
      continue
    faces.append((length, a, d, n, lo, hi, support))
  if not faces:
    return None
  # The two wide climbing faces, independently selected on cardinal Native walls.
  mesh = Mesh(origin)
  anchors = []
  for length, a, d, n, lo, hi, support in sorted(faces, key=lambda r: -r[0])[:2]:
    for row, y in enumerate(np.arange(lo + 0.8, hi - 0.6, 0.72)):
      for column, u in enumerate(
        np.arange(0.45 + (row % 2) * 0.26, length - 0.3, 0.67)
      ):
        half = 0.10 if native else 0.085
        rectangle = box(u - half, y - 0.08, u + half, y + 0.08)
        if not support.buffer(0.005).covers(rectangle):
          continue
        center = a + d * u
        foot = Polygon(
          [
            center + d * s + n * v
            for s, v in [(-half, 0.01), (half, 0.01), (half, 0.14), (-half, 0.14)]
          ]
        )
        colour = rgb(
          [(128, 125, 111), (171, 162, 139), (116, 118, 105)][(row + column) % 3]
        )
        mesh.prism(foot, y - 0.08, y + 0.08, colour)
        anchors.append(
          [round(float(center[0]), 2), round(float(y), 2), round(float(center[1]), 2)]
        )
  if not anchors:
    return None
  return mesh, dict(
    owner=owner,
    holdCount=len(anchors),
    anchors=anchors,
    fullyDecodedWallSupport=True,
    detail="concrete-relief-and-artificial-climbing-holds",
    estimate="DAV-confirmed hold presence; positions and neutral tones illustrative, old stela body retained",
  )


def build():
  from scripts.build_fuel_packets_v351 import Mesh, rgb
  from scripts.build_public_green_v329 import native_pixels

  inv = read(INVENTORY)
  manifest = {c["id"]: c for c in read(PUBLIC / "manifest.json")["chunks"]}
  jobs = read(TASK / "capture-jobs.json")
  byfeature = defaultdict(set)
  for job in jobs:
    for ident in job["featureIds"]:
      byfeature[ident].add(job["id"])
  capture_cache = {}

  def capture(host, mode):
    key = mode + ":" + host
    if key not in capture_cache:
      capture_cache[key] = read(TASK / "captures" / f"{mode}-{host}.json.gz")
    return capture_cache[key]

  packets = {}
  outcomes = []

  def batch(host, mode):
    key = mode + ":" + host
    if key not in packets:
      p = capture(host, mode)["plan"]
      packets[key] = dict(
        plan={k: v for k, v in p.items() if k != "preparedRecords"},
        mesh=Mesh(p["origin"]),
        owners=[],
        features=[],
      )
    return packets[key]

  for f in inv["features"]:
    if f["category"] == "pool-building":
      outcomes.append(
        dict(
          id=f["id"],
          category=f["category"],
          facilities=f["facilities"],
          status="mapped-hall-retained-no-new-interior-survey",
        )
      )
      continue
    g = shape(f["geometry"])
    report = dict(
      id=f["id"],
      category=f["category"],
      facilities=f["facilities"],
      status="no-common-retained-surface-support",
    )
    if f["category"] == "climbing-wall":
      for host in sorted(byfeature[f["id"]]):
        pair = {
          mode: climbing_detail(f, capture(host, mode), mode == "minecraft")
          for mode in ("drawn", "minecraft")
        }
        if not all(pair.values()):
          continue
        for mode, (mesh, proof) in pair.items():
          dst = batch(host, mode)
          for key in mesh.vertices:
            if key not in dst["mesh"].vertices:
              dst["mesh"].vertices[key] = len(dst["mesh"].vertices)
          reverse = list(mesh.vertices)
          dst["mesh"].indices.extend(
            dst["mesh"].vertices[reverse[i]] for i in mesh.indices
          )
          dst["owners"].append("OSM-" + f["id"].replace("/", "-"))
          dst["features"].append(f["id"])
        report.update(
          status="added-supported-detail-both-modes",
          host=host,
          proofs={mode: value[1] for mode, value in pair.items()},
        )
        break
      outcomes.append(report)
      continue
    if "bbb:3" in f["facilities"]:
      report["status"] = "authored-monbijou-pool-and-coping-preserved"
      outcomes.append(report)
      continue
    choices = []
    for host in sorted(byfeature[f["id"]]):
      c = manifest[host]
      desired = g.intersection(box(*c["bounds"]).buffer(-0.1))
      if desired.area < g.area * 0.2:
        continue
      pair = {}
      valid = True
      for mode in ("drawn", "minecraft"):
        cap = capture(host, mode)
        if len(cap["plan"]["preparedRecords"]) >= 15:
          valid = False
          break
        floors, tri = horizontal_support(cap, desired)
        obstacle = blocked_buildings(cap, desired)
        desired = desired.difference(obstacle)
        if desired.area < g.area * 0.2:
          valid = False
          break
        possible = [
          (y, p)
          for y, p in floors.items()
          if p.intersection(desired).area / desired.area > 0.98
        ]
        if not possible:
          valid = False
          break
        # The admitted bounded source portion shares an existing plane in each mode; no
        # flattening of sloped terrain, no new scene-level ground.
        y, support = max(possible, key=lambda v: v[0])
        pair[mode] = (cap, tri, y, support.intersection(desired))
      if valid:
        choices.append((host, pair))
    if not choices:
      outcomes.append(report)
      continue
    host, pair = min(
      choices,
      key=lambda q: (
        q[0].startswith(("publicInstitutions", "ubahnApproach")),
        -min(v[3].area for v in q[1].values()),
        q[0],
      ),
    )
    parts = {}
    proofs = {}
    valid = True
    for mode, (cap, tri, y, support) in pair.items():
      native = mode == "minecraft"
      origin = cap["plan"]["origin"]
      mesh = Mesh(origin)
      if f["category"] in ("outdoor-pool", "outdoor-ice"):
        clip = g.buffer(-0.04)
        if native:
          clip = native_pixels(clip, 0.25)
        band = clip.difference(clip.buffer(-(0.5 if native else 0.34)))
        # Preserve older ladders, diving platforms and authored raised edges.
        occupied = []
        for t in tri:
          if t[:, 1].max() < y + 0.07 or t[:, 1].min() > y + 1.4:
            continue
          p = Polygon(t[:, [0, 2]])
          if p.area > 0.001 and p.intersects(band):
            occupied.append(p.buffer(0.08))
        band = band.difference(unary_union(occupied)).intersection(
          support.buffer(-0.005)
        )
        if native:
          band = native_pixels(band, 0.25)
        if band.area < 1:
          valid = False
          break
        colour = (
          rgb((219, 221, 210))
          if f["category"] == "outdoor-pool"
          else rgb((221, 225, 219))
        )
        mesh.prism(band, y + 0.015, y + 0.065, colour)
        # Exact inner perimeter drainage/tile line. Dimensions are display
        # estimates supported by operator pool photos, not a surveyed tile atlas.
        inner = clip.buffer(-(0.62 if native else 0.46))
        trim = inner.difference(inner.buffer(-(0.25 if native else 0.09))).intersection(
          support
        )
        if native:
          trim = native_pixels(trim, 0.25)
        if not trim.is_empty:
          mesh.surface(
            trim,
            y + 0.025,
            rgb((63, 110, 126))
            if f["category"] == "outdoor-pool"
            else rgb((61, 90, 121)),
          )
        proofs[mode] = dict(
          groundY=y,
          sourceArea=round(g.area, 3),
          supportedArea=round(g.intersection(support).area, 3),
          rimArea=round(band.area, 3),
          detail="mapped-basin-coping-and-inner-tile-line"
          if f["category"] == "outdoor-pool"
          else "mapped-outdoor-rink-edge-and-blue-trim",
        )
      elif f["category"] == "soccer-pitch":
        axes = frame(g)
        if axes is None:
          valid = False
          break
        center, d, n, length, width = axes
        if not (86 < length < 122 and 47 < width < 91):
          valid = False
          break

        def coord(u, v):
          return center + d * u + n * v

        goals = []
        for sign in (-1, 1):
          a = coord(sign * (length / 2 - 1), -3.66)
          b = coord(sign * (length / 2 - 1), 3.66)
          corridor = LineString([a, b]).buffer(0.3, cap_style=2)
          # Do not double an existing frame, fence, spectator or source detail.
          conflict = False
          for t in tri:
            if t[:, 1].max() < y + 0.35 or t[:, 1].min() > y + 2.8:
              continue
            projected = Polygon(t[:, [0, 2]])
            if not projected.is_valid:
              projected = projected.buffer(0)
            if (
              projected if projected.area > 0.0001 else LineString(t[:, [0, 2]])
            ).intersects(corridor):
              conflict = True
              break
          if conflict or not support.covers(corridor):
            continue
          for p in (a, b):
            foot = (
              Point(*p).buffer(0.055, quad_segs=2)
              if not native
              else box(p[0] - 0.075, p[1] - 0.075, p[0] + 0.075, p[1] + 0.075)
            )
            if not support.covers(foot) or not g.covers(foot):
              continue
            mesh.prism(foot, y + 0.02, y + 2.48, rgb((226, 228, 218)))
          bar = LineString([a, b]).buffer(0.055, cap_style=2)
          if native:
            bar = native_pixels(bar.buffer(0.12), 0.15)
          mesh.prism(bar, y + 2.42, y + 2.53, rgb((226, 228, 218)))
          goals.append(sign)
        if not goals:
          valid = False
          break
        proofs[mode] = dict(
          groundY=y,
          sourceArea=round(g.area, 3),
          supportedArea=round(g.intersection(support).area, 3),
          goalEnds=goals,
          detail="open-goal-frames-on-existing-field-lines",
          dimensions="IFAB7.32x2.44m; placement from mapped pitch rectangle and retained1m line inset is estimated",
        )
      if not mesh.indices:
        valid = False
        break
      part = mesh.payload()
      part["kind"] = KIND
      parts[mode] = mesh
    if (
      valid
      and f["category"] == "soccer-pitch"
      and proofs["drawn"]["goalEnds"] != proofs["minecraft"]["goalEnds"]
    ):
      valid = False
    if not valid:
      report["status"] = "existing-specialized-detail-or-incomplete-support-preserved"
      outcomes.append(report)
      continue
    for mode, mesh in parts.items():
      dst = batch(host, mode)
      for key, index in mesh.vertices.items():
        # Mesh vertex dictionaries de-duplicate by position and colour; preserve
        # that ownership instead of assuming a plain append offset.
        if key not in dst["mesh"].vertices:
          dst["mesh"].vertices[key] = len(dst["mesh"].vertices)
      reverse = list(mesh.vertices)
      dst["mesh"].indices.extend(dst["mesh"].vertices[reverse[i]] for i in mesh.indices)
      dst["owners"].append(f["id"])
      dst["features"].append(f["id"])
    report.update(status="added-supported-detail-both-modes", host=host, proofs=proofs)
    outcomes.append(report)
  plans = {}
  for key, b in packets.items():
    append = b["mesh"].payload()
    append["kind"] = KIND
    plans[key] = dict(
      b["plan"],
      owners=sorted(set(b["owners"])),
      retire=[],
      append=append,
      appendFingerprint=part_fingerprint(append),
    )
  source = dict(schemaVersion=1, keys=sorted(plans), packets=plans)
  write(TASK / "sportsLeisureV352Packets.json", source)
  sources = []
  for index, host in enumerate(sorted({k.split(":")[1] for k in source["keys"]})):
    keys = [k for k in source["keys"] if k.endswith(":" + host)]
    value = dict(schemaVersion=1, keys=keys, packets={k: plans[k] for k in keys})
    file = f"sportsLeisureV352Packets{index:03}.json.gz"
    write(DATA / file, value)
    import gzip

    sources.append(
      dict(
        file=file,
        keys=keys,
        decodedBytes=len(gzip.decompress((DATA / file).read_bytes())),
      )
    )
  write(DATA / "sportsLeisureV352Index.json", dict(schemaVersion=1, sources=sources))
  old = DATA / "sportsLeisureV352Packets.json"
  if old.exists():
    old.unlink()
  for row in inv["records"]:
    row["improvements"] = [
      r["id"]
      for r in outcomes
      if row["id"] in r["facilities"]
      and r["status"] == "added-supported-detail-both-modes"
    ]
    if row["improvements"]:
      row["status"] = "supported-surface-or-goal-details-added"
    elif row["status"] == "mapped-site-source-detail-review":
      row["status"] = "mapped-site-retained-no-new-verified-architectural-detail"
  inv["featureOutcomes"] = outcomes
  inv["counts"]["improvedSites"] = sum(bool(r["improvements"]) for r in inv["records"])
  inv["counts"]["improvedFeatures"] = sum(
    r["status"] == "added-supported-detail-both-modes" for r in outcomes
  )
  inv["counts"]["hosts"] = len(plans) // 2
  write(INVENTORY, inv)
  write(
    GEO / "sports-leisure-v352-evidence.json.gz",
    dict(
      schemaVersion=1,
      kind=KIND,
      source="sports-leisure-v352-inventory.json.gz",
      featureOutcomes=outcomes,
      counts=inv["counts"],
      policy="Every new footprint is supported by final decoded old geometry; a feature may cover only the supported portion of its source polygon. Native contours and wall faces are independent. All old geometry/navigation/materials unchanged. Coping widths, hold distribution and goal placement are explicit display estimates; no lane counts, entrances, interior pools or temporary ice roofs invented.",
    ),
  )
  print("added", inv["counts"])
  print("statuses", Counter(r["status"] for r in outcomes))


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--registry", action="store_true")
  p.add_argument("--scan", action="store_true")
  p.add_argument("--build", action="store_true")
  a = p.parse_args()
  if a.registry:
    registry()
  if a.scan:
    scan()
  if a.build:
    build()
