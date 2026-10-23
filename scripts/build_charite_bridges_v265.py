"""Step 10: retain exact Charité bridge sources and exclusive voxel receipts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from shapely.geometry import Polygon, box

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
  "EWePLFPr": (390, "DEBE00YY1Mr0004R", "Luisenstraße glass bridge", 9.7, 17.5),
  "gQwBfdam": (389, "DEBE01YYK0000AII", "Hufelandweg diagonal passage", 8.7, 12.25),
  "4gyC0jjm": (389, "DEBE01YYK0000AII", "Hufelandweg return passage", 8.7, 12.25),
}


def digest(path: Path) -> str:
  """Hash a bounded source file without retaining it."""
  with path.open("rb") as handle:
    return hashlib.file_digest(handle, "sha256").hexdigest()


def build(root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any]]:
  """Retain measured plans and document the photograph-derived lower clearances."""
  prism_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  voxel_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  prisms = json.loads(prism_path.read_text())["buildings"]
  by_id = {p["id"]: p for p in prisms}
  profiles, sources, parents = [], [], {}
  for short_id, (tile, parent_id, name, bottom, top) in TARGETS.items():
    archive = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}_5820.zip"
    if parent_id not in parents:
      parents[parent_id] = extract_parent(archive, parent_id)
    parent = parents[parent_id]
    part = next(
      part
      for part in leaf_building_parts(parent)
      if part.get(GML_ID, "").endswith(short_id)
    )
    source = part_profile(part)
    # Unlike the old source helper, also retain ground/floor and every extra kind.
    source["all_surfaces"] = [
      {
        "kind": child.tag.split("}")[-1],
        "rings": [world_ring(p) for p in child.findall(".//gml:posList", NS)],
      }
      for bound in part.findall("bldg:boundedBy", NS)
      for child in bound
    ]
    source.update(
      parent_id=parent_id,
      source_created=parent.findtext("core:creationDate", namespaces=NS),
      source_url=f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}_5820.zip",
      source_sha256=digest(archive),
      original_prism=by_id[short_id],
    )
    sources.append(source)
    profiles.append(
      {
        "id": short_id,
        "name": name,
        "parent": parent_id,
        "ring": source["ring"],
        "holes": source["holes"],
        "groundY": by_id[short_id]["y0_dm"] / 10,
        "bottomY": bottom,
        "topY": top,
        "levels": 2 if short_id == "EWePLFPr" else 1,
        "previousPrism": by_id[short_id],
      }
    )
  polygons = {
    p["id"]: Polygon(
      [(x / 10, z / 10) for x, z in p["ring"]],
      [[(x / 10, z / 10) for x, z in r] for r in p.get("holes", [])],
    )
    for p in prisms
  }
  targets = {key: polygons[key] for key in TARGETS}
  # Check every source owner touching each coarse candidate, not just centrepoints.
  relevant = {
    key: polygon
    for key, polygon in polygons.items()
    if polygon.bounds[0] < 545
    and polygon.bounds[2] > 465
    and polygon.bounds[1] < -645
    and polygon.bounds[3] > -860
  }
  voxels = json.loads(voxel_path.read_text())
  cell = voxels["cell_m"]
  columns, controls = [], []
  for zi, runs in enumerate(voxels["building_rows"]):
    z_idx = voxels["grid"]["min_z_idx"] + zi
    z = (z_idx + 0.5) * cell
    if not -860 < z < -645:
      continue
    for x_offset, count, low, high, kind in runs:
      first_x = voxels["grid"]["min_x_idx"] + x_offset
      for x_idx in range(first_x, first_x + count):
        x = (x_idx + 0.5) * cell
        if not 465 < x < 545:
          continue
        square = box(x - cell / 2, z - cell / 2, x + cell / 2, z + cell / 2)
        owners = [k for k, p in targets.items() if p.intersection(square).area > 0.001]
        if not owners:
          continue
        foreign = [
          k
          for k, p in relevant.items()
          if k not in TARGETS and p.intersection(square).area > 0.001
        ]
        record = {
          "column": [x_idx, z_idx, low, high, kind],
          "owners": owners,
          "foreign": foreign,
        }
        (controls if foreign else columns).append(record)
  references = [
    {
      "url": "https://www.charite.de/service/pressemitteilung/artikel/detail/neue_bruecke_am_campus_charite_mitte",
      "claim": "2015 transparent steel/glass replacement over Luisenstraße; clearance raised about one metre for double-decker buses.",
      "author": "Charité; exterior photo Sabine Gudath",
    },
    {
      "url": "https://dieneue-charite.de/vision/zukunftsbausteine/campus-charite-mitte",
      "claim": "Current overview explicitly identifies a two-storey steel/glass bridge to the historic campus.",
    },
    {
      "url": "https://www.charite.de/service/lageplan/plan/map/ccm_hufelandweg_3/",
      "claim": "Hufelandweg 3 address on Campus Mitte, distinct from northern hospital sites.",
    },
    {
      "url": "https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Hufelandweg_3,_2025.jpg",
      "claim": "First-hand exterior photo: one-storey glazed passage, open undercroft, paired concrete support posts, pale aggregate panels and dark window frames.",
      "author": "Schibo",
      "license": "CC0-1.0",
      "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ]
  estimates = (
    "All source XZ rings retained; obsolete ground-to-roof source extrusion is "
    "reconstructed as the documented open bridge. Luisenstraße 4.5m road clearance, "
    "7.8m two-level enclosure; Hufelandweg 3.5m clearance and 3.55m enclosure are "
    "photo-based display estimates, not a measured engineering survey. Hufeland "
    "top follows translated source roof within 3cm. Mullions, colours, panels and "
    "two support posts are photographic estimates. Source creation date is file "
    "metadata, not evidence that every surface reflects the latest renovation."
  )
  evidence = {
    "schema": "charite-bridges-v265-evidence/1",
    "checked": "2026-10-23",
    "origin": {"easting": 389500, "northing": 5820000, "sourceY": "NHN-30"},
    "license": "dl-de/zero-2-0",
    "source_parts": sources,
    "source_prism_sha256": digest(prism_path),
    "source_voxel_sha256": digest(voxel_path),
    "exclusive_native_columns": columns,
    "retained_foreign_native_columns": controls,
    "unchanged_east_bridge_control": by_id["L2e097lj"],
    "identity_correction": "L2e097lj is east of the tower, not the Luisenstraße crossing; it remains unchanged. Virology and the medical museum are at Campus Mitte by Humboldthafen, not RKI at Nordufer.",
    "references": references,
    "estimates": estimates,
  }
  runtime = {
    "schema": "charite-bridges-v265/1",
    "sites": profiles,
    "cellM": cell,
    "columns": [row["column"] for row in columns],
    "supports": [
      [485.8, 6.95, -652.7, 0.48, 3.5, 0.48],
      [485.6, 6.95, -655.4, 0.48, 3.5, 0.48],
    ],
    "estimates": estimates,
  }
  return evidence, runtime


def main() -> None:
  """Write compact deterministic source receipts and three recognition profiles."""
  evidence, runtime = build()
  for relative, value in [
    ("geo_data/regierungsviertel/charite-bridges-v265-evidence.json", evidence),
    ("src/app/src/data/chariteBridgesV265.json", runtime),
  ]:
    path = ROOT / relative
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{relative}: {path.stat().st_size} bytes")


if __name__ == "__main__":
  main()
