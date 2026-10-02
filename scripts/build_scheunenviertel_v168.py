"""Step 10: bounded Scheunenviertel source families, side streets and courts.

Candidates always start from the immutable v1.0.67 Git release. Publication and
owner-specific coarse-envelope subtraction are deliberately separate operations.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

import build_west_streets_v163 as streets
import geopandas as gpd
import numpy as np
import shapely
from build_concert_halls_v160 import normal_of, triangulate
from build_karl_marx_allee_v161 import (
  Detail,
  mesh_signature,
  native_detail,
  packed_detail,
)
from build_mitte_streets_v166 import reserved_owners
from build_oranien_corridors_v167 import (
  EXPLICIT_RESERVED,
  core_footprint,
  digest,
  footprint,
  ornament,
)
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  POSITION_ORIGIN_Y,
  ROOT,
  navigation_polygons,
  tags_for,
  world,
  write_json,
)
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

SOURCE = ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json"
AUDIT = ROOT / "geo_data/regierungsviertel/scheunenviertel-v168-audit.json"
KIND = "scheunenviertel-v168"
BASE_TAG = "v1.0.67"
MAX_VERTICES = 400_000
MAX_INDICES = 2_400_000
MAX_DECODED_BYTES = 12 * 1024 * 1024
ORIGINAL_BOUNDS = streets.read_bounds
# Finite authoring boundary, following the perimeter streets with room for their
# eastern/western frontages. It is not an administrative neighbourhood boundary.
QUARTER = Polygon(
  [
    (2020, -450),
    (2130, -740),
    (2015, -1185),
    (2240, -1180),
    (2460, -1110),
    (2770, -1020),
    (3060, -850),
    (2920, -650),
    (2720, -400),
    (2570, -250),
    (2260, -360),
  ]
)
NAMES = (
  "Rosenthaler Straße",
  "Torstraße",
  "Karl-Liebknecht-Straße",
  "Rosa-Luxemburg-Straße",
  "Alte Schönhauser Straße",
  "Neue Schönhauser Straße",
  "Weinmeisterstraße",
  "Münzstraße",
  "Mulackstraße",
  "Linienstraße",
  "Steinstraße",
  "Gipsstraße",
  "Sophienstraße",
  "Almstadtstraße",
  "Schendelgasse",
  "Hirtenstraße",
  "Kleine Alexanderstraße",
  "Weydingerstraße",
  "Bartelstraße",
  "Straßburger Straße",
  "Zolastraße",
  "Rochstraße",
)


def base_bytes(path: Path) -> bytes:
  """Read tagged evidence without touching current published packets."""
  return subprocess.check_output(
    ["git", "show", f"{BASE_TAG}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def scoped_bounds() -> tuple[Any, Any]:
  bounds, core = ORIGINAL_BOUNDS()
  return bounds.intersection(QUARTER), core


def previous_sources() -> list[dict]:
  return [
    json.loads(base_bytes(ROOT / f"geo_data/regierungsviertel/{name}.json"))
    for name in ("mitte-streets-v166", "oranien-corridors-v167")
  ]


def extract() -> dict[str, Any]:
  """Retain every selected family and track prior facade owners independently."""
  streets.read_bounds = scoped_bounds
  source = streets.extract_source(NAMES)
  reserved = reserved_owners() | EXPLICIT_RESERVED
  previous = previous_sources()
  old_core = {p["id"]: p for s in previous for p in s["corePrisms"]}
  old_buildings = {b["id"]: b for s in previous for b in s["buildings"]}
  source["buildings"] = [
    b
    for b in source["buildings"]
    if b["id"] not in reserved and QUARTER.covers(footprint(b))
  ]
  source["corePrisms"] = [
    p for p in source["corePrisms"] if p["id"] not in reserved | set(old_core)
  ]
  source["retainedDetailedBuildings"] = [
    b
    for b in old_buildings.values()
    if footprint(b).intersects(QUARTER) and b["id"] not in EXPLICIT_RESERVED
  ]
  source["retainedDetailedCorePrisms"] = [
    p
    for p in old_core.values()
    if core_footprint(p).intersects(QUARTER) and p["id"] not in reserved
  ]
  source["previousRoads"] = [
    r
    for s in previous
    for r in s["roads"]
    if shape(r["geometry"]).distance(QUARTER) < 60
  ]
  source["previousOrnamentCoreIds"] = [
    p["id"] for p in previous[1]["retainedDetailedCorePrisms"]
  ]
  source["previousOrnamentBuildingIds"] = [
    b["id"] for b in previous[1]["retainedDetailedBuildings"]
  ]
  source["excludedDetailedOwners"] = sorted(reserved)
  source["scope"] = mapping(QUARTER)
  source["baseRelease"] = BASE_TAG
  source["selection"] = (
    "Finite street-following authoring polygon from Hackescher Markt/Rosenthaler Straße to "
    "Torstraße, Rosa-Luxemburg-Platz and Karl-Liebknecht-Straße. Named roads are clipped to "
    "this polygon; complete source families within the 43m frontage zone remain whole. "
    "This is an explicit working boundary, not an official administrative definition. "
    "No release-bounds expansion. Existing dedicated buildings are excluded."
  )
  source["publication"] = (
    "Append only this new mesh kind to immutable v1.0.67 packets. Replace navigation only "
    "for listed new LoD2 parents, and centrally subtract only their exact old coarse mass. "
    "Every unrelated old mesh, road and navigation row remains byte-equivalent. Existing "
    "generic street windows remain; new side/court windows are emitted only on faces on "
    "which the old facade rule emitted none. No old Tacheles/synagogue facade is rebuilt."
  )
  source["references"] = [
    "https://www.berlin.de/en/attractions-and-sights/3560423-3104052-scheunenviertel.en.html",
    "https://www.visitberlin.de/en/hackesche-hofe",
    "https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Almstadtstrasse_35,_Mietshaus.jpg",
    "https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Almstadtstrasse_25,_Mietshaus.jpg",
  ]
  source["displayEstimates"] = (
    "Untyped facade bay/floor spacing, shallow surrounds/lintels and masonry colour are "
    "display estimates, not a window survey. Court walls are the existing source planes; "
    "no court is filled, no new doorway is cut, and no business name is inferred. "
    "Two inspected Commons photos guide restrained Almstadt street material/ornament "
    "variation only. Dimensions and roof/court geometry stay LoD2/OSM anchored."
  )
  # Semantic tags are retained separately from authored colour and window estimates.
  mapped = gpd.read_file(
    streets.RAW / "candidate.gpkg",
    layer="multipolygons",
    bbox=(13.400, 52.520, 13.417, 52.533),
  ).to_crs(25833)
  mapped = [(row, world(row.geometry)) for _, row in mapped.iterrows()]
  for b in source["buildings"]:
    f = footprint(b)
    options = [
      (g.intersection(f).area, row, g)
      for row, g in mapped
      if tags_for(row).get("building") and g.intersects(f)
    ]
    if options:
      area, row, g = max(options, key=lambda p: p[0])
      if area > 1:
        osm_way = row.get("osm_way_id")
        b["osm"] = {
          "id": f"way/{osm_way}"
          if isinstance(osm_way, str)
          else f"relation/{row['osm_id']}",
          "tags": tags_for(row),
          "geometry": mapping(g),
        }
  return source


def core_walls(record: dict) -> list[list]:
  """Exterior and courtyard planes, using opposite source-ring orientations."""
  p = shapely.orient_polygons(core_footprint(record), exterior_cw=True)
  lo, hi = record["y0_dm"] / 10, (record["y0_dm"] + record["h_dm"]) / 10
  return [
    [[(ax, lo, az), (bx, lo, bz), (bx, hi, bz), (ax, hi, az)]]
    for ring in [p.exterior, *p.interiors]
    for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:])
  ]


def court_front(
  rings: list, occupied: Any, roads: Any, ground: float, top: float
) -> Detail:
  """Only exposed non-street walls with a clear source-mapped exterior approach."""
  d = Detail()
  n = normal_of(rings[0])
  center = np.mean(np.array(rings[0]), axis=0)
  if abs(n[1]) > 0.05 or top - ground < 5:
    return d
  # Shared party walls and very narrow seams are deliberately left blank.
  samples = [Point(center[0] + n[0] * v, center[2] + n[2] * v) for v in (1, 3, 5)]
  if any(occupied.covers(p) for p in samples):
    return d
  if not QUARTER.covers(samples[0]):
    return d
  prior = Detail()
  streets.facade(prior, rings, roads, ground, top)
  if prior.triangles:
    return d
  # A synthetic target chooses the already-verified exterior direction only;
  # it supplies no geometry or semantic claim about a public street in the court.
  target = samples[-1]
  streets.facade(d, rings, target, ground, top)
  d.triangles = [
    (p, c, "court " + role)
    for p, c, role in d.triangles
    if not role.startswith("shopfront")
  ]
  return d


def face_additions(
  walls: list[list],
  roads: Any,
  previous_roads: Any,
  occupied: Any,
  ground: float,
  top: float,
  existing: bool,
  has_ornament: bool,
) -> tuple[Detail, Detail]:
  drawn, native = Detail(), Detail()
  for rings in walls:
    center = np.mean(np.array(rings[0]), axis=0)
    if not QUARTER.covers(Point(center[0], center[2])):
      continue
    old = Detail()
    if existing:
      streets.facade(old, rings, previous_roads, ground, top)
    new = Detail()
    if not old.triangles:
      streets.facade(new, rings, roads, ground, top)
      if not new.triangles:
        new = court_front(
          rings, occupied, previous_roads if existing else roads, ground, top
        )
      drawn.triangles.extend(new.triangles)
      native.triangles.extend(
        (p, c, role.removeprefix("court ")) for p, c, role in new.triangles
      )
    if not has_ornament:
      extra = Detail()
      ornament(extra, rings, roads, ground, top)
      drawn.triangles.extend(extra.triangles)
  return drawn, native


def merge_native_faces(detail: Detail) -> Detail:
  """Union coplanar equal-colour faces; preserve their exact visible coverage.

  This removes only internal seams in a single plane, never a voxel, opening or
  silhouette. Opposite normals remain separate. Different colours never merge.
  """
  groups: dict[tuple, list] = {}
  for points, color, _ in detail.triangles:
    p = np.asarray(points, dtype=float)
    n = np.cross(p[1] - p[0], p[2] - p[0])
    if np.linalg.norm(n) < 1e-10:
      continue
    axis = int(np.argmax(np.abs(n)))
    assert np.ptp(p[:, axis]) < 1e-8
    sign = 1 if n[axis] > 0 else -1
    axes = [v for v in range(3) if v != axis]
    key = (axis, sign, round(float(p[0, axis]), 9), tuple(color))
    groups.setdefault(key, []).append(Polygon(p[:, axes]))
  result = Detail()
  for (axis, sign, height, color), polygons in groups.items():
    joined = unary_union(polygons).simplify(0, preserve_topology=True)
    components = [joined] if joined.geom_type == "Polygon" else list(joined.geoms)
    axes = [v for v in range(3) if v != axis]
    for poly in components:
      if poly.geom_type != "Polygon" or poly.area < 1e-9:
        continue
      rings = []
      for ring in [poly.exterior, *poly.interiors]:
        points = []
        for u, v in list(ring.coords)[:-1]:
          q = [0.0, 0.0, 0.0]
          q[axis] = height
          q[axes[0]] = u
          q[axes[1]] = v
          points.append(q)
        rings.append(points)
      for t in triangulate(rings):
        n = np.cross(np.array(t[1]) - t[0], np.array(t[2]) - t[0])
        if n[axis] * sign < 0:
          t = [t[0], t[2], t[1]]
        result.polygon(t, color, "native merged coplanar surface")
  return result


def build_details(source: dict) -> tuple[dict, list, dict, dict]:
  """Produce new geometry without invoking any previously published generator."""
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  previous_roads = unary_union([shape(r["geometry"]) for r in source["previousRoads"]])
  all_core = json.loads(
    base_bytes(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  )["buildings"]
  outer = gpd.read_file(streets.RAW / "resolved-outlines.gpkg", layer="buildings")
  occupied = unary_union(
    [
      core_footprint(p)
      for p in all_core
      if core_footprint(p).intersects(QUARTER.buffer(10))
    ]
    + list(outer[outer.geometry.intersects(QUARTER.buffer(10))].geometry)
  )
  details = {"drawn": Detail(), "minecraft": Detail()}
  nav = []
  roles = Counter()
  for existing, key in ((False, "buildings"), (True, "retainedDetailedBuildings")):
    for b in source[key]:
      d, n = Detail(), Detail()
      if not existing:
        # Source sheets only; facade generation below also considers courts.
        original = streets.facade
        try:
          streets.facade = lambda *args: None
          d, rows = streets.outer_detail(b, roads)
        finally:
          streets.facade = original
        nav.extend(rows)
        n.triangles.extend(d.triangles)
      for part in b["parts"]:
        points = [p for s in part["surfaces"] for r in s["rings"] for p in r]
        walls = [s["rings"] for s in part["surfaces"] if s["kind"] == "WallSurface"]
        if not points:
          continue
        dd, nn = face_additions(
          walls,
          roads,
          previous_roads,
          occupied,
          3,
          max(p[1] for p in points),
          existing,
          b["id"] in source["previousOrnamentBuildingIds"],
        )
        d.triangles.extend(dd.triangles)
        n.triangles.extend(nn.triangles)
      details["drawn"].triangles.extend(d.triangles)
      details["minecraft"].triangles.extend(native_detail(n).triangles)
      roles.update(role for _, _, role in d.triangles)
  for existing, key in ((False, "corePrisms"), (True, "retainedDetailedCorePrisms")):
    for p in source[key]:
      d, n = face_additions(
        core_walls(p),
        roads,
        previous_roads,
        occupied,
        p["y0_dm"] / 10,
        (p["y0_dm"] + p["h_dm"]) / 10,
        existing,
        p["id"] in source["previousOrnamentCoreIds"],
      )
      details["drawn"].triangles.extend(d.triangles)
      details["minecraft"].triangles.extend(native_detail(n).triangles)
      roles.update(role for _, _, role in d.triangles)
  # Existing curb and pavement contributions occupy these zones. The new pass
  # works only on the complement, preserving old road junctions exactly.
  new_scope = QUARTER.difference(previous_roads.buffer(24.01))
  bounds, core = ORIGINAL_BOUNDS()
  streets.read_bounds = lambda: (
    bounds.intersection(new_scope),
    core.intersection(new_scope),
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      streets.RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  metrics = {}
  try:
    for mode in details:
      d, metrics[mode] = streets.street_detail(
        source, surfaces, outer.to_dict("records"), mode == "minecraft"
      )
      details[mode].triangles.extend(d.triangles)
  finally:
    streets.read_bounds = scoped_bounds
  unmerged = len(details["minecraft"].triangles)
  details["minecraft"] = merge_native_faces(details["minecraft"])
  metrics["nativeMerge"] = {
    "beforeTriangles": unmerged,
    "afterTriangles": len(details["minecraft"].triangles),
    "policy": "exact coplanar equal-colour union; no source/detail reduction",
  }
  return details, nav, dict(roles), metrics


def empty_packet(identity: str, tile: Any) -> dict:
  return {
    "schemaVersion": 1,
    "id": identity,
    "origin": [tile.bounds[0], POSITION_ORIGIN_Y, tile.bounds[1]],
    "meshes": [],
    "nav": {
      "ground": [],
      "water": [],
      "buildings": [],
      "roads": [],
      "bridges": [],
      "groundY": 3,
    },
  }


def packet_counts(payload: dict) -> tuple[int, int, int]:
  """Aggregate runtime limits apply across all meshes in a decoded packet."""
  vertices = sum(len(base64.b64decode(m["positions"])) // 6 for m in payload["meshes"])
  indices = sum(len(base64.b64decode(m["indices"])) // 4 for m in payload["meshes"])
  ink = len(base64.b64decode(payload.get("lines", {}).get("positions", ""))) // 6
  return vertices, indices, ink


def within_geometry_limits(payload: dict) -> bool:
  vertices, indices, ink = packet_counts(payload)
  return (
    vertices <= MAX_VERTICES
    and indices <= MAX_INDICES
    and ink <= MAX_VERTICES
    and len(payload["meshes"]) <= 16
  )


def save_packet(output: Path, identity: str, mode: str, payload: dict) -> dict:
  raw = (json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  assert len(raw) < MAX_DECODED_BYTES, (identity, mode, len(raw))
  assert within_geometry_limits(payload), (identity, mode, packet_counts(payload))
  packed = gzip.compress(raw, compresslevel=9, mtime=0)
  name = f"{identity}.{mode}.json.gz"
  (output / name).write_bytes(packed)
  return {
    "url": name,
    "encoding": "gzip",
    "bytes": len(packed),
    "decodedBytes": len(raw),
    "sha256": hashlib.sha256(packed).hexdigest(),
  }


def publish(output: Path, source: dict) -> dict:
  """Stage additive packets while proving preservation against the tagged release."""
  output.mkdir(parents=True, exist_ok=True)
  owners = {b["id"] for b in source["buildings"]}
  details, navigation, roles, metrics = build_details(source)
  print(
    {
      "parents": len(owners),
      "triangles": {m: len(d.triangles) for m, d in details.items()},
    },
    flush=True,
  )
  partitions = {m: streets.partition_detail(d) for m, d in details.items()}
  descriptors = {
    d["id"]: d
    for d in json.loads(base_bytes(DEFAULT_OUTPUT / "manifest.json"))["chunks"]
  }
  patches, audits, preservation = [], [], {}
  for ix, iz in sorted(set(partitions["drawn"]) | set(partitions["minecraft"])):
    identity = f"{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    entry = {"id": identity, "bounds": list(tile.bounds)}
    before = {}
    audit = {"id": identity, "modes": {}}
    companion_meshes = {}
    for mode in details:
      descriptor = descriptors.get(identity)
      path = DEFAULT_OUTPUT / descriptor[mode]["url"] if descriptor else None
      payload = (
        json.loads(gzip.decompress(base_bytes(path)))
        if path
        else {
          "schemaVersion": 1,
          "id": identity,
          "origin": [ix * 512, POSITION_ORIGIN_Y, iz * 512],
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "buildings": [],
            "roads": [],
            "bridges": [],
            "groundY": 3,
          },
        }
      )
      payload["meshes"] = [m for m in payload["meshes"] if m["kind"] != KIND]
      retained = mesh_signature(payload)
      before[mode] = {
        "baseSha256": hashlib.sha256(base_bytes(path)).hexdigest() if path else None,
        "meshes": digest(payload["meshes"]),
        "unownedNavigation": digest(
          {
            **payload["nav"],
            "buildings": [
              b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
            ],
          }
        ),
      }
      mesh = packed_detail(partitions[mode].get((ix, iz), Detail()), tile)
      if mesh:
        mesh["kind"] = KIND
        payload["meshes"].append(mesh)
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      for n in navigation:
        for p in navigation_polygons(
          n["geometry"].intersection(tile), *tile.bounds[:2]
        ):
          payload["nav"]["buildings"].append(
            {
              **p,
              **{k: v for k, v in n.items() if k != "geometry"},
              "height": math.ceil(n["height"] / 2) * 2 + 2
              if mode == "minecraft"
              else n["height"],
            }
          )
      assert not retained - mesh_signature(payload)
      assert before[mode]["unownedNavigation"] == digest(
        {
          **payload["nav"],
          "buildings": [
            b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
          ],
        }
      )
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      if len(raw) >= MAX_DECODED_BYTES or not within_geometry_limits(payload):
        assert mesh is not None
        companion_meshes[mode] = mesh
        payload["meshes"].remove(mesh)
        mesh = None
      entry[mode] = save_packet(output, identity, mode, payload)
      audit["modes"][mode] = {
        "retainedTriangles": sum(retained.values()),
        "addedTriangles": len(base64.b64decode(mesh["indices"])) // 12 if mesh else 0,
        "bytes": entry[mode]["bytes"],
        "decodedBytes": entry[mode]["decodedBytes"],
      }
    preservation[identity] = before
    patches.append(entry)
    audits.append(audit)
    print(identity, entry["drawn"]["bytes"], entry["minecraft"]["bytes"], flush=True)
    if companion_meshes:
      cid = identity + "-scheunen-v168"
      ce = {"id": cid, "bounds": list(tile.bounds), "detailCompanionOf": identity}
      ca = {"id": cid, "detailCompanionOf": identity, "modes": {}}
      cb = {}
      for mode in details:
        cp = empty_packet(cid, tile)
        cb[mode] = {
          "baseSha256": None,
          "meshes": digest([]),
          "unownedNavigation": digest(cp["nav"]),
        }
        mesh = companion_meshes.get(mode)
        if mesh:
          cp["meshes"].append(mesh)
        ce[mode] = save_packet(output, cid, mode, cp)
        ca["modes"][mode] = {
          "retainedTriangles": 0,
          "addedTriangles": len(base64.b64decode(mesh["indices"])) // 12 if mesh else 0,
          "bytes": ce[mode]["bytes"],
          "decodedBytes": ce[mode]["decodedBytes"],
        }
      preservation[cid] = cb
      patches.append(ce)
      audits.append(ca)
      print(cid, ce["drawn"]["bytes"], ce["minecraft"]["bytes"], flush=True)

  write_json(
    output / "scheunenviertel-manifest-patch.json",
    {
      "chunks": patches,
      "source": {
        "scheunenviertelV168": {
          "version": "1.0.68",
          "sourceIds": sorted(owners),
          "sourceEvidence": str(SOURCE.relative_to(ROOT)),
          "streets": list(NAMES),
          "policy": source["publication"],
        }
      },
    },
  )
  write_json(
    ROOT / "geo_data/regierungsviertel/scheunenviertel-v168-preservation.json",
    preservation,
  )
  result = {
    "baseRelease": BASE_TAG,
    "sourceParents": len(owners),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "corePrisms": len(source["corePrisms"]),
    "retainedDetailedParents": len(source["retainedDetailedBuildings"]),
    "retainedDetailedCorePrisms": len(source["retainedDetailedCorePrisms"]),
    "streetMetrics": metrics,
    "roles": dict(roles),
    "chunks": audits,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  }
  write_json(AUDIT, result)
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/v168-scheunen-packets"))
  parser.add_argument("--refresh-source", action="store_true")
  parser.add_argument("--source-only", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    write_json(SOURCE, extract())
  if not args.source_only:
    print(json.dumps(publish(args.out, json.loads(SOURCE.read_text()))))


if __name__ == "__main__":
  main()
