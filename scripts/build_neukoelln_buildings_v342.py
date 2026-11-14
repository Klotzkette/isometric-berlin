"""Complete source-owned Stadtbad and Körnerpark Orangerie replacements.

The candidate packet and the retirement recipe are staged together. Integration
must apply retirement after earlier source-quarter transactions, never rewrite
their original input. No raw archive, photograph or shared manifest is written.
"""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_rixdorf_v304 import (
  fingerprint,
  line_retirement,
  native_model,
  navigation,
  roof_lines,
  translated_surfaces,
)
from build_surrounding_outlines import (
  chunk_payload,
  load_projected_polygon,
  world,
)
from integrate_city_refinements_v166 import line_signature

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "neukoelln-buildings-v342-source.json.gz"
PREVIOUS = "5566e5db"
KIND = "neukoelln-buildings-v342"
TARGETS = {
  "stadtbad": (
    "OSM-way-132238037",
    "DEBE08YYF00003Pp",
    "neukoelln-v305/LoD2_393_5815.zip",
  ),
  "orangerie": (
    "OSM-way-453832399",
    "DEBE08YYF0000B7B",
    "public-fidelity-v326/LoD2_393_5814.zip",
  ),
}


def json_bytes(value):
  def numeric(v):
    if isinstance(v, np.generic):
      return v.item()
    raise TypeError(type(v).__name__)

  return (
    json.dumps(
      value, ensure_ascii=False, separators=(",", ":"), allow_nan=False, default=numeric
    )
    + "\n"
  ).encode()


def sha(raw):
  return hashlib.sha256(raw).hexdigest()


