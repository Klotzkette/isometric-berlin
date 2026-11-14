"""Compile eight retained street fronts using the existing V320 wall and fitting checks."""

from __future__ import annotations

import gzip
import json
import math
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import Polygon, shape

from scripts import build_cluster_facades_v320 as facades
from scripts import build_district_facades_v188 as district

KIND = "wedding-gesundbrunnen-fronts-v340"
PROFILE = facades.GEO / f"{KIND}-source.json"
RECEIPT = facades.GEO / f"{KIND}-receipt.json"
RUNTIME = facades.DATA / "weddingGesundbrunnenFrontsV340.json"
MODES = ("drawn", "minecraft")


def load_inputs(profile: dict) -> tuple[dict, dict]:
  path = facades.PUBLIC / "manifest.json"
  manifest_path = path.relative_to(facades.ROOT).as_posix()
  predecessor = subprocess.check_output(
    ["git", "show", f"{profile['sourceBaseline']}:{manifest_path}"], cwd=facades.ROOT
  )
  return (
    {row["id"]: row for row in facades.read(path)["chunks"]},
    {row["id"]: row for row in json.loads(predecessor)["chunks"]},
  )


def confirm_ordinary_face(face: dict, record: dict, packet: dict) -> int:
  """Match the retained OSM footprint and positive residential use to the wall owner."""
  facades.validate_primary_audit(face["ordinaryWallAudit"])
  building = record["drawnRecord"]
  matches = [b for b in packet["nav"]["buildings"] if b["sourceId"] == face["owner"]]
  if matches != [building] or record["street"]["id"] != face["streetId"]:
    raise ValueError("The selected residential building or street record changed")
  source = record["sourceRecord"]
  tags = source["properties"]
  identity = face["ordinaryWallAudit"]
  if (
    tags["osm_way_id"] != identity["osmWayId"]
    or tags["osm_id"] != identity["osmRelationId"]
    or tags["building"] != identity["building"]
    or any(tags.get(key) for key in ("name", "amenity", "office", "shop", "tourism"))
    or re.search(r'"(?:building|facade):(?:colour|material)"', tags["other_tags"])
  ):
    raise ValueError("The retained source no longer describes ordinary housing")
  original = translate(
    Polygon(building["ring"], building["holes"]),
    packet["origin"][0],
    packet["origin"][2],
  )
  mapped = shape(source["geometry"])
  overlap = original.intersection(mapped).area / original.union(mapped).area
  if not math.isclose(overlap, record["footprintIoU"], abs_tol=1e-10) or overlap < 0.97:
    raise ValueError(
      "The original source footprint no longer matches the residential record"
    )
  levels = re.search(r'"building:levels"=>"([1-9])"', tags["other_tags"])
  if not levels:
    raise ValueError("The primary fitting requires a retained OSM storey count")
  return int(levels.group(1))


