"""Step 10: bounded measured roofs from four already retained outer-city tiles.

Only the named local archives and existing overlapping packet descriptors are
read. Previous public packets and all v233 recipes remain byte-for-byte intact.
"""

from __future__ import annotations

import argparse
import math
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import shapely
from shapely.affinity import translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_roof_house_v233 as base

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "outer-roofs-v262-source.json.gz"
EVIDENCE = GEO / "outer-roofs-v262-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/outerRoofsV262.json"
SITES = {
  "Spandau": (
    "raw/lod2/LoD2_378_5822.zip",
    ("outer187--22_-5",),
  ),
  "Pankow": (
    "raw/east-city-v200/lod2/LoD2_391_5825.zip",
    ("north190-3_-10", "north190-4_-10"),
  ),
  "Niederschönhausen": (
    "raw/east-city-v200/lod2/LoD2_391_5827.zip",
    ("east200-4_-15",),
  ),
  "Adlershof": (
    "raw/east-city-v200/lod2/LoD2_401_5810.zip",
    ("east200-23_17", "east200-23_18"),
  ),
}
POLICY = (
  "At most eight previously unrefined residential owners per named local archive. "
  "Complete measured LoD2 walls, roof planes and holes replace only the exactly "
  "reconstructed drawn/native owner, atomically in its existing packet. "
  "Earlier public packets and v233 recipes remain unchanged. No new descriptor, "
  "coverage, guessed roof, mobile reduction or live residency allowance. "
  "Neutral material hues and small gutters are display estimates."
)


def previous_receipts() -> dict[str, str]:
  """Freeze the original roof sources and recipes without copying their payloads."""
  return {
    str(p.relative_to(ROOT)): base.digest(p)
    for p in (base.SOURCE, base.EVIDENCE, base.RUNTIME)
  }


def candidate_owners() -> tuple[dict, dict, dict]:
  """Inspect only six declared packets and their bounded overlapping families."""
  descriptors = {d["id"]: d for d in base.read_json(OUT / "manifest.json")["chunks"]}
  targets = {tid for _, ids in SITES.values() for tid in ids}
  selected_boxes = [box(*descriptors[tid]["bounds"]) for tid in targets]
  packets, occurrences = {}, defaultdict(set)
  for tid, d in descriptors.items():
    if d.get("detailCompanionOf") or not d.get("buildingCount"):
      continue
    if not any(b.intersects(box(*d["bounds"])) for b in selected_boxes):
      continue
    packet = base.read_json(OUT / d["drawn"]["url"])
    if tid in targets:
      packets[tid] = packet
    for row in packet["nav"]["buildings"]:
      occurrences[row["sourceId"]].add(tid)
  blocked = base.protected_ids()
  blocked.update(row["owner"] for row in base.read_json(base.SOURCE)["owners"])
  context = base.read_json(GEO / "outer-facades-v230-context.json.gz")
  protected = STRtree([shape(p) for p in context["protected"]])
  roads = [shape(row["geometry"]) for row in context["roads"]]
  road_tree = STRtree(roads)
  result = {}
  for region, (archive, ids) in SITES.items():
    rows = []
    for tid in ids:
      packet = packets[tid]
      ox, _, oz = packet["origin"]
      for row in packet["nav"]["buildings"]:
        owner = row["sourceId"]
        if not owner.startswith("DEBE") or owner in blocked:
          continue
        polygon = translate(Polygon(row["ring"], row["holes"]), ox, oz)
        if (
          not polygon.is_valid
          or not 65 < polygon.area < 1800
          or not box(*descriptors[tid]["bounds"]).buffer(-2.1).covers(polygon)
          or not 5 < row["height"] < 35
          or row["minHeight"]
          or len(occurrences[owner]) != 1
          or protected.query(polygon.buffer(-0.12), predicate="intersects").size
        ):
          continue
        x, z = polygon.centroid.coords[0]
        expected = (
          f"LoD2_{math.floor((x + 389500) / 1000)}_"
          f"{math.floor((5820000 - z) / 1000)}.zip"
        )
        if expected != Path(archive).name:
          continue
        road_index = road_tree.nearest(polygon)
        if road_index is None:
          continue
        road_distance = polygon.distance(roads[int(road_index)])
        rows.append(
          dict(
            owner=owner,
            tile=tid,
            region=region,
            original=row,
            origin=packet["origin"],
            groundY=packet["nav"]["groundY"],
            center=[x, z],
            roadDistance=road_distance,
          )
        )
    result[region] = rows
  return result, descriptors, packets


