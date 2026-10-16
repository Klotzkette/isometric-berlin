"""Step 10: bounded complete arena source and open Warschauer station correction."""

from __future__ import annotations

import base64
import hashlib
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
from shapely.geometry import box, mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_district_facades_v188 import read_json, world, write_json
from build_karl_marx_allee_v161 import mesh_signature
from build_panorama_facade_v202 import fingerprint
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import chunk_payload, load_projected_polygon
from integrate_city_refinements_v166 import line_signature

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ARENA = "DEBE02YY2000060P"
STATION = "OSM-way-297153147"
SOURCE = GEO / "arena-station-v225-source.json"


def digest(path: Path) -> str:
  """Fingerprint the complete original bytes."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def ownership(selected: list[dict[str, Any]]) -> dict[str, Any]:
  """Audit only exact coloured triangles of two independently rebuilt owners."""
  scope = world(
    load_projected_polygon(GEO / "bounds.geojson").difference(
      load_projected_polygon(GEO / "bounds-v158.geojson")
    )
  )
  records, lines, navigation = [], [], []
  for desc in read_json(OUT / "manifest.json")["chunks"]:
    if desc.get("detailCompanionOf"):
      continue
    tile = box(*desc["bounds"])
    owned = [o for o in selected if o["geometry"].intersects(tile)]
    if not owned:
      continue
    for mode in ["drawn", "minecraft"]:
      path = OUT / desc[mode]["url"]
      payload = read_json(path)
      for owner in owned:
        rows = [
          b for b in payload["nav"]["buildings"] if b["sourceId"] == owner["sourceId"]
        ]
        if not rows:
          continue
        for row in rows:
          navigation.append(
            {
              "tile": desc["id"],
              "mode": mode,
              "owner": owner["sourceId"],
              "groundY": payload["nav"]["groundY"],
              "original": row,
            }
          )
        full = chunk_payload(
          desc["id"],
          tile,
          scope.intersection(tile),
          [owner],
          {},
          minecraft=mode == "minecraft",
        )
        empty = chunk_payload(
          desc["id"],
          tile,
          scope.intersection(tile),
          [],
          {},
          minecraft=mode == "minecraft",
        )
        expected = mesh_signature(full) - mesh_signature(empty)
        assert not expected - mesh_signature(payload), owner["sourceId"]
        for mesh in payload["meshes"]:
          if mesh["kind"] != "city":
            continue
          v = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          )
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
          removed = []
          for i, triangle in enumerate(v[ix]):
            key = b"".join(sorted(p.tobytes() for p in triangle))
            if expected[key]:
              expected[key] -= 1
              removed.append(i)
          if removed:
            records.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "kind": "city",
                "owner": owner["sourceId"],
                "sha256": digest(path),
                "fingerprint": fingerprint(
                  [mesh[k] for k in ["positions", "colors", "indices"]]
                ),
                "triangles": removed,
              }
            )
        assert not +expected
        if mode == "drawn" and payload.get("lines"):
          expected = line_signature(full["lines"]) - line_signature(empty["lines"])
          mesh = payload["lines"]
          v = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          ).reshape(-1, 2, 6)
          removed = []
          for i, segment in enumerate(v):
            key = b"".join(sorted(p.tobytes() for p in segment))
            if expected[key]:
              expected[key] -= 1
              removed.append(i)
          assert not +expected
          if removed:
            lines.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "owner": owner["sourceId"],
                "sha256": digest(path),
                "fingerprint": fingerprint([mesh[k] for k in ["positions", "colors"]]),
                "segments": removed,
              }
            )
  assert {r["owner"] for r in records} == {ARENA, STATION}
  return {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "records": records,
    "lineRecords": lines,
    "navigationRecords": navigation,
  }


def build() -> None:
  """Produce small derivative models, evidence and exact ownership guards."""
  archive = GEO / "raw/lod2/LoD2_394_5818.zip"
  parent = extract_parent(archive, ARENA)
  parts = [part_profile(p) for p in leaf_building_parts(parent)]
  selected = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where=f"sourceId IN ('{ARENA}','{STATION}')",
  ).to_dict("records")
  rail_path = DATA / "railStationsV190.json"
  rail = read_json(rail_path)
  station = next(r for r in rail["roofs"] if r["id"] == "way/297153147")
  platforms = [p for p in rail["platforms"] if p["station"] == "Warschauer Straße"]
  arena_row = next(o for o in selected if o["sourceId"] == ARENA)
  low = arena_row["sourceGroundY"]
  source = {
    "schemaVersion": 1,
    "step": 10,
    "sourceParent": ARENA,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_394_5818.zip",
    "sourceArchiveSha256": digest(archive),
    "license": "dl-de/zero-2-0",
    "parts": parts,
    "station": station,
    "platforms": platforms,
    "visualReferences": read_json(GEO / "arena-station-v225-credits.json"),
    "railSourcePath": str(rail_path.relative_to(ROOT)),
    "railSourceSha256": digest(rail_path),
    "priorOwners": [
      {
        k: mapping(v) if k == "geometry" else v
        for k, v in o.items()
        if k in ["sourceId", "geometry", "height", "minHeight", "heightSource"]
      }
      for o in selected
    ],
    "references": [
      {
        "url": "https://www.uber-arena.de/die-arena/daten-fakten",
        "facts": "160 × 130 × 35 m; curved 105-degree glass front; 120 × 12 m LED field. Published overview dimensions do not replace measured source sheets.",
      },
      {
        "url": "https://www.uber.com/de/de/newsroom/uber-arena-neuerungen/",
        "facts": "Current name since March 2024; 34 m roof lettering.",
      },
      {
        "url": "https://www.pml-lange.de/index.php?id=210",
        "facts": "Façade contractor: steel mullion/transom façade, stone and metal cladding. PML photographs viewed only as exterior-form reference; not bundled.",
      },
      {
        "url": "https://kl-ing.de/projekte/projekt/empfangsgebaeude-s-bahnhof-warschauer-strasse-berlin/",
        "facts": "Structural checker: hall 55 × ca.27.5 m, ca.16 m above platform; 2 × 14 concrete columns; fish-belly steel roof beams at 10 m. Construction photographs reference-only.",
      },
      {
        "url": "https://implenia.com/referenzen/detail/ref/s-bahnhof-warschauer-strasse-in-berlin/",
        "facts": "Completed 2019; copper cladding, steel mullion/transom façade, glass roofs, expanded-metal and fibre-cement cladding; architect dlw.",
      },
    ],
    "estimates": "Original arena parts retain every source wall/roof sheet and XZ ring; y is shifted by 3 minus the old parent ground to match existing presentation terrain. Station exact OSM footprint is 57.952 × 28.130 m, retained rather than forcing the approximate published 55 × 27.5 m dimensions. Existing platform y=3.96 is an established display grade, not surveyed railway elevation; station top=19.96, concourse=11.96 and member sections are explicit recognition estimates. No photo, logo image, sign font, ad content or texture is distributed.",
    "replacement": "Only exact original coloured triangles, corresponding ink and fully equal navigation rows of the two audited owners may yield. All other packet bytes, v190 station platform rings/furniture, and source inventories remain.",
  }
  write_json(SOURCE, source)
  surfaces, navigation = [], []
  for p in parts:
    navigation.append(
      {
        "id": p["id"],
        "owner": ARENA,
        "ring": p["ring"],
        "holes": p["holes"],
        "low": round(p["ground_y_m"] - low + 3, 3),
        "high": round(p["top_y_m"] - low + 3, 3),
      }
    )
    for i, s in enumerate(p["surfaces"]):
      rings = [
        [[x, round(y - low + 3, 3), z] for x, y, z in ring] for ring in s["rings"]
      ]
      color = 0xC3C4BC
      if s["kind"] == "RoofSurface":
        color = 0x555E63
      if p["id"] in {"DEBE3DwWcs50P2gT", "DEBE3DRFVkFXfC6B"}:
        color = 0x293945
      if p["id"] == "DEBE3DawapEBTYzY" and s["kind"] == "WallSurface":
        color = 0x718D95
      triangles = triangles_for(rings)
      if triangles:
        surfaces.append(
          {
            "part": p["id"],
            "surface": i,
            "kind": s["kind"],
            "color": color,
            "triangles": triangles,
          }
        )
  blocks = native_blocks({"surfaces": surfaces, "boxes": [], "rods": []})
  write_json(
    DATA / "arenaStationV225Envelopes.json", {"surfaces": surfaces, "blocks": blocks}
  )
  ring = [
    [round(x, 3), round(z, 3)]
    for x, z in arena_row["geometry"].geoms[0].exterior.coords
  ]
  write_json(
    DATA / "arenaStationV225Profile.json",
    {
      "arena": {
        "id": ARENA,
        "ring": ring,
        "frontPart": next(p["ring"] for p in parts if p["id"] == "DEBE3DawapEBTYzY"),
        "sourceGroundY": low,
        "sourceTopY": max(p["top_y_m"] for p in parts),
      },
      "station": {
        "id": STATION,
        "rings": station["rings"],
        "frame": station["frame"],
        "platformY": 3.96,
        "concourseY": 11.96,
        "roofY": 19.96,
      },
    },
  )
  write_json(
    DATA / "arenaStationV225Navigation.json",
    {
      "owners": navigation,
      "roofTriangles": [
        t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]
      ],
    },
  )
  receipt = ownership(selected)
  write_json(DATA / "arenaStationV225Ownership.json", receipt)
  evidence = {
    "sourceSha256": digest(SOURCE),
    "parts": len(parts),
    "sourceSheets": sum(len(p["surfaces"]) for p in parts),
    "runtimeSheets": len(surfaces),
    "triangles": sum(len(s["triangles"]) for s in surfaces),
    "nativeSurfaceRuns": len(blocks),
    "oldOwners": [ARENA, STATION],
    "transferTriangles": sum(len(r["triangles"]) for r in receipt["records"]),
    "transferInk": sum(len(r["segments"]) for r in receipt["lineRecords"]),
    "newScopeArea": 0,
  }
  write_json(GEO / "arena-station-v225-evidence.json", evidence)
  print(evidence)


if __name__ == "__main__":
  build()
