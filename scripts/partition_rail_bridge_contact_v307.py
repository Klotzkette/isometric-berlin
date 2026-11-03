"""Partition only proved source-road contact fragments beneath the v309 decks.

Source-quarter retirements and their single outside complement remain unchanged.
All unselected contact index words and every old position/RGB word survive.
The bridge replay owns the removed domain; this tool never constructs a deck.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from build_rail_sse_v307 import DATA, GEO, ROOT, read_v307, sha_v307, write_v307
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union
from terrain_fields_v307 import TerrainMeshV307, triangulate_v307


def decode(packed: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  return (
    np.frombuffer(base64.b64decode(packed["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(packed["colors"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(packed["indices"]), "<u4").reshape(-1, 3),
  )


def triangle_complement(
  points: np.ndarray, domain: Any, *, inside: bool = False
) -> tuple[list[np.ndarray], float, float]:
  """Clip in a source triangle's actual plane, including vertical kerb faces."""
  footprint = Polygon(points[:, [0, 2]])
  if footprint.area > 1e-9:
    axes = [0, 2]
    removed = footprint.intersection(domain)
    plane = footprint
  else:
    axis = int(np.argmax(np.ptp(points[:, [0, 2]], axis=0))) * 2
    order = np.argsort(points[:, axis])
    line = LineString(points[order[[0, -1]]][:, [0, 2]])
    cut = line.intersection(domain)
    if cut.is_empty or cut.length < 1e-9:
      return (
        ([] if inside else [np.eye(3)]),
        0,
        float(
          np.linalg.norm(np.cross(points[1] - points[0], points[2] - points[0])) / 2
        ),
      )
    axes = [axis, 1]
    plane = Polygon(points[:, axes])
    low, high = float(points[:, 1].min()) - 1, float(points[:, 1].max()) + 1
    members = (
      [cut] if cut.geom_type == "LineString" else list(getattr(cut, "geoms", []))
    )
    strips = []
    for member in members:
      if member.geom_type != "LineString" or member.length < 1e-9:
        continue
      values = np.asarray(member.coords)[:, axis // 2]
      strips.append(box(float(values.min()), low, float(values.max()), high))
    removed = plane.intersection(unary_union(strips))
  if removed.area < 1e-10:
    return ([] if inside else [np.eye(3)]), 0, plane.area
  outside = plane.difference(removed)
  if abs(outside.area + removed.area - plane.area) > max(1e-7, plane.area * 1e-9):
    raise ValueError("Bridge domain did not partition the original source plane")
  inv = np.linalg.inv(np.vstack((points[:, axes].T, np.ones(3))))
  orientation = np.cross(points[1] - points[0], points[2] - points[0])
  result = []
  for triangle in triangulate_v307(removed if inside else outside):
    weights = np.c_[triangle, np.ones(3)] @ inv.T
    xyz = weights @ points
    if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), orientation) < 0:
      weights = weights[[0, 2, 1]]
    result.append(weights)
  return result, removed.area, plane.area