def compile_faces(profile: dict) -> tuple[dict, dict]:
  districts = ("Wedding", "Gesundbrunnen")
  groups = profile["clusters"]
  if len(groups) != 2 or any(len(group["faces"]) != 4 for group in groups):
    raise ValueError("Select four retained walls in each of the two Ortsteile")
  selected = [face["owner"] for group in groups for face in group["faces"]]
  if len(set(selected)) != 8:
    raise ValueError("A fascia owner cannot be selected more than once")
  prior = facades.exclusions() | facades.owner_ids(
    facades.read(facades.GEO / "cluster-facades-v320-evidence.json.gz")
  )
  for name in facades.MATERIAL_EVIDENCE:
    prior.update(facades.read(facades.GEO / name)["owners"])
  if set(selected) & prior:
    raise ValueError("Previously detailed or mapped material owner selected")
  originals = {
    (family, row["owner"], row["chunk"]): row
    for family, info in facades.FAMILIES.items()
    for row in facades.read(facades.GEO / info[0])["faces"]
  }
  ordinary = {row["owner"]: row for row in profile["ordinaryResidentialRecords"]}
  boundaries = {
    row["properties"]["nam"]: district.world(shape(row["geometry"]))
    for row in facades.read(facades.GEO / "house-districts-v233.geojson")["features"]
    if row["properties"]["nam"] in districts
  }
  current, predecessor = load_inputs(profile)
  source_inputs = {}
  packets = {}

  def load_packet(host: str, mode: str) -> dict:
    if (host, mode) not in packets:
      descriptor = current[host][mode]
      old_descriptor = predecessor[host][mode]
      path = facades.PUBLIC / descriptor["url"]
      wire = path.read_bytes()
      if (
        descriptor != old_descriptor
        or len(wire) != descriptor["bytes"]
        or facades.sha(wire) != descriptor["sha256"]
      ):
        raise ValueError(f"Original complete packet changed: {host} {mode}")
      decoded = gzip.decompress(wire)
      source_inputs[f"{mode}:{host}"] = dict(
        url=descriptor["url"],
        wireSha256=descriptor["sha256"],
        decodedSha256=facades.sha(decoded),
      )
      packets[host, mode] = json.loads(decoded)
    return packets[host, mode]

  doors = facades.read(facades.GEO / "house-doors-v233-evidence.json.gz")["doors"]
  buckets = defaultdict(list)
  resolved = []
  for place, group in zip(districts, groups, strict=True):
    for request in group["faces"]:
      owner, tile, family = (request[key] for key in ("owner", "chunk", "family"))
      source = load_packet(tile, "drawn")
      style = facades.normalized_style(group["style"])
      if "wallRgb" in style:
        raise ValueError("The existing colour pass remains visible on every wall")
      levels = None
      if place == "Wedding" and family == "v188":
        face = originals[family, owner, tile]
        if face["omittedWindowColumns"] or face["nativeWindowCount"] <= 0:
          raise ValueError("The old generic frontage lacks its full two-mode receipt")
        host = facades.FAMILIES[family][1] + tile
      elif place == "Gesundbrunnen" and family == "primary":
        face = request
        if any(owner == old_owner for _, old_owner, _ in originals):
          raise ValueError("The primary frontage already has prior generic fittings")
        levels = confirm_ordinary_face(face, ordinary[owner], source)
        host = tile
      else:
        raise ValueError("Unexpected district or source family")
      buildings = [
        row for row in source["nav"]["buildings"] if row["sourceId"] == owner
      ]
      if len(buildings) != 1:
        raise ValueError("The selected source is not a unique Drawn building")
      footprint = translate(
        Polygon(buildings[0]["ring"], buildings[0]["holes"]),
        source["origin"][0],
        source["origin"][2],
      )
      if not boundaries[place].covers(footprint.representative_point()):
        raise ValueError(f"The source owner is outside {place}")
      record = {"place": place, "owner": owner, "host": host, "face": face, "modes": {}}
      resolved.append(record)
      for mode in MODES:
        native = mode == "minecraft"
        packet = load_packet(tile, mode)
        spans = face["nativeSpans"] if native else [face]
        if not spans:
          raise ValueError("Positive independent support is required in both modes")
        for span in spans:
          wall = dict(span, owner=owner)
          facades.verify_wall(packet, wall, native)
          if family == "primary":
            facades.verify_primary_owner(packet, wall)
        buckets[mode, host].append((record, style, family, levels))
  plans = {}
  totals = Counter()
  for (mode, host), members in sorted(buckets.items()):
    native = mode == "minecraft"
    packet = load_packet(host, mode)
    mesh = facades.FrontMesh(packet["origin"])
    retired = defaultdict(set)
    for record, style, family, levels in members:
      face = record["face"]
      generic = (
        []
        if family == "primary"
        else facades.retire_generic(packet, [face], native, facades.FAMILIES[family][2])
      )
      for item in generic:
        prior_triangles = retired[item["mesh"]]
        if prior_triangles.intersection(item["triangles"]):
          raise ValueError("A previous fitting triangle has multiple source owners")
        prior_triangles.update(item["triangles"])
      spans = face["nativeSpans"] if native else [face]
      reports = []
      for span in spans:
        adjusted = (
          style
          if levels is None
          else facades.normalized_style(
            dict(style, floorPitchM=(span["high"] - span["low"] - 0.6) / levels)
          )
        )
        report = facades.build_front(
          mesh, dict(span, owner=record["owner"]), adjusted, doors, native
        )
        if not report["windows"] or (levels is not None and report["floors"] != levels):
          raise ValueError(
            "A selected source frontage has no complete supported fitting rhythm"
          )
        reports.append(report)
      record["modes"][mode] = {
        "fronts": reports,
        "retire": generic,
        "mappedStoreys": levels,
      }
      totals[mode + "Windows"] += sum(report["windows"] for report in reports)
    mesh.compact()
    part = mesh.payload()["meshes"][0]
    part["kind"] = KIND
    old_sizes = [facades.arrays(m) for m in packet["meshes"]]
    if (
      len(old_sizes) >= 16
      or sum(len(p) for p, _, _ in old_sizes) + len(mesh.positions) > 400000
      or sum(i.size for _, _, i in old_sizes) + len(mesh.indices) > 2400000
    ):
      raise ValueError("Existing bounded packet limits exceeded")
    totals[mode + "Triangles"] += len(mesh.indices) // 3
    plans[f"{mode}:{host}"] = dict(
      origin=packet["origin"],
      navGuard=0,
      lineGuard=None,
      records=[
        dict(mesh=i, kind=p["kind"], fingerprint=facades.part_fingerprint(p))
        for i, p in enumerate(packet["meshes"])
      ],
      append=part,
      appendFingerprint=facades.part_fingerprint(part),
      retire=[
        dict(mesh=i, triangles=sorted(rows)) for i, rows in sorted(retired.items())
      ],
      owners=sorted(record["owner"] for record, _, _, _ in members),
    )
  return dict(schemaVersion=1, keys=sorted(plans), packets=plans), dict(
    schemaVersion=1,
    kind=KIND,
    sourceBaseline=profile["sourceBaseline"],
    profileSha256=facades.sha(PROFILE.read_bytes()),
    sourceInputs=source_inputs,
    counts=dict(totals),
    sourceOwners=resolved,
    pendingBunPrimaryGuards=sorted(plans),
  )


if __name__ == "__main__":
  import argparse
  import tempfile

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--check", action="store_true", help="Compare generated words without writing"
  )
  args = parser.parse_args()

  runtime, receipt = compile_faces(facades.read(PROFILE))
  with tempfile.TemporaryDirectory(
    prefix="wedding-gesundbrunnen-fronts-v340-"
  ) as output:
    recipe_path = Path(output) / RUNTIME.name
    receipt_path = Path(output) / "receipt.json.gz"
    facades.write(recipe_path, runtime)
    facades.write(receipt_path, receipt)
    subprocess.run(
      [
        "bun",
        "--bun",
        "src/app/scripts/finalize-wedding-gesundbrunnen-fronts-v340.ts",
        recipe_path,
        receipt_path,
      ],
      cwd=facades.ROOT,
      check=True,
    )
    if args.check:
      if recipe_path.read_bytes() != RUNTIME.read_bytes() or facades.read(
        receipt_path
      ) != facades.read(RECEIPT):
        raise ValueError("Checked-in recipe or receipt differs from exact reproduction")
    else:
      RUNTIME.write_bytes(recipe_path.read_bytes())
      facades.write(RECEIPT, facades.read(receipt_path))
  print(json.dumps(receipt["counts"]))
