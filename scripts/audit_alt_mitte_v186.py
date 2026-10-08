"""Step 10: read-only, complete Alt-Mitte ownership and facade evidence audit.

This inventories source records, not a claimed physical-house/window survey.
It writes only the v186 audit; source geometry and viewer packets are untouched.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "alt-mitte-v169"
APP = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OUTPUT = GEO / "alt-mitte-v186-audit.json"


def read(path: Path) -> Any:
  """Read one bounded JSON source without editing it."""
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def digest(path: Path) -> str:
  """Hash the exact delivered source bytes."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def source_height(record: dict) -> float:
  """Report source/legacy display height, not a guessed window count."""
  if record["parts"]:
    return max(p["topY"] - p["groundY"] for p in record["parts"])
  prisms = record.get("legacyPrisms", [])
  if prisms:
    return max(p["h_dm"] / 10 for p in prisms)
  return record["sourceAttributes"].get("height", record.get("residualShellHeightM", 0))


def retained_class(record: dict) -> str:
  """Separate protected custom models, monuments and unresolved source overlaps."""
  reason = record.get("retentionReasonType")
  if reason:
    return reason
  if any("Holocaust stele field" in r for r in record["ownershipReasons"]):
    return "retained-monument-field"
  return "retained-existing-authored-or-glass"


