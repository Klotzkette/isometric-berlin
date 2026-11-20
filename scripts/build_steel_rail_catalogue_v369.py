"""Join Berlin bridge outlines to same-level active tracks and DB route records.

The original OSM rings and axes, rejected candidates and height samples remain
offline. Source capture is optional; a normal rebuild only reads frozen evidence.
"""

from __future__ import annotations

import gzip
import json
import math
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OSM = GEO / "steel-rail-osm-v369.json.gz"
DB = GEO / "db-bridge-axes-v369.json.gz"
EVIDENCE = GEO / "steel-rail-catalogue-v369.json.gz"
HEIGHTS = GEO / "steel-rail-heights-v369.json.gz"
RAIL = {"rail", "light_rail", "subway"}
REFERENCES = {
  "kietz": "https://kl-ing.de/news/detail/kreuzungsbauwerk-kietz-einschub-in-endlage-erfolgt/",
  "oberspree": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095002%2CT",
  "liesen": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030292",
  "spanisch": "https://kl-ing.de/projekte/projekt/eue-spanische-allee-berlin/",
  "stadtbahn": "https://www.berlin.de/sen/uvk/_assets/umwelt/laerm/laermminderungsplanung-berlin/laermaktionsplan2013_2018.pdf#page=33",
  "nord": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050083",
  "stamm": "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-industrie-und-technik/hochbahn-652730.php",
  "gleis": "https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/aemter/stadtentwicklungsamt/bebauungsplaene/vi-140cab_k6_denkmalpflege_170717.pdf",
}
# The two old metal spans no longer carry tracks; the simple western S-Bahn
# replacement does. The current OSM polygon on the western part says 'truss'
# and is therefore specifically not a basis for a historical truss silhouette.
RETIRED = {533541339, 533541340}
KNOWN = {
  934857213: ("girder", "spanisch"),
  1158221686: ("girder", "spanisch"),
  333893460: ("truss", "oberspree"),
  339298147: ("truss", "kietz"),
  221400827: ("truss", "gleis"),
  1000916523: ("truss", "gleis"),
}

STADTBAHN = {
  266284849,
  163937009,
  163936714,
  163936713,
  574155309,
  1095576130,
  266284850,
}
PHOTO = {
  135703568: ("girder", 51908485),
  195092597: ("girder", 196454936),
  266285058: ("girder", 36943320),
  269331898: ("girder", 57825030),
  432421235: ("girder", 174082565),
  408340895: ("girder", 45510102),
  312249573: ("arch", 36784425),
  195401022: ("girder", 58247645),
}
for ident, (form, photograph) in PHOTO.items():
  key = f"photograph-{photograph}"
  REFERENCES[key] = f"https://commons.wikimedia.org/?curid={photograph}"
  KNOWN[ident] = (form, key)
for ident in STADTBAHN:
  KNOWN[ident] = ("arch" if ident == 266284850 else "girder", "stadtbahn")


def read(path):
  return json.loads(
    gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
  )


def save(path, value):
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def parts(geometry):
  if geometry.geom_type == "LineString" and geometry.length > 0:
    yield geometry
  elif hasattr(geometry, "geoms"):
    for child in geometry.geoms:
      yield from parts(child)


def endpoints(line):
  coords = np.asarray(line.coords)
  return coords[-1] - coords[0]


def outlines_and_matches(osm):
  rails = [r for r in osm["ways"] if r["tags"].get("railway") in RAIL]
  untagged = osm.get("otherRailWaysCrossingOutlines", [])
  all_tagged = len(rails)
  rails += untagged
  tracks = [LineString(r["points"]) for r in rails]
  tree = STRtree(tracks)
  for r in osm["ways"] + osm["relations"]:
    t = r["tags"]
    if (
      t.get("man_made") != "bridge"
      or len(r["points"]) < 4
      or r["points"][0] != r["points"][-1]
    ):
      continue
    poly = Polygon(r["points"], r.get("holes"))
    if not poly.is_valid or poly.area < 7:
      continue
    hits = []
    for k in tree.query(poly):
      rt = rails[k]["tags"]
      if k >= all_tagged and not (
        (r["id"] in STADTBAHN or r["id"] in PHOTO) and rt.get("ref") in {"6024", "6109"}
      ):
        continue
      cross_verified = r["id"] in STADTBAHN or r["id"] in {
        135703568,
        195092597,
        266285058,
        269331898,
        312249573,
        195401022,
      }
      db_stadtbahn = (
        cross_verified
        and rt.get("ref") in {"6024", "6109"}
        and rt.get("layer") in {"1", "2"}
      )
      active_sachsendamm = (
        r["id"] == 408340895 and rt.get("ref") == "6020" and rt.get("layer") == "2"
      )
      if (
        k < all_tagged
        and rt.get("layer", "1") != t.get("layer", "1")
        and not (db_stadtbahn or active_sachsendamm)
      ) or rt.get("tunnel", "no") != "no":
        continue
      if rt.get("bridge") in {"construction", "proposed"} or rt.get("disused") == "yes":
        continue
      for segment in parts(poly.intersection(tracks[k])):
        if segment.length >= 3.3:
          hits.append((rails[k], segment))
    if hits or r["id"] in RETIRED:
      yield r, poly, hits