def original(path):
  return subprocess.check_output(
    ["git", "show", f"{PREVIOUS}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def read(path):
  b = path.read_bytes()
  return json.loads(gzip.decompress(b) if path.suffix == ".gz" else b)


def extract():
  """Freeze all 12 official parts; the raw archives are already local."""
  old = pyogrio.read_dataframe(
    GEO / "raw/ring-v182/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('OSM-way-132238037','OSM-way-453832399')",
  )
  sites = []
  for key, (osm, parent, archive) in TARGETS.items():
    path = GEO / "raw" / archive
    element = extract_parent(path, parent)
    parts = [part_profile(q) for q in leaf_building_parts(element) or [element]]
    row = next(r for r in old.to_dict("records") if r["sourceId"] == osm)
    oldrow = {
      k: v
      for k, v in row.items()
      if k != "geometry"
      and v is not None
      and not (isinstance(v, float) and math.isnan(v))
    }
    oldrow["geometry"] = mapping(row["geometry"])
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    sites.append(
      dict(
        key=key,
        id=parent,
        labels=[key],
        parts=parts,
        predecessor=oldrow,
        originalHeight=row["height"],
        measuredHeight=max(p["top_y_m"] for p in parts)
        - min(p["ground_y_m"] for p in parts),
        officialCoveredFraction=footprint.intersection(row["geometry"]).area
        / row["geometry"].area,
        archive=dict(
          path=str(path.relative_to(ROOT)),
          sha256=sha(path.read_bytes()),
          url="https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
          license="dl-de/zero-2-0",
        ),
      )
    )
  refs = [
    dict(
      site="stadtbad",
      page="https://www.berlin.de/ba-neukoelln/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.1515066.php",
      photo="https://www.berlin.de/ba-neukoelln/_assets/bilder/stadtentwicklungsamt/untere-denkmalschutzbehoerde/stadtbad-neukoelln_frosch-ausschnitt_janina-gallert_2024.jpg",
      credit="Bezirksamt Neukölln / Janina Gallert, 2024",
      imageSha256=sha((GEO / "raw/neukoelln-v342/stadtbad.jpg").read_bytes()),
      interpretation="Pale plaster, cream pilasters/cornices, tripartite windows and arched fanlights; measured complete roof/body, estimated small fittings.",
    ),
    dict(
      site="orangerie",
      page="https://www.berlin.de/kunst-und-kultur-neukoelln/kulturorte/galerie-im-koernerpark/",
      photo="https://www.berlin.de/kunst-und-kultur-neukoelln/_assets/fotos/kulturorte/galerie-im-koernerpark-mit-allgemeinen-fotos-zur-galerie/img_2739.jpg",
      credit="Bezirksamt Neukölln / Nihad Nino Pušija",
      imageSha256=sha((GEO / "raw/neukoelln-v342/orangerie.jpg").read_bytes()),
      interpretation="Measured long stepped Orangerie, white tall arched glazing, green climbing plants around openings and pale cornices; estimated small fittings.",
    ),
  ]
  result = dict(
    schemaVersion=1,
    previous=PREVIOUS,
    sites=sites,
    references=refs,
    mappedSource=dict(
      url="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      license="ODbL-1.0",
    ),
    policy="All official parent parts and original wall/roof rings retained. Whole families translated to the current 3m street datum; Körnerpark sunken terrain is not claimed corrected. Outside old body complements retained. Photos external reference only, no pixels bundled. Fittings are estimates, no surveyed interior or current tenant claim.",
  )
  SOURCE.write_bytes(gzip.compress(json_bytes(result), mtime=0))
  return result


def front(surface, footprint):
  """Return the measured wall plane with a positively exterior normal."""
  ring = surface["rings"][0]
  pairs = [(a, b) for a, b in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - b[1]) < 0.02]
  if not pairs:
    return None
  a, b = max(pairs, key=lambda q: math.dist(q[0], q[1]))
  av, bv = np.array(a)[[0, 2]], np.array(b)[[0, 2]]
  length = float(np.linalg.norm(bv - av))
  if length < 4:
    return None
  d = (bv - av) / length
  n = np.array([-d[1], d[0]])
  midpoint = (av + bv) / 2
  positive = footprint.covers(Point(midpoint + n * 0.1))
  negative = footprint.covers(Point(midpoint - n * 0.1))
  # Joined official parts retain every measured dividing sheet. Decorations
  # belong only on the external family boundary, never hidden partition walls.
  if positive and negative:
    return None
  if positive:
    n = -n
  plane = Polygon([[(np.array(q)[[0, 2]] - av).dot(d), q[1]] for q in ring]).buffer(0)
  return av, d, n, length, plane


def fittings(detail, surface, site, footprint):
  f = front(surface, footprint)
  if f is None:
    return 0
  a, d, n, w, plane = f
  # The references show the east-facing park front, and the Ganghoferstraße
  # front facing north-northwest. Back walls retain measured material only.
  if (site == "orangerie" and n[0] < 0.8) or (site == "stadtbad" and n[1] > -0.7):
    return 0
  lo, hi = plane.bounds[1], plane.bounds[3]
  if hi - lo < 4:
    return 0
  count = max(1, round(w / (5.3 if site == "orangerie" else 5.2)))
  pale = (222, 216, 196)
  glass = (76, 101, 105)

  def poly(q, c, role, offset=0.10):
    cut = Polygon(q).intersection(plane)
    for part in getattr(cut, "geoms", [cut]):
      if not isinstance(part, Polygon) or part.area < 0.00001:
        continue
      rings = [
        [
          [
            float(a[0] + d[0] * u + n[0] * offset),
            float(y),
            float(a[1] + d[1] * u + n[1] * offset),
          ]
          for u, y in list(r.coords)[:-1]
        ]
        for r in [part.exterior, *part.interiors]
      ]
      for tri in triangles_for(rings):
        detail.triangles.append((tri, c, role))

  def rect(u, y, width, height, c, role, offset=0.12):
    poly(
      [
        [u - width / 2, y - height / 2],
        [u + width / 2, y - height / 2],
        [u + width / 2, y + height / 2],
        [u - width / 2, y + height / 2],
      ],
      c,
      role,
      offset,
    )

  def arch(u, bottom, spring, radius):
    return [[u - radius, bottom], [u + radius, bottom]] + [
      [u + radius * math.cos(t), spring + radius * math.sin(t)]
      for t in np.linspace(0, math.pi, 17)
    ]

  def frame(u, bottom, spring, r):
    for sign in (-1, 1):
      rect(
        u + sign * r,
        (bottom + spring) / 2,
        0.10,
        spring - bottom,
        pale,
        "white glazing frame",
        0.17,
      )
    for j in range(16):
      t0, t1 = j * math.pi / 16, (j + 1) * math.pi / 16
      poly(
        [
          [u + (r + s) * math.cos(t), spring + (r + s) * math.sin(t)]
          for s, t in [(-0.055, t0), (-0.055, t1), (0.055, t1), (0.055, t0)]
        ],
        pale,
        "arched frame",
        0.17,
      )
    rect(u, spring, 2 * r, 0.09, pale, "arched transom", 0.18)
    rect(u, (bottom + spring) / 2, 0.07, spring - bottom, pale, "window mullion", 0.18)
    rect(u, bottom + 0.05, 2 * r, 0.10, pale, "window sill", 0.18)

  opening_shapes = []
  for i in range(count):
    u = (i + 0.5) * w / count
    if site == "orangerie":
      bottom = 3.25
      spring = min(7.3, hi - 1.35)
      r = min(1.12, w / count * 0.28)
      opening = arch(u, bottom, spring, r)
      opening_shapes.append(Polygon(opening).buffer(0.2))
      poly(opening, glass, "arched glass", 0.14)
      frame(u, bottom, spring, r)
      for y in np.arange(bottom + 1, spring, 0.85):
        rect(u, float(y), 2 * r, 0.065, pale, "window transom", 0.19)
      for side in (-1, 1):
        # The fanlight radiating bars are bounded inside the curved light.
        p0 = (u, spring)
        p1 = (u + side * r * 0.71, spring + r * 0.71)
        poly(
          [
            [p0[0] - 0.025, p0[1]],
            [p0[0] + 0.025, p0[1]],
            [p1[0] + 0.025, p1[1]],
            [p1[0] - 0.025, p1[1]],
          ],
          pale,
          "fanlight bar",
          0.19,
        )
    else:
      # Three separate lower lights and three attic lights below the original
      # eaves, with the broad blind panel between lower lights and fanlight.
      for y, h in [(5.9, 1.45), (13.75, 1.15)]:
        for du in (-0.68, 0, 0.68):
          rect(u + du, y, 0.51, h, glass, "tripartite glass", 0.14)
          for sign in (-1, 1):
            rect(u + du + sign * 0.285, y, 0.07, h + 0.15, pale, "window jamb", 0.19)
            rect(
              u + du,
              y + sign * (h / 2 + 0.045),
              0.64,
              0.09,
              pale,
              "window transom",
              0.19,
            )
      spring = 10.15
      r = min(1.05, w / count * 0.25)
      poly(arch(u, spring, spring, r), glass, "arched glass", 0.14)
      frame(u, spring - 0.02, spring, r)
      rect(u, spring + 0.4, 0.08, 0.8, pale, "fanlight mullion", 0.20)
      for edge in (-1, 1):
        pu = u + edge * w / count * 0.46
        rect(pu, 8.7, 0.34, 8.9, pale, "measured-front pilaster", 0.18)
        rect(pu, 12.95, 0.62, 0.22, pale, "pilaster capital", 0.23)
  if site == "orangerie":
    # The ivy is a deterministic wall-bound mosaic, clipped around every light.
    allowed = plane.intersection(
      box(0.1, 3.05, w - 0.1, min(hi - 0.2, 8.6))
    ).difference(unary_union(opening_shapes))
    for iz, y in enumerate(np.arange(3.15, min(hi, 8.6), 0.55)):
      for ix, u in enumerate(np.arange(0.22, w, 0.55)):
        patch = box(u - 0.29, y - 0.28, u + 0.29, y + 0.28).intersection(allowed)
        if patch.area < 0.03:
          continue
        tint = [(59, 89, 49), (72, 103, 56), (83, 112, 61)][(ix * 7 + iz * 3) % 3]
        for q in getattr(patch, "geoms", [patch]):
          if isinstance(q, Polygon):
            poly(
              list(q.exterior.coords)[:-1],
              tint,
              "climbing foliage",
              0.22 + (ix % 3) * 0.018,
            )
  for y, h in (
    [(hi - 0.30, 0.22), (hi - 0.08, 0.16)]
    if site == "orangerie"
    else [
      (3.25, 0.4),
      (12.75, 0.18),
      (13.1, 0.22),
      (hi - 0.30, 0.22),
      (hi - 0.08, 0.16),
    ]
  ):
    rect(w / 2, y, w, 0.0 + h, pale, "profiled cornice", 0.27)
  return count


def models(source):
  out = {}
  for site in source["sites"]:
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in site["parts"]])
    surfaces, _ = translated_surfaces(site)
    d = Detail()
    roofs = []
    for s in surfaces:
      color = (164, 162, 151) if s["kind"] == "RoofSurface" else (202, 198, 184)
      for tri in triangles_for(s["rings"]):
        d.triangles.append((tri, color, "source " + s["kind"]))
        if s["kind"] == "RoofSurface":
          roofs.append(tri)
    sheet_triangles = len(d.triangles)
    bays = sum(
      fittings(d, s, site["key"], footprint)
      for s in surfaces
      if s["kind"] == "WallSurface"
    )
    n, caps = native_model(d)
    metric = dict(
      sourceSheets=len(surfaces),
      parts=len(site["parts"]),
      sourceTriangles=sheet_triangles,
      estimatedFrontBays=bays,
      drawnTriangles=len(d.triangles),
      nativeTriangles=len(n.triangles),
      roofTriangles=roofs,
      nativeRoofCaps=caps,
    )
    out[site["key"]] = (d, n, metric, footprint)
  return out