def build_audit() -> dict[str, Any]:
  """Audit every catalogue record plus current resident/streamed ownership."""
  manifest = read(SOURCE / "source-manifest.json")
  rendered = {r["id"]: r for r in read(SOURCE / "render-audit.json")["buildings"]}
  current_manifest = read(PUBLIC / "manifest.json")
  transferred = set(current_manifest["source"]["alexanderStationsV183"]["owners"])
  source_rows, source_ids = [], set()
  by_class: Counter[str] = Counter()
  material_tags: Counter[str] = Counter()
  surface_kinds: Counter[str] = Counter()
  retention_reasons: Counter[str] = Counter()
  facade_counts: dict[str, Counter[str]] = {}
  official_parts, official_surfaces, straddlers = 0, 0, 0
  declared_outside_area, max_footprint_difference = 0.0, 0.0
  official_no_facade_low, other_no_facade_low = 0, 0
  core_ids, outer_ids, source_checks = set(), set(), []
  for chunk_index, entry in enumerate(manifest["chunks"]):
    path = SOURCE / entry["file"]
    assert digest(path) == entry["sha256"]
    records = read(path)["buildings"]
    assert len(records) == entry["buildings"]
    source_checks.append({"file": entry["file"], "sha256": entry["sha256"]})
    for record in records:
      identity, source_type = record["id"], record["sourceType"]
      assert identity not in source_ids
      source_ids.add(identity)
      previous = rendered.get(identity)
      assert (previous is None) == (record["category"] == "retained")
      height = source_height(record)
      if identity in transferred:
        current = "dedicated-alexander-stations-v183"
      elif record["category"] == "retained":
        current = retained_class(record)
      else:
        current = f"{source_type}:{record['category']}"
      by_class[current] += 1
      retention_reasons.update(record["ownershipReasons"])
      for key in (
        "building:colour",
        "building:material",
        "roof:colour",
        "roof:material",
        "building:levels",
      ):
        if record["osmTags"].get(key):
          material_tags[key] += 1
      surfaces = sum(len(part["surfaces"]) for part in record["parts"])
      if source_type == "official-lod2":
        official_parts += len(record["parts"])
        official_surfaces += surfaces
        straddlers += int(record["boundaryStraddler"])
        declared_outside_area += record["outsideReleaseAreaM2"]
        footprint = unary_union(
          [Polygon(p["ring"], p.get("holes", [])) for p in record["footprintPolygons"]]
        )
        max_footprint_difference = max(
          max_footprint_difference,
          abs(footprint.area - record["sourceFootprintAreaM2"]),
        )
        for part in record["parts"]:
          surface_kinds.update(s["kind"] for s in part["surfaces"])
      if record["category"] == "core" and record["parts"]:
        core_ids.add(identity)
      if record["category"] != "retained" and source_type == "official-lod2":
        outer_ids.update(record["outerOwnerIds"])
      if previous and identity not in transferred:
        c = facade_counts.setdefault(current, Counter())
        c["sourceRecords"] += 1
        c["withEstimatedFacade"] += int(previous["facadeTriangles"] > 0)
        c["withoutEstimatedFacade"] += int(previous["facadeTriangles"] == 0)
        c["sourceTrianglesBeforeSpatialClipping"] += previous["sourceTriangles"]
        c["facadeTrianglesBeforeSpatialClipping"] += previous["facadeTriangles"]
        if not previous["facadeTriangles"] and height < 4:
          if source_type == "official-lod2":
            official_no_facade_low += 1
          else:
            other_no_facade_low += 1
      source_rows.append(
        [
          identity,
          source_type,
          record["category"],
          current,
          chunk_index,
          len(record["parts"]),
          surfaces,
          previous["facadeTriangles"] if previous else None,
          round(height, 3),
          previous["materialEvidence"] if previous else "retained-existing-evidence",
        ]
      )
  assert source_ids == {r["id"] for r in manifest["owners"]}
  assert transferred <= source_ids
  source_runtime = {}
  for mode, filename in (
    ("drawn", "altMitteDrawnV169Source.json"),
    ("minecraft", "altMitteNativeV169Source.json"),
  ):
    runtime = read(APP / filename)
    assert set(runtime["sourceParents"]) == core_ids
    assert len(runtime["sourceParents"]) == len(core_ids)
    assert all((APP / p["file"]).is_file() for p in runtime["chunkFiles"])
    source_runtime[mode] = {
      "residentOfficialParents": len(core_ids),
      "residentPacketFiles": len(runtime["chunkFiles"]),
      "manifestSha256": digest(APP / filename),
    }
  assert outer_ids == set(
    current_manifest["source"]["altMitteV169"]["exactMovedOuterSourceIds"]
  )
  # Exact current native/drawn transfers are documented separately from the
  # frozen v169 source inventory. Do not mistake their absence for lost data.
  transfer_audit = read(GEO / "alexander-stations-v183-audit.json")
  assert transferred == set(transfer_audit["sourceIds"])
  assert transfer_audit["unrelatedGeometryPreserved"]
  dedicated = read(APP / "alexanderStationsV183Source.json")
  assert transferred <= {r["parentId"] for r in dedicated["profiles"]}
  boundary_path = GEO / "alt-mitte-v169-boundary.geojson"
  assert digest(boundary_path) == manifest["boundary"]["sha256"]
  boundary = shape(read(boundary_path)["features"][0]["geometry"])
  counts = {
    "catalogueRecords": len(source_rows),
    "officialSourceFamilies": sum(r[1] == "official-lod2" for r in source_rows),
    "officialDeepestParts": official_parts,
    "officialSourcePolygons": official_surfaces,
    "osmResidualRecords": sum(r[1] != "official-lod2" for r in source_rows),
    "boundaryStraddlersKeptWhole": straddlers,
    "unclassifiedSourceRecords": 0,
    "activeGenericOwnersWithFacade": sum(
      c["withEstimatedFacade"] for c in facade_counts.values()
    ),
    "activeGenericOwnersWithoutFacade": sum(
      c["withoutEstimatedFacade"] for c in facade_counts.values()
    ),
    "withoutFacadeOfficialHeightBelow4m": official_no_facade_low,
    "withoutFacadeOsmHeightBelow4m": other_no_facade_low,
  }
  return {
    "schemaVersion": 1,
    "auditVersion": "1.0.86",
    "inventoryBaseline": "v1.0.69 complete inventory, current v1.0.85 ownership",
    "purpose": "Complete source inventory and runtime ownership audit, not a per-window architectural survey.",
    "boundary": {
      "file": str(boundary_path.relative_to(ROOT)),
      "sha256": digest(boundary_path),
      "areaM2": round(boundary.area, 3),
      "historicalQualification": "Conservative pre-2001 Mitte selection; current unsimplified Ortsteil boundary retains the documented 310 m2 unbuilt 2008 embankment addition. Wedding and Tiergarten excluded.",
      "selection": "Positive footprint overlap, full source families retained across the line.",
    },
    "counts": counts,
    "currentClasses": dict(sorted(by_class.items())),
    "activeGenericFacadeCounts": {k: dict(v) for k, v in sorted(facade_counts.items())},
    "sourcePolygonKinds": dict(sorted(surface_kinds.items())),
    "sourceTagRecordCounts": dict(sorted(material_tags.items())),
    "runtimeOwnership": {
      "core": source_runtime,
      "exactMovedOuterOwners": len(outer_ids),
      "dedicatedV183Transfers": sorted(transferred),
      "transferAudit": "geo_data/regierungsviertel/alexander-stations-v183-audit.json",
      "sourceGeometryChangedByThisAudit": False,
      "facadeKind": "alt-mitte-v169",
      "coreDrawn": "Resident complete source shells; estimated facade quads stream independently.",
      "outerDrawn": "Complete source shell and estimated facade quads in bounded surrounding-city packets.",
      "native": "Separate block-native full geometry; no smooth copy.",
    },
    "checks": {
      "verifiedSourceChunks": len(source_checks),
      "catalogueAndOwnerIdentitySetsEqual": True,
      "coreResidentAndSourceParentSetsEqual": True,
      "outerSourceAndMovedOwnerSetsEqual": True,
      "declaredOfficialFootprintOutsideApprovedBoundsM2": declared_outside_area,
      "maximumStoredFootprintAreaRoundingDifferenceM2": round(
        max_footprint_difference, 6
      ),
      "sourceManifestSha256": digest(SOURCE / "source-manifest.json"),
      "frozenRenderAuditSha256": digest(SOURCE / "render-audit.json"),
    },
    "limits": [
      "Source family totals include structural and monument objects, including 2,599 Holocaust stele-field records. They are not a count of occupied physical houses.",
      "LoD2 provides measured walls, roofs and footprints, not surveyed window openings or cornice profiles. Generic windows and untagged materials remain explicitly estimated.",
      "Existing authored/glass and ambiguous overlap representations retain their complete prior appearance; source retention is not a claim that these were freshly rebuilt.",
      "Absence of generic facade quads is not automatically a defect: low/narrow walls, party walls, occupied approaches, and source holes/gables can exclude all eligible rectangles.",
      "The audit inventories every retained record and its active ownership route; it is not a visual inspection or photograph validation of every individual house.",
      "Per-record facade triangle counts are the frozen pre-spatial-clipping v169 counts. Four dedicated v183 transfers are identified, excluded from active generic totals, and retained in the record list.",
    ],
    "sourceChunks": source_checks,
    "retentionReasonCounts": dict(sorted(retention_reasons.items())),
    "recordColumns": [
      "sourceId",
      "sourceType",
      "v169Category",
      "currentOwnershipClass",
      "sourceChunkIndex",
      "deepestParts",
      "sourcePolygons",
      "v169FacadeTrianglesBeforeSpatialClipping",
      "maximumPartDisplayHeightM",
      "materialEvidence",
    ],
    "records": sorted(source_rows),
  }


if __name__ == "__main__":
  audit = build_audit()
  OUTPUT.write_text(json.dumps(audit, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(json.dumps(audit["counts"], indent=2))
