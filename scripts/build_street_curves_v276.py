"""Exact, bounded round-buffer facets of retained road courses; no moved OSM nodes."""

from __future__ import annotations

import argparse
import base64
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  road_width_m,
  road_width_source,
)
from scripts import build_city_streets_v249 as city
from scripts.build_surrounding_outlines import (
  COLORS,
  PackedMesh,
  linear_rgb_bytes,
  native_polygon,
  navigation_polygons,
)

ROOT, GEO, DATA, OUT = city.ROOT, city.GEO, city.DATA, city.OUT
SOURCE = GEO / "street-curves-v276-source.json.gz"
EVIDENCE = GEO / "street-curves-v276-evidence.json.gz"
OUTPUT = DATA / "streetCurvesV276.json"
KIND = "street-curves-v276"
MIN_SAGITTA = 0.20
MAX_ARCS = 96


def fingerprint(parts):
  value = 2166136261
  for text in parts:
    for c in text:
      value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def navigation_guard(nav):
  text = str(math.floor(nav["groundY"] * 1_000_000 + 0.5)) + ";"
  for name in ("ground", "water", "roads", "bridges", "buildings"):
    text += name + ":"
    for p in nav.get(name, []):
      if name == "buildings":
        text += p["sourceId"] + ";"
        text += (
          ",".join(
            str(math.floor(p.get(k, 0) * 1_000_000 + 0.5))
            for k in ("minHeight", "height", "groundOffset")
          )
          + ";"
        )
      for ring in [p["ring"], *p["holes"]]:
        text += (
          "["
          + "".join(
            ",".join(str(math.floor(v * 1_000_000 + 0.5)) for v in pt) + ";"
            for pt in ring
          )
          + "]"
        )
  return fingerprint([text])