def geometry_signature(packet):
  """Exact positions identify immutable old ownership despite color refinements."""
  result = Counter()
  for m in packet["meshes"]:
    if m["kind"] != "city":
      continue
    p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    result.update(b"".join(sorted(q.tobytes() for q in tri)) for tri in p[ix])
  return result


def retire_exact(raw, expected):
  records = []
  for mi, m in enumerate(raw["meshes"]):
    if m["kind"] != "city":
      continue
    p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    selected = []
    for i, tri in enumerate(p[ix]):
      key = b"".join(sorted(q.tobytes() for q in tri))
      if expected[key]:
        expected[key] -= 1
        selected.append(i)
    if selected:
      records.append(
        dict(
          mesh=mi,
          triangles=selected,
          originalFingerprint=fingerprint(m),
          positionsSha256=sha(base64.b64decode(m["positions"])),
          colorsSha256=sha(base64.b64decode(m["colors"])),
          originalTriangleWords=ix[selected].tolist(),
        )
      )
  assert not +expected, f"Unmatched source owner triangles: {sum((+expected).values())}"
  return records


def complement_model(raw, records, domain, native):
  """Retain original exterior surface portions beyond the complete new body.

  Sliver roofs are triangulated at their same original height. Vertical original
  facets are clipped along their horizontal edge, preserving their actual colour
  and original triangular upper/lower profiles. No new courtyard fill occurs.
  """
  out = Detail()
  from shapely.geometry import LineString

  for rec in records:
    m = raw["meshes"][rec["mesh"]]
    ps = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + raw["origin"]
    )
    cs = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    for ids in ix[rec["triangles"]]:
      tri = ps[ids]
      linear = cs[ids[0]].astype(float) / 255
      color = tuple(
        int(v)
        for v in np.round(
          np.where(
            linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055
          )
          * 255
        )
      )
      projected = Polygon(tri[:, [0, 2]])
      if projected.area > 1e-8:
        remain = projected.difference(domain)
        for q in getattr(remain, "geoms", [remain]):
          if not isinstance(q, Polygon) or q.area < 1e-9:
            continue
          # Previous OSM roof facets are exactly horizontal.
          assert np.ptp(tri[:, 1]) < 0.000001
          rings = [
            [[x, float(tri[0, 1]), z] for x, z in list(r.coords)[:-1]]
            for r in [q.exterior, *q.interiors]
          ]
          for t in triangles_for(rings):
            out.triangles.append((t, color, "retained exterior roof"))
      else:
        a, b = max(
          ((p, q) for p in tri for q in tri),
          key=lambda pq: np.linalg.norm((pq[1] - pq[0])[[0, 2]]),
        )
        delta = (b - a)[[0, 2]]
        length = float(np.linalg.norm(delta))
        if length < 1e-7:
          continue
        d = delta / length
        plane = Polygon(
          [[float((p[[0, 2]] - a[[0, 2]]).dot(d)), float(p[1])] for p in tri]
        )
        line = LineString([a[[0, 2]], b[[0, 2]]]).difference(domain.buffer(0.000001))
        for q in getattr(line, "geoms", [line]):
          if not isinstance(q, LineString) or q.length < 1e-7:
            continue
          us = [float((np.array(p) - a[[0, 2]]).dot(d)) for p in q.coords]
          clipped = plane.intersection(box(min(us), -10, max(us), 200))
          for g in getattr(clipped, "geoms", [clipped]):
            if not isinstance(g, Polygon) or g.area < 1e-8:
              continue
            out.polygon(
              [
                [float(a[0] + d[0] * u), float(y), float(a[2] + d[1] * u)]
                for u, y in list(g.exterior.coords)[:-1]
              ],
              color,
              "retained exterior wall",
            )
  return out


