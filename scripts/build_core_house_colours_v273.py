"""Step 10: exact neutral residential core-paint receipts; no geometry changes."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from shapely.affinity import affine_transform
from shapely.geometry import Polygon, shape

from scripts.build_alt_mitte_protection_v213 import aliases
from scripts.build_district_house_scope_v225 import source_regions
from scripts.build_district_house_scope_v226 import source_regions as east_regions
from scripts.build_north_mitte_colours_v271 import ROOF_TONES, WALL_TONES

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
ATTR = APP / "buildingAttributeSource.json"
OUTPUT = APP / "data/coreHouseColoursV273.json"
EVIDENCE = GEO / "core-house-colours-v273-evidence.json.gz"
# Positive residential identity. Unknown, commercial, civic, industrial and
# unnamed function codes are deliberately not inferred to be ordinary housing.
RESIDENTIAL = {"31001_1000", "31001_1010"} | {
  "osm_context:" + kind
  for kind in (
    "apartments",
    "residential",
    "house",
    "detached",
    "semidetached_house",
    "terrace",
    "bungalow",
  )
}
NATIVE_WALLS = (
  0xE8D1AE,
  0xB69B83,
  0xF3EFD0,
  0xD4D4B7,
  0xCE8065,
  0xD6DFE0,
  0xD2B17A,
  0xA4AA91,
  0xF5E3C5,
  0xC09A68,
  0xD4D4B7,
  0xB36F57,
)
NATIVE_ROOFS = (0x74806D, 0x8E9A9E, 0xB69B83, 0xA4AA91)
GENERIC_DATA_PREFIXES = (
  "altMitte",
  "district",
  "house",
  "outer",
  "grey",
  "moabitHouses",
  "northMitteColours",
  "weinbergLegacyMaterials",
  "kollwitzMaterials",
  "kiezFacades",
  "cityCoverage",
  "ringCity",
  "namedScope",
  "eastCityScope",
)


def digest(path: Path) -> str:
  """Hash one immutable source without allocating a second file copy."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def fnv(text: str, seed: int = 2166136261) -> int:
  """Stable existing city palette/guard hash."""
  for char in text:
    seed = ((seed ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return seed


def guard_text(part: dict[str, Any]) -> str:
  """Bind height, class, roof, every footprint/hole coordinate and old sample."""
  text = ",".join(str(part[k]) for k in ("y0_dm", "h_dm", "class"))
  text += "," + str(part.get("roof", 0)) + ";"
  for ring in [part["ring"], *part.get("holes", [])]:
    text += "[" + "".join(f"{x},{z};" for x, z in ring) + "]"
  return text + ";" + ",".join(map(str, part.get("tone", [])))


def source_guard(part: dict[str, Any]) -> list[int]:
  """Two independent 32-bit guards; receipts also bind the exact source ID."""
  text = guard_text(part)
  return [fnv(text), fnv(text, 2246822519)]


def source_owners() -> dict[str, list[tuple[str, str | None, str | None, str]]]:
  """Read complete official/OSM source identities, not a geographic sample."""
  result = defaultdict(list)
  for name in ("buildings.gpkg", "osm_context_buildings.gpkg"):
    with sqlite3.connect(f"file:{GEO / name}?mode=ro", uri=True) as db:
      for row in db.execute(
        "SELECT building_id,parent_building_id,building_name,function FROM buildings"
      ):
        result[row[0][-8:]].append(row)
  return result


def protections() -> tuple[set[str], list[dict[str, str]]]:
  """Protect exact authored IDs, including named data-backed newer models."""
  protected, receipts = set(), []
  legacy = GEO / "alt-mitte-appearance-v213-protected.json"
  protected.update(json.loads(legacy.read_text())["ids"])
  receipts.append({"file": str(legacy.relative_to(ROOT)), "sha256": digest(legacy)})
  transferred = APP / "data/altMitteV169Ownership.json"
  protected.update(json.loads(transferred.read_text())["prismIds"])
  receipts.append(
    {"file": str(transferred.relative_to(ROOT)), "sha256": digest(transferred)}
  )
  resolved = GEO / "core-house-colours-v273-protected.json"
  protected.update(json.loads(resolved.read_text())["ids"])
  receipts.append({"file": str(resolved.relative_to(ROOT)), "sha256": digest(resolved)})
  # Read literals only: broad catalogues and generic house recipes are not
  # evidence that each ordinary house has an individually authored colour.
  for path in sorted(APP.glob("*.ts")):
    if path.name == "CoreHouseColoursV273.ts" or path.name.startswith("qa-"):
      continue
    found = set(
      re.findall(r"""["']([A-Za-z0-9]{8}|DEBE[A-Za-z0-9]+)["']""", path.read_text())
    )
    if found:
      protected.update(aliases(found))
      receipts.append({"file": str(path.relative_to(ROOT)), "sha256": digest(path)})
  for path in sorted((APP / "data").glob("*.json")):
    if "V273" in path.name or path.name.startswith(GENERIC_DATA_PREFIXES):
      continue
    found = set(re.findall(r'"(DEBE[A-Za-z0-9]+)"', path.read_text()))
    if found:
      protected.update(aliases(found))
      receipts.append({"file": str(path.relative_to(ROOT)), "sha256": digest(path)})
  return protected, receipts


def compile_receipts() -> tuple[dict[str, Any], dict[str, Any]]:
  """Audit every original core part; change only positively evidenced fallbacks."""
  source = json.loads(PRISMS.read_text())
  attributes = json.loads(ATTR.read_text())
  owners = source_owners()
  protected, protection_receipts = protections()
  # Parent consistency: a coloured/authored child protects the complete family.
  blocked_families = set()
  for part in source["buildings"]:
    tags = (
      attributes["records"][attributes["prisms"][part["id"]]]["tags"]
      if part["id"] in attributes["prisms"]
      else {}
    )
    for full_id, parent, name, _ in owners.get(part["id"], []):
      if (
        name
        or {part["id"], full_id, parent} & protected
        or any(
          k in tags
          for k in (
            "building:colour",
            "building:material",
            "facade:colour",
            "facade:material",
          )
        )
      ):
        blocked_families.add(parent or full_id)
  regions = source_regions() | east_regions()
  for feature in json.loads(
    (GEO / "district-facades-v188-boundaries.geojson").read_text()
  )["features"]:
    regions[feature["properties"]["nam"]] = affine_transform(
      shape(feature["geometry"]), [1, 0, 0, -1, -389500, 5820000]
    )
  counts, reasons, records, runtime = (
    defaultdict(Counter),
    Counter(),
    [],
    defaultdict(list),
  )
  for index, part in enumerate(source["buildings"]):
    polygon = Polygon(
      [[x / 10, z / 10] for x, z in part["ring"]],
      [[[x / 10, z / 10] for x, z in ring] for ring in part.get("holes", [])],
    )
    point = polygon.representative_point()
    region = next(
      (name for name, shape in regions.items() if shape.covers(point)),
      "other existing core",
    )
    counts[region]["auditedParts"] += 1
    candidates = owners.get(part["id"], [])
    tags = (
      attributes["records"][attributes["prisms"][part["id"]]]["tags"]
      if part["id"] in attributes["prisms"]
      else {}
    )
    reason = "selected"
    if len(candidates) != 1:
      reason = "unresolvedSourceIdentity"
    else:
      full_id, parent, name, function = candidates[0]
      family = parent or full_id
      if function not in RESIDENTIAL:
        reason = "notPositiveResidentialUse"
      elif family in blocked_families:
        reason = "protectedAuthoredNamedOrMappedFamily"
      elif part["class"] != 0 or not 5 <= part["h_dm"] / 10 <= 45:
        reason = "nonOrdinaryHeightOrClass"
      elif not polygon.is_valid or polygon.is_empty:
        reason = "invalidFootprint"
      elif not part.get("tone") or max(part["tone"]) - min(part["tone"]) >= 24:
        reason = "notNeutralOverviewSample"
    reasons[reason] += 1
    counts[region][reason] += 1
    if reason != "selected":
      continue
    value = fnv(family)
    wall_index = value % len(WALL_TONES)
    roof_index = (value >> 16) % len(ROOF_TONES)
    roof = (
      -1
      if any(k in tags for k in ("roof:colour", "roof:material"))
      else ROOF_TONES[roof_index]
    )
    receipt = [
      *source_guard(part),
      WALL_TONES[wall_index],
      roof,
      NATIVE_WALLS[wall_index],
      -1 if roof < 0 else NATIVE_ROOFS[roof_index % len(NATIVE_ROOFS)],
    ]
    runtime[part["id"]].append(receipt)
    records.append(
      {
        "index": index,
        "id": part["id"],
        "family": family,
        "function": function,
        "region": region,
        "receipt": receipt,
      }
    )
  inputs = [PRISMS, ATTR, GEO / "buildings.gpkg", GEO / "osm_context_buildings.gpkg"]
  evidence = {
    "schemaVersion": 1,
    "policy": "Only positively residential, unobserved neutral overview fallback paint; unknown colours are contextual estimates, not photographic surveys.",
    "sourceParts": len(source["buildings"]),
    "counts": dict(reasons),
    "regions": {name: dict(count) for name, count in counts.items()},
    "inputs": [{"file": str(p.relative_to(ROOT)), "sha256": digest(p)} for p in inputs],
    "protectionReceipts": protection_receipts,
    "protectedIds": sorted(protected),
    "blockedFamilies": sorted(blocked_families),
    "selected": records,
    "wallTones": list(WALL_TONES),
    "roofTones": list(ROOF_TONES),
    "nativeWalls": list(NATIVE_WALLS),
    "nativeRoofs": list(NATIVE_ROOFS),
    "geometryChanges": 0,
    "newRuntimeMeshes": 0,
    "newGpuBytes": 0,
  }
  return {"schemaVersion": 1, "owners": dict(sorted(runtime.items()))}, evidence


if __name__ == "__main__":
  runtime, evidence = compile_receipts()
  OUTPUT.write_text(json.dumps(runtime, separators=(",", ":")) + "\n")
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    json.dumps(
      {
        "counts": evidence["counts"],
        "regions": evidence["regions"],
        "runtimeBytes": OUTPUT.stat().st_size,
      },
      indent=2,
    )
  )