def bridge_sides(poly, direction):
  """Locate end caps in track coordinates. Keep skew and every plan edge."""
  if poly.interiors:
    return None
  detail = np.array(poly.simplify(0.035, preserve_topology=True).exterior.coords[:-1])
  # Breaks in cadastral vertex numbering often divide a straight abutment into
  # five or more edges. Identify the cap on a coarser shell, then extract each
  # complete longitudinal side from the original detailed shell.
  pts = np.array(
    Polygon(detail).simplify(0.80, preserve_topology=True).exterior.coords[:-1]
  )
  if len(pts) < 4:
    return None
  lateral = np.array([-direction[1], direction[0]])
  u = pts @ direction
  v = pts @ lateral
  width = np.ptp(v)
  if width < 2.5:
    return None
  # A skew end may span many metres along the rails. Favour an edge that
  # crosses almost the whole bed over an extreme but tiny chamfer.
  candidates = []
  for i in range(len(pts)):
    j = (i + 1) % len(pts)
    fraction = abs(v[i] - v[j]) / width
    if fraction > 0.42:
      candidates.append((i, (u[i] + u[j]) / 2, fraction))
  if len(candidates) < 2:
    return None
  start = min(candidates, key=lambda x: x[1] + width * 0.3 * (1 - x[2]))[0]
  end = max(candidates, key=lambda x: x[1] - width * 0.3 * (1 - x[2]))[0]
  if start == end:
    return None

  def side(i, j):
    i = int(np.argmin(np.linalg.norm(detail - pts[i % len(pts)], axis=1)))
    j = int(np.argmin(np.linalg.norm(detail - pts[j % len(pts)], axis=1)))
    return list(
      detail[i : j + 1] if i <= j else np.concatenate([detail[i:], detail[: j + 1]])
    )

  side_a = side(start + 1, end)
  side_b = side(end + 1, start)[::-1]
  if min(len(side_a), len(side_b)) < 2:
    return None
  left, right = sorted(
    [LineString(side_a), LineString(side_b)],
    key=lambda segment: (
      np.asarray(segment.interpolate(0.5, normalized=True).coords[0]) @ lateral
    ),
    reverse=True,
  )
  if min(left.length, right.length) < 3.5 or max(left.length, right.length) > max(
    min(left.length, right.length) * 2, min(left.length, right.length) + 12
  ):
    return None
  fractions = {0.0, 1.0}
  for side in [left, right]:
    distance = 0.0
    for a, b in zip(list(side.coords), list(side.coords)[1:]):
      distance += math.dist(a, b)
      fractions.add(min(1.0, distance / side.length))
  # An accumulated side length can stop one machine epsilon short of one.
  # Always retain the real abutment and suppress near-coincident stations.
  min_step = 0.045 / max(left.length, right.length)
  stations = [0.0]
  for value in sorted(fractions):
    if value - stations[-1] > min_step and 1.0 - value > min_step:
      stations.append(value)
  fractions = [*stations, 1.0]
  edges = [
    np.asarray([side.interpolate(f, normalized=True).coords[0] for f in fractions])
    for side in (left, right)
  ]
  center = (edges[0] + edges[1]) / 2
  line = LineString(center)
  if (
    line.length < 5
    or not line.is_simple
    or line.length > 320
    or not poly.buffer(0.65).covers(line)
  ):
    return None
  measured = np.linalg.norm(edges[0] - edges[1], axis=1)
  # The true width perpendicular to the carried tracks, also at skew ends.
  perpendicular = np.abs((edges[0] - edges[1]) @ lateral)
  width = float(np.median(perpendicular))
  if (
    width < 2.6
    or width > 55
    or np.min(perpendicular) < width * 0.50
    or np.max(measured) > width * 3
  ):
    return None
  return line, [e.round(2).tolist() for e in edges], round(width, 2)


def track_offsets(line, edges, hits):
  """Check supported centre lines at actual plan cross sections."""
  p = line.interpolate(0.5, normalized=True)
  unit = endpoints(line) / np.linalg.norm(endpoints(line))
  normal = np.array([-unit[1], unit[0]])
  midpoint = np.array(p.coords[0])
  transect = LineString([midpoint - normal * 80, midpoint + normal * 80])
  tracks = []
  for record, segment in hits:
    crossing = segment.intersection(transect)
    if crossing.geom_type != "Point" or crossing.is_empty:
      continue
    vec = endpoints(segment)
    if abs(vec @ unit) < max(np.linalg.norm(vec) * 0.91, 1):
      continue
    offset = float((np.array(crossing.coords[0]) - midpoint) @ normal)
    if all(abs(offset - o) > 0.8 for o in tracks):
      tracks.append(offset)
  return [round(x, 2) for x in sorted(tracks)]


