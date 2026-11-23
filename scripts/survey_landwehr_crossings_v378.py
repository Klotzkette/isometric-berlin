"""Intersect every mapped crossing with the main and bypass waterways and link surveyed openings."""

from collections import defaultdict

import numpy as np
import waterways_survey_v378 as s
from shapely import STRtree
from shapely.geometry import LineString, Polygon
from shapely.ops import substring

official = s.loadjson(s.GEO / "landwehr-wsa-openings-v378.json")
city = s.loadjson(s.GEO / "landwehr-berlin-survey-v378.json")
local = s.geoall("local-cross")
lookup = {r[0]: r for r in local}
decks = s.geoall("decks", True)
deck_lookup = {r[0]: r for r in decks}
deck_tree = STRtree([r[3] for r in decks])
local_tree = STRtree([r[3] for r in local])
groups = defaultdict(dict)
intersections = defaultdict(dict)
other = defaultdict(list)
for branch, axis in s.branches:
  for ix in local_tree.query(axis, predicate="intersects"):
    id, version, t, g = local[ix]
    for pt in s.crosspoints(g, axis):
      station = round(s.merged.project(pt), 2)
      if (
        t.get("waterway") in ("lock_gate", "weir", "dam")
        or t.get("tunnel")
        or t.get("railway") in ("construction", "proposed", "disused")
        and not t.get("bridge")
      ):
        other[id].append([branch, station])
        continue
      matching = deck_tree.query(pt, predicate="dwithin", distance=0.25)
      if not len(matching) and (not t.get("bridge") or t.get("bridge") == "no"):
        continue
      if t.get("man_made") == "bridge":
        continue
      if t.get("railway") in ("proposed", "construction"):
        continue
      owner = (
        decks[min(matching, key=lambda k: decks[k][3].area)][0] if len(matching) else id
      )
      # Two structurally separate decks share one multipolygon relation.
      if owner == "r5656356":
        owner += "W" if station < 2945 else "E"
      groups[owner][id] = (id, version, t, g)
      intersections[owner].setdefault(branch, []).append((id, pt, station))