def outside_ink(raw, ordinals, domain):
  """Keep every old external roof-ink fragment at its original Y and colour."""
  from shapely.geometry import LineString

  if not ordinals:
    return None
  packed = raw["lines"]
  pos = (
    np.frombuffer(base64.b64decode(packed["positions"]), "<u2").reshape(-1, 2, 3) / 100
    + raw["origin"]
  )
  col = np.frombuffer(base64.b64decode(packed["colors"]), "u1").reshape(-1, 2, 3)
  points = []
  colors = []
  for i in ordinals:
    a, b = pos[i]
    line = LineString([a[[0, 2]], b[[0, 2]]])
    remain = line.difference(domain.buffer(0.000001))
    for piece in getattr(remain, "geoms", [remain]):
      if not isinstance(piece, LineString) or piece.length < 0.01:
        continue
      for x, z in [piece.coords[0], piece.coords[-1]]:
        t = line.project(Point(x, z)) / line.length
        points.append(
          np.round((np.array([x, a[1] + t * (b[1] - a[1]), z]) - raw["origin"]) * 100)
        )
        colors.append(col[i, 0])
  if not points:
    return None
  return dict(
    positions=base64.b64encode(np.array(points, dtype="<u2").tobytes()).decode(),
    colors=base64.b64encode(np.array(colors, dtype="u1").tobytes()).decode(),
  )