def db_match(hits, poly, dbs, dbtree, dbaxes):
  refs = {r["tags"].get("ref") for r, segment in hits}
  matched = []
  for k in dbtree.query(poly.buffer(5)):
    row = dbs[k]
    if row["route"] not in refs:
      continue
    axis = dbaxes[k]
    covered = axis.intersection(poly.buffer(4)).length
    if covered > min(6, axis.length * 0.68) and any(
      line.distance(axis) < 8 for _, line in hits
    ):
      matched.append(int(k))
  return sorted(set(matched))


def mapped_supports(rows):
  records = read(GEO / "steel-rail-cadastre-v369.json.gz")["records"]
  plans = [(p, shape(p["geometry"])) for p in records if p["class"] == 1840]
  caps = [(p, shape(p["geometry"])) for p in records if p["class"] == 1845]
  plans_tree = STRtree([g for p, g in plans])
  caps_tree = STRtree([g for p, g in caps])
  owned = set()
  for row, poly, line, edges, width, offsets in rows:
    row["piers"] = []
    for k in sorted(plans_tree.query(poly)):
      pier, plan = plans[k]
      if (
        pier["id"] in owned
        or not poly.covers(plan.centroid)
        or not 0.10 < plan.area < 55
      ):
        continue
      with np.errstate(divide="ignore", invalid="ignore"):
        rect = plan.minimum_rotated_rectangle
      if not rect.area or plan.area / rect.area < 0.70:
        continue
      pts = np.array(rect.exterior.coords[:-1])
      vecs = np.roll(pts, -1, axis=0) - pts
      lengths = np.linalg.norm(vecs, axis=1)
      if max(lengths) > min(38, width * 1.45) or min(lengths) < 0.23:
        continue
      u = vecs[np.argmax(lengths)] / max(lengths)
      center = np.array(plan.centroid.coords[0])
      a = center - u * max(lengths) / 2
      b = center + u * max(lengths) / 2
      # A nearby bridge on a different level may own this support. Require
      # the plan to belong to the deck, not just share its point centroid.
      if poly.buffer(0.30).intersection(plan).area / plan.area < 0.83:
        continue
      row["piers"].append(
        {
          "id": pier["id"],
          "a": a.round(2).tolist(),
          "b": b.round(2).tolist(),
          "width": round(float(min(lengths)), 2),
        }
      )
      owned.add(pier["id"])
    ends = []
    for idx in (0, -1):
      cap = LineString([edges[0][idx], edges[1][idx]])
      accepted = []
      for k in caps_tree.query(cap.buffer(2.2)):
        abut, geo = caps[k]
        if (
          cap.intersection(geo.buffer(2)).length < cap.length * 0.73
          or geo.intersection(cap.buffer(2)).length < cap.length * 0.50
        ):
          continue
        accepted.append(abut["id"])
      ends.append(sorted(accepted))
    row["abutments"] = ends
    yield row, poly, line, edges, width, offsets


def bvg_sections(osm):
  """Pair cadastral deck boundaries with the two original active rail axes."""
  cad = read(GEO / "steel-rail-cadastre-v369.json.gz")["records"]
  ways = [r for r in osm["ways"] if r["tags"].get("railway") == "subway"]
  segments = [LineString(r["points"]) for r in ways]
  tree = STRtree(segments)
  # Surveyed, exposed viaduct between station halls. The protected brick
  # sections near Gleisdreieck and the brick-clad Oberbaumbrücke are outside.
  south = [(-509, -307), (780, 1152), (1320, 2186), (2346, 3063), (3200, 3269)]
  # The two accurately modelled full station halls remain open. Exact mapped
  # ramp and railway station levels come from v238 and v334.
  north = [(-3948, -3428), (-3175, -2640), (-2640, -2571), (-2411, -2256)]
  corridors = [("stamm", 0, a, b, box(a, 1800, b, 2500)) for a, b in south]
  corridors.extend(("nord", 1, a, b, box(2780, a, 3040, b)) for a, b in north)
  result = []
  checks = []
  for outline in cad:
    if outline["class"] not in [1800, 1830]:
      continue
    shape0 = shape(outline["geometry"])
    for name, axis, start, end, bounds in corridors:
      if not shape0.intersects(bounds) or (name == "nord" and outline["class"] != 1830):
        continue
      for j in range(math.floor(start / 64), math.floor(end / 64) + 1):
        lo, hi = max(j * 64, start), min((j + 1) * 64, end)
        clip = box(lo, 1800, hi, 2500) if axis == 0 else box(2780, lo, 3040, hi)
        cut = shape0.intersection(clip)
        if cut.is_empty or cut.area < 20:
          continue
        polygons = (
          [cut]
          if cut.geom_type == "Polygon"
          else [g for g in getattr(cut, "geoms", []) if g.geom_type == "Polygon"]
        )
        for part, poly in enumerate(polygons):
          if poly.area < 20:
            continue
          hits = []
          for k in tree.query(poly):
            for ln in parts(segments[k].intersection(poly)):
              if ln.length > 2:
                hits.append((ways[k], ln))
          if not hits:
            continue
          id = f"{outline['id']}-{lo}-{hi}-{part}"
          row = {
            "id": id,
            "cadastralDeck": outline["id"],
            "trackWays": sorted({r["id"] for r, segment in hits}),
            "dbRows": [],
            "form": "girder",
            "evidence": name,
            "outcome": "unresolved cadastral deck association",
          }
          checks.append(row)
          longest = max(hits, key=lambda g: g[1].length)[1]
          direction = endpoints(longest)
          direction = direction / np.linalg.norm(direction)
          if direction[axis] < 0:
            direction *= -1
          if abs(direction[axis]) < 0.65:
            continue
          geo = bridge_sides(poly, direction)
          if geo is None:
            continue
          line, edges, width = geo
          offsets = track_offsets(line, edges, hits)
          if (
            not 2.5 < width < 15
            or len(offsets) != 2
            or not all(abs(o) + 0.72 < width / 2 for o in offsets)
          ):
            continue
          if max(g.length for _, g in hits) < line.length * 0.6:
            continue
          result.append((row, poly, line, edges, width, offsets))
  return result, checks