def extract() -> dict:
  """Read four local archives serially and retain at most 32 complete owners."""
  candidates, descriptors, packets = candidate_owners()
  selected, archives, audit = [], {}, {}
  for region, (relative, _) in SITES.items():
    path = GEO / relative
    wanted = {row["owner"]: row for row in candidates[region]}
    accepted = []
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".gml", ".xml", ".citygml")):
          continue
        with archive.open(member) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            owner = parent.get(GML_ID)
            # ALKIS 1000/1010 identify residential buildings and houses. Named or other uses are excluded above
            # and here, rather than inferred from a plausible house silhouette.
            function = parent.findtext("bldg:function", default="", namespaces=NS)
            if owner in wanted and function in {"31001_1000", "31001_1010"}:
              row = wanted[owner]
              try:
                parts = [
                  base.part_profile(p) for p in leaf_building_parts(parent) or [parent]
                ]
                roofs = [
                  s for p in parts for s in p["surfaces"] if s["kind"] == "RoofSurface"
                ]
                heights = [v[1] for s in roofs for ring in s["rings"] for v in ring]
                footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
                ox, _, oz = row["origin"]
                old = translate(
                  Polygon(row["original"]["ring"], row["original"]["holes"]), ox, oz
                )
                low, high = (
                  min(p["ground_y_m"] for p in parts),
                  max(p["top_y_m"] for p in parts),
                )
                if (
                  1.2 < max(heights) - min(heights) < 12
                  and len(parts) <= 8
                  and sum(len(p["surfaces"]) for p in parts) <= 100
                  and footprint.symmetric_difference(old).area
                  < max(0.2, old.area * 0.001)
                  and abs(high - low - row["original"]["height"]) < 0.12
                ):
                  accepted.append(
                    dict(
                      row,
                      parts=parts,
                      sourceTile=path.name,
                      sourceGroundY=low,
                      sourceRoofLowY=min(heights),
                      sourceTopY=high,
                      sourceFunction=function,
                      sourceCreationDate=parent.findtext(
                        "core:creationDate", default="", namespaces=NS
                      ),
                    )
                  )
              except (ValueError, KeyError, shapely.errors.GEOSException):
                pass
            parent.clear()
    group, remaining = [], sorted(accepted, key=lambda row: row["owner"])
    native_packets = {}
    while remaining and len(group) < 8:
      row = (
        max(
          remaining,
          key=lambda r: min(math.dist(r["center"], p["center"]) for p in group),
        )
        if group
        else remaining[0]
      )
      remaining.remove(row)
      tid = row["tile"]
      if tid not in native_packets:
        native_packets[tid] = base.read_json(OUT / descriptors[tid]["minecraft"]["url"])
      matches = {
        "drawn": base.match_owner(packets[tid], row["owner"]),
        "minecraft": base.match_owner(native_packets[tid], row["owner"]),
      }
      if any(value is None for value in matches.values()):
        continue
      # Require every native cell to have an actual measured roof plane.
      trial = base.PackedMesh(row["origin"][0], row["origin"][2])
      try:
        base.render_owner(trial, row, True)
      except ValueError:
        continue
      group.append(dict(row, matches=matches))
    selected.extend(group)
    archives[path.name] = dict(
      localPath=relative,
      url=f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
      sha256=base.digest(path),
    )
    audit[region] = dict(
      candidates=len(wanted), measuredMatches=len(accepted), selected=len(group)
    )
    print(region, audit[region], flush=True)
  assert 0 < len(selected) <= 32
  result = dict(
    schema=1,
    policy=POLICY,
    owners=selected,
    archives=archives,
    audit=audit,
    previous=previous_receipts(),
  )
  base.write_json(SOURCE, result)
  return result


def build() -> dict:
  """Build independent replacement receipts without rewriting source packets."""
  source = base.read_json(SOURCE)
  for path, expected in source["previous"].items():
    assert base.digest(ROOT / path) == expected
  descriptors = {d["id"]: d for d in base.read_json(OUT / "manifest.json")["chunks"]}
  groups = defaultdict(list)
  for row in source["owners"]:
    groups[row["tile"]].append(row)
  runtime, receipts = {}, []
  for tid, rows in sorted(groups.items()):
    for mode in ("drawn", "minecraft"):
      descriptor = descriptors[tid][mode]
      assert base.digest(OUT / descriptor["url"]) == descriptor["sha256"]
      packet = base.read_json(OUT / descriptor["url"])
      mesh = base.PackedMesh(packet["origin"][0], packet["origin"][2])
      transfers, counts = defaultdict(list), []
      for row in rows:
        matches = base.match_owner(packet, row["owner"])
        assert matches is not None
        for index, triangles in matches.items():
          assert not set(transfers[index]) & set(triangles)
          transfers[index].extend(triangles)
        mapped = base.mapped_roof_tone(row)
        rendered = dict(row, roofTone=mapped[0]) if mapped else row
        counts.append(
          dict(
            owner=row["owner"],
            roofMaterial=mapped,
            **base.render_owner(mesh, rendered, mode == "minecraft"),
          )
        )
      records = [
        dict(
          mesh=index,
          fingerprint=base.fingerprint(
            [packet["meshes"][index][k] for k in ("positions", "colors", "indices")]
          ),
          triangles=sorted(triangles),
        )
        for index, triangles in sorted(transfers.items())
      ]
      segments = base.line_receipt(packet, rows) if mode == "drawn" else []
      runtime[f"{mode}:{tid}"] = dict(
        origin=packet["origin"],
        records=records,
        segments=segments,
        lineFingerprint=base.fingerprint(
          [packet["lines"]["positions"], packet["lines"].get("colors", "")]
        )
        if segments
        else None,
        replacement=mesh.payload("outer-roofs-v262"),
      )
      receipts.append(
        dict(
          tile=tid,
          mode=mode,
          oldAsset=descriptor,
          owners=[r["owner"] for r in rows],
          counts=counts,
          transferredTriangles=sum(len(r["triangles"]) for r in records),
          removedFlatInk=len(segments),
          addedVertices=len(mesh.vertices),
          addedTriangles=len(mesh.indices) // 3,
        )
      )
  base.write_json(RUNTIME, dict(schema=1, keys=sorted(runtime), packets=runtime))
  result = dict(
    schema=1,
    policy=POLICY,
    sourceSha256=base.digest(SOURCE),
    runtimeSha256=base.digest(RUNTIME),
    owners=len(source["owners"]),
    regions=dict(Counter(r["region"] for r in source["owners"])),
    runtimeBytes=RUNTIME.stat().st_size,
    packets=receipts,
  )
  base.write_json(EVIDENCE, result)
  print({k: v for k, v in result.items() if k != "packets"}, flush=True)
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  if parser.parse_args().extract:
    extract()
  build()
