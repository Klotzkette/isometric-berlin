"""Step 10: audit the complete remaining Alt-Mitte house-colour catalogue.

Only source-qualified ordinary families with unknown paint receive exact colour
receipts. All old geometry and v271 colours remain immutable.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_alt_mitte_appearance_v213 as prior
from scripts import build_north_mitte_colours_v271 as northern
from scripts.build_alt_mitte_protection_v213 import aliases

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = prior.APP / "remainingAltMitteColoursV273.json"
INDEX = prior.APP / "remainingAltMitteColoursV273Index.json"
EVIDENCE = prior.GEO / "remaining-alt-mitte-colours-v273-evidence.json.gz"
RESIDENTIAL = {
  "apartments",
  "residential",
  "house",
  "terrace",
  "detached",
  "semidetached_house",
}
RESIDENTIAL_FUNCTIONS = {"31001_1000", "31001_1010"}
WALL_KEYS = ("building:colour", "building:material", "facade:colour", "facade:material")
ROOF_KEYS = ("roof:colour", "roof:material")


def ordinary_reason(record: dict, baseline: dict) -> str | None:
  """Require positive mapped use or retained official residential function."""
  tags = record.get("osmTags", {})
  if record.get("name") or any(
    tags.get(k) for k in ("name", "amenity", "tourism", "historic", "diplomatic")
  ):
    return None
  kind = tags.get("building")
  if kind and kind not in RESIDENTIAL | {"yes"}:
    return None
  if kind in RESIDENTIAL and baseline.get("acceptedContext"):
    return "reciprocal mapped residential use"
  functions = {
    part.get("sourceAttributes", {}).get("function") for part in record["parts"]
  }
  # A separately classified canopy can remain attached to its residential
  # parent. It does not alone qualify any family as a house.
  if functions & RESIDENTIAL_FUNCTIONS and functions <= RESIDENTIAL_FUNCTIONS | {
    "51009_1610"
  }:
    return "complete official residential family"
  return None


def protected_owners(records: list[dict]) -> tuple[set[str], list[dict]]:
  """Protect exact later authored IDs, including short retained prism aliases."""
  protected, receipts = northern.protected_owners()
  source_ids = set().union(*(prior.aliases(row) for row in records))
  for path in sorted(prior.APP.glob("*.json")):
    version = re.search(r"V(\d+)", path.name)
    if not version or not 214 <= int(version[1]) <= 272 or int(version[1]) == 271:
      continue
    text = path.read_text()
    ids = set(re.findall(r"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)", text))
    # Values and object keys that are already exact source aliases are relevant;
    # generic words and hash-like arbitrary identifiers are never interpreted.
    ids.update(set(re.findall(r'"([A-Za-z0-9_-]{8})"', text)) & source_ids)
    found = aliases(ids) & source_ids
    if found:
      protected.update(found)
      receipts.append(
        {
          "file": str(path.relative_to(ROOT)),
          "sha256": prior.digest(path),
          "ids": sorted(found),
        }
      )
  return protected, receipts


def source_selectors() -> tuple[list, list, list, list, dict]:
  """Audit every rendered source family; retain all neighbours as blockers."""
  all_records = prior.source_records()
  residuals = [
    row for row in all_records if not row.get("parts") and row.get("needsResidualShell")
  ]
  records = [
    row
    for row in all_records
    if row["category"] in {"core", "outer"} and row["sourceType"] == "official-lod2"
  ]
  del all_records
  baseline = {row["id"]: row for row in prior.read(prior.EVIDENCE)["owners"]}
  inherited, _ = prior.appearance()
  protected, receipts = protected_owners(records)
  offsets = prior.read(prior.APP / "weinbergBuildingOffsetsV176.json")["offsets"]
  surfaces, native, evidence = [], [], []
  counts: Counter = Counter()
  for record in records:
    old = baseline.get(record["id"], {})
    ordinary = ordinary_reason(record, old)
    v271 = bool(northern.zones_for(record))
    authored = bool(prior.aliases(record) & protected)
    allowed = bool(old.get("eligible") and ordinary and not v271 and not authored)
    tags = record.get("osmTags", {})
    unknown_wall = not any(tags.get(k) for k in WALL_KEYS)
    unknown_roof = not any(tags.get(k) for k in ROOF_KEYS)
    wall, roof = northern.palette(record["id"])
    reason = (
      "v271 complete family retained"
      if v271
      else "authored/protected owner retained"
      if authored or not old.get("eligible")
      else "non-residential, named or insufficient use evidence"
      if not ordinary
      else "unknown paint: contextual display estimate"
    )
    shape = northern.footprint(record)
    point = shape.representative_point()
    evidence.append(
      {
        "id": record["id"],
        "eligible": allowed,
        "wallEligible": allowed and unknown_wall,
        "roofEligible": allowed and unknown_roof,
        "reason": reason,
        "ordinaryEvidence": ordinary,
        "v271Protected": v271,
        "wallSrgb": wall,
        "roofSrgb": roof,
        "sourceFileTile": record.get("tile"),
        "center": [round(point.x, 3), round(point.y, 3)],
        "parts": [p["id"] for p in record["parts"]],
      }
    )
    counts["auditedSourceFamilies"] += 1
    counts["eligibleFamilies"] += int(allowed)
    counts["v271ProtectedFamilies"] += int(v271)
    counts["authoredProtectedFamilies"] += int(authored)
    counts["ordinaryQualifiedFamilies"] += int(bool(ordinary))
    defaults = prior.old_materials(tags)
    offset = float(offsets.get(record["id"], 0))
    for part in record["parts"]:
      previous = inherited.get(part["id"])
      old_wall = tuple(previous["facade"]["srgb8"]) if previous else defaults[0]
      old_roof = tuple(previous["roof"]["srgb8"]) if previous else defaults[1]
      for sheet in part["surfaces"]:
        if sheet["kind"] not in {"WallSurface", "RoofSurface"}:
          continue
        is_roof = sheet["kind"] == "RoofSurface"
        face = prior.make_surface(
          record["id"],
          part["id"],
          sheet,
          old_roof if is_roof else old_wall,
          roof if is_roof else wall,
          offset,
        )
        if face:
          face.allowed = allowed and (unknown_roof if is_roof else unknown_wall)
          surfaces.append(face)
      footprint = unary_union(
        [
          shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
          for p in part["footprintPolygons"]
        ]
      ).buffer(2.84)
      for role, before, after, unknown in (
        ("WallSurface", old_wall, wall, unknown_wall),
        ("RoofSurface", old_roof, roof, unknown_roof),
      ):
        native.append(
          prior.NativePart(
            record["id"],
            part["id"],
            footprint,
            part["groundY"] + offset,
            part["topY"] + offset,
            ((role, prior.linear(before), prior.linear(after)),),
            allowed and unknown,
          )
        )
  # One tiny OSM-only residual is a rendered source shell too. It cannot
  # receive fallback paint but must remain a blocker near official families.
  for row in residuals:
    low = row["groundY"] + float(offsets.get(row["id"], 0))
    high = low + row["residualShellHeightM"]
    wall, roof = prior.old_materials(row.get("osmTags", {}))
    shape = northern.footprint(row)
    native.append(
      prior.NativePart(
        row["id"],
        row["id"],
        shape.buffer(2.84),
        low,
        high,
        (("WallSurface", prior.linear(wall), prior.linear(wall)),),
        False,
      )
    )
    native.append(
      prior.NativePart(
        row["id"],
        row["id"],
        shape.buffer(2.84),
        low,
        high,
        (("RoofSurface", prior.linear(roof), prior.linear(roof)),),
        False,
      )
    )
    for polygon in row["footprintPolygons"]:
      poly = shapely.orient_polygons(
        Polygon(polygon["ring"], polygon.get("holes", [])), exterior_cw=True
      )
      for ring in [poly.exterior, *poly.interiors]:
        points = list(ring.coords)
        for (ax, az), (bx, bz) in zip(points, points[1:]):
          sheet = {
            "kind": "WallSurface",
            "rings": [[[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]]],
          }
          surface = prior.make_surface(row["id"], row["id"], sheet, wall, wall)
          if surface:
            surface.allowed = False
            surfaces.append(surface)
      sheet = {
        "kind": "RoofSurface",
        "rings": [
          [[x, high, z] for x, z in ring.coords[:-1]]
          for ring in [poly.exterior, *poly.interiors]
        ],
      }
      surface = prior.make_surface(row["id"], row["id"], sheet, roof, roof)
      if surface:
        surface.allowed = False
        surfaces.append(surface)
  counts["protectedResidualShells"] = len(residuals)
  return surfaces, native, evidence, receipts, dict(counts)


def build(*, write: bool = True) -> dict:
  """Prove both actual packet families serially; write no source or geometry."""
  surfaces, native, owners_evidence, protection, source_counts = source_selectors()
  print(json.dumps(source_counts), flush=True)
  drawn_tree = STRtree([row.bounds_xz for row in surfaces])
  native_tree = STRtree([row.footprint for row in native])
  bounds = tuple(float(x) for x in shapely.total_bounds([r.footprint for r in native]))
  output = {"schemaVersion": 1, "palette": [], "packets": {}}
  lookup: dict[int, int] = {}
  counts: dict[str, Counter] = defaultdict(Counter)
  owners: dict[str, set[str]] = defaultdict(set)
  receipts = []
  examined = []
  for mode, identity, path in prior.packet_paths(bounds):
    packet = prior.read(path)
    if not any(part["kind"] == prior.KIND for part in packet["meshes"]):
      continue
    is_native = mode == "minecraft"
    entries, selected = [], 0
    for ordinal, part in enumerate(packet["meshes"]):
      if part["kind"] != prior.KIND:
        continue
      values = prior.compile_mesh(
        part,
        packet["origin"],
        surfaces,
        native,
        is_native,
        native_tree if is_native else drawn_tree,
        native if is_native else surfaces,
        counts[mode],
        owners[mode],
      )
      if values:
        selected += len(values)
        entries.append(
          {
            "mesh": ordinal,
            "fingerprint": prior.fingerprint(part),
            "runs": base64.b64encode(
              np.asarray(
                prior.runs_for(values, output["palette"], lookup), dtype="<u4"
              ).tobytes()
            ).decode(),
          }
        )
    row = {
      "file": str(path.relative_to(ROOT)),
      "sha256": prior.digest(path),
      "mode": mode,
      "selectedVertices": selected,
    }
    examined.append(row)
    if entries:
      output["packets"][mode + ":" + identity] = entries
      receipts.append(row)
    print(f"{mode}:{identity}: {selected} existing colour vertices", flush=True)
  raw = (json.dumps(output, separators=(",", ":")) + "\n").encode()
  evidence = {
    "schemaVersion": 1,
    "scope": "Complete existing Alt-Mitte v169 core/outer official catalogue, with the complete v271 selected families protected",
    "sourceManifestSha256": prior.digest(prior.SOURCE / "source-manifest.json"),
    "v213ProtectionSha256": prior.digest(prior.PROTECTED),
    "v213AppearanceEvidenceSha256": prior.digest(prior.EVIDENCE),
    "v271EvidenceSha256": prior.digest(northern.EVIDENCE),
    "additionalProtection": protection,
    "sourceCounts": source_counts,
    "modeCounts": {k: dict(v) for k, v in counts.items()},
    "owners": owners_evidence,
    "ownersReceivingSelectors": {k: sorted(v) for k, v in owners.items()},
    "packetReceipts": receipts,
    "allExaminedPackets": examined,
    "packetFilesChanged": 0,
    "runtimeBytes": len(raw),
    "runtimeGzipBytes": len(gzip.compress(raw, mtime=0)),
    "limits": [
      "Unknown paint uses contextual display tones, not surveyed per-house colour.",
      "Only positive retained residential use qualifies; named or unqualified families stay unchanged.",
      "Mapped material/colour roles and every v271 selected family retain priority.",
      "All source roofs, windows, walls, courts, indices, buffers and packet bytes are retained.",
      "All source families remain independent native ambiguity blockers, including protected owners.",
    ],
  }
  if write:
    OUTPUT.write_bytes(raw)
    INDEX.write_text(
      json.dumps(sorted(output["packets"]), separators=(",", ":")) + "\n"
    )
    EVIDENCE.write_bytes(
      gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
    )
  return {
    k: v
    for k, v in evidence.items()
    if k
    not in {
      "owners",
      "packetReceipts",
      "allExaminedPackets",
      "ownersReceivingSelectors",
      "additionalProtection",
    }
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
