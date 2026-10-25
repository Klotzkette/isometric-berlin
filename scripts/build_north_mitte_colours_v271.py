"""Step 10: finite source-bound colour receipts for the photographed grey blocks.

Retain every source triangle, opening, roof and public packet. Only unobserved
ordinary-house paint is varied; these are display tones, not measured colours.
"""

from __future__ import annotations

import base64
import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_alt_mitte_appearance_v213 as prior
from scripts.build_alt_mitte_protection_v213 import aliases, named_ids

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = prior.APP / "northMitteColoursV271.json"
INDEX = prior.APP / "northMitteColoursV271Index.json"
EVIDENCE = prior.GEO / "north-mitte-colours-v271-evidence.json.gz"
# Finite named-neighbourhood selection, not an administrative boundary. Select
# complete source families by a point inside their real footprint, never clipping
# a house at a display rectangle or assigning a new colour to a partial owner.
ZONES = {
  "weinbergspark": [1850, -1750, 2450, -1050],
  "zionskirchplatz-arkonaplatz": [2000, -2360, 2700, -1550],
  "kastanienallee": [2300, -2360, 3000, -1300],
}
# Light mineral plaster families, explicitly illustrative where source paint is
# unknown. Muted rose, warm ochre, ivory and sage separate adjacent real owners.
WALL_TONES = (
  0xE8DDC7,
  0xDCC5A6,
  0xEEE8D8,
  0xCDD4C3,
  0xDDBDB3,
  0xC4D1D0,
  0xE5CF9E,
  0xD4D1C7,
  0xE7D4BD,
  0xCFC2B3,
  0xDCDCCF,
  0xD8C4C8,
)
ROOF_TONES = (0x7D807C, 0x8B8175, 0x797F82, 0x998376, 0x878C84, 0x938B80)
EXTRA_PROTECTION_FILES = (
  "src/app/src/data/chorinerV250.json",
  "src/app/src/data/lennonV250.json",
)
# Their modern architectural distinction is independently documented. Do not
# assign inferred generic paint while their individual facade evidence is open.
EXTRA_PROTECTED = {"DEBE01YYK00002CB", "DEBE01YYK0000FDO"}
# Native source envelopes expand by 2.84 m. Two such envelopes can overlap
# across a selection boundary, so retain neighbours within both expansions.
NATIVE_BLOCKER_MARGIN = 5.7


def rgb(value: int) -> prior.RGB:
  """Split one explicit sRGB display swatch."""
  return (value >> 16, (value >> 8) & 255, value & 255)


def palette(owner: str) -> tuple[prior.RGB, prior.RGB]:
  """Keep one reproducible tone per complete source family across packet seams."""
  value = 2166136261
  for character in owner:
    value = ((value ^ ord(character)) * 16777619) & 0xFFFFFFFF
  return rgb(WALL_TONES[value % len(WALL_TONES)]), rgb(
    ROOF_TONES[(value >> 16) % len(ROOF_TONES)]
  )


def footprint(record: dict) -> shapely.Geometry:
  """Retain measured rings and court holes for finite selection."""
  return unary_union(
    [
      shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
      for p in record.get("footprintPolygons", [])
    ]
  )


def zones_for(record: dict) -> list[str]:
  """Select complete real owners by a point on their actual footprint."""
  shape = footprint(record)
  if shape.is_empty:
    return []
  point = shape.representative_point()
  return [name for name, bounds in ZONES.items() if box(*bounds).covers(point)]


def protected_owners() -> tuple[set[str], list[dict]]:
  """Keep baseline heroes and all later finite authored products unchanged."""
  _, protected = prior.appearance()
  protected.update(prior.read(prior.PROTECTED)["ids"])
  protected.update(aliases(EXTRA_PROTECTED))
  receipts = []
  for name in EXTRA_PROTECTION_FILES:
    path = ROOT / name
    found = aliases(named_ids(prior.read(path)))
    protected.update(found)
    receipts.append({"file": name, "sha256": prior.digest(path), "ids": sorted(found)})
  return protected, receipts


def scoped_records(
  records: list[dict],
) -> list[tuple[dict, shapely.Geometry, list[str]]]:
  """Keep every potential neighbour of complete selected source families."""
  candidates = [
    (record, footprint(record), zones_for(record))
    for record in records
    if record["category"] in {"core", "outer"}
    and record["sourceType"] == "official-lod2"
  ]
  # A selected family's complete source may extend beyond the display rectangle.
  # Neighbour protection must follow that real extent, not the rectangle edge.
  blocker_area = unary_union([shape for _, shape, zones in candidates if zones]).buffer(
    NATIVE_BLOCKER_MARGIN
  )
  return [item for item in candidates if item[1].intersects(blocker_area)]