def partition_contact_v307(
  contact: dict[str, Any], evidence: dict[str, Any], bridge: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
  """Join exact original ordinals to their contiguous compiled contact ranges."""
  if contact.get("bridgePartitionV307"):
    raise ValueError("Apply bridge partition only to the original compiled contact")
  packet_evidence = {p["key"]: p for p in evidence["packets"]}
  selected: dict[tuple[str, int, int], Any] = {}
  for row in bridge["records"]:
    key = row["mode"] + ":" + row["tile"]
    source = packet_evidence.get(key)
    if source is None or source["captureSha256"] != row["captureSha256"]:
      raise ValueError("The full final predecessor capture must match")
    identity = (key, row["mesh"], row["triangle"])
    domain = shape(row["domain"])
    if (
      not domain.is_valid
      or domain.is_empty
      or domain.geom_type not in ("Polygon", "MultiPolygon")
    ):
      raise ValueError("A complete mapped bridge deck domain is required")
    selected[identity] = (
      domain.union(selected[identity]) if identity in selected else domain
    )
  ranges: dict[str, dict[int, Any]] = {}
  matched = set()
  for key, packet in packet_evidence.items():
    offsets: dict[str, int] = {}
    for part in packet["parts"]:
      counts: dict[str, int] = {}
      for row in part["provenanceRows"]:
        identity = (key, part["mesh"], row[0])
        domain = selected.get(identity)
        for field, start, count, _area in row[5]:
          counts[field] = max(counts.get(field, 0), start + count)
          if domain is not None:
            target = ranges.setdefault(key + ":" + field, {})
            for i in range(
              offsets.get(field, 0) + start, offsets.get(field, 0) + start + count
            ):
              if i in target:
                raise ValueError("A compiled source triangle has ambiguous ownership")
              target[i] = domain
            matched.add(identity)
      for field, count in counts.items():
        offsets[field] = offsets.get(field, 0) + count
    for field, count in offsets.items():
      model = next(
        (q for q in contact["meshes"] if q["key"] == key + ":" + field), None
      )
      if model is None or model["triangles"] != count:
        raise ValueError("The exact original contact provenance no longer matches")
  # This field owns only its existing exact source retirements. The remaining
  # explicit source ordinals require a separate, disjoint bridge transfer.
  external = sorted(set(selected) - matched)
  proof = []
  underdeck_models = []
  for model in contact["meshes"]:
    domains = ranges.get(model["key"])
    if not domains:
      continue
    pos, rgb, index = decode(model)
    vertices, colours = pos.tolist(), rgb.tolist()
    lookup = {
      tuple((*p, *c)): i for i, (p, c) in enumerate(zip(vertices, colours, strict=True))
    }
    result = []
    rows = []
    floor = TerrainMeshV307(model["origin"])
    origin = np.asarray(model["origin"])
    for ordinal, triangle in enumerate(index):
      domain = domains.get(ordinal)
      if domain is None:
        result.extend(map(int, triangle))
        continue
      p, c = pos[triangle].astype(float) / 100 + origin, rgb[triangle].astype(float)
      weights, removed_area, source_area = triangle_complement(p, domain)
      start = len(result) // 3
      floor_start = len(floor.indices) // 3
      if removed_area > 0:
        inside_weights, inside_area, inside_source_area = triangle_complement(
          p, domain, inside=True
        )
        if inside_area != removed_area or inside_source_area != source_area:
          raise ValueError("Underdeck field and outside have different source planes")
        for bary in inside_weights:
          floor.add(bary @ p, np.asarray([[10537, 8224, 6168]] * 3))
      if removed_area == 0:
        result.extend(map(int, triangle))
      else:
        for bary in weights:
          pp = np.rint((bary @ p - origin) * 100).astype(np.int64)
          cc = np.rint(bary @ c).astype(np.int64)
          if pp.min() < 0 or pp.max() > 65535 or cc.min() < 0 or cc.max() > 65535:
            raise ValueError("Exact bridge complement escaped source storage")
          if len(set(map(tuple, pp))) < 3:
            continue
          for point, colour in zip(pp.tolist(), cc.tolist(), strict=True):
            identity = tuple((*point, *colour))
            at = lookup.get(identity)
            if at is None:
              at = len(vertices)
              lookup[identity] = at
              vertices.append(point)
              colours.append(colour)
            result.append(at)
      rows.append(
        [
          ordinal,
          start,
          len(result) // 3 - start,
          source_area,
          removed_area,
          floor_start,
          len(floor.indices) // 3 - floor_start,
        ]
      )
    out_pos, out_rgb = (
      np.asarray(vertices, dtype="<u2"),
      np.asarray(colours, dtype="<u2"),
    )
    if not np.array_equal(out_pos[: len(pos)], pos) or not np.array_equal(
      out_rgb[: len(rgb)], rgb
    ):
      raise ValueError("An existing position or RGB source word changed")
    model.update(
      positions=base64.b64encode(out_pos.tobytes()).decode(),
      colors=base64.b64encode(out_rgb.tobytes()).decode(),
      indices=base64.b64encode(np.asarray(result, dtype="<u4").tobytes()).decode(),
      vertices=len(vertices),
      triangles=len(result) // 3,
    )
    packed_floor = floor.packed()
    if packed_floor:
      underdeck_models.append(
        dict(
          key=model["key"] + ":bridge-underdeck-ground",
          native=model["native"],
          field=model["field"],
          **packed_floor,
        )
      )
    proof.append(
      dict(
        key=model["key"],
        oldVertices=len(pos),
        newVertices=len(vertices),
        oldTriangles=len(index),
        newTriangles=model["triangles"],
        columns=[
          "oldTriangle",
          "newStart",
          "newCount",
          "sourcePlaneArea",
          "deckPlaneArea",
          "underdeckStart",
          "underdeckCount",
        ],
        rows=rows,
      )
    )
  stamp = hashlib.sha256(
    json.dumps(bridge, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()
  contact["bridgePartitionV307"] = dict(sourceSha256=stamp, policy=__doc__)
  return (
    contact,
    dict(
      schemaVersion=1,
      sourceSha256=stamp,
      selectedOriginalTriangles=len(matched),
      requiresSeparateSourceTransfer=[list(q) for q in external],
      meshes=proof,
      policy=__doc__,
    ),
    dict(
      schemaVersion=1,
      palette=[10537, 8224, 6168],
      sourceSha256=stamp,
      models=underdeck_models,
    ),
  )


def palette_sources_v307(bridge: dict[str, Any], captures: Path) -> list[dict]:
  """Prove the retained rail paint against complete actual 3.15 m sources."""
  sources = []
  for mode in ("drawn", "minecraft"):
    records = [r for r in bridge["records"] if r["mode"] == mode]
    domain = unary_union([shape(r["domain"]) for r in records])
    best = None
    for tile in sorted({r["tile"] for r in records}):
      path = captures / f"{tile}.{mode}.json"
      capture = read_v307(path)
      digest = sha_v307(path)
      if any(r["captureSha256"] != digest for r in records if r["tile"] == tile):
        raise ValueError("The complete rail palette source capture changed")
      pos, rgb, ix = decode(capture["mesh"])
      xyz = pos.astype(float) / 100 + np.asarray(capture["origin"])
      candidates = np.flatnonzero(
        np.all(rgb[ix] == [10537, 8224, 6168], axis=(1, 2))
        & np.all(np.abs(xyz[ix][:, :, 1] - 3.15) < 0.02, axis=1)
      )
      for ordinal in candidates:
        triangle = xyz[ix[ordinal]]
        footprint = Polygon(triangle[:, [0, 2]])
        distance = footprint.distance(domain)
        if distance > 40 or best is not None and distance >= best[0]:
          continue
        part = next(
          (
            p
            for p in capture["parts"]
            if p["kind"] == "city"
            and p["indexStart"] <= int(ordinal) * 3 < p["indexStart"] + p["indexCount"]
          ),
          None,
        )
        if part is None:
          continue
        best = (
          distance,
          dict(
            mode=mode,
            tile=tile,
            mesh=part["mesh"],
            triangle=(int(ordinal) * 3 - part["indexStart"]) // 3,
            captureSha256=digest,
            positions=triangle.tolist(),
            color=[10537, 8224, 6168],
            distanceToDeckM=distance,
          ),
        )
    if best is None:
      raise ValueError("No adjacent actual retained rail palette source exists")
    sources.append(best[1])
  return sources


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("bridge", type=Path)
  parser.add_argument("captures", type=Path)
  parser.add_argument(
    "--approach-derived",
    action="store_true",
    help="Write explicit309 approach derivatives; immutable307 inputs remain unchanged",
  )
  args = parser.parse_args()
  contact_path = DATA / (
    "railTerrainContactApproachV309.json"
    if args.approach_derived
    else "railTerrainContactV307.json"
  )
  evidence_path = GEO / (
    "rail-terrain-contact-approach-v309-evidence.json.gz"
    if args.approach_derived
    else "rail-terrain-contact-v307-evidence.json.gz"
  )
  bridge_proof = GEO / (
    "rail-bridge-contact-approach-v309-evidence.json.gz"
    if args.approach_derived
    else "rail-bridge-contact-v307-evidence.json.gz"
  )
  underdeck_path = DATA / (
    "railBridgeUnderdeckApproachV309.json"
    if args.approach_derived
    else "railBridgeUnderdeckV307.json"
  )
  original = sha_v307(contact_path)
  extra_path = DATA / "railBridgeApproachV307Ground.json"
  combined = read_v307(contact_path)
  extra = read_v307(extra_path) if args.approach_derived else None
  if extra:
    combined["meshes"] += extra["meshes"]
  before_extra = sha_v307(extra_path) if extra else None
  bridge = read_v307(args.bridge)
  palette = palette_sources_v307(bridge, args.captures)
  contact, proof, underdeck = partition_contact_v307(
    combined, read_v307(evidence_path), bridge
  )
  proof["paletteSources"] = palette
  underdeck["paletteSources"] = palette
  if extra:
    extra["meshes"] = [
      q for q in contact["meshes"] if q["field"].startswith("bridge-approach-v307")
    ]
    contact["meshes"] = [
      q for q in contact["meshes"] if not q["field"].startswith("bridge-approach-v307")
    ]
    write_v307(extra_path, extra)
  write_v307(contact_path, contact)
  write_v307(underdeck_path, underdeck)
  proof.update(
    beforeContactSha256=original,
    afterContactSha256=sha_v307(contact_path),
    bridgeFileSha256=sha_v307(args.bridge),
  )
  if extra:
    proof.update(
      beforeExtraContactSha256=before_extra,
      afterExtraContactSha256=sha_v307(extra_path),
    )
  write_v307(bridge_proof, proof)
  evidence = read_v307(evidence_path)
  evidence["preBridgeContactSha256"] = original
  evidence["compiledTriangleProvenanceStage"] = "before-rail-bridge-partition-v307"
  evidence["bridgePartitionProof"] = dict(
    path=str(bridge_proof.relative_to(ROOT)),
    sha256=sha_v307(bridge_proof),
  )
  evidence.setdefault("artifacts", {})[str(contact_path.relative_to(ROOT))] = sha_v307(
    contact_path
  )
  write_v307(evidence_path, evidence)
  print(
    {
      k: (len(v) if k == "requiresSeparateSourceTransfer" else v)
      for k, v in proof.items()
      if k != "meshes"
    }
  )


if __name__ == "__main__":
  main()