def select():
  osm = read(OSM)
  dbs = read(DB)["records"]
  dbaxes = [unary_union([LineString(s) for s in r["courses"]]) for r in dbs]
  dbtree = STRtree(dbaxes)
  cadastral = [
    (r, shape(r["geometry"]))
    for r in read(GEO / "steel-rail-cadastre-v369.json.gz")["records"]
    if r["class"] == 1800
  ]
  cadastral_tree = STRtree([p for _, p in cadastral])
  lst = []
  audit = []
  for rec, poly, hits in outlines_and_matches(osm):
    tags = rec["tags"]
    id = rec["id"]
    row = {
      "id": id,
      "trackWays": sorted({r["id"] for r, segment in hits}),
      "dbRows": db_match(hits, poly, dbs, dbtree, dbaxes),
      "outcome": "no positive steel or railway truss evidence",
    }
    audit.append(row)
    declared = tags.get("bridge:structure")
    material = tags.get("bridge:material", tags.get("material"))
    source = "OSM material tag" if material == "steel" else None
    form = {"beam": "girder", "truss": "truss", "arch": "arch"}.get(declared, "steel")
    if id in KNOWN:
      form, source = KNOWN[id]
    elif id in RETIRED:
      form, source = "truss", "liesen"
    elif id == 365734778:
      row["outcome"] = (
        "active 1950s replacement; adjacent retired truss spans separately recorded"
      )
      continue
    elif declared == "truss" and material not in {"concrete", "wood", "stone"}:
      source = "OSM railway truss; construction mapped, alloy unrecorded"
    if not source:
      # A material-neutral missing bed requires independent corroboration by
      # the register AND the surveyed cadastral outline; do not infer material
      # or mimic arches as rectangular sheets from overhead imagery.
      if (
        not row["dbRows"]
        or declared not in {None, "beam", "slab", "girder"}
        or id in {195397543, 574155311}
        or tags.get("bridge") == "viaduct"
      ):
        continue
      scores = []
      for k in cadastral_tree.query(poly):
        plan, geom = cadastral[k]
        overlap = poly.intersection(geom).area
        if overlap / poly.area > 0.72 and overlap / min(poly.area, geom.area) > 0.82:
          scores.append((overlap / poly.area, plan["id"]))
      if not scores:
        continue
      row["cadastralDeck"] = max(scores)[1]
      form, source = (
        "unclassified",
        "registered and surveyed railway deck; material unspecified",
      )
    # An active rail must actually follow the long axis, not merely cross
    # on a second structure sharing an imprecise map layer.
    if id in RETIRED:
      rectangle = np.array(poly.minimum_rotated_rectangle.exterior.coords)
      direction = max(np.diff(rectangle, axis=0), key=np.linalg.norm)
    else:
      longest = max(hits, key=lambda pair: pair[1].length)[1]
      direction = endpoints(longest)
    direction /= np.linalg.norm(direction)
    if direction[0] < 0:
      direction *= -1
    geometry = bridge_sides(poly, direction)
    if not geometry:
      row["outcome"] = (
        "geometry has holes, ambiguity, excessive divergence or unresolved end edges"
      )
      continue
    line, edges, width = geometry
    if form == "unclassified":
      # Crossing a line at a single corner is not a register match. The
      # certified DB route must run through the central part of this deck.
      if not 6 <= line.length <= 95 or width > 32:
        row["outcome"] = "neutral candidate outside compact verified deck range"
        continue
      stations = [line.interpolate(f, normalized=True) for f in (0.25, 0.5, 0.75)]
      if not any(
        all(dbaxes[k].distance(p) < width / 2 + 3 for p in stations)
        for k in row["dbRows"]
      ):
        row["outcome"] = "rail register alignment unresolved"
        continue
    offsets = track_offsets(line, edges, hits)
    # A station-side platform can flare on one side only. The side coordinates,
    # not the median normal width, define the actual deck rim. Project the gauge
    # on the true ring before widening the renderer's symmetric nominal measure.
    if offsets and any(abs(o) + 0.7175 >= width / 2 for o in offsets):
      midpoint = np.array(line.interpolate(0.5, normalized=True).coords[0])
      tangent = endpoints(line) / np.linalg.norm(endpoints(line))
      normal = np.array([-tangent[1], tangent[0]])
      if all(
        poly.buffer(0.08).covers(Point(midpoint + normal * (o + i * 0.7175)))
        for o in offsets
        for i in [-1, 1]
      ):
        width = round(2 * (max(abs(o) for o in offsets) + 0.83), 2)
    if id not in RETIRED and (
      not offsets or not all(abs(o) + 0.7175 < width / 2 for o in offsets)
    ):
      row["outcome"] = "mapped tracks do not cross safely inside both measured sides"
      continue
    if hits and max(segment.length for _, segment in hits) < line.length * 0.60:
      # OSM can split every one of the carried tracks at a shared node in
      # the middle of a bridge. Require a connected rail across the footprint.
      from shapely.ops import linemerge

      merged = linemerge([g for _, g in hits])
      if not any(
        g.length >= line.length * 0.68
        and abs(endpoints(g) @ direction) > g.length * 0.88
        for g in parts(merged)
      ):
        row["outcome"] = (
          "rail overlaps too little of footprint to justify a complete span"
        )
        continue
    if id in {339298147, 333893460} and (
      not 55 < line.length < 85 or len(offsets) not in (2, 4)
    ):
      raise ValueError(f"verified railway span association changed: {id}")
    row["form"] = form
    row["evidence"] = source
    lst.append((row, poly, line, edges, width, offsets))
  extra, checked = bvg_sections(osm)
  return lst + extra, audit + checked