def extract(cached_candidates: Path | None = None):
  """Retain complete mapped ways and exact original segment witnesses.

  An optional cache is only a prior full scan accelerator: every selected
  segment is independently revalidated against its original packet and way.
  """
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  records = []
  for row in (
    pyogrio.read_dataframe(raw, layer="lines", where="highway IS NOT NULL")
    .to_crs(25833)
    .to_dict("records")
  ):
    tags = city.curbs.tags(row)
    if tags.get("highway") not in VEHICULAR_HIGHWAYS or any(
      tags.get(k, "no") not in ("no", "false", "0") for k in ("tunnel", "bridge")
    ):
      continue
    try:
      if float(tags.get("layer", 0)) != 0:
        continue
    except ValueError:
      continue
    radius = road_width_m(tags) / 2
    g = city.curbs.world(row["geometry"])
    if radius >= 2.5 and g.geom_type == "LineString":
      records.append(
        dict(
          id=str(row["osm_id"]),
          name=tags.get("name", ""),
          tags=tags,
          g=g,
          radius=radius,
        )
      )
  manifest = city.read(OUT / "manifest.json")
  descriptors = {
    e["id"]: e for e in manifest["chunks"] if not e.get("detailCompanionOf")
  }
  candidates = []
  if cached_candidates:
    cached = city.read(cached_candidates)
    assert cached["scannedRoads"] == len(records)
    candidates = [
      {"id": p["id"], "rows": [r for r in p["rows"] if r["sagitta"] >= MIN_SAGITTA]}
      for p in cached["packets"]
    ]
  else:
    tree = shapely.STRtree([r["g"] for r in records])
    for entry in descriptors.values():
      edges = {}
      for ri in tree.query(box(*entry["bounds"]).buffer(12)):
        r = records[int(ri)]
        rad, g = r["radius"], r["g"]
        pts = [Point(p) for p in g.coords]
        ptree = shapely.STRtree(pts)
        poly = g.buffer(rad, cap_style=1, join_style=1, quad_segs=3)
        for ring in [poly.exterior, *poly.interiors]:
          for a, b in zip(ring.coords, list(ring.coords)[1:]):
            length = math.dist(a, b)
            if length < 0.5 or length > rad * 0.53:
              continue
            sag = rad - math.sqrt(max(0, rad * rad - length * length / 4))
            if round(sag, 4) < MIN_SAGITTA:
              continue
            for pi in ptree.query(
              Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).buffer(rad + 0.001)
            ):
              centre = pts[int(pi)].coords[0]
              if max(abs(math.dist(centre, q) - rad) for q in (a, b)) <= 0.0001:
                key = tuple(sorted(tuple(round(v, 2) for v in q) for q in (a, b)))
                edges[key] = dict(
                  source=r["id"],
                  name=r["name"],
                  centre=centre,
                  radius=rad,
                  sagitta=round(sag, 4),
                )
      if not edges:
        continue
      packet = city.read(OUT / entry["drawn"]["url"])
      if packet["nav"]["groundY"] != 3 or not packet.get("lines", {}).get("colors"):
        continue
      positions = (
        np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
          -1, 2, 3
        )
        / 100
        + packet["origin"]
      )
      colours = np.frombuffer(
        base64.b64decode(packet["lines"]["colors"]), "u1"
      ).reshape(-1, 2, 3)
      kerb = linear_rgb_bytes(np.array([COLORS["kerb"]]))[0]
      rows = []
      for index, (pair, cs) in enumerate(zip(positions, colours)):
        if not np.all(cs == kerb) or not np.allclose(pair[:, 1], 3.13, atol=0.001):
          continue
        a, b = [tuple(round(float(v), 2) for v in p[[0, 2]]) for p in pair]
        found = edges.get(tuple(sorted((a, b))))
        if found:
          rows.append(dict(index=index, a=a, b=b, **found))
      if rows:
        candidates.append(dict(id=entry["id"], rows=rows))
  ways = {r["id"]: r for r in records}
  selected_ids = {r["source"] for p in candidates for r in p["rows"]}
  # Full ways, all source nodes, tags and inherited width provenance survive.
  features = [
    dict(
      key=k,
      tags=ways[k]["tags"],
      geometry=mapping(ways[k]["g"]),
      radius=ways[k]["radius"],
      widthSource=road_width_source(ways[k]["tags"]),
    )
    for k in sorted(selected_ids)
  ]
  for p in candidates:
    for r in p["rows"]:
      g = ways[r["source"]]["g"]
      assert any(math.dist(r["centre"], c) < 1e-8 for c in g.coords)
      assert r["radius"] == ways[r["source"]]["radius"]
      boundary = g.buffer(r["radius"], cap_style=1, join_style=1, quad_segs=3).boundary
      assert (
        boundary.distance(Point(r["a"])) <= 0.0072
        and boundary.distance(Point(r["b"])) <= 0.0072
      )
      assert (
        LineString([r["a"], r["b"]]).difference(boundary.buffer(0.0072)).length < 1e-8
      )
  candidates = [p for p in candidates if p["rows"]]
  city.write(
    SOURCE,
    dict(
      schemaVersion=1,
      source="Retained Geofabrik Berlin OSM 2026-09-29; ODbL-1.0",
      rawSha256=city.curbs.base.digest(raw),
      manifestSha256=city.curbs.base.digest(OUT / "manifest.json"),
      scannedRoads=len(records),
      scannedPrimaryPackets=len(descriptors),
      candidates=candidates,
      features=features,
      minimumSagittaM=MIN_SAGITTA,
    ),
  )


def arc_points(row):
  a, b, c, r = row["a"], row["b"], row["centre"], row["radius"]
  first = math.atan2(a[1] - c[1], a[0] - c[0])
  last = math.atan2(b[1] - c[1], b[0] - c[0])
  delta = (last - first + math.pi) % (2 * math.pi) - math.pi
  assert 0 < abs(delta) < 0.54
  count = max(2, math.ceil(abs(delta) / (math.pi / 48)))
  # Source endpoints are byte-exact; only interior samples follow the circle.
  return [
    list(a),
    *[
      [
        round(c[0] + r * math.cos(first + delta * i / count), 2),
        round(c[1] + r * math.sin(first + delta * i / count), 2),
      ]
      for i in range(1, count)
    ],
    list(b),
  ]


