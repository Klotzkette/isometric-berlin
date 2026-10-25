"""Bounded, wholly additive Campus Nord facade evidence; no owner is retired."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from shapely.geometry import Polygon, box

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
  "mensa": "DEBE01YYK00007Gm",
  "rhoda": "DEBE00YYcP0000GV",
}
REFERENCES = [
  {
    "url": "https://www.peb-plus.de/mensa-nord",
    "author": "PEB+ Harm Reccius Architekten; project-gallery photograph, photographer not credited",
    "referenceImage": "https://static.wixstatic.com/media/286a8f_d65fe067efd04003af4e09f82f5bf4f4~mv2.jpg",
    "claim": "Former Charite washhouse, conversion 2005-09; new glass foyer, garden dining room and production kitchen. Photo supports red/pale brick courses, segmental windows and attic grilles.",
  },
  {
    "url": "https://www.stw.berlin/mensen/einrichtungen/humboldt-universit%C3%A4t-zu-berlin/mensa-hu-nord.html",
    "author": "studierendenWERK BERLIN",
    "claim": "Mensa HU Nord at Hannoversche Strasse 7, not an unspecified HU main-campus building.",
  },
  {
    "url": "https://bodamer-faber.net/projekte/bildung/forschungs-und-laborgebaeude-fuer-lebenswissenschaften-der-humboldt-universitaet-zu-berlin/",
    "author": "Bodamer Faber Architekten; photograph Werner Huthmacher",
    "referenceImage": "https://bodamer-faber.net/images/bodamer-faber-architekten-fullscreen/hub_14.jpg",
    "claim": "2016 life-sciences laboratory with three/four-storey step and entrances at Philippstrasse/courtyard. Photo supports continuous horizontal glazing and three green metal band tones, no invented rooftop equipment.",
  },
  {
    "url": "https://www.biologie.hu-berlin.de/de/material/institutspdf/institutsinfo-de-2017-01-31/%40%40download/file/IfB-HU-Berlin_de.pdf",
    "author": "Humboldt-Universitat zu Berlin, Institute of Biology, 2017 brochure",
    "claim": "Rhoda-Erdmann-Haus identity, opening 11 October 2016; three green facade tones.",
  },
  {
    "url": "https://mueller-reimann.de/projekte/anatomisches-theater-humboldt-universitaet",
    "author": "Muller Reimann Architekten; exterior photographs Stefan Muller, Berlin",
    "referenceImage": "https://mueller-reimann.de/sites/default/files/2017-11/182-ath-anatomisches-theater-hu-berlin-aussenansicht-mit-gerlachbau.jpg",
    "claim": "1790 Langhans theatre, restored 2005-12. Current exterior supports fine dome standing seams, radial fanlight bars and frieze details; existing v155 architecture retained in full.",
  },
]


def digest(path: Path) -> str:
  """Hash retained source without an additional file copy."""
  with path.open("rb") as source:
    return hashlib.file_digest(source, "sha256").hexdigest()


def build(root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any]]:
  """Copy complete source sheets to evidence; only small plans enter runtime."""
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5820.zip"
  source_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  all_prisms = json.loads(source_path.read_text())["buildings"]
  by_id = {p["id"]: p for p in all_prisms}
  profiles = {}
  runtime = {}
  for key, parent_id in TARGETS.items():
    parent = extract_parent(archive, parent_id)
    parts = [part_profile(p) for p in leaf_building_parts(parent)]
    ids = [p["id"][-8:] for p in parts]
    prisms = [by_id[identifier] for identifier in ids]
    profiles[key] = {"parentId": parent_id, "parts": parts, "retainedPrisms": prisms}
    runtime[key] = prisms
  selected = [p for group in runtime.values() for p in group]
  # Nearby source walls decide exposure; no internal courtyard/party wall panel
  # may conceal the neighbouring owner. The input remains a bounded excerpt.
  areas = [
    Polygon([(x / 10, z / 10) for x, z in p["ring"]]).buffer(1) for p in selected
  ]
  neighbours = [
    p
    for p in all_prisms
    if any(
      a.intersects(Polygon([(x / 10, z / 10) for x, z in p["ring"]])) for a in areas
    )
  ]
  theatre_path = root / "src/app/src/chariteTheatreSource.json"
  theatre = json.loads(theatre_path.read_text())
  canopy_element = extract_parent(archive, "DEBE01YYK0001xN5")
  canopy = part_profile(canopy_element)
  canopy["all_surfaces"] = [
    {
      "kind": child.tag.split("}")[-1],
      "rings": [world_ring(p) for p in child.findall(".//gml:posList", NS)],
    }
    for bound in canopy_element.findall("bldg:boundedBy", NS)
    for child in bound
  ]
  original = by_id["K0001xN5"]
  canopy_polygon = Polygon([(x / 10, z / 10) for x, z in original["ring"]])
  foreign = {
    p["id"]: Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    for p in neighbours
    if p["id"] != original["id"]
  }
  voxel_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  voxel = json.loads(voxel_path.read_text())
  cell, columns, controls = voxel["cell_m"], [], []
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = voxel["grid"]["min_z_idx"] + zi
    if not -1020 < (iz + 0.5) * cell < -980:
      continue
    for offset, count, low, high, kind in runs:
      first = voxel["grid"]["min_x_idx"] + offset
      for ix in range(first, first + count):
        if not 710 < (ix + 0.5) * cell < 745:
          continue
        square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if canopy_polygon.intersection(square).area <= 0.001:
          continue
        other = [
          key for key, poly in foreign.items() if poly.intersection(square).area > 0.001
        ]
        row = {"column": [ix, iz, low, high, kind], "foreign": other}
        (controls if other else columns).append(row)
  source_files = [
    "src/app/src/chariteTheatreSource.json",
    "src/app/src/ChariteAnatomicalTheatre.ts",
    "src/app/src/chariteTheatreProfile.ts",
  ]
  evidence = {
    "schema": "campus-nord-v266-evidence/1",
    "checked": "2026-10-25",
    "archiveUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5820.zip",
    "archiveSha256": digest(archive),
    "sourcePrismSha256": digest(source_path),
    "profiles": profiles,
    "retainedNeighbours": neighbours,
    "retainedTheatreSources": {p: digest(root / p) for p in source_files},
    "references": REFERENCES,
    "canopySource": canopy,
    "canopyPreviousPrism": original,
    "exclusiveCanopyColumns": columns,
    "retainedMixedCanopyColumns": controls,
    "sourceVoxelSha256": digest(voxel_path),
    "policy": "Additive facade fittings, except exact K0001xN5 false closing walls around the open Mensa canopy. This one roof retains every original measured vertex. Exact immutable Alt-Mitte receipts retire its duplicate shell/fittings/ink after complete replacement; all other prisms, mixed native cells, measured roofs, theatre shells, park paths and details remain.",
    "estimates": "Original source footprints/heights stay authoritative. Window count, widths, mullion spacing, brick joints, green band spacing and material colours are photo-based display estimates. Existing theatre geometry supplies every added dome/fanlight coordinate. No downloaded photograph is bundled or rendered.",
  }
  runtime.update(
    {
      "schema": "campus-nord-v266/1",
      "neighbours": neighbours,
      "theatreRing": theatre["parts"][1]["ring"],
      "canopy": {
        "previousPrism": original,
        "ring": canopy["ring"],
        "roof": [s for s in canopy["surfaces"] if s["kind"] == "RoofSurface"],
        "topY": canopy["top_y_m"],
        "cellM": cell,
        "columns": [r["column"] for r in columns],
      },
    }
  )
  return evidence, runtime


def main() -> None:
  """Write compact reproducible evidence and runtime excerpts."""
  evidence, runtime = build()
  for name, value in [
    ("geo_data/regierungsviertel/campus-nord-v266-evidence.json", evidence),
    ("src/app/src/data/campusNordV266.json", runtime),
  ]:
    path = ROOT / name
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{name}: {path.stat().st_size} bytes")


if __name__ == "__main__":
  main()