def stage(directory):
  source = read(SOURCE)
  built = models(source)
  directory.mkdir(parents=True, exist_ok=True)
  manifest = json.loads(original(PUBLIC / "manifest.json"))
  plans = {}
  candidates = {}
  scope = world(
    load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
      load_projected_polygon(GEO / "bounds.geojson")
    )
  )
  for desc in manifest["chunks"]:
    if not desc["id"].startswith("ring182-"):
      continue
    tile = box(*desc["bounds"])
    sites = [
      s
      for s in source["sites"]
      if shape(s["predecessor"]["geometry"]).intersects(tile)
      or built[s["key"]][3].intersects(tile)
    ]
    if not sites:
      continue
    for mode in ("drawn", "minecraft"):
      native = mode == "minecraft"
      asset = desc[mode]
      wire = original(PUBLIC / asset["url"])
      assert sha(wire) == asset["sha256"]
      raw = json.loads(gzip.decompress(wire))
      expected = Counter()
      expectedlines = Counter()
      detail = Detail()
      nav = []
      oldnav = []
      for site in sites:
        owner = {
          **site["predecessor"],
          "geometry": shape(site["predecessor"]["geometry"]),
        }
        full = chunk_payload(
          desc["id"], tile, scope.intersection(tile), [owner], {}, minecraft=native
        )
        empty = chunk_payload(
          desc["id"], tile, scope.intersection(tile), [], {}, minecraft=native
        )
        expected.update(geometry_signature(full) - geometry_signature(empty))
        if not native:
          expectedlines.update(
            line_signature(full["lines"]) - line_signature(empty["lines"])
          )
        d, n, metric, _ = built[site["key"]]
        detail.triangles.extend((n if native else d).triangles)
        nav.extend(navigation(site, metric, tile, raw["origin"], native))
        oldnav.extend(
          q for q in raw["nav"]["buildings"] if q["sourceId"] == owner["sourceId"]
        )
      records = retire_exact(raw, expected)
      lines = line_retirement(raw, expectedlines)
      domain = unary_union(
        [
          unary_union([box(*c[:4]) for c in built[s["key"]][2]["nativeRoofCaps"]])
          if native
          else built[s["key"]][3]
          for s in sites
        ]
      )
      comp = complement_model(raw, records, domain, native)
      detail.triangles.extend(comp.triangles)
      append = packed_detail(detail, tile)
      if not append:
        continue
      append["kind"] = KIND
      # Preserve every old navigation outside the source body in the same packet.
      from shapely.affinity import translate

      for old in oldnav:
        g = translate(
          Polygon(old["ring"], old["holes"]), raw["origin"][0], raw["origin"][2]
        ).difference(domain)
        for p in getattr(g, "geoms", [g]):
          if not isinstance(p, Polygon) or p.area < 1e-8:
            continue
          q = translate(p, -raw["origin"][0], -raw["origin"][2])
          nav.append(
            {
              **old,
              "ring": list(q.exterior.coords)[:-1],
              "holes": [list(h.coords)[:-1] for h in q.interiors],
              "sourceId": old["sourceId"] + ":v342-retained-outside",
            }
          )
      key = f"{mode}:{desc['id']}"
      plan = dict(
        origin=raw["origin"],
        before=asset,
        owners=[s["id"] for s in sites],
        oldOwners=[s["predecessor"]["sourceId"] for s in sites],
        retire=records,
        retireLines=lines,
        retireNav=oldnav,
        append=append,
        appendFingerprint=fingerprint(append),
        appendNav=nav,
        originalLines=raw.get("lines"),
        sourceSha256=sha(SOURCE.read_bytes()),
        sourceParts=sum(len(s["parts"]) for s in sites),
        outsideTriangles=len(comp.triangles),
      )
      if not native:
        roofink = roof_lines(detail, tile, raw["origin"])
        retained = outside_ink(raw, lines, domain)
        if roofink or retained:
          plan["appendLines"] = {
            k: base64.b64encode(
              b"".join(base64.b64decode(r[k]) for r in [roofink, retained] if r)
            ).decode()
            for k in ["positions", "colors"]
          }
      new = copy.deepcopy(raw)
      for r in records:
        mesh = new["meshes"][r["mesh"]]
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        mask = np.ones(len(ix), dtype=bool)
        mask[r["triangles"]] = False
        mesh["indices"] = base64.b64encode(ix[mask].astype("<u4").tobytes()).decode()
      if lines:
        for field, stride in [("positions", 12), ("colors", 6)]:
          data = base64.b64decode(new["lines"][field])
          new["lines"][field] = base64.b64encode(
            b"".join(
              data[i * stride : (i + 1) * stride]
              for i in range(len(data) // stride)
              if i not in set(lines)
            )
          ).decode()
      new["meshes"].append(append)
      new["nav"]["buildings"] = [
        q for q in raw["nav"]["buildings"] if q not in oldnav
      ] + nav
      decoded = json_bytes(new)
      candidate = gzip.compress(decoded, mtime=0)
      (directory / Path(asset["url"]).name).write_bytes(candidate)
      plan["candidate"] = dict(
        url=Path(asset["url"]).name,
        bytes=len(candidate),
        decodedBytes=len(decoded),
        sha256=sha(candidate),
        encoding="gzip",
      )
      plans[key] = plan
      candidates[key] = {
        k: plan[k]
        for k in (
          "before",
          "candidate",
          "owners",
          "oldOwners",
          "sourceParts",
          "outsideTriangles",
        )
      }
  # Runtime recipes keep the complete original bytes available via source Git
  # pin. They are finite; root integrates after older guarded source recipes.
  payload = dict(
    schemaVersion=1,
    previous=PREVIOUS,
    kind=KIND,
    sourceSha256=sha(SOURCE.read_bytes()),
    keys=list(plans),
    packets=plans,
  )
  (directory / "recipes.json.gz").write_bytes(
    gzip.compress(json_bytes(payload), mtime=0)
  )
  metrics = {
    key: {
      k: v for k, v in result[2].items() if k not in ("roofTriangles", "nativeRoofCaps")
    }
    for key, result in built.items()
  }
  receipt = dict(
    previous=PREVIOUS,
    kind=KIND,
    sourceSha256=sha(SOURCE.read_bytes()),
    packets=candidates,
    metrics=metrics,
  )
  (directory / "receipt.json").write_bytes(json_bytes(receipt))
  return receipt


def finalize(directory):
  """Pin the complete real late predecessor, including the active V305 receipt.

  V305 true/false produce identical immutable source words; their private active
  retirement proofs differ and are deliberately retained by the common hook.
  """
  code = r"""
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {predecessorV342,doneV342} from "./tests/helpers/neukoellnPredecessorV342";
import {surroundingPacketFingerprint} from "./src/surroundingPacketFingerprint";
const path=Bun.argv[1];
const draft=JSON.parse(gunzipSync(readFileSync(path+"/recipes.json.gz")).toString());
const fnv=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
const result={schemaVersion:1,keys:draft.keys,packets:{} as Record<string,any>};
const proof=[];
for(const key of draft.keys){
 const [family,id]=key.split(":"),native=family==="minecraft",recipe=draft.packets[key];
 const wire=readFileSync("./public/mesh/surrounding-berlin-v159/"+recipe.before.url);
 const raw=JSON.parse(gunzipSync(wire).toString());
 const prepared=await predecessorV342(structuredClone(raw),id,native,true);
 const fallback=await predecessorV342(structuredClone(raw),id,native,false);
 if(JSON.stringify(prepared)!==JSON.stringify(fallback))throw Error("Different required V305 source words");
 const records=prepared.meshes.map((p:any,mesh:number)=>({mesh,kind:p.kind,fingerprint:doneV342(surroundingPacketFingerprint(p))}));
 const navGuard=fnv(JSON.stringify(prepared.nav));
 const lineGuard=prepared.lines?fnv(prepared.lines.positions+(prepared.lines.colors??"")):null;
 const plan={origin:recipe.origin,records,preparedRecords:records,navGuard,preparedNavGuard:navGuard,lineGuard,preparedLineGuard:lineGuard,
   append:recipe.append,appendFingerprint:recipe.appendFingerprint,retire:recipe.retire.map((r:any)=>({mesh:r.mesh,triangles:r.triangles})),
   retireLines:recipe.retireLines,retireNav:recipe.retireNav,appendNav:recipe.appendNav,owners:recipe.owners,
   ...(recipe.appendLines?{appendLines:recipe.appendLines}:{})};
 result.packets[key]=plan;
 proof.push({key,records,navGuard,lineGuard,oldOwners:recipe.oldOwners,before:recipe.before,
   retainedOutsideTriangles:recipe.outsideTriangles,retiredTriangles:plan.retire.reduce((n:number,r:any)=>n+r.triangles.length,0),
   retireGeometry:recipe.retire.map((r:any)=>({mesh:r.mesh,positionsSha256:r.positionsSha256,colorsSha256:r.colorsSha256,originalTriangleWords:r.originalTriangleWords}))});
}
writeFileSync("./src/data/neukoellnBuildingsV342Packets.json",JSON.stringify(result)+"\n");
writeFileSync(path+"/prepared-proof.json",JSON.stringify({previous:draft.previous,sourceSha256:draft.sourceSha256,packets:proof})+"\n");
console.log(JSON.stringify({keys:result.keys,bytes:JSON.stringify(result).length}));
"""
  p = subprocess.run(
    ["bun", "-e", code, str(directory.resolve())],
    cwd=ROOT / "src/app",
    capture_output=True,
    text=True,
    check=True,
  )
  print(p.stdout, end="")
  (GEO / "neukoelln-buildings-v342-packet-evidence.json").write_bytes(
    (directory / "prepared-proof.json").read_bytes()
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--out", type=Path)
  args = parser.parse_args()
  if args.extract:
    extract()
  if args.out:
    result = stage(args.out)
    finalize(args.out)
    print(json.dumps(result["metrics"], indent=2))