rows = []
for owner, ways in groups.items():
  raw = owner[:-1] if owner.startswith("r5656356") else owner
  footprint = deck_lookup.get(raw)
  branch = (
    "Hauptlauf"
    if "Hauptlauf" in intersections[owner]
    else next(iter(intersections[owner]))
  )
  points = intersections[owner][branch]
  station = float(np.mean([q[2] for q in points]))
  wsa = (
    min(official["rows"], key=lambda row: abs(station - row[1] * 1000))
    if branch == "Hauptlauf"
    else None
  )
  if wsa and abs(station - wsa[1] * 1000) > 55:
    raise ValueError((owner, station, wsa[0]))
  if wsa and wsa[0] == "Rosa-Luxemburg-Steg" and owner == "w579947220":
    wsa = official["rows"][7]
  if wsa and owner == "w579947221":
    wsa = official["rows"][6]
  if wsa and owner == "w1000916523":
    wsa = official["rows"][18]
  if wsa and owner == "w659042633":
    wsa = official["rows"][19]

  def rank(item):
    t = item[2]
    return (
      0
      if t.get("railway") in ("rail", "light_rail", "subway", "abandoned")
      or t.get("highway")
      in ("primary", "secondary", "tertiary", "service", "residential", "living_street")
      or t.get("man_made") == "pipeline"
      else 2
      if t.get("highway") == "platform"
      else 1
    )

  priority = min(rank(r) for r in ways.values())
  relevant = [p for p in points if rank(ways[p[0]]) == priority]
  axis_pt = s.union_all([p[1] for p in relevant]).centroid
  chosen = min(relevant, key=lambda p: p[1].distance(axis_pt))
  axis_way = ways[chosen[0]]
  mid = chosen[1]
  g = axis_way[3]
  t = axis_way[2]
  station = s.merged.project(mid)
  i = g.project(mid)
  local_dir = substring(g, max(0, i - 4), min(g.length, i + 4))
  course = np.array(local_dir.coords[-1]) - local_dir.coords[0]
  course /= np.linalg.norm(course)
  # WSA left/right are from upstream. Half-sections grow toward the
  # hydrographic right bank (left side of the west-to-east station axis).
  f = s.merged.project(mid)
  channel = (
    np.array(s.merged.interpolate(min(s.merged.length, f + 1)).coords[0])
    - s.merged.interpolate(max(0, f - 1)).coords[0]
  )
  if course[0] * channel[1] - course[1] * channel[0] < 0:
    course = -course
  side = np.array([-course[1], course[0]])
  center = np.array(axis_pt.coords[0])

  def arr(v):
    return [round(float(x), 2) for x in v]

  name = (
    wsa[0]
    if wsa
    else (footprint[2].get("name") if footprint else None)
    or t.get("bridge:name")
    or t.get("name")
    or ("Stadtbahn über den Zooarm" if owner == "w574155311" else None)
  )
  assert name, (owner, ways)
  city_rows = city["crossings"].get(str(wsa[1]) if wsa else name, [])
  material = city_rows[0]["material"] if city_rows else None
  form = (
    city_rows[0]["type"]
    if city_rows
    else (footprint[2].get("bridge:structure") if footprint else None)
  )
  role = (
    "utility"
    if t.get("man_made") == "pipeline"
    else "former-rail"
    if t.get("railway") == "abandoned"
    else "rail"
    if t.get("railway")
    else "foot"
    if t.get("highway") in ("path", "footway", "pedestrian", "cycleway")
    else "street"
  )
  if owner == "w375352347":
    role = "street"
  if footprint:
    pieces = [p for p in s.segments(footprint[3]) if p.geom_type == "Polygon"]
    poly = min(pieces, key=lambda p: p.distance(axis_pt))
    if owner.startswith("r5656356"):
      # One relation describes the combined outline. Divide it between
      # the two surveyed carriageway centre lines, retaining OSM holes.
      p1, p2 = (
        np.array(
          intersections[key]["Hauptlauf"][
            next(
              i for i, row in enumerate(intersections[key]["Hauptlauf"]) if row[0] == hw
            )
          ][1].coords[0]
        )
        for key, hw in [("r5656356W", "w678030549"), ("r5656356E", "w24988317")]
      )
      mid = (p1 + p2) / 2
      along = p2 - p1
      along /= np.linalg.norm(along)
      if owner.endswith("W"):
        along = -along
      at = np.array([-along[1], along[0]])
      clip = Polygon(
        [
          mid - at * 180,
          mid + at * 180,
          mid + at * 180 + along * 180,
          mid - at * 180 + along * 180,
        ]
      )
      poly = poly.intersection(clip)
  else:
    width = t.get("width")
    width = (
      float(width)
      if width and width.replace(".", "").isdigit()
      else 1.2
      if role == "utility"
      else 3
      if role == "foot"
      else 4.5
    )
    poly = g.buffer(width / 2, cap_style="flat", join_style="round")
  # Clip very long viaducts to the observed water crossing and its approaches.
  bounds = (np.asarray(poly.exterior.coords) - center) @ course
  begin, end = max(-48.0, float(min(bounds))), min(48.0, float(max(bounds)))
  levels = {
    round(begin + 0.02, 4),
    round(end - 0.02, 4),
    0.0,
    *list(np.linspace(begin + 0.05, end - 0.05, max(3, round((end - begin) / 2.5)))),
  }
  openings = []
  for bn, bpts in intersections[owner].items():
    local_mid = s.union_all(
      [q[1] for q in bpts if rank(ways[q[0]]) == min(rank(ways[r[0]]) for r in bpts)]
    ).centroid
    if wsa:
      val = official["secondPassage"].get(name) if bn != branch else None
      width = val["widthM"] if val else wsa[-1]
      clear = val["clearanceM"] if val else wsa[6:9]
      # The WSA width is transverse to the channel. Account for skew in the bridge axis.
      skew = abs(
        float(course[0] * channel[1] - course[1] * channel[0])
      ) / np.linalg.norm(channel)
      mid_pos = float((np.asarray(local_mid.coords[0]) - center) @ course)
      openings.append([round(mid_pos, 3), round(width / max(0.5, skew), 3), *clear])
      levels.update(
        round(mid_pos + q * width / max(0.5, skew), 4) for q in (-0.5, 0, 0.5)
      )
  sections = []
  for lo in sorted(levels):
    across = center + course * lo
    gpart = poly.intersection(LineString([across - side * 135, across + side * 135]))
    ls = [
      q for q in s.segments(gpart) if q.geom_type == "LineString" and q.length > 0.05
    ]
    if not ls:
      continue
    v = max(ls, key=lambda p: p.length)
    ends = sorted(
      [(np.asarray(q) - across) @ side for q in (v.coords[0], v.coords[-1])]
    )
    sections.append([round(float(lo), 2), *arr(ends)])
  assert len(sections) > 1
  paths = []
  for id, v, opt, geom in ways.values():
    kind = opt.get("highway")
    rail = opt.get("railway")
    if not (
      kind in ("footway", "path", "cycleway", "platform")
      or rail in ("rail", "light_rail", "subway")
    ):
      continue
    if opt.get("access") in ("no", "private") or (role in ("former-rail", "utility")):
      continue
    for sub in s.segments(geom.intersection(poly)):
      if sub.geom_type == "LineString" and sub.length > 0.5:
        paths.append(
          [
            id,
            "track" if rail else "cycle" if kind == "cycleway" else "walk",
            [arr(q) for q in sub.coords],
          ]
        )
  src = {
    id: [
      v,
      {
        k: tags[k]
        for k in [
          "highway",
          "railway",
          "man_made",
          "bridge",
          "width",
          "name",
          "surface",
          "bridge:name",
          "access",
          "foot",
          "layer",
          "barrier",
          "handrail",
          "railway:abandoned",
          "indoor",
        ]
        if k in tags
      },
    ]
    for id, v, tags, geom in ways.values()
  }
  record = dict(
    id=owner,
    name=name,
    branch=branch,
    stationM=round(station, 2),
    center=arr(center),
    course=[round(float(q), 7) for q in course],
    sections=sections,
    openings=openings,
    role=role,
    form=form or "beam",
    material=material
    or ("steel" if role in ("utility", "rail", "former-rail") else "unspecified"),
    ways=src,
    deck=None if not footprint else [footprint[0], footprint[1]],
    wsaKm=wsa[1] if wsa else None,
    city=[v["id"] for v in city_rows],
    crossed=list(intersections[owner]),
    paths=paths,
    heritage=city["monuments"].get(owner),
  )
  if owner == "w659050176":
    # OSM marks two lamps on the bridge and four within 3.6 m of its ends.
    # Limit this model to the six explicitly named fixtures.
    from shapely.geometry import Point

    lamps = []
    for nid, version, tags, ll in s.load("lights"):
      if tags.get("highway") != "street_lamp" or "Admiralbrücke" not in tags.get(
        "ref", ""
      ):
        continue
      pos = s.xy([ll])[0]
      if poly.distance(Point(pos)) < 4:
        lamps.append([nid, version, tags["ref"], arr(pos)])
    if len(lamps) != 6:
      raise ValueError(("Admiralbrücke lamps", lamps))
    record["lamps"] = sorted(lamps)
  rows.append(record)
rows.sort(key=lambda r: r["stationM"])
assert set(r["wsaKm"] for r in rows if r["wsaKm"] is not None) == set(
  r[1] for r in official["rows"]
)
gates = []
for id, observed in other.items():
  _, v, t, g = lookup[id]
  if t.get("waterway") in ("lock_gate", "weir", "dam"):
    gates.append(
      [
        id,
        v,
        t.get("waterway"),
        [[round(x, 2), round(z, 2)] for x, z in g.coords],
        observed,
      ]
    )
s.dumpjson(
  s.GEO / "landwehr-crossing-survey-v378.json.gz",
  dict(
    schema=378,
    license="© OpenStreetMap contributors, ODbL 1.0",
    axisWays=[r[0] for r in s.lp],
    axisLengthM=round(s.merged.length, 2),
    branches=[[n, round(g.length, 2)] for n, g in s.branches],
    crossings=rows,
    lockWorks=gates,
    excluded=[
      [id, lookup[id][2].get("railway"), lookup[id][2].get("tunnel"), seen]
      for id, seen in other.items()
      if id not in {r[0] for r in gates}
    ],
  ),
)
print([(r["id"], r["name"], r["role"], r["city"]) for r in rows])
print("crossings", len(rows), "gates", len(gates))