def protected_sources():
  paint, kerbs, _, paths = city.earlier()
  geometries = [paint, kerbs]
  for filename in (
    "city-streets-v249-evidence.json.gz",
    "main-streets-v254-evidence.json.gz",
  ):
    path = GEO / filename
    paths.append(path)
    for entry in city.read(path)["emitted"]:
      if not entry["packet"].startswith("drawn:"):
        continue
      for r in entry.get("records", [entry]):
        geometries.append(shape(r["geometry"]).buffer(0.12))
  path = DATA / "weinbergTerrainV176.json"
  paths.append(path)
  geometries.append(box(*city.read(path)["support"]))
  for filename in (
    "kreuzberg-streets-v267-evidence.json.gz",
    "koepenicker-streets-v268-evidence.json.gz",
  ):
    path = GEO / filename
    paths.append(path)
    for item in city.read(path).get("equipment", []):
      geometries.append(Point(item["point"]).buffer(2))
  return unary_union(geometries), paths


def actual_support(packet):
  bare, road, forbidden = [], [], []
  ground_rgb, road_rgb = linear_rgb_bytes(np.array([COLORS["ground"], COLORS["road"]]))
  for m in packet["meshes"]:
    p = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ids = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    rgb = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
    for tri in ids:
      v = p[tri]
      poly = Polygon(v[:, [0, 2]])
      if poly.area <= 1e-8 or np.ptp(v[:, 1]) > 0.001:
        continue
      y = v[0, 1]
      if m["kind"] == "city" and abs(y - 3) < 0.001 and np.all(rgb[tri] == ground_rgb):
        bare.append(poly)
      elif (
        m["kind"] == "city" and abs(y - 3.09) < 0.001 and np.all(rgb[tri] == road_rgb)
      ):
        road.append(poly)
      elif y <= 3.5:
        forbidden.append(poly)
  ox, _, oz = packet["origin"]
  for key in ("buildings", "water", "bridges"):
    forbidden.extend(
      shapely.make_valid(translate(Polygon(p["ring"], p["holes"]), ox, oz)).buffer(0.05)
      for p in packet["nav"].get(key, [])
    )
  return unary_union(bare), unary_union(road), unary_union(forbidden)