def samples_on_line(line, fractions):
  return [
    list(line.interpolate(float(f), normalized=True).coords[0]) for f in fractions
  ]


def unpack_surface_hits(packet, probes):
  """Read actual old horizontal surfaces at five track stations in either style."""
  import base64

  origin = np.asarray(packet["origin"])
  result = [[] for _ in probes]
  for m in packet["meshes"]:
    if m.get("positionType") != "u16cm":
      continue
    v = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) * 0.01
      + origin
    )
    idx = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    if len(idx) == 0 or np.max(idx) >= len(v):
      continue
    tris = v[idx]
    a = tris[:, 0]
    b = tris[:, 1]
    c = tris[:, 2]
    dx1, dz1 = b[:, 0] - a[:, 0], b[:, 2] - a[:, 2]
    dx2, dz2 = c[:, 0] - a[:, 0], c[:, 2] - a[:, 2]
    normal = dx1 * dz2 - dz1 * dx2
    valid = abs(normal) > 1.0e-6
    denom = np.where(valid, normal, 1)
    for k, (x, z) in enumerate(probes):
      v1 = ((x - a[:, 0]) * dz2 - (z - a[:, 2]) * dx2) / denom
      v2 = (dx1 * (z - a[:, 2]) - dz1 * (x - a[:, 0])) / denom
      yes = valid & (v1 >= -1.0e-5) & (v2 >= -1.0e-5) & (v1 + v2 <= 1.00001)
      ys = a[:, 1] + v1 * (b[:, 1] - a[:, 1]) + v2 * (c[:, 1] - a[:, 1])
      for y in sorted(set(np.round(ys[yes], 2))):
        result[k].append([m["kind"], float(y)])
  return result


def intersecting_hosts(manifest, line):
  p = line.interpolate(0.5, normalized=True)
  return [c for c in manifest["chunks"] if box(*c["bounds"]).covers(p)]


def support(rows):
  """Prefer the ordinary tile whose *actual mesh* carries plan-aligned local terrain."""
  import hashlib

  manifest = read(PACK / "manifest.json")
  cache = {}

  def packet(c, mode):
    key = c["id"], mode
    if key not in cache:
      path = PACK / c[mode]["url"]
      cache[key] = read(path)
    return cache[key]

  for row, poly, line, edges, width, offsets in rows:
    probes = samples_on_line(line, [0.1, 0.3, 0.5, 0.7, 0.9])
    hs = intersecting_hosts(manifest, line)
    candidates = []
    for host in hs:
      draws = {}
      for mode in ("drawn", "minecraft"):
        pack = packet(host, mode)
        draws[mode] = unpack_surface_hits(pack, probes)
      count = sum(bool(probe) for mode in draws.values() for probe in mode)
      ground_count = sum(
        any(k == "city" or abs(y - 3) < 1 for k, y in hits)
        for mode in draws.values()
        for hits in mode
      )
      if count:
        candidates.append((ground_count, count, host, draws))
    candidates.sort(key=lambda c: (-c[0], -c[1], c[2]["id"]))
    if candidates:
      _, _, host, probes = candidates[0]
      sha = {mode: host[mode].get("sha256") for mode in ("drawn", "minecraft")}
      psha = {
        mode: hashlib.sha256(
          packet(host, mode)["meshes"][0]["positions"].encode()
        ).hexdigest()
        for mode in ("drawn", "minecraft")
        if packet(host, mode)["meshes"]
      }
      receipts = {"sha": sha, "positionSha": psha}
    else:
      middle = line.interpolate(0.5, normalized=True)
      host = {
        "id": f"steel369-{math.floor(middle.x / 512)}_{math.floor(middle.y / 512)}",
        "bounds": [round(v, 2) for v in poly.bounds],
      }
      receipts = {}
    overlaps = {}
    if candidates:
      for mode in ("drawn", "minecraft"):
        overlaps[mode] = [
          sorted(
            [
              list(pair)
              for pair in {
                tuple(pair) for _, _, _, data in candidates for pair in data[mode][k]
              }
            ]
          )
          for k in range(5)
        ]
    yield row, poly, line, edges, width, offsets, host, receipts, overlaps


