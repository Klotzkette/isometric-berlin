"""Bind public facility records to literal retained building walls in both modes.

The directory point establishes a location, not an entrance or surveyed sign.
Small category/name plates are explicit recognition estimates. No older wall,
window, roof, road, material or navigation record is changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from scripts import build_cluster_facades_v320 as common
from scripts import build_district_facades_v188 as base
from scripts import build_outer_facades_v230 as native

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/city-v350"
PUBLIC = common.PUBLIC
KIND = "civic-facilities-v350"
RECEIPT = GEO / "civic-facilities-v350-evidence.json.gz"
CATEGORIES = {"primary-school": 0, "kita": 1, "pharmacy": 2}
PLATE_HEIGHT_OVERRIDES = {
  # Full-scene visual review: keep the estimated recognition name above the
  # existing foreground strip. This is a display height, not a surveyed sign.
  "kita:04071240": ("DEBE04YY500001aC", 1.0),
}


def validate_address_cache(cache, source_files):
  for source in cache["source"]["inventories"]:
    if source_files.get(source["path"]) != source["sha256"]:
      raise ValueError(
        "Facility address cache does not match inventory: " + source["path"]
      )


def short_name(value):
  value = unicodedata.normalize("NFKD", value.replace("ß", "SS")).upper()
  value = "".join(
    c if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .+-" else " "
    for c in value
    if not unicodedata.combining(c)
  )
  return " ".join(value.split())[:26]


def supported_faces(packet, building, triangles, roads, road_tree, occupied, bounds):
  ox, oy, oz = packet["origin"]
  low = (
    packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["minHeight"]
  )
  high = packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["height"]
  if building["minHeight"] > 0.05 or high - low < 2.5:
    return []
  poly = translate(Polygon(building["ring"], building.get("holes", [])), ox, oz)
  result = []
  for a, b in zip(building["ring"], building["ring"][1:] + building["ring"][:1]):
    if not base.source_wall_exists(triangles, a, b, low - oy, high - oy):
      continue
    wa, wb = np.array(a) + [ox, oz], np.array(b) + [ox, oz]
    length = math.dist(wa, wb)
    if length < 3.2:
      continue
    direction = (wb - wa) / length
    normal = np.array([-direction[1], direction[0]])
    center = (wa + wb) / 2
    if poly.covers(Point(*(center + normal * 0.3))):
      normal = -normal
    ri = int(road_tree.nearest(Point(*center)))
    near = nearest_points(Point(*center), roads[ri])[1]
    toward = np.array([near.x, near.y]) - center
    distance = float(np.linalg.norm(toward))
    if distance < 0.5 or distance > 100 or np.dot(toward, normal) / distance < 0.55:
      continue
    if not box(*bounds).covers(
      LineString(
        [
          center - direction * 1.5 + normal * 0.08,
          center + direction * 1.5 + normal * 0.08,
        ]
      )
    ):
      continue
    # Prove a clear exterior strip. We do not infer a doorway or access route.
    strip = Polygon(
      [
        center - direction * 1.5 + normal * 0.15,
        center + direction * 1.5 + normal * 0.15,
        center + direction * 1.5 + normal * 0.8,
        center - direction * 1.5 + normal * 0.8,
      ]
    )
    if len(occupied.query(strip, predicate="intersects")):
      continue
    result.append(
      (
        distance,
        dict(
          owner=building["sourceId"],
          a=wa.tolist(),
          b=wb.tolist(),
          normal=normal.tolist(),
          low=low,
          high=high,
          road=ri,
        ),
      )
    )
  return sorted(
    result, key=lambda item: (item[0], -math.dist(item[1]["a"], item[1]["b"]))
  )


def plate_height_offset(facility_ids, owner):
  offsets = []
  for facility_id in facility_ids:
    if facility_id in PLATE_HEIGHT_OVERRIDES:
      expected_owner, offset = PLATE_HEIGHT_OVERRIDES[facility_id]
      if owner != expected_owner:
        raise ValueError("Facility height override no longer matches its owner")
      offsets.append(offset)
  return max(offsets, default=0.0)


def plate(face, origin, category, name, stack=0, height_offset=0.0):
  a, b = np.asarray(face["a"]), np.asarray(face["b"])
  direction = (b - a) / math.dist(a, b)
  center = (a + b) / 2
  width = min(2.8, math.dist(a, b) - 0.5)
  # Low-level wall plaque; it is not presented as an actual entrance sign.
  return [
    round((center[0] - origin[0]) * 100),
    round((face["low"] + 0.85 + stack * 0.42 + height_offset - origin[1]) * 100),
    round((center[1] - origin[2]) * 100),
    round(direction[0] * 1e6),
    round(direction[1] * 1e6),
    round(face["normal"][0] * 1e6),
    round(face["normal"][1] * 1e6),
    round(width * 100),
    CATEGORIES[category],
    short_name(name),
  ]


def build(inventories):
  RAW.mkdir(parents=True, exist_ok=True)
  records = []
  source_files = {}
  for path in inventories:
    rows = common.read(path)
    assert rows["schemaVersion"] == 1
    source_files[str(path.relative_to(ROOT))] = hashlib.sha256(
      path.read_bytes()
    ).hexdigest()
    records.extend(rows["records"])
  assert len({r["id"] for r in records}) == len(records)
  records.sort(key=lambda row: row["id"])
  outcomes = {}
  eligible = []
  for row in records:
    if row.get("directoryStatus") == "older-xlsx-only-current-status-unverified":
      outcomes[row["id"]] = dict(status="unverified-current-directory-entry")
      continue
    level = (row.get("evidence") or {}).get("level")
    if level is not None and str(level) not in {"0", "0.0", "", "ground"}:
      outcomes[row["id"]] = dict(
        status="non-ground-facility-floor-unverified", level=level
      )
      continue
    if row.get("category") not in CATEGORIES or not all(
      isinstance(row.get(k), (int, float)) and math.isfinite(row[k])
      for k in ("easting", "northing")
    ):
      outcomes[row["id"]] = dict(status="missing-verified-location")
      continue
    eligible.append(row)
  points = [Point(r["easting"] - 389500, 5820000 - r["northing"]) for r in eligible]
  point_tree = STRtree(points)
  eligible_ids = {r["id"]: i for i, r in enumerate(eligible)}
  address_path = GEO / "civic-facilities-v350-address-buildings.json.gz"
  address_cache = common.read(address_path) if address_path.exists() else None
  if address_cache:
    validate_address_cache(address_cache, source_files)
  address_rows = address_cache["features"] if address_cache else []
  address_shapes = [shape(r["geometry"]) for r in address_rows]
  address_tree = STRtree(address_shapes)
  if address_path.exists():
    source_files[str(address_path.relative_to(ROOT))] = hashlib.sha256(
      address_path.read_bytes()
    ).hexdigest()
  manifest = common.read(PUBLIC / "manifest.json")
  descriptors = [d for d in manifest["chunks"] if not d.get("detailCompanionOf")]
  roads_source = (
    ROOT / "geo_data/regierungsviertel/raw/city-v346/named-roads.geojson.gz"
  )
  road_rows = common.read(roads_source)["features"]
  roads = [shape(r["geometry"]) for r in road_rows]
  road_tree = STRtree(roads)
  # Existing colour/fitting receipts are not exclusion lists for an additive
  # label: the capture pass proves the wall remains and masks older fittings.
  candidates = defaultdict(list)
  packet_sources = {}
  all_owners = defaultdict(set)
  for desc in descriptors:
    nearby = list(
      map(int, point_tree.query(box(*desc["bounds"]), predicate="intersects"))
    )
    if not nearby and not len(
      address_tree.query(box(*desc["bounds"]), predicate="intersects")
    ):
      continue
    p = common.read(PUBLIC / desc["drawn"]["url"])
    ox, _, oz = p["origin"]
    matches = defaultdict(list)
    identity = {}
    for b in p["nav"]["buildings"]:
      poly = translate(Polygon(b["ring"], b.get("holes", [])), ox, oz)
      if not poly.is_valid or poly.is_empty or b.get("minHeight", 0) > 0.05:
        continue
      for ri in point_tree.query(poly, predicate="covers"):
        matches[int(ri)].append((b, poly))
        identity[(int(ri), b["sourceId"])] = (
          "directory-location-inside-retained-building"
        )
      for ai in address_tree.query(poly, predicate="intersects"):
        other = address_shapes[int(ai)]
        if not other.is_valid or other.area <= 0:
          continue
        overlap = poly.intersection(other).area
        if overlap / poly.area < 0.90 or overlap / other.area < 0.90:
          continue
        for fid in address_rows[int(ai)]["properties"]["facilityIds"]:
          ri = eligible_ids.get(fid)
          if ri is None:
            continue
          matches[ri].append((b, poly))
          identity[(ri, b["sourceId"])] = (
            "unique-full-address-building-with-90-percent-mutual-source-footprint-overlap"
          )
    if not matches:
      continue
    n = common.read(PUBLIC / desc["minecraft"]["url"])
    triangles = base.mesh_wall_triangles(p)
    ntri = base.mesh_wall_triangles(n)
    occupied = STRtree(
      [
        translate(Polygon(b["ring"], b.get("holes", [])), ox, oz)
        for b in p["nav"]["buildings"]
      ]
    )
    for ri, owners in matches.items():
      ids = {b["sourceId"] for b, _ in owners}
      all_owners[eligible[ri]["id"]].update(ids)
      if len(ids) != 1:
        outcomes[eligible[ri]["id"]] = dict(
          status="ambiguous-overlapping-building-parts", owners=sorted(ids)
        )
        continue
      b, poly = min(owners, key=lambda pair: pair[1].area)
      owner = b["sourceId"]
      faces = supported_faces(
        p, b, triangles, roads, road_tree, occupied, desc["bounds"]
      )
      selected = None
      for distance, face in faces:
        spans = native.native_faces(face, n, ntri, desc["bounds"])
        if spans:
          selected = (
            distance,
            face,
            max(spans, key=lambda f: math.dist(f["a"], f["b"])),
          )
          break
      if not selected:
        outcomes[eligible[ri]["id"]] = dict(
          status="no-matching-visible-wall-in-both-modes", owner=owner
        )
        continue
      distance, face, nface = selected
      road = road_rows[face.pop("road")]["properties"]
      nface.pop("road", None)
      candidates[eligible[ri]["id"]].append(
        dict(
          owner=owner,
          host=desc["id"],
          distance=distance,
          drawn=face,
          minecraft=nface,
          street=road,
          identity=identity[(ri, owner)],
        )
      )
      packet_sources[desc["id"]] = dict(
        descriptor=desc,
        origin=p["origin"],
        nativeOrigin=n["origin"],
        records={
          mode: [
            dict(mesh=i, kind=part["kind"], fingerprint=common.part_fingerprint(part))
            for i, part in enumerate(packet["meshes"])
          ]
          for mode, packet in [("drawn", p), ("minecraft", n)]
        },
      )
    print("scan", desc["id"], len(matches), "facility locations", flush=True)
  by_host = defaultdict(list)
  for row in eligible:
    options = candidates.get(row["id"], [])
    ids = all_owners[row["id"]]
    if len(ids) > 1:
      outcomes[row["id"]] = dict(
        status="ambiguous-independent-hosts", owners=sorted(ids)
      )
      continue
    if options:
      selected = min(options, key=lambda r: (r["distance"], r["host"]))
      by_host[selected["host"]].append((row, selected))
      outcomes[row["id"]] = dict(
        status="source-wall-recognition",
        owner=selected["owner"],
        host=selected["host"],
        identity=selected["identity"],
      )
    elif row["id"] not in outcomes:
      outcomes[row["id"]] = dict(status="point-outside-retained-building-footprints")
  plans = {}
  reports = []
  for host, entries in sorted(by_host.items()):
    packet = packet_sources[host]
    grouped = defaultdict(list)
    for row, selected in entries:
      grouped[(selected["owner"], row["category"])].append((row, selected))
    per_owner = defaultdict(int)
    plates = {"drawn": [], "minecraft": []}
    for (owner, category), group in sorted(grouped.items()):
      row, selected = group[0]
      name = row["name"] + (f" +{len(group) - 1}" if len(group) > 1 else "")
      stack = per_owner[owner]
      per_owner[owner] += 1
      height_offset = plate_height_offset([r["id"] for r, _ in group], owner)
      for mode in plates:
        plates[mode].append(
          plate(
            selected[mode],
            packet["nativeOrigin" if mode == "minecraft" else "origin"],
            category,
            name,
            stack,
            height_offset,
          )
        )
      reports.append(
        dict(
          host=host,
          owner=owner,
          category=category,
          facilityIds=[r["id"] for r, _ in group],
          names=[r["name"] for r, _ in group],
          drawnFace=selected["drawn"],
          nativeFace=selected["minecraft"],
          street=selected["street"],
          locationEvidence=selected["identity"],
          signGeometry="estimated-small-recognition-plate-not-surveyed-entrance-or-shopfront",
        )
      )
      if height_offset:
        reports[-1]["displayHeightOffsetMetres"] = height_offset
    assert max(map(len, plates.values())) <= 64, (host, "plate allowance")
    for mode in plates:
      plans[mode + ":" + host] = dict(
        origin=packet["nativeOrigin" if mode == "minecraft" else "origin"],
        records=packet["records"][mode],
        navGuard=0,
        lineGuard=None,
        retire=[],
        owners=sorted({selected["owner"] for _, selected in entries}),
        plates=plates[mode],
        facilityIds=[r["id"] for r, _ in entries],
      )
  recipe = dict(schemaVersion=1, keys=sorted(plans), packets=plans)
  receipt = dict(
    schemaVersion=1,
    kind=KIND,
    sourceFiles=source_files,
    counts=dict(
      inventory=len(records),
      categories=dict(Counter(r["category"] for r in records)),
      statuses=dict(Counter(o["status"] for o in outcomes.values())),
      physicalPlates=len(reports),
      hosts=len(by_host),
      maxPlatesPerHost=max((len(p["plates"]) for p in plans.values()), default=0),
    ),
    outcomes=outcomes,
    sourceOwners=reports,
    pendingBunPrimaryGuards=sorted(plans),
    policy=__doc__,
  )
  common.write(RAW / "civic-facilities-compact.json", recipe)
  common.write(RECEIPT, receipt)
  print(json.dumps(receipt["counts"]), flush=True)


def publish():
  source = common.read(RAW / "civic-facilities-compact.json")
  receipt = common.read(RECEIPT)
  assert not receipt["pendingBunPrimaryGuards"]
  hosts = sorted({key.split(":", 1)[1] for key in source["keys"]})
  modules = []
  for start in range(0, len(hosts), 16):
    keys = sorted(
      mode + ":" + host
      for host in hosts[start : start + 16]
      for mode in ("drawn", "minecraft")
    )
    file = f"civicFacilitiesV350Packets{len(modules):02d}.json"
    common.write(
      DATA / file,
      dict(
        schemaVersion=1,
        keys=keys,
        packets={key: source["packets"][key] for key in keys},
      ),
    )
    modules.append(dict(file=file, keys=keys))
  common.write(DATA / "civicFacilitiesV350Index.json", dict(sources=modules))
  receipt["runtimeSources"] = {
    m["file"]: hashlib.sha256((DATA / m["file"]).read_bytes()).hexdigest()
    for m in modules
  }
  categories = {
    fid: row["category"]
    for row in receipt["sourceOwners"]
    for fid in row["facilityIds"]
  }
  receipt["counts"]["admittedByCategory"] = dict(
    Counter(
      categories[fid]
      for fid, outcome in receipt["outcomes"].items()
      if outcome["status"] == "source-wall-recognition"
    )
  )
  common.write(RECEIPT, receipt)
  print(
    "published",
    len(modules),
    "compact modules",
    sum((DATA / m["file"]).stat().st_size for m in modules),
    "bytes",
    flush=True,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--publish", action="store_true")
  parser.add_argument("--inventory", type=Path, action="append")
  args = parser.parse_args()
  if args.publish:
    publish()
  else:
    build(
      args.inventory
      or [
        GEO / "education-v350-inventory.json.gz",
        GEO / "pharmacies-v350-inventory.json.gz",
      ]
    )