def build():
  source = city.read(SOURCE)
  descriptors = {e["id"]: e for e in city.read(OUT / "manifest.json")["chunks"]}
  protected, paths = protected_sources()
  shapely.prepare(protected)
  districts = city.read(city.curbs.SCOPE)["features"]
  district_geometries = [city.curbs.world(shape(f["geometry"])) for f in districts]
  district_tree = shapely.STRtree(district_geometries)
  plans, emitted, assets = {}, [], {}
  counts = Counter()
  by_district = Counter()
  for entry in source["candidates"]:
    tile = entry["id"]
    desc = descriptors[tile]
    path = OUT / desc["drawn"]["url"]
    packet = city.read(path)
    bare, road, forbidden = actual_support(packet)
    boundaries = box(*desc["bounds"]).buffer(-0.05)
    original = (
      np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      / 100
      + packet["origin"]
    )
    mesh = PackedMesh(packet["origin"][0], packet["origin"][2])
    rows, nav, segments = [], [], []
    for r in entry["rows"]:
      counts["candidates"] += 1
      pair = original[r["index"]]
      assert np.allclose(pair[:, 1], 3.13, atol=1e-8)
      assert all(
        math.dist(pair[i, [0, 2]], r[k]) < 1e-8 for i, k in enumerate(("a", "b"))
      )
      points = arc_points(r)
      crescent = Polygon(points)
      if not crescent.is_valid or crescent.area < 0.01:
        counts["invalidQuantizedArc"] += 1
        continue
      if not boundaries.covers(crescent):
        counts["packetBoundary"] += 1
        continue
      if protected.intersects(crescent.buffer(0.02)) or forbidden.intersects(
        crescent.buffer(0.02)
      ):
        counts["protectedNeighbour"] += 1
        continue
      # The only newly covered area is already bare mapped ground. The .012 m
      # tolerance admits the source's existing centimetre triangle quantisation.
      if (
        not bare.buffer(0.012).covers(crescent)
        or road.intersection(crescent).area > 0.02
      ):
        counts["notBareNeighbour"] += 1
        continue
      chord = LineString([r["a"], r["b"]])
      if chord.difference(road.buffer(0.012)).length > 0.001:
        counts["missingRoadEdge"] += 1
        continue
      if not native_polygon(crescent).is_empty:
        counts["nativeCellTransition"] += 1
        continue
      if len(rows) >= MAX_ARCS:
        raise ValueError(f"Finite arc bound exceeded {tile}")
      mesh.surface(crescent, 3.09, COLORS["road"])
      nav.extend(
        navigation_polygons(crescent, packet["origin"][0], packet["origin"][2])
      )
      segments.extend((a, b) for a, b in zip(points, points[1:]))
      matches = district_tree.query(
        crescent.representative_point(), predicate="intersects"
      )
      district = [districts[int(i)]["properties"]["sch"] for i in matches]
      for d in district:
        by_district[d[:8]] += 1
      rows.append(
        dict(**r, points=points, areaM2=round(crescent.area, 6), districts=district)
      )
    if not rows:
      continue
    pos = np.array(
      [
        [
          round((p[0] - packet["origin"][0]) * 100),
          1313,
          round((p[1] - packet["origin"][2]) * 100),
        ]
        for pair in segments
        for p in pair
      ],
      dtype="<u2",
    )
    colour = linear_rgb_bytes(np.array([COLORS["kerb"]] * len(pos)))
    part = mesh.payload(KIND)
    plan = dict(
      origin=packet["origin"],
      guard=navigation_guard(packet["nav"]),
      records=[
        dict(
          mesh=i,
          kind=m["kind"],
          fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
        )
        for i, m in enumerate(packet["meshes"])
      ],
      lineFingerprint=fingerprint(
        [packet["lines"]["positions"], packet["lines"]["colors"]]
      ),
      segments=[r["index"] for r in rows],
      mesh=part,
      lines=dict(
        positions=base64.b64encode(pos.tobytes()).decode(),
        colors=base64.b64encode(colour.tobytes()).decode(),
      ),
      roads=nav,
    )
    plans[tile] = plan
    assets[tile] = {
      mode: dict(
        url=desc[mode]["url"], sha256=city.curbs.base.digest(OUT / desc[mode]["url"])
      )
      for mode in ("drawn", "minecraft")
    }
    emitted.append(dict(id=tile, rows=rows))
    counts["arcs"] += len(rows)
    counts["lineVertices"] += len(pos)
    counts["meshBytes"] += sum(
      len(base64.b64decode(part[k])) for k in ("positions", "colors", "indices")
    )
    counts["lineBytes"] += pos.nbytes + colour.nbytes
    counts["packets"] += 1
    print(tile, len(rows), flush=True)
  city.write(OUTPUT, dict(schemaVersion=1, keys=sorted(plans), chunks=plans))
  evidence = dict(
    schemaVersion=1,
    sourceSha256=city.curbs.base.digest(SOURCE),
    outputSha256=city.curbs.base.digest(OUTPUT),
    inputs={
      str(p.relative_to(ROOT)): city.curbs.base.digest(p)
      for p in paths + [city.curbs.SCOPE]
    },
    manifestSha256=source["manifestSha256"],
    assets=assets,
    counts=dict(counts),
    districts=dict(sorted(by_district.items())),
    emitted=emitted,
    policy="Only exact old round-buffer chords with >=20cm sagitta. Original nodes, widths, endpoints, old faces, encoded packets and native occupancy unchanged. New crescent uses actual bare mapped ground; paths/rails/water/buildings/previous curb and paint courses protected. Navigation uses the exact centimetre-rendered crescent boundary. All heights remain the existing unsurveyed display datum.",
  )
  city.write(EVIDENCE, evidence)
  return dict(
    counts=counts,
    districts=by_district,
    sourceBytes=SOURCE.stat().st_size,
    runtimeBytes=OUTPUT.stat().st_size,
    evidenceBytes=EVIDENCE.stat().st_size,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--candidate-cache", type=Path)
  args = parser.parse_args()
  if args.extract:
    extract(args.candidate_cache)
  print(build())