def fit_heights(row, line, heights):
  a = heights.get(str(row["id"]), {})
  if "bdom" not in a:
    return None
  deck = np.asarray(a["bdom"]["track"])
  ground = float(np.median(a["dgm"]["datum"]))
  if row["id"] == 163936713:
    # DGM spans the railway bed itself under Savignyplatz station. The bare
    # pavement on both sides of Bleibtreustraße registers the underpass level.
    flank = a["dgm"].get("flanks")
    if flank and abs(flank[0] - flank[1]) < 0.7:
      ground = float(np.mean(flank))
  # The DGM is a bare-earth model. The rail is a low continuous band in
  # each track cross-section; trees, catenary and through chords lie above it.
  d = np.percentile(deck, 30, axis=1)
  fractions = np.linspace(0.08, 0.92, len(d))
  threshold = 1.20 + line.length * 0.024
  credible = abs(d - np.median(d)) < threshold
  if np.sum(credible) < 7:
    return None
  samples = list(zip(fractions[credible], d[credible]))
  gradients = [
    (b - a) / (j - i)
    for k, (i, a) in enumerate(samples)
    for j, b in samples[k + 1 :]
    if j - i > 0.2
  ]
  slope = float(np.median(gradients)) if gradients else 0.0
  if abs(slope) > line.length * 0.046:
    return None
  base = float(np.median([a - i * slope for i, a in samples]))
  residual = np.abs(d - (base + slope * fractions))
  if np.count_nonzero(residual < 1) > 6 and 2.65 < (base + slope / 2 - ground) < 21:
    return base, slope, ground
  return None


def core_or_outer_datum(line):
  return core_ground_at(*line.interpolate(0.5, normalized=True).coords[0])


