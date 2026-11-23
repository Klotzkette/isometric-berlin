"""Rank citywide retained colour-only envelopes and verify real exterior wall triangles.

The navigation rings can be clipped or repeated across 512 m packets. Their summed
prism volumes bound the exact union volume from above. Resolve the high end in
descending upper-bound order until no unexamined owner can enter the first fifty.
The renderer receives measured walls only; this generator does not invent openings.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely import STRtree, contains_xy, make_valid, union_all
from shapely.geometry import LineString, Polygon, box

from scripts.build_district_facades_v188 import source_wall_exists

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
CORE = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
WGS = Transformer.from_crs(25833, 4326, always_xy=True)
RECEIPTS = (
  "district-facades-v188-evidence",
  "kiez-facades-v209-evidence",
  "outer-facades-v230-evidence",
  "outer-facades-v262-evidence",
  "grey-facades-v263-evidence",
  "house-doors-v233-evidence",
  "roof-house-v233-source",
  "outer-roofs-v262-source",
  "cluster-facades-v320-evidence",
  "cluster-facades-v320-south-ordinary-evidence",
)
OUTPUT = GEO / "windowless-buildings-v377.json"


def area(ring):
  return (
    abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))) / 2
  )


@lru_cache(maxsize=1)
def tile_descriptors():
  return {
    d["id"]: d for d in json.loads((OUT / "manifest.json").read_bytes())["chunks"]
  }


def packet(tile, family):
  desc = tile_descriptors()[tile][family]
  compressed = (OUT / desc["url"]).read_bytes()
  if hashlib.sha256(compressed).hexdigest() != desc["sha256"]:
    raise ValueError(f"Unexpected {family} packet for {tile}")
  return json.loads(gzip.decompress(compressed))


def entity(b):
  return b.get("parentId") or b["sourceId"]


def census(manifest):
  upper, tiles = defaultdict(float), defaultdict(set)
  counts = dict(packets=0, navigationParts=0, corePrisms=0)
  for desc in manifest["chunks"]:
    data = packet(desc["id"], "drawn")
    counts["packets"] += 1
    for b in data["nav"]["buildings"]:
      counts["navigationParts"] += 1
      key = entity(b)
      surface = area(b["ring"]) - sum(map(area, b["holes"]))
      upper[key] += max(0, surface) * max(0, b["height"] - b["minHeight"])
      tiles[key].add(desc["id"])
  for b in json.loads(CORE.read_bytes())["buildings"]:
    counts["corePrisms"] += 1
    key = "CORE-" + b["id"]
    upper[key] += (area(b["ring"]) - sum(map(area, b["holes"]))) * b["h_dm"] / 1000
    tiles[key].add("core")
  counts["sourceIdentities"] = len(upper)
  return upper, tiles, counts


def source_references(candidate_ids, receipt_directory):
  """The historical fitting receipts identify windows whose packed mesh has no IDs."""
  import re

  matches = defaultdict(set)
  full = re.compile(rb"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)\b")
  aliases = {}
  for key in candidate_ids:
    aliases[key.encode()] = key

  def record(raw, name):
    for value in set(full.findall(raw)) & aliases.keys():
      matches[aliases[value]].add(name)

  code = ROOT / "src/app/src"
  for p in sorted(code.rglob("*")):
    if p.suffix not in {".ts", ".json"} or "377" in p.name or ".test." in p.name:
      continue
    # These packets change RGB only. They do not provide openings or fittings.
    if p.name.startswith("primaryColoursV273_") or p.name in {
      "greyClusterColoursV263.json",
      "buildingAttributeSource.json",
    }:
      continue
    record(p.read_bytes(), p.name)
  for receipt in RECEIPTS:
    name = receipt + ".json.gz"
    path = GEO / name if (GEO / name).exists() else receipt_directory / name
    record(gzip.decompress(path.read_bytes()), name)
  return matches


def world_polygon(b, origin):
  def world(r):
    return [(round(x + origin[0], 3), round(z + origin[2], 3)) for x, z in r]

  poly = Polygon(world(b["ring"]), [world(h) for h in b["holes"]])
  if poly.is_valid:
    return poly
  repaired = make_valid(poly)
  if repaired.geom_type in {"Polygon", "MultiPolygon"}:
    return repaired
  return union_all(
    [
      g
      for g in getattr(repaired, "geoms", [])
      if g.geom_type in {"Polygon", "MultiPolygon"}
    ]
  )


def heights(b, nav):
  ground = nav["groundY"] + b.get("groundOffset", 0)
  return ground + b["minHeight"], ground + b["height"]


@lru_cache(maxsize=16)
def bodies(tile, family):
  data = packet(tile, family)
  rows = [
    (b, world_polygon(b, data["origin"]), *heights(b, data["nav"]))
    for b in data["nav"]["buildings"]
  ]
  return rows, data["origin"]


def vertical_union(rows):
  levels = sorted({y for _, _, lo, hi in rows for y in (lo, hi)})
  footprint = union_all([p for _, p, _, _ in rows], grid_size=0.001)
  volume = 0.0
  for lo, hi in zip(levels, levels[1:]):
    layer = [p for _, p, b, t in rows if b < hi and t > lo]
    volume += (hi - lo) * union_all(layer, grid_size=0.001).area
  return footprint, volume, max(levels) - min(levels)


def encoded_mesh(part):
  pos = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
  idx = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  return pos, idx


@lru_cache(maxsize=16)
def walls(tile, family):
  data = packet(tile, family)
  tris = set()
  for part in data["meshes"]:
    if part["kind"] != "city":
      continue
    if part["positionType"] != "u16cm" or part.get("colorType"):
      raise ValueError(f"Unsupported primary walls in {tile} {family}")
    pos, idx = encoded_mesh(part)
    colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    # Renderer-neutral byte encoding of linear sRGB (211,208,195) generic walls.
    srgb = np.array([211, 208, 195]) / 255
    material = np.rint(((srgb + 0.055) / 1.055) ** 2.4 * 255)
    for verts in pos[idx[np.all(np.all(colors == material, axis=1)[idx], axis=1)]]:
      tris.add(tuple(sorted(tuple(map(int, v)) for v in verts)))
  return tris


@lru_cache(maxsize=32)
def existing_detail_centres(tile):
  """Find already supplied standing geometry, including unnamed packed companions."""
  data = packet(tile, "drawn")
  parts = []
  for part in data["meshes"]:
    if part["kind"] == "city":
      continue
    if part["positionType"] != "u16cm":
      raise ValueError(f"Unrecognised detail geometry in {tile}")
    pos, idx = encoded_mesh(part)
    triangles = pos[idx].astype(np.float64) * 0.01 + data["origin"]
    standing = np.ptp(triangles[:, :, 1], axis=1) > 0.12
    parts.append((part["kind"], triangles[standing].mean(axis=1)))
  return parts


def line_parts(geo):
  if geo.geom_type == "LineString":
    if geo.length:
      yield geo
  elif hasattr(geo, "geoms"):
    for part in geo.geoms:
      yield from line_parts(part)


class CandidateGeometry:
  def __init__(self, descs):
    self.descs = descs
    self.companions = defaultdict(list)
    for d in descs:
      if d.get("detailCompanionOf"):
        self.companions[d["detailCompanionOf"]].append(d["id"])
    self.boundaries = STRtree([box(*d["bounds"]) for d in descs])

  def require_distinct_body(self, owner, footprint, floor, roof):
    # Some editions use both an OSM and a cadastral identity. Check overlapping
    # envelopes across tile boundaries, including clipped source aliases. A
    # different documented building part inside a larger podium is legitimate.
    other = defaultdict(list)
    for i in self.boundaries.query(footprint.envelope):
      rows, _ = bodies(self.descs[int(i)]["id"], "drawn")
      for b, poly, low, high in rows:
        if entity(b) == owner or min(roof, high) <= max(floor, low):
          continue
        if poly.area and footprint.intersects(poly):
          other[entity(b)].append(poly)
    for name, parts in other.items():
      if sum(p.area for p in parts) < footprint.area * 0.8:
        continue
      other_shape = union_all(parts, grid_size=0.001)
      intersection = footprint.intersection(other_shape).area
      if intersection > 0.8 * max(footprint.area, other_shape.area):
        raise ValueError(f"Resolve overlapping building identities {owner} and {name}")

  def mapped_details(self, footprint, low, high):
    band = footprint.boundary.buffer(0.75)
    found = {}
    for i in self.boundaries.query(band.envelope):
      tile = self.descs[int(i)]["id"]
      for kind, centres in existing_detail_centres(tile):
        centres = centres[(centres[:, 1] > low + 1.1) & (centres[:, 1] < high + 0.25)]
        count = int(np.count_nonzero(contains_xy(band, centres[:, 0], centres[:, 2])))
        if count:
          found[tile + "/" + kind] = count
    return found

  def segments(self, owner, tile_ids, family, footprint):
    # Adjacent tiles can contain a party wall even when this host has no piece there.
    nearby = [
      self.descs[int(i)]["id"]
      for i in self.boundaries.query(footprint.buffer(4).envelope)
    ]
    occupants = []
    for tile in nearby:
      rows, _ = bodies(tile, family)
      occupants.extend(
        (p, hi) for b, p, _, hi in rows if entity(b) != owner and not p.is_empty
      )
    obstacles = STRtree([p for p, _ in occupants])
    output = {}
    for tile in sorted(tile_ids):
      # v201 split some oversized original city mesh streams without moving their
      # nav rows. Only same-origin companions with the actual two wall triangles
      # can draw a fitting. The additional compressed-packet hash travels with it.
      hosts = [(tile, walls(tile, family))]
      rows, (ox, oy, oz) = bodies(tile, family)
      for child in sorted(self.companions[tile]):
        faces = walls(child, family)
        if faces and tuple(packet(child, family)["origin"]) == (ox, oy, oz):
          hosts.append((child, faces))
      for b, poly, lo, hi in rows:
        if entity(b) != owner or hi - lo < 2:
          continue
        # Retain the original individual edges even when GEOS split a touching
        # ring while repairing its filled footprint for area and occupancy.
        for i, local in enumerate([b["ring"], *b["holes"]]):
          points = [(round(x + ox, 3), round(z + oz, 3)) for x, z in local]
          tot = sum(
            a[0] * c[1] - c[0] * a[1] for a, c in zip(points, points[1:] + points[:1])
          )
          if (tot > 0) != (i == 0):
            points.reverse()
          for a, c in zip(points, points[1:] + points[:1]):
            length = math.dist(a, c)
            if length < 1:
              continue
            local_a, local_c = [a[0] - ox, a[1] - oz], [c[0] - ox, c[1] - oz]
            physical = next(
              (
                host
                for host, faces in hosts
                if source_wall_exists(faces, local_a, local_c, lo - oy, hi - oy)
              ),
              None,
            )
            if physical is None:
              continue
            normal = [(c[1] - a[1]) / length, (a[0] - c[0]) / length]
            # Query a true outward line. Clip party walls exactly against occupied area.
            probe = LineString(
              [(p[0] + normal[0] * 0.15, p[1] + normal[1] * 0.15) for p in (a, c)]
            )
            hits = obstacles.query(probe, predicate="intersects")
            masks = [
              occupants[int(i)][0] for i in hits if occupants[int(i)][1] > lo + 1.2
            ]
            if footprint.intersects(probe):
              masks.append(footprint)
            visible = probe.difference(union_all(masks)) if masks else probe
            for piece in line_parts(visible):
              if piece.length < 1:
                continue
              start, end = [
                [round(q[0] - normal[0] * 0.15, 3), round(q[1] - normal[1] * 0.15, 3)]
                for q in (piece.coords[0], piece.coords[-1])
              ]
              k = (tuple(start), tuple(end), round(lo, 3), round(hi, 3))
              face = dict(
                tile=physical,
                family=family,
                owner=b["sourceId"],
                a=start,
                b=end,
                normal=[round(n, 7) for n in normal],
                low=k[2],
                high=k[3],
              )
              if physical != tile:
                face.update(
                  navTile=tile,
                  tileSha256=tile_descriptors()[physical][family]["sha256"],
                )
              output.setdefault(k, face)
    return sorted(output.values(), key=lambda f: (f["tile"], f["a"], f["b"], f["low"]))


def run(args):
  manifest = json.loads((OUT / "manifest.json").read_bytes())
  upper, tiles, counts = census(manifest)
  core = json.loads(args.core_audit.read_bytes())
  if core["sourceSha256"] != hashlib.sha256(CORE.read_bytes()).hexdigest():
    raise ValueError("Core facade census and city prisms differ")
  core_status = {r["id"]: r["status"] for r in core["rows"]}
  confirmed = {
    "facade-axes",
    "window-panes",
    "glass-mullions",
    "recognition-facade",
    "retired-prism",
  }
  # The first pass is cheap. Discover progressively larger bounds if necessary.
  order = sorted(upper, key=lambda k: (-upper[k], k))
  limit = min(200, len(order))
  while True:
    keys = order[:limit]
    refs = source_references(keys, args.receipts)
    accepted = []
    excluded = []
    verifier = CandidateGeometry(manifest["chunks"])
    for key in keys:
      reason = None
      if key.startswith("CORE-"):
        status = core_status.get(key)
        if status not in confirmed:
          raise ValueError(f"Unresolved city-core owner {key}")
        reason = "windowless-core-audit-v377.json:" + status
      elif all(tile.startswith("ber236-") for tile in tiles[key]):
        reason = "BER airport in Schoenefeld, outside Berlin"
      elif refs[key]:
        reason = sorted(refs[key])
      if reason:
        excluded.append(dict(id=key, upperM3=round(upper[key], 2), evidence=reason))
        continue
      ids = tiles[key]
      rows = [
        row
        for tile in sorted(ids)
        for row in bodies(tile, "drawn")[0]
        if entity(row[0]) == key
      ]
      shape, volume, height = vertical_union(rows)
      if (
        len(accepted) >= 50
        and volume
        < sorted(accepted, key=lambda t: -t["modeledVolumeM3"])[49]["modeledVolumeM3"]
      ):
        continue
      existing = verifier.mapped_details(
        shape, min(row[2] for row in rows), max(row[3] for row in rows)
      )
      if existing:
        excluded.append(dict(id=key, upperM3=round(upper[key], 2), evidence=existing))
        continue
      drawn = verifier.segments(key, ids, "drawn", shape)
      if not drawn:
        excluded.append(
          dict(id=key, upperM3=round(upper[key], 2), evidence="no-exposed-generic-wall")
        )
        continue
      verifier.require_distinct_body(
        key, shape, min(row[2] for row in rows), max(row[3] for row in rows)
      )
      native_rows = [
        row
        for tile in sorted(ids)
        for row in bodies(tile, "minecraft")[0]
        if entity(row[0]) == key
      ]
      native_shape = union_all([p for _, p, _, _ in native_rows], grid_size=0.001)
      native = verifier.segments(key, ids, "minecraft", native_shape)
      c = shape.representative_point()
      lon, lat = WGS.transform(389500 + c.x, 5820000 - c.y)
      accepted.append(
        dict(
          id=key,
          tiles=sorted(ids),
          center=[round(c.x, 3), round(c.y, 3)],
          lonLat=[round(lon, 7), round(lat, 7)],
          footprintM2=round(shape.area, 2),
          heightM=round(height, 3),
          modeledVolumeM3=round(volume, 2),
          footprintWkbSha256=hashlib.sha256(shape.normalize().wkb).hexdigest(),
          segments=drawn + native,
        )
      )
      print(key, round(volume), len(drawn), len(native), flush=True)
    accepted.sort(key=lambda t: (-t["modeledVolumeM3"], t["id"]))
    if len(accepted) >= 50 and (
      limit == len(order)
      or round(upper[order[limit]], 2) < accepted[49]["modeledVolumeM3"]
    ):
      break
    if limit == len(order):
      raise ValueError("Fewer than fifty confirmed colour-only buildings")
    limit = min(len(order), limit * 2)
  targets = accepted[:50]
  cutoff = targets[-1]["modeledVolumeM3"]
  resident = json.loads(args.resident_audit.read_bytes())
  if resident["floorM3"] > cutoff:
    raise ValueError(
      "Resident Alt-Mitte facade census does not reach the ranking threshold"
    )
  for file, digest in resident["sourceHashes"].items():
    if hashlib.sha256((ROOT / file).read_bytes()).hexdigest() != digest:
      raise ValueError(f"Resident facade census and {file} differ")
  counts.update(
    residentFamilies=resident["residentFamilies"], residentParts=resident["parts"]
  )
  selected_ids = {t["id"] for t in targets}
  for row in resident["rows"]:
    if row["volumeM3"] < cutoff:
      continue
    if not row["paneCentres"] or row["id"] in selected_ids:
      raise ValueError(f"Resolve existing window ownership for {row['id']}")
    excluded.append(
      dict(
        id=row["id"],
        upperM3=row["volumeM3"],
        evidence="windowless-resident-audit-v377.json",
        existingPaneCentres=row["paneCentres"],
      )
    )
  excluded.sort(key=lambda r: (-r["upperM3"], r["id"]))
  unresolved = [
    e["id"]
    for e in excluded
    if e["upperM3"] >= cutoff and e["evidence"] == "no-exposed-generic-wall"
  ]
  if unresolved:
    raise ValueError(
      f"Classify these large source owners before publication: {unresolved}"
    )
  if any(not any(s["family"] == "minecraft" for s in t["segments"]) for t in targets):
    raise ValueError("Selected building lacks a verified native wall")
  report = dict(
    schemaVersion=377,
    quantity="union of displayed above-ground prism layers in cubic metres",
    sources={
      "manifestSha256": hashlib.sha256(
        (OUT / "manifest.json").read_bytes()
      ).hexdigest(),
      "coreSha256": core["sourceSha256"],
      "residentAuditSha256": hashlib.sha256(
        args.resident_audit.read_bytes()
      ).hexdigest(),
      "coreAuditSha256": hashlib.sha256(args.core_audit.read_bytes()).hexdigest(),
    },
    counts=counts,
    cutoffM3=cutoff,
    excludedAboveCutoff=[e for e in excluded if e["upperM3"] >= cutoff],
    targets=targets,
  )
  raw = (json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  if args.check:
    assert args.output.read_bytes() == raw, "stale windowless-building ranking"
  else:
    args.output.write_bytes(raw)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--core-audit", type=Path, default=GEO / "windowless-core-audit-v377.json"
  )
  parser.add_argument(
    "--resident-audit", type=Path, default=GEO / "windowless-resident-audit-v377.json"
  )
  parser.add_argument("--receipts", type=Path, default=GEO)
  parser.add_argument("--output", type=Path, default=OUTPUT)
  parser.add_argument("--check", action="store_true")
  run(parser.parse_args())