def source_selectors() -> tuple[list, list, list, list, dict]:
  """Bind display corrections only to unknown roles of exact official sheets."""
  inherited, _ = prior.appearance()
  protected, protection = protected_owners()
  baseline = prior.read(prior.EVIDENCE)
  old_evidence = {row["id"]: row for row in baseline["owners"]}
  offsets = prior.read(prior.APP / "weinbergBuildingOffsetsV176.json")["offsets"]
  surfaces, native, evidence = [], [], []
  counts: Counter = Counter()
  for record, _, zones in scoped_records(prior.source_records()):
    # Include nearby protected/unselected neighbours in the native ambiguity
    # proof; a two-metre block can intersect more than one actual source owner.
    old = old_evidence.get(record["id"], {})
    allowed = bool(
      zones and old.get("eligible") and not prior.aliases(record) & protected
    )
    tags = record.get("osmTags", {})
    unknown_wall = not (tags.get("building:colour") or tags.get("building:material"))
    unknown_roof = not (tags.get("roof:colour") or tags.get("roof:material"))
    wall, roof = palette(record["id"])
    defaults = prior.old_materials(tags)
    offset = float(offsets.get(record["id"], 0))
    if zones:
      evidence.append(
        {
          "id": record["id"],
          "zones": zones,
          "eligible": allowed,
          "wallEligible": allowed and unknown_wall,
          "roofEligible": allowed and unknown_roof,
          "wallSrgb": wall,
          "roofSrgb": roof,
          "sourceFileTile": record.get("tile"),
          "parts": [p["id"] for p in record["parts"]],
          "reason": "unknown paint: contextual display estimate"
          if allowed
          else "authored/protected owner retained",
        }
      )
      counts["selectedSourceFamilies"] += 1
      counts["eligibleFamilies"] += int(allowed)
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
      native_footprint = unary_union(
        [
          shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
          for p in part["footprintPolygons"]
        ]
      ).buffer(2.84)
      # Preserve known material by role, including roofs on an otherwise
      # unpainted house. Disallowed roles still block ambiguous native matches.
      for role, before, after, unknown in (
        ("WallSurface", old_wall, wall, unknown_wall),
        ("RoofSurface", old_roof, roof, unknown_roof),
      ):
        native.append(
          prior.NativePart(
            record["id"],
            part["id"],
            native_footprint,
            part["groundY"] + offset,
            part["topY"] + offset,
            ((role, prior.linear(before), prior.linear(after)),),
            allowed and unknown,
          )
        )
  return surfaces, native, evidence, protection, dict(counts)


def build(*, write: bool = True) -> dict:
  """Compile bounded sequential packets; never regenerate public geometry."""
  surfaces, native, owners_evidence, protection, source_counts = source_selectors()
  drawn_tree = STRtree([row.bounds_xz for row in surfaces])
  native_tree = STRtree([row.footprint for row in native])
  bounds = tuple(float(x) for x in shapely.total_bounds([r.footprint for r in native]))
  output = {"schemaVersion": 1, "palette": [], "packets": {}}
  lookup: dict[int, int] = {}
  counts: dict[str, Counter] = defaultdict(Counter)
  owners: dict[str, set[str]] = defaultdict(set)
  receipts = []
  for mode, identity, path in prior.packet_paths(bounds):
    packet = prior.read(path)
    x0, _, z0 = packet["origin"]
    # Resident source pieces are enumerated globally by v213; filter them
    # before expensive proof work by their own complete decoded XZ extent.
    if not any(part["kind"] == prior.KIND for part in packet["meshes"]):
      continue
    is_native = mode == "minecraft"
    entries, selected = [], 0
    for ordinal, part in enumerate(packet["meshes"]):
      if part["kind"] != prior.KIND:
        continue
      coords = np.frombuffer(base64.b64decode(part["positions"]), dtype="<u2").reshape(
        -1, 3
      )
      if not len(coords):
        continue
      part_bounds = box(
        float(coords[:, 0].min()) / 100 + x0,
        float(coords[:, 2].min()) / 100 + z0,
        float(coords[:, 0].max()) / 100 + x0,
        float(coords[:, 2].max()) / 100 + z0,
      )
      if not part_bounds.intersects(box(*bounds)):
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
    if entries:
      output["packets"][mode + ":" + identity] = entries
      receipts.append(
        {
          "file": str(path.relative_to(ROOT)),
          "sha256": prior.digest(path),
          "mode": mode,
          "selectedVertices": selected,
        }
      )
      print(f"{mode}:{identity}: {selected} existing colour vertices", flush=True)
  raw = (json.dumps(output, separators=(",", ":")) + "\n").encode()
  evidence = {
    "schemaVersion": 1,
    "zones": ZONES,
    "nativeBlockerMargin": NATIVE_BLOCKER_MARGIN,
    "sourceManifestSha256": prior.digest(prior.SOURCE / "source-manifest.json"),
    "v213ProtectionSha256": prior.digest(prior.PROTECTED),
    "v213AppearanceEvidenceSha256": prior.digest(prior.EVIDENCE),
    "additionalProtection": protection,
    "extraProtected": sorted(EXTRA_PROTECTED),
    "sourceCounts": source_counts,
    "modeCounts": {k: dict(v) for k, v in counts.items()},
    "owners": owners_evidence,
    "ownersReceivingSelectors": {k: sorted(v) for k, v in owners.items()},
    "packetReceipts": receipts,
    "packetFilesChanged": 0,
    "runtimeBytes": len(raw),
    "runtimeGzipBytes": len(gzip.compress(raw, mtime=0)),
    "limits": [
      "Unknown paint uses contextual display tones, not a surveyed per-house colour.",
      "Mapped material/colour roles and authored owners retain priority.",
      "All source roofs, windows, walls, courts, indices, buffers and packet bytes are retained.",
      "Kollwitzplatz is outside Alt-Mitte169 and is not covered by this adapter.",
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
      "ownersReceivingSelectors",
      "additionalProtection",
    }
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