@lru_cache(maxsize=1)
def core_ground():
  return read(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")


def core_ground_at(x, z):
  d = core_ground()
  grid = d["grid"]
  h = d["ground_height"]
  dx = math.floor(x / d["cell_m"]) - grid["min_x_idx"]
  dz = math.floor(z / d["cell_m"]) - grid["min_z_idx"]
  if not 0 <= dx < grid["cols"] or not 0 <= dz < grid["rows"]:
    return 3.0
  run = next((m for a, n, m in d["ground_rows"][dz] if a <= dx < a + n), None)
  if run is None:
    return 3.0
  if d["classes"][run] in {"water", "basin", "pond"}:
    return d["water_top_y_m"]
  ix = dx // h["stride_cells"]
  iz = dz // h["stride_cells"]
  return h["y_dm"][iz * h["cols"] + ix] / 10


def source_height(i, line, hs, fit):
  """Return pier-top registration from pre-existing elevated models, or the WCS."""
  ids = {str(v) for v in i["trackWays"]}
  south = read(GEO / "south-elevated-v238-source.json.gz")["tracks"]
  current = [
    r for r in south if r["id"] in ids and shape(r["geometry"]).distance(line) < 4
  ]
  if current:
    fam = current[0]["family"]

    def height(x, z):
      return (
        5.2
        + (
          14.08 - min(8.08, max(0.0, x - 225) * 8.08 / 1100)
          if fam == "U1"
          else 6 + 3.08 * min(1, max(0.0, (x + 500) / 560))
        )
        + 0.185
      )

    return height, False, "v238 carried rail head"
  if i.get("evidence") == "nord":
    middle = line.interpolate(0.5, normalized=True).y
    if -2640 <= middle <= -2255:
      archive = read(GEO / "north-elevated-v238-source.json.gz")
      profile = sorted(
        (r["world"][1], r["streetNHN"]) for r in archive["terrainSamples"]
      )
      zz, hh = map(list, zip(*profile))
      anchors = [-2410.0, -2164.3, -2074.04]
      clear = [5.7, 1.5, 0.15]
      tops = [np.interp(z, zz, hh) + v for z, v in zip(anchors, clear)]

      def north_rail(x, z):
        return (
          8.7 if z <= -2410 else 3 + np.interp(z, anchors, tops) - np.interp(z, zz, hh)
        ) + 0.08

      return north_rail, False, "v238 Eberswalder elevated rail head"
  if fit is None:
    return None, None, "height source unresolved"
  absolute, slope, ground = fit
  # At water crossings the packet river surface is at -1; city streets are
  # levelled to +3. Use the actual lowest water surface in the sampled mesh.
  vals = [y for mode in hs.values() for k, y in mode[2] if k == "city"]
  datum = min(vals) if vals and min(vals) < 1 else core_or_outer_datum(line)
  sources = read(DB)["records"]
  if any("Wasser" in sources[j]["crossing"] for j in i["dbRows"]) and not vals:
    datum = -1.0

  def height(x, z):
    fraction = line.project(Point(x, z), normalized=True)
    return datum + absolute + slope * fraction - ground

  return height, True, "observed bDOM/DGM track profile on local terrain datum"


def stitch_north(spans):
  # Separate 64m cadastral slices should agree at the exact common endpoint.
  # Preserve the already installed station/ramp rail head as an anchor.
  shared = defaultdict(list)
  for span in spans:
    for idx in [0, -1]:
      x, y, z = span["course"][idx]
      shared[round(x, 1), round(z, 1)].append((span, idx, y))
  targets = {}
  for pt, group in shared.items():
    if pt[1] in [-3428, -3175]:
      targets[pt] = 8.78
    elif len(group) > 1:
      anchored = [y for sp, idx, y in group if not sp["deck"]]
      targets[pt] = float(np.mean(anchored or [y for sp, idx, y in group]))
  for sp in spans:
    if not sp["deck"]:
      continue
    c = sp["course"]
    points = np.asarray(c)
    ls = np.linalg.norm(np.diff(points[:, [0, 2]], axis=0), axis=1)
    total = sum(ls)
    deltas = [
      targets.get((round(c[idx][0], 1), round(c[idx][2], 1)), c[idx][1]) - c[idx][1]
      for idx in [0, -1]
    ]
    fractions = np.r_[0, np.cumsum(ls) / total]
    for p, t in zip(c, fractions):
      p[1] = round(p[1] + (1 - t) * deltas[0] + t * deltas[1], 2)
    ln = LineString(points[:, [0, 2]])
    for pier in sp.get("piers", []):
      t = ln.project(Point(np.mean([pier["a"], pier["b"]], axis=0)), normalized=True)
      pier["high"] = round(pier["high"] + (1 - t) * deltas[0] + t * deltas[1], 2)


def reconcile(audit):
  """Account for every source record without equating rail axes to bridges."""
  db = read(DB)["records"]
  ways = [r for r in read(OSM)["ways"] if r["tags"].get("railway") in RAIL]
  db_rows = defaultdict(list)
  track_rows = defaultdict(list)
  for rec in audit:
    for no in rec["dbRows"]:
      db_rows[no].append(rec)
    for no in rec["trackWays"]:
      track_rows[no].append(rec)

  def coverage(key, rows):
    status = "no matching carried-rail footprint with construction evidence"
    if any(r["outcome"] == "rendered" for r in rows):
      status = "has rendered section"
    elif rows:
      status = "candidate reviewed; no new rendered section"
    return [key, status, [r["id"] for r in rows]]

  return {
    "dbRegister": [coverage(i, db_rows[i]) for i in range(len(db))],
    "mappedBridgeTrackWays": [coverage(w["id"], track_rows[w["id"]]) for w in ways],
    "note": "A record can describe one track, one route direction, a piece of a continuous viaduct, or a DB passage under a road. A rendered section is never a claim to have modelled the full source way. Bespoke Skalitzer Straße and Humboldthafen models are maintained separately.",
  }


def build():
  rows, audit = select()
  heights = read(HEIGHTS)["records"]
  tiles = {}
  exterior = {}
  continuity = []
  for row, poly, line, edges, width, offsets, host, receipt, hs in support(
    mapped_supports(rows)
  ):
    fit = fit_heights(row, line, heights)
    if row["id"] in RETIRED:
      # The DSM over these disused spans sees upper chords, bare ties and
      # the road below. Fit the old rail bed only to the low interior plateau.
      h = heights[str(row["id"])]
      side = np.asarray(h["bdom"]["sides"])
      low = np.concatenate(
        [
          np.percentile(side, 20, axis=(0, 2)),
          np.percentile(h["bdom"]["track"], 15, axis=1),
        ]
      )
      gs = np.median(h["dgm"]["datum"])
      valid = low[(low > gs + 4) & (low < gs + 7.8)]
      if len(valid) >= 3:
        fit = (float(np.median(valid)), 0.0, float(gs))
      else:
        fit = None
    height, deck, method = source_height(row, line, hs, fit)
    row["surfaceProbes"] = hs
    if row["form"] == "unclassified":

      def flat_track(mode):
        # The old single-surface city mesh has only a flat road, railway
        # or water across the documented overpass. Bare green land or an
        # unsampled area is insufficient to establish the missing structure.
        return sum(
          any(
            kind == "city"
            and any(abs(y - v) < 0.021 for v in [-1.15, 3.09, 3.12, 3.15])
            for kind, y in probe
          )
          for probe in mode
        ) >= 3 and all(kind == "city" and y < 4 for probe in mode for kind, y in probe)

      if (
        not deck
        or not hs
        or not all(flat_track(mode) for mode in hs.values())
        or fit is None
        or fit[0] + fit[1] * 0.5 - fit[2] < 3
      ):
        row["outcome"] = (
          "neutral candidate lacks co-registered flat transport/water surface in both styles or reliable rail height"
        )
        continue
    if height is None:
      row["outcome"] = method
      continue
    y = float(height(*line.interpolate(0.5, normalized=True).coords[0]))
    # Skip an independently modelled occupied building or structure on top
    # of real rails: its registered roof is not the deck of this bridge.
    high = [
      [y0 for kind, y0 in mode[2] if y0 > y - 1.0 and kind != "city"]
      for mode in hs.values()
    ]
    occupied = any(
      sum(
        any(kind == "city" and y0 >= max(y - 1.5, 7) for kind, y0 in probe)
        for probe in mode
      )
      >= 2
      for mode in hs.values()
    )
    if deck and (any(b for b in high) or occupied):
      row["outcome"] = "earlier raised structure overlaps; deck association unresolved"
      continue
    row["heightMethod"] = method
    row["outcome"] = "rendered"
    row["host"] = host["id"]
    course = [
      [round(x, 2), round(height(x, z), 2), round(z, 2)] for x, z in line.coords
    ]
    span = {
      "course": course,
      "width": width,
      "form": row["form"],
      "edges": edges,
      "deck": deck,
      "trackOffsets": offsets,
    }
    if row.get("evidence") in {"nord", "stamm"}:
      span["paint"] = 0x526E61
      if row["evidence"] == "nord":
        continuity.append(span)
    if deck and row["id"] not in RETIRED:

      def ground(x, z):
        # Use the lowest existing plan surface only on waterfront structures.
        water = [
          y
          for modes in hs.values()
          for probe in modes
          for kind, y in probe
          if kind == "city" and y < 1
        ]
        return min(water) if water and row["piers"] else core_ground_at(x, z)

      piers = []
      for p in row["piers"]:
        x, z = np.mean([p["a"], p["b"]], axis=0)
        low = ground(x, z)
        high = height(x, z) - 0.86
        if high - low > 0.45:
          piers.append(
            dict(
              a=p["a"],
              b=p["b"],
              width=p["width"],
              low=round(low, 2),
              high=round(high, 2),
            )
          )
      if piers:
        span["piers"] = piers
      bases = [
        round(core_ground_at(*pt), 2) if end else None
        for pt, end in zip([line.coords[0], line.coords[-1]], row["abutments"])
      ]
      if any(val is not None for val in bases):
        span["abutmentBaseY"] = bases
    if row["id"] in RETIRED:
      span["deck"] = False
    if row["form"] == "truss":
      h = heights[str(row["id"])]
      upper = np.percentile(np.asarray(h["bdom"]["sides"]), 90, axis=2)
      # Directly compare the deck and both side observations in the same NHN datum.
      absolute = (
        (fit[0] + fit[1] * np.linspace(0.08, 0.92, 11))
        if fit
        else np.full(11, np.median(h["bdom"]["track"]))
      )
      over = upper - absolute
      if (
        row["id"] in RETIRED
        or row["id"] == 333893460
        or (np.min(np.sum(over > 2.2, axis=1)) >= 3)
      ):
        rise = float(np.percentile(over, 85))
        if 2.2 < rise < 17:
          span.update(through=True, trussHeight=round(rise, 2))
          if row["id"] in RETIRED or row["id"] == 333893460:
            span["bow"] = True
    if row["id"] in {135703568, 408340895}:
      span["riveted"] = True
    if row["id"] == 339298147:
      # The resident engineering photograph confirms top chords above the tracks.
      span.update(through=True, trussHeight=round(line.length * 0.105, 2))
      row["trussEstimate"] = (
        "steel truss known from on-site engineer; rise estimated relative to documented 63 m span"
      )
    tile = tiles.setdefault(host["id"], {**receipt, "drawn": [], "minecraft": []})
    for mode in ["drawn", "minecraft"]:
      tile[mode].append(span)
    if host["id"].startswith("steel369-"):
      shared = exterior.setdefault(host["id"], dict(host))
      old = shared["bounds"]
      new = host["bounds"]
      shared["bounds"] = [
        min(old[0], new[0]),
        min(old[1], new[1]),
        max(old[2], new[2]),
        max(old[3], new[3]),
      ]
  stitch_north(continuity)
  save(DATA / "steelRailHostIdsV369.json", sorted(set(tiles) - set(exterior)))
  save(DATA / "steelRailExteriorV369.json", [exterior[k] for k in sorted(exterior)])
  save(DATA / "steelRailSpansV369.json", {"schema": 1, "tiles": tiles})
  save(
    EVIDENCE,
    {
      "schema": 1,
      "references": REFERENCES,
      "outlineAudit": audit,
      "reconciliation": reconcile(audit),
      "coverage": dict(Counter(row["outcome"] for row in audit)),
    },
  )
  print(
    "Rendered by form",
    dict(Counter(r["form"] for r in audit if r["outcome"] == "rendered")),
  )
  print(dict(Counter(r["outcome"] for r in audit)))


if __name__ == "__main__":
  build()
